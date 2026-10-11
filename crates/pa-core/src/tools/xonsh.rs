//! The `xonsh` tool: persistent Xonsh REPL execution through a kernel —
//! the model-facing definition, result text composition, and busy-kernel choice.
//! Kernel process management lives behind the [`IpythonKernelProvisioner`] trait.

use std::fmt::Write as _;
use std::sync::Arc;

use serde_json::json;

use crate::tools::ipython::{
    image_blocks_from_attachments, IpythonKernelProvisioner, IpythonToolUi, KernelExecError,
    KernelExecuteOptions, LateSentAgentMessageHandler, BUSY_KERNEL_KILL_CHOICE,
    BUSY_KERNEL_WAIT_CHOICE,
};
use crate::tools::tool_definition::{
    AbortSignal, ExecutionMode, OnUpdate, ToolContentBlock, ToolDefinition, ToolExecutionResult,
    ToolUpdate,
};

// Re-export execute result types from ipython tool module for parity
pub use crate::tools::ipython::{ExecuteResult, ExecuteStatus};

pub fn busy_kernel_prompt() -> String {
    [
        "Interrupted Xonsh cell is still running",
        "Ctrl+C sent an interrupt, but the previous cell has not stopped yet. A new command cannot start until it finishes.",
        "Waiting preserves the current kernel state. Killing restarts the kernel and loses in-memory variables, imports, and running tasks.",
    ]
    .join("\n")
}

pub fn kernel_restart_notice() -> &'static str {
    "<xonsh_kernel_reset>\nThe Xonsh kernel was restarted after a previous interrupted cell kept running. Variables, imports, async tasks, and open resources from before the restart are no longer available; recreate them before using them.\n</xonsh_kernel_reset>"
}

fn format_execute_text(result: &ExecuteResult, background_output: Option<&str>) -> String {
    let mut text = result.stdout.clone();
    if !result.stderr.is_empty() {
        text.push_str(if text.is_empty() { "" } else { "\n" });
        text.push_str(&result.stderr);
    }
    if let Some(result_text) = &result.result {
        text.push_str(if text.is_empty() { "" } else { "\n" });
        text.push_str(result_text);
    }
    if result.status == ExecuteStatus::Error {
        if let Some(error) = &result.error {
            text.push_str(if text.is_empty() { "" } else { "\n" });
            text.push_str(&error.traceback.join("\n"));
        }
    }
    if let Some(background) = background_output {
        let separator = if text.is_empty() { "" } else { "\n" };
        let _ = write!(
            text,
            "{separator}[background output (unattributed)]\n{background}"
        );
    }
    text
}

async fn execute_with_busy_kernel_choice(
    provisioner: &dyn IpythonKernelProvisioner,
    report_startup_progress: &crate::tools::ipython::BootstrapProgressHandler,
    code: &str,
    execute: KernelExecuteOptions<'_>,
    on_working_message: &(dyn Fn(Option<&str>) + Send + Sync),
    ui: Option<&Arc<dyn IpythonToolUi>>,
) -> Result<(ExecuteResult, bool), KernelExecError> {
    let mut kernel_restarted = false;
    loop {
        let manager = provisioner
            .ensure(
                Some(report_startup_progress.clone()),
                execute.signal.clone(),
            )
            .await
            .map_err(KernelExecError::Other)?;
        let result = manager
            .execute(
                code,
                KernelExecuteOptions {
                    signal: execute.signal.clone(),
                    on_stream: execute.on_stream,
                    on_late_sent_agent_message: execute.on_late_sent_agent_message.clone(),
                    mode: Some("xonsh"),
                },
            )
            .await;
        match result {
            Ok(result) => return Ok((result, kernel_restarted)),
            Err(err) => {
                let aborted = execute
                    .signal
                    .as_ref()
                    .is_some_and(tokio_util::sync::CancellationToken::is_cancelled);
                if !err.is_busy_after_interrupt() || aborted {
                    return Err(err);
                }
                // No UI (headless): cancel immediately.
                let Some(ui) = ui else {
                    return Err(err);
                };
                let choice = ui
                    .select(
                        &busy_kernel_prompt(),
                        &[BUSY_KERNEL_WAIT_CHOICE, BUSY_KERNEL_KILL_CHOICE],
                        execute.signal.as_ref(),
                    )
                    .await;
                match choice.as_deref() {
                    Some(BUSY_KERNEL_WAIT_CHOICE) => {
                        on_working_message(Some("Waiting for Xonsh kernel..."));
                    }
                    Some(BUSY_KERNEL_KILL_CHOICE) => {
                        on_working_message(Some("Restarting Xonsh kernel..."));
                        provisioner.kill().await;
                        kernel_restarted = true;
                    }
                    _ => return Err(err),
                }
            }
        }
    }
}

pub struct XonshToolOptions {
    /// Shared provisioner owning the kernel lifecycle.
    pub provisioner: Arc<dyn IpythonKernelProvisioner>,
    /// UI surface; `None` in headless sessions.
    pub ui: Option<Arc<dyn IpythonToolUi>>,
    pub on_late_sent_agent_message: Option<LateSentAgentMessageHandler>,
}

pub fn xonsh_tool_schema() -> serde_json::Value {
    json!({
        "type": "object",
        "required": ["code"],
        "properties": {
            "code": {
                "type": "string",
                "description": "Xonsh code to execute in the persistent Xonsh REPL. Use the target project's own environment for project imports, tests, scripts, CLIs, and dependency checks instead of direct kernel imports."
            }
        }
    })
}

pub fn xonsh_tool_description() -> &'static str {
    "Execute Xonsh code in a persistent Xonsh REPL. Top-level `await` is supported. Variables, imports, and loaded data persist across calls, and are revived on a best-effort basis when a session is resumed (objects that cannot be serialized are dropped and reported). Run shell commands directly or with `bash('cmd')` / `await bash('cmd')`. Project imports, tests, scripts, CLIs, and dependency checks should run through the target project's own environment."
}

#[tracing::instrument(
    level = "debug",
    name = "tool_xonsh_execute",
    skip(options, on_update, on_late_sent_agent_message)
    fields(code),
)]
pub async fn execute_xonsh(
    options: &XonshToolOptions,
    code: &str,
    signal: Option<AbortSignal>,
    on_update: Option<OnUpdate>,
    on_late_sent_agent_message: Option<crate::kernel::shared::LateSentAgentMessageCallback>,
) -> anyhow::Result<ToolExecutionResult> {
    let set_tool_working_message = |message: Option<&str>| {
        if let Some(ui) = &options.ui {
            ui.set_working_message(message);
        }
    };
    let on_update_startup = on_update.clone();
    let report_startup_progress: crate::tools::ipython::BootstrapProgressHandler =
        Arc::new(move |message: &str| {
            if let Some(on_update) = &on_update_startup {
                on_update(ToolUpdate {
                    content: vec![ToolContentBlock::Text {
                        text: message.to_string(),
                    }],
                    details: Some(json!({ "status": "starting" })),
                });
            }
        });

    let on_stream_cell = on_update.clone();
    let stream_callback = move |chunk: &str, _name: &'static str| {
        if let Some(on_update) = &on_stream_cell {
            on_update(ToolUpdate {
                content: vec![ToolContentBlock::Text {
                    text: chunk.to_string(),
                }],
                details: Some(json!({ "status": "ok" })),
            });
        }
    };

    let (r, kernel_restarted) = execute_with_busy_kernel_choice(
        options.provisioner.as_ref(),
        &report_startup_progress,
        code,
        KernelExecuteOptions {
            signal,
            on_stream: Some(&stream_callback),
            on_late_sent_agent_message,
            mode: Some("xonsh"),
        },
        &set_tool_working_message,
        options.ui.as_ref(),
    )
    .await
    .map_err(|err| anyhow::anyhow!("{}", err.message()))?;

    let text = format_execute_text(&r, r.background_output.as_deref());
    let text = if kernel_restarted {
        if text.is_empty() {
            kernel_restart_notice().to_string()
        } else {
            format!("{}\n\n{text}", kernel_restart_notice())
        }
    } else {
        text
    };

    let mut content = vec![ToolContentBlock::Text { text: text.clone() }];
    content.extend(image_blocks_from_attachments(&r.attachments));

    let sent_agent_messages_json: Vec<serde_json::Value> = r
        .sent_agent_messages
        .iter()
        .map(crate::tools::ipython::sent_agent_message_json)
        .collect();

    let mut details = json!({
        "status": match r.status {
            ExecuteStatus::Ok => "ok",
            ExecuteStatus::Error => "error",
            ExecuteStatus::Aborted => "aborted",
        },
        "stdout": r.stdout,
        "stderr": r.stderr,
        "kernelRestarted": kernel_restarted,
        "sentAgentMessages": sent_agent_messages_json,
    });
    if let Some(obj) = details.as_object_mut() {
        if let Some(duration_ms) = r.duration_ms {
            obj.insert("durationMs".to_string(), json!(duration_ms));
        }
        if let Some(result_text) = r.result {
            obj.insert("result".to_string(), json!(result_text));
        }
        if let Some(error) = &r.error {
            obj.insert("errorEname".to_string(), json!(error.ename));
            obj.insert(
                "error".to_string(),
                json!({
                    "ename": error.ename,
                    "evalue": error.evalue,
                    "traceback": error.traceback,
                }),
            );
        }
        if let Some(background) = r.background_output {
            obj.insert("backgroundOutput".to_string(), json!(background));
        }
        if let Some(bash) = &r.bash_commands {
            obj.insert(
                "bashCommands".to_string(),
                json!({
                    "count": bash.count,
                    "lines": bash.lines,
                }),
            );
        }
    }

    Ok(ToolExecutionResult {
        content,
        details: Some(details),
        is_error: r.status == ExecuteStatus::Error || r.status == ExecuteStatus::Aborted,
    })
}

/// The `xonsh` tool definition: exact name, schema, and description.
#[must_use]
pub fn create_xonsh_tool_definition(_cwd: &str, options: XonshToolOptions) -> ToolDefinition {
    let options = Arc::new(options);
    let execute: crate::tools::tool_definition::ExecuteFn = {
        let options = options;
        Arc::new(move |tool_call_id, params, signal, on_update| {
            let options = options.clone();
            let on_late_sent_agent_message =
                options.on_late_sent_agent_message.as_ref().map(|handler| {
                    let handler = std::sync::Arc::clone(handler);
                    let tool_call_id = tool_call_id.to_string();
                    std::sync::Arc::new(move |message| handler(&tool_call_id, message))
                        as crate::kernel::shared::LateSentAgentMessageCallback
                });
            Box::pin(async move {
                let code = params
                    .get("code")
                    .and_then(serde_json::Value::as_str)
                    .ok_or_else(|| anyhow::anyhow!("xonsh tool requires a code string"))?
                    .to_string();
                execute_xonsh(
                    &options,
                    &code,
                    signal,
                    on_update,
                    on_late_sent_agent_message,
                )
                .await
            })
        })
    };
    ToolDefinition {
        name: "xonsh".to_string(),
        label: "xonsh".to_string(),
        description: xonsh_tool_description().to_string(),
        prompt_snippet:
            "xonsh - persistent Xonsh REPL for code, state, and shell orchestration".to_string(),
        // The kernel is single-threaded; calls must not run in parallel.
        execution_mode: Some(ExecutionMode::Sequential),
        parameters: xonsh_tool_schema(),
        prepare_arguments: None,
        execute,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct MockProvisioner;

    impl IpythonKernelProvisioner for MockProvisioner {
        fn ensure(
            &self,
            _on_progress: Option<crate::tools::ipython::BootstrapProgressHandler>,
            _signal: Option<AbortSignal>,
        ) -> std::pin::Pin<
            Box<
                dyn std::future::Future<
                        Output = anyhow::Result<Box<dyn crate::tools::ipython::KernelExecutor>>,
                    > + Send,
            >,
        > {
            Box::pin(async { Err(anyhow::anyhow!("mock provisioner")) })
        }

        fn kill(&self) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>> {
            Box::pin(async {})
        }
    }

    #[test]
    fn xonsh_tool_definition_properties() {
        let options = XonshToolOptions {
            provisioner: Arc::new(MockProvisioner),
            ui: None,
            on_late_sent_agent_message: None,
        };
        let def = create_xonsh_tool_definition(".", options);
        assert_eq!(def.name, "xonsh");
        assert_eq!(def.label, "xonsh");
        assert!(def.description.contains("Xonsh"));
        assert_eq!(def.execution_mode, Some(ExecutionMode::Sequential));
    }
}
