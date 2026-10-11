"""Integration tests for the session kernel-state link helper."""

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "link_kernel_state.py"
SESSION_ID = "01a12cd1-6dca-7783-aa84-2f599f186360"
PLAN_ID = "2026-10-10-rebase-onto-upstream-v0-10-0-via-native-"


class KernelStateLinkTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.home = self.root / "home"
        self.home.mkdir()
        self.repo = self.root / "repo"
        self.repo.mkdir()
        self.source = (
            self.home
            / ".prime/agent/session-artifacts"
            / SESSION_ID
            / "xonsh/kernel-state.dill"
        )
        self.source.parent.mkdir(parents=True)
        self.source.write_bytes(b"session state")
        self.link = self.repo / ".planning/kernel-state" / SESSION_ID

    def run_script(self, *extra):
        return subprocess.run(
            [
                sys.executable,
                str(SCRIPT),
                SESSION_ID,
                "--repo-root",
                str(self.repo),
                *extra,
            ],
            env={**os.environ, "HOME": str(self.home)},
            capture_output=True,
            text=True,
            check=False,
        )

    def test_creates_relative_uuid_named_link(self):
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(self.link.is_symlink())
        self.assertFalse(self.link.readlink().is_absolute())
        self.assertEqual(self.link.resolve(), self.source)
        self.assertEqual(result.stdout.strip(), str(self.link))

    def test_repeated_run_keeps_the_same_link(self):
        self.assertEqual(self.run_script().returncode, 0)
        original = self.link.readlink()
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.link.readlink(), original)

    def test_removes_verified_old_plan_link_only_after_creating_new_link(self):
        old_link = self.home / ".planning" / PLAN_ID / "kernel-state.dill"
        old_link.parent.mkdir(parents=True)
        old_link.symlink_to(self.source)
        result = self.run_script("--plan-id", PLAN_ID)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.link.resolve(), self.source)
        self.assertFalse(old_link.is_symlink())

    def test_preserves_unrelated_old_plan_link(self):
        other = self.root / "other.dill"
        other.write_bytes(b"other state")
        old_link = self.home / ".planning" / PLAN_ID / "kernel-state.dill"
        old_link.parent.mkdir(parents=True)
        old_link.symlink_to(other)
        result = self.run_script("--plan-id", PLAN_ID)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.link.resolve(), self.source)
        self.assertTrue(old_link.is_symlink())
        self.assertEqual(old_link.resolve(), other)

    def test_refuses_to_replace_existing_destination(self):
        self.link.parent.mkdir(parents=True)
        self.link.write_text("keep me")
        old_link = self.home / ".planning" / PLAN_ID / "kernel-state.dill"
        old_link.parent.mkdir(parents=True)
        old_link.symlink_to(self.source)
        result = self.run_script("--plan-id", PLAN_ID)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.link.read_text(), "keep me")
        self.assertTrue(old_link.is_symlink())

    def test_missing_source_does_not_create_destination(self):
        self.source.unlink()
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.link.parent.exists())

    def test_rejects_invalid_uuid(self):
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "../wrong", "--repo-root", str(self.repo)],
            env={**os.environ, "HOME": str(self.home)},
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.link.parent.exists())


if __name__ == "__main__":
    unittest.main()
