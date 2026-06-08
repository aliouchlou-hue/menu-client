/**
 * reservation-mode.js — Maison Ardent
 *
 * Détecte ?mode=reservation&reservation_id=XXX&date=...&heure=...&pers=...&back=URL
 * Affiche un bandeau, suit le panier et envoie les pré-commandes à Railway.
 *
 * Ce script peut être inclus dans toutes les pages sans effet si le mode n'est pas actif.
 */

(function () {
  const RAILWAY = 'https://menuvision-production.up.railway.app';

  // ── 1. Charger le contexte (URL params → sessionStorage → pages suivantes) ──
  const p = new URLSearchParams(location.search);
  let ctx = null;

  if (p.get('mode') === 'reservation' && p.get('reservation_id')) {
    ctx = {
      id:    p.get('reservation_id'),
      date:  p.get('date')  || '',
      heure: p.get('heure') || '',
      pers:  p.get('pers')  || '',
      back:  p.get('back')  || '',
    };
    try { sessionStorage.setItem('resaCtx', JSON.stringify(ctx)); } catch (_) {}
    // Nettoyer le panier si on recommence une session
    try { sessionStorage.removeItem('resaCart'); } catch (_) {}
  } else {
    try { ctx = JSON.parse(sessionStorage.getItem('resaCtx') || 'null'); } catch (_) {}
  }

  if (!ctx || !ctx.id) return; // Pas de contexte réservation → rien à faire

  // ── 2. Panier (sessionStorage) ───────────────────────────────────────────────
  let cart = {};
  try { cart = JSON.parse(sessionStorage.getItem('resaCart') || '{}'); } catch (_) {}

  function totalItems() {
    return Object.values(cart).reduce((s, q) => s + q, 0);
  }

  function saveCart() {
    try { sessionStorage.setItem('resaCart', JSON.stringify(cart)); } catch (_) {}
    updateFab();
  }

  // ── 3. Formater la date ────────────────────────────────────────────────────
  function fmtDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  // ── 4. Injecter les styles ─────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #resa-banner {
      background: #8B4A2F;
      color: #fff;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      font-family: 'Montserrat', system-ui, sans-serif;
      font-weight: 300;
      position: relative;
      z-index: 200;
    }
    #resa-banner-left {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .resa-banner-icon {
      font-size: 1.1rem;
      color: rgba(255,255,255,0.7);
      flex-shrink: 0;
    }
    .resa-banner-title {
      font-size: 0.72rem;
      font-weight: 400;
      letter-spacing: 0.04em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .resa-banner-sub {
      font-size: 0.6rem;
      color: rgba(255,255,255,0.7);
      letter-spacing: 0.06em;
      margin-top: 2px;
    }
    #resa-cart-badge {
      background: rgba(255,255,255,0.18);
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 20px;
      padding: 4px 12px;
      font-size: 0.62rem;
      letter-spacing: 0.06em;
      white-space: nowrap;
      flex-shrink: 0;
      font-weight: 400;
    }
    #resa-fab-wrap {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 40;
      padding: 12px 16px 20px;
      background: linear-gradient(to top, rgba(16,10,5,0.22) 0%, transparent 100%);
      pointer-events: none;
    }
    #resa-confirm-btn {
      width: 100%;
      max-width: 420px;
      display: block;
      margin: 0 auto;
      background: #8B4A2F;
      color: #fff;
      border: none;
      border-radius: 2px;
      padding: 16px 24px;
      font-family: 'Montserrat', system-ui, sans-serif;
      font-size: 0.72rem;
      font-weight: 400;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      cursor: pointer;
      pointer-events: all;
      transition: background 0.2s, transform 0.12s;
      box-shadow: 0 4px 24px rgba(16,10,5,0.28);
    }
    #resa-confirm-btn:hover  { background: #A85A3A; }
    #resa-confirm-btn:active { transform: scale(0.985); }
    #resa-confirm-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
    .resa-btn-count {
      background: rgba(255,255,255,0.18);
      border-radius: 10px;
      padding: 1px 8px;
      margin-left: 8px;
      font-size: 0.68rem;
    }
    /* Espace pour le FAB au bas des pages */
    body { padding-bottom: 88px !important; }
  `;
  document.head.appendChild(style);

  // ── 5. Injecter le bandeau ─────────────────────────────────────────────────
  const dateSub = [
    ctx.date  ? `du ${fmtDate(ctx.date)}`       : '',
    ctx.heure ? `à ${ctx.heure}`                : '',
    ctx.pers  ? `· ${ctx.pers} pers.`           : '',
  ].filter(Boolean).join(' ');

  const banner = document.createElement('div');
  banner.id = 'resa-banner';
  banner.innerHTML = `
    <div id="resa-banner-left">
      <span class="resa-banner-icon">✦</span>
      <div>
        <div class="resa-banner-title">Pré-commande pour votre réservation</div>
        ${dateSub ? `<div class="resa-banner-sub">${escHtml(dateSub)}</div>` : ''}
      </div>
    </div>
    <span id="resa-cart-badge">${badgeText()}</span>
  `;

  // Insérer au tout début du body
  document.body.insertBefore(banner, document.body.firstChild);

  // ── 6. Bouton FAB "Confirmer ma sélection" ─────────────────────────────────
  const fab = document.createElement('div');
  fab.id = 'resa-fab-wrap';
  fab.innerHTML = `
    <button id="resa-confirm-btn">
      Confirmer ma sélection<span class="resa-btn-count" id="resa-btn-count">${totalItems() || ''}</span>
    </button>
  `;
  document.body.appendChild(fab);

  document.getElementById('resa-confirm-btn').addEventListener('click', async () => {
    const btn = document.getElementById('resa-confirm-btn');
    btn.disabled = true;
    btn.textContent = 'Envoi en cours…';

    // POST final si panier non vide
    const precommandes = Object.entries(cart).map(([plat_nom, quantite]) => ({ plat_nom, quantite }));
    if (precommandes.length) {
      try {
        await fetch(`${RAILWAY}/reservations/${ctx.id}/precommandes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ precommandes }),
          mode: 'cors',
        });
      } catch (e) {
        console.error('Erreur envoi pré-commande :', e);
      }
    }

    // Nettoyer la session et rediriger
    try { sessionStorage.removeItem('resaCart'); } catch (_) {}
    try { sessionStorage.removeItem('resaCtx'); } catch (_) {}

    if (ctx.back) {
      window.location.href = ctx.back;
    } else {
      window.location.href = RAILWAY + '/reserver';
    }
  });

  // ── 7. Intercepter le bouton "Ajouter à ma commande" / "Ajouter à ma sélection" ──
  function hookBtnAdd() {
    const btn = document.getElementById('btnAdd');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const name = document.getElementById('modalName')?.textContent?.trim();
      if (!name) return;

      cart[name] = (cart[name] || 0) + 1;
      saveCart();

      // POST progressif (fire-and-forget)
      const precommandes = Object.entries(cart).map(([plat_nom, quantite]) => ({ plat_nom, quantite }));
      fetch(`${RAILWAY}/reservations/${ctx.id}/precommandes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ precommandes }),
        mode: 'cors',
      }).catch(console.error);
    });
  }

  // DOM peut être déjà prêt ou pas encore
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hookBtnAdd);
  } else {
    hookBtnAdd();
  }

  // ── 8. Helpers ─────────────────────────────────────────────────────────────
  function badgeText() {
    const n = totalItems();
    return n === 0 ? '0 plat' : n === 1 ? '1 plat' : `${n} plats`;
  }

  function updateFab() {
    const badge = document.getElementById('resa-cart-badge');
    const count = document.getElementById('resa-btn-count');
    const n     = totalItems();
    if (badge) badge.textContent = badgeText();
    if (count) count.textContent = n > 0 ? n : '';
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Sync badge au chargement (si panier existant depuis une autre page)
  updateFab();
})();
