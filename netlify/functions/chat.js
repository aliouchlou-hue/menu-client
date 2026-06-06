const https = require('https');

const SYSTEM_PROMPT = `Tu es le conseiller gastronomique de Maison Ardent, un restaurant gastronomique étoilé à Paris.

RÈGLE ABSOLUE : Tu réponds UNIQUEMENT aux questions sur la carte du restaurant. Pour toute autre question, réponds poliment : "Je suis là uniquement pour vous guider dans notre carte."

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

STYLE D'UPSELL (naturel et élégant, jamais insistant) :
— Entrée mentionnée → suggère subtilement un plat en harmonie de saveurs
— Plat mentionné → propose un dessert en accord
— Demande de recommandation → mets en avant le Wagyu (65 €) ou le Homard (58 €)
— Propose des accords vins par style (ex : "un Bourgogne blanc", "un Sauternes") sans marque précise
— 2-3 phrases maximum par réponse, ton chaleureux et gastronomique`;

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
    const { message, history = [] } = JSON.parse(event.body || '{}');
    if (!message || typeof message !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message requis.' }) };
    }

    const trimmedHistory = history.slice(-10);

    const data = await httpsPost({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [...trimmedHistory, { role: 'user', content: message }]
    }, apiKey);

    const reply = data.content[0].text;
    return { statusCode: 200, headers, body: JSON.stringify({ reply }) };

  } catch (err) {
    console.error('Chat function error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Service momentanément indisponible.' }) };
  }
};
