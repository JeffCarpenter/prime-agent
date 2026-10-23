#!/usr/bin/env python3
"""Exercise Debian dependency resolution for packaged and rustup toolchains."""

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


CONTROL = Path(__file__).resolve().parent.parent / "debian/control"


@unittest.skipUnless(shutil.which("dpkg-checkbuilddeps"), "requires Debian dpkg tools")
class DebianBuildDependencies(unittest.TestCase):
    def check_dependencies(self, *, profile="", omit_python=False):
        # This private database models a build host with no packaged Rust.
        # It is used only for tests; real builds always check the host database.
        packages = {"build-essential": "12", "debhelper-compat": "13"}
        if not omit_python:
            packages["python3"] = "3.12"
        with tempfile.TemporaryDirectory() as directory:
            status = "\n".join(
                f"Package: {name}\nStatus: install ok installed\n"
                f"Architecture: all\nVersion: {version}\n"
                for name, version in packages.items()
            )
            (Path(directory) / "status").write_text(status)
            environment = dict(os.environ, LC_ALL="C", DPKG_COLORS="never")
            environment.pop("DEB_BUILD_PROFILES", None)
            return subprocess.run(
                ["dpkg-checkbuilddeps", f"--admindir={directory}", "-B",
                 "-P", profile, str(CONTROL)],
                env=environment, capture_output=True, text=True, check=False,
            )

    def test_rustup_profile_accepts_an_unmanaged_toolchain(self):
        result = self.check_dependencies(profile="pkg.prime-agent.rustup")
        self.assertEqual((result.returncode, result.stderr), (0, ""))

    def test_default_build_still_requires_packaged_rust(self):
        result = self.check_dependencies()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("cargo", result.stderr)
        self.assertIn("rustc", result.stderr)

    def test_rustup_profile_keeps_other_dependency_checks(self):
        result = self.check_dependencies(
            profile="pkg.prime-agent.rustup", omit_python=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("python3", result.stderr)


if __name__ == "__main__":
    unittest.main()
