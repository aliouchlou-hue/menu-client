/**
 * passport.js — Passeport MenuVision
 * Profil client portable cross-restaurants. Optionnel et non intrusif :
 * le menu reste pleinement utilisable sans connexion.
 *
 *  • Connexion Google (Supabase Auth)
 *  • Bandeau de bienvenue + points de fidélité (✦)
 *  • Plats incompatibles grisés selon les allergènes enregistrés
 *  • Préférences transmises au conseiller IA
 *
 * Pré-requis : activer le provider Google dans Supabase → Authentication → Providers.
 */
(function () {
  'use strict';

  var SUPABASE_URL  = 'https://gqztmiqokeqrjdvmuhxt.supabase.co';
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxenRtaXFva2Vxcmpkdm11aHh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxODU0MDUsImV4cCI6MjA5NTc2MTQwNX0.40WI303hdlQiMR_xVXqkXxqRgVKz3jZWE5QNJZFVGRY';
  var RAILWAY       = 'https://menuvision-production.up.railway.app';

  var ALLERGENES_COURANTS = ['Gluten', 'Fruits de mer', 'Crustacés', 'Lactose', 'Œuf', 'Arachides', 'Fruits à coque', 'Soja', 'Poisson', 'Sésame'];

  // État global exposé (lu par cart.js pour le paiement)
  window.MVPassport = { client: null, profile: null };

  var supa = null;
  var profile = null;
  var apiReady = false;

  /* ─── Styles (sobres & luxe, alignés sur la charte du menu) ─────────────── */
  function injectStyles() {
    var s = document.createElement('style');
    s.textContent = [
      '.mv-cta{display:inline-flex;align-items:center;gap:9px;margin:18px auto 0;padding:11px 20px;',
      'background:transparent;border:1px solid var(--sep,#D4C4B0);border-radius:30px;cursor:pointer;',
      "font-family:'Montserrat',sans-serif;font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;",
      'color:var(--text-soft,#6B5244);transition:all .25s;-webkit-tap-highlight-color:transparent;}',
      '.mv-cta:hover{border-color:var(--terre,#8B4A2F);color:var(--terre,#8B4A2F);}',
      '.mv-cta svg{width:16px;height:16px;flex-shrink:0;}',
      '.mv-cta .mv-spark{color:var(--warm-mid,#C4A882);font-size:.8rem;}',

      /* Bandeau de bienvenue */
      '.mv-banner{position:sticky;top:0;z-index:300;display:flex;align-items:center;gap:12px;',
      'padding:10px 18px;background:rgba(245,240,232,.96);backdrop-filter:blur(8px);',
      'border-bottom:1px solid var(--sep,#D4C4B0);font-family:"Montserrat",sans-serif;',
      'transform:translateY(-100%);transition:transform .5s cubic-bezier(.32,.72,0,1);}',
      '.mv-banner.show{transform:translateY(0);}',
      '.mv-banner-pic{width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0;',
      'border:1px solid var(--warm-mid,#C4A882);background:var(--warm-mid,#C4A882);}',
      '.mv-banner-txt{flex:1;min-width:0;line-height:1.3;}',
      '.mv-banner-hi{font-family:"Cormorant Garamond",serif;font-style:italic;font-size:1.02rem;',
      'color:var(--text,#2C1F14);}',
      '.mv-banner-sub{font-size:.62rem;letter-spacing:.08em;color:var(--text-soft,#6B5244);margin-top:1px;}',
      '.mv-banner-spark{color:var(--terre,#8B4A2F);font-weight:600;}',
      '.mv-banner-edit{background:none;border:none;cursor:pointer;color:var(--text-soft,#6B5244);',
      'font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;padding:6px 8px;white-space:nowrap;}',
      '.mv-banner-out{background:none;border:none;cursor:pointer;color:var(--text-soft,#6B5244);opacity:.6;',
      'font-size:1rem;padding:2px 6px;line-height:1;}',

      /* Pastille points (gamification discrète) */
      '.mv-points{position:fixed;top:calc(10px + env(safe-area-inset-top,0));right:14px;z-index:260;',
      'display:none;align-items:center;gap:6px;padding:6px 13px;border-radius:20px;',
      'background:var(--terre,#8B4A2F);color:var(--creme,#F5F0E8);',
      'font-family:"Montserrat",sans-serif;font-size:.66rem;letter-spacing:.08em;',
      'box-shadow:0 3px 14px rgba(139,74,47,.32);opacity:0;transition:opacity .4s,transform .4s;}',
      '.mv-points.show{display:flex;opacity:1;}',
      '.mv-points .mv-spark{color:var(--warm-mid,#F0D9B5);}',
      '@keyframes mv-pop{0%{transform:scale(1);}35%{transform:scale(1.22);}100%{transform:scale(1);}}',
      '.mv-points.gain{animation:mv-pop .7s cubic-bezier(.32,.72,0,1);}',
      '.mv-gain-float{position:fixed;top:42px;right:20px;z-index:261;color:var(--terre,#8B4A2F);',
      'font-family:"Cormorant Garamond",serif;font-style:italic;font-size:1.3rem;font-weight:600;',
      'pointer-events:none;opacity:0;}',
      '@keyframes mv-rise{0%{opacity:0;transform:translateY(6px);}25%{opacity:1;}100%{opacity:0;transform:translateY(-26px);}}',
      '.mv-gain-float.go{animation:mv-rise 1.8s ease-out forwards;}',

      /* Plats incompatibles */
      '.dish-card.mv-incompatible{opacity:.5;filter:grayscale(.7);position:relative;}',
      '.dish-card.mv-incompatible .mv-warn{position:absolute;top:8px;left:8px;z-index:3;',
      'display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:14px;',
      'background:rgba(44,31,20,.82);color:#F5F0E8;font-family:"Montserrat",sans-serif;',
      'font-size:.56rem;letter-spacing:.05em;}',

      /* Panneau Passeport (préférences / allergènes) */
      '.mv-overlay{position:fixed;inset:0;z-index:500;background:rgba(26,15,8,.6);display:flex;',
      'align-items:flex-end;opacity:0;pointer-events:none;transition:opacity .3s;}',
      '.mv-overlay.open{opacity:1;pointer-events:all;}',
      '.mv-sheet{width:100%;max-height:86vh;overflow-y:auto;background:var(--creme,#F5F0E8);',
      'border-radius:18px 18px 0 0;padding:8px 22px calc(26px + env(safe-area-inset-bottom,0));',
      'transform:translateY(40px);transition:transform .35s cubic-bezier(.32,.72,0,1);}',
      '.mv-overlay.open .mv-sheet{transform:translateY(0);}',
      '.mv-sheet-handle{width:34px;height:3px;background:var(--sep,#D4C4B0);border-radius:2px;margin:6px auto 16px;}',
      '.mv-sheet h3{font-family:"Cormorant Garamond",serif;font-style:italic;font-weight:300;',
      'font-size:1.5rem;color:var(--text,#2C1F14);margin:0 0 4px;}',
      '.mv-sheet p.mv-lead{font-size:.72rem;color:var(--text-soft,#6B5244);margin:0 0 18px;line-height:1.5;}',
      '.mv-label{font-size:.58rem;letter-spacing:.22em;text-transform:uppercase;color:var(--warm-mid,#C4A882);',
      'margin:18px 0 9px;}',
      '.mv-chips{display:flex;flex-wrap:wrap;gap:8px;}',
      '.mv-chip{padding:7px 13px;border:1px solid var(--sep,#D4C4B0);border-radius:20px;cursor:pointer;',
      'font-family:"Montserrat",sans-serif;font-size:.66rem;color:var(--text-soft,#6B5244);',
      'transition:all .15s;-webkit-tap-highlight-color:transparent;}',
      '.mv-chip.on{background:var(--terre,#8B4A2F);border-color:var(--terre,#8B4A2F);color:var(--creme,#F5F0E8);}',
      '.mv-pref-input{width:100%;margin-top:9px;padding:11px 14px;border:1px solid var(--sep,#D4C4B0);',
      'border-radius:10px;background:#fff;font-family:"Montserrat",sans-serif;font-size:.78rem;',
      'color:var(--text,#2C1F14);outline:none;}',
      '.mv-save{width:100%;margin-top:22px;padding:14px;background:var(--terre,#8B4A2F);',
      'color:var(--creme,#F5F0E8);border:none;cursor:pointer;font-family:"Montserrat",sans-serif;',
      'font-size:.68rem;letter-spacing:.24em;text-transform:uppercase;}',
      '.mv-save:active{background:var(--terre-dk,#6e3822);}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ─── Chargement de la lib Supabase ─────────────────────────────────────── */
  function loadSupabase() {
    return new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) return resolve();
      var sc = document.createElement('script');
      sc.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
      sc.onload = resolve;
      sc.onerror = reject;
      document.head.appendChild(sc);
    });
  }

  /* ─── API backend MenuVision ────────────────────────────────────────────── */
  function apiGetProfile(email) {
    return fetch(RAILWAY + '/profil/client?email=' + encodeURIComponent(email))
      .then(function (r) { return r.json(); })
      .then(function (j) { return j.ok ? j.profil : null; })
      .catch(function () { return null; });
  }
  function apiUpsertProfile(body) {
    return fetch(RAILWAY + '/profil/client', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }).then(function (r) { return r.json(); }).then(function (j) { return j.ok ? j.profil : null; })
      .catch(function () { return null; });
  }

  /* ─── Helpers ───────────────────────────────────────────────────────────── */
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
  function firstName(nom) { return (nom || '').trim().split(' ')[0] || 'Gourmet'; }

  function googleSvg() {
    return '<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
  }

  /* ─── CTA « Débloquer » dans le footer ──────────────────────────────────── */
  function renderCTA() {
    if (document.querySelector('.mv-cta')) return;
    var footer = document.querySelector('.page-footer') || document.querySelector('footer') || document.body;
    var btn = document.createElement('button');
    btn.className = 'mv-cta';
    btn.innerHTML = '<span class="mv-spark">✦</span> Débloquer mon Passeport Gourmand ' + googleSvg();
    btn.addEventListener('click', signIn);
    if (footer === document.body) { footer.appendChild(btn); }
    else { footer.appendChild(document.createElement('div')).appendChild(btn); }
  }

  function signIn() {
    if (!supa) return;
    supa.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.href.split('#')[0] }
    }).then(function (res) {
      if (res && res.error) {
        alert('Connexion indisponible pour le moment. (' + res.error.message + ')');
      }
    });
  }

  function signOut() {
    if (!supa) return;
    supa.auth.signOut().then(function () { location.reload(); });
  }

  /* ─── Bandeau + pastille points ─────────────────────────────────────────── */
  function renderConnected(user) {
    var nom   = profile && profile.nom ? profile.nom : (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || '';
    var pic   = (profile && profile.photo_url) || (user.user_metadata && (user.user_metadata.avatar_url || user.user_metadata.picture)) || '';
    var pts   = (profile && profile.points_fidelite) || 0;
    var nbRes = (profile && profile.restaurants_visites) || 0;

    // retirer le CTA s'il existe
    var cta = document.querySelector('.mv-cta'); if (cta) cta.remove();

    // Bandeau
    if (!document.querySelector('.mv-banner')) {
      var b = document.createElement('div');
      b.className = 'mv-banner';
      b.innerHTML =
        (pic ? '<img class="mv-banner-pic" src="' + pic + '" alt="" referrerpolicy="no-referrer"/>' : '<span class="mv-banner-pic"></span>') +
        '<div class="mv-banner-txt">' +
          '<div class="mv-banner-hi">Bienvenue ' + escapeHtml(firstName(nom)) + '</div>' +
          '<div class="mv-banner-sub"><span class="mv-banner-spark">✦ ' + pts + ' points</span>' +
            (nbRes ? ' · ' + nbRes + ' restaurant' + (nbRes > 1 ? 's' : '') + ' visité' + (nbRes > 1 ? 's' : '') : '') +
          '</div>' +
        '</div>' +
        '<button class="mv-banner-edit" id="mvEdit">Mon passeport</button>' +
        '<button class="mv-banner-out" id="mvOut" title="Se déconnecter">⏏</button>';
      document.body.insertBefore(b, document.body.firstChild);
      requestAnimationFrame(function () { b.classList.add('show'); });
      document.getElementById('mvEdit').addEventListener('click', openPanel);
      document.getElementById('mvOut').addEventListener('click', signOut);
    }

    // Pastille points
    if (!document.querySelector('.mv-points')) {
      var p = document.createElement('div');
      p.className = 'mv-points';
      p.innerHTML = '<span class="mv-spark">✦</span> <span id="mvPts">' + pts + '</span> points MenuVision';
      document.body.appendChild(p);
      requestAnimationFrame(function () { p.classList.add('show'); });
    } else {
      document.getElementById('mvPts').textContent = pts;
    }

    maybeAnimatePoints(pts);
    applyAllergenGraying();
    feedChatContext();
  }

  /* ─── Animation de gain de points (après un paiement) ───────────────────── */
  function maybeAnimatePoints(current) {
    var prev = 0;
    try { prev = parseInt(localStorage.getItem('mv_points') || '0', 10) || 0; } catch (_) {}
    try { localStorage.setItem('mv_points', String(current)); } catch (_) {}
    var gain = current - prev;
    if (gain > 0 && prev > 0) {
      var pill = document.querySelector('.mv-points');
      if (pill) { pill.classList.remove('gain'); void pill.offsetWidth; pill.classList.add('gain'); }
      var f = document.createElement('div');
      f.className = 'mv-gain-float';
      f.textContent = '+' + gain + ' ✦';
      document.body.appendChild(f);
      requestAnimationFrame(function () { f.classList.add('go'); });
      setTimeout(function () { f.remove(); }, 2000);
    }
  }

  // Sur la page de succès, le webhook crédite les points en différé → on rafraîchit.
  function refreshAfterPayment() {
    if (!/success/i.test(location.pathname)) return;
    var user = window.MVPassport.client;
    if (!user) return;
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      apiGetProfile(user.email).then(function (p) {
        if (p) { profile = p; window.MVPassport.profile = p; renderConnected(currentUser); }
      });
      if (tries >= 4) clearInterval(iv);
    }, 2500);
  }

  /* ─── Grisé des plats incompatibles ─────────────────────────────────────── */
  function applyAllergenGraying() {
    if (!profile || !profile.allergenes || !profile.allergenes.length) return;
    var bad = profile.allergenes.map(norm);
    var dishes = window.dishes || {};
    document.querySelectorAll('.dish-card').forEach(function (card) {
      var entry = dishes[card.dataset.id];
      var alls = (entry && entry.allergens) || [];
      var hit = alls.some(function (a) {
        var na = norm(a);
        return bad.some(function (b) { return na.indexOf(b) >= 0 || b.indexOf(na) >= 0; });
      });
      card.classList.toggle('mv-incompatible', hit);
      var existing = card.querySelector('.mv-warn');
      if (hit && !existing) {
        var w = document.createElement('span');
        w.className = 'mv-warn';
        w.textContent = '⚠ Allergène';
        (card.querySelector('.dish-img-wrap') || card).appendChild(w);
      } else if (!hit && existing) { existing.remove(); }
    });
  }

  /* ─── Contexte IA (préférences + allergènes) ────────────────────────────── */
  function feedChatContext() {
    if (!profile) return;
    window._menuApiContext = window._menuApiContext || {};
    window._menuApiContext.passport = {
      prenom:      firstName(profile.nom),
      allergenes:  profile.allergenes || [],
      preferences: profile.preferences || []
    };
  }

  /* ─── Panneau d'édition du Passeport ────────────────────────────────────── */
  function openPanel() {
    var sel = new Set((profile && profile.allergenes ? profile.allergenes : []).map(norm));
    var prefStr = (profile && profile.preferences ? profile.preferences : []).join(', ');

    var ov = document.createElement('div');
    ov.className = 'mv-overlay';
    ov.innerHTML =
      '<div class="mv-sheet" role="dialog" aria-label="Mon Passeport">' +
        '<div class="mv-sheet-handle"></div>' +
        '<h3>Mon Passeport Gourmand</h3>' +
        '<p class="mv-lead">Renseignez vos allergènes et vos goûts : nous adaptons la carte et les conseils du sommelier, ici et dans tous les restaurants MenuVision.</p>' +
        '<div class="mv-label">Mes allergènes</div>' +
        '<div class="mv-chips" id="mvAllg">' +
          ALLERGENES_COURANTS.map(function (a) {
            return '<button class="mv-chip' + (sel.has(norm(a)) ? ' on' : '') + '" data-a="' + escapeHtml(a) + '">' + escapeHtml(a) + '</button>';
          }).join('') +
        '</div>' +
        '<div class="mv-label">Mes préférences</div>' +
        '<input class="mv-pref-input" id="mvPref" placeholder="ex. vins rouges corsés, cuisine épicée, peu sucré…" value="' + escapeHtml(prefStr) + '"/>' +
        '<button class="mv-save" id="mvSave">Enregistrer</button>' +
      '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('open'); });

    function close() { ov.classList.remove('open'); setTimeout(function () { ov.remove(); }, 300); }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelectorAll('.mv-chip').forEach(function (c) {
      c.addEventListener('click', function () { c.classList.toggle('on'); });
    });
    document.getElementById('mvSave').addEventListener('click', function () {
      var allergenes = Array.prototype.slice.call(ov.querySelectorAll('.mv-chip.on')).map(function (c) { return c.dataset.a; });
      var preferences = document.getElementById('mvPref').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      var btn = document.getElementById('mvSave');
      btn.disabled = true; btn.textContent = 'Enregistrement…';
      apiUpsertProfile({ email: currentUser.email, allergenes: allergenes, preferences: preferences })
        .then(function (p) {
          if (p) { profile = p; window.MVPassport.profile = p; }
          close();
          renderConnected(currentUser);
        });
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ─── Flux de connexion ─────────────────────────────────────────────────── */
  var currentUser = null;

  function onSession(session) {
    if (!session || !session.user) { renderCTA(); return; }
    var user = session.user;
    currentUser = user;
    window.MVPassport.client = {
      email: user.email,
      nom:   (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || ''
    };

    // 1. upsert (crée/maj nom + photo), puis 2. récupère le profil complet (points, allergènes)
    apiUpsertProfile({
      email:     user.email,
      nom:       window.MVPassport.client.nom,
      photo_url: (user.user_metadata && (user.user_metadata.avatar_url || user.user_metadata.picture)) || null
    }).then(function (p) {
      profile = p;
      if (!profile) { return apiGetProfile(user.email).then(function (pp) { profile = pp; }); }
    }).then(function () {
      window.MVPassport.profile = profile;
      renderConnected(user);
      refreshAfterPayment();
    });
  }

  /* ─── Init ──────────────────────────────────────────────────────────────── */
  function start() {
    injectStyles();
    loadSupabase().then(function () {
      supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      supa.auth.getSession().then(function (res) {
        onSession(res && res.data ? res.data.session : null);
      });
      supa.auth.onAuthStateChange(function (_evt, session) {
        if (session && (!currentUser || currentUser.email !== session.user.email)) onSession(session);
      });
    }).catch(function () {
      // Supabase indisponible → le menu reste utilisable, pas de Passeport.
      console.warn('[Passeport] Supabase non chargé');
    });

    // Re-grise les plats quand la carte est (re)construite par menu-api-page.js
    window.addEventListener('menuApiReady', function () {
      apiReady = true;
      setTimeout(applyAllergenGraying, 60);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
