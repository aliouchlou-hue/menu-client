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
// Le conseiller s'appuie sur ce que le restaurateur a renseigné, plat par plat :
//   • 'renseigne'     liste complète des 14 allergènes réglementaires (vide = aucun) : il peut dire
//                     que le plat contient ou ne contient pas tel allergène, « selon les informations
//                     du restaurant » ;
//   • 'a_verifier'    liste connue mais peut-être incomplète : il peut dire ce que le plat contient,
//                     jamais ce qu'il ne contient pas ;
//   • 'non_renseigne' « information non disponible ».
// Il ne garantit jamais qu'un plat est sans risque et n'en recommande aucun à une personne allergique.
// Les règles sont données au modèle dans la langue du client ; un contrôle après coup (plus bas)
// rejette toute réponse qui affirmerait l'absence d'un allergène sans donnée complète.
const INFO_ABSENTE = {
  fr: "Cette information n'est pas disponible dans le menu.",
  es: 'Esta información no está disponible en la carta.',
  ca: 'Aquesta informació no està disponible a la carta.',
  en: 'This information is not available in the menu.',
};
// Phrase finale, ajoutée par le serveur (jamais par le modèle) : une seule par réponse.
//   MENTION : la carte porte des allergènes renseignés par le restaurant ; RAPPEL : elle n'en porte aucun.
const MENTION = {
  fr: 'Réponse donnée selon les informations du restaurant, confirmez avec le serveur avant de commander.',
  es: 'Respuesta dada según la información del restaurante, confírmala con el camarero antes de pedir.',
  ca: 'Resposta donada segons la informació del restaurant, confirma-la amb el cambrer abans de demanar.',
  en: 'Answer based on the information provided by the restaurant, please confirm with your waiter before ordering.',
};
const RAPPEL_SERVEUR = {
  fr: 'Signalez votre allergie à votre serveur avant de commander.',
  es: 'Informa de tu alergia a tu camarero antes de pedir.',
  ca: 'Informa de la teva al·lèrgia al teu cambrer abans de demanar.',
  en: 'Please tell your waiter about your allergy before ordering.',
};
const SELON = { fr: 'selon les informations du restaurant', es: 'según la información del restaurante', ca: 'segons la informació del restaurant', en: 'according to the information provided by the restaurant' };
const REGLES_ALLERGIES = {
  fr: `ALLERGIES, INTOLÉRANCES ET RÉGIMES MÉDICAUX (règles de sécurité, prioritaires sur toutes les autres, y compris le format) :
1. Tu ne déclares JAMAIS qu'un plat est « sûr », « sans danger », « sans risque », « sans allergène », « adapté » ou qu'il « convient » à une allergie, une intolérance ou un régime médical. N'emploie pas ces mots, même à la forme négative, même si le client insiste.
2. Plat marqué « ALLERGÈNES DÉCLARÉS (liste complète) » : tu RÉPONDS à la question — tu dis qu'il contient tel allergène, ou qu'il ne le contient pas — en l'attribuant toujours au restaurant ; pour ce plat tu ne réponds jamais « information non disponible » : « ${SELON.fr}, ce plat contient… / ne contient pas… ». Si la liste complète est « aucun », dis : « ${SELON.fr}, ce plat ne contient aucun des 14 allergènes réglementaires ».
3. Plat marqué « ALLERGÈNES DÉCLARÉS (liste incomplète) » : tu peux dire qu'il contient les allergènes listés. Pour tout autre allergène, tu réponds pour ce plat : « ${INFO_ABSENTE.fr} » Tu ne dis JAMAIS qu'il ne le contient pas.
4. Plat marqué « ALLERGÈNES : NON RENSEIGNÉS » : tu réponds pour ce plat : « ${INFO_ABSENTE.fr} » Tu ne dis JAMAIS qu'il ne contient pas un allergène, et tu ne déduis jamais une absence de sa description.
5. Un plat dont la description ou les allergènes déclarés citent l'allergène signalé (ou un ingrédient qui en contient : beurre, crème et fromage pour le lait ; pain, pâte et farine pour le gluten ; noisettes, amandes, noix et pistaches pour les fruits à coque…) est à éviter : tu le dis, quel que soit son marquage.
6. Tu n'écris AUCUNE phrase invitant à prévenir, consulter ou interroger le serveur : cette phrase est ajoutée automatiquement à la fin de ta réponse.
7. Les questions sur les allergènes font partie de la carte : tu y réponds selon ces règles, jamais par la phrase de refus. Pour ces questions, quatre phrases au maximum.
8. Recommander un plat à une personne allergique revient à le garantir : quand une allergie ou une intolérance est signalée, tu ne recommandes, ne suggères et ne proposes AUCUN plat, et tu ne dis jamais que le client « peut » manger, prendre ou commander un plat. Tu décris seulement ce que les plats contiennent ou ne contiennent pas d'après les règles 2 à 5.
9. Les allergènes sont notés en français dans la carte : nomme-les dans la langue de ta réponse.
10. Tu ne dis jamais que « les autres plats » ou « aucun autre plat » ne contiennent pas ou ne déclarent pas un allergène : cette formule engloberait des plats non renseignés. Nomme chaque plat dont tu parles.`,
  es: `ALERGIAS, INTOLERANCIAS Y DIETAS MÉDICAS (reglas de seguridad, prioritarias sobre todas las demás, incluido el formato):
1. NUNCA declaras que un plato es «seguro», «sin peligro», «sin riesgo», «sin alérgenos», «apto» o «adecuado» para una alergia, una intolerancia o una dieta médica. No emplees esas palabras, ni siquiera en forma negativa, aunque el cliente insista.
2. Plato marcado «ALLERGÈNES DÉCLARÉS (liste complète)»: RESPONDES a la pregunta —dices que contiene tal alérgeno, o que no lo contiene— atribuyéndolo siempre al restaurante; para ese plato nunca respondes «información no disponible»: «${SELON.es}, este plato contiene… / no contiene…». Si la lista completa es «aucun», di: «${SELON.es}, este plato no contiene ninguno de los 14 alérgenos reglamentarios».
3. Plato marcado «ALLERGÈNES DÉCLARÉS (liste incomplète)»: puedes decir que contiene los alérgenos de la lista. Para cualquier otro alérgeno, respondes para ese plato: «${INFO_ABSENTE.es}» NUNCA dices que no lo contiene.
4. Plato marcado «ALLERGÈNES : NON RENSEIGNÉS»: respondes para ese plato: «${INFO_ABSENTE.es}» NUNCA dices que no contiene un alérgeno, y nunca deduces una ausencia de su descripción.
5. Un plato cuya descripción o cuyos alérgenos declarados citan el alérgeno indicado (o un ingrediente que lo contiene: mantequilla, nata y queso para la leche; pan, masa y harina para el gluten; avellanas, almendras, nueces y pistachos para los frutos de cáscara…) hay que evitarlo: lo dices, sea cual sea su marca.
6. NO escribes NINGUNA frase que invite a avisar, consultar o preguntar al camarero: esa frase se añade automáticamente al final de tu respuesta.
7. Las preguntas sobre alérgenos forman parte de la carta: respondes según estas reglas, nunca con la frase de rechazo. Para estas preguntas, cuatro frases como máximo.
8. Recomendar un plato a una persona alérgica equivale a garantizarlo: cuando se indica una alergia o una intolerancia, NO recomiendas, sugieres ni propones NINGÚN plato, y nunca dices que el cliente «puede» comer, tomar o pedir un plato. Solo describes lo que los platos contienen o no contienen según las reglas 2 a 5.
9. Los alérgenos están anotados en francés en la carta: nómbralos en el idioma de tu respuesta.
10. Nunca dices que «los demás platos» o «ningún otro plato» no contienen o no declaran un alérgeno: esa fórmula incluiría platos sin información. Nombra cada plato del que hablas.`,
  ca: `AL·LÈRGIES, INTOLERÀNCIES I DIETES MÈDIQUES (regles de seguretat, prioritàries sobre totes les altres, inclòs el format):
1. MAI declares que un plat és «segur», «sense perill», «sense risc», «sense al·lèrgens», «apte» o «adequat» per a una al·lèrgia, una intolerància o una dieta mèdica. No facis servir aquestes paraules, ni tan sols en forma negativa, encara que el client insisteixi.
2. Plat marcat «ALLERGÈNES DÉCLARÉS (liste complète)»: RESPONS a la pregunta —dius que conté tal al·lergen, o que no el conté— atribuint-ho sempre al restaurant; per a aquest plat mai respons «informació no disponible»: «${SELON.ca}, aquest plat conté… / no conté…». Si la llista completa és «aucun», digues: «${SELON.ca}, aquest plat no conté cap dels 14 al·lèrgens reglamentaris».
3. Plat marcat «ALLERGÈNES DÉCLARÉS (liste incomplète)»: pots dir que conté els al·lèrgens de la llista. Per a qualsevol altre al·lergen, respons per a aquest plat: «${INFO_ABSENTE.ca}» MAI dius que no el conté.
4. Plat marcat «ALLERGÈNES : NON RENSEIGNÉS»: respons per a aquest plat: «${INFO_ABSENTE.ca}» MAI dius que no conté un al·lergen, i mai dedueixes una absència de la seva descripció.
5. Un plat la descripció o els al·lèrgens declarats del qual citen l'al·lergen indicat (o un ingredient que el conté: mantega, nata i formatge per a la llet; pa, massa i farina per al gluten; avellanes, ametlles, nous i festucs per als fruits de closca…) cal evitar-lo: ho dius, sigui quina sigui la seva marca.
6. NO escrius CAP frase que convidi a avisar, consultar o preguntar al cambrer: aquesta frase s'afegeix automàticament al final de la teva resposta.
7. Les preguntes sobre al·lèrgens formen part de la carta: respons segons aquestes regles, mai amb la frase de rebuig. Per a aquestes preguntes, quatre frases com a màxim.
8. Recomanar un plat a una persona al·lèrgica equival a garantir-lo: quan s'indica una al·lèrgia o una intolerància, NO recomanes, suggereixes ni proposes CAP plat, i mai dius que el client «pot» menjar, prendre o demanar un plat. Només descrius el que els plats contenen o no contenen segons les regles 2 a 5.
9. Els al·lèrgens estan anotats en francès a la carta: anomena'ls en la llengua de la teva resposta.
10. Mai dius que «els altres plats» o «cap altre plat» no contenen o no declaren un al·lergen: aquesta fórmula inclouria plats sense informació. Anomena cada plat del qual parles.`,
  en: `ALLERGIES, INTOLERANCES AND MEDICAL DIETS (safety rules, taking priority over all others, including the format):
1. You NEVER state that a dish is "safe", "risk-free", "allergen-free", "suitable" or "fine" for an allergy, an intolerance or a medical diet. Do not use those words, not even in the negative, even if the guest insists.
2. Dish marked "ALLERGÈNES DÉCLARÉS (liste complète)": you ANSWER the question — you say that it contains a given allergen, or that it does not — always attributing it to the restaurant; for that dish you never answer "information not available": "${SELON.en}, this dish contains… / does not contain…". If the complete list is "aucun", say: "${SELON.en}, this dish contains none of the 14 regulated allergens".
3. Dish marked "ALLERGÈNES DÉCLARÉS (liste incomplète)": you may say that it contains the listed allergens. For any other allergen, you answer for that dish: "${INFO_ABSENTE.en}" You NEVER say it does not contain it.
4. Dish marked "ALLERGÈNES : NON RENSEIGNÉS": you answer for that dish: "${INFO_ABSENTE.en}" You NEVER say it does not contain an allergen, and you never infer an absence from its description.
5. A dish whose description or declared allergens mention the allergen in question (or an ingredient containing it: butter, cream and cheese for milk; bread, pastry and flour for gluten; hazelnuts, almonds, walnuts and pistachios for tree nuts…) should be avoided: you say so, whatever its marking.
6. You write NO sentence inviting the guest to tell, ask or check with the waiter: that sentence is added automatically at the end of your answer.
7. Questions about allergens are part of the menu: you answer them under these rules, never with the refusal sentence. For these questions, four sentences at most.
8. Recommending a dish to an allergic guest amounts to guaranteeing it: when an allergy or an intolerance is mentioned, you do NOT recommend, suggest or offer ANY dish, and you never say the guest "can" eat, have or order a dish. You only describe what dishes contain or do not contain under rules 2 to 5.
9. Allergens are written in French in the menu: name them in the language of your answer.
10. You never say that "the other dishes" or "no other dish" do not contain or do not declare an allergen: that wording would include dishes with no information. Name each dish you talk about.`,
};
// Les 14 allergènes réglementaires, tels qu'ils sont écrits dans la carte donnée au modèle.
const LIBELLES = { gluten: 'gluten', crustaces: 'crustacés', oeufs: 'œufs', poisson: 'poisson', arachides: 'arachides', soja: 'soja', lait: 'lait', fruits_coque: 'fruits à coque', celeri: 'céleri', moutarde: 'moutarde', sesame: 'sésame', sulfites: 'sulfites', lupin: 'lupin', mollusques: 'mollusques', fruits_mer: 'fruits de mer (crustacés ou mollusques, non précisé)' };
const STATUTS = ['renseigne', 'a_verifier', 'non_renseigne'];
const court = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
// Déclaration d'un plat reçue de la page → { statut, allergenes[] }. Une liste sans statut (page
// d'avant la liste des 14) est tenue pour incomplète ; une liste vide sans statut, pour non renseignée.
function declaration(p) {
  const liste = (Array.isArray(p && p.allergenes) ? p.allergenes : []).concat(Array.isArray(p && p.autres) ? p.autres : []).map(a => LIBELLES[a] || court(a, 40)).filter(Boolean);
  const statut = STATUTS.includes(p && p.statut) ? p.statut : (liste.length ? 'a_verifier' : 'non_renseigne');
  return { statut, allergenes: liste, regimes: (Array.isArray(p && p.regimes) ? p.regimes : []).map(r => court(r, 20)) };
}
// Mention écrite dans la carte donnée au modèle, à la suite du plat.
function marquage(d) {
  const regimes = d.regimes.length ? ' — régimes déclarés : ' + d.regimes.join(', ') : '';
  if (d.statut === 'renseigne') return ' — ALLERGÈNES DÉCLARÉS (liste complète) : ' + (d.allergenes.join(', ') || 'aucun') + regimes;
  if (d.statut === 'a_verifier') return ' — ALLERGÈNES DÉCLARÉS (liste incomplète) : ' + d.allergenes.join(', ') + regimes;
  return ' — ALLERGÈNES : NON RENSEIGNÉS' + regimes;
}
// Plats connus du conseiller et leur statut : [{ noms[], statut }]. noms = nom d'origine et nom affiché.
function platsDuContexte(ctx) {
  const affiches = (ctx && ctx.noms) || {};
  const tous = n => [n, affiches[n]].filter(Boolean).map(x => String(x));
  if (ctx && ctx.restaurant) return (Array.isArray(ctx.carte) ? ctx.carte : []).filter(p => p && p.nom).map(p => ({ noms: tous(p.nom), statut: declaration(p).statut }));
  // Sans restaurant dans le contexte (page chargée hors carte) : aucun plat connu.
  return [];
}
// La conversation parle-t-elle d'allergie, d'intolérance ou d'un allergène ? (question en cours ou précédentes)
const SUJET_ALLERGIE = /al[·.]?l[eè]rg|allerg|alerg|al[eè]rgi|intol[eé]r|c[eé]l[ií]a[cq]|gluten|lactos|\blait\b|\bleche\b|\bllet\b|\bmilk\b|dairy|fruits? à coque|frutos? (secos|de cáscara)|fruits? (secs|de closca)|\bnuts?\b|noisette|avellan|cacahu|cacauet|arachid|peanut|crustac|mollus|molus|marisc|shellfish|fruits de mer|œufs?\b|oeufs?\b|huevos?\b|\bous?\b|\beggs?\b|s[ée]same|sèsam|soja|\bsoy\b|c[ée]leri|\bapio\b|celery|moutarde|mostaza|mostassa|mustard|sul[fp]h?it|lupin|altramu|tramuss/i;
// Mots par lesquels une réponse garantirait la sécurité d'un plat.
const GARANTIE = /(?<![\p{L}])(sûre?s?|sans (danger|risque|allergènes?)|adaptée?s? (à|au|aux|pour)|convien(t|nent|dra|draient)|safe(ly)?|risk[- ]free|allergen[- ]free|suitable|seguros?|seguras?|sin (peligro|riesgo|alérgenos)|apt[oa]s?|adecuad[oa]s?|segurs?|segures?|sense (perill|risc|al·lèrgens)|aptes?|adequats?|adequades?)(?![\p{L}])/iu;

// Permission donnée au client (« vous pouvez prendre… », « pots gaudir de… », « accessible pour vous »).
const PERMISSION = /(?<![\p{L}])(vous pouvez|tu peux|vous pourrez|pots|podr[àa]s|podeu|puedes|puede|podr[áa]s|you can|you could|you may)\s+(\p{L}+\s+){0,2}(manger|prendre|commander|déguster|savourer|choisir|opter|profiter|menjar|prendre|demanar|gaudir|triar|optar|comer|tomar|pedir|disfrutar|elegir|have|eat|enjoy|order|choose|go for|try)(?![\p{L}])|(?<![\p{L}])(accessibles?|sans souci|sin problema|sense problema|no problem|good (choice|option)s?|bonn?es? options?|buenas? opci[oó]n(es)?|bones? opci[oó]ns?)(?![\p{L}])/iu;
// Verbes de recommandation ; ils ne sont admis que pour dire d'éviter un plat ou de s'adresser au serveur.
const CONSEIL = /(?<![\p{L}])(recoman\p{L}*|recomiend\p{L}*|recomend\p{L}*|recommend\p{L}*|recommand\p{L}*|conseill\p{L}*|suggest\p{L}*|sugier\p{L}*|suger\p{L}*|suggereix\p{L}*|suggér\p{L}*|suggèr\p{L}*|propos\p{L}*)/giu;
const ADMIS_APRES = /[ée]vit|avoid|serveur|camarero|cambrer|waiter|staff|personal|équipe|equip|consult|pregunt|demand|\bask|speak|habl|parl|inform|signal|dir|tell/i;
const NEGATION_AVANT = /(\bne\b|n'|\bno\b|\bnot\b|cannot|can't|\bni\b|\bnor\b|\bsans\b|\bsin\b|\bsense\b|without)[^.!?]{0,30}$/i;
function recommandeUnPlat(texte) {
  if (PERMISSION.test(texte)) return (texte.match(PERMISSION) || [])[0];
  for (const m of texte.matchAll(CONSEIL)) {
    const avant = texte.slice(Math.max(0, m.index - 40), m.index), apres = texte.slice(m.index, m.index + m[0].length + 70);
    if (!NEGATION_AVANT.test(avant) && !ADMIS_APRES.test(apres)) return m[0];
  }
  return null;
}

// Une réponse affirme-t-elle l'absence d'un allergène (« ne contient pas », « sans gluten »,
// « does not contain », « -free »…) ? Admis seulement pour un plat dont la liste est complète.
const MOTS_ALLERGENES = 'gluten|lactos[ea]?|lait|leche|llet|milk|dairy|œufs?|oeufs?|huevos?|ous?|eggs?|arachides?|cacahuetes?|cacauets?|peanuts?|soja|soy|fruits? à coque|frutos? (?:secos|de cáscara)|fruits? (?:secs|de closca)|(?:tree )?nuts?|s[ée]same|sésamo|sèsam|c[ée]leri|apio|api|celery|moutarde|mostaza|mostassa|mustard|sulfites?|sulfitos?|sulfits?|sulphites?|lupin|altramuces|tramussos|crustacés?|crustáceos?|crustacis?|crustaceans?|mollusques?|moluscos?|mol·luscs?|molluscs?|poisson|pescado|peix|fish|allergènes?|alérgenos?|al·lèrgens?|allergens?';
const ABSENCE = new RegExp(
  "(?<![\\p{L}])(?:ne\\s+(?:contien\\p{L}*|comport\\p{L}*|renferm\\p{L}*)\\s+(?:pas|aucun\\p{L}*|ni|plus)|n['’]en\\s+contien\\p{L}*\\s+pas|exempte?s?\\s+d|dépourvue?s?\\s+d|ne\\s+déclar\\p{L}*\\s+(?:pas|aucun\\p{L}*)"
  + "|no\\s+(?:lo\\s+|la\\s+|los\\s+|las\\s+|el\\s+|en\\s+)?(?:contien\\p{L}*|cont[ée]\\p{L}*|contenen|llevan?|porta|porten|inclou\\p{L}*|incluyen?)|libres?\\s+de|lliures?\\s+de|no\\s+declar\\p{L}*"
  + "|(?:does|do|did)\\s*(?:not|n['’]t)\\s+(?:contain|include)|contains?\\s+(?:no|none)(?![\\p{L}])|free\\s+(?:of|from)|declares?\\s+no(?:ne)?(?![\\p{L}])|(?:does|do)\\s*(?:not|n['’]t)\\s+(?:declare|list)"
  + "|(?:sans|sin|sense|without|no)\\s+(?:" + MOTS_ALLERGENES + ")(?![\\p{L}])|(?:" + MOTS_ALLERGENES + ")[- ]free(?![\\p{L}]))", 'iu');
const COUPE = /[.!?;:]\s+|\s+(?:mais|tandis que|alors que|en revanche|but|whereas|while|however|pero|mientras que|en cambio|però|mentre que|en canvi)\s+/iu;
// Formules qui englobent des plats sans les nommer (« les autres plats », « everything else »…).
const COLLECTIF = /(autres plats|aucun (autre )?plat|tous les plats|reste de la carte|dem[aá]s platos|otros platos|ning[uú]n (otro )?plato|todos los platos|resto de (la carta|los platos)|altres plats|cap (altre )?plat|tots els plats|resta de (la carta|plats)|other dish(es)?|all (the |of the )?(other |our )?dishes|rest of the menu|remaining dishes|everything else|none of (the|our) (other )?dishes)/i;
const sansAccents = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
// Rend le passage fautif, ou null. plats = platsDuContexte(ctx).
function absenceSansDonnee(texte, plats) {
  const complets = plats.some(p => p.statut === 'renseigne');
  for (const partie of String(texte).split(COUPE)) {
    if (!partie || !ABSENCE.test(partie)) continue;
    const p = sansAccents(partie);
    const cites = plats.filter(pl => pl.noms.some(n => n.length >= 4 && p.includes(sansAccents(n))));
    // Aucun plat à liste complète dans la carte, un plat cité dont la liste ne l'est pas, ou une
    // formule collective alors que tous les plats ne sont pas renseignés : refus.
    if (!complets || cites.some(pl => pl.statut !== 'renseigne') || (COLLECTIF.test(partie) && plats.some(pl => pl.statut !== 'renseigne'))) return partie.trim().slice(0, 120);
  }
  return null;
}
// Une réponse est refusée si elle garantit la sécurité d'un plat, en recommande un, ou affirme
// l'absence d'un allergène pour un plat dont le restaurant n'a pas déclaré la liste complète.
const refusAllergie = (texte, plats = []) => (texte.match(GARANTIE) || [])[0] || recommandeUnPlat(texte) || absenceSansDonnee(texte, plats);

// Phrases où le modèle renvoie de lui-même vers le serveur : retirées, la phrase finale est posée
// une seule fois par finAllergie (c'était la cause du rappel affiché deux fois).
const RENVOI_SERVEUR = /(serveu(r|se)|camarer[oa]|cambrer[a]?|waiter|waitress|\bserver\b|\bstaff\b|\bteam\b|\bpersonal\b|équipe|\bequipo\b|\bequip\b)/i;
function sansRenvois(texte) {
  const phrases = String(texte).match(/[^.!?]+(?:[.!?]+["»”)]*\s*|$)/g) || [];
  return phrases.filter(ph => !RENVOI_SERVEUR.test(ph)).join('').trim();
}
// ── Réponse prudente (quand le modèle n'a pas su répondre dans les règles) ──
// Elle ne perd pas ce que le restaurant a déclaré : les plats qui CONTIENNENT l'allergène dont
// parle le client sont nommés ; pour tout le reste, « information non disponible ».
const NOMS_ALLERGENES = {   // cle : [fr, es, ca, en]
  gluten: ['du gluten', 'gluten', 'gluten', 'gluten'], crustaces: ['des crustacés', 'crustáceos', 'crustacis', 'crustaceans'],
  oeufs: ['des œufs', 'huevo', 'ou', 'eggs'], poisson: ['du poisson', 'pescado', 'peix', 'fish'],
  arachides: ['des arachides', 'cacahuetes', 'cacauets', 'peanuts'], soja: ['du soja', 'soja', 'soja', 'soy'],
  lait: ['du lait', 'leche', 'llet', 'milk'], fruits_coque: ['des fruits à coque', 'frutos de cáscara', 'fruits de closca', 'tree nuts'],
  celeri: ['du céleri', 'apio', 'api', 'celery'], moutarde: ['de la moutarde', 'mostaza', 'mostassa', 'mustard'],
  sesame: ['du sésame', 'sésamo', 'sèsam', 'sesame'], sulfites: ['des sulfites', 'sulfitos', 'sulfits', 'sulphites'],
  lupin: ['du lupin', 'altramuces', 'tramussos', 'lupin'], mollusques: ['des mollusques', 'moluscos', 'mol·luscs', 'molluscs'],
};
const DETECTE = {
  gluten: /gluten|c[eé]l[ií]a[cq]/i, lait: /lactos|\blait\b|laitier|\bleche\b|lácteo|\bllet\b|lacti|\bmilk\b|dairy/i,
  oeufs: /œufs?\b|oeufs?\b|huevos?\b|\bous\b|\beggs?\b/i,
  fruits_coque: /fruits? à coque|frutos? (secos|de cáscara)|fruits? (secs|de closca)|\bnuts?\b|noisette|avellan|amande|almendr|ametll|almond|\bnoix\b|nuec|\bnous\b|walnut|pistach|festuc/i,
  arachides: /cacahu|cacauet|arachid|peanut/i, crustaces: /crustac|marisc|shellfish|fruits de mer/i, mollusques: /mollus|molus|mol·lusc|marisc|shellfish|fruits de mer/i,
  poisson: /poisson|pescado|\bpeix\b|\bfish\b/i, sesame: /s[ée]same|sésamo|sèsam/i, soja: /soja|\bsoy/i, celeri: /c[ée]leri|\bapio\b|celery/i,
  moutarde: /moutarde|mostaza|mostassa|mustard/i, sulfites: /sul[fp]h?it/i, lupin: /lupin|altramu|tramuss/i,
};
const REPLI_CONTIENT = {
  fr: 'Selon les informations du restaurant, ces plats contiennent {a} : {p}.', es: 'Según la información del restaurante, estos platos contienen {a}: {p}.',
  ca: 'Segons la informació del restaurant, aquests plats contenen {a}: {p}.', en: 'According to the information provided by the restaurant, these dishes contain {a}: {p}.',
};
const REPLI_AUTRES = {
  fr: "Pour les autres plats, cette information n'est pas disponible dans le menu.", es: 'Para los demás platos, esta información no está disponible en la carta.',
  ca: 'Per a la resta de plats, aquesta informació no està disponible a la carta.', en: 'For the other dishes, this information is not available in the menu.',
};
const REPLI_SANS = {
  fr: 'Selon les informations du restaurant, ces plats ne contiennent pas {a} : {p}.', es: 'Según la información del restaurante, estos platos no contienen {a}: {p}.',
  ca: 'Segons la informació del restaurant, aquests plats no contenen {a}: {p}.', en: 'According to the information provided by the restaurant, these dishes do not contain {a}: {p}.',
};
const REPLI_INCONNUS = {
  fr: "Pour {p}, l'information sur la présence {a} n'est pas disponible dans le menu.", es: 'Para {p}, la información sobre {a} no está disponible en la carta.',
  ca: 'Per a {p}, la informació sobre {a} no està disponible a la carta.', en: 'For {p}, information about {a} is not available in the menu.',
};
// « ne contiennent pas de gluten / d'œufs » : forme du nom après une négation, en français.
const NOMS_SANS_FR = { gluten: 'de gluten', crustaces: 'de crustacés', oeufs: "d'œufs", poisson: 'de poisson', arachides: "d'arachides", soja: 'de soja', lait: 'de lait', fruits_coque: 'de fruits à coque', celeri: 'de céleri', moutarde: 'de moutarde', sesame: 'de sésame', sulfites: 'de sulfites', lupin: 'de lupin', mollusques: 'de mollusques' };

// Allergènes dont parle le client (question en cours et précédentes) → clés de la liste des 14.
function allergenesCherches(propos, lang) {
  return Object.keys(DETECTE).filter(k => DETECTE[k].test(propos) || (k === 'oeufs' && lang === 'ca' && /\bou\b/i.test(propos)));
}
// FAITS : pour chaque allergène dont parle le client, ce que les déclarations du restaurant
// établissent, plat par plat. C'est le serveur qui les calcule, pas le modèle :
//   contient  le plat déclare l'allergène (quel que soit son statut) ;
//   sans      la liste du plat est complète et ne le cite pas ;
//   inconnu   liste incomplète ou plat non renseigné : aucune conclusion.
// autres : la carte compte des plats dont la page n'a rien transmis (démonstration).
// message : la question en cours. Les allergènes qu'elle cite passent avant ceux du reste de la
// conversation, et si elle nomme des plats, les faits ne portent que sur eux.
const MOTS_VIDES = /^(avec|sans|pour|dans|sauce|maison|plat|plats|para|con|sin|casa|amb|sense|with|from|house|the|and|des|les|aux|del|los|las)$/;
const motsDe = t => sansAccents(t).split(/[^a-z0-9]+/).filter(m => m.length >= 4 && !MOTS_VIDES.test(m));
function platsNommes(plats, message) {
  const mots = new Set(motsDe(message || ''));
  return plats.filter(p => motsDe(p.nom).some(m => mots.has(m)));
}
function faitsAllergenes(ctx, lang, propos, message) {
  const duMessage = allergenesCherches(message || '', lang);
  let cherches = duMessage.length ? duMessage : allergenesCherches(propos, lang);
  if (!cherches.length) return [];
  let plats, autres = false;
  if (ctx && ctx.restaurant) {
    plats = (Array.isArray(ctx.carte) ? ctx.carte : []).slice(0, 200).filter(p => p && p.nom).map(p => ({ nom: court(p.nom, 120), statut: declaration(p).statut, cles: [].concat(p.allergenes || [], p.autres || []) }));
  } else {
    plats = [];
  }
  const nommes = platsNommes(plats, message);
  if (nommes.length) {
    plats = nommes; autres = false;
    // Le nom d'un plat n'est pas une question sur un allergène (« pastís de nous », « tarte aux noix ») :
    // les allergènes sont cherchés dans la question une fois les noms de plats retirés.
    const motsPlats = new Set(nommes.flatMap(p => motsDe(p.nom)));
    const sansNoms = String(message || '').split(/(\s+)/).filter(m => !motsPlats.has(sansAccents(m).replace(/[^a-z0-9]/g, ''))).join('');
    const hors = allergenesCherches(sansNoms, lang);
    if (duMessage.length && hors.length) cherches = hors;
  }
  const porte = (p, k) => p.cles.includes(k) || (p.cles.includes('fruits_mer') && (k === 'crustaces' || k === 'mollusques'));
  return cherches.map(k => ({
    cle: k,
    contient: plats.filter(p => porte(p, k)).map(p => p.nom),
    sans: plats.filter(p => !porte(p, k) && p.statut === 'renseigne').map(p => p.nom),
    inconnu: plats.filter(p => !porte(p, k) && p.statut !== 'renseigne').map(p => p.nom),
    autres,
  }));
}
// Les mêmes faits, écrits pour le modèle.
function faitsPourModele(faits) {
  if (!faits.length) return '';
  const liste = l => l.length ? l.join(' ; ') : 'aucun plat';
  return '\n\nFAITS ÉTABLIS POUR CETTE CONVERSATION (calculés à partir des déclarations du restaurant ; ta réponse s\'appuie dessus et ne les contredit jamais) :\n'
    + faits.map(x => '• ' + LIBELLES[x.cle] + ' — CONTIENNENT : ' + liste(x.contient) + ' | NE CONTIENNENT PAS, selon la liste complète du restaurant : ' + liste(x.sans) + ' | INFORMATION NON DISPONIBLE : ' + (liste(x.inconnu) + (x.autres ? ' ; et tous les autres plats de la carte' : ''))).join('\n')
    + '\nQuand la question porte sur un de ces allergènes, réponds utilement à partir de ces faits : nomme D\'ABORD, sans en oublier un seul, les plats qui le contiennent (ils sont à éviter), puis ceux qui ne le contiennent pas en l\'attribuant au restaurant (règle 2). Tu ne réponds « information non disponible » que pour les plats de la troisième liste, en les nommant. Si la question porte sur un seul plat, réponds pour ce plat seulement.';
}
// Réponse prudente : les faits, sans le modèle. Elle garde tout ce que le restaurant a déclaré.
function reponsePrudente(ctx, lang, propos, message) {
  const i = Object.keys(LANGUES).indexOf(lang);
  const faits = faitsAllergenes(ctx, lang, propos, message);
  const lignes = [];
  let utile = false, autres = false;
  for (const x of faits) {
    const sans = lang === 'fr' ? NOMS_SANS_FR[x.cle] : NOMS_ALLERGENES[x.cle][i];
    if (x.contient.length) lignes.push(REPLI_CONTIENT[lang].replace('{a}', NOMS_ALLERGENES[x.cle][i]).replace('{p}', x.contient.join(', ')));
    if (x.sans.length) lignes.push(REPLI_SANS[lang].replace('{a}', sans).replace('{p}', x.sans.join(', ')));
    utile = utile || x.contient.length > 0 || x.sans.length > 0;
    // Plats sans conclusion pour CET allergène : nommés s'ils sont peu nombreux, sinon « les autres plats ».
    if (x.inconnu.length && x.inconnu.length <= 6 && !x.autres) lignes.push(REPLI_INCONNUS[lang].replace('{a}', sans).replace('{p}', x.inconnu.join(', ')));
    else autres = autres || x.autres || x.inconnu.length > 0;
  }
  // Aucune déclaration utile et aucun plat à nommer : la phrase simple.
  if (!utile && (autres || !lignes.length)) return INFO_ABSENTE[lang];
  if (autres) lignes.push(REPLI_AUTRES[lang]);
  return lignes.join(' ');
}

// Un plat déclaré comme contenant l'allergène n'est jamais passé sous silence : si la réponse du
// modèle en oublie un, la phrase qui le nomme est ajoutée.
function avecPlatsAEviter(texte, faits, lang) {
  const i = Object.keys(LANGUES).indexOf(lang), t = sansAccents(texte);
  const ajouts = faits.map(x => {
    const oublies = x.contient.filter(n => !t.includes(sansAccents(n)));
    return oublies.length ? REPLI_CONTIENT[lang].replace('{a}', NOMS_ALLERGENES[x.cle][i]).replace('{p}', oublies.join(', ')) : null;
  }).filter(Boolean);
  return ajouts.length ? texte.trim() + ' ' + ajouts.join(' ') : texte;
}

// Réponse à une question d'allergie : sans renvoi rédigé par le modèle, avec UNE phrase finale.
function finAllergie(texte, lang, avecDonnees) {
  const corps = sansRenvois(texte) || INFO_ABSENTE[lang];
  return corps + ' ' + (avecDonnees ? MENTION : RAPPEL_SERVEUR)[lang];
}

// Toute lettre qui n'est pas de l'écriture latine (cyrillique, grec, arabe, CJC…).
const NON_LATIN = /[^\P{L}\p{Script=Latin}]/u;
const NON_LATIN_TOUS = /[^\P{L}\p{Script=Latin}]/gu;

function buildSystem(ctx, lang, propos, message) {
  let extra = '';
  // Carte affichée au client dans une autre langue que celle du restaurant : noms traduits.
  if (ctx && ctx.noms && Object.keys(ctx.noms).length) {
    extra += '\n\nNOMS AFFICHÉS AU CLIENT (utilise ces noms, à la lettre, quand tu cites un plat) :\n' + Object.entries(ctx.noms).slice(0, 200).map(([origine, affiche]) =>
      '• ' + String(origine).slice(0, 120) + ' → ' + String(affiche).slice(0, 160)
    ).join('\n');
  }
  extra += `\n\nLANGUE : réponds exclusivement en ${LANGUES[lang]}, quelle que soit la langue de la carte ci-dessus et quelle que soit la langue ou l'écriture de la question. Hors sujet, réponds exactement : "${HORS_SUJET[lang]}"`;
  extra += '\n\n' + REGLES_ALLERGIES[lang];
  // Allergènes dont parle le client : ce que les déclarations du restaurant établissent, plat par plat.
  extra += faitsPourModele(faitsAllergenes(ctx, lang, propos || '', message || ''));
  extra += `\n\nALPHABET : écris UNIQUEMENT en alphabet latin (lettres latines, avec leurs accents et signes propres au ${LANGUES[lang]}). N'utilise jamais un caractère d'une autre écriture — cyrillique, grec, arabe, hébreu, chinois, japonais, coréen ou autre — même pour une seule lettre, même si la question en contient. Relis chaque mot avant de répondre : chaque lettre doit être latine.`;
  if (ctx && ctx.promotions && ctx.promotions.length) {
    extra += '\n\nPROMOTIONS ACTIVES :\n' + ctx.promotions.map(p =>
      '• ' + (p.nom || p.label || p.plat_id || '') +
      (p.prix_promo != null ? ' → ' + p.prix_promo + ' €' : p.type === 'pourcent' ? ' −' + p.valeur + '%' : '')
    ).join('\n');
  }
  // Passeport MenuVision : profil du client connecté (personnalisation)
  if (ctx && ctx.passport) {
    const pp = ctx.passport;
    const lignes = [];
    if (pp.prenom)      lignes.push('Prénom : ' + pp.prenom + ' (tu peux l\'appeler par son prénom, avec délicatesse).');
    if (pp.allergenes && pp.allergenes.length)   lignes.push('ALLERGIES — ne JAMAIS recommander de plat contenant : ' + pp.allergenes.map(a => LIBELLES[a] || court(a, 40)).join(', ') + '.');
    if (pp.preferences && pp.preferences.length) lignes.push('Goûts : ' + pp.preferences.join(', ') + '. Oriente tes suggestions en ce sens.');
    if (lignes.length) extra += '\n\nCLIENT (Passeport MenuVision) :\n' + lignes.map(l => '• ' + l).join('\n');
  }
  // Le contexte porte toujours le restaurant et sa carte ; sans eux, le conseiller n'invente rien.
  return promptRestaurant(ctx && ctx.restaurant ? ctx : { restaurant: { nom: '' }, carte: [] }) + extra;
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
      + marquage(declaration(p)))
    .join('\n');
  return `Tu es le conseiller du restaurant ${nom}.

${REGLE}

CARTE COMPLÈTE (nom — prix — catégorie — description — allergènes) :
${carte || '(carte non communiquée : invite le client à consulter la carte affichée)'}

${FORMAT}
— Ne cite que des plats de cette carte, sans en inventer.`;
}

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

exports.refusAllergie = refusAllergie;
exports.absenceSansDonnee = absenceSansDonnee;
exports.finAllergie = finAllergie;
exports.reponsePrudente = reponsePrudente;
exports.faitsAllergenes = faitsAllergenes;
exports.avecPlatsAEviter = avecPlatsAEviter;
exports.platsDuContexte = platsDuContexte;
exports.buildSystem = buildSystem;

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
    // Ce que le client a écrit dans la conversation (allergie mentionnée, allergènes cités).
    const propos = [message, ...trimmedHistory.filter(m => m && m.role === 'user').map(m => String(m.content))].join(' ');

    const demander = async () => (await httpsPost({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: buildSystem(context, lang, propos, message),
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
    // Allergies : une réponse qui garantirait la sécurité d'un plat, en recommanderait un, ou
    // affirmerait l'absence d'un allergène sans liste complète du restaurant est redemandée une
    // fois ; si elle revient pareille, le client reçoit la réponse prudente. La phrase finale est
    // posée ici, une seule fois.
    let garde = null;
    const allergie = SUJET_ALLERGIE.test(propos);
    if (allergie) {
      const plats = platsDuContexte(context);
      if (refusAllergie(reply, plats)) {
        console.warn('[chat] allergie : réponse refusée, redemandée —', refusAllergie(reply, plats));
        garde = 'relance';
        reply = await demander();
        if (refusAllergie(reply, plats) || NON_LATIN.test(reply)) { garde = 'repli'; reply = reponsePrudente(context, lang, propos, message); }
      }
      reply = avecPlatsAEviter(reply, faitsAllergenes(context, lang, propos, message), lang);
      reply = finAllergie(reply, lang, plats.some(p => p.statut !== 'non_renseigne'));
    }
    return { statusCode: 200, headers, body: JSON.stringify({ reply, ...(relance ? { relance: true } : {}), ...(garde ? { garde } : {}) }) };

  } catch (err) {
    console.error('Chat function error:', err.message);
    // La page affiche son propre message, dans la langue du client.
    return { statusCode: 500, headers, body: JSON.stringify({ code: 'SERVICE_INDISPONIBLE', error: 'Service momentanément indisponible.' }) };
  }
};
