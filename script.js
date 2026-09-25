(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const progress = document.querySelector('.scroll-progress span');
  const heroWords = [...document.querySelectorAll('.hero-word')];
  const motionTargets = [...document.querySelectorAll('main h2, .robot-visual, .photo-card')];
  const heroLimits = new Map();
  let scrollFrame = 0;
  motionTargets.forEach(el => {
    if (el.matches('h2')) el.classList.add('scroll-heading');
  });

  function measureHero() {
    heroWords.forEach(word => {
      word.style.transform = 'none';
      const range = document.createRange();
      range.selectNodeContents(word);
      const rect = range.getBoundingClientRect();
      const direction = Number(word.dataset.shift || 0);
      const room = direction < 0 ? rect.left - 6 : innerWidth - rect.right - 6;
      heroLimits.set(word, Math.max(0, Math.min(innerWidth * .055, room)));
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

    if (!reducedMotion) {
      const heroRatio = Math.min(1, scrollY / Math.max(innerHeight, 1));
      const mobileLayout = window.matchMedia('(max-width: 980px)').matches;
      const maxShiftVh = mobileLayout ? .7 : 1.2;
      // Read section positions before writing transforms to avoid layout thrashing.
      const positions = motionTargets.map(el => {
        const anchor = el.matches('h2') ? el.parentElement : el;
        const rect = anchor.getBoundingClientRect();
        return { el, visible: rect.bottom > 0 && rect.top < innerHeight,
          phase: Math.max(-1, Math.min(1, (innerHeight / 2 - (rect.top + rect.height / 2)) / (innerHeight / 2 + rect.height / 2))) };
      });
      heroWords.forEach((word) => {
        const dir = Number(word.dataset.shift || 0);
        word.style.transform = `translate3d(${dir * heroRatio * (heroLimits.get(word) || 0)}px, ${heroRatio * -maxShiftVh}vh, 0)`;
      });
      positions.forEach(({ el, visible, phase }) => {
        if (!visible) return;
        if (el.matches('h2')) {
          el.style.setProperty('--scroll-offset', `${phase * (mobileLayout ? -10 : -18)}px`);
        } else if (el.matches('.robot-visual')) {
          el.style.setProperty('--scroll-rotation', `${phase * 12}deg`);
        } else {
          el.style.setProperty('--scroll-offset', `${phase * 18}px`);
        }
      });
    }
  }
  function scheduleScroll() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(onScroll);
  }
  addEventListener('scroll', scheduleScroll, { passive: true });
  addEventListener('resize', measureHero, { passive: true });
  document.fonts.ready.then(measureHero);
  measureHero();

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

  const revealTargets = document.querySelectorAll('.intro-grid, .facts-row, .race-copy, .scoreboard, .robot-copy, .robot-visual, .code-copy, .terminal, .photos-head, .photo-card, .robul-grid, .team-rail, .denver-copy, .join-grid');
  revealTargets.forEach(el => el.classList.add('reveal'));

  if ('IntersectionObserver' in window && !reducedMotion) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });
    revealTargets.forEach(el => observer.observe(el));
  } else {
    revealTargets.forEach(el => el.classList.add('in'));
  }

  document.querySelectorAll('.photo-card img').forEach((img) => {
    img.addEventListener('error', () => img.remove());
  });

  const canvas = document.getElementById('circuit-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
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

    if (!reducedMotion) raf = requestAnimationFrame(draw);
  }

  resize();
  addEventListener('resize', resize);
  draw();
  if (reducedMotion && raf) cancelAnimationFrame(raf);
})();
