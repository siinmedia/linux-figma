# Credits & Acknowledgements

`linux-figma` (Figma Font Bridge) stands on the shoulders of prior work.
We are grateful to the projects and people below. Where code or protocol
knowledge was reused, it is credited here explicitly.

## Protocol & prior art

This project implements the same local HTTP protocol that Figma's official
**Font Helper** uses. The protocol (endpoints such as `/figma/version`,
`/figma/font-files`, `/figma/font-file`, and the JSON response shape
`{"version": 4, "fontFiles": {...}}`) was determined by studying the
open-source reimplementation below.

- **[Figma-Linux/figma-linux-font-helper](https://github.com/Figma-Linux/figma-linux-font-helper)**
  by Roman Chugunov (ChugunovRoman) and contributors — MIT / GPL (see repo).
  - Written in Rust. This is the original community "Font Helper for Linux"
    that inspired this project.
  - **What we reused:** the knowledge of the Figma font-helper HTTP endpoint
    paths and the JSON response structure (`version`, `fontFiles`, per-font
    `postscript`, `family`, `id`, `style`, `weight`, `stretch`, `italic`),
    plus the default host/port convention (`127.0.0.1`, port `18412`/`44950`)
    and the config location `~/.config/figma-linux/settings.json`.
  - **What is original here:** this is an independent Node.js implementation.
    No Rust source was copied; the protocol was observed from reading the
    public source and from live HTTP traffic between Figma and the helper.

- **[tryvin/figma-linux-font-helper](https://github.com/tryvin/figma-linux-font-helper)**
  — earlier community fork; consulted for background understanding.

## Libraries we depend on

| Library | License | Use |
|---|---|---|
| [Express](https://github.com/expressjs/express) | MIT | HTTP server |
| [fontkit](https://github.com/foliojs/fontkit) | MIT | Reading font metadata (family, style, weight, italic, stretch) |
| [http-proxy](https://github.com/http-party/node-http-proxy) | MIT | (earlier prototype only; not required by the final tool) |

All dependencies are used under their respective licenses; their
`LICENSE`/`Readme` files are retained inside `node_modules/`.

## Figma trademark

Figma is a trademark of Figma, Inc. This project is **not affiliated with,
endorsed by, or sponsored by Figma, Inc.** It is an independent,
community-built interoperability tool. "Figma" is used only to describe the
intended interoperation.

## Contributing credits

If you contribute code, open a PR and add your name here (or it will be added
for you). Format:

```
- @username — short description of contribution
```

### Contributors

- @siinmedia — initial implementation, protocol discovery, Debian packaging
