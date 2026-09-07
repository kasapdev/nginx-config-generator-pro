# Nginx Config Generator Pro

[![CI](https://github.com/kasapdev/nginx-config-generator-pro/actions/workflows/ci.yml/badge.svg)](https://github.com/kasapdev/nginx-config-generator-pro/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) ![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-F7DF1E?logo=javascript&logoColor=black)

Visually build correct, production-ready nginx server blocks — fast, private, and fully offline.

> A premium, zero-dependency nginx config builder for backend and infra work. Toggle the blocks you need — static/SPA hosting, reverse proxy with load-balanced upstreams and caching, SSL/TLS with modern ciphers, gzip/Brotli compression, rate limiting — and get one combined, syntactically correct `nginx.conf` you can drop straight onto a server. Nothing ever leaves your browser.

## Overview

Nginx Config Generator Pro is part of the **Web Utility Suite**. It runs entirely client-side with no build step, no frameworks, and no network calls — open `index.html` from disk and it works. Seven independent, toggleable blocks each render a real nginx snippet behind a `#` comment label; every enabled block combines live into a single output pane with light syntax highlighting, ready to copy or download as `nginx.conf`.

## Features

- **Static / SPA site block** — configurable document root and index file, with a toggle between plain `try_files $uri $uri/ =404;` and SPA-style `try_files $uri $uri/ /index.html;` fallback.
- **Reverse proxy block** — `proxy_pass` to any `host:port` (or to a load-balanced upstream group, see below), with the standard `proxy_set_header` lines (`Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`) and a WebSocket upgrade toggle (`proxy_http_version 1.1;` + `Upgrade`/`Connection` headers) for WebSocket passthrough.
- **Load balancing / upstream block** — a real `upstream {}` block with a genuine choice of balancing method: round-robin (nginx's default — no directive needed), `least_conn;`, or `ip_hash;`. Servers accept `weight=N`, `backup`, or `down`, and get `max_fails=`/`fail_timeout=` applied automatically. When enabled, the Reverse proxy block's `proxy_pass` targets the upstream group by name instead of a single host:
  ```
  upstream backend {
      least_conn;
      server 10.0.0.1:3000 weight=3 max_fails=3 fail_timeout=30s;
      server 10.0.0.2:3000 max_fails=3 fail_timeout=30s;
      server 10.0.0.3:3000 backup;
  }
  ```
- **Caching block** — a `proxy_cache_path` zone plus `proxy_cache`/`proxy_cache_valid`/`proxy_cache_bypass` wired into the Reverse proxy `location`, with a `X-Cache-Status` debug header:
  ```
  proxy_cache_path /var/cache/nginx/mycache levels=1:2 keys_zone=mycache:10m max_size=1g inactive=60m use_temp_path=off;
  ...
  proxy_cache mycache;
  proxy_cache_valid 200 302 10m;
  proxy_cache_valid 404 1m;
  ```
- **Gzip / Brotli compression block** — real `gzip on;` + `gzip_types …;` directives (belongs in the `http {}` context). Brotli is offered as an explicit opt-in with an in-output comment clarifying it needs the third-party `ngx_brotli` module and is **not** bundled with stock nginx — never emitted silently.
- **SSL/TLS block** — certificate/key path inputs, `listen 443 ssl;` with `http2 on;`, modern `ssl_protocols TLSv1.2 TLSv1.3;`, a real modern `ssl_ciphers` string, `ssl_prefer_server_ciphers off;`, session cache tuning, and an optional separate HTTP → HTTPS `301` redirect server block. Automatically reuses your Static or Reverse proxy settings (including upstream/caching/WebSocket) inside the HTTPS server when those blocks are also enabled.
- **Rate limiting** — `limit_req_zone` emitted with a note that it belongs in the `http {}` context, plus a `limit_req zone=… burst=… nodelay;` example shown in its own `location` block.
- **Live composition** — enabled blocks combine into one output as you type, each preceded by a `#` comment label; disabled blocks are omitted entirely.
- **Shared globals** — **server name** and **HTTP listen port** fields apply across every block that needs them.
- **Copy** and **Download `nginx.conf`** buttons.
- **Auto-persist** — your form state is saved to `localStorage` and restored on return.
- **Dark & light themes**, fully responsive down to 360px, accessible, and keyboard-driven.

See [TESTS.md](TESTS.md) for traced, cited verification of every directive this tool emits.

## Installation

No dependencies, no build step.

```bash
git clone https://github.com/kasapdev/nginx-config-generator-pro.git
cd nginx-config-generator-pro
```

Then simply open `index.html` in any modern browser (double-click it, or `file://` it). That's it.

## Usage

1. Enter your **server name / domain** and **HTTP listen port** at the top.
2. Flip on any combination of **Static / SPA site**, **Reverse proxy**, **Load balancing / upstream**, **Caching**, **SSL / TLS**, **Rate limiting**, and **Gzip / Brotli compression**.
3. Fill in each block's fields (root path, upstream servers, cert paths, cache zone sizes, rate/burst) — the output updates instantly.
4. **Copy** the config or **Download** it as `nginx.conf`. Server blocks (Static/Reverse proxy/SSL/redirect) go into `/etc/nginx/sites-available/`; top-level directives (`upstream {}`, `proxy_cache_path`, `gzip`, `limit_req_zone` — each labeled with a comment) belong in the `http {}` context instead, e.g. `/etc/nginx/conf.d/*.conf`. Reload nginx after.

## Keyboard Shortcuts

| Action                | Shortcut                        |
| --------------------- | -------------------------------- |
| Download `nginx.conf` | <kbd>Ctrl/⌘</kbd> + <kbd>S</kbd> |
| Show shortcuts help   | <kbd>?</kbd>                     |
| Close dialog          | <kbd>Esc</kbd>                   |

## Screenshots

> _Screenshots coming soon._

## Roadmap

- [ ] Additional location-block presets (PHP-FPM)
- [x] Multiple upstream servers with `upstream {}` load-balancing block
- [ ] IPv6-only / dual-stack listen presets
- [ ] Export as a downloadable `.zip` with split `sites-available` files
- [ ] Validate config client-side against common nginx syntax pitfalls

## License

MIT Licensed. Part of the [Web Utility Suite](https://github.com/kasapdev).

---

## Part of the kasapdev Tools Suite

One of 45+ zero-dependency vanilla JS tools, all free and open source — [see the full list](https://github.com/kasapdev/kasapdev).
