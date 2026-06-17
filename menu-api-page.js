/* menu-api-page.js — Integration layer: promotions, allergènes, rendu dynamique */
(function () {
  var CATS   = window.PAGE_CATS   || [];
  var IS_VIN = window.PAGE_IS_WINE || false;

  function fmt(n) {
    var num = +n;
    return (Number.isInteger(num) ? num : num.toFixed(2).replace('.', ',')) + (IS_VIN ? ' €/v' : ' €');
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function calcPromo(prix, p) {
    if (!p) return null;
    var fin;
    var label;
    if (p.prix_promo != null) {
      fin   = +p.prix_promo;
      label = '−' + Math.round(prix - p.prix_promo) + ' €';
    } else if (p.type === 'pourcent') {
      fin   = prix * (1 - p.valeur / 100);
      label = '−' + p.valeur + '%';
    } else if (p.type === 'fixe') {
      fin   = prix - p.valeur;
      label = '−' + p.valeur + ' €';
    } else {
      return null;
    }
    return { fin: fin, label: label };
  }

  function getPromo(pid) {
    return (window.menuAPI.promotions || []).find(function (p) { return p.plat_id === pid; });
  }

  function cardHTML(plat, idx) {
    var pid  = plat.id || plat._id || ('api' + idx);
    var pr   = getPromo(pid);
    var info = calcPromo(plat.prix || 0, pr);
    var priceHTML = info
      ? '<s>' + esc(fmt(plat.prix)) + '</s> <span class="promo-new">' + esc(fmt(info.fin)) + '</span>'
      : esc(fmt(plat.prix));
    var badge = info ? '<span class="promo-badge">' + esc(info.label) + '</span>' : '';
    var img   = plat.image_url
      ? '<img src="' + esc(plat.image_url) + '" alt="' + esc(plat.nom) + '" class="dish-img" loading="' + (idx === 0 ? 'eager' : 'lazy') + '" />'
      : '';
    return '<article class="dish-card" data-id="' + esc(pid) + '">'
      + '<div class="dish-img-wrap">' + img
      + '<span class="dish-num">' + String(idx + 1).padStart(2, '0') + '</span>' + badge
      + '</div>'
      + '<div class="dish-body"><div class="dish-row">'
      + '<h2 class="dish-name">' + esc(plat.nom) + '</h2>'
      + '<span class="dish-price">' + priceHTML + '</span>'
      + '</div><p class="dish-desc">' + esc(plat.description || '') + '</p>'
      + '</div></article>';
  }

  function initFallback(card) {
    var img  = card.querySelector('.dish-img');
    if (!img) return;
    var name = (card.querySelector('.dish-name') || {}).textContent || '';
    var wrap = card.querySelector('.dish-img-wrap');
    var src  = img.getAttribute('src') || '';
    var done = false;
    function fb() {
      if (done) return; done = true;
      img.style.display = 'none';
      try { img.src = ''; } catch (_) {}
      wrap.classList.add('fallback-active');
      if (!wrap.querySelector('.img-placeholder')) {
        var p = document.createElement('p');
        p.className = 'img-placeholder'; p.textContent = name; wrap.appendChild(p);
      }
    }
    img.onerror = fb;
    if (!src) { fb(); return; }
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, 2000);
    fetch(src, { method: 'HEAD', signal: ctrl.signal })
      .then(function (r) { clearTimeout(t); if (!r.ok) fb(); })
      .catch(function ()  { clearTimeout(t); fb(); });
  }

  function run() {
    var api = window.menuAPI;
    if (!api) return;

    var pagePlats = api.plats.filter(function (p) {
      return CATS.indexOf((p.categorie || p.category || '').toLowerCase()) >= 0;
    });

    if (pagePlats.length > 0) {
      // Rebuild dishes from API data
      var d = window.dishes;
      if (d) Object.keys(d).forEach(function (k) { delete d[k]; });
      pagePlats.forEach(function (p) {
        var pid  = p.id || p._id;
        var pr   = getPromo(pid);
        var info = calcPromo(p.prix || 0, pr);
        if (d) d[pid] = {
          name:     p.nom,
          price:    fmt(info ? info.fin : p.prix),
          img:      p.image_url || '',
          fb:       '',
          desc:     p.description_longue || p.description || '',
          allergens: p.allergenes || p.accords || [],
          wineType: p.type_vin || p.wineType || ''
        };
      });

      // Replace DOM dish cards
      document.querySelectorAll('.dish-card, .card-sep').forEach(function (el) { el.remove(); });
      var orn = document.querySelector('.section-ornament');
      orn.insertAdjacentHTML('afterend', pagePlats.map(cardHTML).join(''));

      // Attach click listeners and image fallbacks on new cards
      document.querySelectorAll('.dish-card').forEach(function (card) {
        card.addEventListener('click', function () { if (window.openModal) window.openModal(card.dataset.id); });
        initFallback(card);
      });

    } else {
      // API returned no data for this category — augment existing hardcoded dishes

      // Update allergens / descriptions from API where name matches
      api.plats.forEach(function (p) {
        var d = window.dishes;
        if (!d) return;
        Object.values(d).forEach(function (entry) {
          if ((entry.name || '').toLowerCase() === (p.nom || '').toLowerCase()) {
            if (p.allergenes && p.allergenes.length) entry.allergens = p.allergenes;
            if (p.description_longue) entry.desc = p.description_longue;
          }
        });
      });

      // Apply promo badges by matching plat_id → nom → DOM card
      api.promotions.forEach(function (pr) {
        var plat = api.plats.find(function (p) { return (p.id || p._id) === pr.plat_id; });
        if (!plat) return;
        var info = calcPromo(plat.prix || 0, pr);
        if (!info) return;
        document.querySelectorAll('.dish-card').forEach(function (card) {
          var ne = card.querySelector('.dish-name');
          if (!ne || ne.textContent.trim().toLowerCase() !== (plat.nom || '').toLowerCase()) return;
          // Badge
          var wrap = card.querySelector('.dish-img-wrap');
          if (wrap && !wrap.querySelector('.promo-badge')) {
            var b = document.createElement('span');
            b.className = 'promo-badge'; b.textContent = info.label; wrap.appendChild(b);
          }
          // Price
          var pe = card.querySelector('.dish-price');
          if (pe) pe.innerHTML = '<s>' + esc(fmt(plat.prix)) + '</s> <span class="promo-new">' + esc(fmt(info.fin)) + '</span>';
          // Update dishes object
          var key = card.dataset.id;
          if (window.dishes && window.dishes[key]) window.dishes[key].price = fmt(info.fin);
        });
      });
    }

    // Expose live context for chat
    window._menuApiContext = {
      promotions: api.promotions,
      allergenes: api.plats.reduce(function (acc, p) {
        if (p.allergenes && p.allergenes.length) acc[p.nom] = p.allergenes;
        return acc;
      }, {})
    };
  }

  if (window.menuAPI && window.menuAPI.ready) { run(); }
  else { window.addEventListener('menuApiReady', run, { once: true }); }
})();
