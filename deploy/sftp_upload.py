"""Recursively upload a local directory's CONTENTS into a remote dir over SFTP.
Creds from env: SSH_HOST, SSH_PORT, SSH_USER, SSH_PASS. Usage:
    python deploy/sftp_upload.py <local_dir> <remote_dir>
Remote paths are relative to the SFTP home (e.g. 'public_html/btc')."""
import os
import sys
import paramiko

host = os.environ["SSH_HOST"]
port = int(os.environ.get("SSH_PORT", "21098"))
user = os.environ["SSH_USER"]
pw = os.environ["SSH_PASS"]
local_dir = sys.argv[1]
remote_dir = sys.argv[2]

t = paramiko.Transport((host, port))
t.connect(username=user, password=pw)
sf = paramiko.SFTPClient.from_transport(t)


def ensure(remote: str) -> None:
    cur = ""
    for part in [p for p in remote.split("/") if p]:
        cur = part if not cur else cur + "/" + part
        try:
            sf.stat(cur)
        except IOError:
            sf.mkdir(cur)


count = 0


def put_dir(local: str, remote: str) -> None:
    global count
    ensure(remote)
    for name in sorted(os.listdir(local)):
        lp = os.path.join(local, name)
        rp = remote + "/" + name
        if os.path.isdir(lp):
            put_dir(lp, rp)
        else:
            sf.put(lp, rp)
            count += 1


put_dir(local_dir, remote_dir)
print(f"uploaded {count} files into {remote_dir}")
sf.close()
t.close()
