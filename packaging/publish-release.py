#!/usr/bin/env python3
"""Create GitHub release + upload .deb asset for linux-figma."""
import urllib.parse, urllib.request, json, os, sys

CRED = os.path.expanduser('~/.git-credentials')
with open(CRED) as f:
    u = urllib.parse.urlparse(f.readline().strip())
TOKEN = getattr(u, 'password')
OWNER, REPO = 'siinmedia', 'linux-figma'

TAG = sys.argv[1] if len(sys.argv) > 1 else 'v4.1.0'
NAME = sys.argv[2] if len(sys.argv) > 2 else f'Figma Font Bridge {TAG}'
BODY_FILE = sys.argv[3] if len(sys.argv) > 3 else None
ASSET = sys.argv[4] if len(sys.argv) > 4 else None


def api(method, path, data=None):
    url = f'https://api.github.com{path}'
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header('Authorization', f'token {TOKEN}')
    req.add_header('Accept', 'application/vnd.github+json')
    req.add_header('User-Agent', 'linux-figma')
    if body:
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main():
    body = ''
    if BODY_FILE and os.path.exists(BODY_FILE):
        body = open(BODY_FILE).read()

    st, res = api('POST', f'/repos/{OWNER}/{REPO}/releases', {
        'tag_name': TAG, 'name': NAME, 'body': body,
        'draft': False, 'prerelease': False,
    })
    if st >= 400:
        print('create failed:', st, res)
        return 1
    rid = res['id']
    print('release created:', res['html_url'])

    if ASSET and os.path.exists(ASSET):
        data = open(ASSET, 'rb').read()
        name = os.path.basename(ASSET)
        url = f'https://uploads.github.com/repos/{OWNER}/{REPO}/releases/{rid}/assets?name={name}'
        req = urllib.request.Request(url, data=data, method='POST')
        req.add_header('Authorization', f'token {TOKEN}')
        req.add_header('Content-Type', 'application/vnd.debian.binary-package')
        req.add_header('User-Agent', 'linux-figma')
        try:
            with urllib.request.urlopen(req) as r:
                a = json.loads(r.read().decode())
                print('asset uploaded:', a['name'], a['size'], 'bytes')
                print('download:', a['browser_download_url'])
        except urllib.error.HTTPError as e:
            print('upload ERROR', e.code, e.read().decode())
            return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
