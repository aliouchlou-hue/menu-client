/* menu-api-page.js — Integration layer: promotions, allergènes, rendu dynamique */
(function () {
  var RAILWAY = 'https://menuvision-production.up.railway.app';
  var CATS   = window.PAGE_CATS   || [];
  var IS_VIN = window.PAGE_IS_WINE || false;
  var I = window.MVI18n, t = I.t;

  // Prix dans la langue du client ; un vin est affiché au verre.
  function fmt(n) { return I.prix(n) + (IS_VIN ? '/' + t('unite.verre') : ''); }
  // Nom et description affichés d'un plat de la carte (traduction du serveur quand elle existe).
  function nomDe(plat) { return plat.nom_traduit || plat.nom; }
  function descDe(plat) { return plat.description_traduite || plat.description_longue || plat.description || ''; }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function calcPromo(prix, p) {
    if (!p) return null;
    var fin;
    var label;
    if (p.prix_promo != null) {
      fin   = +p.prix_promo;
      label = '−' + I.prix(Math.round(prix - p.prix_promo));
    } else if (p.type === 'pourcent') {
      fin   = prix * (1 - p.valeur / 100);
      label = '−' + p.valeur + '%';
    } else if (p.type === 'fixe') {
      fin   = prix - p.valeur;
      label = '−' + I.prix(p.valeur);
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
      ? '<img src="' + esc(photo) + '" alt="' + esc(nomDe(plat)) + '" class="dish-img" loading="' + (idx === 0 ? 'eager' : 'lazy') + '" />'
      : '';
    return '<article class="dish-card" data-id="' + esc(pid) + '">'
      + '<div class="dish-img-wrap">' + img
      + '<span class="dish-num">' + String(idx + 1).padStart(2, '0') + '</span>' + badge
      + '</div>'
      + '<div class="dish-body"><div class="dish-row">'
      + '<h2 class="dish-name">' + esc(nomDe(plat)) + '</h2>'
      + '<span class="dish-price">' + priceHTML + '</span>'
      + '</div><p class="dish-desc">' + esc(plat.description_traduite || plat.description || '') + '</p>'
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
          name:     p.nom,          // nom d'origine : c'est lui que le panier envoie au serveur
          label:    nomDe(p),       // nom affiché
          price:    fmt(info ? info.fin : p.prix),
          img:      p.image_url || p.photo_url || '',
          fb:       '',
          desc:     descDe(p),
          allergens: IS_VIN ? (p.accords || []) : (p.allergenes || []),   // page des vins : ce bloc porte les accords
          all:      allergenesDe(p),
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
        ornVide.insertAdjacentHTML('afterend', '<p class="carte-vide" style="text-align:center;opacity:.6;padding:56px 24px;font-style:italic;">' + esc(t('carte.vide')) + '</p>');
      }
    } else {
      // Démonstration : ses plats sont dans la page ; le serveur les complète et les traduit.
      traduireDemo();

      // Allergènes : ce que le restaurant a renseigné sur le serveur l'emporte ; à défaut, la
      // liste écrite dans la page de démonstration, présentée comme « à confirmer ».
      var dd = window.dishes || {};
      Object.keys(dd).forEach(function (k) {
        var entry = dd[k];
        var p = api.plats.filter(function (x) { return (x.nom || '').toLowerCase() === (entry.name || '').toLowerCase(); })[0];
        if (p && p.description_longue) entry.desc = p.description_longue;
        if (p && p.allergenes_statut && p.allergenes_statut !== 'non_renseigne') { entry.all = allergenesDe(p); if (!IS_VIN) entry.allergens = p.allergenes || []; }
        else if (!entry.all) entry.all = allergenesDePage(IS_VIN ? [] : entry.allergens);
      });

      // Apply promo badges by matching plat_id → nom → DOM card
      api.promotions.forEach(function (pr) {
        var plat = api.plats.find(function (p) { return String(p.id || p._id) === String(pr.plat_id); });
        if (!plat) return;
        var info = promoDe(plat);
        if (!info) return;
        document.querySelectorAll('.dish-card').forEach(function (card) {
          var ne = card.querySelector('.dish-name');
          if (!ne || (card.dataset.nom || ne.textContent).trim().toLowerCase() !== (plat.nom || '').toLowerCase()) return;
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
    // Noms affichés au client dans sa langue : le conseiller cite les plats sous ces noms.
    var noms = {};
    api.plats.forEach(function (p) { if (p.nom_traduit && p.nom_traduit !== p.nom) noms[p.nom] = p.nom_traduit; });
    window._menuApiContext = {
      langue: I.lang,
      noms: noms,
      promotions: api.promotions,
      // Démonstration : allergènes déclarés des plats de cette page, sous leur nom affiché.
      fiches: {}
    };
    var dc = window.dishes || {};
    if (api.estDefaut) Object.keys(dc).forEach(function (k) {
      var a = dc[k].all;
      if (a && a.statut !== 'non_renseigne') window._menuApiContext.fiches[dc[k].label || dc[k].name] = { statut: a.statut, allergenes: a.cles, autres: a.autres, regimes: a.regimes };
    });
    // Autre restaurant que la démonstration : le conseiller reçoit son nom et sa carte.
    if (!api.estDefaut) {
      window._menuApiContext.restaurant = { nom: (api.theme && api.theme.nom) || '' };
      window._menuApiContext.carte = api.plats.slice(0, 200).map(function (p) {
        // Allergènes : ce que le restaurateur a renseigné, avec son statut (jamais de suggestion non validée).
        var a = allergenesDe(p);
        return { nom: nomDe(p), prix: p.prix, categorie: p.categorie, description: p.description_traduite || p.description || '', allergenes: a.cles, autres: a.autres, statut: a.statut, regimes: a.regimes };
      });
    }
    if (_prevPassport) window._menuApiContext.passport = _prevPassport;
    barreFiltre(); appliquerFiltre();
    if (avisActifs()) afficherAvisRestaurant();
  }

  // ── Démonstration : cartes codées dans la page, mises dans la langue du client ──
  // Le nom d'origine de chaque carte est gardé (data-nom) : c'est la clé des traductions, et le
  // nom que le panier envoie au serveur.
  function traduireDemo() {
    var d = window.dishes || {};
    document.querySelectorAll('.dish-card').forEach(function (card) {
      var nomEl = card.querySelector('.dish-name'), descEl = card.querySelector('.dish-desc');
      var prixEl = card.querySelector('.dish-price'), typeEl = card.querySelector('.wine-type'), img = card.querySelector('.dish-img');
      if (!nomEl) return;
      if (card.dataset.nom === undefined) {
        card.dataset.nom = nomEl.textContent.trim();
        if (descEl) card.dataset.desc = descEl.textContent;
        if (prixEl && !prixEl.querySelector('s')) card.dataset.prix = prixEl.textContent;
        if (typeEl) card.dataset.type = typeEl.textContent;
      }
      var tr = I.plat(card.dataset.nom), entree = d[card.dataset.id];
      nomEl.textContent = tr.nom;
      if (img) img.alt = tr.nom;
      var repli = card.querySelector('.img-placeholder'); if (repli) repli.textContent = tr.nom;
      if (descEl) descEl.textContent = (tr.traduit && tr.description) || card.dataset.desc || '';
      if (prixEl && card.dataset.prix && !prixEl.querySelector('s')) prixEl.textContent = I.unites(card.dataset.prix);
      if (typeEl) typeEl.textContent = I.libelle(card.dataset.type);
      if (entree) {
        entree.label = tr.nom;
        // Fiche : description traduite par le serveur ; en français, le texte long de la page.
        entree.descT = (tr.traduit && tr.description) || undefined;
      }
    });
  }

  // ── Allergènes ────────────────────────────────────────────────────────────
  // Chaque plat porte { statut, cles, autres, regimes } :
  //   statut  'renseigne'     le restaurateur a déclaré la liste (vide = aucun des 14 allergènes)
  //           'a_verifier'    liste connue mais peut-être incomplète (ancienne saisie, démonstration)
  //           'non_renseigne' rien n'est déclaré : on ne présume jamais « aucun »
  //   cles    clés de la liste des 14 ; autres : valeurs hors liste (« fruits de mer », texte libre)
  function allergenesDe(p) {
    var cles = [], autres = [];
    (p.allergenes || []).forEach(function (a) { var k = I.cleAllergene(a); if (k && k !== 'fruits_mer') { if (cles.indexOf(k) < 0) cles.push(k); } else autres.push(k || a); });
    (p.allergenes_a_preciser || []).forEach(function (a) { autres.push(a); });
    var statut = p.allergenes_statut;
    // Serveur d'avant la liste des 14 (pas de statut) : une liste non vide reste « à confirmer ».
    if (['renseigne', 'a_verifier', 'non_renseigne'].indexOf(statut) < 0) statut = (cles.length || autres.length) ? 'a_verifier' : 'non_renseigne';
    return { statut: statut, cles: cles, autres: autres, regimes: p.regimes || [] };
  }
  // Liste écrite dans une page de démonstration : jamais présentée comme complète.
  function allergenesDePage(liste) {
    var a = allergenesDe({ allergenes: liste || [] });
    return a;
  }
  // Le plat contient-il un des allergènes choisis ? Rend leurs clés. « Fruits de mer » vaut crustacés ou mollusques.
  function contient(all, choisis) {
    if (!all || !choisis || !choisis.length) return [];
    var fruitsMer = all.autres.some(function (a) { return I.cleAllergene(a) === 'fruits_mer'; });
    return choisis.filter(function (k) { return all.cles.indexOf(k) >= 0 || (fruitsMer && (k === 'crustaces' || k === 'mollusques')); });
  }

  function styleAllergenes() {
    if (document.getElementById('mv-all-css')) return;
    var st = document.createElement('style'); st.id = 'mv-all-css';
    st.textContent = '.mv-all{margin-bottom:26px}'
      + '.mv-all .allergens-list{margin-bottom:10px}'
      + '.mv-all .allergen-pill.alerte{background:var(--terre,#8B4A2F);border-color:var(--terre,#8B4A2F);color:#fff}'
      + '.mv-all .allergen-pill.regime{background:transparent;border-style:dashed}'
      + '.mv-all-texte{font-size:.84rem;line-height:1.5;color:var(--text,#2C1F14);margin:0 0 8px}'
      + '.mv-all-note{font-size:.68rem;line-height:1.5;letter-spacing:.02em;color:var(--text-soft,#6B5244);font-style:italic;margin:0}'
      + '.mv-all-note + .mv-all-note{margin-top:2px}'
      + '.mv-filtre-barre{display:flex;flex-direction:column;align-items:center;gap:8px;margin:22px auto 0;padding:0 24px;text-align:center}'
      + '.mv-filtre-btn{display:inline-flex;align-items:center;gap:8px;padding:9px 16px;background:transparent;border:1px solid var(--sep,#D4C4B0);border-radius:30px;cursor:pointer;font-family:"Montserrat",sans-serif;font-size:.64rem;letter-spacing:.14em;text-transform:uppercase;color:var(--text-soft,#6B5244);-webkit-tap-highlight-color:transparent}'
      + '.mv-filtre-btn.actif{border-color:var(--terre,#8B4A2F);color:var(--terre,#8B4A2F)}'
      + '.mv-filtre-btn .n{display:inline-block;min-width:18px;padding:1px 5px;border-radius:10px;background:var(--terre,#8B4A2F);color:#fff;font-size:.62rem;letter-spacing:0}'
      + '.mv-filtre-resume{font-family:"Montserrat",sans-serif;font-size:.7rem;line-height:1.5;color:var(--text-soft,#6B5244)}'
      + '.dish-card.mv-f-masque{display:none}'
      + '.dish-card.mv-f-signale .dish-img-wrap{opacity:.45;filter:grayscale(.6)}'
      + '.mv-f-badge{display:block;margin:10px 0 0;padding:7px 11px;border-left:3px solid var(--terre,#8B4A2F);background:rgba(139,74,47,.08);font-family:"Montserrat",sans-serif;font-size:.7rem;line-height:1.45;color:var(--text,#2C1F14)}'
      + '.mv-f-badge.inconnu{border-left-color:var(--warm-mid,#C4A882);background:rgba(196,168,130,.14);color:var(--text-soft,#6B5244)}'
      + '.mv-f-voile{position:fixed;inset:0;z-index:400;background:rgba(20,12,6,.5);display:flex;align-items:flex-end;justify-content:center}'
      + '.mv-f-feuille{width:100%;max-width:520px;max-height:88vh;overflow:auto;background:var(--creme,#F5F0E8);border-radius:16px 16px 0 0;padding:22px 22px calc(22px + env(safe-area-inset-bottom,0px));font-family:"Montserrat",sans-serif;color:var(--text,#2C1F14)}'
      + '.mv-f-feuille h3{font-family:"Cormorant Garamond",serif;font-weight:400;font-size:1.5rem;margin:0 0 8px}'
      + '.mv-f-feuille p{font-size:.78rem;line-height:1.6;color:var(--text-soft,#6B5244);margin:0 0 16px}'
      + '.mv-f-puces{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}'
      + '.mv-f-puce{padding:8px 13px;background:transparent;border:1px solid var(--sep,#D4C4B0);border-radius:20px;cursor:pointer;font:inherit;font-size:.78rem;color:var(--text,#2C1F14)}'
      + '.mv-f-puce[aria-pressed="true"]{background:var(--terre,#8B4A2F);border-color:var(--terre,#8B4A2F);color:#fff}'
      + '.mv-f-modes{display:flex;gap:8px;margin-bottom:18px}'
      + '.mv-f-modes button{flex:1;padding:10px 8px;background:transparent;border:1px solid var(--sep,#D4C4B0);cursor:pointer;font:inherit;font-size:.72rem;color:var(--text-soft,#6B5244)}'
      + '.mv-f-modes button[aria-pressed="true"]{border-color:var(--terre,#8B4A2F);color:var(--terre,#8B4A2F);font-weight:500}'
      + '.mv-f-actions{display:flex;gap:10px}'
      + '.mv-f-actions button{flex:1;padding:14px;border:1px solid var(--terre,#8B4A2F);cursor:pointer;font:inherit;font-size:.68rem;letter-spacing:.2em;text-transform:uppercase}'
      + '.mv-f-effacer{background:transparent;color:var(--terre,#8B4A2F)}'
      + '.mv-f-appliquer{background:var(--terre,#8B4A2F);color:#fff}';
    document.head.appendChild(st);
  }

  // Fiche d'un plat : allergènes déclarés, « aucun », ou « non renseignés ». Le bloc d'origine de
  // la page ne reste que sur la page des vins, où il porte les accords.
  function rendreAllergenesFiche(plat) {
    var liste = document.getElementById('modalAllergens'); if (!liste) return;
    var titre = liste.previousElementSibling && liste.previousElementSibling.classList.contains('allergens-label') ? liste.previousElementSibling : null;
    var ancien = document.getElementById('mvAllFiche'); if (ancien) ancien.remove();
    var garder = IS_VIN && liste.children.length > 0;
    liste.style.display = garder ? '' : 'none';
    if (titre) titre.style.display = garder ? '' : 'none';
    if (!plat) return;
    styleAllergenes();
    var all = plat.all || { statut: 'non_renseigne', cles: [], autres: [], regimes: [] };
    var choisis = filtre().cles, touches = contient(all, choisis);
    var bloc = document.createElement('div'); bloc.className = 'mv-all'; bloc.id = 'mvAllFiche'; bloc.dataset.statut = all.statut;
    function ligne(classe, texte) { var p = document.createElement('p'); p.className = classe; p.textContent = texte; bloc.appendChild(p); return p; }
    function pilules(valeurs, classe) {
      var l = document.createElement('div'); l.className = 'allergens-list';
      valeurs.forEach(function (a) {
        var s = document.createElement('span'); s.className = 'allergen-pill' + (classe ? ' ' + classe : ''); s.textContent = I.allergene(a);
        var k = I.cleAllergene(a);
        if (!classe && (touches.indexOf(k) >= 0 || (k === 'fruits_mer' && touches.length))) s.className += ' alerte';
        l.appendChild(s);
      });
      bloc.appendChild(l);
    }
    ligne('allergens-label', t('fiche.allergenes'));
    if (all.statut === 'non_renseigne') {
      // Rien n'est déclaré : on le dit, on ne laisse jamais un bloc vide qui se lirait « aucun ».
      ligne('mv-all-texte', t('all.non'));
    } else {
      var valeurs = all.cles.concat(all.autres);
      if (valeurs.length) pilules(valeurs); else ligne('mv-all-texte', t('all.aucun'));
      if (all.statut === 'a_verifier') ligne('mv-all-note', t('all.verifier'));
      ligne('mv-all-note', t('all.source'));
    }
    if (all.regimes.length) { ligne('allergens-label', t('all.regimes')).style.marginTop = '16px'; pilules(all.regimes, 'regime'); }
    liste.parentNode.insertBefore(bloc, garder ? liste.nextSibling : liste);
  }

  // ── Filtre du client : allergènes à éviter, plats signalés ou masqués ──
  // Le choix est gardé sur l'appareil et vaut pour toutes les pages de la carte.
  var CLE_FILTRE = 'mv_filtre_allergenes';
  function filtre() {
    try {
      var f = JSON.parse(localStorage.getItem(CLE_FILTRE) || 'null');
      if (f && Array.isArray(f.cles)) return { cles: f.cles.filter(function (k) { return I.ALLERGENES_14.indexOf(k) >= 0; }), mode: f.mode === 'masquer' ? 'masquer' : 'signaler' };
    } catch (_) {}
    return { cles: [], mode: 'signaler' };
  }
  function garderFiltre(f) { try { localStorage.setItem(CLE_FILTRE, JSON.stringify(f)); } catch (_) {} }

  function appliquerFiltre() {
    var f = filtre(), d = window.dishes || {}, masques = 0;
    styleAllergenes();
    document.querySelectorAll('.dish-card').forEach(function (card) {
      var entree = d[card.dataset.id], all = entree && entree.all;
      var ancien = card.querySelector('.mv-f-badge'); if (ancien) ancien.remove();
      card.classList.remove('mv-f-masque', 'mv-f-signale');
      if (!f.cles.length || !all) return;
      var touches = contient(all, f.cles), texte = null, inconnu = false;
      if (touches.length) {
        if (f.mode === 'masquer') { card.classList.add('mv-f-masque'); masques++; return; }
        card.classList.add('mv-f-signale');
        texte = t('filtre.contient', { liste: touches.map(I.allergene).join(', ') });
      } else if (all.statut !== 'renseigne') {
        // Sans déclaration complète, le plat n'est jamais présenté comme convenant : il reste affiché, signalé.
        inconnu = true;
        texte = all.statut === 'a_verifier' ? t('all.verifier') : t('filtre.inconnu');
      }
      if (!texte) return;
      var b = document.createElement('span'); b.className = 'mv-f-badge' + (inconnu ? ' inconnu' : ''); b.textContent = texte;
      (card.querySelector('.dish-body') || card).appendChild(b);
    });
    var barre = document.querySelector('.mv-filtre-barre');
    if (barre) {
      var btn = barre.querySelector('.mv-filtre-btn'), resume = barre.querySelector('.mv-filtre-resume');
      btn.classList.toggle('actif', f.cles.length > 0);
      btn.querySelector('.n').textContent = f.cles.length || '';
      btn.querySelector('.n').style.display = f.cles.length ? '' : 'none';
      resume.textContent = !f.cles.length ? '' : f.cles.map(I.allergene).join(', ') + (masques ? ' — ' + I.t2('filtre.masques', masques) : '');
    }
  }

  function ouvrirFiltre() {
    var f = filtre(), choisis = f.cles.slice(), mode = f.mode;
    var voile = document.createElement('div'); voile.className = 'mv-f-voile';
    voile.innerHTML = '<div class="mv-f-feuille" role="dialog" aria-modal="true"><h3></h3><p class="mv-f-intro"></p><div class="mv-f-puces"></div><div class="mv-f-modes"></div><p class="mv-f-note"></p><div class="mv-f-actions"><button type="button" class="mv-f-effacer"></button><button type="button" class="mv-f-appliquer"></button></div></div>';
    voile.querySelector('h3').textContent = t('filtre.titre');
    voile.querySelector('.mv-f-feuille').setAttribute('aria-label', t('filtre.titre'));
    voile.querySelector('.mv-f-intro').textContent = t('filtre.intro');
    voile.querySelector('.mv-f-note').textContent = t('filtre.note');
    voile.querySelector('.mv-f-effacer').textContent = t('filtre.effacer');
    voile.querySelector('.mv-f-appliquer').textContent = t('filtre.appliquer');
    var puces = voile.querySelector('.mv-f-puces');
    I.ALLERGENES_14.forEach(function (k) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'mv-f-puce'; b.dataset.cle = k; b.textContent = I.allergene(k);
      b.setAttribute('aria-pressed', String(choisis.indexOf(k) >= 0));
      b.addEventListener('click', function () {
        var i = choisis.indexOf(k); if (i >= 0) choisis.splice(i, 1); else choisis.push(k);
        b.setAttribute('aria-pressed', String(i < 0));
      });
      puces.appendChild(b);
    });
    var modes = voile.querySelector('.mv-f-modes');
    ['signaler', 'masquer'].forEach(function (m) {
      var b = document.createElement('button'); b.type = 'button'; b.dataset.mode = m; b.textContent = t('filtre.' + m);
      b.setAttribute('aria-pressed', String(mode === m));
      b.addEventListener('click', function () { mode = m; modes.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.mode === m)); }); });
      modes.appendChild(b);
    });
    function fermer() { voile.remove(); }
    voile.addEventListener('click', function (e) { if (e.target === voile) fermer(); });
    voile.querySelector('.mv-f-effacer').addEventListener('click', function () { garderFiltre({ cles: [], mode: mode }); fermer(); appliquerFiltre(); });
    voile.querySelector('.mv-f-appliquer').addEventListener('click', function () {
      garderFiltre({ cles: I.ALLERGENES_14.filter(function (k) { return choisis.indexOf(k) >= 0; }), mode: mode }); fermer(); appliquerFiltre();
    });
    document.body.appendChild(voile);
  }

  // Bouton « Allergènes », au-dessus des plats de chaque page de la carte.
  function barreFiltre() {
    if (document.querySelector('.mv-filtre-barre')) return;
    var orn = document.querySelector('.section-ornament'); if (!orn) return;
    styleAllergenes();
    var barre = document.createElement('div'); barre.className = 'mv-filtre-barre';
    barre.innerHTML = '<button type="button" class="mv-filtre-btn"><span class="l"></span><span class="n" style="display:none"></span></button><span class="mv-filtre-resume" role="status"></span>';
    barre.querySelector('.l').textContent = t('filtre.bouton');
    barre.querySelector('.mv-filtre-btn').addEventListener('click', ouvrirFiltre);
    orn.parentNode.insertBefore(barre, orn);
  }
  // Passeport : les allergies enregistrées du client rejoignent son filtre.
  function ajouterAuFiltre(valeurs) {
    var f = filtre(), n = f.cles.length;
    (valeurs || []).forEach(function (v) {
      var k = I.cleAllergene(v);
      (k === 'fruits_mer' ? ['crustaces', 'mollusques'] : [k]).forEach(function (c) { if (c && f.cles.indexOf(c) < 0) f.cles.push(c); });
    });
    if (f.cles.length !== n) garderFiltre(f);
    appliquerFiltre();
  }
  window.mvAllergenes = { filtre: filtre, appliquer: appliquerFiltre, ouvrir: ouvrirFiltre, ajouter: ajouterAuFiltre, contient: contient };

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
      etiquette.textContent = t('fiche.3d.exemple');
      wrap.insertBefore(etiquette, wrap.firstChild);
    }
    var demo = window.menuAPI && window.menuAPI.estDefaut;
    if (plat && plat.model) {
      if (mv.getAttribute('src') !== plat.model) mv.setAttribute('src', plat.model);
      mv.setAttribute('scale', '1 1 1');      // l'échelle réduite ne vaut que pour le modèle d'exemple (sans attribut, le visualiseur ne charge pas le modèle)
      etiquette.style.display = 'none'; btn.style.display = 'flex';
    } else if (demo) {
      if (mv.getAttribute('src') !== MODELE_EXEMPLE) mv.setAttribute('src', MODELE_EXEMPLE);
      if (ECHELLE_EXEMPLE) mv.setAttribute('scale', ECHELLE_EXEMPLE);
      etiquette.style.display = ''; btn.style.display = 'flex';
    } else {
      btn.style.display = 'none'; wrap.style.display = 'none';
    }
  }

  // Le modèle est changé pendant que la vue 3D est masquée : le visualiseur ne le charge alors
  // pas toujours. À l'ouverture de la vue, un modèle encore absent est redemandé.
  (function () {
    var btn = document.getElementById('btnAr'), mv = document.getElementById('mvEl');
    if (!btn || !mv) return;
    btn.addEventListener('click', function () {
      setTimeout(function () {
        if (mv.loaded) return;
        var src = mv.getAttribute('src'); if (!src) return;
        mv.removeAttribute('src');
        setTimeout(function () { mv.setAttribute('src', src); }, 60);
      }, 250);
    });
  })();

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
      + '.mv-avis-msg{font-size:.82rem;font-style:italic;margin-top:6px;min-height:1em}'
      + '.mv-avis input.mv-avis-prenom{display:none;width:100%;margin-top:8px;padding:9px 10px;border:1px solid rgba(139,74,47,.3);border-radius:2px;font:inherit;font-size:.85rem;background:transparent;color:inherit}'
      + '.mv-avis.note input.mv-avis-prenom{display:block}'
      + '.mv-avis-publics{margin:14px 0 4px;padding-top:12px;border-top:1px solid rgba(139,74,47,.18);text-align:left}'
      + '.mv-avis-publics h3{font-size:.72rem;font-weight:400;letter-spacing:.08em;text-transform:uppercase;opacity:.75;margin:0 0 8px;text-align:center}'
      + '.mv-avis-publics .mv-avis-moy{color:var(--terre,#8B4A2F);letter-spacing:.04em}'
      + '.mv-avis-un{padding:8px 0;border-bottom:1px solid rgba(139,74,47,.1);font-size:.84rem;line-height:1.45}'
      + '.mv-avis-un:last-child{border-bottom:none}'
      + '.mv-avis-un .mv-avis-et{color:var(--terre,#8B4A2F);font-size:.8rem;letter-spacing:.06em}'
      + '.mv-avis-un .mv-avis-qui{opacity:.7;font-size:.74rem}'
      + '.mv-avis-un .mv-avis-rep{margin:5px 0 0 12px;padding-left:10px;border-left:2px solid rgba(139,74,47,.3);font-size:.8rem;font-style:italic;opacity:.85}'
      + '.mv-avis-resto{max-width:560px;margin:34px auto 0;padding:0 24px}';
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
      + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-n="' + n + '" aria-label="' + esc(t('avis.note', { n: n })) + '">★</button>'; }).join('')
      + '</div><textarea maxlength="300"></textarea>'
      + '<input class="mv-avis-prenom" type="text" maxlength="40" autocomplete="given-name" />'
      + '<button type="button" class="mv-avis-envoyer"></button><p class="mv-avis-msg" role="status"></p>';
    el.querySelector('textarea').placeholder = t('avis.commentaire');
    el.querySelector('.mv-avis-prenom').placeholder = t('avis.prenom');
    el.querySelector('.mv-avis-envoyer').textContent = t('avis.envoyer');
    // L'avis est enregistré sous le nom d'origine du plat ; la question montre son nom affiché.
    el.querySelector('.mv-avis-q').textContent = t('avis.question', { plat: I.plat(platNom).nom });
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
      btn.disabled = true; msg.textContent = t('avis.envoi');
      fetch('https://menuvision-production.up.railway.app/avis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: window.menuAPI.restaurantId, plat_nom: platNom, note: note, commentaire: el.querySelector('textarea').value.trim(), auteur: el.querySelector('.mv-avis-prenom').value.trim(), lang: I.lang })
      }).then(function (r) { return r.json().then(function (j) { return r.ok && j.ok; }); })
        .then(function (ok) {
          if (!ok) throw new Error('refus');
          envoye = true; msg.textContent = t('avis.merci');
          btn.style.display = 'none'; el.querySelector('textarea').disabled = true; el.querySelector('.mv-avis-prenom').disabled = true;
        })
        .catch(function () { btn.disabled = false; msg.textContent = t('avis.echec'); });
    });
    return el;
  }
  // ── Avis publiés (validés par le restaurateur) : une lecture par page ──
  var avisPublics = null;
  function chargerAvisPublics() {
    if (avisPublics) return avisPublics;
    var vide = { avis: [], total: 0, note_moyenne: null, par_plat: {} };
    avisPublics = fetch(RAILWAY + '/avis/publics?restaurant_id=' + encodeURIComponent(window.menuAPI.restaurantId))
      .then(function (r) { return r.json(); })
      .then(function (j) { return (j && j.ok) ? j : vide; })
      .catch(function () { return vide; });
    return avisPublics;
  }
  function etoiles(note) { var n = Math.max(0, Math.min(5, Math.round(note))); return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); }
  function noteTexte(n) { return (I.lang === 'en' ? String(n) : String(n).replace('.', ',')) + '/5'; }
  function avisHTML(a, avecPlat) {
    var qui = [a.auteur, (avecPlat && a.plat_nom) ? I.plat(a.plat_nom).nom : null].filter(Boolean).map(esc).join(' · ');
    return '<div class="mv-avis-un"><span class="mv-avis-et" aria-label="' + esc(t('avis.note', { n: a.note })) + '">' + etoiles(a.note) + '</span>'
      + (qui ? ' <span class="mv-avis-qui">' + qui + '</span>' : '')
      + (a.commentaire ? '<div>« ' + esc(a.commentaire) + ' »</div>' : '')
      + (a.reponse ? '<div class="mv-avis-rep">' + esc(t('avis.reponse')) + ' ' + esc(a.reponse) + '</div>' : '')
      + '</div>';
  }
  // Avis publiés d'un plat, sous sa fiche. Rien n'est affiché tant qu'aucun avis n'est publié.
  function blocAvisPlat(platNom) {
    styleAvis();
    var el = document.createElement('div'); el.className = 'mv-avis-publics'; el.style.display = 'none';
    chargerAvisPublics().then(function (d) {
      var cle = platNom.trim().toLowerCase();
      var liste = d.avis.filter(function (a) { return (a.plat_nom || '').trim().toLowerCase() === cle; });
      if (!liste.length) return;
      var moy = Math.round(liste.reduce(function (s, a) { return s + a.note; }, 0) / liste.length * 10) / 10;
      el.innerHTML = '<h3>' + esc(t('avis.clients')) + ' — <span class="mv-avis-moy">' + noteTexte(moy) + '</span> (' + liste.length + ')</h3>'
        + liste.slice(0, 5).map(function (a) { return avisHTML(a, false); }).join('');
      el.style.display = '';
    });
    return el;
  }
  // Avis publiés du restaurant, en bas de la carte.
  function afficherAvisRestaurant() {
    if (document.querySelector('.mv-avis-resto')) return;
    var pied = document.querySelector('.page-footer'); if (!pied) return;
    chargerAvisPublics().then(function (d) {
      if (!d.total || document.querySelector('.mv-avis-resto')) return;
      styleAvis();
      var el = document.createElement('section'); el.className = 'mv-avis-publics mv-avis-resto';
      el.innerHTML = '<h3>' + esc(t('avis.clients')) + ' — <span class="mv-avis-moy">' + noteTexte(d.note_moyenne) + '</span> (' + d.total + ')</h3>'
        + d.avis.slice(0, 5).map(function (a) { return avisHTML(a, true); }).join('');
      pied.parentNode.insertBefore(el, pied);
    });
  }
  window.mvAvis = { actifs: avisActifs, bloc: blocAvis, publics: chargerAvisPublics };

  // À chaque ouverture de la fiche plat : bon modèle 3D, bloc d'avis pour ce plat.
  function surOuvertureFiche() {
    var nomEl = document.getElementById('modalName'); if (!nomEl) return;
    var nom = nomEl.textContent.trim();
    var plat = null, d = window.dishes || {};
    Object.keys(d).forEach(function (k) { if (!plat && (d[k].name || '').trim() === nom) plat = d[k]; });
    majModele(plat);
    rendreAllergenesFiche(plat);
    var ancien = document.querySelector('.modal-sheet .mv-avis, .modal-overlay .mv-avis'); if (ancien) ancien.remove();
    var ajouter = document.getElementById('btnAdd');
    var anciens = document.querySelector('.modal-sheet .mv-avis-publics, .modal-overlay .mv-avis-publics'); if (anciens) anciens.remove();
    if (nom && ajouter && avisActifs()) {
      var formulaire = blocAvis(nom);
      ajouter.parentNode.insertBefore(formulaire, ajouter.nextSibling);
      formulaire.parentNode.insertBefore(blocAvisPlat(nom), formulaire.nextSibling);
    }
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
  // La veille ci-dessus ne voit pas une fiche fermée puis rouverte dans le même instant : chaque
  // ouverture passe aussi par ici, pour que la fiche ne garde jamais les allergènes d'un autre plat.
  if (typeof window.openModal === 'function' && !window.openModal.mvSuivi) {
    var ouvrirFiche = window.openModal;
    window.openModal = function (id) { ouvrirFiche(id); surOuvertureFiche(); };
    window.openModal.mvSuivi = true;
  }

  if (window.menuAPI && window.menuAPI.ready) { run(); }
  else { window.addEventListener('menuApiReady', run, { once: true }); }
  // Les traductions générées à la demande arrivent après le premier affichage : la carte est reposée.
  window.addEventListener('mvPlatsTraduits', run);
})();
