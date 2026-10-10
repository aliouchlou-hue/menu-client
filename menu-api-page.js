/* menu-api-page.js — Integration layer: promotions, allergènes, rendu dynamique */
(function () {
  var CATS   = window.PAGE_CATS   || [];
  var IS_VIN = window.PAGE_IS_WINE || false;

  function fmt(n) {
    var num = +n;
    return (Number.isInteger(num) ? num : num.toFixed(2).replace('.', ',')) + (IS_VIN ? ' €/v' : ' €');
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function calcPromo(prix, p) {
    if (!p) return null;
    var fin;
    var label;
    if (p.prix_promo != null) {
      fin   = +p.prix_promo;
      label = '−' + Math.round(prix - p.prix_promo) + ' €';
    } else if (p.type === 'pourcent') {
      fin   = prix * (1 - p.valeur / 100);
      label = '−' + p.valeur + '%';
    } else if (p.type === 'fixe') {
      fin   = prix - p.valeur;
      label = '−' + p.valeur + ' €';
    } else {
      return null;
    }
    return { fin: fin, label: label };
  }

  function getPromo(pid) {
    return (window.menuAPI.promotions || []).find(function (p) { return String(p.plat_id) === String(pid); });
  }

  // Promotion d'un plat. Le prix final est celui que le serveur comptera (prix_promo de /plats).
  function promoDe(plat) {
    var info = calcPromo(plat.prix || 0, getPromo(plat.id || plat._id));
    if (plat.prix_promo != null && +plat.prix_promo < +plat.prix) {
      if (!info) info = { label: '−' + Math.round((1 - plat.prix_promo / plat.prix) * 100) + '%' };
      info.fin = +plat.prix_promo;
    }
    return info;
  }

  function cardHTML(plat, idx) {
    var pid  = plat.id || plat._id || ('api' + idx);
    var info = promoDe(plat);
    var priceHTML = info
      ? '<s>' + esc(fmt(plat.prix)) + '</s> <span class="promo-new">' + esc(fmt(info.fin)) + '</span>'
      : esc(fmt(plat.prix));
    var badge = info ? '<span class="promo-badge">' + esc(info.label) + '</span>' : '';
    var photo = plat.image_url || plat.photo_url;
    var img   = photo
      ? '<img src="' + esc(photo) + '" alt="' + esc(plat.nom) + '" class="dish-img" loading="' + (idx === 0 ? 'eager' : 'lazy') + '" />'
      : '';
    return '<article class="dish-card" data-id="' + esc(pid) + '">'
      + '<div class="dish-img-wrap">' + img
      + '<span class="dish-num">' + String(idx + 1).padStart(2, '0') + '</span>' + badge
      + '</div>'
      + '<div class="dish-body"><div class="dish-row">'
      + '<h2 class="dish-name">' + esc(plat.nom) + '</h2>'
      + '<span class="dish-price">' + priceHTML + '</span>'
      + '</div><p class="dish-desc">' + esc(plat.description || '') + '</p>'
      + '</div></article>';
  }

  function initFallback(card) {
    var img  = card.querySelector('.dish-img');
    if (!img) return;
    var name = (card.querySelector('.dish-name') || {}).textContent || '';
    var wrap = card.querySelector('.dish-img-wrap');
    var src  = img.getAttribute('src') || '';
    var done = false;
    function fb() {
      if (done) return; done = true;
      img.style.display = 'none';
      try { img.src = ''; } catch (_) {}
      wrap.classList.add('fallback-active');
      if (!wrap.querySelector('.img-placeholder')) {
        var p = document.createElement('p');
        p.className = 'img-placeholder'; p.textContent = name; wrap.appendChild(p);
      }
    }
    img.onerror = fb;
    if (!src) { fb(); return; }
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, 2000);
    fetch(src, { method: 'HEAD', signal: ctrl.signal })
      .then(function (r) { clearTimeout(t); if (!r.ok) fb(); })
      .catch(function ()  { clearTimeout(t); fb(); });
  }

  function run() {
    var api = window.menuAPI;
    if (!api) return;

    var pagePlats = api.plats.filter(function (p) {
      return CATS.indexOf((p.categorie || p.category || '').toLowerCase()) >= 0;
    });

    // La démonstration garde ses plats et ses photos d'origine ; les données du serveur
    // ne servent alors qu'à compléter (allergènes, promotions) dans la dernière branche.
    if (pagePlats.length > 0 && !api.estDefaut) {
      // Rebuild dishes from API data
      var d = window.dishes;
      if (d) Object.keys(d).forEach(function (k) { delete d[k]; });
      pagePlats.forEach(function (p) {
        var pid  = p.id || p._id;
        var info = promoDe(p);
        if (d) d[pid] = {
          name:     p.nom,
          price:    fmt(info ? info.fin : p.prix),
          img:      p.image_url || p.photo_url || '',
          fb:       '',
          desc:     p.description_longue || p.description || '',
          allergens: p.allergenes || p.accords || [],
          wineType: p.type_vin || p.wineType || '',
          model:    p.modele_3d_url || ''
        };
      });

      // Replace DOM dish cards
      document.querySelectorAll('.dish-card, .card-sep').forEach(function (el) { el.remove(); });
      var orn = document.querySelector('.section-ornament');
      orn.insertAdjacentHTML('afterend', pagePlats.map(cardHTML).join(''));

      // Attach click listeners and image fallbacks on new cards
      document.querySelectorAll('.dish-card').forEach(function (card) {
        card.addEventListener('click', function () { if (window.openModal) window.openModal(card.dataset.id); });
        initFallback(card);
      });

    } else if (!api.estDefaut) {
      // Autre restaurant sans plat dans cette catégorie : les plats codés en dur sont
      // ceux du restaurant par défaut, on les retire au lieu de les lui attribuer.
      var dv = window.dishes;
      if (dv) Object.keys(dv).forEach(function (k) { delete dv[k]; });
      document.querySelectorAll('.dish-card, .card-sep').forEach(function (el) { el.remove(); });
      var ornVide = document.querySelector('.section-ornament');
      if (ornVide && !document.querySelector('.carte-vide')) {
        ornVide.insertAdjacentHTML('afterend', '<p class="carte-vide" style="text-align:center;opacity:.6;padding:56px 24px;font-style:italic;">Cette partie de la carte arrive bientôt.</p>');
      }
    } else {
      // API returned no data for this category — augment existing hardcoded dishes

      // Update allergens / descriptions from API where name matches
      api.plats.forEach(function (p) {
        var d = window.dishes;
        if (!d) return;
        Object.values(d).forEach(function (entry) {
          if ((entry.name || '').toLowerCase() === (p.nom || '').toLowerCase()) {
            if (p.allergenes && p.allergenes.length) entry.allergens = p.allergenes;
            if (p.description_longue) entry.desc = p.description_longue;
          }
        });
      });

      // Apply promo badges by matching plat_id → nom → DOM card
      api.promotions.forEach(function (pr) {
        var plat = api.plats.find(function (p) { return String(p.id || p._id) === String(pr.plat_id); });
        if (!plat) return;
        var info = promoDe(plat);
        if (!info) return;
        document.querySelectorAll('.dish-card').forEach(function (card) {
          var ne = card.querySelector('.dish-name');
          if (!ne || ne.textContent.trim().toLowerCase() !== (plat.nom || '').toLowerCase()) return;
          // Badge
          var wrap = card.querySelector('.dish-img-wrap');
          if (wrap && !wrap.querySelector('.promo-badge')) {
            var b = document.createElement('span');
            b.className = 'promo-badge'; b.textContent = info.label; wrap.appendChild(b);
          }
          // Price
          var pe = card.querySelector('.dish-price');
          if (pe) pe.innerHTML = '<s>' + esc(fmt(plat.prix)) + '</s> <span class="promo-new">' + esc(fmt(info.fin)) + '</span>';
          // Update dishes object
          var key = card.dataset.id;
          if (window.dishes && window.dishes[key]) window.dishes[key].price = fmt(info.fin);
        });
      });
    }

    // Expose live context for chat. On préserve un éventuel passeport déjà
    // injecté par passport.js (l'ordre de résolution des deux est indéterminé).
    var _prevPassport = window._menuApiContext && window._menuApiContext.passport;
    window._menuApiContext = {
      promotions: api.promotions,
      allergenes: api.plats.reduce(function (acc, p) {
        if (p.allergenes && p.allergenes.length) acc[p.nom] = p.allergenes;
        return acc;
      }, {})
    };
    // Autre restaurant que la démonstration : le conseiller reçoit son nom et sa carte.
    if (!api.estDefaut) {
      window._menuApiContext.restaurant = { nom: (api.theme && api.theme.nom) || '' };
      window._menuApiContext.carte = api.plats.slice(0, 200).map(function (p) {
        return { nom: p.nom, prix: p.prix, categorie: p.categorie, description: p.description || '' };
      });
    }
    if (_prevPassport) window._menuApiContext.passport = _prevPassport;
  }

  // ── Fiche plat : modèle 3D ────────────────────────────────────────────────
  // Le bouton « Voir sur ma table en 3D » n'apparaît que si le restaurant a un modèle pour CE plat.
  // La démonstration garde son modèle générique, étiqueté « exemple ».
  var MODELE_EXEMPLE = null, ECHELLE_EXEMPLE = null;
  function majModele(plat) {
    var btn = document.getElementById('btnAr'), wrap = document.getElementById('arWrap'), mv = document.getElementById('mvEl');
    if (!btn || !wrap || !mv) return;
    if (MODELE_EXEMPLE === null) { MODELE_EXEMPLE = mv.getAttribute('src') || ''; ECHELLE_EXEMPLE = mv.getAttribute('scale'); }
    var etiquette = document.getElementById('arExemple');
    if (!etiquette) {
      etiquette = document.createElement('p'); etiquette.id = 'arExemple'; etiquette.className = 'ar-hint';
      etiquette.textContent = "Modèle 3D d'exemple — ce n'est pas le plat réel";
      wrap.insertBefore(etiquette, wrap.firstChild);
    }
    var demo = window.menuAPI && window.menuAPI.estDefaut;
    if (plat && plat.model) {
      if (mv.getAttribute('src') !== plat.model) mv.setAttribute('src', plat.model);
      mv.removeAttribute('scale');            // l'échelle fixe ne vaut que pour le modèle d'exemple
      etiquette.style.display = 'none'; btn.style.display = 'flex';
    } else if (demo) {
      if (mv.getAttribute('src') !== MODELE_EXEMPLE) mv.setAttribute('src', MODELE_EXEMPLE);
      if (ECHELLE_EXEMPLE) mv.setAttribute('scale', ECHELLE_EXEMPLE);
      etiquette.style.display = ''; btn.style.display = 'flex';
    } else {
      btn.style.display = 'none'; wrap.style.display = 'none';
    }
  }

  // ── Avis : bloc réutilisable (fiche plat, confirmation de commande en cuisine) ──
  function styleAvis() {
    if (document.getElementById('mv-avis-css')) return;
    var st = document.createElement('style'); st.id = 'mv-avis-css';
    st.textContent = '.mv-avis{margin:14px 0 4px;padding-top:12px;border-top:1px solid rgba(139,74,47,.18);text-align:center}'
      + '.mv-avis-q{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;opacity:.75;margin-bottom:6px}'
      + '.mv-avis-etoiles button{background:none;border:none;font-size:1.5rem;line-height:1;color:#CDBFB0;cursor:pointer;padding:2px 3px}'
      + '.mv-avis-etoiles button.on{color:var(--terre,#8B4A2F)}'
      + '.mv-avis textarea{display:none;width:100%;margin-top:8px;padding:9px 10px;border:1px solid rgba(139,74,47,.3);border-radius:2px;font:inherit;font-size:.85rem;resize:vertical;min-height:54px;background:transparent;color:inherit}'
      + '.mv-avis.note textarea,.mv-avis.note .mv-avis-envoyer{display:block}'
      + '.mv-avis-envoyer{display:none;margin:8px auto 0;padding:9px 18px;background:var(--terre,#8B4A2F);color:#fff;border:none;border-radius:2px;font:inherit;font-size:.68rem;letter-spacing:.16em;text-transform:uppercase;cursor:pointer}'
      + '.mv-avis-msg{font-size:.82rem;font-style:italic;margin-top:6px;min-height:1em}';
    document.head.appendChild(st);
  }
  // Le restaurant reçoit-il les avis ? (formule avec « Avis clients », annoncée par /theme)
  function avisActifs() {
    try { return window.menuAPI.theme.fonctions.avis === true; } catch (_) { return false; }
  }
  function blocAvis(platNom) {
    styleAvis();
    var el = document.createElement('div'); el.className = 'mv-avis'; var note = 0, envoye = false;
    el.innerHTML = '<p class="mv-avis-q"></p><div class="mv-avis-etoiles">'
      + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-n="' + n + '" aria-label="' + n + ' sur 5">★</button>'; }).join('')
      + '</div><textarea maxlength="300" placeholder="Un commentaire ? (facultatif)"></textarea>'
      + '<button type="button" class="mv-avis-envoyer">Envoyer mon avis</button><p class="mv-avis-msg" role="status"></p>';
    el.querySelector('.mv-avis-q').textContent = 'Votre avis sur « ' + platNom + ' »';
    var etoiles = el.querySelectorAll('.mv-avis-etoiles button'), msg = el.querySelector('.mv-avis-msg'), btn = el.querySelector('.mv-avis-envoyer');
    etoiles.forEach(function (b) {
      b.addEventListener('click', function () {
        if (envoye) return;
        note = +b.dataset.n; el.classList.add('note');
        etoiles.forEach(function (x) { x.classList.toggle('on', +x.dataset.n <= note); });
      });
    });
    btn.addEventListener('click', function () {
      if (envoye || !note) return;
      btn.disabled = true; msg.textContent = 'Envoi…';
      fetch('https://menuvision-production.up.railway.app/avis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: window.menuAPI.restaurantId, plat_nom: platNom, note: note, commentaire: el.querySelector('textarea').value.trim() })
      }).then(function (r) { return r.json().then(function (j) { return r.ok && j.ok; }); })
        .then(function (ok) {
          if (!ok) throw new Error('refus');
          envoye = true; msg.textContent = 'Merci, votre avis a bien été transmis au restaurant.';
          btn.style.display = 'none'; el.querySelector('textarea').disabled = true;
        })
        .catch(function () { btn.disabled = false; msg.textContent = "L'avis n'a pas pu être envoyé. Réessayez dans un instant."; });
    });
    return el;
  }
  window.mvAvis = { actifs: avisActifs, bloc: blocAvis };

  // À chaque ouverture de la fiche plat : bon modèle 3D, bloc d'avis pour ce plat.
  function surOuvertureFiche() {
    var nomEl = document.getElementById('modalName'); if (!nomEl) return;
    var nom = nomEl.textContent.trim();
    var plat = null, d = window.dishes || {};
    Object.keys(d).forEach(function (k) { if (!plat && (d[k].name || '').trim() === nom) plat = d[k]; });
    majModele(plat);
    var ancien = document.querySelector('.modal-sheet .mv-avis, .modal-overlay .mv-avis'); if (ancien) ancien.remove();
    var ajouter = document.getElementById('btnAdd');
    if (nom && ajouter && avisActifs()) ajouter.parentNode.insertBefore(blocAvis(nom), ajouter.nextSibling);
  }
  (function () {
    var overlay = document.querySelector('.modal-overlay'); if (!overlay || !window.MutationObserver) return;
    var ouverte = overlay.classList.contains('open');
    new MutationObserver(function () {
      var o = overlay.classList.contains('open');
      if (o && !ouverte) surOuvertureFiche();
      ouverte = o;
    }).observe(overlay, { attributes: true, attributeFilter: ['class'] });
    if (ouverte) surOuvertureFiche();
  })();

  if (window.menuAPI && window.menuAPI.ready) { run(); }
  else { window.addEventListener('menuApiReady', run, { once: true }); }
})();
