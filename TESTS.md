# Manual verification traces

This project has no test framework (zero-dependency, no build step, no `npm test`).
Every new directive below was verified two ways before release:

1. **Traced by hand** against nginx's own documentation for each directive (cited inline).
2. **Executed for real** with a throwaway [jsdom](https://github.com/jsdom/jsdom) harness
   that loads the actual `index.html` + `assets/js/core.js` + `js/app.js`, drives the real
   toggles/fields/selects exactly as a browser would, and asserts on the real
   `#outputCode` text. The harness is not part of this repo (kept out to stay
   zero-dependency) — the checks it ran are reproduced below so the trace is reviewable
   without re-running anything. All 27 checks passed.

## Load balancing / upstream

Real syntax: [`ngx_http_upstream_module`](https://nginx.org/en/docs/http/ngx_http_upstream_module.html).
Round-robin is nginx's implicit default — there is no `round_robin;` directive, so it's
correctly emitted as *no line at all*. `least_conn;` and `ip_hash;` are real balancing
directives. `server` accepts `weight=`, `max_fails=`, `fail_timeout=`, `backup`, and `down`
exactly as documented; `backup`/`down` servers correctly do **not** get `max_fails`/
`fail_timeout` auto-appended (those parameters control retry behavior for active servers,
not backups).

Input: name=`backend`, method=round-robin (default), servers=
```
10.0.0.1:3000 weight=3
10.0.0.2:3000
10.0.0.3:3000 backup
```
max_fails=`3`, fail_timeout=`30s`:

```
upstream backend {
    server 10.0.0.1:3000 weight=3 max_fails=3 fail_timeout=30s;
    server 10.0.0.2:3000 max_fails=3 fail_timeout=30s;
    server 10.0.0.3:3000 backup;
}
```

Switching method to `least_conn` inserts `    least_conn;` as the first line inside the
block; switching to `ip_hash` inserts `    ip_hash;` instead — traced and confirmed both. ✓

**Wiring into the reverse proxy**: with the upstream block enabled, the Reverse proxy
block's `proxy_pass` reads `http://backend;` (the upstream name) instead of the raw
`proxyUpstream` host:port field. Turning the upstream toggle back off makes `proxy_pass`
fall back to the manual `host:port` field again — confirmed both directions. ✓

## Caching

Real syntax: [`proxy_cache_path`](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_cache_path)
(top-level/`http{}`-context directive that declares the shared-memory zone) plus
`proxy_cache`, `proxy_cache_valid`, and `proxy_cache_bypass` (location-context directives
that reference that zone by name). `$upstream_cache_status` is a real nginx variable used
in the commonly-recommended `add_header X-Cache-Status $upstream_cache_status;` debug
pattern.

Input: path=`/var/cache/nginx/mycache`, zone=`mycache`, zone size=`10m`, max_size=`1g`,
inactive=`60m`, valid(200/302)=`10m`, valid(404)=`1m`:

```
proxy_cache_path /var/cache/nginx/mycache levels=1:2 keys_zone=mycache:10m max_size=1g inactive=60m use_temp_path=off;
```

...and, inside the reverse proxy's `location / { }`:

```
proxy_cache mycache;
proxy_cache_valid 200 302 10m;
proxy_cache_valid 404 1m;
proxy_cache_bypass $http_cache_control;
add_header X-Cache-Status $upstream_cache_status;
```

Confirmed the cache directives only appear inside the proxy location when **both** Caching
and Reverse proxy are enabled — and that they're also present inside the SSL block's
reused proxy location when SSL + Reverse proxy + Caching are all on simultaneously. ✓

## Gzip / Brotli compression

Real syntax: [`ngx_http_gzip_module`](https://nginx.org/en/docs/http/ngx_http_gzip_module.html) —
`gzip`, `gzip_vary`, `gzip_proxied`, `gzip_comp_level`, `gzip_min_length`, `gzip_types` are
all genuine, documented directives.

```
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_min_length 256;
gzip_types text/plain text/css application/json application/javascript application/xml+rss application/xml text/javascript image/svg+xml;
```

Confirmed absent entirely when the Gzip toggle is off. ✓

**Brotli is not part of stock nginx.** `brotli`/`brotli_comp_level`/`brotli_types` are real
directive names from the third-party [`ngx_brotli`](https://github.com/google/ngx_brotli)
module, but they do nothing (or fail to load) on an nginx build that doesn't have that
module compiled in. This tool never emits them silently — they only appear behind an
explicit "Also include Brotli" checkbox, and the output itself carries the disclosure
comment (verified present in the generated text, not just in the UI):

```
# Brotli compression — requires the third-party ngx_brotli module
# (https://github.com/google/ngx_brotli), which is NOT bundled with
# stock nginx. Remove this block if your nginx build doesn't have it.
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css application/json application/javascript application/xml+rss application/xml text/javascript image/svg+xml;
```
✓

## WebSocket proxy support (pre-existing, re-verified unbroken)

Real syntax: WebSocket passthrough over an HTTP/1.1 proxy connection requires
`proxy_http_version 1.1;` plus forwarding the `Upgrade` request header and setting
`Connection` to the literal string `"upgrade"` — all three traced and present:

```
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

Confirmed this still fires correctly after the upstream/caching changes to
`proxyLocationLines()` (the shared builder both the plain Reverse proxy block and the
SSL block's reused proxy location call). ✓

## Cross-cutting checks

- **Full combined output** was generated once with every block enabled at once (Reverse
  proxy + Upstream + Caching + SSL + Rate limiting + Gzip + Brotli) and read end-to-end:
  every `{`/`}` pair balances, every directive line ends in `;`, and the SSL server block
  correctly reuses the same upstream name and cache/WebSocket directives as the plain
  proxy block.
- Turning off **Load balancing / upstream** removes the `upstream backend { … }` block
  entirely and reverts `proxy_pass` to the manually-entered `host:port` — confirmed the
  block text is fully absent (not just visually hidden) from the generated output.
- `node --check js/app.js` passes.
