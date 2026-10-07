/* menu-api.js — MenuVision multi-tenant data loader */
(function () {
  var RAILWAY    = 'https://menuvision-production.up.railway.app';
  var DEFAULT_ID = '156dbae3-12f9-45f0-ad72-aa6966916d7c';
  var TTL        = 5 * 60 * 1000;

  var params = new URLSearchParams(location.search);
  // Le restaurant vient du QR code (?r=). Les liens internes ne le portent pas :
  // on le garde pour l'onglet, sinon la page suivante retomberait sur le restaurant par défaut.
  var ridOnglet = null;
  try { ridOnglet = sessionStorage.getItem('mv_rid_onglet'); } catch (_) {}
  var rid = params.get('r') || ridOnglet || DEFAULT_ID;
  var estDefaut = rid === DEFAULT_ID;
  try { if (params.get('r')) sessionStorage.setItem('mv_rid_onglet', rid); } catch (_) {}
  // Tant que le thème d'un autre restaurant n'est pas chargé, on masque l'enseigne
  // codée en dur plutôt que d'afficher brièvement celle du restaurant par défaut.
  if (!estDefaut) {
    var st = document.createElement('style');
    st.textContent = 'html.mv-attente .hero-label,html.mv-attente .hero-title,html.mv-attente .hero-subtitle,html.mv-attente .header-brand,html.mv-attente .chat-title{visibility:hidden}';
    document.head.appendChild(st);
    document.documentElement.classList.add('mv-attente');
    setTimeout(function () { document.documentElement.classList.remove('mv-attente'); }, 6000);
  }
  // Persiste le restaurant courant pour les pages sans ?r= (success.html, paiement)
  try { localStorage.setItem('mv_rid', rid); } catch (_) {}

  window.menuAPI = { restaurantId: rid, estDefaut: estDefaut, plats: [], promotions: [], theme: {}, ready: false };

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
    if (r[1] && r[1].ok) window.menuAPI.promotions = _flattenPromos(r[1].promotions);
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
  }).catch(function () { window.menuAPI.ready = true; if (!estDefaut) _schedule(function () { _enseigne(''); }); _fire(); });

  // Le backend renvoie chaque promo avec un tableau plats[{id,nom,prix,prix_promo}].
  // Le menu attend une liste plate par plat : {plat_id, prix_promo}. On aplatit.
  function _flattenPromos(promos) {
    var out = [];
    (promos || []).forEach(function (promo) {
      (promo.plats || []).forEach(function (pl) {
        if (pl && pl.id != null && pl.prix_promo != null) {
          out.push({ plat_id: pl.id, nom: pl.nom, prix: pl.prix, prix_promo: pl.prix_promo });
        }
      });
    });
    return out;
  }

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
    if (!estDefaut) _schedule(function () { _enseigne(t.nom); });
  }

  // Remplace l'enseigne codée en dur (restaurant par défaut) par celle du restaurant chargé.
  function _enseigne(nom) {
    var ENSEIGNE = /Maison Ardent/g;
    if (nom) {
      document.title = ENSEIGNE.test(document.title) ? document.title.replace(ENSEIGNE, nom) : nom;
      var titre = document.querySelector('.hero-title');
      if (titre) titre.textContent = nom;
      // Slogan et mention d'origine propres au restaurant par défaut.
      document.querySelectorAll('.hero-label, .hero-subtitle').forEach(function (e) { e.style.display = 'none'; });
      var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), n;
      while ((n = w.nextNode())) {
        if (n.parentNode && /^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName)) continue;
        if (n.nodeValue.indexOf('Maison Ardent') >= 0) n.nodeValue = n.nodeValue.replace(ENSEIGNE, nom);
      }
      document.querySelectorAll('img[alt*="Maison Ardent"]').forEach(function (e) { e.alt = e.alt.replace(ENSEIGNE, nom); });
    }
    // Les liens internes portent le restaurant (ouverture dans un nouvel onglet, partage).
    document.querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute('href');
      // « entrees.html » en local, « /entrees » une fois réécrit par Netlify.
      if (/^\/?(index|entrees|plats|desserts|vins|success)(\.html)?(\?|$)/.test(h) && !/[?&]r=/.test(h)) a.setAttribute('href', h + (h.indexOf('?') >= 0 ? '&' : '?') + 'r=' + encodeURIComponent(rid));
    });
    document.documentElement.classList.remove('mv-attente');
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
