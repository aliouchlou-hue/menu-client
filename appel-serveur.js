/**
 * appel-serveur.js — « Appeler un serveur »
 * Le client appuie, indique sa table, et l'alerte part vers la salle (POST /appels-serveur).
 * Son téléphone affiche ensuite l'état réel de l'appel : transmis, puis « pris en charge »
 * dès qu'un membre de l'équipe l'a pris. Affiché si le restaurant propose la fonction
 * (theme.fonctions.appel_serveur).
 */
(function () {
  'use strict';
  var RAILWAY = 'https://menuvision-production.up.railway.app';
  var CLE_APPEL = 'mv_appel_', CLE_TABLE = 'mv_table_';
  var I = window.MVI18n, t = I.t;
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var SUIVI_MS = 5000, SUIVI_MAX = 30 * 60 * 1000;

  var rid = null, appel = null, minuterie = null, debutSuivi = 0;

  function lire(cle) { try { return sessionStorage.getItem(cle + rid); } catch (_) { return null; } }
  function ecrire(cle, v) { try { v == null ? sessionStorage.removeItem(cle + rid) : sessionStorage.setItem(cle + rid, v); } catch (_) {} }

  function styles() {
    var s = document.createElement('style');
    s.textContent = [
      '#mv-appel-btn{position:fixed;left:18px;bottom:calc(24px + env(safe-area-inset-bottom,0px));z-index:200;height:48px;padding:0 16px 0 13px;',
      'display:none;align-items:center;gap:8px;background:var(--fond);color:var(--accent);border:1px solid var(--accent);',
      "border-radius:28px;cursor:pointer;font-family: var(--sans);font-weight:500;font-size:.9rem;letter-spacing:.02em;white-space:nowrap;",
      'box-shadow:0 4px 20px color-mix(in srgb, var(--accent) 22%, transparent);-webkit-tap-highlight-color:transparent;transition:bottom .3s ease,background .18s,color .18s;}',
      '#mv-appel-btn.show{display:flex;}',
      '#mv-appel-btn svg{width:19px;height:19px;flex-shrink:0;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;}',
      '#mv-appel-btn.transmis{background: var(--accent); color: var(--sur-accent);}',
      '#mv-appel-btn.pris{background:#2E6B3A;border-color:#2E6B3A;color:#fff;}',
      'body.cart-has-items #mv-appel-btn{bottom:calc(88px + env(safe-area-inset-bottom,0px));}',
      '#mv-appel-overlay{position:fixed;inset:0;z-index:450;background:rgba(26,15,8,.62);display:flex;align-items:flex-end;opacity:0;pointer-events:none;transition:opacity .3s;}',
      '#mv-appel-overlay.open{opacity:1;pointer-events:all;}',
      '#mv-appel-sheet{width:100%;background:var(--fond);border-radius:18px 18px 0 0;padding:10px 22px calc(24px + env(safe-area-inset-bottom,0px));',
      'transform:translateY(40px);transition:transform .35s cubic-bezier(.32,.72,0,1);}',
      '#mv-appel-overlay.open #mv-appel-sheet{transform:translateY(0);}',
      '#mv-appel-sheet .mv-appel-poignee{width:34px;height:3px;background:var(--filet);border-radius:2px;margin:4px auto 14px;}',
      "#mv-appel-sheet h3{font-family: var(--serif);font-style:italic;font-weight:300;font-size:1.45rem;color:var(--encre);margin:0 0 4px;}",
      '#mv-appel-sheet p.mv-appel-texte{font-size:.8rem;line-height:1.55;color:var(--encre-2);margin:0 0 14px;}',
      '#mv-appel-sheet label{display:block;font-size:.58rem;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);margin-bottom:7px;}',
      "#mv-appel-table{width:100%;padding:13px 14px;background:#fff;border:1px solid var(--filet);border-radius:2px;font-family: var(--sans);font-size:.95rem;font-weight:300;color:var(--encre);-webkit-appearance:none;appearance:none;}",
      '#mv-appel-table:focus{outline:none;border-color:var(--accent);}',
      '.mv-appel-motifs{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 4px;}',
      ".mv-appel-motif{padding:8px 14px;border:1px solid var(--filet);border-radius:20px;background:transparent;cursor:pointer;font-family: var(--sans);font-size:.7rem;color:var(--encre-2);}",
      '.mv-appel-motif.on{background:var(--accent);border-color:var(--accent);color:var(--fond);}',
      "#mv-appel-envoyer{width:100%;margin-top:16px;padding:15px;background: var(--accent); color: var(--sur-accent);border:none;cursor:pointer;font-family: var(--sans);font-size:.7rem;letter-spacing:.24em;text-transform:uppercase;}",
      '#mv-appel-envoyer:disabled{opacity:.5;cursor:wait;}',
      '#mv-appel-msg{font-size:.76rem;text-align:center;margin-top:11px;min-height:1.1em;color:#B54334;}',
      '.mv-appel-etat{text-align:center;padding:14px 0 6px;}',
      '.mv-appel-etat .mv-appel-rond{width:54px;height:54px;margin:0 auto 14px;border:1px solid var(--accent);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--accent);}',
      '.mv-appel-etat.pris .mv-appel-rond{border-color:#2E6B3A;color:#2E6B3A;}',
      '.mv-appel-etat .mv-appel-rond svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;}'
    ].join('');
    document.head.appendChild(s);
  }

  var CLOCHE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h16M6 18a6 6 0 0 1 12 0M12 8V6M10 6h4"/><path d="M3 21h18"/></svg>';
  var COCHE  = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  var btn, overlay, sheet;

  function construire() {
    styles();
    btn = document.createElement('button');
    btn.id = 'mv-appel-btn'; btn.type = 'button';
    document.body.appendChild(btn);
    overlay = document.createElement('div');
    overlay.id = 'mv-appel-overlay'; overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '<div id="mv-appel-sheet" role="dialog" aria-label="' + esc(t('appel.bouton')) + '"></div>';
    document.body.appendChild(overlay);
    sheet = overlay.firstChild;
    btn.addEventListener('click', ouvrir);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) fermer(); });
  }

  function majBouton() {
    btn.classList.remove('transmis', 'pris');
    if (appel && appel.statut === 'pris_en_charge') { btn.classList.add('pris'); btn.innerHTML = COCHE + '<span>' + esc(t('appel.arrive')) + '</span>'; }
    else if (appel && appel.statut === 'nouveau') { btn.classList.add('transmis'); btn.innerHTML = CLOCHE + '<span>' + esc(t('appel.prevenu')) + '</span>'; }
    else btn.innerHTML = CLOCHE + '<span>' + esc(t('appel.bouton')) + '</span>';
  }

  function ouvrir() { rendreFeuille(); overlay.classList.add('open'); overlay.setAttribute('aria-hidden', 'false'); }
  function fermer() { overlay.classList.remove('open'); overlay.setAttribute('aria-hidden', 'true'); }

  function rendreFeuille() {
    if (appel && appel.statut !== 'termine') {
      var pris = appel.statut === 'pris_en_charge';
      sheet.innerHTML = '<div class="mv-appel-poignee"></div><div class="mv-appel-etat' + (pris ? ' pris' : '') + '" id="mv-appel-etat" data-statut="' + appel.statut + '">'
        + '<div class="mv-appel-rond">' + (pris ? COCHE : CLOCHE) + '</div>'
        + '<h3>' + esc(pris ? t('appel.arrive') : t('appel.transmis.titre')) + '</h3>'
        + '<p class="mv-appel-texte">' + esc(t(pris ? 'appel.pris' : 'appel.transmis', { table: appel.table_numero })) + '</p>'
        + '</div>';
      return;
    }
    var tableConnue = lire(CLE_TABLE) || (document.getElementById('cart-table-input') || {}).value || '';
    sheet.innerHTML = '<div class="mv-appel-poignee"></div><h3>' + esc(t('appel.bouton')) + '</h3>'
      + '<p class="mv-appel-texte">' + esc(t('appel.texte')) + '</p>'
      + '<label for="mv-appel-table">' + esc(t('panier.table')) + '</label>'
      + '<input id="mv-appel-table" type="number" inputmode="numeric" min="1" step="1" placeholder="' + esc(t('panier.table.saisie')) + '" autocomplete="off" />'
      + '<div class="mv-appel-motifs">'
      + '<button type="button" class="mv-appel-motif on" data-motif="serveur">' + esc(t('appel.motif.serveur')) + '</button>'
      + '<button type="button" class="mv-appel-motif" data-motif="addition">' + esc(t('appel.motif.addition')) + '</button>'
      + '<button type="button" class="mv-appel-motif" data-motif="eau">' + esc(t('appel.motif.eau')) + '</button>'
      + '</div>'
      + '<button type="button" id="mv-appel-envoyer">' + esc(t('appel.appeler')) + '</button><p id="mv-appel-msg" role="alert"></p>';
    var champ = document.getElementById('mv-appel-table'); champ.value = tableConnue;
    sheet.querySelectorAll('.mv-appel-motif').forEach(function (b) {
      b.addEventListener('click', function () { sheet.querySelectorAll('.mv-appel-motif').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    });
    document.getElementById('mv-appel-envoyer').addEventListener('click', envoyer);
  }

  function envoyer() {
    var champ = document.getElementById('mv-appel-table'), msg = document.getElementById('mv-appel-msg'), bouton = document.getElementById('mv-appel-envoyer');
    var table = parseInt(champ.value, 10);
    if (!(table >= 1)) { msg.textContent = t('panier.table.requise'); champ.focus(); return; }
    var motif = (sheet.querySelector('.mv-appel-motif.on') || {}).dataset; motif = motif ? motif.motif : 'serveur';
    bouton.disabled = true; msg.textContent = '';
    fetch(RAILWAY + '/appels-serveur', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: rid, table_numero: table, motif: motif })
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j.ok, j: j, statut: r.status }; }); })
      .then(function (x) {
        // Refus du serveur : motif affiché dans la langue du client (par code).
        if (!x.ok) { bouton.disabled = false; msg.textContent = I.erreur(x.j, x.statut, 'appel.echec'); return; }
        ecrire(CLE_TABLE, String(table));
        definir(x.j.appel);
        rendreFeuille();
      })
      .catch(function () { bouton.disabled = false; msg.textContent = t('appel.echec.reseau'); });
  }

  // Mémorise l'appel en cours (il suit le client d'une page de la carte à l'autre) et lance le suivi.
  function definir(a) {
    appel = (a && a.statut !== 'termine') ? a : null;
    ecrire(CLE_APPEL, appel ? appel.id : null);
    majBouton();
    if (overlay.classList.contains('open')) rendreFeuille();
    if (appel) suivre(); else arreter();
  }
  function arreter() { if (minuterie) { clearInterval(minuterie); minuterie = null; } }
  function suivre() {
    if (minuterie) return;
    debutSuivi = Date.now();
    minuterie = setInterval(function () {
      if (!appel || Date.now() - debutSuivi > SUIVI_MAX) { arreter(); return; }
      relire(appel.id);
    }, SUIVI_MS);
  }
  function relire(id) {
    return fetch(RAILWAY + '/appels-serveur/' + encodeURIComponent(id))
      .then(function (r) { return r.status === 404 ? { ok: true, appel: null } : r.json(); })
      .then(function (j) { if (j && j.ok) definir(j.appel); })
      .catch(function () {});
  }

  function demarrer() {
    var api = window.menuAPI; if (!api) return;
    var actif = false;
    try { actif = api.theme.fonctions.appel_serveur === true; } catch (_) {}
    if (!actif) return;
    rid = api.restaurantId;
    if (!btn) construire();
    majBouton();
    btn.classList.add('show');
    var enCours = lire(CLE_APPEL);
    if (enCours) relire(enCours);
  }

  window.addEventListener('menuApiReady', demarrer);
  if (window.menuAPI && window.menuAPI.ready) demarrer();
})();
