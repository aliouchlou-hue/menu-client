/**
 * create-checkout.js — Maison Ardent / MenuVision
 *
 * Proxy vers Railway : le routage par prestataire (Stripe / CMI / PayZone /
 * espèces) et la création de session se font côté backend, où les clés du
 * restaurant sont déchiffrées. Aucun secret de paiement ne transite par Netlify.
 *
 * Réponses possibles renvoyées au client :
 *   { provider:'stripe',  url }        → rediriger vers Stripe Checkout
 *   { provider:'none',    message }    → paiement sur place (espèces)
 *   { provider:'cmi',     ... }        → paramètres CMI
 *   { provider:'payzone', ... }        → paramètres PayZone
 */

const RAILWAY = 'https://menuvision-production.up.railway.app';

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  let parsed;
  try {
    parsed = JSON.parse(event.body || '{}');
  } catch (_) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Corps JSON invalide' }) };
  }

  const { items, mode, reservationId, restaurantId, clientEmail, clientNom } = parsed;
  if (!Array.isArray(items) || items.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Panier vide' }) };
  }

  // Origine du site (pour les URLs de retour Stripe)
  const origin =
    event.headers.origin ||
    (event.headers.referer ? (() => { try { return new URL(event.headers.referer).origin; } catch (_) { return null; } })() : null) ||
    process.env.URL ||
    'https://maison-ardent.netlify.app';

  try {
    const r = await fetch(RAILWAY + '/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': origin },
      body: JSON.stringify({ items, mode, reservationId, restaurantId, clientEmail, clientNom }),
    });
    const data = await r.json().catch(() => ({ error: 'Réponse invalide du serveur de paiement' }));
    return { statusCode: r.ok ? 200 : (r.status || 500), headers, body: JSON.stringify(data) };
  } catch (err) {
    console.error('[create-checkout] proxy error:', err.message);
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Service de paiement momentanément indisponible.' }) };
  }
};
