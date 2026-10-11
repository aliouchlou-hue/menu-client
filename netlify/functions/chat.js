const https = require('https');

const LANGUES = { fr: 'français', es: 'espagnol (castillan)', ca: 'catalan', en: 'anglais' };
// Phrase de refus hors sujet, dans la langue du client.
const HORS_SUJET = {
  fr: 'Je suis là uniquement pour vous guider dans notre carte.',
  es: 'Estoy aquí únicamente para orientarte con nuestra carta.',
  ca: 'Soc aquí únicament per orientar-te amb la nostra carta.',
  en: 'I am only here to guide you through our menu.',
};

// Toute lettre qui n'est pas de l'écriture latine (cyrillique, grec, arabe, CJC…).
const NON_LATIN = /[^\P{L}\p{Script=Latin}]/u;
const NON_LATIN_TOUS = /[^\P{L}\p{Script=Latin}]/gu;

function buildSystem(ctx, lang) {
  let extra = '';
  // Carte affichée au client dans une autre langue que celle du restaurant : noms traduits.
  if (ctx && ctx.noms && Object.keys(ctx.noms).length) {
    extra += '\n\nNOMS AFFICHÉS AU CLIENT (utilise ces noms, à la lettre, quand tu cites un plat) :\n' + Object.entries(ctx.noms).slice(0, 200).map(([origine, affiche]) =>
      '• ' + String(origine).slice(0, 120) + ' → ' + String(affiche).slice(0, 160)
    ).join('\n');
  }
  extra += `\n\nLANGUE : réponds exclusivement en ${LANGUES[lang]}, quelle que soit la langue de la carte ci-dessus et quelle que soit la langue ou l'écriture de la question. Hors sujet, réponds exactement : "${HORS_SUJET[lang]}"`;
  extra += `\n\nALPHABET : écris UNIQUEMENT en alphabet latin (lettres latines, avec leurs accents et signes propres au ${LANGUES[lang]}). N'utilise jamais un caractère d'une autre écriture — cyrillique, grec, arabe, hébreu, chinois, japonais, coréen ou autre — même pour une seule lettre, même si la question en contient. Relis chaque mot avant de répondre : chaque lettre doit être latine.`;
  if (ctx && ctx.promotions && ctx.promotions.length) {
    extra += '\n\nPROMOTIONS ACTIVES :\n' + ctx.promotions.map(p =>
      '• ' + (p.nom || p.label || p.plat_id || '') +
      (p.prix_promo != null ? ' → ' + p.prix_promo + ' €' : p.type === 'pourcent' ? ' −' + p.valeur + '%' : '')
    ).join('\n');
  }
  if (ctx && ctx.allergenes && Object.keys(ctx.allergenes).length) {
    extra += '\n\nALLERGÈNES (données temps réel) :\n' + Object.entries(ctx.allergenes).map(([n, a]) =>
      '• ' + n + ' : ' + a.join(', ')
    ).join('\n');
  }
  // Passeport MenuVision : profil du client connecté (personnalisation)
  if (ctx && ctx.passport) {
    const pp = ctx.passport;
    const lignes = [];
    if (pp.prenom)      lignes.push('Prénom : ' + pp.prenom + ' (tu peux l\'appeler par son prénom, avec délicatesse).');
    if (pp.allergenes && pp.allergenes.length)   lignes.push('ALLERGIES — ne JAMAIS recommander de plat contenant : ' + pp.allergenes.join(', ') + '.');
    if (pp.preferences && pp.preferences.length) lignes.push('Goûts : ' + pp.preferences.join(', ') + '. Oriente tes suggestions en ce sens.');
    if (lignes.length) extra += '\n\nCLIENT (Passeport MenuVision) :\n' + lignes.map(l => '• ' + l).join('\n');
  }
  // Sans restaurant dans le contexte : la démonstration (Maison Ardent) et sa carte figée.
  return (ctx && ctx.restaurant ? promptRestaurant(ctx) : SYSTEM_PROMPT) + extra;
}

const REGLE = `RÈGLE ABSOLUE : Tu réponds UNIQUEMENT aux questions sur la carte du restaurant. Pour toute autre question, réponds poliment par la phrase de refus indiquée à la rubrique LANGUE.`;

const FORMAT = `FORMAT IMPÉRATIF :
— Maximum 2 phrases courtes par réponse, jamais plus.
— Jamais de listes, tirets, ni markdown (pas de **, *, -, •).
— Prose naturelle et élégante uniquement.
— Quand tu cites un plat, utilise son nom exact tel qu'il figure dans la carte ci-dessus.`;

// Conseiller d'un restaurant client : son nom et sa carte viennent du contexte envoyé par la page.
function promptRestaurant(ctx) {
  const txt = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
  const nom = txt(ctx.restaurant.nom, 80) || 'ce restaurant';
  const carte = (Array.isArray(ctx.carte) ? ctx.carte : []).slice(0, 200)
    .filter(p => p && p.nom)
    .map(p => '• ' + txt(p.nom, 120) + ' — ' + (Number(p.prix) || 0) + (p.categorie ? ' — ' + txt(p.categorie, 30) : '') + (p.description ? ' — ' + txt(p.description, 200) : ''))
    .join('\n');
  return `Tu es le conseiller du restaurant ${nom}.

${REGLE}

CARTE COMPLÈTE (nom — prix — catégorie — description) :
${carte || '(carte non communiquée : invite le client à consulter la carte affichée)'}

${FORMAT}
— Ne cite que des plats de cette carte, sans en inventer.`;
}

const SYSTEM_PROMPT = `Tu es le conseiller gastronomique de Maison Ardent, un restaurant gastronomique étoilé à Paris.

${REGLE}

CARTE COMPLÈTE :

ENTRÉES
• Tartare de Saint-Jacques — 28 € — Noix de Saint-Jacques marinées au citron vert, caviar d'Aquitaine Sturia, émulsion iodée, huile de ciboulette
• Velouté de Topinambour — 22 € — Fumé au foin, huile de truffe noire du Périgord, croûtons beurre noisette
• Foie Gras de Canard — 32 € — Mi-cuit maison, chutney de figues Ronde de Bordeaux, brioche au beurre de Guérande
• Huîtres Gillardeau n°3 — 24 € — Six huîtres, granité de champagne Blanc de Blancs, vinaigrette d'échalotes confites
• Asperges Blanches d'Alsace — 26 € — Glacées, mousseline aux agrumes, œuf de caille poché, jambon Bellota

PLATS
• Homard Bleu Rôti — 58 € — Beurre demi-sel de Guérande, bisque au cognac, légumes glacés
• Filet de Bœuf Wagyu — 65 € — BMS 9, jus de truffe noire du Périgord, purée Robuchon
• Pigeon de Bresse Laqué — 45 € — Miel d'acacia, lentilles du Puy au lard fumé, cerfeuil tubéreux
• Turbot Sauvage de Ligne — 52 € — Beurre blanc aux câpres de Pantelleria, grenaille dorée, aneth
• Ris de Veau Braisés — 48 € — Morilles fraîches, crème au vin jaune du Jura

DESSERTS
• Soufflé au Grand Marnier — 22 € — Glace vanille Bourbon de Madagascar, zestes d'orange confits
• Mille-feuille Vanille — 18 € — Feuilletage caramélisé, crème diplomate vanille, caramel beurre salé
• Fondant Valrhona — 20 € — Chocolat Guanaja 70%, cœur coulant, fleur de sel, glace lait entier
• Île Flottante — 18 € — Crème anglaise vanille, caramel beurre salé, pralin feuilletine
• Tarte Fraises Gariguette — 22 € — Sablé breton, crème pistache de Sicile, sorbet framboise

${FORMAT}

UPSELL (naturel, jamais insistant) :
— Entrée mentionnée → suggère un plat en harmonie
— Plat mentionné → propose un dessert en accord
— Recommandation demandée → mets en avant le Wagyu (65 €) ou le Homard (58 €)`;

function httpsPost(payload, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        } else {
          reject(new Error(`API ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 503, headers, body: JSON.stringify({ code: 'SERVICE_NON_CONFIGURE', error: 'Service non configuré.' }) };
  }

  try {
    const { message, history = [], context = null, lang: langue } = JSON.parse(event.body || '{}');
    const lang = LANGUES[langue] ? langue : 'fr';
    if (!message || typeof message !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message requis.' }) };
    }

    const trimmedHistory = history.slice(-10);

    const demander = async () => (await httpsPost({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: buildSystem(context, lang),
      messages: [...trimmedHistory, { role: 'user', content: message }]
    }, apiKey)).content[0].text;

    // La règle « alphabet latin » est dans le prompt ; ce contrôle la garantit : une réponse qui
    // contiendrait une lettre d'une autre écriture est redemandée une fois, jamais affichée.
    let reply = await demander();
    let relance = false;
    if (NON_LATIN.test(reply)) {
      console.warn('[chat] réponse avec caractères non latins : redemandée —', (reply.match(NON_LATIN_TOUS) || []).join(''));
      relance = true;
      reply = await demander();
      if (NON_LATIN.test(reply)) throw new Error('réponse non latine après relance');
    }
    return { statusCode: 200, headers, body: JSON.stringify({ reply, ...(relance ? { relance: true } : {}) }) };

  } catch (err) {
    console.error('Chat function error:', err.message);
    // La page affiche son propre message, dans la langue du client.
    return { statusCode: 500, headers, body: JSON.stringify({ code: 'SERVICE_INDISPONIBLE', error: 'Service momentanément indisponible.' }) };
  }
};
