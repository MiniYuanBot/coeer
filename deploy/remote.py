"""COEER release controller. Invoked over SSH stdin; never reads local secrets."""
import argparse
import contextlib
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import socket
import subprocess
import sys
import tarfile
import time
import urllib.request


class DeployError(RuntimeError):
    pass


class Runner:
    def run(self, args, cwd=None, env=None, capture=False, timeout=120, input=None):
        process = subprocess.Popen(args, cwd=cwd, env=env, text=True,
                                   stdout=subprocess.PIPE if capture else None, stdin=subprocess.PIPE if input is not None else None,
                                   start_new_session=True)
        try:
            output, _ = process.communicate(input=input, timeout=timeout)
        except BaseException:
            with contextlib.suppress(ProcessLookupError):
                os.killpg(process.pid, signal.SIGKILL)
            process.wait()
            raise
        if process.returncode != 0:
            raise subprocess.CalledProcessError(process.returncode, args)
        return output.strip() if capture else None


def atomic_write(path, content, mode=0o600):
    temporary = path.with_name(path.name + ".next")
    with open(temporary, "w", encoding="utf-8") as file:
        file.write(content)
    os.chmod(temporary, mode)
    os.replace(temporary, path)


class Deployment:
    marker = "# Managed by COEER one-click deploy\n"

    def __init__(self, args, runner=None, unit_directory=None):
        self.args = args
        self.root = Path(args.root)
        self.control = self.root / ".deploy"
        self.releases = self.control / "releases"
        self.current = self.control / "current"
        self.pnpm = Path(args.pnpm)
        self.node = self.pnpm.parent / "node"
        self.runner = runner or Runner()
        self.unit_directory = Path(unit_directory or "/etc/systemd/system") / (args.service + ".d")
        self.override = self.unit_directory / "90-coeer-release.conf"
        self.environment = {**os.environ, "PATH": str(self.pnpm.parent) + ":" + os.environ.get("PATH", ""), "CI": "true"}

    def log(self, message):
        print(message, flush=True)

    def systemctl(self, *arguments, capture=False):
        # A legacy unit being restored can retain systemd's default 90s stop timeout.
        timeout = 120 if any(action in arguments for action in ("restart", "stop")) else 45
        return self.runner.run(["systemctl", *arguments], capture=capture, timeout=timeout)

    def preflight(self):
        if not self.root.is_dir() or not (self.root / "package.json").is_file():
            raise DeployError("部署目录不是现有 COEER 项目。")
        if not (self.root / ".env").is_file():
            raise DeployError("服务器缺少 .env；本机配置不会上传。")
        for path in [self.control, self.releases, self.unit_directory]:
            if path.is_symlink():
                raise DeployError("拒绝使用符号链接控制目录：" + str(path))
        if self.current.exists() and not self.current.is_symlink():
            raise DeployError("current 必须是发布脚本管理的符号链接。")
        if self.current.is_symlink():
            self.validate_target(self.current.resolve())
        working = self.systemctl("show", self.args.service, "--property=WorkingDirectory", "--value", capture=True)
        if working not in (str(self.root), str(self.current)):
            raise DeployError("服务 WorkingDirectory 与配置不一致；拒绝更改其他服务。")
        self.systemctl("is-active", "--quiet", self.args.service)
        if self.override.exists() and not self.override.read_text().startswith(self.marker):
            raise DeployError("发现非本脚本管理的 90-coeer-release.conf，停止覆盖。")
        for path in self.unit_directory.glob("*.conf"):
            if path != self.override and re.search(r"^\s*(WorkingDirectory|ExecStart|RootDirectory|RootImage)\s*=", path.read_text(), re.M):
                raise DeployError("发现其他启动覆盖配置，请先核对：" + str(path))
        for executable in [self.pnpm, self.node]:
            if not os.access(executable, os.X_OK):
                raise DeployError("运行时路径不可用：" + str(executable))
        version = self.runner.run([str(self.pnpm), "--version"], env=self.environment, capture=True)
        if version != self.args.pnpm_version:
            raise DeployError("pnpm 版本不匹配：需要 " + self.args.pnpm_version + "，实际 " + version)
        node_version = self.runner.run([str(self.node), "--version"], capture=True)
        numbers = tuple(int(value) for value in node_version.lstrip("v").split(".")[:3])
        if not (26 <= numbers[0] < 27):
            raise DeployError("Node.js 必须为 26.x，与项目 engines 保持一致。")
        if shutil.disk_usage(self.root).free < 512 * 1024 * 1024:
            raise DeployError("可用磁盘不足 512 MiB。")
        self.probe(self.args.port, None, legacy=True)
        self.log("服务器预检通过：" + self.args.service + "；Node " + node_version + "；pnpm " + version)

    @contextlib.contextmanager
    def lock(self):
        self.control.mkdir(mode=0o700, exist_ok=True)
        self.releases.mkdir(mode=0o700, exist_ok=True)
        with open(self.control / "lock", "a") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise DeployError("另一项发布或回滚正在进行。") from None
            yield

    def release_path(self, release_id):
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{5,100}", release_id or ""):
            raise DeployError("版本 ID 无效。")
        path = self.releases / release_id
        if path.is_symlink():
            raise DeployError("版本目录不能是符号链接。")
        return path

    def validate_target(self, path):
        if path == self.root:
            return
        if path.parent != self.releases or self.release_path(path.name) != path or not path.is_dir():
            raise DeployError("回滚目标不属于本项目的发布目录。")

    def extract(self, release):
        archive = Path(self.args.archive or "")
        if not archive.is_file() or not re.fullmatch(r"[a-f0-9]{64}", self.args.sha256 or ""):
            raise DeployError("缺少发布包或 SHA-256。")
        if hashlib.sha256(archive.read_bytes()).hexdigest() != self.args.sha256:
            raise DeployError("发布包校验失败。")
        allowed = {"src", "public", "scripts", "deploy", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.json", "vite.config.ts"}
        with tarfile.open(archive, "r:gz") as tar:
            members = tar.getmembers()
            for member in members:
                path = PurePosixPath(member.name)
                if path.is_absolute() or ".." in path.parts or not path.parts or path.parts[0] not in allowed:
                    raise DeployError("发布包包含不允许的路径。")
                if not (member.isfile() or member.isdir()):
                    raise DeployError("发布包不允许链接或特殊文件。")
                if any(part.startswith(".env") or part in {".ssh", ".aws", ".git", "node_modules"} or part.endswith((".pem", ".key", ".local.json")) for part in path.parts):
                    raise DeployError("发布包包含环境文件、密钥或依赖。")
            release.mkdir(mode=0o700)
            tar.extractall(release, members=members)
        for name in [".env", ".env.production", ".npmrc"]:
            if (self.root / name).is_file():
                (release / name).symlink_to(self.root / name)

    def build(self, release):
        package = json.loads((release / "package.json").read_text())
        if package.get("packageManager") != "pnpm@" + self.args.pnpm_version:
            raise DeployError("发布包的 packageManager 与远程 pnpm 不匹配。")
        commands = [("install", ["install", "--frozen-lockfile", "--prod=false"], 900),
                    ("env", ["run", "check:env"], 30),
                    ("community schema", ["run", "db:check:community"], 30),
                    ("types", ["exec", "tsc", "--noEmit"], 180),
                    ("build", ["run", "build"], 600)]
        for title, command, timeout in commands:
            self.log("独立版本目录：" + title)
            self.runner.run([str(self.pnpm), *command], cwd=release, env={**self.environment, "NODE_ENV": "production"}, timeout=timeout)
        if not (release / "dist/server/server.js").is_file() or not (release / "node_modules/srvx/bin/srvx.mjs").is_file():
            raise DeployError("缺少服务端产物或锁定的 srvx 运行时。")
        # Keep old hashed assets available to already-open browser tabs.
        previous = self.current.resolve() if self.current.is_symlink() else self.root
        source = previous / "dist/client/assets"
        destination = release / "dist/client/assets"
        if source.is_dir():
            for path in source.iterdir():
                if path.is_file() and not (destination / path.name).exists():
                    shutil.copy2(path, destination / path.name)

    def server_command(self, release, port):
        return [str(self.node), str(release / "node_modules/srvx/bin/srvx.mjs"), "--prod", "--host", "127.0.0.1", "--port", str(port), "--static", "../client", str(release / "dist/server/server.js")]

    def probe(self, port, release_id, legacy=False):
        endpoint = "/login" if legacy else "/healthz"
        with urllib.request.urlopen("http://127.0.0.1:" + str(port) + endpoint, timeout=4) as response:
            if response.status != 200:
                raise DeployError("健康检查未返回 200。")
            if not legacy:
                result = json.loads(response.read(4096))
                if result.get("status") != "ok" or result.get("release") != release_id:
                    raise DeployError("健康检查版本或数据库状态不匹配。")

    def wait_ready(self, port, release_id, process=None, legacy=False):
        for _ in range(30):
            if process and process.poll() is not None:
                raise DeployError("隔离预检进程已退出，查看该版本的 preview.log。")
            try:
                self.probe(port, release_id, legacy=legacy)
                return
            except (OSError, ValueError, DeployError):
                time.sleep(1)
        raise DeployError("健康检查超时。")

    def preview(self, release):
        with socket.socket() as socket_check:
            socket_check.bind(("127.0.0.1", self.args.preview_port))
        self.log("隔离预检：127.0.0.1:" + str(self.args.preview_port))
        environment = {**self.environment, "NODE_ENV": "production", "PORT": str(self.args.preview_port), "COEER_RELEASE_ID": release.name}
        with open(release / "preview.log", "a") as log:
            process = subprocess.Popen(self.server_command(release, self.args.preview_port), cwd=release,
                                       env=environment, stdout=log, stderr=log, start_new_session=True)
            try:
                self.wait_ready(self.args.preview_port, release.name, process=process)
                self.probe(self.args.preview_port, None, legacy=True)
                css = next((release / "dist/client/assets").glob("app-*.css"), None)
                if not css:
                    raise DeployError("缺少前端样式产物。")
                with urllib.request.urlopen("http://127.0.0.1:" + str(self.args.preview_port) + "/assets/" + css.name, timeout=4) as response:
                    if response.read() != css.read_bytes():
                        raise DeployError("静态资源检查失败。")
            finally:
                with contextlib.suppress(ProcessLookupError):
                    os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    with contextlib.suppress(ProcessLookupError):
                        os.killpg(process.pid, signal.SIGKILL)
                    process.wait(timeout=5)

    def prepare(self):
        release = self.release_path(self.args.release)
        if release.exists():
            raise DeployError("版本目录已存在，不会覆盖。")
        self.extract(release)
        self.build(release)
        self.preview(release)
        atomic_write(release / "ready.json", json.dumps({"release": release.name, "archiveSha256": self.args.sha256, "preparedAt": time.time()}))
        self.log("版本预检通过：" + release.name)
        return release

    def switch_link(self, target):
        if target == self.root:
            if self.current.is_symlink():
                self.current.unlink()
            return
        temporary = self.control / "current.next"
        if temporary.is_symlink():
            temporary.unlink()
        temporary.symlink_to(target)
        os.replace(temporary, self.current)

    def restart(self):
        self.systemctl("daemon-reload")
        self.systemctl("restart", self.args.service)

    def snapshot(self, release):
        target = self.current.resolve() if self.current.is_symlink() else self.root
        self.validate_target(target)
        previous_id = target.name if target != self.root else None
        snapshot = {"target": str(target), "release": previous_id, "overrideExisted": self.override.exists()}
        if self.override.exists():
            atomic_write(release / "previous-unit.conf", self.override.read_text())
        atomic_write(release / "previous.json", json.dumps(snapshot))
        return snapshot

    def restore(self, release, snapshot):
        target = Path(snapshot["target"])
        self.validate_target(target)
        if snapshot["overrideExisted"]:
            atomic_write(self.override, (release / "previous-unit.conf").read_text(), mode=0o644)
        elif self.override.exists():
            self.override.unlink()
        self.switch_link(target)
        self.restart()
        self.wait_ready(self.args.port, snapshot["release"], legacy=target == self.root)
        self.systemctl("is-active", "--quiet", self.args.service)

    def activate(self, release, preview=True):
        if not (release / "ready.json").is_file():
            raise DeployError("版本尚未通过预检。")
        if self.current.is_symlink() and self.current.resolve() == release:
            raise DeployError("该版本已经在线。")
        if preview:
            self.preview(release)
        snapshot = self.snapshot(release)
        self.unit_directory.mkdir(parents=True, exist_ok=True)
        command = " ".join(self.server_command(self.current, self.args.port))
        override = self.marker + "[Service]\nWorkingDirectory=" + str(self.current) + "\nExecStart=\nExecStart=" + command + "\nTimeoutStopSec=15s\nEnvironment=COEER_RELEASE_ID=" + release.name + "\n"
        try:
            self.log("切换线上版本：" + release.name)
            self.switch_link(release)
            atomic_write(self.override, override, mode=0o644)
            self.restart()
            self.wait_ready(self.args.port, release.name)
            self.systemctl("is-active", "--quiet", self.args.service)
        except BaseException as error:
            self.log("新版本未通过检查，正在恢复旧版本…")
            try:
                self.restore(release, snapshot)
                self.log("旧版本已恢复健康。")
            except BaseException as rollback_error:
                raise DeployError("自动回滚未恢复健康，请检查 systemctl status " + self.args.service) from rollback_error
            raise DeployError("发布失败，已自动回滚；原因：" + str(error) + "；新版本保留在 " + str(release)) from error
        self.log("发布成功：" + release.name)
        self.log("回滚命令：npm run deploy:rollback")

    def rollback(self):
        if not self.current.is_symlink():
            raise DeployError("当前为原始部署，没有可回滚的发布记录。")
        release = self.current.resolve()
        self.validate_target(release)
        previous = release / "previous.json"
        if not previous.is_file():
            raise DeployError("当前版本没有上一版本记录。")
        snapshot = json.loads(previous.read_text())
        self.log("正在回滚到：" + snapshot["target"])
        self.restore(release, snapshot)
        self.log("回滚完成，目标版本健康。")

    def validate_release_layout(self):
        if not self.root.is_dir() or not (self.root / "package.json").is_file():
            raise DeployError("部署目录不是现有 COEER 项目。")
        for path in (self.control, self.releases):
            if path.is_symlink():
                raise DeployError("拒绝使用符号链接控制目录：" + str(path))

    def protected_releases(self):
        self.validate_release_layout()
        if not self.current.is_symlink():
            if self.current.exists():
                raise DeployError("current 必须是发布脚本管理的符号链接。")
            return {self.root: "原始部署"}
        current = self.current.resolve()
        self.validate_target(current)
        protected = {current: "当前线上"}
        previous = current / "previous.json"
        if previous.exists():
            snapshot = json.loads(previous.read_text())
            if not isinstance(snapshot, dict) or not isinstance(snapshot.get("target"), str):
                raise DeployError("上一版本记录无效，无法确认回滚版本。")
            target = Path(snapshot["target"])
            self.validate_target(target)
            if target not in protected:
                protected[target] = "可回滚"
        return protected

    @staticmethod
    def release_size(release):
        # node_modules and .env contain links; never follow them outside the release.
        total = 0
        for directory, _, files in os.walk(release, followlinks=False):
            for name in files:
                path = Path(directory) / name
                if not path.is_symlink():
                    total += path.stat().st_size
        return total

    def list_releases(self):
        protected = self.protected_releases()
        current = self.current.resolve() if self.current.is_symlink() else self.root
        self.log("线上版本：" + (current.name if current != self.root else "原始部署（" + str(self.root) + "）"))
        records = []
        if self.releases.is_dir():
            for release in sorted(self.releases.iterdir(), reverse=True):
                if release.is_symlink() or not release.is_dir() or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{5,100}", release.name):
                    continue
                status = protected.get(release, "就绪" if (release / "ready.json").is_file() else "未就绪")
                records.append({"release": release.name, "status": status,
                    "created": datetime.fromtimestamp(release.stat().st_mtime, timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
                    "bytes": self.release_size(release)})
        if not records:
            self.log("没有历史发布版本。")
        else:
            self.log("版本 ID\t状态\t目录时间 (UTC)\t大小 (MiB)")
            for record in records:
                self.log(record["release"] + "\t" + record["status"] + "\t" + record["created"] + "\t" + format(record["bytes"] / 1024 ** 2, ".1f"))
        return records

    def delete_release(self, release_id):
        protected = self.protected_releases()
        release = self.release_path(release_id)
        # Require a real direct child of this project's release directory.
        if not release.is_dir() or release.resolve() != release or release.parent != self.releases:
            raise DeployError("版本不存在或不属于本项目的发布目录。")
        if release in protected:
            raise DeployError("不能删除" + protected[release] + "版本：" + release.name)
        self.validate_target(release)
        shutil.rmtree(release)
        self.log("已删除历史版本：" + release.name + "；线上服务与数据库未更改。")

    def database(self, payload):
        # Database repair must work when readiness or the service is unavailable.
        self.validate_release_layout()
        release = self.current.resolve() if self.current.is_symlink() else self.root
        self.validate_target(release)
        if self.current.exists() and not self.current.is_symlink():
            raise DeployError("current 必须是发布脚本管理的符号链接。")
        if not (release / ".env").is_file() or not (release / "node_modules/pg").is_dir() or not (release / "node_modules/dotenv").is_dir():
            raise DeployError("当前服务器版本缺少环境文件或数据库运行依赖。")
        if not os.access(self.node, os.X_OK):
            raise DeployError("Node 运行时路径不可用。")
        if not isinstance(payload, dict) or not isinstance(payload.get("source"), str) or not isinstance(payload.get("schemaCheck"), str):
            raise DeployError("缺少本地数据库操作脚本。")
        execute = getattr(self.args, "execute", False)
        if execute and self.args.action != "db-clear":
            raise DeployError("--execute 只用于数据库清空。")
        backup = getattr(self.args, "backup", None)
        if self.args.action == "db-delete":
            if not re.fullmatch(r"coeer-db-\d{17}-[a-f0-9]{8}\.dump", backup or ""):
                raise DeployError("删除备份必须指定列表中的完整 .dump 文件名，不能使用路径或通配符。")
        elif backup is not None:
            raise DeployError("--backup 只用于删除数据库备份。")
        request = {"action": self.args.action, "schemaCheck": payload["schemaCheck"],
                   "migrations": payload.get("migrations", []), "backupDirectory": str(self.control / "backups")}
        if self.args.action == "db-delete":
            request["backup"] = backup
        if self.args.action == "db-clear":
            request["execute"] = False
        if self.args.action == "db-setup":
            if not isinstance(payload.get("admin"), dict):
                raise DeployError("setup 缺少交互式管理员输入。")
            request["admin"] = payload["admin"]

        def run_operation(value):
            environment = {**self.environment, "NODE_ENV": "production", "COEER_DB_REQUEST": json.dumps(value)}
            self.runner.run([str(self.node), "--input-type=module", "-"], cwd=release, env=environment, input=payload["source"], timeout=300)

        # Clear starts with read-only validation before service disruption.
        run_operation(request)
        if self.args.action != "db-clear" or not execute:
            return
        working = self.systemctl("show", self.args.service, "--property=WorkingDirectory", "--value", capture=True)
        if working not in (str(self.root), str(self.current)):
            raise DeployError("服务 WorkingDirectory 与配置不一致，拒绝停止其他服务。")
        state = self.systemctl("show", self.args.service, "--property=ActiveState", "--value", capture=True)
        if state not in ("active", "inactive", "failed"):
            raise DeployError("服务状态正在变化，请稍后重试。")
        was_active = state == "active"
        try:
            if was_active:
                self.log("暂停服务后无备份清空数据库；不会取消官网预约。")
                self.systemctl("stop", self.args.service)
            run_operation({**request, "execute": True})
        finally:
            # Restore the original running state even when validation, backup or SQL fails.
            if was_active:
                self.systemctl("start", self.args.service)
                self.wait_ready(self.args.port, release.name if release != self.root else None, legacy=release == self.root)
                self.systemctl("is-active", "--quiet", self.args.service)


def main():
    def interrupted(signum, _frame):
        raise DeployError("发布连接中断或收到终止信号：" + str(signum))
    for signum in (signal.SIGHUP, signal.SIGTERM):
        signal.signal(signum, interrupted)
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["check", "prepare", "deploy", "activate", "rollback", "list", "delete", "db-status", "db-backup", "db-backups", "db-delete", "db-upgrade", "db-setup", "db-clear"])
    parser.add_argument("--root", required=True)
    parser.add_argument("--service", required=True)
    parser.add_argument("--pnpm", required=True)
    parser.add_argument("--pnpm-version", required=True)
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--preview-port", type=int, required=True)
    parser.add_argument("--archive")
    parser.add_argument("--sha256")
    parser.add_argument("--release")
    parser.add_argument("--backup")
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise DeployError("需要 sudo -n 访问现有 systemd 服务及部署目录。")
    if not re.fullmatch(r"/[A-Za-z0-9_./-]+", args.root) or any(part in (".", "..") for part in args.root.split("/")) or len(Path(args.root).parts) < 4:
        raise DeployError("部署路径无效。")
    if not re.fullmatch(r"[A-Za-z0-9_-]+\.service", args.service):
        raise DeployError("服务名无效。")
    if not (1024 <= args.port <= 65535 and 1024 <= args.preview_port <= 65535) or args.port == args.preview_port:
        raise DeployError("线上与预检端口必须有效且不同。")
    deployment = Deployment(args)
    if args.action.startswith("db-"):
        if args.action in ("db-status", "db-backups") or (args.action == "db-clear" and not args.execute):
            deployment.database(globals().get("DATABASE_PAYLOAD"))
        else:
            deployment.validate_release_layout()
            with deployment.lock():
                deployment.database(globals().get("DATABASE_PAYLOAD"))
        return
    if args.action == "list":
        deployment.list_releases()
        return
    if args.action == "delete":
        deployment.validate_release_layout()
        with deployment.lock():
            deployment.delete_release(args.release)
        return
    deployment.preflight()
    if args.action == "check":
        return
    with deployment.lock():
        # Recheck service state under the same lock used by deployment/rollback.
        deployment.preflight()
        if args.action == "rollback":
            deployment.rollback()
        elif args.action == "activate":
            deployment.activate(deployment.release_path(args.release))
        else:
            release = deployment.prepare()
            if args.action == "deploy":
                deployment.activate(release, preview=False)
            else:
                deployment.log("线上未切换。确认发布：npm run deploy -- --activate " + release.name)


if __name__ == "__main__":
    try:
        main()
    except (DeployError, OSError, ValueError, subprocess.SubprocessError) as error:
        print("发布未完成：" + str(error), file=sys.stderr)
        sys.exit(1)
