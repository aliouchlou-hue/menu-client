/**
 * avis.js — Maison Ardent
 * Reçoit les avis clients envoyés depuis le tiroir panier.
 *
 * Payload : { rating: 1-5, comment: string }
 * - 4 ou 5 étoiles : comment est vide (redirection Google)
 * - 1, 2 ou 3 étoiles : comment contient le retour client
 *
 * TODO : connecter à un service de notification
 *   - Email  : SendGrid / Mailgun → envoyer à contact@maison-ardent.fr
 *   - Slack  : webhook → canal #avis-clients
 *   - CRM    : webhook custom
 */

const RAILWAY = 'https://menuvision-production.up.railway.app';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let rating, comment, restaurant_id, plat_nom;
  try {
    ({ rating, comment, restaurant_id, plat_nom } = JSON.parse(event.body || '{}'));
  } catch (_) {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON invalide' }) };
  }

  const stars = '★'.repeat(rating || 0) + '☆'.repeat(5 - (rating || 0));
  console.log(`[avis] ${stars} (${rating}/5) | resto:${restaurant_id || '—'} | commentaire : ${comment || '(aucun)'}`);

  // Transmettre l'avis au backend MenuVision → remonte dans le dashboard restaurateur
  try {
    const r = await fetch(RAILWAY + '/avis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant_id: restaurant_id || null,
        plat_nom:      plat_nom || 'Avis général',
        note:          rating,
        commentaire:   comment || '',
      }),
    });
    if (!r.ok) console.error('[avis] backend a répondu', r.status);
  } catch (err) {
    console.error('[avis] échec transmission backend:', err.message);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };
};
