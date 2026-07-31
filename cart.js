/**
 * cart.js — Maison Ardent
 * Panier persistant (sessionStorage), tiroir récapitulatif, paiement Stripe.
 * Fonctionne en mode direct (100 %) et en mode réservation (acompte 30 %).
 */
(function () {
  /* ─── Constantes ────────────────────────────────────────── */
  const STORAGE_KEY = 'maCart';
  const RAILWAY     = 'https://menuvision-production.up.railway.app';

  // Mode « cuisine » : restaurant sans paiement en ligne (payment_provider='none').
  // Le client envoie sa commande en salle au lieu de payer par carte.
  let kitchenMode = false;

  /* ─── Détection du mode réservation ────────────────────── */
  let resaCtx = null;
  try { resaCtx = JSON.parse(sessionStorage.getItem('resaCtx') || 'null'); } catch (_) {}
  const isReservation = !!(resaCtx && resaCtx.id);

  /* ─── Helpers ───────────────────────────────────────────── */
  function loadCart() {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]'); } catch (_) { return []; }
  }
  function saveCart(items) {
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
  function fmtPrice(n) {
    const s = n.toFixed(2);
    return (s.endsWith('.00') ? String(Math.round(n)) : s.replace('.', ',')) + ' €';
  }
  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ─── CSS ───────────────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    #cart-pill {
      position: fixed; bottom: calc(24px + env(safe-area-inset-bottom, 0px)); left: 50%;
      transform: translateX(-50%) translateY(88px);
      z-index: 250;
      background: var(--terre, #8B4A2F); color: var(--creme, #F5F0E8);
      border: none; border-radius: 30px; padding: 13px 22px;
      font-family: 'Montserrat', sans-serif; font-size: 0.76rem;
      font-weight: 400; letter-spacing: 0.1em;
      cursor: pointer; display: flex; align-items: center; gap: 9px;
      box-shadow: 0 4px 24px rgba(139,74,47,0.38);
      transition: transform 0.34s cubic-bezier(0.32,0.72,0,1), opacity 0.34s;
      white-space: nowrap; pointer-events: none; opacity: 0;
      -webkit-tap-highlight-color: transparent;
    }
    #cart-pill.visible {
      transform: translateX(-50%) translateY(0); pointer-events: all; opacity: 1;
    }
    #cart-pill:active { background: var(--terre-dk, #6e3822); }
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
      background: var(--creme, #F5F0E8); border-radius: 18px 18px 0 0;
      display: flex; flex-direction: column; overflow: hidden;
      transform: translateY(52px);
      transition: transform 0.35s cubic-bezier(0.32,0.72,0,1);
    }
    #cart-overlay.open #cart-sheet { transform: translateY(0); }
    #cart-handle {
      width: 34px; height: 3px; background: var(--sep, #D4C4B0);
      border-radius: 2px; margin: 14px auto 0;
    }
    #cart-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 22px 14px;
      border-bottom: 1px solid var(--sep, #D4C4B0); flex-shrink: 0;
    }
    #cart-title {
      font-family: 'Cormorant Garamond', serif; font-style: italic;
      font-size: 1.45rem; font-weight: 300;
      color: var(--text, #2C1F14); letter-spacing: 0.06em;
    }
    #cart-close-btn {
      width: 34px; height: 34px; background: none; border: none;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      color: var(--text-soft, #6B5244); -webkit-tap-highlight-color: transparent;
    }
    #cart-close-btn svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; }
    #cart-items {
      flex: 1; overflow-y: auto;
      padding: 4px 22px 8px; -webkit-overflow-scrolling: touch;
    }
    .cart-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 13px 0; border-bottom: 1px solid var(--sep, #D4C4B0); gap: 12px;
    }
    .cart-item:last-child { border-bottom: none; }
    .cart-item-info { flex: 1; min-width: 0; }
    .cart-item-name {
      font-family: 'Cormorant Garamond', serif; font-style: italic;
      font-size: 1.05rem; font-weight: 300; color: var(--text, #2C1F14);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .cart-item-sub {
      font-size: 0.68rem; color: var(--text-soft, #6B5244);
      margin-top: 2px; letter-spacing: 0.03em;
    }
    .cart-qty-ctrl { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .cart-qty-btn {
      width: 27px; height: 27px; background: none;
      border: 1px solid var(--sep, #D4C4B0); border-radius: 50%;
      cursor: pointer; font-size: 1rem; line-height: 1;
      display: flex; align-items: center; justify-content: center;
      color: var(--text-soft, #6B5244); transition: background 0.12s;
      -webkit-tap-highlight-color: transparent;
    }
    .cart-qty-btn:active { background: rgba(196,168,130,0.2); }
    .cart-qty-num {
      font-size: 0.8rem; color: var(--text, #2C1F14);
      min-width: 16px; text-align: center;
    }
    .cart-empty {
      text-align: center; padding: 48px 20px;
      font-family: 'Cormorant Garamond', serif; font-style: italic;
      font-size: 1.05rem; color: var(--text-soft, #6B5244); letter-spacing: 0.04em;
    }
    #cart-footer {
      padding: 14px 22px calc(22px + env(safe-area-inset-bottom, 0px));
      border-top: 1px solid var(--sep, #D4C4B0); flex-shrink: 0;
    }
    .cart-total-row {
      display: flex; justify-content: space-between;
      align-items: baseline; margin-bottom: 5px;
    }
    .cart-total-label {
      font-size: 0.58rem; letter-spacing: 0.24em; text-transform: uppercase;
      color: var(--warm-mid, #C4A882);
    }
    #cart-total-amount {
      font-family: 'Cormorant Garamond', serif;
      font-size: 1.55rem; font-weight: 300; color: var(--terre, #8B4A2F);
    }
    #cart-resa-notice {
      font-size: 0.7rem; font-style: italic; letter-spacing: 0.03em;
      color: var(--text-soft, #6B5244);
      margin: 4px 0 12px; display: none;
    }
    #cart-resa-notice.show { display: block; }
    #cart-pay-btn {
      width: 100%; padding: 15px;
      background: var(--terre, #8B4A2F); color: var(--creme, #F5F0E8);
      font-family: 'Montserrat', sans-serif; font-size: 0.7rem;
      font-weight: 400; letter-spacing: 0.26em; text-transform: uppercase;
      border: none; cursor: pointer; transition: background 0.2s;
      -webkit-tap-highlight-color: transparent;
    }
    #cart-pay-btn:active { background: var(--terre-dk, #6e3822); }
    #cart-pay-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── Mode cuisine (payment_provider = none) ── */
    #cart-table-field { display: none; margin: 6px 0 14px; }
    #cart-table-field.show { display: block; }
    #cart-table-label {
      display: block; font-size: 0.58rem; letter-spacing: 0.22em;
      text-transform: uppercase; color: var(--warm-mid, #C4A882); margin-bottom: 7px;
    }
    #cart-table-input {
      width: 100%; padding: 13px 14px;
      background: #fff; border: 1px solid var(--sep, #D4C4B0); border-radius: 2px;
      font-family: 'Montserrat', sans-serif; font-size: 0.95rem; font-weight: 300;
      color: var(--text, #2C1F14); letter-spacing: 0.02em;
      -webkit-appearance: none; appearance: none;
    }
    #cart-table-input:focus { outline: none; border-color: var(--terre, #8B4A2F); }
    #cart-table-field.error #cart-table-input { border-color: #B54334; background: #FCF4F2; }

    #cart-call-btn {
      display: none; width: 100%; margin-top: 9px; padding: 13px;
      background: transparent; color: var(--terre, #8B4A2F);
      border: 1px solid var(--sep, #D4C4B0);
      font-family: 'Montserrat', sans-serif; font-size: 0.64rem;
      font-weight: 400; letter-spacing: 0.24em; text-transform: uppercase;
      cursor: pointer; transition: border-color 0.2s, background 0.2s;
      -webkit-tap-highlight-color: transparent;
    }
    #cart-call-btn.show { display: block; }
    #cart-call-btn:active { background: rgba(139,74,47,0.06); border-color: var(--terre, #8B4A2F); }

    #cart-msg {
      font-size: 0.72rem; letter-spacing: 0.02em; text-align: center;
      margin-top: 11px; display: none;
    }
    #cart-msg.show { display: block; }
    #cart-msg.error { color: #B54334; }
    #cart-msg.info  { color: var(--text-soft, #6B5244); font-style: italic; }

    .cart-success { text-align: center; padding: 44px 24px; }
    .cart-success-icon {
      width: 54px; height: 54px; margin: 0 auto 18px;
      border: 1px solid var(--terre, #8B4A2F); border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.5rem; color: var(--terre, #8B4A2F);
    }
    .cart-success-title {
      font-family: 'Cormorant Garamond', serif; font-style: italic;
      font-size: 1.5rem; font-weight: 300; color: var(--text, #2C1F14);
      letter-spacing: 0.04em; margin-bottom: 10px;
    }
    .cart-success-sub {
      font-size: 0.82rem; font-weight: 300; color: var(--text-soft, #6B5244);
      letter-spacing: 0.03em; line-height: 1.6; max-width: 280px; margin: 0 auto;
    }
  `;
  document.head.appendChild(style);

  /* ─── HTML ──────────────────────────────────────────────── */
  document.body.insertAdjacentHTML('beforeend', `
    <button id="cart-pill" aria-label="Voir mon panier">
      <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
      <span id="cart-pill-count"></span><span class="cart-pill-sep"> · </span><span id="cart-pill-total"></span>
    </button>
    <div id="cart-overlay" aria-hidden="true">
      <div id="cart-sheet" role="dialog" aria-label="Mon panier">
        <div id="cart-handle"></div>
        <div id="cart-header">
          <span id="cart-title">Ma commande</span>
          <button id="cart-close-btn" aria-label="Fermer">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div id="cart-items"></div>
        <div id="cart-footer">
          <div class="cart-total-row">
            <span class="cart-total-label">Total</span>
            <span id="cart-total-amount">0&nbsp;€</span>
          </div>
          <p id="cart-resa-notice"></p>
          <div id="cart-table-field">
            <label id="cart-table-label" for="cart-table-input">Numéro de table</label>
            <input id="cart-table-input" type="number" inputmode="numeric" min="1" step="1" placeholder="Votre table" autocomplete="off" />
          </div>
          <button id="cart-pay-btn">Payer</button>
          <button id="cart-call-btn" type="button">Appeler le serveur</button>
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
  const payBtn      = document.getElementById('cart-pay-btn');
  const callBtn     = document.getElementById('cart-call-btn');
  const tableField  = document.getElementById('cart-table-field');
  const tableInput  = document.getElementById('cart-table-input');
  const cartMsg     = document.getElementById('cart-msg');
  const footerEl    = document.getElementById('cart-footer');

  /* ─── Render ────────────────────────────────────────────── */
  function render() {
    const items = loadCart();
    const count = totalItems(items);
    const total = totalPrice(items);

    pillCount.textContent = count + ' ' + (count <= 1 ? 'article' : 'articles');
    pillTotal.textContent = fmtPrice(total);
    pill.classList.toggle('visible', count > 0);
    document.body.classList.toggle('cart-has-items', count > 0);
    totalAmtEl.textContent = fmtPrice(total);
    if (kitchenMode) {
      resaNotice.classList.remove('show');
      payBtn.textContent = 'Envoyer ma commande en cuisine';
    } else if (isReservation && count > 0) {
      const dep = Math.round(total * 0.3 * 100) / 100;
      resaNotice.textContent = 'Acompte 30 % à régler : ' + fmtPrice(dep);
      resaNotice.classList.add('show');
      payBtn.textContent = 'Payer l\'acompte — ' + fmtPrice(dep);
    } else {
      resaNotice.classList.remove('show');
      payBtn.textContent = 'Payer';
    }

    if (!items.length) {
      cartItemsEl.innerHTML = '<p class="cart-empty">Votre panier est vide</p>';
    } else {
      cartItemsEl.innerHTML = items.map((item, i) => `
        <div class="cart-item">
          <div class="cart-item-info">
            <div class="cart-item-name">${escHtml(item.name)}</div>
            <div class="cart-item-sub">${fmtPrice(item.price)} / article</div>
          </div>
          <div class="cart-qty-ctrl">
            <button class="cart-qty-btn" data-action="dec" data-idx="${i}" aria-label="Retirer un">−</button>
            <span class="cart-qty-num">${item.qty}</span>
            <button class="cart-qty-btn" data-action="inc" data-idx="${i}" aria-label="Ajouter un">+</button>
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
    if (kitchenMode) { sendToKitchen(); }
    else             { payStripe(); }
  });

  callBtn.addEventListener('click', callServer);

  /* ─── Paiement Stripe ───────────────────────────────────── */
  async function payStripe() {
    const items = loadCart();
    if (!items.length) return;
    payBtn.disabled = true;
    payBtn.textContent = 'Redirection…';
    try {
      // Restaurant courant + client connecté au Passeport (si dispo)
      let restaurantId = null;
      try { restaurantId = (window.menuAPI && window.menuAPI.restaurantId) || localStorage.getItem('mv_rid'); } catch (_) {}
      const pass = window.MVPassport && window.MVPassport.client;
      const res = await fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          mode: isReservation ? 'reservation' : 'direct',
          reservationId: resaCtx ? resaCtx.id : null,
          restaurantId,
          clientEmail: pass ? pass.email : null,
          clientNom:   pass ? pass.nom   : null
        })
      });
      const data = await res.json();
      console.log('[cart] réponse checkout:', res.status, data);

      if (data.url) {
        // Stripe Checkout → redirection
        window.location.href = data.url;
        return;
      }
      if (data.provider === 'none') {
        // Espèces / sur place — aucun paiement en ligne
        showPayInfo(data.message || 'Paiement sur place — présentez votre commande au service.');
        return;
      }
      if (data.provider === 'cmi' || data.provider === 'payzone') {
        // Passerelle marocaine — règlement sur place en attendant l'intégration redirigée
        showPayInfo('Le règlement s\'effectue sur place. Présentez votre commande au service.');
        return;
      }
      throw new Error(data.error || 'Paiement indisponible.');
    } catch (err) {
      console.error('[cart] erreur paiement:', err);
      payBtn.textContent = 'Erreur — Réessayer';
      payBtn.disabled = false;
    }
  }

  /* Message d'encaissement « sur place » (non Stripe) */
  function showPayInfo(msg) {
    resaNotice.textContent = msg;
    resaNotice.classList.add('show');
    payBtn.textContent = 'Commande prête';
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
    if (table == null) { kitchenMsg('Veuillez indiquer votre numéro de table.', 'error'); return; }

    clearKitchenMsg();
    payBtn.disabled = true;
    const prevLabel = payBtn.textContent;
    payBtn.textContent = 'Envoi en cours…';
    try {
      const plats = items.map(i => ({ nom: i.name, qte: i.qty, prix: i.price }));
      const res = await fetch(RAILWAY + '/commandes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: currentRestaurantId(), table_numero: table, plats })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
        showKitchenSuccess('Votre commande a été transmise — un serveur arrive.');
      } else {
        payBtn.disabled = false;
        payBtn.textContent = prevLabel;
        kitchenMsg(data.error || 'Envoi impossible. Veuillez réessayer.', 'error');
      }
    } catch (err) {
      console.error('[cart] envoi cuisine:', err);
      payBtn.disabled = false;
      payBtn.textContent = prevLabel;
      kitchenMsg('Service momentanément indisponible.', 'error');
    }
  }

  async function callServer() {
    const table = readTableNumber();
    if (table == null) { kitchenMsg('Indiquez votre table pour appeler un serveur.', 'error'); return; }
    kitchenMsg('Un serveur arrive à votre table.', 'info');
  }

  function showKitchenSuccess(msg) {
    cartItemsEl.innerHTML =
      '<div class="cart-success">' +
        '<div class="cart-success-icon">✓</div>' +
        '<p class="cart-success-title">Commande transmise</p>' +
        '<p class="cart-success-sub">' + escHtml(msg) + '</p>' +
      '</div>';
    footerEl.style.display = 'none';
    // Le panier est vidé : masque la pastille flottante.
    pill.classList.remove('visible');
    document.body.classList.remove('cart-has-items');
  }

  // Applique le mode selon le prestataire de paiement du restaurant.
  function applyMode() {
    var provider = null;
    try { provider = window.menuAPI && window.menuAPI.theme && window.menuAPI.theme.payment_provider; } catch (_) {}
    // Mode cuisine : uniquement hors tunnel réservation (l'acompte reste Stripe).
    kitchenMode = (provider === 'none') && !isReservation;

    tableField.classList.toggle('show', kitchenMode);
    callBtn.classList.toggle('show', kitchenMode);
    if (!kitchenMode) clearKitchenMsg();
    render();
  }

  // Le prestataire arrive avec le thème (chargement asynchrone de menu-api.js).
  window.addEventListener('menuApiReady', applyMode);
  if (window.menuAPI && window.menuAPI.ready) applyMode();

  render();
})();
