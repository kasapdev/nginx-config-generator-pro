/* =====================================================================
   Nginx Config Generator Pro — app.js
   Visually builds real, syntactically-correct nginx server-block
   snippets (static/SPA, reverse proxy w/ load-balanced upstreams and
   caching, SSL/TLS, gzip/Brotli compression, rate limiting) and
   combines the enabled ones into one downloadable nginx.conf.
   Classic script (no modules). Depends on window.WUS (core.js).
   ===================================================================== */
(function () {
  'use strict';

  var WUS = window.WUS;
  var STORE_KEY = 'nginxcfg.state';

  var MODERN_CIPHERS =
    'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:' +
    'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:' +
    'ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:' +
    'DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';

  var COMPRESSIBLE_TYPES =
    'text/plain text/css application/json application/javascript ' +
    'application/xml+rss application/xml text/javascript image/svg+xml';

  /* ----------------------------- DOM refs ---------------------------- */
  var serverNameEl = document.getElementById('serverName');
  var httpPortEl   = document.getElementById('httpPort');

  var toggleStatic    = document.getElementById('toggleStatic');
  var toggleProxy     = document.getElementById('toggleProxy');
  var toggleSsl       = document.getElementById('toggleSsl');
  var toggleRateLimit = document.getElementById('toggleRateLimit');
  var toggleUpstream  = document.getElementById('toggleUpstream');
  var toggleCache     = document.getElementById('toggleCache');
  var toggleGzip      = document.getElementById('toggleGzip');

  var panelStatic    = document.getElementById('panelStatic');
  var panelProxy     = document.getElementById('panelProxy');
  var panelSsl       = document.getElementById('panelSsl');
  var panelRateLimit = document.getElementById('panelRateLimit');
  var panelUpstream  = document.getElementById('panelUpstream');
  var panelCache     = document.getElementById('panelCache');
  var panelGzip      = document.getElementById('panelGzip');
  var emptyOptions   = document.getElementById('emptyOptions');

  var staticRoot        = document.getElementById('staticRoot');
  var staticIndex       = document.getElementById('staticIndex');
  var staticSpaFallback = document.getElementById('staticSpaFallback');

  var proxyUpstream  = document.getElementById('proxyUpstream');
  var proxyWebsocket = document.getElementById('proxyWebsocket');

  var sslCert     = document.getElementById('sslCert');
  var sslKey      = document.getElementById('sslKey');
  var sslRedirect = document.getElementById('sslRedirect');

  var rlZoneName = document.getElementById('rlZoneName');
  var rlRate     = document.getElementById('rlRate');
  var rlBurst    = document.getElementById('rlBurst');

  var ulName        = document.getElementById('ulName');
  var ulMethod      = document.getElementById('ulMethod');
  var ulServers     = document.getElementById('ulServers');
  var ulMaxFails    = document.getElementById('ulMaxFails');
  var ulFailTimeout = document.getElementById('ulFailTimeout');

  var cachePath      = document.getElementById('cachePath');
  var cacheZoneName  = document.getElementById('cacheZoneName');
  var cacheZoneSize  = document.getElementById('cacheZoneSize');
  var cacheMaxSize   = document.getElementById('cacheMaxSize');
  var cacheInactive  = document.getElementById('cacheInactive');
  var cacheValidOk   = document.getElementById('cacheValidOk');
  var cacheValid404  = document.getElementById('cacheValid404');

  var gzipBrotli = document.getElementById('gzipBrotli');

  var statusBadge = document.getElementById('statusBadge');
  var statusText  = document.getElementById('statusText');

  var outputCode = document.getElementById('outputCode');
  var emptyState = document.getElementById('emptyState');

  var btnCopy     = document.getElementById('btnCopy');
  var btnDownload = document.getElementById('btnDownload');

  /* The most recently generated config text (for copy / download). */
  var lastOutput = '';

  /* =================================================================
     HELPERS
     ================================================================= */
  function serverNames() {
    return (serverNameEl.value || '').trim() || 'example.com';
  }
  function httpPort() {
    var p = parseInt(httpPortEl.value, 10);
    return (p >= 1 && p <= 65535) ? String(p) : '80';
  }
  function indent(n) { return new Array(n + 1).join('    '); }
  function upstreamName() {
    return (ulName.value || '').trim() || 'backend';
  }

  /* =================================================================
     BLOCK BUILDERS — each returns an array of lines (no trailing blank)
     ================================================================= */
  function staticLocationLines(depth) {
    var idx = (staticIndex.value || '').trim() || 'index.html';
    var spa = staticSpaFallback.checked;
    var tryFiles = spa ? ('$uri $uri/ /' + idx) : '$uri $uri/ =404';
    var pad = indent(depth);
    return [
      pad + 'location / {',
      pad + '    try_files ' + tryFiles + ';',
      pad + '}'
    ];
  }

  function buildStaticBlock() {
    var root = (staticRoot.value || '').trim() || '/var/www/html';
    var idx  = (staticIndex.value || '').trim() || 'index.html';
    var spa  = staticSpaFallback.checked;
    var lines = [];
    lines.push('# Static site' + (spa ? ' (SPA — unknown routes fall back to ' + idx + ')' : ' (plain static, unknown routes 404)'));
    lines.push('server {');
    lines.push('    listen ' + httpPort() + ';');
    lines.push('    listen [::]:' + httpPort() + ';');
    lines.push('    server_name ' + serverNames() + ';');
    lines.push('    root ' + root + ';');
    lines.push('    index ' + idx + ';');
    lines.push('');
    lines = lines.concat(staticLocationLines(1));
    lines.push('}');
    return lines;
  }

  /* Real nginx upstream block: round-robin is the implicit default (no
     directive line for it), least_conn/ip_hash are real load-balancing
     directives. Each server line accepts optional weight=/max_fails=/
     fail_timeout=/backup/down tokens exactly as nginx's own `server`
     directive does inside `upstream {}`. */
  function buildUpstreamBlock() {
    var name = upstreamName();
    var method = ulMethod.value;
    var maxFailsParsed = parseInt(ulMaxFails.value, 10);
    var maxFails = isNaN(maxFailsParsed) ? 3 : WUS.clamp(maxFailsParsed, 1, 100);
    var failTimeout = (ulFailTimeout.value || '').trim() || '30s';

    var serverLines = String(ulServers.value || '').split('\n')
      .map(function (l) { return l.trim(); })
      .filter(Boolean);
    if (!serverLines.length) {
      serverLines = ['10.0.0.1:3000 weight=3', '10.0.0.2:3000', '10.0.0.3:3000 backup'];
    }

    var lines = [];
    lines.push('# Load-balanced upstream (define in the http {} context, alongside your server {} blocks)');
    lines.push('upstream ' + name + ' {');
    if (method === 'least_conn') lines.push('    least_conn;');
    else if (method === 'ip_hash') lines.push('    ip_hash;');
    // round-robin: no directive — it's nginx's default upstream behavior.

    serverLines.forEach(function (line) {
      var parts = line.split(/\s+/).filter(Boolean);
      var hostport = parts[0];
      var extras = parts.slice(1);
      var isDownOrBackup = extras.some(function (e) { return e === 'backup' || e === 'down'; });
      var tokens = [hostport].concat(extras);
      if (!isDownOrBackup) {
        var hasMaxFails = extras.some(function (e) { return /^max_fails=/.test(e); });
        var hasFailTimeout = extras.some(function (e) { return /^fail_timeout=/.test(e); });
        if (!hasMaxFails) tokens.push('max_fails=' + maxFails);
        if (!hasFailTimeout) tokens.push('fail_timeout=' + failTimeout);
      }
      lines.push('    server ' + tokens.join(' ') + ';');
    });

    lines.push('}');
    return lines;
  }

  /* proxy_cache_path is a top-level (http-context) directive that
     defines the shared-memory keys_zone a location later references by
     name via proxy_cache. */
  function buildCacheTopBlock() {
    var cpath = (cachePath.value || '').trim() || '/var/cache/nginx/mycache';
    var zone = (cacheZoneName.value || '').trim() || 'mycache';
    var zoneSize = (cacheZoneSize.value || '').trim() || '10m';
    var maxSize = (cacheMaxSize.value || '').trim() || '1g';
    var inactive = (cacheInactive.value || '').trim() || '60m';

    var lines = [];
    lines.push('# Proxy cache zone (proxy_cache_path belongs in the http {} context, above your server {} blocks)');
    lines.push('proxy_cache_path ' + cpath + ' levels=1:2 keys_zone=' + zone + ':' + zoneSize +
      ' max_size=' + maxSize + ' inactive=' + inactive + ' use_temp_path=off;');
    return lines;
  }

  function proxyLocationLines(depth) {
    var target = toggleUpstream.checked
      ? upstreamName()
      : ((proxyUpstream.value || '').trim() || '127.0.0.1:3000');
    var ws = proxyWebsocket.checked;
    var pad = indent(depth);
    var lines = [];
    lines.push(pad + 'location / {');
    lines.push(pad + '    proxy_pass http://' + target + ';');
    lines.push(pad + '    proxy_set_header Host $host;');
    lines.push(pad + '    proxy_set_header X-Real-IP $remote_addr;');
    lines.push(pad + '    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;');
    lines.push(pad + '    proxy_set_header X-Forwarded-Proto $scheme;');
    if (ws) {
      lines.push(pad + '    proxy_http_version 1.1;');
      lines.push(pad + '    proxy_set_header Upgrade $http_upgrade;');
      lines.push(pad + '    proxy_set_header Connection "upgrade";');
    }
    if (toggleCache.checked) {
      var zone = (cacheZoneName.value || '').trim() || 'mycache';
      var validOk = (cacheValidOk.value || '').trim() || '10m';
      var valid404 = (cacheValid404.value || '').trim() || '1m';
      lines.push(pad + '    proxy_cache ' + zone + ';');
      lines.push(pad + '    proxy_cache_valid 200 302 ' + validOk + ';');
      lines.push(pad + '    proxy_cache_valid 404 ' + valid404 + ';');
      lines.push(pad + '    proxy_cache_bypass $http_cache_control;');
      lines.push(pad + '    add_header X-Cache-Status $upstream_cache_status;');
    }
    lines.push(pad + '}');
    return lines;
  }

  function buildProxyBlock() {
    var lines = [];
    lines.push('# Reverse proxy');
    lines.push('server {');
    lines.push('    listen ' + httpPort() + ';');
    lines.push('    listen [::]:' + httpPort() + ';');
    lines.push('    server_name ' + serverNames() + ';');
    lines.push('');
    lines = lines.concat(proxyLocationLines(1));
    lines.push('}');
    return lines;
  }

  function buildSslBlock() {
    var cert = (sslCert.value || '').trim() || '/etc/letsencrypt/live/example.com/fullchain.pem';
    var key  = (sslKey.value  || '').trim() || '/etc/letsencrypt/live/example.com/privkey.pem';
    var redirect = sslRedirect.checked;

    var lines = [];
    lines.push('# SSL/TLS (HTTPS)');
    lines.push('server {');
    lines.push('    listen 443 ssl;');
    lines.push('    listen [::]:443 ssl;');
    lines.push('    http2 on;');
    lines.push('    server_name ' + serverNames() + ';');
    lines.push('');
    lines.push('    ssl_certificate     ' + cert + ';');
    lines.push('    ssl_certificate_key ' + key + ';');
    lines.push('    ssl_protocols TLSv1.2 TLSv1.3;');
    lines.push('    ssl_ciphers ' + MODERN_CIPHERS + ';');
    lines.push('    ssl_prefer_server_ciphers off;');
    lines.push('    ssl_session_cache shared:SSL:10m;');
    lines.push('    ssl_session_timeout 10m;');
    lines.push('');

    if (toggleStatic.checked) {
      var root = (staticRoot.value || '').trim() || '/var/www/html';
      var idx  = (staticIndex.value || '').trim() || 'index.html';
      lines.push('    root ' + root + ';');
      lines.push('    index ' + idx + ';');
      lines.push('');
      lines = lines.concat(staticLocationLines(1));
    } else if (toggleProxy.checked) {
      lines = lines.concat(proxyLocationLines(1));
    } else {
      lines.push('    location / {');
      lines.push('        # Add your site config here (root + try_files, or proxy_pass)');
      lines.push('    }');
    }
    lines.push('}');

    if (redirect) {
      lines.push('');
      lines.push('# HTTP → HTTPS redirect');
      lines.push('server {');
      lines.push('    listen ' + httpPort() + ';');
      lines.push('    listen [::]:' + httpPort() + ';');
      lines.push('    server_name ' + serverNames() + ';');
      lines.push('    return 301 https://$host$request_uri;');
      lines.push('}');
    }
    return lines;
  }

  function buildRateLimitBlock() {
    var zone  = (rlZoneName.value || '').trim() || 'mylimit';
    var rateParsed  = parseInt(rlRate.value, 10);
    var rate  = isNaN(rateParsed) ? 10 : WUS.clamp(rateParsed, 1, 10000);
    var burstParsed = parseInt(rlBurst.value, 10);
    var burst = isNaN(burstParsed) ? 20 : WUS.clamp(burstParsed, 0, 10000);

    var lines = [];
    lines.push('# Rate limiting — limit_req_zone belongs in the http {} context');
    lines.push('# (e.g. /etc/nginx/conf.d/rate-limit.conf, included from http {})');
    lines.push('limit_req_zone $binary_remote_addr zone=' + zone + ':10m rate=' + rate + 'r/s;');
    lines.push('');
    lines.push('# Apply inside a server or location block:');
    lines.push('location / {');
    lines.push('    limit_req zone=' + zone + ' burst=' + burst + ' nodelay;');
    lines.push('}');
    return lines;
  }

  /* Real, correct gzip directives (http context). Brotli is NOT part of
     stock nginx — it needs the third-party ngx_brotli module compiled
     or loaded as a dynamic module — so that section is clearly labeled
     and only emitted when the user explicitly opts in. */
  function buildGzipBlock() {
    var lines = [];
    lines.push('# Gzip compression (belongs in the http {} context)');
    lines.push('gzip on;');
    lines.push('gzip_vary on;');
    lines.push('gzip_proxied any;');
    lines.push('gzip_comp_level 6;');
    lines.push('gzip_min_length 256;');
    lines.push('gzip_types ' + COMPRESSIBLE_TYPES + ';');

    if (gzipBrotli.checked) {
      lines.push('');
      lines.push('# Brotli compression — requires the third-party ngx_brotli module');
      lines.push('# (https://github.com/google/ngx_brotli), which is NOT bundled with');
      lines.push('# stock nginx. Remove this block if your nginx build doesn\'t have it.');
      lines.push('brotli on;');
      lines.push('brotli_comp_level 6;');
      lines.push('brotli_types ' + COMPRESSIBLE_TYPES + ';');
    }
    return lines;
  }

  /* =================================================================
     SYNTAX HIGHLIGHTING (line-based: comments, directives, vars, strings, braces)
     ================================================================= */
  function highlightLine(line) {
    var trimmed = line.replace(/^\s+/, '');
    var leadingWs = line.slice(0, line.length - trimmed.length);

    if (trimmed.charAt(0) === '#') {
      return WUS.escapeHtml(leadingWs) + '<span class="tok-comment">' + WUS.escapeHtml(trimmed) + '</span>';
    }

    var dirMatch = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(trimmed);
    var prefix = '';
    var rest = trimmed;
    if (dirMatch) {
      prefix = '<span class="tok-directive">' + WUS.escapeHtml(dirMatch[1]) + '</span>';
      rest = trimmed.slice(dirMatch[1].length);
    }

    var re = /(\$[A-Za-z_][A-Za-z0-9_]*)|("[^"]*")|([{}])/g;
    var out = '';
    var lastIndex = 0;
    var m;
    while ((m = re.exec(rest)) !== null) {
      if (m.index > lastIndex) out += WUS.escapeHtml(rest.slice(lastIndex, m.index));
      lastIndex = re.lastIndex;
      if (m[1] !== undefined) out += '<span class="tok-var">' + WUS.escapeHtml(m[1]) + '</span>';
      else if (m[2] !== undefined) out += '<span class="tok-string">' + WUS.escapeHtml(m[2]) + '</span>';
      else if (m[3] !== undefined) out += '<span class="tok-brace">' + WUS.escapeHtml(m[3]) + '</span>';
    }
    if (lastIndex < rest.length) out += WUS.escapeHtml(rest.slice(lastIndex));

    return WUS.escapeHtml(leadingWs) + prefix + out;
  }

  function highlight(text) {
    return text.split('\n').map(highlightLine).join('\n');
  }

  /* =================================================================
     MAIN RENDER
     ================================================================= */
  function render() {
    // Panel visibility follows the toggles.
    panelStatic.hidden    = !toggleStatic.checked;
    panelProxy.hidden     = !toggleProxy.checked;
    panelUpstream.hidden  = !toggleUpstream.checked;
    panelCache.hidden     = !toggleCache.checked;
    panelSsl.hidden       = !toggleSsl.checked;
    panelRateLimit.hidden = !toggleRateLimit.checked;
    panelGzip.hidden      = !toggleGzip.checked;

    var allToggles = [toggleStatic, toggleProxy, toggleUpstream, toggleCache,
      toggleSsl, toggleRateLimit, toggleGzip];
    var enabledCount = allToggles.filter(function (t) { return t.checked; }).length;

    emptyOptions.hidden = enabledCount > 0;

    // Build combined config. Top-level (http-context) directives first,
    // then the server {} blocks, matching how a real nginx.conf reads.
    var blocks = [];
    if (toggleGzip.checked)      blocks.push(buildGzipBlock());
    if (toggleUpstream.checked)  blocks.push(buildUpstreamBlock());
    if (toggleCache.checked)     blocks.push(buildCacheTopBlock());
    if (toggleStatic.checked)    blocks.push(buildStaticBlock());
    if (toggleProxy.checked)     blocks.push(buildProxyBlock());
    if (toggleSsl.checked)       blocks.push(buildSslBlock());
    if (toggleRateLimit.checked) blocks.push(buildRateLimitBlock());

    var text = blocks.map(function (b) { return b.join('\n'); }).join('\n\n');
    lastOutput = text;

    if (text) {
      outputCode.innerHTML = highlight(text);
      emptyState.classList.add('is-hidden');
    } else {
      outputCode.textContent = '';
      emptyState.classList.remove('is-hidden');
    }

    // Status badge.
    statusBadge.classList.toggle('is-active', enabledCount > 0);
    statusText.textContent = enabledCount + (enabledCount === 1 ? ' block enabled' : ' blocks enabled');

    persistDebounced();
  }

  /* =================================================================
     COPY / DOWNLOAD
     ================================================================= */
  function copyOutput() {
    if (!lastOutput) { WUS.toast('Nothing to copy — enable a block first', 'error'); return; }
    WUS.copy(lastOutput, 'Config copied to clipboard');
  }

  function downloadOutput() {
    if (!lastOutput) { WUS.toast('Nothing to download — enable a block first', 'error'); return; }
    WUS.download('nginx.conf', lastOutput, 'text/plain;charset=utf-8');
    WUS.toast('Downloaded nginx.conf');
  }

  /* =================================================================
     PERSISTENCE — debounced save of all fields + toggles, restore on load
     ================================================================= */
  function persist() {
    WUS.store.set(STORE_KEY, {
      serverName: serverNameEl.value,
      httpPort: httpPortEl.value,
      toggles: {
        staticSite: toggleStatic.checked,
        proxy: toggleProxy.checked,
        ssl: toggleSsl.checked,
        rateLimit: toggleRateLimit.checked,
        upstream: toggleUpstream.checked,
        cache: toggleCache.checked,
        gzip: toggleGzip.checked
      },
      staticRoot: staticRoot.value,
      staticIndex: staticIndex.value,
      staticSpaFallback: staticSpaFallback.checked,
      proxyUpstream: proxyUpstream.value,
      proxyWebsocket: proxyWebsocket.checked,
      sslCert: sslCert.value,
      sslKey: sslKey.value,
      sslRedirect: sslRedirect.checked,
      rlZoneName: rlZoneName.value,
      rlRate: rlRate.value,
      rlBurst: rlBurst.value,
      ulName: ulName.value,
      ulMethod: ulMethod.value,
      ulServers: ulServers.value,
      ulMaxFails: ulMaxFails.value,
      ulFailTimeout: ulFailTimeout.value,
      cachePath: cachePath.value,
      cacheZoneName: cacheZoneName.value,
      cacheZoneSize: cacheZoneSize.value,
      cacheMaxSize: cacheMaxSize.value,
      cacheInactive: cacheInactive.value,
      cacheValidOk: cacheValidOk.value,
      cacheValid404: cacheValid404.value,
      gzipBrotli: gzipBrotli.checked
    });
  }
  var persistDebounced = WUS.debounce(persist, 400);

  function restore() {
    var saved = WUS.store.get(STORE_KEY, null);
    if (!saved) { render(); return; }

    if (typeof saved.serverName === 'string') serverNameEl.value = saved.serverName;
    if (saved.httpPort) httpPortEl.value = saved.httpPort;

    if (saved.toggles) {
      toggleStatic.checked    = !!saved.toggles.staticSite;
      toggleProxy.checked     = !!saved.toggles.proxy;
      toggleSsl.checked       = !!saved.toggles.ssl;
      toggleRateLimit.checked = !!saved.toggles.rateLimit;
      toggleUpstream.checked  = !!saved.toggles.upstream;
      toggleCache.checked     = !!saved.toggles.cache;
      toggleGzip.checked      = !!saved.toggles.gzip;
    }

    if (typeof saved.staticRoot === 'string') staticRoot.value = saved.staticRoot;
    if (typeof saved.staticIndex === 'string') staticIndex.value = saved.staticIndex;
    staticSpaFallback.checked = !!saved.staticSpaFallback;

    if (typeof saved.proxyUpstream === 'string') proxyUpstream.value = saved.proxyUpstream;
    proxyWebsocket.checked = saved.proxyWebsocket !== undefined ? !!saved.proxyWebsocket : true;

    if (typeof saved.sslCert === 'string') sslCert.value = saved.sslCert;
    if (typeof saved.sslKey === 'string') sslKey.value = saved.sslKey;
    sslRedirect.checked = saved.sslRedirect !== undefined ? !!saved.sslRedirect : true;

    if (typeof saved.rlZoneName === 'string') rlZoneName.value = saved.rlZoneName;
    if (saved.rlRate) rlRate.value = saved.rlRate;
    if (saved.rlBurst) rlBurst.value = saved.rlBurst;

    if (typeof saved.ulName === 'string') ulName.value = saved.ulName;
    if (typeof saved.ulMethod === 'string') ulMethod.value = saved.ulMethod;
    if (typeof saved.ulServers === 'string') ulServers.value = saved.ulServers;
    if (saved.ulMaxFails) ulMaxFails.value = saved.ulMaxFails;
    if (typeof saved.ulFailTimeout === 'string' && saved.ulFailTimeout) ulFailTimeout.value = saved.ulFailTimeout;

    if (typeof saved.cachePath === 'string' && saved.cachePath) cachePath.value = saved.cachePath;
    if (typeof saved.cacheZoneName === 'string' && saved.cacheZoneName) cacheZoneName.value = saved.cacheZoneName;
    if (typeof saved.cacheZoneSize === 'string' && saved.cacheZoneSize) cacheZoneSize.value = saved.cacheZoneSize;
    if (typeof saved.cacheMaxSize === 'string' && saved.cacheMaxSize) cacheMaxSize.value = saved.cacheMaxSize;
    if (typeof saved.cacheInactive === 'string' && saved.cacheInactive) cacheInactive.value = saved.cacheInactive;
    if (typeof saved.cacheValidOk === 'string' && saved.cacheValidOk) cacheValidOk.value = saved.cacheValidOk;
    if (typeof saved.cacheValid404 === 'string' && saved.cacheValid404) cacheValid404.value = saved.cacheValid404;

    gzipBrotli.checked = !!saved.gzipBrotli;

    render();
  }

  /* =================================================================
     SHORTCUTS HELP MODAL
     ================================================================= */
  var helpBackdrop = document.getElementById('helpBackdrop');
  var helpClose    = document.getElementById('helpClose');
  var shortcutRows = document.getElementById('shortcutRows');

  var SHORTCUTS = [
    { keys: ['mod', 'S'], desc: 'Download nginx.conf' },
    { keys: ['?'], desc: 'Show this help' },
    { keys: ['Esc'], desc: 'Close dialog' }
  ];

  function buildShortcutTable() {
    var html = '';
    SHORTCUTS.forEach(function (s) {
      var kbds = s.keys.map(function (k) { return '<kbd>' + WUS.escapeHtml(k) + '</kbd>'; }).join('');
      html += '<tr><td>' + WUS.escapeHtml(s.desc) + '</td><td>' + kbds + '</td></tr>';
    });
    shortcutRows.innerHTML = html;
  }

  function openHelp() { helpBackdrop.hidden = false; helpClose.focus(); }
  function closeHelp() { helpBackdrop.hidden = true; }

  helpClose.addEventListener('click', closeHelp);
  helpBackdrop.addEventListener('click', function (e) {
    if (e.target === helpBackdrop) closeHelp();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !helpBackdrop.hidden) closeHelp();
  });

  var helpBtns = document.querySelectorAll('[data-shortcut-help]');
  for (var i = 0; i < helpBtns.length; i++) helpBtns[i].addEventListener('click', openHelp);

  /* =================================================================
     WIRING
     ================================================================= */
  [serverNameEl, httpPortEl, staticRoot, staticIndex, proxyUpstream,
   sslCert, sslKey, rlZoneName, rlRate, rlBurst,
   ulName, ulServers, ulMaxFails, ulFailTimeout,
   cachePath, cacheZoneName, cacheZoneSize, cacheMaxSize, cacheInactive,
   cacheValidOk, cacheValid404].forEach(function (el) {
    el.addEventListener('input', render);
  });

  [toggleStatic, toggleProxy, toggleSsl, toggleRateLimit,
   toggleUpstream, toggleCache, toggleGzip,
   staticSpaFallback, proxyWebsocket, sslRedirect,
   ulMethod, gzipBrotli].forEach(function (el) {
    el.addEventListener('change', render);
  });

  btnCopy.addEventListener('click', copyOutput);
  btnDownload.addEventListener('click', downloadOutput);

  /* Global keyboard shortcuts via WUS. */
  WUS.registerShortcut('mod+s', function () { downloadOutput(); }, 'Download nginx.conf');
  WUS.registerShortcut('?', function () { openHelp(); }, 'Show shortcuts');

  /* =================================================================
     INIT
     ================================================================= */
  buildShortcutTable();
  restore();
})();
