# linux-figma — Figma Font Helper for Linux

**Use your locally installed Linux fonts in Figma (web) — no official installers, no manual uploads.**

Figma ships a "Font Installer" / "Font Helper" for macOS and Windows, but **not
for Linux**. This project fills that gap: a small local server that speaks the
same protocol Figma expects, so fonts installed on your machine show up in the
Figma web app.

This is an independent, community-built tool. See [CREDITS.md](CREDITS.md).

---

## The problem

In Figma (browser) on Linux you may see:

> *Want to use local fonts? To see them here, you'll need to download Figma's
> font installer or desktop app.*

There is no Linux font installer, so local fonts never appear.

## The fix

Figma probes `http://127.0.0.1:<port>` for a local font server. We implement
that server. Key detail discovered: **modern Figma first calls
`GET /figma/version`** as a handshake — if that returns 404, Figma reports
*"Couldn't connect"* and never proceeds. Implementing that one endpoint makes
everything work.

### Endpoints implemented

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/figma/version` | Handshake → `{"version":4}` |
| `GET` | `/figma/font-files` | List all local fonts (Figma format) |
| `GET` | `/figma/font-file?file=/abs/path.ttf` | Serve a font file |
| `GET` | `/` , `/health` | Status (our addition) |

Listens on `127.0.0.1`: `44950`, `44951`, `44952`, `18412`, `44900`, `44910`
(Figma probes several ports).

Fonts are read from: `~/.fonts`, `~/.local/share/fonts`, `/usr/share/fonts`
(recursive). Metadata is parsed with [fontkit](https://github.com/foliojs/fontkit).

---

## Install

### Option A — Debian package (recommended, simplest)

```bash
sudo dpkg -i figma-font-bridge_4.0.0_all.deb
```

Self-contained (dependencies bundled). Sets up a systemd **user** service that
auto-starts on login. Requires `nodejs` (>= 16).

Uninstall:

```bash
sudo dpkg -r figma-font-bridge
```

### Option B — From source

```bash
git clone https://github.com/siinmedia/linux-figma.git
cd linux-figma/companion
npm install
node index.js
```

### Option C — systemd user service (manual)

```bash
mkdir -p ~/.config/systemd/user
cp systemd/figma-font-bridge.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now figma-font-bridge
```

---

## Usage

1. Make sure the server is running:
   ```bash
   systemctl --user status figma-font-bridge
   curl http://127.0.0.1:44950/figma/version    # → {"version":4}
   ```
2. Open **figma.com** in a Chromium-based browser and reload the page.
3. Select a text layer → open the font dropdown → your local fonts appear.

### After installing new fonts

```bash
systemctl --user restart figma-font-bridge
```

### Logs

```bash
journalctl --user -u figma-font-bridge -f
```

---

## Building the .deb

See [`packaging/`](packaging/) and the helper script:

```bash
./packaging/build-deb.sh
```

Output: `figma-font-bridge_<version>_all.deb`.

---

## How it works (short)

1. Figma web app → `GET http://127.0.0.1:44950/figma/version`
2. We reply `{"version":4}` → Figma continues.
3. Figma → `GET /figma/font-files` → we return every parsed font face.
4. Figma → `GET /figma/font-file?file=...` for each font it wants to render.

CORS is set to `Access-Control-Allow-Origin: https://www.figma.com` plus
`Access-Control-Allow-Private-Network: true` (required for localhost access
from a public site).

---

## Project layout

```
linux-figma/
├── companion/            # The font server (Node.js)
│   ├── index.js
│   └── package.json
├── systemd/              # systemd user unit
│   └── figma-font-bridge.service
├── packaging/            # Debian packaging
│   ├── control
│   ├── postinst
│   ├── prerm
│   └── build-deb.sh
├── CREDITS.md            # Attribution for reused knowledge/code
├── LICENSE               # MIT
└── README.md
```

---

## Security notes

- The server binds to `127.0.0.1` only (not reachable from the network).
- `/figma/font-file` only serves files inside the configured font directories.
- No telemetry, no network calls except serving local font bytes.

---

## Credits

Protocol knowledge and prior art come from the community project
[Figma-Linux/figma-linux-font-helper](https://github.com/Figma-Linux/figma-linux-font-helper)
by Roman Chugunov. See [CREDITS.md](CREDITS.md) for full attribution.

Figma is a trademark of Figma, Inc. This project is not affiliated with Figma.

## License

[MIT](LICENSE)
