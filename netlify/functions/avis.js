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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let rating, comment;
  try {
    ({ rating, comment } = JSON.parse(event.body || '{}'));
  } catch (_) {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON invalide' }) };
  }

  const stars = '★'.repeat(rating || 0) + '☆'.repeat(5 - (rating || 0));
  console.log(`[avis] ${stars} (${rating}/5) | commentaire : ${comment || '(aucun)'}`);

  /* ── Notification restaurant (à implémenter) ────────────────
  if (rating <= 3 && comment) {
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `⚠️ Avis ${rating}/5 reçu :\n_"${comment}"_`
      })
    });
  }
  ── */

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };
};
