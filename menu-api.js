/* menu-api.js — MenuVision multi-tenant data loader */
(function () {
  var RAILWAY    = 'https://menuvision-production.up.railway.app';
  var DEFAULT_ID = '156dbae3-12f9-45f0-ad72-aa6966916d7c';
  var TTL        = 5 * 60 * 1000;

  var params = new URLSearchParams(location.search);
  var rid    = params.get('r') || DEFAULT_ID;

  window.menuAPI = { restaurantId: rid, plats: [], promotions: [], theme: {}, ready: false };

  var ck = 'mv_' + rid;
  try {
    var raw = sessionStorage.getItem(ck);
    if (raw) {
      var c = JSON.parse(raw);
      if (Date.now() - c.ts < TTL) {
        Object.assign(window.menuAPI, c.d, { ready: true });
        _theme(window.menuAPI.theme);
        _schedule(_fire);
        return;
      }
    }
  } catch (_) {}

  Promise.all([
    _get(RAILWAY + '/plats?restaurant_id='      + rid),
    _get(RAILWAY + '/promotions?restaurant_id=' + rid),
    _get(RAILWAY + '/restaurants/' + rid + '/theme'),
  ]).then(function (r) {
    if (r[0] && r[0].ok) window.menuAPI.plats      = r[0].plats      || [];
    if (r[1] && r[1].ok) window.menuAPI.promotions = r[1].promotions  || [];
    if (r[2] && r[2].ok) window.menuAPI.theme      = r[2].theme       || {};
    window.menuAPI.ready = true;
    try {
      sessionStorage.setItem(ck, JSON.stringify({ ts: Date.now(), d: {
        plats: window.menuAPI.plats,
        promotions: window.menuAPI.promotions,
        theme: window.menuAPI.theme
      }}));
    } catch (_) {}
    _theme(window.menuAPI.theme);
    _fire();
  }).catch(function () { window.menuAPI.ready = true; _fire(); });

  function _get(url) {
    return new Promise(function (resolve) {
      var t = setTimeout(function () { resolve(null); }, 5000);
      fetch(url)
        .then(function (res) { return res.json(); })
        .then(function (d)   { clearTimeout(t); resolve(d); })
        .catch(function ()   { clearTimeout(t); resolve(null); });
    });
  }

  function _theme(t) {
    if (!t) return;
    var r = document.documentElement;
    if (t.couleur_principale) {
      r.style.setProperty('--terre',    t.couleur_principale);
      r.style.setProperty('--terre-dk', _dk(t.couleur_principale));
    }
    if (t.couleur_accent) r.style.setProperty('--warm-mid', t.couleur_accent);
    if (t.police)         _font(t.police);
    if (t.nom)            document.querySelectorAll('.header-brand').forEach(function (e) { e.textContent = t.nom; });
  }

  function _dk(hex) {
    var n = parseInt(hex.replace('#', ''), 16);
    function ch(s) { return Math.max(0, Math.min(255, ((n >> s) & 0xff) - 38)); }
    return '#' + [ch(16), ch(8), ch(0)].map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
  }

  function _font(name) {
    var l = document.createElement('link');
    l.rel  = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(name) + ':ital,wght@0,300;0,400;1,300;1,400&display=swap';
    document.head.appendChild(l);
    document.documentElement.style.setProperty('--font-serif', "'" + name + "', 'Cormorant Garamond', serif");
  }

  function _schedule(fn) {
    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', fn)
      : setTimeout(fn, 0);
  }

  function _fire() {
    window.dispatchEvent(new CustomEvent('menuApiReady', { detail: window.menuAPI }));
  }
})();
