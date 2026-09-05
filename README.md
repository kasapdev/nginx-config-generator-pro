# Nginx Config Generator Pro

[![CI](https://github.com/kasapdev/nginx-config-generator-pro/actions/workflows/ci.yml/badge.svg)](https://github.com/kasapdev/nginx-config-generator-pro/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) ![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-F7DF1E?logo=javascript&logoColor=black)

Visually build correct, production-ready nginx server blocks — fast, private, and fully offline.

> A premium, zero-dependency nginx config builder for backend and infra work. Toggle the blocks you need — static/SPA hosting, reverse proxy, SSL/TLS with modern ciphers, rate limiting — and get one combined, syntactically correct `nginx.conf` you can drop straight onto a server. Nothing ever leaves your browser.

## Overview

Nginx Config Generator Pro is part of the **Web Utility Suite**. It runs entirely client-side with no build step, no frameworks, and no network calls — open `index.html` from disk and it works. Four independent, toggleable blocks each render a real nginx snippet behind a `#` comment label; every enabled block combines live into a single output pane with light syntax highlighting, ready to copy or download as `nginx.conf`.

## Features

- **Static / SPA site block** — configurable document root and index file, with a toggle between plain `try_files $uri $uri/ =404;` and SPA-style `try_files $uri $uri/ /index.html;` fallback.
- **Reverse proxy block** — `proxy_pass` to any `host:port`, with the standard `proxy_set_header` lines (`Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`) and an optional WebSocket upgrade toggle (`proxy_http_version 1.1;` + `Upgrade`/`Connection` headers).
- **SSL/TLS block** — certificate/key path inputs, `listen 443 ssl;` with `http2 on;`, modern `ssl_protocols TLSv1.2 TLSv1.3;`, a real modern `ssl_ciphers` string, `ssl_prefer_server_ciphers off;`, session cache tuning, and an optional separate HTTP → HTTPS `301` redirect server block. Automatically reuses your Static or Reverse proxy settings inside the HTTPS server when those blocks are also enabled.
- **Rate limiting** — `limit_req_zone` emitted with a note that it belongs in the `http {}` context, plus a `limit_req zone=… burst=… nodelay;` example shown in its own `location` block.
- **Live composition** — enabled blocks combine into one output as you type, each preceded by a `#` comment label; disabled blocks are omitted entirely.
- **Shared globals** — **server name** and **HTTP listen port** fields apply across every block that needs them.
- **Copy** and **Download `nginx.conf`** buttons.
- **Auto-persist** — your form state is saved to `localStorage` and restored on return.
- **Dark & light themes**, fully responsive down to 360px, accessible, and keyboard-driven.

## Installation

No dependencies, no build step.

```bash
git clone https://github.com/kasapdev/nginx-config-generator-pro.git
cd nginx-config-generator-pro
```

Then simply open `index.html` in any modern browser (double-click it, or `file://` it). That's it.

## Usage

1. Enter your **server name / domain** and **HTTP listen port** at the top.
2. Flip on any combination of **Static / SPA site**, **Reverse proxy**, **SSL / TLS**, and **Rate limiting**.
3. Fill in each block's fields (root path, upstream, cert paths, zone name/rate/burst) — the output updates instantly.
4. **Copy** the config or **Download** it as `nginx.conf`, then drop it into `/etc/nginx/sites-available/` (or `conf.d/`) on your server and reload nginx.

## Keyboard Shortcuts

| Action                | Shortcut                        |
| --------------------- | -------------------------------- |
| Download `nginx.conf` | <kbd>Ctrl/⌘</kbd> + <kbd>S</kbd> |
| Show shortcuts help   | <kbd>?</kbd>                     |
| Close dialog          | <kbd>Esc</kbd>                   |

## Screenshots

> _Screenshots coming soon._

## Roadmap

- [ ] Additional location-block presets (PHP-FPM, caching headers)
- [ ] Multiple upstream servers with `upstream {}` load-balancing block
- [ ] IPv6-only / dual-stack listen presets
- [ ] Export as a downloadable `.zip` with split `sites-available` files
- [ ] Validate config client-side against common nginx syntax pitfalls

## License

MIT Licensed. Part of the [Web Utility Suite](https://github.com/kasapdev).
