/* menu-api.js — MenuVision multi-tenant data loader */
(function () {
  var RAILWAY    = 'https://menuvision-production.up.railway.app';
  // Restaurant de démonstration (Maison Ardent), affiché quand l'URL ne porte pas ?r=.
  // MÊME VALEUR que DEFAULT_DEMO_RESTAURANT_ID dans public/reservation.html du dépôt menuvision :
  // le menu et la réservation doivent montrer la même démonstration.
  var DEFAULT_DEMO_RESTAURANT_ID = '7917c5f4-3d21-4e3d-bc69-8d87df617865';
  var TTL        = 60 * 1000;   // cache de 60 secondes : une carte modifiée apparaît vite sur les téléphones

  var params = new URLSearchParams(location.search);
  // Le restaurant vient uniquement de l'URL (?r=, posé par le QR code). Sans ?r=, c'est la démonstration.
  // Les liens internes sont réécrits pour porter ?r= (voir _enseigne et les pages de catégorie).
  var rid = params.get('r') || DEFAULT_DEMO_RESTAURANT_ID;
  var estDefaut = rid === DEFAULT_DEMO_RESTAURANT_ID;
  try { sessionStorage.removeItem('mv_rid_onglet'); } catch (_) {}   // ancienne mémoire d'onglet, abandonnée
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

  // Une entrée de cache par restaurant, jamais de clé globale.
  var ck = 'menuvision:' + rid;
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
    // La démonstration garde son habillage et son enseigne « Maison Ardent » d'origine.
    if (!t || estDefaut) return;
    var r = document.documentElement;
    if (t.couleur_principale) {
      r.style.setProperty('--terre',    t.couleur_principale);
      r.style.setProperty('--terre-dk', _dk(t.couleur_principale));
    }
    if (t.couleur_accent) r.style.setProperty('--warm-mid', t.couleur_accent);
    if (t.police)         _font(t.police);
    if (t.nom)            document.querySelectorAll('.header-brand').forEach(function (e) { e.textContent = t.nom; });
    // Tout de suite pour ce qui est déjà dans la page (le script est en fin de body),
    // puis à la fin du chargement pour le reste.
    if (!estDefaut) { if (document.body) _enseigne(t.nom); _schedule(function () { _enseigne(t.nom); }); }
  }

  // Remplace l'enseigne codée en dur (restaurant par défaut) par celle du restaurant chargé.
  function _enseigne(nom) {
    var ENSEIGNE = /Maison Ardent/g;
    if (nom) {
      document.title = ENSEIGNE.test(document.title) ? document.title.replace(ENSEIGNE, nom) : nom;
      var titre = document.querySelector('.hero-title');
      if (titre && titre.textContent !== nom) titre.textContent = nom;
      // Slogan et mention d'origine propres au restaurant par défaut.
      document.querySelectorAll('.hero-label, .hero-subtitle').forEach(function (e) { e.style.display = 'none'; });
      var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), n;
      while ((n = w.nextNode())) {
        if (n.parentNode && /^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName)) continue;
        if (n.nodeValue.indexOf('Maison Ardent') >= 0) n.nodeValue = n.nodeValue.replace(ENSEIGNE, nom);
      }
      // Images et visualiseur 3D (model-viewer) : l'enseigne figure aussi dans les attributs.
      ['alt', 'aria-label', 'title'].forEach(function (a) {
        document.querySelectorAll('[' + a + '*="Maison Ardent"]').forEach(function (e) { e.setAttribute(a, e.getAttribute(a).replace(ENSEIGNE, nom)); });
      });
    }
    // Les liens internes portent le restaurant (ouverture dans un nouvel onglet, partage).
    document.querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute('href');
      // « entrees.html » en local, « /entrees » une fois réécrit par Netlify.
      if (/^\/?(index|entrees|plats|desserts|vins|success)(\.html)?(\?|$)/.test(h) && !/[?&]r=/.test(h)) a.setAttribute('href', h + (h.indexOf('?') >= 0 ? '&' : '?') + 'r=' + encodeURIComponent(rid));
    });
    document.documentElement.classList.remove('mv-attente');
    // D'autres scripts (chat, passeport) écrivent encore l'enseigne par défaut après coup :
    // on repasse à chaque modification de la page.
    if (nom && !_veille && window.MutationObserver) {
      var options = { childList: true, subtree: true, characterData: true };
      _veille = new MutationObserver(function () {
        _veille.disconnect();
        _enseigne(nom);
        _veille.observe(document.body, options);
      });
      _veille.observe(document.body, options);
    }
  }
  var _veille = null;

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
