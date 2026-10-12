#!/usr/bin/env xonsh
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PLAN = Path(__file__).resolve().parents[1]
PACKET = PLAN / "native-rust-handoff"
SCRIPT = PACKET / "open-handoff.xsh"


def run_opener(*args, script=SCRIPT):
    return subprocess.run(["xonsh", "--no-rc", str(script), *args], cwd=ROOT, capture_output=True, text=True, check=False)


class OpenHandoffTests(unittest.TestCase):
    def test_default_prints_outline_from_project_root(self):
        result = run_opener()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("schema_version\tnumber", result.stdout)
        self.assertIn("context.session_id\tstring", result.stdout)

    def test_dotted_path_queries_value(self):
        result = run_opener("decision.question")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Rust", result.stdout)

    def test_missing_path_fails_helpfully(self):
        result = run_opener("decision.not_a_key")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("not_a_key", result.stderr)

    def test_queries_when_yaml_is_the_only_live_data_file(self):
        with tempfile.TemporaryDirectory(prefix=".handoff-test-", dir=PLAN) as tmp:
            copied = Path(tmp) / "packet"
            shutil.copytree(PACKET, copied)
            self.assertFalse(list(copied.rglob("*.json")))
            self.assertFalse((copied / "history").exists())
            result = run_opener("decision.question", script=copied / "open-handoff.xsh")
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("Rust", result.stdout)

    def test_modified_packet_rejected_before_read(self):
        with tempfile.TemporaryDirectory(prefix=".handoff-test-", dir=PLAN) as tmp:
            copied = Path(tmp) / "packet"
            shutil.copytree(PACKET, copied)
            target = copied / "scratchpad.yaml"
            target.write_text(target.read_text() + " ", encoding="utf-8")
            result = run_opener("decision.question", script=copied / "open-handoff.xsh")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("checksum", result.stderr.lower())


import sys
suite = unittest.defaultTestLoader.loadTestsFromTestCase(OpenHandoffTests)
result = unittest.TextTestRunner(verbosity=2).run(suite)
sys.exit(0 if result.wasSuccessful() else 1)
