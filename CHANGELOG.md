# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.1.0] - 2026-09-07

### Added

- **Load balancing / upstream block**: a real `upstream {}` builder with round-robin
  (nginx's implicit default — no directive emitted), `least_conn;`, or `ip_hash;`, weighted
  servers (`weight=N`), `backup`/`down` markers, and auto-applied `max_fails=`/
  `fail_timeout=` on active servers. When enabled, the Reverse proxy block's `proxy_pass`
  now targets the upstream group by name instead of a single `host:port`.
- **Caching block**: a `proxy_cache_path` zone (`keys_zone`, `max_size`, `inactive`) wired
  into the Reverse proxy `location` with `proxy_cache`, `proxy_cache_valid` (separate TTLs
  for 200/302 vs. 404), `proxy_cache_bypass`, and an `X-Cache-Status` debug header.
- **Gzip / Brotli compression block**: real `gzip on; gzip_types …;` directives, plus an
  explicit, opt-in Brotli section that carries an in-output comment disclosing it requires
  the third-party `ngx_brotli` module and is not bundled with stock nginx — never emitted
  silently.
- `TESTS.md` — traced, cited verification (directive names checked against nginx's own
  docs) for every new block, since this project has no test framework.

### Changed

- The SSL/TLS block's reused reverse-proxy location now also picks up the upstream
  target and caching directives when those blocks are enabled alongside it.
- README expanded with real generated-output examples for every new block.

## [1.0.1] - 2026-09-06

### Fixed

- Rate limiting block: entering `0` in the **Burst** field (a valid value per the input's own `min="0"`) was silently replaced with the default of `20` because the code used `parseInt(...) || 20`, which treats `0` as falsy. It's now parsed with an explicit `isNaN` check and clamped to the field's actual `min`/`max` range, so a burst of `0` (and any other in-range value) is honored. Applied the same fix to the **Rate** field for consistency.
- Theme toggle button: in light theme, the CSS only hid the sun icon (`[data-theme="light"] .icon-sun { display: none; }`) without ever un-hiding the moon icon (which carried an unconditional `.icon-moon { display: none; }`), so the toggle button rendered with no visible icon at all in light mode. Added the missing `[data-theme="light"] .icon-moon { display: block; }` rule so the moon icon now shows correctly in light theme.
