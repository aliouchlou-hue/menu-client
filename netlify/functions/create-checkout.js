/**
 * create-checkout.js — Maison Ardent
 * Crée une session Stripe Checkout.
 *
 * IMPORTANT : STRIPE_SECRET_KEY doit être configurée dans Netlify
 *   Site settings → Environment variables → Add variable
 *
 * Actuellement en MODE TEST : montant fixe 20 € (2000 cts) pour valider
 * la connexion Stripe. Décommentez la section "PRODUCTION" pour le vrai calcul.
 */

exports.handler = async (event) => {
  console.log('[checkout] ─── nouvelle requête ───');
  console.log('[checkout] méthode:', event.httpMethod);
  console.log('[checkout] headers origin:', event.headers.origin);
  console.log('[checkout] headers referer:', event.headers.referer);

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  /* ── 1. Vérification de la clé Stripe ────────────────────── */
  const key = process.env.STRIPE_SECRET_KEY;
  console.log('[checkout] STRIPE_SECRET_KEY présente :', !!key);
  if (key) {
    console.log('[checkout] STRIPE_SECRET_KEY preview  :', key.slice(0, 8) + '…');
  }

  if (!key) {
    console.error('[checkout] ERREUR : STRIPE_SECRET_KEY absente');
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'STRIPE_SECRET_KEY absente — configurez-la dans Site settings → Environment variables sur Netlify, puis redéployez.',
      }),
    };
  }

  /* ── 2. Parse du body ─────────────────────────────────────── */
  let parsed;
  try {
    parsed = JSON.parse(event.body || '{}');
    console.log('[checkout] body reçu :', JSON.stringify(parsed));
  } catch (parseErr) {
    console.error('[checkout] JSON invalide :', parseErr.message);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Corps JSON invalide' }),
    };
  }

  const { items, mode, reservationId } = parsed;
  console.log('[checkout] items :', JSON.stringify(items));
  console.log('[checkout] mode :', mode, '| reservationId :', reservationId);

  if (!Array.isArray(items) || items.length === 0) {
    console.error('[checkout] panier vide');
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Panier vide' }),
    };
  }

  /* ── 3. Init Stripe (après la vérif de la clé) ────────────── */
  let stripe;
  try {
    stripe = require('stripe')(key);
    console.log('[checkout] client Stripe initialisé');
  } catch (initErr) {
    console.error('[checkout] échec init Stripe :', initErr.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Impossible d\'initialiser Stripe : ' + initErr.message }),
    };
  }

  /* ── 4. URL de retour ─────────────────────────────────────── */
  const origin =
    event.headers.origin ||
    (event.headers.referer ? (() => { try { return new URL(event.headers.referer).origin; } catch (_) { return null; } })() : null) ||
    process.env.URL ||
    'https://maison-ardent.netlify.app';
  console.log('[checkout] origin résolu :', origin);

  /* ── 5. Ligne(s) de paiement ─────────────────────────────── */

  // ── MODE TEST : montant fixe 2000 centimes (20 €) ──────────
  // Permet de valider la connexion Stripe indépendamment du panier.
  // Décommentez le bloc PRODUCTION ci-dessous et supprimez ces lignes
  // une fois le premier paiement test réussi.
  const lineItems = [
    {
      price_data: {
        currency: 'eur',
        product_data: { name: 'Test paiement — Maison Ardent' },
        unit_amount: 2000,
      },
      quantity: 1,
    },
  ];
  console.log('[checkout] line_items (TEST 2000 cts) :', JSON.stringify(lineItems));

  // ── MODE PRODUCTION (décommenter quand Stripe est validé) ───
  // const isDeposit = mode === 'reservation';
  // const total     = items.reduce((s, i) => s + i.price * i.qty, 0);
  // console.log('[checkout] total calculé :', total);
  // const lineItems = isDeposit
  //   ? [{
  //       price_data: {
  //         currency: 'eur',
  //         product_data: {
  //           name: 'Acompte réservation — Maison Ardent',
  //           description: `30 % sur votre pré-commande (total : ${total.toFixed(2).replace('.', ',')} €)`,
  //         },
  //         unit_amount: Math.round(total * 0.3 * 100),
  //       },
  //       quantity: 1,
  //     }]
  //   : items.map(item => ({
  //       price_data: {
  //         currency: 'eur',
  //         product_data: { name: item.name },
  //         unit_amount: Math.round(item.price * 100),
  //       },
  //       quantity: item.qty,
  //     }));

  /* ── 6. Création de la session Stripe ────────────────────── */
  const sessionParams = {
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    success_url: `${origin}/entrees.html?payment=success`,
    cancel_url:  `${origin}/entrees.html?payment=cancelled`,
  };

  if (reservationId) {
    sessionParams.metadata = {
      reservation_id: String(reservationId),
      payment_mode:   mode || 'direct',
    };
  }

  console.log('[checkout] sessionParams :', JSON.stringify(sessionParams));

  try {
    const session = await stripe.checkout.sessions.create(sessionParams);
    console.log('[checkout] session créée :', session.id);
    console.log('[checkout] redirect url  :', session.url);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error('[checkout] ERREUR Stripe ─────────────');
    console.error('[checkout] type    :', err.type);
    console.error('[checkout] code    :', err.code);
    console.error('[checkout] param   :', err.param);
    console.error('[checkout] message :', err.message);
    console.error('[checkout] raw     :', JSON.stringify(err.raw || {}));
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error:   err.message,
        type:    err.type,
        code:    err.code,
        param:   err.param,
      }),
    };
  }
};
