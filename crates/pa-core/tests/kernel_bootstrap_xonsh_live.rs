//! Explicit clean-install smoke test for the native kernel/REPL venv.
//! Run with `cargo test -p pa-core --test kernel_bootstrap_xonsh_live -- --ignored`.
#![cfg(unix)]

use std::path::Path;
use std::process::Command;

use pa_core::kernel::{ensure_kernel_python, EnsureKernelPythonOptions};

#[tokio::test]
#[ignore = "installs Python packages into a fresh temporary kernel venv; needs uv and package access"]
async fn clean_kernel_bootstrap_runs_xonsh_sidecar_in_its_venv() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .expect("repository root");
    let dir = tempfile::tempdir().expect("isolated bootstrap root");
    let venv = dir.path().join("kernel-venv");
    std::env::set_var("PRIME_AGENT_KERNEL_VENV", &venv);
    std::env::remove_var("PRIME_AGENT_KERNEL_PYTHON");
    std::env::set_var("PI_PACKAGE_DIR", &root);

    let python = ensure_kernel_python(EnsureKernelPythonOptions::default())
        .await
        .expect("Rust bootstrap creates the isolated kernel venv");
    assert!(
        python.starts_with(&venv),
        "bootstrap used a different Python: {python:?}"
    );

    let imports = Command::new(&python)
        .args(["-c", "import xonsh; import rlm.repl"])
        .env_remove("PYTHONPATH")
        .output()
        .expect("run bootstrapped Python import check");
    assert!(
        imports.status.success(),
        "bootstrapped Python cannot import xonsh and rlm.repl: {}",
        String::from_utf8_lossy(&imports.stderr)
    );

    // The sidecar test drives `python -m rlm.repl` over the JSON-lines protocol,
    // using this same interpreter (sys.executable), including native xonsh syntax.
    let execution = Command::new(&python)
        .args([
            "-m",
            "unittest",
            "-v",
            "test.test_repl.ReplTest.test_xonsh_mode_executes_native_shell_syntax",
        ])
        .current_dir(root.join("prime-agent-runtime"))
        .env_remove("PYTHONPATH")
        .output()
        .expect("run xonsh-mode sidecar test from bootstrapped Python");
    assert!(
        execution.status.success(),
        "bootstrapped xonsh REPL failed: stdout={} stderr={}",
        String::from_utf8_lossy(&execution.stdout),
        String::from_utf8_lossy(&execution.stderr)
    );
    eprintln!(
        "bootstrapped xonsh unittest: {}",
        String::from_utf8_lossy(&execution.stderr)
    );
}
