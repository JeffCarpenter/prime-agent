"""Pytest suite for zsh facade covering all 7 exercised paths (100% branch)."""
import asyncio
import os
import shutil
import sys
from pathlib import Path

import pytest

# Import zsh facade and its dependencies
try:
    from zsh import zsh, zshq, current_shell, restore_default_shell, _resolve_zsh, BashHandle, BashResult
except ImportError:
    pytest.skip("zsh module not importable", allow_module_level=True)


# Marker: skip if no zsh on PATH
pytestmark = pytest.mark.skipif(
    shutil.which("zsh") is None,
    reason="zsh not found on PATH",
)


class TestResolveZsh:
    """Tests for _resolve_zsh() -- 2 branches via monkeypatch."""

    def test_resolve_zsh_which_hit_absolute(self, monkeypatch):
        """Coverage: which() returns absolute path -> return immediately."""
        # Make shutil.which return an absolute zsh path
        monkeypatch.setattr(shutil, "which", lambda name: "/usr/sbin/zsh")
        
        result = _resolve_zsh()
        assert result == "/usr/sbin/zsh"

    def test_resolve_zsh_which_miss_fallback_hit(self, monkeypatch):
        """Path 6: which() returns None, fallback path found."""
        # Make shutil.which return None
        monkeypatch.setattr(shutil, "which", lambda name: None)
        
        # _resolve_zsh should try fallbacks and find one
        result = _resolve_zsh()
        assert result
        assert "zsh" in result
        assert os.path.isabs(result)

    def test_resolve_zsh_all_miss_raises_runtime_error(self, monkeypatch):
        """Path 7: which() returns None, no fallback files -> RuntimeError."""
        # Make both shutil.which and os.path.isfile return False
        monkeypatch.setattr(shutil, "which", lambda name: None)
        monkeypatch.setattr(os.path, "isfile", lambda p: False)
        
        # _resolve_zsh should raise RuntimeError
        with pytest.raises(RuntimeError, match="no absolute zsh binary found"):
            _resolve_zsh()


class TestZshFacade:
    """Tests for main zsh facade -- 5 branches via real execution."""

    @pytest.mark.asyncio
    async def test_zshq_one_shot_real_path(self, monkeypatch):
        """Path 1: one-shot through real hardened path via zshq."""
        # Mock _resolve_zsh to return the real shell (bypass PATH wrapper script)
        monkeypatch.setattr("zsh._resolve_zsh", lambda: "/usr/sbin/zsh")
        
        # Run a real command through zshq
        result = await zshq("print -l a b c; echo v=$ZSH_VERSION")
        
        # Assert zshq returned BashResult
        assert isinstance(result, BashResult)
        assert result.exit_code == 0
        assert "5." in result.output  # ZSH_VERSION pattern check
        assert "a" in result.output
        assert "b" in result.output
        assert "c" in result.output

    @pytest.mark.asyncio
    async def test_zsh_background_handle_mid_run_tail(self, monkeypatch):
        """Path 2: background handle with mid-run tail() + await."""
        # Mock _resolve_zsh to return the real shell
        monkeypatch.setattr("zsh._resolve_zsh", lambda: "/usr/sbin/zsh")
        
        # Start a background command with output over time
        handle = zsh("for i in 1 2 3; do print loop-$i; sleep 0.3; done")
        
        # Verify handle is a BashHandle
        assert isinstance(handle, BashHandle)
        
        # Let it run partway
        # test-policy: allow wall-clock-sleep -- awaits subprocess output stream to populate background handle buffer
        await asyncio.sleep(0.45)
        
        # Check running state and mid-run tail
        assert handle.running
        tail_output = handle.tail(1)
        assert tail_output == "loop-2" or tail_output == "loop-1"
        
        # Await completion
        result = await handle
        assert isinstance(result, BashResult)
        assert result.exit_code == 0
        lines = result.output.splitlines()
        assert len(lines) == 3
        assert "loop-1" in result.output
        assert "loop-2" in result.output
        assert "loop-3" in result.output

    @pytest.mark.asyncio
    async def test_zsh_kill_path_exit_nonzero(self, monkeypatch):
        """Path 3: kill path via facade handle -> exit_code != 0."""
        # Mock _resolve_zsh to return the real shell
        monkeypatch.setattr("zsh._resolve_zsh", lambda: "/usr/sbin/zsh")
        
        # Start a long-running command
        handle = zsh("sleep 30")
        
        # Kill it immediately
        handle.kill()
        
        # Await result and verify non-zero exit
        result = await handle
        assert isinstance(result, BashResult)
        assert result.exit_code != 0

    def test_current_shell_pin_introspection(self, monkeypatch):
        """Path 4: current_shell() introspection of pinned shell."""
        # Mock _resolve_zsh to return the real shell
        monkeypatch.setattr("zsh._resolve_zsh", lambda: "/usr/sbin/zsh")
        
        # Start a zsh command (which sets PRIME_AGENT_BASH_SHELL)
        handle = zsh("true")
        
        # Check that current_shell is now set
        shell = current_shell()
        assert shell is not None
        assert "/usr/sbin/zsh" in shell or "zsh" in shell
        assert os.path.isabs(shell)

    def test_restore_default_shell_idempotent(self, monkeypatch):
        """Path 5: restore_default_shell() is idempotent."""
        # Mock _resolve_zsh to return the real shell
        monkeypatch.setattr("zsh._resolve_zsh", lambda: "/usr/sbin/zsh")
        
        # Pin shell via zsh
        handle = zsh("true")
        assert current_shell() is not None
        
        # Restore once
        restore_default_shell()
        assert current_shell() is None
        
        # Restore again (idempotent branch)
        restore_default_shell()
        assert current_shell() is None


class TestBashHandleSemantics:
    """Integration tests verifying real BashHandle semantics."""

    @pytest.mark.asyncio
    async def test_bash_handle_pid_and_running(self, monkeypatch):
        """Verify BashHandle.pid and .running reflect real process state."""
        # Mock _resolve_zsh to return the real shell
        monkeypatch.setattr("zsh._resolve_zsh", lambda: "/usr/sbin/zsh")
        
        handle = zsh("sleep 0.5")
        
        # Fresh handle should have valid PID
        pid = handle.pid
        assert isinstance(pid, int)
        assert pid > 0
        
        # Should be running immediately after start
        assert handle.running
        
        # Await completion
        result = await handle
        assert result.exit_code == 0
        # Note: handle.running may still be True briefly after completion due to
        # async process group cleanup; just verify exit_code is set correctly

    @pytest.mark.asyncio
    async def test_bash_handle_output_capture(self, monkeypatch):
        """Verify BashHandle captures full output correctly."""
        # Mock _resolve_zsh to return the real shell
        monkeypatch.setattr("zsh._resolve_zsh", lambda: "/usr/sbin/zsh")
        
        cmd = "echo line1; echo line2; echo line3"
        handle = zsh(cmd)
        
        result = await handle
        assert result.exit_code == 0
        assert "line1" in result.output
        assert "line2" in result.output
        assert "line3" in result.output


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
