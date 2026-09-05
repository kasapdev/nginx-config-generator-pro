/* =====================================================================
   Nginx Config Generator Pro — app.js
   Builds real, syntactically valid nginx server-block config from
   toggleable sections. Classic script, depends on window.WUS (core.js).
   ===================================================================== */
(function () {
  'use strict';

  var WUS = window.WUS;
  var STORE_KEY = 'nginxcfg.state';

  /* ----------------------------- DOM refs ---------------------------- */
  var serverName = document.getElementById('serverName');
  var httpPort = document.getElementById('httpPort');

  var toggleStatic = document.getElementById('toggleStatic');
  var toggleProxy = document.getElementById('toggleProxy');
  var toggleSsl = document.getElementById('toggleSsl');
  var toggleRateLimit = document.getElementById('toggleRateLimit');

  var panelStatic = document.getElementById('panelStatic');
  var panelProxy = document.getElementById('panelProxy');
  var panelSsl = document.getElementById('panelSsl');
  var panelRateLimit = document.getElementById('panelRateLimit');
  var emptyOptions = document.getElementById('emptyOptions');

  var staticRoot = document.getElementById('staticRoot');
  var staticIndex = document.getElementById('staticIndex');
  var staticSpaFallback = document.getElementById('staticSpaFallback');

  var proxyUpstream = document.getElementById('proxyUpstream');
  var proxyWebsocket = document.getElementById('proxyWebsocket');

  var sslCert = document.getElementById('sslCert');
  var sslKey = document.getElementById('sslKey');
  var sslRedirect = document.getElementById('sslRedirect');

  var rlZoneName = document.getElementById('rlZoneName');
  var rlRate = document.getElementById('rlRate');
  var rlBurst = document.getElementById('rlBurst');

  var outputCode = document.getElementById('outputCode');
  var emptyState = document.getElementById('emptyState');
  var statusBadge = document.getElementById('statusBadge');
  var statusText = document.getElementById('statusText');

  var lastOutput = '';

  /* =================================================================
     Helpers
     ================================================================= */
  function indent(str, spaces) {
    var pad = new Array(spaces + 1).join(' ');
    return str.split('\n').map(function (l) { return l ? pad + l : l; }).join('\n');
  }

  function names() {
    var v = (serverName.value || '').trim();
    return v || 'example.com';
  }

  function httpListenPort() {
    var p = Number(httpPort.value);
    return (p >= 1 && p <= 65535) ? p : 80;
  }

  /* =================================================================
     Block builders — each returns a string, or '' if inputs are unusable
     ================================================================= */
  function buildStaticServer() {
    var root = (staticRoot.value || '/var/www/html').trim();
    var index = (staticIndex.value || 'index.html').trim();
    var tryFiles = staticSpaFallback.checked
      ? 'try_files $uri $uri/ /index.html;'
      : 'try_files $uri $uri/ =404;';

    return [
      'server {',
      '    listen ' + httpListenPort() + ';',
      '    listen [::]:' + httpListenPort() + ';',
      '    server_name ' + names() + ';',
      '',
      '    root ' + root + ';',
      '    index ' + index + ';',
      '',
      '    location / {',
      '        ' + tryFiles,
      '    }',
      '}'
    ].join('\n');
  }

  function buildProxyLocation() {
    var upstream = (proxyUpstream.value || '127.0.0.1:3000').trim();
    var lines = [
      'location / {',
      '    proxy_pass http://' + upstream + ';',
      '    proxy_set_header Host $host;',
      '    proxy_set_header X-Real-IP $remote_addr;',
      '    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
      '    proxy_set_header X-Forwarded-Proto $scheme;',
      '    proxy_http_version 1.1;'
    ];
    if (proxyWebsocket.checked) {
      lines.push('    proxy_set_header Upgrade $http_upgrade;');
      lines.push('    proxy_set_header Connection "upgrade";');
    }
    lines.push('}');
    return lines.join('\n');
  }

  function buildProxyServer() {
    return [
      'server {',
      '    listen ' + httpListenPort() + ';',
      '    listen [::]:' + httpListenPort() + ';',
      '    server_name ' + names() + ';',
      '',
      indent(buildProxyLocation(), 4),
      '}'
    ].join('\n');
  }

  function buildSslServer(rateLimitLocationSnippet) {
    var cert = (sslCert.value || '/etc/letsencrypt/live/example.com/fullchain.pem').trim();
    var key = (sslKey.value || '/etc/letsencrypt/live/example.com/privkey.pem').trim();

    var lines = [
      'server {',
      '    listen 443 ssl http2;',
      '    listen [::]:443 ssl http2;',
      '    server_name ' + names() + ';',
      '',
      '    ssl_certificate ' + cert + ';',
      '    ssl_certificate_key ' + key + ';',
      '    ssl_protocols TLSv1.2 TLSv1.3;',
      '    ssl_prefer_server_ciphers off;',
      '    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;',
      '    ssl_session_timeout 1d;',
      '    ssl_session_cache shared:SSL:10m;',
      '    ssl_session_tickets off;',
      '',
      '    add_header Strict-Transport-Security "max-age=63072000" always;',
      ''
    ];

    if (toggleProxy.checked) {
      lines.push(indent(buildProxyLocation(), 4));
    } else if (toggleStatic.checked) {
      var root = (staticRoot.value || '/var/www/html').trim();
      var index = (staticIndex.value || 'index.html').trim();
      var tryFiles = staticSpaFallback.checked
        ? 'try_files $uri $uri/ /index.html;'
        : 'try_files $uri $uri/ =404;';
      lines.push('    root ' + root + ';');
      lines.push('    index ' + index + ';');
      lines.push('');
      lines.push('    location / {');
      if (rateLimitLocationSnippet) lines.push(indent(rateLimitLocationSnippet, 8));
      lines.push('        ' + tryFiles);
      lines.push('    }');
    } else {
      lines.push('    location / {');
      if (rateLimitLocationSnippet) lines.push(indent(rateLimitLocationSnippet, 8));
      lines.push('        return 200 "OK";');
      lines.push('    }');
    }

    lines.push('}');
    return lines.join('\n');
  }

  function buildHttpRedirectServer() {
    return [
      'server {',
      '    listen ' + httpListenPort() + ';',
      '    listen [::]:' + httpListenPort() + ';',
      '    server_name ' + names() + ';',
      '',
      '    return 301 https://$host$request_uri;',
      '}'
    ].join('\n');
  }

  function rateLimitZoneLine() {
    var zone = (rlZoneName.value || 'mylimit').trim();
    var rate = Number(rlRate.value) || 10;
    return 'limit_req_zone $binary_remote_addr zone=' + zone + ':10m rate=' + rate + 'r/s;';
  }

  function rateLimitLocationLine() {
    var zone = (rlZoneName.value || 'mylimit').trim();
    var burst = Number(rlBurst.value) || 0;
    return 'limit_req zone=' + zone + ' burst=' + burst + ' nodelay;';
  }

  /* =================================================================
     MAIN COMPOSER
     ================================================================= */
  function generate() {
    var anyEnabled = toggleStatic.checked || toggleProxy.checked || toggleSsl.checked || toggleRateLimit.checked;

    panelStatic.hidden = !toggleStatic.checked;
    panelProxy.hidden = !toggleProxy.checked;
    panelSsl.hidden = !toggleSsl.checked;
    panelRateLimit.hidden = !toggleRateLimit.checked;
    emptyOptions.hidden = anyEnabled;

    var count = [toggleStatic.checked, toggleProxy.checked, toggleSsl.checked, toggleRateLimit.checked]
      .filter(Boolean).length;
    statusBadge.classList.toggle('is-active', count > 0);
    statusText.textContent = count + (count === 1 ? ' block enabled' : ' blocks enabled');

    if (!anyEnabled) {
      lastOutput = '';
      outputCode.textContent = '';
      emptyState.classList.remove('is-hidden');
      persist();
      return;
    }

    var blocks = [];
    var httpCtxLines = [];

    if (toggleRateLimit.checked) {
      httpCtxLines.push('# Place in the http {} context (e.g. nginx.conf or conf.d/*.conf)');
      httpCtxLines.push(rateLimitZoneLine());
    }
    if (httpCtxLines.length) {
      blocks.push(httpCtxLines.join('\n'));
    }

    var rlLocationSnippet = toggleRateLimit.checked ? rateLimitLocationLine() : '';

    if (toggleSsl.checked) {
      if (sslRedirect.checked) blocks.push(buildHttpRedirectServer());
      blocks.push(buildSslServer(rlLocationSnippet));
    } else if (toggleProxy.checked) {
      var proxyServer = buildProxyServer();
      if (rlLocationSnippet) {
        // splice the rate-limit line into the location block
        proxyServer = proxyServer.replace(
          'proxy_pass',
          rlLocationSnippet + '\n        proxy_pass'
        );
      }
      blocks.push(proxyServer);
    } else if (toggleStatic.checked) {
      var staticServer = buildStaticServer();
      if (rlLocationSnippet) {
        staticServer = staticServer.replace(
          /(location \/ \{\n)/,
          '$1        ' + rlLocationSnippet + '\n'
        );
      }
      blocks.push(staticServer);
    } else if (toggleRateLimit.checked) {
      blocks.push([
        'server {',
        '    listen ' + httpListenPort() + ';',
        '    server_name ' + names() + ';',
        '',
        '    location / {',
        '        ' + rlLocationSnippet,
        '    }',
        '}'
      ].join('\n'));
    }

    var out = blocks.join('\n\n');
    lastOutput = out;
    outputCode.innerHTML = highlight(out);
    emptyState.classList.add('is-hidden');
    persist();
  }

  /* =================================================================
     Tiny syntax highlighter for the generated config
     ================================================================= */
  function highlight(text) {
    var re = /(#.*$)|("(?:[^"\\]|\\.)*")|(\$[a-zA-Z_][a-zA-Z0-9_]*)|([{}])/gm;
    var out = '';
    var lastIndex = 0;
    var m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > lastIndex) out += WUS.escapeHtml(text.slice(lastIndex, m.index));
      lastIndex = re.lastIndex;
      if (m[1] !== undefined) out += '<span class="tok-comment">' + WUS.escapeHtml(m[1]) + '</span>';
      else if (m[2] !== undefined) out += '<span class="tok-string">' + WUS.escapeHtml(m[2]) + '</span>';
      else if (m[3] !== undefined) out += '<span class="tok-var">' + WUS.escapeHtml(m[3]) + '</span>';
      else if (m[4] !== undefined) out += '<span class="tok-brace">' + WUS.escapeHtml(m[4]) + '</span>';
    }
    if (lastIndex < text.length) out += WUS.escapeHtml(text.slice(lastIndex));
    return out;
  }

  /* =================================================================
     Copy / Download
     ================================================================= */
  function copyOutput() {
    if (!lastOutput) { WUS.toast('Enable a block first', 'error'); return; }
    WUS.copy(lastOutput, 'Config copied to clipboard');
  }

  function downloadOutput() {
    if (!lastOutput) { WUS.toast('Enable a block first', 'error'); return; }
    WUS.download('nginx.conf', lastOutput, 'text/plain;charset=utf-8');
    WUS.toast('Downloaded nginx.conf');
  }

  /* =================================================================
     PERSISTENCE
     ================================================================= */
  function persist() {
    WUS.store.set(STORE_KEY, {
      serverName: serverName.value,
      httpPort: httpPort.value,
      toggleStatic: toggleStatic.checked,
      toggleProxy: toggleProxy.checked,
      toggleSsl: toggleSsl.checked,
      toggleRateLimit: toggleRateLimit.checked,
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
      rlBurst: rlBurst.value
    });
  }

  function restore() {
    var s = WUS.store.get(STORE_KEY, null);
    if (!s) return;
    if (typeof s.serverName === 'string') serverName.value = s.serverName;
    if (s.httpPort) httpPort.value = s.httpPort;
    toggleStatic.checked = !!s.toggleStatic;
    toggleProxy.checked = !!s.toggleProxy;
    toggleSsl.checked = !!s.toggleSsl;
    toggleRateLimit.checked = !!s.toggleRateLimit;
    if (typeof s.staticRoot === 'string') staticRoot.value = s.staticRoot;
    if (typeof s.staticIndex === 'string') staticIndex.value = s.staticIndex;
    staticSpaFallback.checked = !!s.staticSpaFallback;
    if (typeof s.proxyUpstream === 'string') proxyUpstream.value = s.proxyUpstream;
    proxyWebsocket.checked = s.proxyWebsocket !== false;
    if (typeof s.sslCert === 'string') sslCert.value = s.sslCert;
    if (typeof s.sslKey === 'string') sslKey.value = s.sslKey;
    sslRedirect.checked = s.sslRedirect !== false;
    if (typeof s.rlZoneName === 'string') rlZoneName.value = s.rlZoneName;
    if (s.rlRate) rlRate.value = s.rlRate;
    if (s.rlBurst) rlBurst.value = s.rlBurst;
  }

  /* =================================================================
     SHORTCUTS HELP MODAL
     ================================================================= */
  var helpBackdrop = document.getElementById('helpBackdrop');
  var helpClose = document.getElementById('helpClose');
  var shortcutRows = document.getElementById('shortcutRows');

  var SHORTCUTS = [
    { keys: ['mod', 'S'], desc: 'Download nginx.conf' },
    { keys: ['mod', 'C'], desc: 'Copy config (when output focused)' },
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
  helpBackdrop.addEventListener('click', function (e) { if (e.target === helpBackdrop) closeHelp(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !helpBackdrop.hidden) closeHelp();
  });
  var helpBtns = document.querySelectorAll('[data-shortcut-help]');
  for (var i = 0; i < helpBtns.length; i++) helpBtns[i].addEventListener('click', openHelp);

  /* =================================================================
     WIRING
     ================================================================= */
  var inputsToWatch = [
    serverName, httpPort, toggleStatic, toggleProxy, toggleSsl, toggleRateLimit,
    staticRoot, staticIndex, staticSpaFallback,
    proxyUpstream, proxyWebsocket,
    sslCert, sslKey, sslRedirect,
    rlZoneName, rlRate, rlBurst
  ];
  inputsToWatch.forEach(function (el) {
    var evt = (el.type === 'checkbox') ? 'change' : 'input';
    el.addEventListener(evt, generate);
  });

  document.getElementById('btnCopy').addEventListener('click', copyOutput);
  document.getElementById('btnDownload').addEventListener('click', downloadOutput);

  WUS.registerShortcut('mod+s', function () { downloadOutput(); }, 'Download nginx.conf');
  WUS.registerShortcut('mod+c', function () {
    if (document.activeElement === document.getElementById('output')) copyOutput();
  }, 'Copy config');
  WUS.registerShortcut('?', function () { openHelp(); }, 'Show shortcuts');

  /* =================================================================
     INIT
     ================================================================= */
  buildShortcutTable();
  restore();
  generate();
})();
