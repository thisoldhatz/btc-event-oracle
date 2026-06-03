"""Read-only SSH recon of the cPanel host. Reads creds from env vars (never hard-coded):
SSH_HOST, SSH_PORT, SSH_USER, SSH_PASS. Prints host facts needed to plan the deploy."""
import os
import paramiko

host = os.environ["SSH_HOST"]
port = int(os.environ.get("SSH_PORT", "21098"))
user = os.environ["SSH_USER"]
pw = os.environ["SSH_PASS"]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, port=port, username=user, password=pw, timeout=25)


def run(cmd: str):
    _i, o, e = c.exec_command(cmd, timeout=25)
    return o.read().decode("utf-8", "ignore").strip(), e.read().decode("utf-8", "ignore").strip()


CMDS = [
    "whoami",
    "echo HOME=$HOME",
    "uname -a",
    "ls -ld ~/public_html",
    "ls ~/public_html | head -15",
    "ls -d ~/public_html/btc 2>/dev/null || echo 'no btc dir yet'",
    "which git; git --version 2>/dev/null",
    "python3 --version 2>&1; which python3",
    "ls -d /opt/cpanel/ea-python*/ 2>/dev/null",
    "for v in 3.11 3.10 3.9 3.8; do command -v python$v && python$v --version; done",
    "crontab -l 2>&1 | head -20",
    "echo 'disk:'; quota -s 2>/dev/null | tail -2 || df -h ~ 2>/dev/null | tail -1",
]
for cmd in CMDS:
    out, err = run(cmd)
    print(f"$ {cmd}\n{out}{('  [stderr] ' + err) if err else ''}\n")

c.close()
