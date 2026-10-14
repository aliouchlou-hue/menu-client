/**
 * cart.js — panier du menu client MenuVision
 * Panier persistant (sessionStorage), tiroir récapitulatif, paiement Stripe.
 * Fonctionne en mode direct (100 %) et en mode réservation (acompte 30 %).
 * Textes : MVI18n (fr, es, ca, en). Un article du panier garde le nom d'ORIGINE du plat
 * (`name`, celui que le serveur connaît) ; le nom affiché est sa traduction.
 */
(function () {
  /* ─── Constantes ────────────────────────────────────────── */
  const STORAGE_KEY = 'maCart';
  const I = window.MVI18n;
  const t = I.t;
  const RAILWAY     = 'https://menuvision-production.up.railway.app';

  // Mode « cuisine » : restaurant sans paiement en ligne (payment_provider='none').
  // Le client envoie sa commande en salle au lieu de payer par carte.
  let kitchenMode = false;
  let showMode = false;   // formule sans commande en cuisine : panier à montrer au serveur

  /* ─── Détection du mode réservation ────────────────────── */
  let resaCtx = null;
  try { resaCtx = JSON.parse(sessionStorage.getItem('resaCtx') || 'null'); } catch (_) {}
  const isReservation = !!(resaCtx && resaCtx.id);

  /* ─── Helpers ───────────────────────────────────────────── */
  function loadCart() {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]'); } catch (_) { return []; }
  }
  function saveCart(items) {
    // Nom affiché de chaque article, pour la page de confirmation (qui n'a pas la carte).
    if (window.MVI18n) items.forEach(i => { i.label = window.MVI18n.plat(i.name).nom; });
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (_) {}
    if (isReservation) {
      const rc = {};
      items.forEach(i => { rc[i.name] = i.qty; });
      try { sessionStorage.setItem('resaCart', JSON.stringify(rc)); } catch (_) {}
    }
  }
  function parsePrice(str) {
    const m = str.match(/(\d+(?:[.,]\d+)?)/);
    return m ? parseFloat(m[1].replace(',', '.')) : 0;
  }
  function totalItems(items) { return items.reduce((s, i) => s + i.qty, 0); }
  function totalPrice(items) { return items.reduce((s, i) => s + i.price * i.qty, 0); }
  const fmtPrice = n => I.prix(n);
  // Nom affiché d'un article : la traduction du plat quand elle existe.
  const nomAffiche = item => I.plat(item.name).nom;
  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ─── CSS ───────────────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    #cart-pill {
      position: fixed; bottom: calc(24px + env(safe-area-inset-bottom, 0px)); left: 50%;
      transform: translateX(-50%) translateY(88px);
      z-index: 250;
      background: var(--accent); color: var(--sur-accent);
      border: none; border-radius: 30px; padding: 13px 22px;
      font-family: var(--sans); font-size: 0.76rem;
      font-weight: 400; letter-spacing: 0.1em;
      cursor: pointer; display: flex; align-items: center; gap: 9px;
      box-shadow: 0 4px 24px color-mix(in srgb, var(--accent) 38%, transparent);
      transition: transform 0.34s cubic-bezier(0.32,0.72,0,1), opacity 0.34s;
      white-space: nowrap; pointer-events: none; opacity: 0;
      -webkit-tap-highlight-color: transparent;
    }
    #cart-pill.visible {
      transform: translateX(-50%) translateY(0); pointer-events: all; opacity: 1;
    }
    #cart-pill:active { background: var(--terre-dk); }
    #cart-pill svg { width: 17px; height: 17px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 1.8; }
    .cart-pill-sep { opacity: 0.4; }

    body.cart-has-items { padding-bottom: calc(82px + env(safe-area-inset-bottom, 0px)); }
    body.cart-has-items .toast { bottom: 90px !important; }
    body.cart-has-items .chat-fab { bottom: calc(88px + env(safe-area-inset-bottom, 0px)); }
    body.cart-has-items .chat-panel { bottom: calc(144px + env(safe-area-inset-bottom, 0px)); }

    #cart-overlay {
      position: fixed; inset: 0; z-index: 400;
      background: rgba(26,15,8,0.62);
      display: flex; align-items: flex-end;
      opacity: 0; pointer-events: none;
      transition: opacity 0.3s ease;
    }
    #cart-overlay.open { opacity: 1; pointer-events: all; }
    #cart-sheet {
      width: 100%; max-height: 82vh;
      background: var(--fond); border-radius: 18px 18px 0 0;
      display: flex; flex-direction: column; overflow: hidden;
      transform: translateY(52px);
      transition: transform 0.35s cubic-bezier(0.32,0.72,0,1);
    }
    #cart-overlay.open #cart-sheet { transform: translateY(0); }
    #cart-handle {
      width: 34px; height: 3px; background: var(--filet);
      border-radius: 2px; margin: 14px auto 0;
    }
    #cart-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 22px 14px;
      border-bottom: 1px solid var(--filet); flex-shrink: 0;
    }
    #cart-title {
      font-family: var(--serif); font-style: italic;
      font-size: 1.45rem; font-weight: 300;
      color: var(--encre); letter-spacing: 0.06em;
    }
    #cart-close-btn {
      width: 34px; height: 34px; background: none; border: none;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      color: var(--encre-2); -webkit-tap-highlight-color: transparent;
    }
    #cart-close-btn svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; }
    #cart-items {
      flex: 1; overflow-y: auto;
      padding: 4px 22px 8px; -webkit-overflow-scrolling: touch;
    }
    .cart-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 13px 0; border-bottom: 1px solid var(--filet); gap: 12px;
    }
    .cart-item:last-child { border-bottom: none; }
    .cart-item-info { flex: 1; min-width: 0; }
    .cart-item-name {
      font-family: var(--serif); font-style: italic;
      font-size: 1.05rem; font-weight: 300; color: var(--encre);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .cart-item-sub {
      font-size: 0.68rem; color: var(--encre-2);
      margin-top: 2px; letter-spacing: 0.03em;
    }
    .cart-qty-ctrl { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .cart-qty-btn {
      width: 27px; height: 27px; background: none;
      border: 1px solid var(--filet); border-radius: 50%;
      cursor: pointer; font-size: 1rem; line-height: 1;
      display: flex; align-items: center; justify-content: center;
      color: var(--encre-2); transition: background 0.12s;
      -webkit-tap-highlight-color: transparent;
    }
    .cart-qty-btn:active { background: color-mix(in srgb, var(--accent) 20%, transparent); }
    .cart-qty-num {
      font-size: 0.8rem; color: var(--encre);
      min-width: 16px; text-align: center;
    }
    .cart-empty {
      text-align: center; padding: 48px 20px;
      font-family: var(--serif); font-style: italic;
      font-size: 1.05rem; color: var(--encre-2); letter-spacing: 0.04em;
    }
    #cart-footer {
      padding: 14px 22px calc(22px + env(safe-area-inset-bottom, 0px));
      border-top: 1px solid var(--filet); flex-shrink: 0;
    }
    .cart-total-row {
      display: flex; justify-content: space-between;
      align-items: baseline; margin-bottom: 5px;
    }
    .cart-total-label {
      font-size: 0.58rem; letter-spacing: 0.24em; text-transform: uppercase;
      color: var(--accent);
    }
    #cart-total-amount {
      font-family: var(--serif);
      font-size: 1.55rem; font-weight: 300; color: var(--accent);
    }
    #cart-resa-notice {
      font-size: 0.7rem; font-style: italic; letter-spacing: 0.03em;
      color: var(--encre-2);
      margin: 4px 0 12px; display: none;
    }
    #cart-resa-notice.show { display: block; }
    #cart-pay-btn {
      width: 100%; padding: 15px;
      background: var(--accent); color: var(--sur-accent);
      font-family: var(--sans); font-size: 0.7rem;
      font-weight: 400; letter-spacing: 0.26em; text-transform: uppercase;
      border: none; cursor: pointer; transition: background 0.2s;
      -webkit-tap-highlight-color: transparent;
    }
    #cart-pay-btn:active { background: var(--terre-dk); }
    #cart-pay-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── Mode cuisine (payment_provider = none) ── */
    #cart-table-field { display: none; margin: 6px 0 14px; }
    #cart-table-field.show { display: block; }
    #cart-table-label {
      display: block; font-size: 0.58rem; letter-spacing: 0.22em;
      text-transform: uppercase; color: var(--accent); margin-bottom: 7px;
    }
    #cart-table-input {
      width: 100%; padding: 13px 14px;
      background: var(--surface); color: var(--encre); border: 1px solid var(--filet); border-radius: 12px; min-height: 48px;
      font-family: var(--sans); font-size: 0.95rem; font-weight: 300;
      color: var(--encre); letter-spacing: 0.02em;
      -webkit-appearance: none; appearance: none;
    }
    #cart-table-input:focus { outline: none; border-color: var(--accent); }
    #cart-table-field.error #cart-table-input { border-color: #B54334; background: #FCF4F2; }

    #cart-msg {
      font-size: 0.72rem; letter-spacing: 0.02em; text-align: center;
      margin-top: 11px; display: none;
    }
    #cart-msg.show { display: block; }
    #cart-msg.error { color: #B54334; }
    #cart-msg.info  { color: var(--encre-2); font-style: italic; }

    .cart-success { text-align: center; padding: 44px 24px; }
    .cart-success-icon {
      width: 54px; height: 54px; margin: 0 auto 18px;
      border: 1px solid var(--accent); border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.5rem; color: var(--accent);
    }
    .cart-success-title {
      font-family: var(--serif); font-style: italic;
      font-size: 1.5rem; font-weight: 300; color: var(--encre);
      letter-spacing: 0.04em; margin-bottom: 10px;
    }
    .cart-success-sub {
      font-size: 0.82rem; font-weight: 300; color: var(--encre-2);
      letter-spacing: 0.03em; line-height: 1.6; max-width: 280px; margin: 0 auto;
    }
  `;
  document.head.appendChild(style);

  /* ─── HTML ──────────────────────────────────────────────── */
  document.body.insertAdjacentHTML('beforeend', `
    <button id="cart-pill" aria-label="${escHtml(t('panier.voir'))}">
      <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
      <span id="cart-pill-count"></span><span class="cart-pill-sep"> · </span><span id="cart-pill-total"></span>
    </button>
    <div id="cart-overlay" aria-hidden="true">
      <div id="cart-sheet" role="dialog" aria-label="${escHtml(t('panier.aria'))}">
        <div id="cart-handle"></div>
        <div id="cart-header">
          <span id="cart-title">${escHtml(t('panier.titre'))}</span>
          <button id="cart-close-btn" aria-label="${escHtml(t('fermer'))}">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div id="cart-items"></div>
        <div id="cart-footer">
          <div class="cart-total-row">
            <span class="cart-total-label">${escHtml(t('panier.total'))}</span>
            <span id="cart-total-amount">0&nbsp;€</span>
          </div>
          <p id="cart-resa-notice"></p>
          <div id="cart-table-field">
            <label id="cart-table-label" for="cart-table-input">${escHtml(t('panier.table'))}</label>
            <input id="cart-table-input" type="number" inputmode="numeric" min="1" step="1" placeholder="${escHtml(t('panier.table.saisie'))}" autocomplete="off" />
          </div>
          <button id="cart-pay-btn">${escHtml(t('panier.payer'))}</button>
          <p id="cart-msg"></p>
        </div>
      </div>
    </div>
  `);

  /* ─── Refs ──────────────────────────────────────────────── */
  const pill        = document.getElementById('cart-pill');
  const pillCount   = document.getElementById('cart-pill-count');
  const pillTotal   = document.getElementById('cart-pill-total');
  const overlay     = document.getElementById('cart-overlay');
  const cartItemsEl = document.getElementById('cart-items');
  const totalAmtEl  = document.getElementById('cart-total-amount');
  const resaNotice  = document.getElementById('cart-resa-notice');

  /* ─── Conditions d'acompte et d'annulation (mode réservation) ───
     Affichées dans le panier AVANT le paiement, avec les valeurs du restaurant (theme.politique)
     et les textes du serveur MenuVision (fr, es, ca, en). */
  const politiqueEl = document.createElement('div');
  politiqueEl.id = 'cart-politique';
  politiqueEl.hidden = true;
  if (resaNotice && resaNotice.parentNode) resaNotice.parentNode.insertBefore(politiqueEl, resaNotice.nextSibling);
  let politiqueScript = null;
  function afficherPolitique(acompteEur) {
    let p = null;
    try { p = window.menuAPI.theme.politique; } catch (_) {}
    if (!isReservation || !p || !(acompteEur > 0)) { politiqueEl.hidden = true; return; }
    const rendre = () => window.MVPolitique && window.MVPolitique.afficher(politiqueEl, { heures: p.annulation_heures, montant_cents: Math.round(acompteEur * 100) });
    if (window.MVPolitique) return rendre();
    if (!politiqueScript) {
      politiqueScript = document.createElement('script');
      politiqueScript.src = RAILWAY + '/politique-acompte.js';
      document.head.appendChild(politiqueScript);
    }
    politiqueScript.addEventListener('load', rendre);
  }
  const payBtn      = document.getElementById('cart-pay-btn');
  const tableField  = document.getElementById('cart-table-field');
  const tableInput  = document.getElementById('cart-table-input');
  const cartMsg     = document.getElementById('cart-msg');
  const footerEl    = document.getElementById('cart-footer');

  /* ─── Render ────────────────────────────────────────────── */
  function render() {
    const items = loadCart();
    const count = totalItems(items);
    const total = totalPrice(items);

    pillCount.textContent = I.t2('panier.article', count);
    pillTotal.textContent = fmtPrice(total);
    pill.classList.toggle('visible', count > 0);
    document.body.classList.toggle('cart-has-items', count > 0);
    totalAmtEl.textContent = fmtPrice(total);
    payBtn.style.display = showMode ? 'none' : '';
    if (showMode) {
      // Ni commande en cuisine ni paiement en ligne : le panier sert de récapitulatif à montrer.
      resaNotice.textContent = t('panier.montrer');
      resaNotice.classList.toggle('show', count > 0);
    } else if (kitchenMode) {
      resaNotice.classList.remove('show');
      payBtn.textContent = t('panier.cuisine');
    } else if (isReservation && count > 0) {
      const dep = Math.round(total * 0.3 * 100) / 100;
      afficherPolitique(dep);
      resaNotice.textContent = t('panier.acompte.info', { montant: fmtPrice(dep) });
      resaNotice.classList.add('show');
      payBtn.textContent = t('panier.acompte.payer', { montant: fmtPrice(dep) });
    } else {
      resaNotice.classList.remove('show');
      payBtn.textContent = t('panier.payer');
    }

    if (!items.length) {
      cartItemsEl.innerHTML = '<p class="cart-empty">' + escHtml(t('panier.vide')) + '</p>';
    } else {
      cartItemsEl.innerHTML = items.map((item, i) => `
        <div class="cart-item">
          <div class="cart-item-info">
            <div class="cart-item-name">${escHtml(nomAffiche(item))}</div>
            <div class="cart-item-sub">${escHtml(t('panier.unite', { prix: fmtPrice(item.price) }))}</div>
          </div>
          <div class="cart-qty-ctrl">
            <button class="cart-qty-btn" data-action="dec" data-idx="${i}" aria-label="${escHtml(t('panier.moins'))}">−</button>
            <span class="cart-qty-num">${item.qty}</span>
            <button class="cart-qty-btn" data-action="inc" data-idx="${i}" aria-label="${escHtml(t('panier.plus'))}">+</button>
          </div>
        </div>`).join('');
    }
  }

  /* ─── Ajouter au panier ─────────────────────────────────── */
  function addToCart(name, priceStr) {
    const price = parsePrice(priceStr);
    if (!name || price <= 0) return;
    const items = loadCart();
    const existing = items.find(i => i.name === name);
    if (existing) { existing.qty++; } else { items.push({ name, price, qty: 1 }); }
    saveCart(items);
    render();
  }

  function hookBtnAdd() {
    const btn = document.getElementById('btnAdd');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const name     = document.getElementById('modalName')?.textContent?.trim();
      const priceStr = document.getElementById('modalPrice')?.textContent?.trim();
      if (name && priceStr) addToCart(name, priceStr);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hookBtnAdd);
  } else {
    hookBtnAdd();
  }

  /* ─── Ouverture / Fermeture ─────────────────────────────── */
  function openCart() {
    // Restaure l'état du footer (masqué après un envoi réussi précédent).
    footerEl.style.display = '';
    payBtn.disabled = false;
    if (typeof clearKitchenMsg === 'function') clearKitchenMsg();
    tableField.classList.remove('error');
    render();
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeCart() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  pill.addEventListener('click', openCart);
  document.getElementById('cart-close-btn').addEventListener('click', closeCart);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeCart(); });

  /* ─── Boutons quantité ──────────────────────────────────── */
  cartItemsEl.addEventListener('click', e => {
    const btn = e.target.closest('.cart-qty-btn');
    if (!btn) return;
    const idx    = parseInt(btn.dataset.idx, 10);
    const action = btn.dataset.action;
    const items  = loadCart();
    if (action === 'inc') { items[idx].qty++; }
    else if (action === 'dec') {
      items[idx].qty--;
      if (items[idx].qty <= 0) items.splice(idx, 1);
    }
    saveCart(items);
    render();
  });

  /* ─── Clic bouton principal : route selon le mode ───────── */
  payBtn.addEventListener('click', () => {
    if (showMode) return;
    if (kitchenMode) { sendToKitchen(); }
    else             { payStripe(); }
  });


  /* ─── Paiement Stripe ───────────────────────────────────── */
  async function payStripe() {
    const items = loadCart();
    if (!items.length) return;
    payBtn.disabled = true;
    payBtn.textContent = t('panier.redirection');
    try {
      // Restaurant courant + client connecté au Passeport (si dispo)
      let restaurantId = null;
      try { restaurantId = (window.menuAPI && window.menuAPI.restaurantId) || localStorage.getItem('mv_rid'); } catch (_) {}
      const pass = window.MVPassport && window.MVPassport.client;
      saveCart(items);
      const res = await fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({ name: i.name, price: i.price, qty: i.qty })),
          mode: isReservation ? 'reservation' : 'direct',
          reservationId: resaCtx ? resaCtx.id : null,
          restaurantId,
          clientEmail: pass ? pass.email : null,
          clientNom:   pass ? pass.nom   : null,
          // Langue choisie pour les conditions d'acompte : reprise sur la page de paiement Stripe.
          lang: I.lang
        })
      });
      const data = await res.json();

      if (data.url) {
        // Stripe Checkout → redirection
        window.location.href = data.url;
        return;
      }
      if (data.provider === 'redsys' && data.redsys && data.redsys.url) {
        // Redsys → formulaire signé par le serveur, posté vers la page de paiement de la banque
        const f = document.createElement('form');
        f.method = 'POST'; f.action = data.redsys.url; f.style.display = 'none';
        Object.keys(data.redsys.champs).forEach(function (nom) {
          const i = document.createElement('input');
          i.type = 'hidden'; i.name = nom; i.value = data.redsys.champs[nom];
          f.appendChild(i);
        });
        document.body.appendChild(f);
        f.submit();
        return;
      }
      if (data.provider === 'none') {
        // Espèces / sur place — aucun paiement en ligne
        showPayInfo(t('panier.surplace'));
        return;
      }
      if (prixMisAJour(data)) {
        payBtn.disabled = false;
        return;
      }
      if (data.provider === 'cmi' || data.provider === 'payzone') {
        // Passerelle marocaine — règlement sur place en attendant l'intégration redirigée
        showPayInfo(t('panier.surplace'));
        return;
      }
      // Refus du serveur : le motif est affiché dans la langue du client (par code).
      kitchenMsg(I.erreur(data, res.status, 'err.paiement'), 'error');
      payBtn.textContent = t('panier.erreur');
      payBtn.disabled = false;
    } catch (err) {
      console.error('[cart] erreur paiement:', err);
      kitchenMsg(t('err.paiement'), 'error');
      payBtn.textContent = t('panier.erreur');
      payBtn.disabled = false;
    }
  }

  /* Le serveur relit chaque prix sur la carte : si un prix du panier n'est plus celui de la carte
     (promotion terminée, carte modifiée), il refuse et renvoie les prix à jour. Le panier se
     corrige et le client valide de nouveau, au bon montant. */
  function prixMisAJour(data) {
    if (!data || data.code !== 'PRIX_MODIFIE' || !Array.isArray(data.lignes)) return false;
    const items = loadCart();
    data.lignes.forEach(function (l) {
      const item = items.find(function (i) { return i.name.trim().toLowerCase() === String(l.nom).trim().toLowerCase(); });
      if (item) item.price = Number(l.prix_unitaire);
    });
    saveCart(items);
    render();
    kitchenMsg(t('panier.prix.maj'), 'info');
    return true;
  }

  /* Message d'encaissement « sur place » (non Stripe) */
  function showPayInfo(msg) {
    resaNotice.textContent = msg;
    resaNotice.classList.add('show');
    payBtn.textContent = t('panier.prete');
    payBtn.disabled = true;
  }

  /* ─── Mode cuisine (payment_provider = 'none') ──────────── */
  function kitchenMsg(text, kind) {
    cartMsg.textContent = text;
    cartMsg.className = 'show ' + (kind || 'info');
  }
  function clearKitchenMsg() { cartMsg.className = ''; cartMsg.textContent = ''; }

  function readTableNumber() {
    const n = parseInt(tableInput.value, 10);
    if (!Number.isInteger(n) || n < 1) {
      tableField.classList.add('error');
      tableInput.focus();
      return null;
    }
    tableField.classList.remove('error');
    return n;
  }

  function currentRestaurantId() {
    try { return (window.menuAPI && window.menuAPI.restaurantId) || localStorage.getItem('mv_rid'); }
    catch (_) { return null; }
  }

  async function sendToKitchen() {
    const items = loadCart();
    if (!items.length) return;
    const table = readTableNumber();
    if (table == null) { kitchenMsg(t('panier.table.requise'), 'error'); return; }

    clearKitchenMsg();
    payBtn.disabled = true;
    const prevLabel = payBtn.textContent;
    payBtn.textContent = t('panier.envoi');
    try {
      const plats = items.map(i => ({ nom: i.name, qte: i.qty, prix: i.price }));
      const res = await fetch(RAILWAY + '/commandes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: currentRestaurantId(), table_numero: table, plats, lang: I.lang })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
        showKitchenSuccess(t('panier.transmis'), items);
      } else if (prixMisAJour(data)) {
        payBtn.disabled = false;
      } else {
        payBtn.disabled = false;
        payBtn.textContent = prevLabel;
        kitchenMsg(I.erreur(data, res.status, 'err.envoi'), 'error');
      }
    } catch (err) {
      console.error('[cart] envoi cuisine:', err);
      payBtn.disabled = false;
      payBtn.textContent = prevLabel;
      kitchenMsg(t('chat.indispo'), 'error');
    }
  }

  function showKitchenSuccess(msg, items) {
    cartItemsEl.innerHTML =
      '<div class="cart-success">' +
        '<div class="cart-success-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12l5 5L20 6"/></svg></div>' +
        '<p class="cart-success-title">' + escHtml(t('panier.transmis.titre')) + '</p>' +
        '<p class="cart-success-sub">' + escHtml(msg) + '</p>' +
      '</div>';
    footerEl.style.display = 'none';
    // Avis sur les plats commandés, si le restaurant les reçoit (formule avec « Avis clients »).
    if (window.mvAvis && window.mvAvis.actifs()) {
      (items || []).slice(0, 6).forEach(function (i) { cartItemsEl.appendChild(window.mvAvis.bloc(i.name)); });
    }
    // Le panier est vidé : masque la pastille flottante.
    pill.classList.remove('visible');
    document.body.classList.remove('cart-has-items');
  }

  // Applique le mode selon le prestataire de paiement du restaurant.
  function applyMode() {
    var provider = null;
    try { provider = window.menuAPI && window.menuAPI.theme && window.menuAPI.theme.payment_provider; } catch (_) {}
    // Sans paiement en ligne, hors tunnel réservation (l'acompte reste Stripe) :
    //  - la formule inclut la commande en cuisine (theme.fonctions) → envoi en cuisine ;
    //  - sinon → le client montre son panier au serveur.
    var cuisine = false;
    try { cuisine = window.menuAPI.theme.fonctions.commande_cuisine === true; } catch (_) {}
    var surPlace = (provider === 'none') && !isReservation;
    kitchenMode = surPlace && cuisine;
    showMode    = surPlace && !cuisine;

    tableField.classList.toggle('show', kitchenMode);
    if (!kitchenMode) clearKitchenMsg();
    render();
  }

  // Le prestataire arrive avec le thème (chargement asynchrone de menu-api.js).
  window.addEventListener('menuApiReady', applyMode);
  if (window.menuAPI && window.menuAPI.ready) applyMode();
  // Les traductions de la carte arrivent après coup : les noms du panier se mettent à jour.
  window.addEventListener('mvPlatsTraduits', function () { saveCart(loadCart()); render(); });

  render();
})();
