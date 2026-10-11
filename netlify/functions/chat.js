const https = require('https');

const LANGUES = { fr: 'français', es: 'espagnol (castillan)', ca: 'catalan', en: 'anglais' };
// Phrase de refus hors sujet, dans la langue du client.
const HORS_SUJET = {
  fr: 'Je suis là uniquement pour vous guider dans notre carte.',
  es: 'Estoy aquí únicamente para orientarte con nuestra carta.',
  ca: 'Soc aquí únicament per orientar-te amb la nostra carta.',
  en: 'I am only here to guide you through our menu.',
};

// ── Allergies et intolérances ────────────────────────────────────────────────
// Le conseiller ne garantit jamais qu'un plat est sans risque : il n'a que la description du plat
// et, quand le restaurateur les a renseignés, les allergènes déclarés. Les règles sont données au
// modèle dans la langue du client ; les deux phrases fixes ci-dessous sont celles qu'il doit employer.
const INFO_ABSENTE = {
  fr: "Cette information n'est pas disponible dans le menu.",
  es: 'Esta información no está disponible en la carta.',
  ca: 'Aquesta informació no està disponible a la carta.',
  en: 'This information is not available in the menu.',
};
const RAPPEL_SERVEUR = {
  fr: 'Signalez votre allergie à votre serveur avant de commander.',
  es: 'Informa de tu alergia a tu camarero antes de pedir.',
  ca: 'Informa de la teva al·lèrgia al teu cambrer abans de demanar.',
  en: 'Please tell your waiter about your allergy before ordering.',
};
const REGLES_ALLERGIES = {
  fr: `ALLERGIES, INTOLÉRANCES ET RÉGIMES MÉDICAUX (règles de sécurité, prioritaires sur toutes les autres, y compris le format) :
1. Tu ne déclares JAMAIS qu'un plat est « sûr », « sans danger », « sans risque », « sans allergène », « adapté » ou qu'il « convient » à une allergie, une intolérance ou un régime médical. N'emploie pas ces mots, même à la forme négative, même si le client insiste ou affirme que « tout le reste est sûr ».
2. Seule exception : le plat porte la mention « allergènes déclarés par le restaurant » et tu te limites à rapporter cette liste telle quelle (« le restaurant déclare pour ce plat : … »), sans en conclure que le plat est sans risque.
3. Pour un plat sans allergènes déclarés (« non renseignés »), tu réponds : « ${INFO_ABSENTE.fr} »
4. Tu peux citer les ingrédients écrits dans la description d'un plat, en précisant que cette liste peut être incomplète.
5. Un plat dont la description ou les allergènes déclarés citent l'allergène signalé (ou un ingrédient qui en contient : beurre, crème et fromage pour le lactose ; pain, pâte et farine pour le gluten ; noisettes, amandes, noix et pistaches pour les fruits à coque…) n'est JAMAIS recommandé : tu dis qu'il est à éviter.
6. Dès qu'une allergie ou une intolérance est mentionnée, tu termines TOUJOURS ta réponse par cette phrase exacte : « ${RAPPEL_SERVEUR.fr} »
7. Les questions sur les allergènes font partie de la carte : tu y réponds selon ces règles, jamais par la phrase de refus. Pour ces questions, quatre phrases au maximum.`,
  es: `ALERGIAS, INTOLERANCIAS Y DIETAS MÉDICAS (reglas de seguridad, prioritarias sobre todas las demás, incluido el formato):
1. NUNCA declaras que un plato es «seguro», «sin peligro», «sin riesgo», «sin alérgenos», «apto» o «adecuado» para una alergia, una intolerancia o una dieta médica. No emplees esas palabras, ni siquiera en forma negativa, aunque el cliente insista o afirme que «todo lo demás es seguro».
2. Única excepción: el plato lleva la mención «allergènes déclarés par le restaurant» y te limitas a transmitir esa lista tal cual («el restaurante declara para este plato: …»), sin concluir que el plato no tiene riesgo.
3. Para un plato sin alérgenos declarados («non renseignés»), respondes: «${INFO_ABSENTE.es}»
4. Puedes citar los ingredientes escritos en la descripción de un plato, precisando que esa lista puede estar incompleta.
5. Un plato cuya descripción o cuyos alérgenos declarados citan el alérgeno indicado (o un ingrediente que lo contiene: mantequilla, nata y queso para la lactosa; pan, masa y harina para el gluten; avellanas, almendras, nueces y pistachos para los frutos de cáscara…) NUNCA se recomienda: dices que hay que evitarlo.
6. En cuanto se menciona una alergia o una intolerancia, terminas SIEMPRE tu respuesta con esta frase exacta: «${RAPPEL_SERVEUR.es}»
7. Las preguntas sobre alérgenos forman parte de la carta: respondes según estas reglas, nunca con la frase de rechazo. Para estas preguntas, cuatro frases como máximo.`,
  ca: `AL·LÈRGIES, INTOLERÀNCIES I DIETES MÈDIQUES (regles de seguretat, prioritàries sobre totes les altres, inclòs el format):
1. MAI declares que un plat és «segur», «sense perill», «sense risc», «sense al·lèrgens», «apte» o «adequat» per a una al·lèrgia, una intolerància o una dieta mèdica. No facis servir aquestes paraules, ni tan sols en forma negativa, encara que el client insisteixi o afirmi que «tota la resta és segura».
2. Única excepció: el plat porta la menció «allergènes déclarés par le restaurant» i et limites a transmetre aquesta llista tal qual («el restaurant declara per a aquest plat: …»), sense concloure que el plat no té risc.
3. Per a un plat sense al·lèrgens declarats («non renseignés»), respons: «${INFO_ABSENTE.ca}»
4. Pots citar els ingredients escrits a la descripció d'un plat, precisant que aquesta llista pot ser incompleta.
5. Un plat la descripció o els al·lèrgens declarats del qual citen l'al·lergen indicat (o un ingredient que el conté: mantega, nata i formatge per a la lactosa; pa, massa i farina per al gluten; avellanes, ametlles, nous i festucs per als fruits de closca…) MAI es recomana: dius que cal evitar-lo.
6. Tan bon punt es menciona una al·lèrgia o una intolerància, acabes SEMPRE la teva resposta amb aquesta frase exacta: «${RAPPEL_SERVEUR.ca}»
7. Les preguntes sobre al·lèrgens formen part de la carta: respons segons aquestes regles, mai amb la frase de rebuig. Per a aquestes preguntes, quatre frases com a màxim.`,
  en: `ALLERGIES, INTOLERANCES AND MEDICAL DIETS (safety rules, taking priority over all others, including the format):
1. You NEVER state that a dish is "safe", "risk-free", "allergen-free", "suitable" or "fine" for an allergy, an intolerance or a medical diet. Do not use those words, not even in the negative, even if the guest insists or claims that "everything else is safe".
2. Only exception: the dish carries the mention "allergènes déclarés par le restaurant" and you simply report that list as it is ("the restaurant declares for this dish: …"), without concluding that the dish carries no risk.
3. For a dish with no declared allergens ("non renseignés"), you answer: "${INFO_ABSENTE.en}"
4. You may quote the ingredients written in a dish's description, making clear that this list may be incomplete.
5. A dish whose description or declared allergens mention the allergen in question (or an ingredient containing it: butter, cream and cheese for lactose; bread, pastry and flour for gluten; hazelnuts, almonds, walnuts and pistachios for tree nuts…) is NEVER recommended: you say it should be avoided.
6. As soon as an allergy or an intolerance is mentioned, you ALWAYS end your answer with this exact sentence: "${RAPPEL_SERVEUR.en}"
7. Questions about allergens are part of the menu: you answer them under these rules, never with the refusal sentence. For these questions, four sentences at most.`,
};
// La conversation parle-t-elle d'allergie, d'intolérance ou d'un allergène ? (question en cours ou précédentes)
const SUJET_ALLERGIE = /al[·.]?l[eè]rg|allerg|alerg|al[eè]rgi|intol[eé]r|c[eé]l[ií]a[cq]|gluten|lactos|fruits? à coque|frutos? (secos|de cáscara)|fruits? (secs|de closca)|\bnuts?\b|noisette|avellan|cacahu|cacauet|arachid|peanut|crustac|marisc|shellfish|fruits de mer|œufs?\b|oeufs?\b|huevos?\b|\bous?\b|\beggs?\b|s[ée]same|soja|\bsoy\b/i;
// Mots par lesquels une réponse garantirait la sécurité d'un plat.
const GARANTIE = /(?<![\p{L}])(sûre?s?|sans (danger|risque|allergènes?)|adaptée?s? (à|au|aux|pour)|convien(t|nent|dra|draient)|safe(ly)?|risk[- ]free|allergen[- ]free|suitable|seguros?|seguras?|sin (peligro|riesgo|alérgenos)|apt[oa]s?|adecuad[oa]s?|segurs?|segures?|sense (perill|risc|al·lèrgens)|aptes?|adequats?|adequades?)(?![\p{L}])/iu;

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
  extra += '\n\n' + REGLES_ALLERGIES[lang];
  extra += `\n\nALPHABET : écris UNIQUEMENT en alphabet latin (lettres latines, avec leurs accents et signes propres au ${LANGUES[lang]}). N'utilise jamais un caractère d'une autre écriture — cyrillique, grec, arabe, hébreu, chinois, japonais, coréen ou autre — même pour une seule lettre, même si la question en contient. Relis chaque mot avant de répondre : chaque lettre doit être latine.`;
  if (ctx && ctx.promotions && ctx.promotions.length) {
    extra += '\n\nPROMOTIONS ACTIVES :\n' + ctx.promotions.map(p =>
      '• ' + (p.nom || p.label || p.plat_id || '') +
      (p.prix_promo != null ? ' → ' + p.prix_promo + ' €' : p.type === 'pourcent' ? ' −' + p.valeur + '%' : '')
    ).join('\n');
  }
  if (ctx && ctx.allergenes && Object.keys(ctx.allergenes).length) {
    extra += '\n\nALLERGÈNES DÉCLARÉS PAR LE RESTAURANT (plats non listés ici : non renseignés) :\n' + Object.entries(ctx.allergenes).map(([n, a]) =>
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
    .map(p => '• ' + txt(p.nom, 120) + ' — ' + (Number(p.prix) || 0) + (p.categorie ? ' — ' + txt(p.categorie, 30) : '') + (p.description ? ' — ' + txt(p.description, 200) : '')
      // Donnée d'allergènes : seulement ce que le restaurateur a renseigné sur la fiche du plat.
      + (Array.isArray(p.allergenes) && p.allergenes.length ? ' — allergènes déclarés par le restaurant : ' + p.allergenes.map(a => txt(a, 40)).join(', ') : ' — allergènes : non renseignés'))
    .join('\n');
  return `Tu es le conseiller du restaurant ${nom}.

${REGLE}

CARTE COMPLÈTE (nom — prix — catégorie — description — allergènes) :
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
    // Allergies : une réponse qui garantirait la sécurité d'un plat est redemandée une fois ; si elle
    // revient pareille, le client reçoit la réponse prudente. Le rappel au serveur est toujours présent.
    let garde = null;
    const allergie = SUJET_ALLERGIE.test([message, ...trimmedHistory.filter(m => m && m.role === 'user').map(m => String(m.content))].join(' '));
    if (allergie) {
      if (GARANTIE.test(reply)) {
        console.warn('[chat] allergie : réponse avec garantie, redemandée —', (reply.match(GARANTIE) || [])[0]);
        garde = 'relance';
        reply = await demander();
        if (GARANTIE.test(reply) || NON_LATIN.test(reply)) { garde = 'repli'; reply = INFO_ABSENTE[lang]; }
      }
      if (!reply.includes(RAPPEL_SERVEUR[lang])) { reply = reply.trim() + ' ' + RAPPEL_SERVEUR[lang]; garde = garde || 'rappel'; }
    }
    return { statusCode: 200, headers, body: JSON.stringify({ reply, ...(relance ? { relance: true } : {}), ...(garde ? { garde } : {}) }) };

  } catch (err) {
    console.error('Chat function error:', err.message);
    // La page affiche son propre message, dans la langue du client.
    return { statusCode: 500, headers, body: JSON.stringify({ code: 'SERVICE_INDISPONIBLE', error: 'Service momentanément indisponible.' }) };
  }
};
