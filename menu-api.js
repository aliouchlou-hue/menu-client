/* menu-api.js — Données et identité du restaurant (multi-restaurants).
   Le restaurant vient du QR code (?r=<identifiant>) ou du dernier restaurant ouvert sur cet appareil.
   Aucun restaurant par défaut : sans identifiant, la page invite à scanner le QR code. */
(function () {
  var RAILWAY = 'https://menuvision-production.up.railway.app';
  var TTL = 60 * 1000;   // cache des données : une carte modifiée apparaît vite sur les téléphones
  var I = window.MVI18n;
  var LANG = I ? I.lang : 'fr';
  var t = function (k, v) { return I ? I.t(k, v) : k; };
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  var params = new URLSearchParams(location.search);
  var rid = params.get('r');
  if (!rid) { try { rid = localStorage.getItem('mv_rid'); } catch (_) {} }
  if (rid && !UUID.test(rid)) rid = null;
  try { sessionStorage.removeItem('mv_rid_onglet'); } catch (_) {}

  window.menuAPI = { restaurantId: rid, estDefaut: false, plats: [], promotions: [], theme: {}, ready: false };

  if (!rid) { _plusTard(function () { _etat('qr'); }); return; }

  // Identité gardée sur l'appareil : couleurs et polices posées avant le premier affichage.
  var CLE_THEME = 'mv_theme:' + rid;
  try { var memo = JSON.parse(localStorage.getItem(CLE_THEME) || 'null'); if (memo) _habiller(memo); } catch (_) {}

  var ck = 'menuvision:' + rid + ':' + LANG;
  try {
    var raw = sessionStorage.getItem(ck);
    if (raw) {
      var c = JSON.parse(raw);
      if (Date.now() - c.ts < TTL) {
        Object.assign(window.menuAPI, c.d, { ready: true });
        _pret(!!c.d.a_traduire);
        return;
      }
    }
  } catch (_) {}
  _charger();

  function _charger() {
    Promise.all([
      _get(RAILWAY + '/restaurants/' + rid + '/theme'),
      _get(RAILWAY + '/plats?restaurant_id=' + rid + '&lang=' + LANG),
      _get(RAILWAY + '/promotions?restaurant_id=' + rid),
    ]).then(function (r) {
      var th = r[0];
      if (!th) return _plusTard(function () { _etat('connexion'); });
      if (th.statut === 404 || !th.ok) return _plusTard(function () { _etat('introuvable'); });
      window.menuAPI.theme = th.theme || {};
      if (r[1] && r[1].ok) window.menuAPI.plats = r[1].plats || [];
      if (r[2] && r[2].ok) window.menuAPI.promotions = _promos(r[2].promotions);
      window.menuAPI.ready = true;
      try { localStorage.setItem('mv_rid', rid); } catch (_) {}
      var aTraduire = !!(r[1] && r[1].traduction && r[1].traduction.manquants > 0);
      _cache(aTraduire);
      _pret(aTraduire);
    });
  }

  function _pret(aTraduire) {
    var th = window.menuAPI.theme;
    if (I && th && th.langue) I.restaurant(th.langue);
    if (I) I.rangerPlats(window.menuAPI.plats);
    if (th && th.indisponible) { _plusTard(function () { _etat('indisponible', th.nom); }); return; }
    _habiller(th);
    try { localStorage.setItem(CLE_THEME, JSON.stringify({ nom: th.nom, couleur_principale: th.couleur_principale, couleur_accent: th.couleur_accent, couleur_texte: th.couleur_texte, polices: th.polices, logo_url: th.logo_url })); } catch (_) {}
    _plusTard(function () { _poser(th); _fire(); });
    if (aTraduire) _completer();
  }

  function _cache(aTraduire) {
    try {
      sessionStorage.setItem(ck, JSON.stringify({ ts: Date.now(), d: { plats: window.menuAPI.plats, promotions: window.menuAPI.promotions, theme: window.menuAPI.theme, a_traduire: !!aTraduire } }));
    } catch (_) {}
  }

  // Traductions manquantes : générées par le serveur à la demande, puis gardées.
  function _completer() {
    _get(RAILWAY + '/plats/traductions?restaurant_id=' + rid + '&lang=' + LANG, 45000).then(function (d) {
      if (!d || !d.ok || !d.traductions) return;
      var n = 0;
      window.menuAPI.plats.forEach(function (p) {
        var tr = d.traductions[p.id];
        if (tr && tr.nom) { p.nom_traduit = tr.nom; p.description_traduite = tr.description || ''; n++; }
      });
      if (!n) return;
      if (I) I.rangerPlats(window.menuAPI.plats);
      _cache(d.etat === 'indisponible');
      window.dispatchEvent(new CustomEvent('mvPlatsTraduits', { detail: window.menuAPI }));
    });
  }

  // Le serveur renvoie chaque promotion avec ses plats ; le menu attend une liste par plat.
  function _promos(promos) {
    var out = [];
    (promos || []).forEach(function (promo) {
      (promo.plats || []).forEach(function (pl) {
        if (pl && pl.id != null && pl.prix_promo != null) out.push({ plat_id: pl.id, nom: pl.nom, prix: pl.prix, prix_promo: pl.prix_promo });
      });
    });
    return out;
  }

  function _get(url, delai) {
    return new Promise(function (resolve) {
      var fini = false;
      var minuteur = setTimeout(function () { if (!fini) { fini = true; resolve(null); } }, delai || 8000);
      fetch(url).then(function (res) {
        return res.json().then(function (d) { d = d || {}; d.statut = res.status; return d; }, function () { return { ok: false, statut: res.status }; });
      }).then(function (d) { if (!fini) { fini = true; clearTimeout(minuteur); resolve(d); } })
        .catch(function () { if (!fini) { fini = true; clearTimeout(minuteur); resolve(null); } });
    });
  }

  // ── Identité du restaurant : couleurs, polices (variables de mv-systeme.css) ──
  function _hex(c) { return /^#[0-9a-f]{6}$/i.test(String(c || '').trim()) ? String(c).trim() : null; }
  function _lum(hex) {
    var n = parseInt(hex.slice(1), 16);
    function c(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    return 0.2126 * c(n >> 16) + 0.7152 * c((n >> 8) & 255) + 0.0722 * c(n & 255);
  }
  function _contraste(a, b) { var x = _lum(a), y = _lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function _habiller(th) {
    if (!th) return;
    var r = document.documentElement.style;
    var fond = _hex(th.couleur_principale), accent = _hex(th.couleur_accent);
    var encre = _hex(th.couleur_texte) || (fond ? (_lum(fond) > 0.18 ? '#1C1B19' : '#F5F5F0') : null);
    if (fond) r.setProperty('--fond', fond);
    if (encre) r.setProperty('--encre', encre);
    if (accent) {
      // Un accent trop proche du fond resterait illisible : il est alors remplacé par la couleur du texte.
      var lisible = !fond || _contraste(accent, fond) >= 3;
      var a = lisible ? accent : encre;
      r.setProperty('--accent', a);
      r.setProperty('--sur-accent', _lum(a) > 0.18 ? '#1C1B19' : '#FAFAF7');
    } else if (encre) {
      r.setProperty('--accent', encre);
      r.setProperty('--sur-accent', fond || '#FAFAF7');
    }
    var p = th.polices;
    if (p && p.feuille && !document.getElementById('mv-police')) {
      var l = document.createElement('link'); l.id = 'mv-police'; l.rel = 'stylesheet'; l.href = p.feuille;
      document.head.appendChild(l);
    }
    if (p && p.serif) r.setProperty('--serif', "'" + p.serif + "', Georgia, serif");
    if (p && p.sans) r.setProperty('--sans', "'" + p.sans + "', system-ui, sans-serif");
    var tc = document.querySelector('meta[name="theme-color"]'); if (tc && fond) tc.setAttribute('content', fond);
  }

  // Nom, logo, titre de l'onglet, adresses internes : posés dans la page une fois le thème connu.
  function _poser(th) {
    var nom = th.nom || '';
    document.querySelectorAll('[data-mv-nom]').forEach(function (e) { e.textContent = nom; });
    var titre = document.querySelector('title[data-i18n-titre]');
    if (nom) document.title = titre ? nom + ' — ' + t(titre.getAttribute('data-i18n-titre')) : nom;
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', [nom, th.accroche, th.ville].filter(Boolean).join(' — '));
    if (th.logo_url) {
      var ic = document.querySelector('link[rel="icon"]'); if (ic) { ic.href = th.logo_url; ic.removeAttribute('type'); }
    }
    document.querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute('href');
      if (!/^\/?(index|entrees|plats|desserts|vins|success)(\.html)?(\?|#|$)/.test(h) || /[?&]r=/.test(h)) return;
      var morceaux = h.split('#'), base = morceaux[0], ancre = morceaux.length > 1 ? '#' + morceaux.slice(1).join('#') : '';
      a.setAttribute('href', base + (base.indexOf('?') >= 0 ? '&' : '?') + 'r=' + encodeURIComponent(rid) + ancre);
    });
  }

  // ── États sans carte : aucun contenu d'un autre restaurant n'est montré ──
  // Fonction (hissée) : utilisable même quand le script s'arrête tôt (aucun restaurant).
  function _icone(type) { return ({
    qr: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4"/></svg>',
    introuvable: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M8.5 8.5l5 5M13.5 8.5l-5 5"/></svg>',
    connexion: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M12 19h.01M3 3l18 18"/></svg>',
    indisponible: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  })[type] || ''; }
  function _etat(type, nom) {
    if (document.getElementById('mv-etat')) return;
    var d = document.createElement('div');
    d.id = 'mv-etat'; d.setAttribute('role', 'alert');
    var titre = type === 'indisponible' ? (nom || t('etat.indispo.titre')) : t('etat.' + type + '.titre');
    d.innerHTML = _icone(type) + '<h1></h1><p></p>' + (type === 'indisponible' ? '<p class="mv-etat-2"></p>' : '') + (type === 'connexion' ? '<button type="button"></button>' : '');
    d.querySelector('h1').textContent = titre;
    d.querySelector('p').textContent = type === 'indisponible' ? t('indispo.titre') : t('etat.' + type + '.texte');
    if (type === 'indisponible') d.querySelector('.mv-etat-2').textContent = t('indispo.texte');
    if (type === 'connexion') { var b = d.querySelector('button'); b.textContent = t('etat.reessayer'); b.addEventListener('click', function () { location.reload(); }); }
    document.body.appendChild(d);
    document.body.style.overflow = 'hidden';
    document.title = titre;
    document.querySelectorAll('.chat-fab, #mv-appel-btn, #cart-pill').forEach(function (e) { e.style.display = 'none'; });
  }
  window.mvEtat = _etat;

  function _plusTard(fn) {
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : setTimeout(fn, 0);
  }
  function _fire() { window.dispatchEvent(new CustomEvent('menuApiReady', { detail: window.menuAPI })); }
})();
