#!/usr/bin/env xonsh
import datetime
import json
import os
from pathlib import Path

root = Path('/home/jeff/code/fork/prime-agent/.worktrees/native-rust-validation-20261011')
log = Path('/home/jeff/code/fork/prime-agent/.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/logs/native-pa-tui-catalog-control-20261012.log')
status = Path('/home/jeff/code/fork/prime-agent/.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/native-pa-tui-catalog-control-20261012.json')
os.chdir(root)
os.environ['CARGO_TARGET_DIR'] = '/home/jeff/code/fork/prime-agent/.worktrees/native-rust-validation-target'
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
result = {'command': 'cargo test -p pa-tui --locked --test agents_view_catalog_settle_carry', 'workdir': str(root), 'target_dir': os.environ['CARGO_TARGET_DIR'], 'log': str(log), 'started_at_utc': started, 'status': 'running', 'exit_code': None, 'runner_pid': os.getpid()}
status.write_text(json.dumps(result, indent=2)+'\n')
try:
    run = !(cargo test -p pa-tui --locked --test agents_view_catalog_settle_carry > @(str(log)) 2>&1)
    result.update({'status': 'finished', 'exit_code': run.rtn, 'completed_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat()})
except BaseException as error:
    result.update({'status': 'runner_error', 'error': repr(error), 'completed_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat()})
finally:
    status.write_text(json.dumps(result, indent=2)+'\n')
