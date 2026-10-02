(() => {
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionPreference.matches;
  const progress = document.querySelector('.scroll-progress span');
  const heroWords = [...document.querySelectorAll('.hero-word')];
  const headings = [...document.querySelectorAll('main h2')];
  const media = [...document.querySelectorAll('.scroll-media')];
  const decorations = [...document.querySelectorAll('.hero-grid, .denver-number')];
  const panels = [...document.querySelectorAll('.terminal')];
  const heroLimits = new Map();
  const mediaLimits = new Map();
  let scrollFrame = 0;
  headings.forEach(el => el.classList.add('scroll-heading'));
  panels.forEach(el => el.classList.add('scroll-panel'));

  function measureMotion() {
    heroWords.forEach(word => {
      word.style.transform = 'none';
      const range = document.createRange();
      range.selectNodeContents(word);
      const rect = range.getBoundingClientRect();
      const direction = Number(word.dataset.shift || 0);
      const room = direction < 0 ? rect.left - 6 : innerWidth - rect.right - 6;
      heroLimits.set(word, Math.max(0, Math.min(innerWidth * .055, room)));
    });
    const compact = innerWidth <= 980;
    media.forEach(frame => {
      const height = frame.clientHeight;
      const shift = Math.min(height * .035, compact ? 12 : 24);
      mediaLimits.set(frame, shift);
      // Overscan covers the entire frame even at either end of the parallax.
      frame.style.setProperty('--media-scale', height ? 1 + 2 * (shift + 1) / height : 1);
    });
    document.querySelectorAll('.detail-grid, .photo-grid, .facts-row, .team-rail').forEach(group => {
      const columns = getComputedStyle(group).gridTemplateColumns.split(' ').length;
      [...group.children].forEach((item, index) => {
        item.style.setProperty('--reveal-delay', `${(index % columns) * 90}ms`);
      });
    });
    scheduleScroll();
  }
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  function onScroll() {
    scrollFrame = 0;
    const max = document.documentElement.scrollHeight - innerHeight;
    const ratio = max > 0 ? scrollY / max : 0;
    if (progress) progress.style.width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
    if (reducedMotion) {
      heroWords.forEach(word => { word.style.transform = 'none'; });
      headings.forEach(el => el.style.removeProperty('--scroll-offset'));
      media.forEach(el => el.style.removeProperty('--media-offset'));
      decorations.forEach(el => el.style.removeProperty('--decoration-offset'));
      panels.forEach(el => el.style.removeProperty('--panel-offset'));
      return;
    }

    const compact = innerWidth <= 980;
    const heroRatio = Math.min(1, scrollY / Math.max(innerHeight, 1));
    // Batch geometry reads before any scroll-driven style writes.
    const positions = [...headings, ...media, ...decorations, ...panels].map(el => {
      const anchor = el.matches('h2') ? el.parentElement :
        el.matches('.hero-grid, .denver-number') ? el.parentElement : el;
      const rect = anchor.getBoundingClientRect();
      return { el, visible: rect.bottom > 0 && rect.top < innerHeight,
        phase: Math.max(-1, Math.min(1,
          (innerHeight / 2 - (rect.top + rect.height / 2)) / (innerHeight / 2 + rect.height / 2))) };
    });
    heroWords.forEach(word => {
      const dir = Number(word.dataset.shift || 0);
      word.style.transform = `translate3d(${dir * heroRatio * (heroLimits.get(word) || 0)}px, ${heroRatio * (compact ? -.7 : -1.2)}vh, 0)`;
    });
    positions.forEach(({ el, visible, phase }) => {
      if (!visible) return;
      if (el.matches('h2')) {
        el.style.setProperty('--scroll-offset', `${phase * (compact ? -10 : -18)}px`);
      } else if (el.matches('.scroll-media')) {
        el.style.setProperty('--media-offset', `${phase * -mediaLimits.get(el)}px`);
      } else if (el.matches('.terminal')) {
        el.style.setProperty('--panel-offset', `${phase * (compact ? -6 : -14)}px`);
      } else {
        el.style.setProperty('--decoration-offset', `${phase * (compact ? -22 : -60)}px`);
      }
    });
  }
  function scheduleScroll() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(onScroll);
  }
  addEventListener('scroll', scheduleScroll, { passive: true });
  addEventListener('resize', measureMotion, { passive: true });
  document.fonts.ready.then(measureMotion);
  if ('ResizeObserver' in window) {
    const mediaResize = new ResizeObserver(measureMotion);
    media.forEach(frame => mediaResize.observe(frame));
  }
  measureMotion();

  const header = document.querySelector('.site-header');
  const menuToggle = document.querySelector('.menu-toggle');
  const mainNav = document.getElementById('main-nav');

  function setMenu(open) {
    if (!header || !menuToggle) return;
    header.classList.toggle('menu-open', open);
    menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  if (header && menuToggle && mainNav) {
    menuToggle.addEventListener('click', () => {
      setMenu(!header.classList.contains('menu-open'));
    });

    mainNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setMenu(false));
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setMenu(false);
        menuToggle.focus();
      }
    });

    document.addEventListener('pointerdown', (event) => {
      if (header.classList.contains('menu-open') && !header.contains(event.target)) {
        setMenu(false);
      }
    });

    addEventListener('resize', () => {
      if (innerWidth > 980) setMenu(false);
    }, { passive: true });
  }

  const revealTargets = [...document.querySelectorAll('.section-index, .intro-grid, .team-photo, .race-copy, .scoreboard, .robot-copy, .robot-visual, .detail-card, .code-copy, .terminal, .photos-head, .photo-card, .robul-grid, .denver-copy, .join-grid, .fact > *, .team-rail > div > *')];
  revealTargets.forEach(el => el.classList.add('reveal'));
  let revealObserver;
  if ('IntersectionObserver' in window && !reducedMotion) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: .08, rootMargin: '0px 0px -4% 0px' });
    revealTargets.forEach(el => revealObserver.observe(el));
  } else {
    revealTargets.forEach(el => el.classList.add('in'));
  }
  // A preference change takes effect immediately, including already-running effects.
  motionPreference.addEventListener('change', event => {
    reducedMotion = event.matches;
    if (reducedMotion) {
      revealObserver?.disconnect();
      revealTargets.forEach(el => el.classList.add('in'));
    }
    measureMotion();
  });

  const canvas = document.getElementById('circuit-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let canvasVisible = true;
  let nodes = [];
  let dpr = Math.min(devicePixelRatio || 1, 2);
  let raf = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    nodes = Array.from({ length: Math.max(18, Math.floor(rect.width / 70)) }, (_, i) => ({
      x: (i * 137) % Math.max(rect.width, 1),
      y: (i * 83 + 60) % Math.max(rect.height, 1),
      vx: ((i % 5) - 2) * .055,
      vy: (((i * 3) % 5) - 2) * .04,
      r: 1.2 + (i % 3) * .55
    }));
  }

  function draw() {
    raf = 0;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    if (!reducedMotion) {
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -10) n.x = w + 10;
        if (n.x > w + 10) n.x = -10;
        if (n.y < -10) n.y = h + 10;
        if (n.y > h + 10) n.y = -10;
      }
    }

    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 180) {
          ctx.strokeStyle = `rgba(190,190,190,${(1 - dist / 180) * .16})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          const midX = (a.x + b.x) / 2;
          ctx.lineTo(midX, a.y);
          ctx.lineTo(midX, b.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    for (const n of nodes) {
      ctx.fillStyle = 'rgba(184,52,48,.82)';
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!reducedMotion && canvasVisible && !document.hidden) raf = requestAnimationFrame(draw);
  }

  function refreshCanvas() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (canvasVisible && !document.hidden) draw();
  }
  if ('IntersectionObserver' in window) {
    const canvasObserver = new IntersectionObserver(entries => {
      canvasVisible = entries[0].isIntersecting;
      refreshCanvas();
    });
    canvasObserver.observe(canvas);
  }
  motionPreference.addEventListener('change', refreshCanvas);
  document.addEventListener('visibilitychange', refreshCanvas);
  resize();
  addEventListener('resize', () => { resize(); refreshCanvas(); }, { passive: true });
  draw();
})();
