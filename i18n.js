/* i18n.js — le menu client en quatre langues (fr, es, ca, en)
 *
 * Chargé en premier sur chaque page (dans <head>). Tous les textes de l'interface passent par
 * MVI18n.t('cle') ; les textes posés dans le HTML portent data-i18n="cle".
 *
 * Langue retenue, dans l'ordre :
 *   1. le choix du client (sélecteur), gardé sur l'appareil — localStorage.mv_lang, partagé avec
 *      le tunnel de réservation et la politique d'acompte ;
 *   2. la première langue du navigateur parmi les quatre ;
 *   3. la langue de la carte du restaurant (theme.langue, annoncée par le serveur) ;
 *   4. le français.
 * Un changement de langue recharge la page : toute l'interface repart dans la nouvelle langue.
 *
 * Les noms et descriptions des plats ne sont pas ici : ils sont traduits par le serveur
 * (GET /plats?lang=, /plats/traductions) et rangés par menu-api.js ; MVI18n.plat(nom) les rend.
 */
(function () {
  'use strict';
  var LANGUES = ['fr', 'es', 'ca', 'en'];
  var NOMS = { fr: 'Français', es: 'Español', ca: 'Català', en: 'English' };
  var DEMO = '7917c5f4-3d21-4e3d-bc69-8d87df617865';

  // cle : [fr, es, ca, en]
  var T = {
    'lang.choisir': ['Choisir la langue', 'Elegir el idioma', "Triar l'idioma", 'Choose language'],
    'fermer': ['Fermer', 'Cerrar', 'Tancar', 'Close'],
    'retour': ['Retour', 'Volver', 'Tornar', 'Back'],
    'envoyer': ['Envoyer', 'Enviar', 'Enviar', 'Send'],
    'pied.propose': ['Menu numérique proposé par', 'Carta digital ofrecida por', 'Carta digital oferta per', 'Digital menu by'],
    'pied.par': ['Menu numérique par', 'Carta digital de', 'Carta digital de', 'Digital menu by'],

    // Accueil
    'accueil.cta': ['Découvrir la Carte', 'Descubrir la carta', 'Descobrir la carta', 'View the menu'],
    'demo.hero.label': ["Paris · Depuis 1987 · Table d'exception", 'París · Desde 1987 · Mesa de excepción', "París · Des de 1987 · Taula d'excepció", 'Paris · Since 1987 · Fine dining'],
    'demo.hero.sous': ["Cuisine française d'exception", 'Alta cocina francesa', 'Alta cuina francesa', 'Exceptional French cuisine'],

    // Carte
    'nav.entrees': ['Entrées', 'Entrantes', 'Entrants', 'Starters'],
    'nav.plats': ['Plats', 'Platos', 'Plats', 'Mains'],
    'nav.desserts': ['Desserts', 'Postres', 'Postres', 'Desserts'],
    'nav.vins': ['Vins', 'Vinos', 'Vins', 'Wines'],
    'carte.sur': ['La Carte', 'La carta', 'La carta', 'The menu'],
    'cave.sur': ['La Cave', 'La bodega', 'El celler', 'The cellar'],
    'intro.entrees': ["Compositions d'ouverture selon le marché", 'Composiciones de apertura según el mercado', "Composicions d'obertura segons el mercat", 'Opening dishes, inspired by the market'],
    'intro.plats': ['Créations de notre chef, au gré des saisons', 'Creaciones de nuestro chef, al ritmo de las estaciones', 'Creacions del nostre xef, al ritme de les estacions', "Our chef's creations, following the seasons"],
    'intro.desserts': ['Douceurs de notre pâtissier, Pierre Vanel', 'Dulces de nuestro pastelero, Pierre Vanel', 'Dolços del nostre pastisser, Pierre Vanel', 'Sweets by our pastry chef, Pierre Vanel'],
    'intro.vins': ['Une sélection de notre sommelier', 'Una selección de nuestro sumiller', 'Una selecció del nostre sommelier', 'A selection by our sommelier'],
    'carte.vide': ['Cette partie de la carte arrive bientôt.', 'Esta parte de la carta llegará pronto.', 'Aquesta part de la carta arribarà aviat.', 'This part of the menu is coming soon.'],
    'unite.verre': ['v', 'copa', 'copa', 'glass'],
    'unite.bouteille': ['btl', 'bot.', 'amp.', 'btl'],

    // Fiche d'un plat
    'fiche.allergenes': ['Allergènes', 'Alérgenos', 'Al·lèrgens', 'Allergens'],
    'fiche.accords': ['Accords', 'Maridajes', 'Maridatges', 'Pairings'],
    'fiche.3d': ['Voir sur ma table en 3D', 'Ver en mi mesa en 3D', 'Veure a la meva taula en 3D', 'View on my table in 3D'],
    'fiche.3d.lancer': ['Voir sur ma table', 'Ver en mi mesa', 'Veure a la meva taula', 'View on my table'],
    'fiche.3d.viser': ['Pointez vers votre table', 'Apunta hacia tu mesa', 'Apunta cap a la teva taula', 'Point at your table'],
    'fiche.3d.android': ['AR disponible sur Android', 'RA disponible en Android', 'RA disponible a Android', 'AR available on Android'],
    'fiche.3d.masquer': ['Masquer la vue 3D', 'Ocultar la vista 3D', 'Amagar la vista 3D', 'Hide 3D view'],
    'fiche.3d.exemple': ["Modèle 3D d'exemple — ce n'est pas le plat réel", 'Modelo 3D de ejemplo: no es el plato real', "Model 3D d'exemple: no és el plat real", 'Sample 3D model — not the actual dish'],
    'fiche.3d.alt': ['Aperçu 3D du plat', 'Vista 3D del plato', 'Vista 3D del plat', '3D preview of the dish'],
    'fiche.ajouter': ['Ajouter à ma commande', 'Añadir a mi pedido', 'Afegir a la meva comanda', 'Add to my order'],
    'fiche.ajouter.vin': ['Ajouter à ma sélection', 'Añadir a mi selección', 'Afegir a la meva selecció', 'Add to my selection'],
    'fiche.ajoute': ['Ajouté à votre commande', 'Añadido a tu pedido', 'Afegit a la teva comanda', 'Added to your order'],
    'fiche.ajoute.vin': ['Ajouté à votre sélection', 'Añadido a tu selección', 'Afegit a la teva selecció', 'Added to your selection'],

    // Allergènes : fiche du plat et filtre
    'all.source': ['Informations fournies par le restaurant', 'Información facilitada por el restaurante', 'Informació facilitada pel restaurant', 'Information provided by the restaurant'],
    'all.non': ['Allergènes non renseignés, demandez au serveur', 'Alérgenos no indicados, pregunta al camarero', 'Al·lèrgens no indicats, pregunta al cambrer', 'Allergens not provided, please ask your waiter'],
    'all.aucun': ['Aucun des 14 allergènes réglementaires déclaré', 'Ninguno de los 14 alérgenos reglamentarios declarado', 'Cap dels 14 al·lèrgens reglamentaris declarat', 'None of the 14 regulated allergens declared'],
    'all.verifier': ['Liste à confirmer auprès du serveur', 'Lista por confirmar con el camarero', 'Llista per confirmar amb el cambrer', 'List to be confirmed with your waiter'],
    'all.regimes': ['Régimes', 'Dietas', 'Dietes', 'Diets'],
    'filtre.bouton': ['Allergènes', 'Alérgenos', 'Al·lèrgens', 'Allergens'],
    'filtre.titre': ['Filtrer par allergène', 'Filtrar por alérgeno', 'Filtrar per al·lergen', 'Filter by allergen'],
    'filtre.intro': ['Choisissez les allergènes à éviter : les plats qui en contiennent sont signalés ou masqués.', 'Elige los alérgenos que quieres evitar: los platos que los contienen se señalan o se ocultan.', 'Tria els al·lèrgens que vols evitar: els plats que en contenen se senyalen o s\'amaguen.', 'Choose the allergens to avoid: dishes containing them are flagged or hidden.'],
    'filtre.signaler': ['Signaler les plats', 'Señalar los platos', 'Assenyalar els plats', 'Flag the dishes'],
    'filtre.masquer': ['Masquer les plats', 'Ocultar los platos', 'Amagar els plats', 'Hide the dishes'],
    'filtre.appliquer': ['Appliquer', 'Aplicar', 'Aplicar', 'Apply'],
    'filtre.effacer': ['Tout effacer', 'Borrar todo', 'Esborrar-ho tot', 'Clear all'],
    'filtre.contient': ['Contient : {liste}', 'Contiene: {liste}', 'Conté: {liste}', 'Contains: {liste}'],
    'filtre.inconnu': ['Allergènes non renseignés, demandez au serveur', 'Alérgenos no indicados, pregunta al camarero', 'Al·lèrgens no indicats, pregunta al cambrer', 'Allergens not provided, please ask your waiter'],
    'filtre.masques.un': ['{n} plat masqué sur cette page', '{n} plato oculto en esta página', '{n} plat amagat en aquesta pàgina', '{n} dish hidden on this page'],
    'filtre.masques.plusieurs': ['{n} plats masqués sur cette page', '{n} platos ocultos en esta página', '{n} plats amagats en aquesta pàgina', '{n} dishes hidden on this page'],
    'filtre.note': ['Informations fournies par le restaurant. Un plat sans information reste affiché : demandez au serveur.', 'Información facilitada por el restaurante. Un plato sin información sigue visible: pregunta al camarero.', 'Informació facilitada pel restaurant. Un plat sense informació continua visible: pregunta al cambrer.', 'Information provided by the restaurant. A dish with no information stays visible: please ask your waiter.'],

    // Conseiller (chat)
    'chat.bouton': ['Conseiller', 'Asesor', 'Assessor', 'Advisor'],
    'chat.aria': ['Conseiller gastronomique', 'Asesor gastronómico', 'Assessor gastronòmic', 'Food advisor'],
    'chat.sous': ['Votre conseiller gastronomique', 'Tu asesor gastronómico', 'El teu assessor gastronòmic', 'Your food advisor'],
    'chat.accueil': ['Bonsoir, bienvenue chez {nom}. Puis-je vous guider sur notre carte du soir ?', 'Buenas noches, bienvenido a {nom}. ¿Puedo orientarte con nuestra carta de esta noche?', "Bona nit, benvingut a {nom}. Et puc orientar amb la nostra carta d'aquesta nit?", "Good evening, welcome to {nom}. May I guide you through tonight's menu?"],
    'chat.s1': ['Que me conseillez-vous ce soir ?', '¿Qué me recomiendas esta noche?', 'Què em recomanes aquesta nit?', 'What do you recommend tonight?'],
    'chat.s2': ["J'ai une allergie au gluten", 'Tengo alergia al gluten', 'Tinc al·lèrgia al gluten', 'I have a gluten allergy'],
    'chat.s3': ['Accord mets et vins ?', '¿Maridaje de platos y vinos?', 'Maridatge de plats i vins?', 'Food and wine pairing?'],
    'chat.saisie': ['Une question sur la carte…', 'Una pregunta sobre la carta…', 'Una pregunta sobre la carta…', 'A question about the menu…'],
    'chat.ecrit': ["En train d'écrire…", 'Escribiendo…', 'Escrivint…', 'Typing…'],
    'chat.indispo': ['Service momentanément indisponible.', 'Servicio no disponible por el momento.', 'Servei no disponible de moment.', 'Service temporarily unavailable.'],

    // Menu fermé par le serveur
    'indispo.titre': ['Menu temporairement indisponible', 'Carta no disponible temporalmente', 'Carta no disponible temporalment', 'Menu temporarily unavailable'],
    'indispo.texte': ["La carte n'est pas consultable en ligne pour le moment. Adressez-vous à l'équipe du restaurant.", 'La carta no se puede consultar en línea por el momento. Dirígete al equipo del restaurante.', "La carta no es pot consultar en línia de moment. Adreça't a l'equip del restaurant.", 'The menu cannot be viewed online at the moment. Please ask the restaurant staff.'],

    // Avis
    'avis.question': ['Votre avis sur « {plat} »', 'Tu opinión sobre «{plat}»', 'La teva opinió sobre «{plat}»', 'Your review of "{plat}"'],
    'avis.note': ['{n} sur 5', '{n} de 5', '{n} de 5', '{n} out of 5'],
    'avis.commentaire': ['Un commentaire ? (facultatif)', '¿Un comentario? (opcional)', 'Un comentari? (opcional)', 'Any comments? (optional)'],
    'avis.prenom': ['Votre prénom (facultatif)', 'Tu nombre (opcional)', 'El teu nom (opcional)', 'Your first name (optional)'],
    'avis.envoyer': ['Envoyer mon avis', 'Enviar mi opinión', 'Enviar la meva opinió', 'Send my review'],
    'avis.envoi': ['Envoi…', 'Enviando…', 'Enviant…', 'Sending…'],
    'avis.merci': ['Merci, votre avis a bien été transmis au restaurant. Il sera publié après validation.', 'Gracias, tu opinión se ha enviado al restaurante. Se publicará tras su validación.', "Gràcies, la teva opinió s'ha enviat al restaurant. Es publicarà després de validar-la.", 'Thank you, your review has been sent to the restaurant. It will be published once approved.'],
    'avis.echec': ["L'avis n'a pas pu être envoyé. Réessayez dans un instant.", 'No se ha podido enviar la opinión. Inténtalo de nuevo en un momento.', "No s'ha pogut enviar l'opinió. Torna-ho a provar d'aquí a un moment.", 'Your review could not be sent. Please try again in a moment.'],
    'avis.clients': ['Avis des clients', 'Opiniones de los clientes', 'Opinions dels clients', 'Customer reviews'],
    'avis.reponse': ['Réponse du restaurant :', 'Respuesta del restaurante:', 'Resposta del restaurant:', 'Reply from the restaurant:'],

    // Panier
    'panier.voir': ['Voir mon panier', 'Ver mi cesta', 'Veure la meva cistella', 'View my basket'],
    'panier.aria': ['Mon panier', 'Mi cesta', 'La meva cistella', 'My basket'],
    'panier.titre': ['Ma commande', 'Mi pedido', 'La meva comanda', 'My order'],
    'panier.total': ['Total', 'Total', 'Total', 'Total'],
    'panier.table': ['Numéro de table', 'Número de mesa', 'Número de taula', 'Table number'],
    'panier.table.saisie': ['Votre table', 'Tu mesa', 'La teva taula', 'Your table'],
    'panier.table.requise': ['Veuillez indiquer votre numéro de table.', 'Indica tu número de mesa.', 'Indica el teu número de taula.', 'Please enter your table number.'],
    'panier.payer': ['Payer', 'Pagar', 'Pagar', 'Pay'],
    'panier.article.un': ['{n} article', '{n} artículo', '{n} article', '{n} item'],
    'panier.article.plusieurs': ['{n} articles', '{n} artículos', '{n} articles', '{n} items'],
    'panier.unite': ['{prix} / article', '{prix} / artículo', '{prix} / article', '{prix} each'],
    'panier.moins': ['Retirer un', 'Quitar uno', "Treure'n un", 'Remove one'],
    'panier.plus': ['Ajouter un', 'Añadir uno', "Afegir-ne un", 'Add one'],
    'panier.vide': ['Votre panier est vide', 'Tu cesta está vacía', 'La teva cistella és buida', 'Your basket is empty'],
    'panier.montrer': ['Montrez cette commande à votre serveur', 'Enseña este pedido a tu camarero', 'Ensenya aquesta comanda al teu cambrer', 'Show this order to your waiter'],
    'panier.cuisine': ['Envoyer ma commande en cuisine', 'Enviar mi pedido a cocina', 'Enviar la meva comanda a cuina', 'Send my order to the kitchen'],
    'panier.acompte.info': ['Acompte 30 % à régler : {montant}', 'Señal del 30 % a pagar: {montant}', 'Paga i senyal del 30 % a pagar: {montant}', '30% deposit due: {montant}'],
    'panier.acompte.payer': ["Payer l'acompte — {montant}", 'Pagar la señal — {montant}', 'Pagar la paga i senyal — {montant}', 'Pay the deposit — {montant}'],
    'panier.redirection': ['Redirection…', 'Redirigiendo…', 'Redirigint…', 'Redirecting…'],
    'panier.surplace': ['Paiement sur place — présentez votre commande au service.', 'Pago en el local: muestra tu pedido al personal.', 'Pagament al local: mostra la teva comanda al personal.', 'Pay at the restaurant — show your order to the staff.'],
    'panier.prete': ['Commande prête', 'Pedido listo', 'Comanda llesta', 'Order ready'],
    'panier.erreur': ['Erreur — Réessayer', 'Error — Reintentar', 'Error — Tornar-ho a provar', 'Error — Try again'],
    'panier.envoi': ['Envoi en cours…', 'Enviando…', 'Enviant…', 'Sending…'],
    'panier.transmis.titre': ['Commande transmise', 'Pedido enviado', 'Comanda enviada', 'Order sent'],
    'panier.transmis': ['Votre commande a été transmise en cuisine.', 'Tu pedido se ha enviado a cocina.', "La teva comanda s'ha enviat a cuina.", 'Your order has been sent to the kitchen.'],
    'panier.prix.maj': ['Les prix de la carte ont changé : votre panier a été mis à jour. Vérifiez le total puis validez de nouveau.', 'Los precios de la carta han cambiado: tu cesta se ha actualizado. Comprueba el total y vuelve a confirmar.', "Els preus de la carta han canviat: la teva cistella s'ha actualitzat. Comprova el total i torna a confirmar.", 'Menu prices have changed: your basket has been updated. Check the total, then confirm again.'],

    // Refus du serveur (par code) et erreurs
    'err.envoi': ['Envoi impossible. Veuillez réessayer.', 'No se ha podido enviar. Inténtalo de nuevo.', "No s'ha pogut enviar. Torna-ho a provar.", 'Could not send. Please try again.'],
    'err.paiement': ['Paiement indisponible pour le moment.', 'Pago no disponible por el momento.', 'Pagament no disponible de moment.', 'Payment is unavailable at the moment.'],
    'err.TROP': ['Trop de tentatives. Réessayez dans quelques minutes.', 'Demasiados intentos. Inténtalo de nuevo en unos minutos.', "Massa intents. Torna-ho a provar d'aquí a uns minuts.", 'Too many attempts. Please try again in a few minutes.'],
    'err.PLAT_INCONNU': ['« {plat} » ne figure plus à la carte. Retirez-le de votre panier.', '«{plat}» ya no está en la carta. Quítalo de tu cesta.', '«{plat}» ja no és a la carta. Treu-lo de la cistella.', '"{plat}" is no longer on the menu. Please remove it from your basket.'],
    'err.TABLE_INCONNUE': ["La table {table} n'existe pas dans ce restaurant.", 'La mesa {table} no existe en este restaurante.', 'La taula {table} no existeix en aquest restaurant.', 'Table {table} does not exist in this restaurant.'],
    'err.COMMANDE_EN_COURS': ['Une commande est déjà en cours pour cette table. Un serveur arrive.', 'Ya hay un pedido en curso para esta mesa. Un camarero viene enseguida.', 'Ja hi ha una comanda en curs per a aquesta taula. Un cambrer ve de seguida.', 'An order is already in progress for this table. A waiter is on the way.'],
    'err.COMMANDE_INDISPONIBLE': ["La commande depuis la table n'est pas proposée par ce restaurant.", 'Este restaurante no ofrece pedidos desde la mesa.', 'Aquest restaurant no ofereix comandes des de la taula.', 'This restaurant does not offer ordering from the table.'],
    'err.APPEL_INDISPONIBLE': ["L'appel d'un serveur n'est pas proposé par ce restaurant.", 'Este restaurante no ofrece la llamada al camarero.', 'Aquest restaurant no ofereix la crida al cambrer.', 'This restaurant does not offer the call-a-waiter service.'],
    'err.MENU_INDISPONIBLE': ['Ce menu est temporairement indisponible.', 'Esta carta no está disponible temporalmente.', 'Aquesta carta no està disponible temporalment.', 'This menu is temporarily unavailable.'],
    'err.RESERVATION': ["Cette réservation n'attend plus de paiement.", 'Esta reserva ya no está pendiente de pago.', 'Aquesta reserva ja no està pendent de pagament.', 'This booking is no longer awaiting payment.'],

    // Appeler un serveur
    'appel.bouton': ['Appeler un serveur', 'Llamar a un camarero', 'Cridar un cambrer', 'Call a waiter'],
    'appel.arrive': ['Un serveur arrive', 'Un camarero viene', 'Un cambrer ve', 'A waiter is coming'],
    'appel.prevenu': ['Serveur prévenu', 'Camarero avisado', 'Cambrer avisat', 'Waiter notified'],
    'appel.transmis.titre': ['Votre appel est transmis', 'Tu llamada se ha enviado', "La teva crida s'ha enviat", 'Your call has been sent'],
    'appel.pris': ['Votre demande a été prise en charge pour la table {table}.', 'Tu petición ha sido atendida para la mesa {table}.', 'La teva petició ha estat atesa per a la taula {table}.', 'Your request for table {table} is being handled.'],
    'appel.transmis': ["L'équipe a été prévenue pour la table {table}. Cet écran se met à jour dès qu'un serveur prend votre demande.", 'Se ha avisado al equipo para la mesa {table}. Esta pantalla se actualiza en cuanto un camarero atiende tu petición.', "S'ha avisat l'equip per a la taula {table}. Aquesta pantalla s'actualitza tan bon punt un cambrer atén la teva petició.", 'The team has been notified for table {table}. This screen updates as soon as a waiter takes your request.'],
    'appel.texte': ["Indiquez votre table : l'équipe est prévenue aussitôt.", 'Indica tu mesa: se avisa al equipo al instante.', "Indica la teva taula: s'avisa l'equip a l'instant.", 'Enter your table: the team is notified right away.'],
    'appel.motif.serveur': ['Un serveur', 'Un camarero', 'Un cambrer', 'A waiter'],
    'appel.motif.addition': ["L'addition", 'La cuenta', 'El compte', 'The bill'],
    'appel.motif.eau': ["De l'eau", 'Agua', 'Aigua', 'Water'],
    'appel.appeler': ['Appeler', 'Llamar', 'Cridar', 'Call'],
    'appel.echec': ["L'appel n'a pas pu être transmis. Réessayez.", 'No se ha podido enviar la llamada. Inténtalo de nuevo.', "No s'ha pogut enviar la crida. Torna-ho a provar.", 'Your call could not be sent. Please try again.'],
    'appel.echec.reseau': ["L'appel n'a pas pu être transmis. Vérifiez votre connexion.", 'No se ha podido enviar la llamada. Comprueba tu conexión.', "No s'ha pogut enviar la crida. Comprova la connexió.", 'Your call could not be sent. Check your connection.'],

    // Passeport
    'pass.debloquer': ['Débloquer mon Passeport Gourmand', 'Activar mi Pasaporte Gourmet', 'Activar el meu Passaport Gurmet', 'Unlock my Gourmet Passport'],
    'pass.indispo': ['Connexion indisponible pour le moment.', 'Conexión no disponible por el momento.', 'Connexió no disponible de moment.', 'Sign-in is unavailable at the moment.'],
    'pass.bienvenue': ['Bienvenue {prenom}', 'Bienvenido, {prenom}', 'Benvingut, {prenom}', 'Welcome, {prenom}'],
    'pass.defaut': ['Gourmet', 'Gourmet', 'Gurmet', 'Gourmet'],
    'pass.points': ['{n} points', '{n} puntos', '{n} punts', '{n} points'],
    'pass.points.mv': ['points MenuVision', 'puntos MenuVision', 'punts MenuVision', 'MenuVision points'],
    'pass.visite.un': ['{n} restaurant visité', '{n} restaurante visitado', '{n} restaurant visitat', '{n} restaurant visited'],
    'pass.visite.plusieurs': ['{n} restaurants visités', '{n} restaurantes visitados', '{n} restaurants visitats', '{n} restaurants visited'],
    'pass.mon': ['Mon passeport', 'Mi pasaporte', 'El meu passaport', 'My passport'],
    'pass.deconnexion': ['Se déconnecter', 'Cerrar sesión', 'Tancar la sessió', 'Sign out'],
    'pass.allergene': ['Allergène', 'Alérgeno', 'Al·lergen', 'Allergen'],
    'pass.titre': ['Mon Passeport Gourmand', 'Mi Pasaporte Gourmet', 'El meu Passaport Gurmet', 'My Gourmet Passport'],
    'pass.intro': ['Renseignez vos allergènes et vos goûts : nous adaptons la carte et les suggestions du conseiller, ici et dans tous les restaurants MenuVision.', 'Indica tus alérgenos y tus gustos: adaptamos la carta y las sugerencias del asesor, aquí y en todos los restaurantes MenuVision.', "Indica els teus al·lèrgens i els teus gustos: adaptem la carta i els suggeriments de l'assessor, aquí i a tots els restaurants MenuVision.", "Tell us your allergens and tastes: we adapt the menu and the advisor's suggestions, here and in every MenuVision restaurant."],
    'pass.allergenes': ['Mes allergènes', 'Mis alérgenos', 'Els meus al·lèrgens', 'My allergens'],
    'pass.preferences': ['Mes préférences', 'Mis preferencias', 'Les meves preferències', 'My preferences'],
    'pass.pref.saisie': ['ex. vins rouges corsés, cuisine épicée, peu sucré…', 'p. ej. vinos tintos con cuerpo, cocina picante, poco dulce…', 'p. ex. vins negres amb cos, cuina picant, poc dolç…', 'e.g. full-bodied reds, spicy food, not too sweet…'],
    'pass.enregistrer': ['Enregistrer', 'Guardar', 'Desar', 'Save'],
    'pass.enregistrement': ['Enregistrement…', 'Guardando…', 'Desant…', 'Saving…'],

    // Page de confirmation
    'succes.page': ['Confirmation', 'Confirmación', 'Confirmació', 'Confirmation'],
    'succes.titre1': ['Merci pour', 'Gracias por', 'Gràcies per', 'Thank you for'],
    'succes.titre2': ['votre visite', 'tu visita', 'la teva visita', 'your visit'],
    'succes.paiement': ['Paiement confirmé', 'Pago confirmado', 'Pagament confirmat', 'Payment confirmed'],
    'succes.acompte': ['Acompte réservation confirmé', 'Señal de la reserva confirmada', 'Paga i senyal de la reserva confirmada', 'Booking deposit confirmed'],
    'succes.commande': ['Votre commande', 'Tu pedido', 'La teva comanda', 'Your order'],
    'succes.acompte30': ['Acompte 30 %', 'Señal del 30 %', 'Paga i senyal del 30 %', '30% deposit'],
    'succes.enregistree': ['Commande enregistrée', 'Pedido registrado', 'Comanda registrada', 'Order recorded'],
    'succes.question': ["Qu'avez-vous pensé de votre repas ?", '¿Qué te ha parecido la comida?', "Què t'ha semblat l'àpat?", 'How was your meal?'],
    'succes.facultatif': ['Votre avis est facultatif', 'Tu opinión es opcional', 'La teva opinió és opcional', 'Your review is optional'],
    'succes.merci': ['Merci !', '¡Gracias!', 'Gràcies!', 'Thank you!'],
    'succes.google': ['Laisser un avis Google', 'Dejar una reseña en Google', 'Deixar una ressenya a Google', 'Leave a Google review'],
    'succes.commentaire': ['Un commentaire pour nous aider à progresser ?', '¿Un comentario para ayudarnos a mejorar?', 'Un comentari per ajudar-nos a millorar?', 'A comment to help us improve?'],
    'succes.envoye': ['Envoyé', 'Enviado', 'Enviat', 'Sent'],
    'succes.retour': ['Retour à la carte', 'Volver a la carta', 'Tornar a la carta', 'Back to the menu'],

    // Bandeau du mode réservation
    'resa.titre': ['Pré-commande pour votre réservation', 'Prepedido para tu reserva', 'Precomanda per a la teva reserva', 'Pre-order for your booking'],
    'resa.du': ['du {date}', 'del {date}', 'del {date}', '{date}'],
    'resa.a': ['à {heure}', 'a las {heure}', 'a les {heure}', 'at {heure}'],
    'resa.pers': ['· {n} pers.', '· {n} pers.', '· {n} pers.', '· {n} guests'],
    'resa.plat.un': ['{n} plat', '{n} plato', '{n} plat', '{n} dish'],
    'resa.plat.plusieurs': ['{n} plats', '{n} platos', '{n} plats', '{n} dishes'],
    'resa.confirmer': ['Confirmer ma sélection', 'Confirmar mi selección', 'Confirmar la meva selecció', 'Confirm my selection'],
  };

  // Les 14 allergènes à déclaration obligatoire (règlement UE 1169/2011), dans l'ordre de la liste
  // du serveur (public/allergenes.js du dépôt menuvision) : mêmes clés.
  var ALLERGENES_14 = ['gluten', 'crustaces', 'oeufs', 'poisson', 'arachides', 'soja', 'lait', 'fruits_coque', 'celeri', 'moutarde', 'sesame', 'sulfites', 'lupin', 'mollusques'];
  // Libellés saisis en clair (démonstration, anciens profils) → clé de la liste.
  var ALIAS_ALLERGENES = { 'lactose': 'lait', 'oeuf': 'oeufs', 'fruits a coque': 'fruits_coque', 'fruits coque': 'fruits_coque', 'noix': 'fruits_coque', 'fruits de mer': 'fruits_mer', 'fruits mer': 'fruits_mer' };
  // Allergènes et régimes : libellés du dashboard (clés) et des cartes saisies en clair.
  var ALLERGENES = {
    'fruits coque': ['Fruits à coque', 'Frutos de cáscara', 'Fruits de closca', 'Tree nuts'],
    'gluten': ['Gluten', 'Gluten', 'Gluten', 'Gluten'],
    'lait': ['Lait', 'Leche', 'Llet', 'Milk'],
    'lactose': ['Lactose', 'Lactosa', 'Lactosa', 'Lactose'],
    'oeufs': ['Œufs', 'Huevos', 'Ous', 'Eggs'],
    'oeuf': ['Œuf', 'Huevo', 'Ou', 'Egg'],
    'poisson': ['Poisson', 'Pescado', 'Peix', 'Fish'],
    'crustaces': ['Crustacés', 'Crustáceos', 'Crustacis', 'Crustaceans'],
    'mollusques': ['Mollusques', 'Moluscos', 'Mol·luscs', 'Molluscs'],
    'fruits de mer': ['Fruits de mer', 'Marisco', 'Marisc', 'Shellfish'],
    'fruits mer': ['Fruits de mer', 'Marisco', 'Marisc', 'Shellfish'],
    'arachides': ['Arachides', 'Cacahuetes', 'Cacauets', 'Peanuts'],
    'fruits a coque': ['Fruits à coque', 'Frutos de cáscara', 'Fruits de closca', 'Tree nuts'],
    'noix': ['Noix', 'Nueces', 'Nous', 'Walnuts'],
    'soja': ['Soja', 'Soja', 'Soja', 'Soy'],
    'sesame': ['Sésame', 'Sésamo', 'Sèsam', 'Sesame'],
    'celeri': ['Céleri', 'Apio', 'Api', 'Celery'],
    'moutarde': ['Moutarde', 'Mostaza', 'Mostassa', 'Mustard'],
    'sulfites': ['Sulfites', 'Sulfitos', 'Sulfits', 'Sulphites'],
    'lupin': ['Lupin', 'Altramuces', 'Tramussos', 'Lupin'],
    'porc': ['Porc', 'Cerdo', 'Porc', 'Pork'],
    'volaille': ['Volaille', 'Ave', 'Aviram', 'Poultry'],
    'halal': ['Halal', 'Halal', 'Halal', 'Halal'],
    'vegetarien': ['Végétarien', 'Vegetariano', 'Vegetarià', 'Vegetarian'],
    'vegane': ['Végane', 'Vegano', 'Vegà', 'Vegan'],
  };
  // Démonstration (Maison Ardent) : types de vin et accords abrégés codés dans ses pages.
  var DEMO_TEXTES = {
    'champagne brut': ['Champagne Brut', 'Champán Brut', 'Xampany Brut', 'Brut Champagne'],
    'bourgogne blanc': ['Bourgogne Blanc', 'Borgoña blanco', 'Borgonya blanc', 'White Burgundy'],
    'bourgogne rouge': ['Bourgogne Rouge', 'Borgoña tinto', 'Borgonya negre', 'Red Burgundy'],
    'bordeaux liquoreux': ['Bordeaux Liquoreux', 'Burdeos licoroso', 'Bordeus licorós', 'Sweet Bordeaux'],
    'saint-jacques': ['Saint-Jacques', 'Vieiras', 'Vieires', 'Scallops'],
    'foie gras': ['Foie Gras', 'Foie gras', 'Foie gras', 'Foie gras'],
    'turbot': ['Turbot', 'Rodaballo', 'Rèmol', 'Turbot'],
  };

  function lire(cle) { try { return localStorage.getItem(cle); } catch (_) { return null; } }
  function ecrire(cle, v) { try { localStorage.setItem(cle, v); } catch (_) {} }
  function valide(l) { return LANGUES.indexOf(l) >= 0; }
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // ── Langue retenue ──────────────────────────────────────────────────────────
  var rid = null;
  try { rid = new URLSearchParams(location.search).get('r') || (/success/i.test(location.pathname) ? lire('mv_rid') : null) || DEMO; } catch (_) { rid = DEMO; }
  var CLE_RESTO = 'mv_lang_resto:' + rid;
  var lang = null, origine = null;   // origine : 'choix' | 'navigateur' | 'restaurant' | 'defaut'
  var choisie = lire('mv_lang');
  if (valide(choisie)) { lang = choisie; origine = 'choix'; }
  if (!lang) {
    var prefs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < prefs.length && !lang; i++) {
      var code = String(prefs[i]).slice(0, 2).toLowerCase();
      if (valide(code)) { lang = code; origine = 'navigateur'; }
    }
  }
  if (!lang) {
    var connue = lire(CLE_RESTO);
    if (valide(connue)) { lang = connue; origine = 'restaurant'; } else { lang = 'fr'; origine = 'defaut'; }
  }
  var IDX = LANGUES.indexOf(lang);
  document.documentElement.lang = lang;

  function t(cle, vars) {
    var e = T[cle];
    var s = e ? (e[IDX] || e[0]) : cle;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  // Pluriel : t2('panier.article', 3) → « 3 articles »
  function t2(cle, n, vars) {
    var v = { n: n }; if (vars) Object.keys(vars).forEach(function (k) { v[k] = vars[k]; });
    // Zéro est au singulier en français (« 0 plat »), au pluriel dans les trois autres langues.
    var pluriel = lang === 'fr' ? Math.abs(n) > 1 : Math.abs(n) !== 1;
    return t(cle + (pluriel ? '.plusieurs' : '.un'), v);
  }
  function prix(n) {
    var v = Number(n) || 0, s = v.toFixed(2), entier = s.slice(-3) === '.00';
    if (lang === 'en') return '€' + (entier ? String(Math.round(v)) : s);
    return (entier ? String(Math.round(v)) : s.replace('.', ',')) + ' €';
  }
  function dico(table, texte) { var e = table[norm(texte)]; return e ? (e[IDX] || e[0]) : null; }
  function allergene(a) { return dico(ALLERGENES, a) || String(a == null ? '' : a); }
  // Clé de la liste des 14 pour une valeur (clé ou libellé) ; 'fruits_mer' pour l'ancienne valeur ; sinon null.
  function cleAllergene(a) {
    var n = norm(a), k = ALIAS_ALLERGENES[n] || n.replace(/ /g, '_');
    return (k === 'fruits_mer' || ALLERGENES_14.indexOf(k) >= 0) ? k : null;
  }

  // ── Plats traduits (rangés par menu-api.js à partir des réponses du serveur) ──
  var plats = {};   // nom d'origine normalisé → { nom, description }
  function rangerPlats(liste) {
    (liste || []).forEach(function (p) {
      if (!p || !p.nom) return;
      plats[norm(p.nom)] = { nom: p.nom_traduit || p.nom, description: p.description_traduite || '', traduit: !!p.nom_traduit };
    });
  }
  // Traduction d'un plat par son nom d'origine : { nom, description, traduit }.
  function plat(nom) { return plats[norm(nom)] || { nom: String(nom == null ? '' : nom), description: '', traduit: false }; }
  // Accord mets et vin, type de vin (démonstration) : nom d'un plat de la carte, ou libellé connu.
  function libelle(texte) { var p = plats[norm(texte)]; return (p && p.traduit) ? p.nom : (dico(DEMO_TEXTES, texte) || String(texte == null ? '' : texte)); }
  // « 22 €/v · 110 €/btl » → montants et unités dans la langue du client.
  function unites(texte) {
    var s = String(texte == null ? '' : texte);
    if (lang === 'en') s = s.replace(/(\d+(?:[.,]\d+)?)\s*€/g, function (_, n) { return '€' + n.replace(',', '.'); });
    return s.replace(/\/v\b/g, '/' + t('unite.verre')).replace(/\/btl\b/g, '/' + t('unite.bouteille'));
  }

  // Message d'un refus du serveur : par code (jamais le texte français de la réponse).
  function erreur(reponse, statut, cleDefaut) {
    var code = reponse && reponse.code;
    if (statut === 429) return t('err.TROP');
    if (code === 'PLAT_INCONNU') return t('err.PLAT_INCONNU', { plat: plat(reponse.plat || '').nom });
    if (code === 'TABLE_INCONNUE') return t('err.TABLE_INCONNUE', { table: reponse.table != null ? reponse.table : '' });
    if (code === 'TABLE_REQUISE') return t('panier.table.requise');
    if (code === 'PANIER_REQUIS') return t('panier.vide');
    if (code === 'PRIX_MODIFIE') return t('panier.prix.maj');
    if (code === 'RESERVATION_INTROUVABLE' || code === 'RESERVATION_DEJA_TRAITEE') return t('err.RESERVATION');
    if (code && T['err.' + code]) return t('err.' + code);
    return t(cleDefaut || 'err.envoi');
  }

  // ── Textes posés dans le HTML ───────────────────────────────────────────────
  //   data-i18n="cle"                         → texte de l'élément
  //   data-i18n-attr="placeholder:cle;aria-label:cle2" → attributs
  //   <title data-i18n-titre="cle">           → « Enseigne — texte »
  function appliquer(racine) {
    var r = racine || document;
    var vars = { nom: 'Maison Ardent' };   // menu-api.js remplace ensuite l'enseigne par celle du restaurant
    r.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n'), vars); });
    r.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (paire) {
        var p = paire.split(':'); if (p.length === 2) el.setAttribute(p[0].trim(), t(p[1].trim(), vars));
      });
    });
    var titre = document.querySelector('title[data-i18n-titre]');
    if (titre) document.title = 'Maison Ardent — ' + t(titre.getAttribute('data-i18n-titre'));
  }

  // ── Changement de langue ────────────────────────────────────────────────────
  function choisir(l) {
    if (!valide(l)) return;
    ecrire('mv_lang', l);
    if (l !== lang) location.reload();
  }
  // Appelé par menu-api.js quand le thème du restaurant arrive : repli sur la langue de sa carte
  // si le client n'a rien choisi et que son navigateur ne propose aucune des quatre langues.
  function restaurant(l) {
    if (!valide(l)) return;
    ecrire(CLE_RESTO, l);
    if ((origine === 'defaut' || origine === 'restaurant') && l !== lang) {
      var deja = null;
      try { deja = sessionStorage.getItem('mv_lang_repli'); sessionStorage.setItem('mv_lang_repli', l); } catch (_) {}
      if (deja !== l) location.reload();
    }
  }

  // ── Sélecteur visible sur chaque page ───────────────────────────────────────
  function selecteur() {
    if (document.getElementById('mv-langue')) return;
    var st = document.createElement('style');
    st.textContent = [
      '#mv-langue{position:fixed;top:calc(12px + env(safe-area-inset-top,0px));right:14px;z-index:320;font-family:"Montserrat",system-ui,sans-serif;}',
      '.page-header #mv-langue{position:absolute;top:50%;right:12px;transform:translateY(-50%);}',
      '#mv-langue-btn{display:flex;align-items:center;gap:5px;height:32px;padding:0 9px 0 10px;background:transparent;border:1px solid var(--sep,#D4C4B0);border-radius:16px;cursor:pointer;',
      'font:inherit;font-size:.66rem;font-weight:400;letter-spacing:.14em;color:var(--text-soft,#6B5244);-webkit-tap-highlight-color:transparent;}',
      '#mv-langue-btn svg{width:9px;height:9px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;}',
      '#mv-langue.sombre #mv-langue-btn{border-color:rgba(212,196,176,.5);color:#F5F0E8;background:rgba(16,10,5,.35);}',
      '#mv-langue-menu{position:absolute;top:38px;right:0;min-width:138px;margin:0;padding:5px;list-style:none;background:#FBF8F2;border:1px solid var(--sep,#D4C4B0);border-radius:10px;box-shadow:0 8px 28px rgba(44,31,20,.18);}',
      '#mv-langue-menu[hidden]{display:none;}',
      '#mv-langue-menu button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:14px;padding:9px 10px;background:none;border:0;border-radius:7px;cursor:pointer;font:inherit;font-size:.78rem;letter-spacing:.02em;color:#2C1F14;text-align:left;}',
      '#mv-langue-menu button span{font-size:.6rem;letter-spacing:.14em;color:#9A8070;}',
      '#mv-langue-menu button[aria-checked="true"]{background:rgba(139,74,47,.09);color:var(--terre,#8B4A2F);font-weight:500;}',
      // La pastille de points du Passeport laisse la place au sélecteur.
      '.mv-points{top:calc(56px + env(safe-area-inset-top,0px)) !important;}',
      'body.mv-avec-onglets .mv-points{top:calc(112px + env(safe-area-inset-top,0px)) !important;}'
    ].join('');
    document.head.appendChild(st);

    var boite = document.createElement('div');
    boite.id = 'mv-langue';
    var btn = document.createElement('button');
    btn.id = 'mv-langue-btn'; btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', t('lang.choisir') + ' — ' + NOMS[lang]);
    btn.innerHTML = '<span>' + lang.toUpperCase() + '</span><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4"/></svg>';
    var menu = document.createElement('ul');
    menu.id = 'mv-langue-menu'; menu.hidden = true; menu.setAttribute('role', 'menu');
    LANGUES.forEach(function (l) {
      var li = document.createElement('li'); li.setAttribute('role', 'none');
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'menuitemradio'); b.setAttribute('aria-checked', String(l === lang));
      b.setAttribute('lang', l); b.setAttribute('data-lang', l);
      b.appendChild(document.createTextNode(NOMS[l]));
      var c = document.createElement('span'); c.textContent = l.toUpperCase(); b.appendChild(c);
      b.addEventListener('click', function () { choisir(l); fermer(); });
      li.appendChild(b); menu.appendChild(li);
    });
    function fermer() { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden));
    });
    document.addEventListener('click', function (e) { if (!boite.contains(e.target)) fermer(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermer(); });
    boite.appendChild(btn); boite.appendChild(menu);
    var entete = document.querySelector('.page-header');
    if (entete) { entete.appendChild(boite); if (document.querySelector('.top-nav')) document.body.classList.add('mv-avec-onglets'); }
    else { if (document.querySelector('.hero')) boite.className = 'sombre'; document.body.appendChild(boite); }
  }

  // ── Bandeau du mode réservation (reservation-mode.js écrit ses textes en français) ──
  function bandeauReservation() {
    function texte(el, valeur) { if (el && el.textContent !== valeur) el.textContent = valeur; }
    function passer() {
      var titre = document.querySelector('.resa-banner-title');
      if (titre && titre.textContent.trim() === T['resa.titre'][0]) texte(titre, t('resa.titre'));
      var sous = document.querySelector('.resa-banner-sub');
      var m = sous && sous.textContent.trim().match(/^(?:du (\S+))?\s*(?:à (\S+))?\s*(?:· (\S+) pers\.)?$/);
      if (m && (m[1] || m[2] || m[3])) {
        texte(sous, [m[1] ? t('resa.du', { date: m[1] }) : '', m[2] ? t('resa.a', { heure: m[2] }) : '', m[3] ? t('resa.pers', { n: m[3] }) : ''].filter(Boolean).join(' '));
      }
      var badge = document.getElementById('resa-cart-badge');
      var b = badge && badge.textContent.trim().match(/^(\d+) plats?$/);
      if (b && lang !== 'fr') texte(badge, t2('resa.plat', +b[1]));
      var bouton = document.getElementById('resa-confirm-btn');
      if (bouton) {
        if (bouton.textContent.trim() === T['panier.envoi'][0]) texte(bouton, t('panier.envoi'));
        else if (bouton.firstChild && bouton.firstChild.nodeType === 3 && bouton.firstChild.nodeValue.trim() === T['resa.confirmer'][0]) bouton.firstChild.nodeValue = t('resa.confirmer');
      }
    }
    passer();
    if (lang === 'fr' || !window.MutationObserver) return;
    var veille = new MutationObserver(function () { veille.disconnect(); passer(); observer(); });
    function observer() { veille.observe(document.body, { childList: true, subtree: true, characterData: true }); }
    observer();
  }

  window.MVI18n = {
    LANGUES: LANGUES, NOMS: NOMS, lang: lang, origine: origine,
    t: t, t2: t2, prix: prix, allergene: allergene, cleAllergene: cleAllergene, ALLERGENES_14: ALLERGENES_14, libelle: libelle, unites: unites, erreur: erreur,
    plat: plat, rangerPlats: rangerPlats, appliquer: appliquer, choisir: choisir, set: choisir, restaurant: restaurant,
  };

  // Hors français, la page n'apparaît qu'une fois ses textes posés (pas d'éclair de français).
  if (lang !== 'fr') {
    var voile = document.createElement('style');
    voile.id = 'mv-i18n-voile';
    voile.textContent = 'body{visibility:hidden}';
    document.head.appendChild(voile);
    setTimeout(lever, 1500);
  }
  function lever() { var v = document.getElementById('mv-i18n-voile'); if (v) v.remove(); }
  function pret() { appliquer(); selecteur(); lever(); setTimeout(bandeauReservation, 0); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pret);
  else pret();
})();
