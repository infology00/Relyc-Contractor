/* ============================================================
   RELYC CONTRACTOR — Application shell
   Boot/preloader · Lenis smooth scroll · Header · Drawer
   Reveals · Counters · Accordion · Marquee · Forms
   ============================================================ */
(function () {
  'use strict';

  var W = window;
  var D = document;
  var RELYC = (W.RELYC = W.RELYC || {});

  var reduceMotion = W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  RELYC.reduceMotion = reduceMotion;
  RELYC.isTouch = W.matchMedia('(hover: none)').matches;

  /* ----------------------------------------------------------
     BOOT REGISTRY — modules register weighted preload tasks
     ---------------------------------------------------------- */
  var tasks = [];
  RELYC.boot = {
    add: function (name, weight, run) {
      tasks.push({ name: name, weight: weight || 1, run: run, done: 0 });
    }
  };

  /* ----------------------------------------------------------
     LENIS SMOOTH SCROLL
     ---------------------------------------------------------- */
  var lenis = null;

  function initLenis() {
    if (reduceMotion || typeof W.Lenis === 'undefined') return null;

    lenis = new W.Lenis({
      duration: 1.25,
      // Gentle exponential ease-out — long tail, no rubbery overshoot
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      wheelMultiplier: 0.85,
      touchMultiplier: 1.5,
      smoothWheel: true,
      syncTouch: false,
      autoRaf: false
    });

    RELYC.lenis = lenis;

    if (W.gsap && W.ScrollTrigger) {
      var gsap = W.gsap;
      var ST = W.ScrollTrigger;
      gsap.registerPlugin(ST);
      ST.config({ ignoreMobileResize: true });
      lenis.on('scroll', ST.update);
      // An exception thrown inside a ticker callback takes down GSAP's ticker
      // for the entire page, freezing every scroll-driven animation at once.
      gsap.ticker.add(function (time) {
        try { lenis.raf(time * 1000); } catch (e) { /* keep the ticker alive */ }
      });
      gsap.ticker.lagSmoothing(0);

      // Backgrounded tabs suspend rAF; positions can be stale on return.
      D.addEventListener('visibilitychange', function () {
        if (!D.hidden) { lenis.resize(); ST.refresh(); }
      });
    } else {
      var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
    return lenis;
  }

  RELYC.scrollTo = function (target, opts) {
    if (lenis) lenis.scrollTo(target, Object.assign({ offset: -70, duration: 1.4 }, opts || {}));
    else if (typeof target !== 'number' && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth' });
  };
  RELYC.stopScroll = function () { if (lenis) lenis.stop(); };
  RELYC.startScroll = function () { if (lenis) lenis.start(); };

  /* ----------------------------------------------------------
     PRELOADER
     ---------------------------------------------------------- */
  function runPreloader() {
    var el = D.querySelector('[data-preloader]');
    var fill = D.querySelector('[data-preloader-fill]');
    var pct = D.querySelector('[data-preloader-pct]');
    var totalWeight = tasks.reduce(function (s, t) { return s + t.weight; }, 0) || 1;
    var shown = 0;

    function paint() {
      var got = tasks.reduce(function (s, t) { return s + t.weight * t.done; }, 0);
      var p = Math.min(1, got / totalWeight);
      if (p < shown) p = shown;
      shown = p;
      if (fill) fill.style.transform = 'scaleX(' + p + ')';
      if (pct) pct.textContent = String(Math.round(p * 100)).padStart(3, '0') + '%';
    }

    function finish() {
      tasks.forEach(function (t) { t.done = 1; });
      paint();
      D.body.classList.remove('is-loading');
      D.body.classList.add('loaded');
      RELYC.startScroll();
      if (W.ScrollTrigger) W.ScrollTrigger.refresh();
      D.dispatchEvent(new CustomEvent('relyc:ready'));
      setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 900);
    }

    if (!el) { finish(); return; }

    RELYC.stopScroll();
    paint();

    // Font loading counts as one lightweight task
    tasks.push({
      name: 'fonts', weight: 2, done: 0,
      run: function (onProgress) {
        if (!D.fonts || !D.fonts.ready) { onProgress(1); return Promise.resolve(); }
        return D.fonts.ready.then(function () { onProgress(1); });
      }
    });

    var work = tasks.map(function (t) {
      var p;
      try {
        p = t.run(function (v) { t.done = Math.max(t.done, Math.min(1, v)); paint(); });
      } catch (e) { p = Promise.resolve(); }
      return Promise.resolve(p).catch(function () { }).then(function () { t.done = 1; paint(); });
    });

    // Hard ceiling so a slow/blocked asset can never trap the visitor
    var timeout = new Promise(function (res) { setTimeout(res, 9000); });
    Promise.race([Promise.all(work), timeout]).then(function () {
      setTimeout(finish, 260);
    });
  }

  /* ----------------------------------------------------------
     HEADER
     ---------------------------------------------------------- */
  function initHeader() {
    var header = D.querySelector('[data-header]');
    if (!header) return;
    var last = 0;
    var solidAt = 40;

    function onScroll() {
      var y = W.scrollY || D.documentElement.scrollTop;
      header.classList.toggle('is-solid', y > solidAt);
      if (!D.body.classList.contains('menu-open')) {
        var down = y > last && y > 320;
        header.classList.toggle('is-hidden', down);
      }
      last = y;
    }
    onScroll();
    W.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ----------------------------------------------------------
     MOBILE DRAWER
     ---------------------------------------------------------- */
  function initDrawer() {
    var burger = D.querySelector('[data-burger]');
    var drawer = D.querySelector('[data-drawer]');
    if (!burger || !drawer) return;

    var links = drawer.querySelectorAll('.drawer__link');
    links.forEach(function (l, i) { l.style.animationDelay = (0.06 + i * 0.045) + 's'; });

    function setOpen(open) {
      D.body.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (open) { RELYC.stopScroll(); } else { RELYC.startScroll(); }
    }

    burger.addEventListener('click', function () {
      setOpen(!D.body.classList.contains('menu-open'));
    });
    drawer.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    D.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && D.body.classList.contains('menu-open')) { setOpen(false); burger.focus(); }
    });
    W.addEventListener('resize', function () {
      if (W.innerWidth > 1280 && D.body.classList.contains('menu-open')) setOpen(false);
    });
  }

  /* ----------------------------------------------------------
     REVEAL ON SCROLL
     ---------------------------------------------------------- */
  function initReveal() {
    var nodes = D.querySelectorAll('[data-reveal],[data-reveal-stagger]');
    if (!nodes.length) return;
    if (reduceMotion || !('IntersectionObserver' in W)) {
      nodes.forEach(function (n) { n.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* ----------------------------------------------------------
     COUNTERS
     ---------------------------------------------------------- */
  function initCounters() {
    var nodes = D.querySelectorAll('[data-count]');
    if (!nodes.length) return;

    function run(el) {
      var target = parseFloat(el.dataset.count);
      var decimals = parseInt(el.dataset.countDecimals || '0', 10);
      var dur = 1500;
      if (reduceMotion) { el.textContent = target.toFixed(decimals); return; }
      var t0 = null;
      function step(t) {
        if (t0 === null) t0 = t;
        var p = Math.min(1, (t - t0) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (target * eased).toFixed(decimals);
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    if (!('IntersectionObserver' in W)) { nodes.forEach(run); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { run(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.4 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* ----------------------------------------------------------
     ACCORDION
     ---------------------------------------------------------- */
  function initAccordion() {
    var accs = D.querySelectorAll('[data-acc]');
    accs.forEach(function (acc) {
      var single = acc.dataset.acc === 'single';
      var items = acc.querySelectorAll('[data-acc-item]');

      items.forEach(function (item) {
        var btn = item.querySelector('[data-acc-btn]');
        var panel = item.querySelector('[data-acc-panel]');
        if (!btn || !panel) return;

        function setOpen(open) {
          item.classList.toggle('is-open', open);
          btn.setAttribute('aria-expanded', open ? 'true' : 'false');
          panel.setAttribute('aria-hidden', open ? 'false' : 'true');
          panel.style.height = open ? panel.scrollHeight + 'px' : '0px';
          if (open) {
            // Settle to auto so the panel reflows if the text rewraps later.
            // transitionend can be missed (background tab, interrupted
            // transition), so a timer backs it up.
            var settled = false;
            var settle = function () {
              if (settled) return;
              settled = true;
              if (item.classList.contains('is-open')) panel.style.height = 'auto';
              panel.removeEventListener('transitionend', settle);
              if (W.ScrollTrigger) W.ScrollTrigger.refresh();
            };
            panel.addEventListener('transitionend', settle);
            setTimeout(settle, 700);
          } else if (W.ScrollTrigger) {
            setTimeout(function () { W.ScrollTrigger.refresh(); }, 520);
          }
        }
        item._setOpen = setOpen;

        btn.addEventListener('click', function () {
          var willOpen = !item.classList.contains('is-open');
          if (single && willOpen) {
            items.forEach(function (o) {
              if (o !== item && o.classList.contains('is-open')) {
                o.querySelector('[data-acc-panel]').style.height = o.querySelector('[data-acc-panel]').scrollHeight + 'px';
                requestAnimationFrame(function () { o._setOpen(false); });
              }
            });
          }
          if (willOpen) panel.style.height = '0px';
          requestAnimationFrame(function () { setOpen(willOpen); });
        });

        if (item.dataset.accOpen === 'true') { setOpen(true); }
        else setOpen(false);
      });
    });

    W.addEventListener('resize', debounce(function () {
      D.querySelectorAll('[data-acc-item].is-open [data-acc-panel]').forEach(function (p) { p.style.height = 'auto'; });
    }, 200));
  }

  /* ----------------------------------------------------------
     MARQUEE — duplicate track so the loop is seamless
     ---------------------------------------------------------- */
  function initMarquee() {
    D.querySelectorAll('[data-marquee]').forEach(function (m) {
      var track = m.querySelector('.marquee__track');
      if (!track || track.dataset.cloned === 'true') return;
      track.innerHTML = track.innerHTML + track.innerHTML;
      track.dataset.cloned = 'true';
      var speed = parseFloat(m.dataset.marqueeSpeed || '55');
      var width = track.scrollWidth / 2;
      // Keep a constant pixel-per-second pace regardless of list length
      var dur = Math.max(18, width / speed);
      track.style.animationDuration = dur + 's';
    });
  }

  /* ----------------------------------------------------------
     PROCESS TIMELINE ↔ ACCORDION LINK
     ---------------------------------------------------------- */
  function initTimelineLink() {
    D.querySelectorAll('[data-tl-jump]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.dataset.tlJump;
        var item = D.getElementById(id);
        if (!item) return;
        if (!item.classList.contains('is-open')) item.querySelector('[data-acc-btn]').click();
        setTimeout(function () { RELYC.scrollTo(item, { offset: -100 }); }, 60);
      });
    });
  }

  /* ----------------------------------------------------------
     FORMS
     ---------------------------------------------------------- */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function fieldOf(input) { return input.closest('.field'); }

  function validate(form) {
    var ok = true;
    form.querySelectorAll('[required]').forEach(function (input) {
      var f = fieldOf(input);
      var val = (input.value || '').trim();
      var bad = !val;
      if (!bad && input.type === 'email') bad = !EMAIL_RE.test(val);
      if (!bad && input.type === 'tel') bad = val.replace(/\D/g, '').length < 7;
      if (f) f.classList.toggle('has-error', bad);
      if (bad && ok) { input.focus(); }
      if (bad) ok = false;
    });
    return ok;
  }

  function initForms() {
    D.querySelectorAll('[data-form]').forEach(function (form) {
      var status = form.querySelector('[data-form-status]');
      var submit = form.querySelector('[type=submit]');

      form.querySelectorAll('input,select,textarea').forEach(function (input) {
        input.addEventListener('input', function () {
          var f = fieldOf(input);
          if (f) f.classList.remove('has-error');
        });
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();

        // Honeypot — silently accept and discard bot submissions
        var hp = form.querySelector('[name=_company_website]');
        if (hp && hp.value) { say('ok', form.dataset.successMsg || 'Thank you — your message has been received.'); return; }

        if (!validate(form)) { say('err', 'Please complete the highlighted fields.'); return; }

        var endpoint = form.dataset.endpoint || '';
        var data = {};
        new FormData(form).forEach(function (v, k) {
          if (k.charAt(0) === '_') return;
          if (v instanceof File) { if (v.name) data[k] = v.name; return; }
          data[k] = v;
        });
        data._page = location.pathname;
        data._submitted = new Date().toISOString();

        if (!endpoint) { mailtoFallback(form, data); return; }

        setBusy(true);
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data)
        }).then(function (r) {
          if (!r.ok) throw new Error('bad status');
          onSuccess();
        }).catch(function () {
          setBusy(false);
          say('err', 'We could not send that automatically. Please call 305-558-9988 or email service@relyc.co.');
        });

        function onSuccess() {
          setBusy(false);
          say('ok', form.dataset.successMsg || 'Thank you — your request has been received. We respond to every inquiry promptly, usually the same business day.');
          form.reset();
          var unlock = form.dataset.unlock;
          if (unlock) revealDownload(form, unlock);
        }
      });

      function setBusy(b) {
        if (!submit) return;
        submit.disabled = b;
        submit.style.opacity = b ? '.6' : '';
        submit.dataset.label = submit.dataset.label || submit.textContent.trim();
        if (b) submit.textContent = 'Sending…';
        else submit.textContent = submit.dataset.label;
      }

      function say(kind, msg) {
        if (!status) { alert(msg); return; }
        status.className = 'form-status ' + (kind === 'ok' ? 'is-ok' : 'is-err');
        status.textContent = msg;
        status.setAttribute('role', 'status');
        RELYC.scrollTo(status, { offset: -160 });
      }

      function mailtoFallback(f, data) {
        var subject = f.dataset.subject || 'Website enquiry — Relyc Contractor';
        var lines = Object.keys(data).filter(function (k) { return k.charAt(0) !== '_'; })
          .map(function (k) { return labelFor(f, k) + ': ' + data[k]; });
        var href = 'mailto:service@relyc.co?subject=' + encodeURIComponent(subject) +
          '&body=' + encodeURIComponent(lines.join('\n'));
        W.location.href = href;
        say('ok', 'Your email client is opening with the details filled in. Prefer to talk? Call 305-558-9988.');
        var unlock = f.dataset.unlock;
        if (unlock) revealDownload(f, unlock);
      }

      function labelFor(f, name) {
        var input = f.querySelector('[name="' + name + '"]');
        var lab = input && input.closest('.field') && input.closest('.field').querySelector('label');
        return lab ? lab.textContent.replace('*', '').trim() : name;
      }

      function revealDownload(f, url) {
        var box = D.querySelector('[data-unlock-target]');
        if (!box) return;
        box.hidden = false;
        var a = box.querySelector('a[data-unlock-link]');
        if (a) { a.href = url; a.focus(); }
        RELYC.scrollTo(box, { offset: -180 });
      }
    });
  }

  /* ----------------------------------------------------------
     ANCHORS
     ---------------------------------------------------------- */
  function initAnchors() {
    D.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href');
      if (!id || id === '#' || id.length < 2) return;
      var t = D.querySelector(id);
      if (!t) return;
      e.preventDefault();
      RELYC.scrollTo(t, { offset: -90 });
      history.replaceState(null, '', id);
    });
  }

  /* ----------------------------------------------------------
     MISC
     ---------------------------------------------------------- */
  function initYear() {
    D.querySelectorAll('[data-year]').forEach(function (n) { n.textContent = new Date().getFullYear(); });
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var a = arguments, c = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(c, a); }, ms);
    };
  }
  RELYC.debounce = debounce;

  /* ----------------------------------------------------------
     START
     ---------------------------------------------------------- */
  function start() {
    initLenis();
    initHeader();
    initDrawer();
    initReveal();
    initCounters();
    initAccordion();
    initMarquee();
    initTimelineLink();
    initForms();
    initAnchors();
    initYear();
    runPreloader();
  }

  // Deferred scripts execute before DOMContentLoaded, so waiting on that
  // event guarantees every module (film.js) has registered its boot tasks.
  if (D.readyState === 'complete') setTimeout(start, 0);
  else D.addEventListener('DOMContentLoaded', start);
})();
