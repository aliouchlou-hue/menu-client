const https = require('https');

function buildSystem(ctx) {
  let extra = '';
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

const REGLE = `RÈGLE ABSOLUE : Tu réponds UNIQUEMENT aux questions sur la carte du restaurant. Pour toute autre question, réponds poliment : "Je suis là uniquement pour vous guider dans notre carte."`;

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
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'Service non configuré.' }) };
  }

  try {
    const { message, history = [], context = null } = JSON.parse(event.body || '{}');
    if (!message || typeof message !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message requis.' }) };
    }

    const trimmedHistory = history.slice(-10);

    const data = await httpsPost({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: buildSystem(context),
      messages: [...trimmedHistory, { role: 'user', content: message }]
    }, apiKey);

    const reply = data.content[0].text;
    return { statusCode: 200, headers, body: JSON.stringify({ reply }) };

  } catch (err) {
    console.error('Chat function error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Service momentanément indisponible.' }) };
  }
};
