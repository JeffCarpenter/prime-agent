import os
import pty
import select
import sys
import time

cwd = sys.argv[1]
pid, fd = pty.fork()
if pid == 0:
    os.chdir(cwd)
    os.environ.pop("TMUX", None)
    os.environ.pop("STY", None)
    os.execvp("pnpm", ["pnpm", "exec", "tsx", "test/fixtures/login-dialog-scrollback-e2e.ts"])

output = bytearray()
sent_ctrl_c = False
deadline = time.monotonic() + 8
while time.monotonic() < deadline:
    ready, _, _ = select.select([fd], [], [], 0.05)
    if ready:
        try:
            chunk = os.read(fd, 4096)
        except OSError:
            _, status = os.waitpid(pid, 0)
            sys.stdout.buffer.write(output)
            sys.exit(os.waitstatus_to_exitcode(status))
        if not chunk:
            break
        output.extend(chunk)
        if not sent_ctrl_c and b"Press Ctrl+C to return to Prime Agent." in output:
            os.write(fd, b"\x03")
            sent_ctrl_c = True
    finished, status = os.waitpid(pid, os.WNOHANG)
    if finished:
        sys.stdout.buffer.write(output)
        sys.exit(os.waitstatus_to_exitcode(status))

try:
    os.kill(pid, 9)
except ProcessLookupError:
    pass
os.waitpid(pid, 0)
sys.stdout.buffer.write(output)
sys.exit(25)
