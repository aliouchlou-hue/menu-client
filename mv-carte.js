/* mv-carte.js — Logique commune des pages de la carte (entrées, plats, desserts, boissons) :
   fiche d'un plat (dialogue accessible), vue 3D, conseiller, ouverture par ?open=.
   Les plats eux-mêmes sont posés par menu-api-page.js à partir des données du restaurant. */
(function () {
  var I = window.MVI18n;
  var t = I ? I.t : function (k) { return k; };
  var $ = function (id) { return document.getElementById(id); };
  window.dishes = window.dishes || {};

  // Page de la carte où se trouve un plat, d'après sa catégorie.
  function pageDe(cat) {
    var c = String(cat || '').toLowerCase();
    if (/^entr|starter/.test(c)) return 'entrees';
    if (/^dessert/.test(c)) return 'desserts';
    if (/^(boisson|vin|drink|wine|cave)/.test(c)) return 'vins';
    return 'plats';
  }
  window.mvPageDe = pageDe;
  function avecRestaurant(url) {
    var rid = window.menuAPI && window.menuAPI.restaurantId;
    return rid ? url + (url.indexOf('?') >= 0 ? '&' : '?') + 'r=' + encodeURIComponent(rid) : url;
  }

  // ── Fiche d'un plat ───────────────────────────────────────────────────────
  var overlay = $('modalOverlay'), feuille = overlay.querySelector('.modal-sheet');
  var modalImg = $('modalImg'), modalImgW = $('modalImgWrap');
  var dernierFocus = null;
  feuille.setAttribute('role', 'dialog');
  feuille.setAttribute('aria-modal', 'true');
  feuille.setAttribute('aria-labelledby', 'modalNomAffiche');
  feuille.tabIndex = -1;
  overlay.inert = true;   // fiche fermée : hors de l'ordre de tabulation et des lecteurs d'écran

  function openModal(id) {
    var d = window.dishes[id]; if (!d) return;
    dernierFocus = document.activeElement;
    modalImgW.classList.toggle('sans-photo', !d.img);
    modalImg.hidden = !d.img;
    if (d.img) { modalImg.src = d.img; modalImg.alt = d.label || d.name; } else { modalImg.removeAttribute('src'); modalImg.alt = ''; }
    $('modalName').textContent = d.name;                       // nom d'origine (panier, pré-commande)
    $('modalNomAffiche').textContent = d.label || d.name;      // nom affiché, traduit
    $('modalPrice').textContent = d.price;
    $('modalDesc').textContent = d.desc || '';
    $('modalAllergens').textContent = '';
    overlay.inert = false;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { $('modalClose').focus(); }, 60);
  }
  function closeModal() {
    if (!overlay.classList.contains('open')) return;
    overlay.classList.remove('open');
    overlay.inert = true;
    document.body.style.overflow = '';
    $('arWrap').hidden = true;
    if (dernierFocus && dernierFocus.focus) dernierFocus.focus();
  }
  window.openModal = openModal;
  window.closeModal = closeModal;
  $('modalClose').addEventListener('click', closeModal);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', function (e) {
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
    if (e.key !== 'Tab') return;
    // Le focus reste dans la fiche tant qu'elle est ouverte.
    var f = [].slice.call(feuille.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')).filter(function (x) { return x.offsetParent !== null && !x.disabled; });
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });

  // Ajout à la commande (le panier, cart.js, écoute le même bouton)
  var toast = $('toast'), minuteur;
  $('btnAdd').addEventListener('click', function () {
    closeModal();
    toast.textContent = t('fiche.ajoute');
    toast.classList.add('show');
    clearTimeout(minuteur);
    minuteur = setTimeout(function () { toast.classList.remove('show'); }, 2400);
  });

  // ── Vue 3D : seulement si le restaurant a un modèle pour ce plat (menu-api-page.js) ──
  var btnAr = $('btnAr'), arWrap = $('arWrap'), mvEl = $('mvEl');
  var visionneuse = null;
  function chargerVisionneuse() {
    if (visionneuse) return visionneuse;
    visionneuse = new Promise(function (ok) {
      if (window.customElements && customElements.get('model-viewer')) return ok();
      var s = document.createElement('script'); s.type = 'module';
      s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js';
      s.onload = ok; s.onerror = ok; document.head.appendChild(s);
    });
    return visionneuse;
  }
  btnAr.addEventListener('click', function () {
    chargerVisionneuse().then(function () {
      arWrap.hidden = false;
      btnAr.hidden = true;
      mvEl.addEventListener('load', function () { if (!mvEl.canActivateAR) $('arNoSupport').hidden = false; }, { once: true });
    });
  });
  $('arHideBtn').addEventListener('click', function () { arWrap.hidden = true; btnAr.hidden = false; $('arNoSupport').hidden = true; });

  // Cartes cliquables au doigt et au clavier
  document.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('.dish-card');
    if (c && c.dataset.id) window.openModal(c.dataset.id);
  });
  document.addEventListener('keydown', function (e) {
    var c = e.target.closest && e.target.closest('.dish-card');
    if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); window.openModal(c.dataset.id); }
  });

  // ── Conseiller ───────────────────────────────────────────────────────────
  var chatPanel = $('chatPanel'), chatInput = $('chatInput'), chatSend = $('chatSend'), chatMsgs = $('chatMessages'), sugg = $('chatSuggestions');
  var historique = [], ouvert = false;
  chatPanel.setAttribute('role', 'dialog');
  chatPanel.setAttribute('aria-labelledby', 'chatTitre');
  function accueillir() {
    var nom = (window.menuAPI && window.menuAPI.theme && window.menuAPI.theme.nom) || '';
    var premier = chatMsgs.querySelector('.chat-msg.ai p');
    if (premier && !historique.length) premier.textContent = nom ? t('chat.accueil', { nom: nom }) : t('chat.accueil.neutre');
  }
  function basculer() {
    ouvert = !ouvert;
    chatPanel.classList.toggle('open', ouvert);
    chatPanel.setAttribute('aria-hidden', String(!ouvert));
    $('chatFab').setAttribute('aria-expanded', String(ouvert));
    if (ouvert) { accueillir(); if (!historique.length) sugg.classList.remove('hidden'); setTimeout(function () { chatInput.focus(); }, 250); }
    else $('chatFab').focus();
  }
  $('chatFab').addEventListener('click', basculer);
  $('chatClose').addEventListener('click', basculer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ouvert && !overlay.classList.contains('open')) basculer(); });
  sugg.querySelectorAll('.chat-suggestion-btn').forEach(function (b) {
    b.addEventListener('click', function () { chatInput.value = b.textContent; sugg.classList.add('hidden'); envoyer(); });
  });
  chatInput.addEventListener('input', function () { if (chatInput.value.trim()) sugg.classList.add('hidden'); });

  // Les plats cités par le conseiller deviennent des liens vers leur fiche (toute la carte du restaurant).
  function lier(texte) {
    var paires = [];
    ((window.menuAPI && window.menuAPI.plats) || []).forEach(function (p) {
      [p.nom, p.nom_traduit].forEach(function (n) { if (n && !paires.some(function (x) { return x.nom === n; })) paires.push({ nom: n, id: p.id, page: pageDe(p.categorie) }); });
    });
    if (!paires.length) return texte;
    paires.sort(function (a, b) { return b.nom.length - a.nom.length; });
    var re = new RegExp('(' + paires.map(function (p) { return p.nom.replace(/&/g, '&amp;').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'g');
    return texte.replace(re, function (m) {
      var p = paires.find(function (x) { return x.nom.replace(/&/g, '&amp;') === m; });
      return p ? '<button type="button" class="dish-link" data-id="' + p.id + '" data-page="' + p.page + '">' + m + '</button>' : m;
    });
  }
  function ajouterMessage(texte, role) {
    var div = document.createElement('div'); div.className = 'chat-msg ' + role;
    var p = document.createElement('p');
    if (role === 'ai') {
      var propre = String(texte).replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      p.innerHTML = lier(propre);
    } else p.textContent = texte;
    div.appendChild(p); chatMsgs.appendChild(div); chatMsgs.scrollTop = chatMsgs.scrollHeight;
    return div;
  }
  function envoyer() {
    var texte = chatInput.value.trim(); if (!texte) return;
    chatInput.value = ''; chatSend.disabled = true;
    ajouterMessage(texte, 'user');
    var attente = ajouterMessage(t('chat.ecrit'), 'typing');
    fetch('/.netlify/functions/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: texte, history: historique, context: window._menuApiContext || null, lang: I ? I.lang : 'fr' })
    }).then(function (r) { return r.json(); }).then(function (d) {
      var rep = d && d.reply ? d.reply : t('chat.indispo');
      attente.remove(); ajouterMessage(rep, 'ai');
      if (d && d.reply) { historique.push({ role: 'user', content: texte }, { role: 'assistant', content: rep }); historique = historique.slice(-12); }
    }).catch(function () { attente.remove(); ajouterMessage(t('chat.indispo'), 'ai'); })
      .then(function () { chatSend.disabled = false; chatInput.focus(); });
  }
  chatSend.addEventListener('click', envoyer);
  chatInput.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer(); } });
  chatMsgs.addEventListener('click', function (e) {
    var l = e.target.closest('.dish-link'); if (!l) return;
    if (window.dishes[l.dataset.id]) { if (ouvert) basculer(); window.openModal(l.dataset.id); }
    else location.href = avecRestaurant(l.dataset.page + '.html?open=' + encodeURIComponent(l.dataset.id));
  });
  window.addEventListener('menuApiReady', accueillir);

  // ── Fiche ouverte par l'adresse (?open=), une fois les plats posés ──────────
  var aOuvrir = new URLSearchParams(location.search).get('open');
  if (aOuvrir) window.addEventListener('mvCartePosee', function () { if (window.dishes[aOuvrir]) window.openModal(aOuvrir); }, { once: true });
})();
