import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
from types import SimpleNamespace
import unittest

from remote import Deployment, DeployError, atomic_write


class FakeRunner:
    def __init__(self, root):
        self.root = root
        self.calls = []
        self.fail_build = False

    def run(self, args, **options):
        self.calls.append(args)
        if self.fail_build and args[-2:] == ['run', 'build']:
            raise subprocess.CalledProcessError(1, args)
        if options.get('capture'):
            if args[0] == 'systemctl':
                return str(self.root)
            if args[-1] == '--version':
                return 'v20.20.2' if args[0].endswith('/node') else '10.33.4'


class TestDeployment(Deployment):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.failed_release = None
        self.preview_fails = False
        self.probes = []

    def probe(self, port, release_id, legacy=False):
        self.probes.append((port, release_id, legacy))

    def wait_ready(self, port, release_id, process=None, legacy=False):
        self.probes.append((port, release_id, legacy))
        if release_id == self.failed_release and release_id is not None:
            raise DeployError('simulated failed health check')

    def preview(self, release):
        if self.preview_fails:
            raise DeployError('simulated failed preview')


class ReleaseTransactions(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='coeer-release-test-')
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name).resolve()
        self.root = self.base / 'www/coeer'
        self.root.mkdir(parents=True)
        (self.root / '.env').write_text('DATABASE_URL=original-server-secret')
        (self.root / 'package.json').write_text('{}')
        runtime = self.base / 'runtime/bin'
        runtime.mkdir(parents=True)
        for name in ['node', 'pnpm']:
            path = runtime / name
            path.write_text('test executable')
            path.chmod(0o700)
        self.args = SimpleNamespace(root=str(self.root), service='coeer.service', pnpm=str(runtime / 'pnpm'), pnpm_version='10.33.4', port=3000, preview_port=13000, archive=None, sha256=None, release='new-version')
        self.runner = FakeRunner(self.root)
        self.deployment = TestDeployment(self.args, runner=self.runner, unit_directory=self.base / 'systemd')

    def ready(self, name):
        release = self.deployment.release_path(name)
        release.mkdir(parents=True)
        (release / 'ready.json').write_text(json.dumps({'release': name}))
        return release

    def old_release(self):
        previous = self.ready('old-version')
        self.deployment.switch_link(previous)
        self.deployment.unit_directory.mkdir(parents=True)
        self.old_unit = self.deployment.marker + '[Service]\nWorkingDirectory=old-version\n'
        atomic_write(self.deployment.override, self.old_unit)
        return previous

    def archive(self, name, kind='file'):
        archive = self.base / 'source.tar.gz'
        with tarfile.open(archive, 'w:gz') as tar:
            member = tarfile.TarInfo(name)
            if kind == 'link':
                member.type = tarfile.SYMTYPE
                member.linkname = '/etc/passwd'
                tar.addfile(member)
            else:
                member.size = 2
                tar.addfile(member, io.BytesIO(b'{}'))
        self.args.archive = str(archive)
        self.args.sha256 = hashlib.sha256(archive.read_bytes()).hexdigest()

    def test_check_does_not_create_release_or_change_environment(self):
        self.deployment.preflight()
        self.assertFalse(self.deployment.control.exists())
        self.assertEqual((self.root / '.env').read_text(), 'DATABASE_URL=original-server-secret')

    def test_failed_preview_never_switches_running_version(self):
        old = self.old_release()
        new = self.ready('new-version')
        self.deployment.preview_fails = True
        with self.assertRaises(DeployError):
            self.deployment.activate(new)
        self.assertEqual(self.deployment.current.resolve(), old)
        self.assertEqual(self.deployment.override.read_text(), self.old_unit)
        self.assertFalse(any('restart' in args for args in self.runner.calls))

    def test_failed_live_health_restores_symlink_unit_and_old_service(self):
        old = self.old_release()
        new = self.ready('new-version')
        self.deployment.failed_release = new.name
        with self.assertRaisesRegex(DeployError, '已自动回滚'):
            self.deployment.activate(new)
        self.assertEqual(self.deployment.current.resolve(), old)
        self.assertEqual(self.deployment.override.read_text(), self.old_unit)
        self.assertEqual(sum('restart' in args for args in self.runner.calls), 2)
        self.assertIn((3000, 'old-version', False), self.deployment.probes)

    def test_first_release_failure_restores_original_non_release_deployment(self):
        new = self.ready('new-version')
        self.deployment.failed_release = new.name
        with self.assertRaises(DeployError):
            self.deployment.activate(new)
        self.assertFalse(self.deployment.current.exists())
        self.assertFalse(self.deployment.override.exists())
        self.assertIn((3000, None, True), self.deployment.probes)

    def test_explicit_rollback_restores_previous_deployment_without_database_commands(self):
        old = self.old_release()
        new = self.ready('new-version')
        self.deployment.activate(new)
        self.assertEqual(self.deployment.current.resolve(), new)
        self.deployment.rollback()
        self.assertEqual(self.deployment.current.resolve(), old)
        self.assertEqual(self.deployment.override.read_text(), self.old_unit)
        self.assertFalse(any('db:' in ' '.join(args) for args in self.runner.calls))
        self.assertEqual((self.root / '.env').read_text(), 'DATABASE_URL=original-server-secret')

    def test_build_failure_leaves_live_service_untouched(self):
        old = self.old_release()
        release = self.ready('new-version')
        (release / 'package.json').write_text(json.dumps({'packageManager': 'pnpm@10.33.4'}))
        self.runner.fail_build = True
        with self.assertRaises(subprocess.CalledProcessError):
            self.deployment.build(release)
        self.assertEqual(self.deployment.current.resolve(), old)
        self.assertFalse(any('restart' in args for args in self.runner.calls))

    def test_concurrent_release_is_rejected(self):
        with self.deployment.lock():
            with self.assertRaisesRegex(DeployError, '正在进行'):
                with self.deployment.lock():
                    self.fail('lock should not be acquired twice')

    def test_malicious_archive_is_rejected_before_extraction(self):
        for name, kind in [('../outside', 'file'), ('src/.env', 'file'), ('src/private.pem', 'file'), ('src/link', 'link')]:
            with self.subTest(name=name):
                self.archive(name, kind)
                target = self.deployment.release_path('new-version')
                with self.assertRaises(DeployError):
                    self.deployment.extract(target)
                self.assertFalse(target.exists())

    def test_archive_hash_mismatch_is_rejected(self):
        self.archive('package.json')
        self.args.sha256 = '0' * 64
        with self.assertRaisesRegex(DeployError, '校验失败'):
            self.deployment.extract(self.deployment.release_path('new-version'))

    def test_current_cannot_point_outside_project(self):
        self.deployment.control.mkdir()
        self.deployment.current.symlink_to(self.base)
        with self.assertRaises(DeployError):
            self.deployment.preflight()


if __name__ == '__main__':
    unittest.main()
