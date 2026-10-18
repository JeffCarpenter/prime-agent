cwd=/home/jeff/code/fork/prime-agent/.worktrees/native-rust-xonsh-bootstrap
CARGO_INCREMENTAL=0 CARGO_TARGET_DIR=/home/jeff/code/fork/prime-agent/.worktrees/native-rust-validation-target rustup run stable cargo test -p pa-core --locked --test kernel_bootstrap_xonsh_live -- --ignored --nocapture
