#!/usr/bin/env xonsh
"""Focused offline validation for the Xonsh installer."""

from __future__ import annotations

import contextlib
import hashlib
import io
import subprocess
import sys
import tarfile
import tempfile
import types
from pathlib import Path


INSTALLER_PATH = Path(__file__).with_name("install.xsh")
module = types.ModuleType("install_xsh_under_test")
module.__file__ = str(INSTALLER_PATH)
sys.modules[module.__name__] = module
execx(INSTALLER_PATH.read_text(encoding="utf-8"), mode="exec", glbs=module.__dict__, filename=str(INSTALLER_PATH))
Installer = module.Installer


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def rejected(action):
    try:
        with contextlib.redirect_stderr(io.StringIO()):
            action()
    except (SystemExit, ValueError):
        return True
    return False


def test_native_platform_cli_precedes_download_configuration():
    class ProbeInstaller(Installer):
        def native_platform(self):
            return "linux-x64"

        def register_traps(self):
            raise AssertionError("--native-platform reached installer setup")

    output = io.StringIO()
    errors = io.StringIO()
    with contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
        status = ProbeInstaller(env={}).main(["--native-platform"])
    check(status == 0, f"--native-platform returned {status}: {errors.getvalue().strip()}")
    check(output.getvalue().strip() == "linux-x64", "--native-platform did not print the detected platform")


def test_invalid_install_method_is_rejected_before_side_effects():
    class NoSideEffectsInstaller(Installer):
        def register_traps(self):
            raise AssertionError("invalid install method reached installer setup")

    installer = NoSideEffectsInstaller(
        env={
            "PRIME_AGENT_DOWNLOAD_BASE_URL": "https://downloads.example.test",
            "PRIME_AGENT_INSTALL_METHOD": "invalid",
        }
    )
    errors = io.StringIO()
    with contextlib.redirect_stderr(errors):
        try:
            status = installer.main([])
        except SystemExit as error:
            status = error.code
    check(status == 1, f"invalid install method returned {status}")
    check("PRIME_AGENT_INSTALL_METHOD" in errors.getvalue(), "invalid install method did not name the setting")


def test_download_base_url_policy():
    secure = Installer(env={"PRIME_AGENT_DOWNLOAD_BASE_URL": "https://downloads.example.test"})
    secure.validate_download_base_url()

    for url in (
        "http://downloads.example.test",
        "ftp://127.0.0.1:8080",
        "http://127.0.0.1:8080",
        "http://localhost:8080",
        "http://127.0.0.1:not-a-port",
    ):
        installer = Installer(env={"PRIME_AGENT_DOWNLOAD_BASE_URL": url})
        check(rejected(installer.validate_download_base_url), f"unsafe download URL was accepted: {url}")

    loopback = Installer(
        env={
            "PRIME_AGENT_DOWNLOAD_BASE_URL": "http://127.0.0.1:8080",
            "PRIME_AGENT_ALLOW_INSECURE_HTTP_FOR_TESTS": "1",
        }
    )
    loopback.validate_download_base_url()
    check(loopback.allow_insecure_http, "explicit loopback test URL did not enable HTTP downloads")

    localhost = Installer(
        env={
            "PRIME_AGENT_DOWNLOAD_BASE_URL": "http://localhost:8080",
            "PRIME_AGENT_ALLOW_INSECURE_HTTP_FOR_TESTS": "1",
        }
    )
    check(rejected(localhost.validate_download_base_url), "localhost bypassed the numeric loopback-only policy")


def test_native_platform_classification():
    class PlatformFixture(Installer):
        def __init__(self, system, machine, *, glibc=False, musl=False, avx2=False, macos="14.0"):
            super().__init__(env={})
            self.fixture_system = system
            self.fixture_machine = machine
            self.fixture_glibc = glibc
            self.fixture_musl = musl
            self.fixture_avx2 = avx2
            self.fixture_macos = macos

        def system_name(self):
            return self.fixture_system

        def machine_name(self):
            return self.fixture_machine

        def native_glibc(self):
            return self.fixture_glibc

        def native_musl(self):
            return self.fixture_musl

        def native_avx2(self):
            return self.fixture_avx2

        def macos_version(self):
            return self.fixture_macos

        def native_macos_version(self):
            return self.fixture_macos

        def run(self, args, **kwargs):
            if list(args)[:2] == ["sw_vers", "-productVersion"]:
                return subprocess.CompletedProcess(args, 0, stdout=self.fixture_macos + "\n", stderr="")
            raise AssertionError(f"unexpected platform probe: {list(args)}")

    cases = (
        (PlatformFixture("Linux", "x86_64", glibc=True, avx2=True), "linux-x64"),
        (PlatformFixture("Linux", "x86_64", glibc=True, avx2=False), "linux-x64-baseline"),
        (PlatformFixture("Linux", "aarch64", musl=True), "linux-arm64-musl"),
        (PlatformFixture("Linux", "amd64", musl=True, avx2=False), "linux-x64-musl-baseline"),
        (PlatformFixture("Darwin", "arm64", macos="13.0"), "darwin-arm64"),
        (PlatformFixture("Darwin", "x86_64", macos="14.4"), "darwin-x64"),
        (PlatformFixture("Darwin", "arm64", macos="12.6"), None),
        (PlatformFixture("Windows", "AMD64"), None),
        (PlatformFixture("Linux", "riscv64", glibc=True), None),
        (PlatformFixture("Linux", "x86_64"), None),
    )
    for installer, expected in cases:
        actual = installer.native_platform()
        check(actual == expected, f"native platform was {actual!r}, expected {expected!r}")


def test_native_target_parsing_and_validation():
    digest = "a" * 64
    installer = Installer(env={"HOME": "/tmp"})
    installer.native_root = Path("/tmp/prime-agent")
    target = f"../releases/1.2.3-linux-x64-musl-baseline-{digest}.A1b2C3/prime-agent"
    parsed = installer.native_parse_target(target)
    check(parsed is not None, "valid managed target was rejected")
    check(parsed.version == "1.2.3", f"parsed version was {parsed.version!r}")
    check(parsed.platform == "linux-x64-musl-baseline", f"parsed platform was {parsed.platform!r}")
    check(parsed.digest == digest, f"parsed digest was {parsed.digest!r}")
    check(parsed.name == f"1.2.3-linux-x64-musl-baseline-{digest}.A1b2C3", f"parsed name was {parsed.name!r}")

    invalid = (
        f"../../releases/1.2.3-linux-x64-{digest}/prime-agent",
        f"../releases/1.2-linux-x64-{digest}/prime-agent",
        f"../releases/1.2.3-linux-riscv64-{digest}/prime-agent",
        f"../releases/1.2.3-linux-x64-{'A' * 64}/prime-agent",
        f"../releases/1.2.3-linux-x64-{'a' * 63}/prime-agent",
        f"../releases/1.2.3-linux-x64-{digest}.short/prime-agent",
        f"../releases/1.2.3-linux-x64-{digest}.abc-12/prime-agent",
        f"../releases/1.2.3-linux-x64-{digest}/other",
    )
    for candidate in invalid:
        check(installer.native_parse_target(candidate) is None, f"unsafe managed target was accepted: {candidate}")


def test_node_only_manifest_detection():
    digest = "b" * 64
    filename = "prime-agent-1.2.3.tgz"
    with tempfile.TemporaryDirectory(prefix="prime-agent-xsh-test.") as directory:
        manifest = Path(directory) / "SHA256SUMS"
        manifest.write_text(f"{digest}  {filename}\n", encoding="utf-8")
        check(Installer.release_is_node_only(manifest, filename), "valid Node-only manifest was not detected")

        manifest.write_text(
            f"{digest}  {filename}\n{digest}  prime-agent-1.2.3-linux-x64.tar.gz\n",
            encoding="utf-8",
        )
        check(not Installer.release_is_node_only(manifest, filename), "compiled archive manifest was treated as Node-only")

        manifest.write_text(f"{digest}  {filename}\n{digest}  {filename}\n", encoding="utf-8")
        check(not Installer.release_is_node_only(manifest, filename), "duplicate Node archive entry was accepted")

        manifest.write_text(f"short  {filename}\n", encoding="utf-8")
        check(not Installer.release_is_node_only(manifest, filename), "malformed Node checksum was accepted")


def test_native_probe_timeout_decimal_bounds():
    cases = {
        None: 60,
        "": 60,
        "garbage": 60,
        "0": 60,
        "000": 60,
        "1": 1,
        "010": 10,
        "600": 600,
        "601": 60,
    }
    for value, expected in cases.items():
        env = {} if value is None else {"PRIME_AGENT_PROBE_TIMEOUT_SECONDS": value}
        actual = Installer(env=env).native_probe_timeout()
        check(actual == expected, f"probe timeout {value!r} became {actual!r}, expected {expected}")


def test_curl_download_protocol_policy():
    class RecordingInstaller(Installer):
        def __post_init__(self):
            super().__post_init__()
            self.calls = []

        def run(self, args, **kwargs):
            self.calls.append(list(args))
            return module.CommandResult(0)

    cases = (
        ({"PRIME_AGENT_DOWNLOAD_BASE_URL": "https://downloads.example.test"}, "=https"),
        (
            {
                "PRIME_AGENT_DOWNLOAD_BASE_URL": "http://127.0.0.1:8080",
                "PRIME_AGENT_ALLOW_INSECURE_HTTP_FOR_TESTS": "1",
            },
            "=http,https",
        ),
    )
    request = ["-fsSL", "https://downloads.example.test/file", "-o", "/tmp/file"]
    for env, protocols in cases:
        installer = RecordingInstaller(env=env)
        installer.validate_download_base_url()
        installer.curl_download(request)
        check(
            installer.calls == [["curl", "--proto", protocols, "--proto-redir", "=https", *request]],
            f"unexpected curl policy argv: {installer.calls}",
        )


def test_native_prepare_root_and_unactivated_cleanup():
    with tempfile.TemporaryDirectory(prefix="prime-agent-xsh-test.") as directory:
        base = Path(directory)
        root = base / "managed"
        installer = Installer(env={"HOME": directory, "PRIME_AGENT_INSTALL_DIR": str(root)})
        installer.native_prepare_root()
        check(installer.native_root == root.resolve(), "native root was not canonicalized")
        check((root / ".managed").read_text(encoding="utf-8").strip() == "prime-agent-native-v1", "ownership marker missing")
        check((root / "bin").is_dir() and (root / "releases").is_dir(), "managed directories missing")
        check(installer.native_lock == root / ".install-lock" and installer.native_lock.is_dir(), "install lock missing")
        check(installer.native_stage is not None and installer.native_stage.parent == root, "native stage missing")
        check(installer.native_stage.name.startswith(".install."), "native stage has an unsafe name")

        contender = Installer(env={"HOME": directory, "PRIME_AGENT_INSTALL_DIR": str(root)})
        check(rejected(contender.native_prepare_root), "an existing native install lock was stolen")
        installer.native_cleanup()
        check(not root.exists(), "unactivated adopted root survived cleanup")

        foreign = base / "foreign"
        foreign.mkdir()
        (foreign / "keep").write_text("user data", encoding="utf-8")
        owner = Installer(env={"HOME": directory, "PRIME_AGENT_INSTALL_DIR": str(foreign)})
        check(rejected(owner.native_prepare_root), "nonempty unowned install root was adopted")
        check((foreign / "keep").read_text(encoding="utf-8") == "user data", "foreign install root was modified")


def test_native_validate_archive_member_policy():
    def write_archive(path, members):
        with tarfile.open(path, "w:gz") as archive:
            for member in members:
                if member.isreg():
                    data = b"content"
                    member.size = len(data)
                    archive.addfile(member, io.BytesIO(data))
                else:
                    archive.addfile(member)

    with tempfile.TemporaryDirectory(prefix="prime-agent-xsh-test.") as directory:
        base = Path(directory)
        valid_dir = tarfile.TarInfo("prime-agent-runtime")
        valid_dir.type = tarfile.DIRTYPE
        valid_file = tarfile.TarInfo("prime-agent-runtime/pyproject.toml")
        valid = base / "valid.tar.gz"
        write_archive(valid, [valid_dir, valid_file])
        Installer(env={}).native_validate_archive(valid)

        bad_members = []
        for name in ("../escape", "/absolute"):
            bad_members.append(tarfile.TarInfo(name))
        link = tarfile.TarInfo("link")
        link.type = tarfile.SYMTYPE
        link.linkname = "target"
        bad_members.append(link)
        special = tarfile.TarInfo("fifo")
        special.type = tarfile.FIFOTYPE
        bad_members.append(special)

        for index, member in enumerate(bad_members):
            archive = base / f"bad-{index}.tar.gz"
            write_archive(archive, [member])
            check(rejected(lambda archive=archive: Installer(env={}).native_validate_archive(archive)), f"unsafe archive member was accepted: {member.name}")


def test_native_atomic_link_and_activation_journal():
    class JournalInstaller(Installer):
        def __post_init__(self):
            super().__post_init__()
            self.observed_journal = None

        def native_atomic_link(self, target, link):
            if self.native_root is not None and Path(link).name == "prime-agent":
                journal = self.native_root / ".activation-state"
                if journal.exists():
                    self.observed_journal = journal.read_text(encoding="utf-8")
            return super().native_atomic_link(target, link)

    with tempfile.TemporaryDirectory(prefix="prime-agent-xsh-test.") as directory:
        root = Path(directory) / "managed"
        stage = root / ".install.stage01"
        (root / "bin").mkdir(parents=True)
        stage.mkdir()
        installer = JournalInstaller(env={})
        installer.native_root = root
        installer.native_stage = stage

        standalone = root / "bin" / "standalone"
        installer.native_atomic_link("../releases/one/prime-agent", standalone)
        check(standalone.is_symlink() and standalone.readlink() == Path("../releases/one/prime-agent"), "atomic link was not installed")
        installer.native_atomic_link("../releases/two/prime-agent", standalone)
        check(standalone.readlink() == Path("../releases/two/prime-agent"), "atomic link was not replaced")

        current = root / "bin" / "prime-agent"
        current.symlink_to("../releases/old/prime-agent")
        installer.native_activate("../releases/new/prime-agent", "../releases/old/prime-agent")
        check(installer.observed_journal == "../releases/new/prime-agent\n../releases/old/prime-agent\n", "activation journal was not durable before link replacement")
        check(current.readlink() == Path("../releases/new/prime-agent"), "active release link was not updated")
        check((root / "bin" / "previous").readlink() == Path("../releases/old/prime-agent"), "previous release link was not retained")
        check(not (root / ".activation-state").exists(), "completed activation journal was not removed")
        check(not installer.native_activation_target and not installer.native_activation_previous, "activation state was not cleared")


def test_main_backend_dispatch():
    class DispatchInstaller(Installer):
        def __init__(self, method, detected):
            super().__init__(env={"PRIME_AGENT_INSTALL_METHOD": method})
            self.detected = detected
            self.events = []

        def native_platform(self):
            self.events.append(("platform",))
            return self.detected

        def install_native(self, native_platform, args):
            self.events.append(("native", native_platform, list(args)))

        def install_node_main(self, args):
            self.events.append(("node", list(args)))
            return 0

    cases = (
        ("auto", "linux-x64", [("platform",), ("native", "linux-x64", ["1.2.3"])], 0),
        ("binary", "darwin-arm64", [("platform",), ("native", "darwin-arm64", ["1.2.3"])], 0),
        ("node", "linux-x64", [("node", ["1.2.3"])], 0),
        ("auto", None, [("platform",), ("node", ["1.2.3"])], 0),
        ("binary", None, [("platform",)], 1),
    )
    for method, detected, expected_events, expected_status in cases:
        installer = DispatchInstaller(method, detected)
        with contextlib.redirect_stderr(io.StringIO()):
            status = installer.main(["1.2.3"])
        check(status == expected_status, f"{method} dispatch returned {status}")
        check(installer.events == expected_events, f"{method} dispatch produced {installer.events}")


def native_asset_content(asset, version, package_version=None):
    if asset == "prime-agent":
        return f"#!/bin/sh\ncase \"$1\" in --version) echo {version} ;; --help) echo help ;; *) exit 1 ;; esac\n".encode()
    if asset == "package.json":
        return ("{\"version\": \"" + (package_version or version) + "\"}\n").encode()
    if asset == "install.sh":
        return b"#!/bin/sh\n# prime-agent-native-recovery-v1\n"
    return b"fixture\n"


def create_native_release(root, version, native_platform, digest):
    name = f"{version}-{native_platform}-{digest}"
    release = root / "releases" / name
    for asset in module.NATIVE_ASSETS:
        path = release / asset
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(native_asset_content(asset, version))
        if asset in {"prime-agent", "install.sh"}:
            path.chmod(0o755)
    (release / ".archive-sha256").write_text(digest + "\n", encoding="utf-8")
    (release / ".install-source").write_text("https://downloads.example.test\n", encoding="utf-8")
    return f"../releases/{name}/prime-agent"


def create_native_archive(path, version, *, missing=None, package_version=None):
    with tarfile.open(path, "w:gz") as archive:
        for asset in module.NATIVE_ASSETS:
            if asset == missing:
                continue
            content = native_asset_content(asset, version, package_version)
            member = tarfile.TarInfo(asset)
            member.mode = 0o755 if asset in {"prime-agent", "install.sh"} else 0o644
            member.size = len(content)
            archive.addfile(member, io.BytesIO(content))
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_install_native_from_offline_release_feed():
    class FeedInstaller(Installer):
        def __init__(self, feed, env):
            super().__init__(env=env)
            self.feed = feed
            self.node_fallbacks = []

        def curl_download(self, args):
            argv = [str(arg) for arg in args]
            url = next(arg for arg in argv if arg.startswith(self.base_url + "/"))
            destination = Path(argv[argv.index("-o") + 1])
            source = self.feed / url.removeprefix(self.base_url + "/")
            destination.write_bytes(source.read_bytes())
            return module.CommandResult(0)

        def run_animation(self, _title, _status, _details, action, *, mode="pulse"):
            action(io.StringIO())
            return True

        def register_traps(self):
            pass

        def init_screen(self):
            self.screen.enabled = False

        def screen_update(self, *_args, **_kwargs):
            pass

        def restore_terminal(self):
            pass

        def prompt_yes_no(self, *_args):
            return 0

        def install_node_main(self, args):
            self.node_fallbacks.append(list(args))
            return 0

    version = "1.2.3"
    native_platform = "linux-x64"
    native_name = f"prime-agent-{version}-{native_platform}.tar.gz"
    node_name = f"prime-agent-{version}.tgz"
    with tempfile.TemporaryDirectory(prefix="prime-agent-xsh-test.") as directory:
        base = Path(directory)
        feed = base / "feed"
        release = feed / "releases" / f"v{version}"
        release.mkdir(parents=True)
        archive = release / native_name
        digest = create_native_archive(archive, version)
        manifest = release / "SHA256SUMS"

        def make_installer(name, method, *, install_link=False):
            return FeedInstaller(
                feed,
                {
                    "HOME": str(base / name / "home"),
                    "PRIME_AGENT_DOWNLOAD_BASE_URL": "https://downloads.example.test",
                    "PRIME_AGENT_INSTALL_DIR": str(base / name / "managed"),
                    "PRIME_AGENT_INSTALL_METHOD": method,
                    "PRIME_AGENT_INSTALLER_NONINTERACTIVE": "1",
                    "PRIME_AGENT_BOOTSTRAP_KERNEL_ON_INSTALL": "0",
                    "PRIME_AGENT_INSTALL_LINK": "1" if install_link else "0",
                    "PRIME_AGENT_SHELL_PROFILE": str(base / name / "profile"),
                },
            )

        manifest.write_text(f"{digest}  {native_name}\n", encoding="utf-8")
        native = make_installer("native", "auto", install_link=True)
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            native.install_native(native_platform, [version])
        current = native.native_root / "bin" / "prime-agent"
        target = native.native_parse_target(current.readlink()) if current.is_symlink() else None
        check(target is not None and target.version == version and target.platform == native_platform, "native release was not activated")
        check(target.directory.is_dir(), "activated native release is missing")
        check(native.node_fallbacks == [], "valid native release fell back to Node")
        public_command = Path(native.env["HOME"]) / ".local" / "bin" / "prime-agent"
        check(public_command.is_symlink(), "native install did not create the public command")
        profile = Path(native.env["PRIME_AGENT_SHELL_PROFILE"])
        check(str(public_command.parent) in profile.read_text(encoding="utf-8"), "native install did not configure PATH")

        manifest.write_text(f"{'b' * 64}  {node_name}\n", encoding="utf-8")
        automatic = make_installer("automatic", "auto")
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            automatic.install_native(native_platform, [version])
        check(automatic.node_fallbacks == [[version]], "auto mode did not fall back for a Node-only release")

        binary = make_installer("binary", "binary")
        check(
            rejected(lambda: binary.install_native(native_platform, [version])),
            "binary mode accepted a Node-only release",
        )
        check(binary.node_fallbacks == [], "binary mode fell back to Node")


def test_native_recover_activation_states():
    with tempfile.TemporaryDirectory(prefix="prime-agent-xsh-test.") as directory:
        root = Path(directory) / "managed"
        (root / "bin").mkdir(parents=True)
        stage = root / ".install.stage01"
        stage.mkdir()
        new = create_native_release(root, "2.0.0", "linux-x64", "a" * 64)
        old = create_native_release(root, "1.0.0", "linux-x64", "b" * 64)
        other = create_native_release(root, "0.9.0", "linux-x64", "c" * 64)
        installer = Installer(env={})
        installer.native_root = root
        installer.native_stage = stage

        current = root / "bin" / "prime-agent"
        previous = root / "bin" / "previous"
        journal = root / ".activation-state"
        current.symlink_to(new)
        journal.write_text(f"{new}\n{old}\n", encoding="utf-8")
        check(installer.native_recover_activation(), "completed activation journal was not recovered")
        check(previous.readlink() == Path(old) and not journal.exists(), "completion recovery did not retain the previous release")

        current.unlink()
        current.symlink_to(old)
        previous.unlink()
        journal.write_text(f"{new}\n{old}\n", encoding="utf-8")
        check(installer.native_recover_activation(), "rolled-back activation journal was not recovered")
        check(current.readlink() == Path(old) and not journal.exists(), "rollback recovery changed the active release")

        journal.write_text(new + "\n", encoding="utf-8")
        check(not installer.native_recover_activation(), "malformed activation journal was accepted")
        check(journal.exists(), "invalid activation journal was deleted")
        journal.write_text(f"{new}\n{old}\n", encoding="utf-8")
        current.unlink()
        current.symlink_to(other)
        check(not installer.native_recover_activation(), "ambiguous activation state was accepted")
        check(journal.exists(), "ambiguous activation journal was deleted")


def test_native_rollback_switches_managed_links():
    with tempfile.TemporaryDirectory(prefix="prime-agent-xsh-test.") as directory:
        root = Path(directory) / "managed"
        (root / "bin").mkdir(parents=True)
        (root / ".managed").write_text("prime-agent-native-v1\n", encoding="utf-8")
        current_target = create_native_release(root, "2.0.0", "linux-x64", "d" * 64)
        previous_target = create_native_release(root, "1.0.0", "linux-x64", "e" * 64)
        (root / "bin" / "prime-agent").symlink_to(current_target)
        (root / "bin" / "previous").symlink_to(previous_target)
        installer = Installer(
            env={
                "HOME": directory,
                "PRIME_AGENT_INSTALL_DIR": str(root),
                "PRIME_AGENT_EXPECTED_PREVIOUS": previous_target,
                "PRIME_AGENT_INSTALLER_PLAIN": "1",
            }
        )
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            installer.native_rollback()
        check((root / "bin" / "prime-agent").readlink() == Path(previous_target), "rollback did not activate the previous release")
        check((root / "bin" / "previous").readlink() == Path(current_target), "rollback did not retain the replaced release")


def test_native_install_public_command_ownership():
    with tempfile.TemporaryDirectory(prefix="prime-agent-xsh-test.") as directory:
        base = Path(directory)
        root = base / "managed"
        public = base / "bin"
        (root / "bin").mkdir(parents=True)
        installer = Installer(env={"HOME": directory, "PRIME_AGENT_BIN_DIR": str(public)})
        installer.native_root = root
        installer.native_stage = root / ".install.stage01"
        installer.native_stage.mkdir()
        command = public / "prime-agent"
        managed = root / "bin" / "prime-agent"

        installer.native_install_public_command()
        check(command.is_symlink() and command.readlink() == managed, "public command did not point to the managed command")
        installer.native_install_public_command()
        check(command.readlink() == managed, "installer did not preserve its managed public link")

        command.unlink()
        command.symlink_to(base / "foreign")
        check(rejected(installer.native_install_public_command), "foreign public symlink was replaced")
        check(command.readlink() == base / "foreign", "foreign public symlink was modified")
        command.unlink()
        command.write_text("user command", encoding="utf-8")
        check(rejected(installer.native_install_public_command), "regular public command was replaced")
        check(command.read_text(encoding="utf-8") == "user command", "regular public command was modified")


def test_native_configure_path_idempotently():
    with tempfile.TemporaryDirectory(prefix="prime-agent-xsh-test.") as directory:
        base = Path(directory)
        public_bin = base / "bin"
        profile = base / "profile"
        installer = Installer(
            env={"HOME": directory, "PRIME_AGENT_SHELL_PROFILE": str(profile)},
            original_path="/usr/bin",
        )
        installer.native_public_bin = public_bin
        with contextlib.redirect_stdout(io.StringIO()):
            installer.native_configure_path()
            installer.native_configure_path()
        path_line = f"export PATH={public_bin}:$PATH"
        contents = profile.read_text(encoding="utf-8")
        check(contents.count(path_line) == 1, "native PATH entry was not written idempotently")

        untouched = base / "untouched"
        already_visible = Installer(
            env={"HOME": directory, "PRIME_AGENT_SHELL_PROFILE": str(untouched)},
            original_path=f"{public_bin}{module.os.pathsep}/usr/bin",
        )
        already_visible.native_public_bin = public_bin
        with contextlib.redirect_stdout(io.StringIO()):
            already_visible.native_configure_path()
        check(not untouched.exists(), "native PATH profile was changed when the bin directory was already visible")


def test_native_extract_release_metadata():
    def installer_for(base):
        root = base / "managed"
        stage = root / ".install.stage01"
        (root / "releases").mkdir(parents=True)
        stage.mkdir()
        installer = Installer(env={"PRIME_AGENT_DOWNLOAD_BASE_URL": "https://downloads.example.test"})
        installer.native_root = root
        installer.native_stage = stage
        return installer, root

    version = "1.2.3"
    native_platform = "linux-x64"
    with tempfile.TemporaryDirectory(prefix="prime-agent-xsh-test.") as directory:
        base = Path(directory)
        archive = base / "complete.tar.gz"
        digest = create_native_archive(archive, version)
        installer, root = installer_for(base / "complete")
        installer.native_extract_release(archive, version, native_platform, digest)
        release = root / "releases" / f"{version}-{native_platform}-{digest}"
        check((release / "prime-agent").is_file(), "complete native release was not extracted")
        check((release / ".archive-sha256").read_text(encoding="utf-8").strip() == digest, "archive digest metadata was not recorded")
        check((release / ".install-source").read_text(encoding="utf-8").strip() == installer.base_url, "install source metadata was not recorded")

        missing_archive = base / "missing.tar.gz"
        missing_digest = create_native_archive(missing_archive, version, missing="theme/prime.json")
        missing_installer, _ = installer_for(base / "missing")
        check(
            rejected(lambda: missing_installer.native_extract_release(missing_archive, version, native_platform, missing_digest)),
            "archive missing a required asset was accepted",
        )

        mismatch_archive = base / "mismatch.tar.gz"
        mismatch_digest = create_native_archive(mismatch_archive, version, package_version="9.9.9")
        mismatch_installer, _ = installer_for(base / "mismatch")
        check(
            rejected(lambda: mismatch_installer.native_extract_release(mismatch_archive, version, native_platform, mismatch_digest)),
            "archive with mismatched package metadata was accepted",
        )


def test_unconfigured_download_base_url_is_rejected_before_side_effects():
    native = Installer(env={})
    check(rejected(lambda: native.install_native("linux-x64", ["1.2.3"])), "native install accepted an unconfigured download base URL")
    check(native.native_root is None and native.download_dir is None, "native install touched installation state before validating the base URL")

    node = Installer(env={})
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        status = node.install_node_main(["1.2.3"])
    check(status == 1, "node install accepted an unconfigured download base URL")
    check(node.download_dir is None, "node install created a download directory before validating the base URL")


def test_standalone_node_lookup_uses_managed_path():
    with tempfile.TemporaryDirectory(prefix="prime-agent-xsh-test.") as directory:
        home = Path(directory)
        sentinel_dir = home / "sentinel"
        sentinel_dir.mkdir()
        sentinel = sentinel_dir / "prime-agent-xsh-sentinel"
        sentinel.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
        sentinel.chmod(0o755)

        opaque = Installer(env={"HOME": str(home)})
        ambient = module.os.environ.get("PATH", "")
        module.os.environ["PATH"] = f"{sentinel_dir}{module.os.pathsep}{ambient}"
        try:
            found = opaque.command_path(sentinel.name)
        finally:
            module.os.environ["PATH"] = ambient
        check(found is None, "installer environment was not authoritative for command lookup")

        node_bin = home / ".local/share/prime-agent-node/current/bin"
        node_bin.mkdir(parents=True)
        node = node_bin / "node"
        node.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
        node.chmod(0o755)
        installer = Installer(env={"HOME": str(home), "PATH": "/nonexistent"})
        check(installer.command_path("node") is None, "installer PATH was not authoritative for command lookup")
        installer.load_standalone_node()
        check(installer.command_path("node") == str(node), "standalone Node was not found through the managed PATH")


TESTS = (
    test_native_platform_cli_precedes_download_configuration,
    test_invalid_install_method_is_rejected_before_side_effects,
    test_download_base_url_policy,
    test_native_platform_classification,
    test_native_target_parsing_and_validation,
    test_node_only_manifest_detection,
    test_native_probe_timeout_decimal_bounds,
    test_curl_download_protocol_policy,
    test_native_prepare_root_and_unactivated_cleanup,
    test_native_validate_archive_member_policy,
    test_native_atomic_link_and_activation_journal,
    test_main_backend_dispatch,
    test_install_native_from_offline_release_feed,
    test_native_recover_activation_states,
    test_native_rollback_switches_managed_links,
    test_native_install_public_command_ownership,
    test_native_configure_path_idempotently,
    test_native_extract_release_metadata,
    test_unconfigured_download_base_url_is_rejected_before_side_effects,
    test_standalone_node_lookup_uses_managed_path,
)

failures = []
for test in TESTS:
    try:
        test()
    except Exception as error:
        failures.append(f"FAIL {test.__name__}: {type(error).__name__}: {error}")

if failures:
    print("\n".join(failures))
    raise SystemExit(1)

print(f"{len(TESTS)} focused installer tests passed")
