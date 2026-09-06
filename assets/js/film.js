/* ============================================================
   RELYC CONTRACTOR — Scroll Film
   Canvas-based frame-sequence scrubbing driven by scroll.

   Frame sequences beat scrubbing a <video> element: seeking
   video.currentTime stalls on iOS Safari and stutters wherever
   the GOP is long. Decoded stills always land on the frame the
   scroll position asks for.
   ============================================================ */
(function () {
  'use strict';

  var W = window;
  var D = document;
  var RELYC = (W.RELYC = W.RELYC || {});

  var sections = [].slice.call(D.querySelectorAll('[data-film]'));
  if (!sections.length) return;

  var reduceMotion = W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isNarrow = W.matchMedia('(max-width: 800px)').matches;
  var saveData = (navigator.connection && (navigator.connection.saveData ||
    /2g/.test(navigator.connection.effectiveType || ''))) || false;

  // Low-power / data-saver visitors get the poster art and static panels.
  var STATIC = reduceMotion || saveData || !W.gsap || !W.ScrollTrigger;

  var TIER = isNarrow ? 'm' : 'w';

  /* ----------------------------------------------------------
     FRAME LOADER
     ---------------------------------------------------------- */
  function FrameSet(base, count) {
    this.base = base;
    this.count = count;
    this.images = new Array(count);
    this.ready = new Array(count).fill(false);
    this.loadedCount = 0;
    this.started = false;
  }

  FrameSet.prototype.url = function (i) {
    return this.base + '/' + TIER + '/' + String(i + 1).padStart(3, '0') + '.webp';
  };

  FrameSet.prototype.load = function (onProgress, concurrency) {
    var self = this;
    if (self.started) return self._promise;
    self.started = true;
    concurrency = concurrency || 6;

    var next = 0;
    self._promise = new Promise(function (resolve) {
      var active = 0;

      function pump() {
        while (active < concurrency && next < self.count) {
          load(next++);
        }
        if (active === 0 && next >= self.count) resolve(self);
      }

      function load(i) {
        active++;
        var img = new Image();
        img.decoding = 'async';
        img.src = self.url(i);

        var settle = function () {
          active--;
          self.loadedCount++;
          if (onProgress) onProgress(self.loadedCount / self.count);
          pump();
        };

        img.onload = function () {
          self.images[i] = img;
          self.ready[i] = true;
          if (img.decode) {
            img.decode().then(settle, settle);
          } else {
            settle();
          }
        };
        img.onerror = settle;
      }

      pump();
    });
    return self._promise;
  };

  // Nearest already-decoded frame, so a partially loaded act still paints.
  FrameSet.prototype.nearest = function (i) {
    if (this.ready[i]) return this.images[i];
    for (var d = 1; d < this.count; d++) {
      if (i - d >= 0 && this.ready[i - d]) return this.images[i - d];
      if (i + d < this.count && this.ready[i + d]) return this.images[i + d];
    }
    return null;
  };

  /* ----------------------------------------------------------
     FILM SECTION
     ---------------------------------------------------------- */
  function Film(section) {
    this.el = section;
    this.stage = section.querySelector('.film__stage');
    this.canvas = section.querySelector('.film__canvas');
    this.panels = [].slice.call(section.querySelectorAll('.film__panel'));
    this.bar = section.querySelector('[data-film-bar]');

    this.count = parseInt(section.dataset[TIER === 'm' ? 'framesM' : 'framesW'], 10) || 0;
    this.base = section.dataset.src;
    this.length = parseInt(section.dataset.length, 10) || 500;
    this.critical = section.dataset.preload === 'critical';

    this.frame = -1;
    this.state = { f: 0 };
    this.set = new FrameSet(this.base, this.count);

    if (this.canvas) {
      var w = TIER === 'm' ? 480 : 800;
      var h = TIER === 'm' ? 270 : 450;
      this.canvas.width = w;
      this.canvas.height = h;
      this.ctx = this.canvas.getContext('2d', { alpha: false });
    }
  }

  Film.prototype.draw = function (i) {
    if (!this.ctx) return;
    i = Math.max(0, Math.min(this.count - 1, Math.round(i)));
    if (i === this.frame) return;
    var img = this.set.nearest(i);
    if (!img) return;
    this.frame = i;
    this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
    if (!this.live) { this.live = true; this.stage.classList.add('is-live'); }
  };

  Film.prototype.setHeight = function () {
    var unit = (W.CSS && W.CSS.supports && W.CSS.supports('height', '100svh')) ? 'svh' : 'vh';
    this.el.style.height = this.length + unit;
  };

  Film.prototype.build = function () {
    var self = this;
    var gsap = W.gsap;

    self.setHeight();

    // Scrubbed frame playback. `scrub` adds inertia so the film keeps
    // gliding for a beat after the wheel stops — it reads as footage,
    // not as a slideshow snapped to scroll position.
    gsap.to(self.state, {
      f: self.count - 1,
      ease: 'none',
      scrollTrigger: {
        trigger: self.el,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1.1,
        invalidateOnRefresh: true,
        onUpdate: function (st) {
          if (self.bar) self.bar.style.transform = 'scaleX(' + st.progress + ')';
        }
      },
      onUpdate: function () { self.draw(self.state.f); }
    });

    // Text panels cross-fade across the same pinned range.
    if (self.panels.length) {
      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: self.el,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.7,
          invalidateOnRefresh: true
        }
      });
      tl.to({}, { duration: 100 }, 0); // fixed 0–100 timebase

      self.panels.forEach(function (p) {
        var from = parseFloat(p.dataset.from || '0');
        var to = parseFloat(p.dataset.to || '100');
        var FADE = 8;

        if (from <= 0) {
          gsap.set(p, { autoAlpha: 1, y: 0 });
        } else {
          gsap.set(p, { autoAlpha: 0, y: 34 });
          tl.to(p, { autoAlpha: 1, y: 0, duration: FADE, ease: 'power2.out' }, Math.max(0, from - FADE));
        }
        if (to < 100) {
          tl.to(p, { autoAlpha: 0, y: -26, duration: FADE, ease: 'power2.in' }, to);
        }
      });
    }
  };

  Film.prototype.makeStatic = function () {
    this.el.classList.add('is-static');
    var self = this;
    // Still show one real frame where we can afford it.
    var img = new Image();
    img.onload = function () {
      if (!self.ctx) return;
      self.ctx.drawImage(img, 0, 0, self.canvas.width, self.canvas.height);
      self.stage.classList.add('is-live');
    };
    img.src = this.set.url(Math.floor(this.count * 0.35));
  };

  /* ----------------------------------------------------------
     WIRE UP
     ---------------------------------------------------------- */
  var films = sections.map(function (s) { return new Film(s); });

  if (STATIC) {
    films.forEach(function (f) { f.makeStatic(); });
    return;
  }

  // The first act gates the preloader; the rest stream in behind it
  // so the visitor is never staring at a progress bar for 4 MB.
  films.forEach(function (f) {
    if (!f.critical) return;
    RELYC.boot.add('film:' + f.base, f.count, function (onProgress) {
      return f.set.load(function (p) {
        onProgress(p);
        f.draw(0);
      }, 8);
    });
  });

  D.addEventListener('relyc:ready', function () {
    films.forEach(function (f) { f.build(); });
    if (W.ScrollTrigger) W.ScrollTrigger.refresh();

    // Sequentially warm the remaining acts at low concurrency so they
    // never compete with whatever the visitor is looking at right now.
    var rest = films.filter(function (f) { return !f.critical; });
    (function chain(i) {
      if (i >= rest.length) return;
      rest[i].set.load(function () { rest[i].draw(rest[i].state.f); }, 4)
        .then(function () { chain(i + 1); });
    })(0);
  });

  W.addEventListener('resize', RELYC.debounce(function () {
    films.forEach(function (f) { f.setHeight(); });
    if (W.ScrollTrigger) W.ScrollTrigger.refresh();
  }, 250));
})();
