(() => {
  document.documentElement.classList.add('has-js');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width: 980px)');
  const motion = window.Motion;
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
  const entries = new Map();
  const opening = new Set();
  let frame = 0;
  let measureFrame = 0;
  const clamp = n => Math.min(1, Math.max(0, n));
  const progress = document.querySelector('.scroll-progress span');
  const ribbon = document.querySelector('.motion-ribbon-track');
  const candidates = 'main h2, .explorer-heading h3, .swerve-copy h3, .section-index, .team-photo, .robot-visual, .detail-card, .photo-card, .fact, .score-line, .spec-list > div, .terminal, .team-rail > div, .member-card, .sponsor-card, .support-grid article, .intro-copy, .robot-copy > p, .code-copy > p, .robul-copy, .denver-copy > p, .join-grid > div, .swerve-stage, .repo-link, .robot-details > h3';

  function register(root = document) {
    root.querySelectorAll(candidates).forEach(el => {
      if (entries.has(el) || el.closest('.explorer-panel')) return;
      // A container owns its children so nested text never drifts out of alignment.
      if (el.parentElement.closest('.support-grid article, .sponsor-card, .member-card, .join-grid > div, .intro-copy, .robul-copy')) return;
      const photo = el.matches('.team-photo, .robot-visual, .detail-card, .photo-card');
      const row = el.matches('.score-line, .spec-list > div');
      const group = el.closest('.detail-grid, .photo-grid, .facts-row, .team-rail, .member-grid, .support-grid, .scoreboard, .spec-list');
      const index = group ? [...group.children].indexOf(el) : 0;
      const columns = group && !row ? getComputedStyle(group).gridTemplateColumns.split(' ').length : 1;
      const stagger = group ? Math.max(0, row ? index : index % columns) * 14 : 0;
      entries.set(el, { el, photo, row, stagger, top: 0, height: 0 });
    });
    measure();
  }
  function measure() {
    measureFrame = 0;
    // Cache layout coordinates with transforms cleared; scroll rendering never reads layout.
    entries.forEach(({ el }) => { el.style.translate = 'none'; });
    entries.forEach(entry => {
      const rect = entry.el.getBoundingClientRect();
      entry.lastProgress = -1;
      entry.top = rect.top + scrollY;
      entry.height = rect.height;
      entry.visible = rect.width > 0 && rect.height > 0;
    });
    render();
  }
  function scheduleMeasure() {
    if (!measureFrame) measureFrame = requestAnimationFrame(measure);
  }
  function render() {
    frame = 0;
    const reduced = preference.matches || !motion;
    const distance = Math.max(120, Math.min(260, innerHeight * .25));
    const max = document.documentElement.scrollHeight - innerHeight;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? clamp(scrollY / max) : 0})`;
    entries.forEach(entry => {
      const { el, top, photo, row, stagger, visible } = entry;
      const focused = el.contains(document.activeElement);
      const p = reduced || focused || !visible ? 1 : clamp((scrollY + innerHeight * .94 - top - stagger) / distance);
      // Position, rather than a one-shot timer, owns progress in both directions.
      const eased = p * p * (3 - 2 * p);
      if (entry.lastProgress === eased) return;
      entry.lastProgress = eased;
      el.classList.add('scroll-reveal');
      el.classList.toggle('reveal-photo', photo);
      el.style.setProperty('--reveal-progress', String(eased));
      el.style.opacity = photo ? '1' : String(.12 + .88 * eased);
      el.style.translate = row ? `${(1 - eased) * 16}px 0` : `0 ${(1 - eased) * (photo ? 12 : 24)}px`;
      el.style.clipPath = photo && !reduced ? `inset(0 ${(1 - eased) * 100}% 0 0)` : 'none';
    });

  }
  function scheduleRender() { if (!frame) frame = requestAnimationFrame(render); }
  const scoreRows = [...document.querySelectorAll('.score-line')];
  const maxScore = Math.max(1, ...scoreRows.map(row => Number(row.querySelector('strong').textContent)));
  scoreRows.forEach(row => row.style.setProperty('--score-share', Number(row.querySelector('strong').textContent) / maxScore));
  register();
  addEventListener('scroll', scheduleRender, { passive: true });
  addEventListener('resize', scheduleMeasure, { passive: true });
  addEventListener('pageshow', scheduleMeasure);
  document.addEventListener('focusin', scheduleRender);
  document.addEventListener('focusout', scheduleRender);
  if (window.ResizeObserver) new ResizeObserver(scheduleMeasure).observe(document.querySelector('main'));
  const roster = document.getElementById('team-members') || document.getElementById('sponsors-list');
  if (roster) new MutationObserver(() => {
    entries.forEach((entry, el) => { if (!el.isConnected) entries.delete(el); });
    register(roster);
  }).observe(roster, { childList: true, subtree: true });

  function openAnimation(el, keyframes, options = {}) {
    if (!motion || preference.matches) return;
    const animation = motion.animate(el, keyframes, { duration: .65, ease: [.22, 1, .36, 1], ...options });
    opening.add(animation);
    animation.then(() => {
      opening.delete(animation);
      ['opacity', 'transform', 'clip-path'].forEach(property => el.style.removeProperty(property));
    });
  }
  function openPage() {
    document.documentElement.classList.remove('motion-boot');
    measure();
    if (location.hash || scrollY > 80 || preference.matches || !motion) return;
    document.querySelectorAll('.hero-word-inner').forEach((word, index) => {
      openAnimation(word, { opacity: [0, 1], y: [52, 0], clipPath: ['inset(100% -2% -20% -2%)', 'inset(-20% -2% -20% -2%)'] }, { duration: .8, delay: index * .12 });
    });
    document.querySelectorAll('.hero-lede, .hero-actions, .team-title, .team-lede, .team-hero-photo').forEach((el, index) => {
      openAnimation(el, { opacity: [0, 1], y: [16, 0] }, { duration: .55, delay: .12 + index * .08 });
    });
    document.querySelectorAll('.circuit-traces path').forEach((el, index) => {
      openAnimation(el, { strokeDashoffset: [1, 0], opacity: [.14, .4, .14] }, { duration: .9, delay: index * .04 });
    });
  }
  let heroScroll = [];
  let ribbonAnimation;
  let ribbonVisible = false;
  function setupHeroScroll() {
    heroScroll.forEach(({ animation, detach }) => { detach(); animation.cancel(); });
    heroScroll = [];
    document.querySelectorAll('.hero-word').forEach(word => word.style.removeProperty('transform'));
    const hero = document.querySelector('.hero');
    if (!hero || !motion || preference.matches) return;
    document.querySelectorAll('.hero-word').forEach(word => {
      const distance = Math.min(96, innerWidth * .08) * Number(word.dataset.shift);
      const animation = motion.animate(word, { x: [0, distance] }, { ease: 'linear' });
      const detach = motion.scroll(animation, { target: hero, offset: ['start start', 'end start'] });
      heroScroll.push({ animation, detach });
    });
  }
  function updateRibbon() {
    if (!ribbonAnimation) return;
    if (ribbonVisible && !document.hidden && !preference.matches) ribbonAnimation.play();
    else ribbonAnimation.pause();
  }
  function setupRibbon() {
    ribbonAnimation?.cancel();
    if (!ribbon) return;
    ribbon.style.removeProperty('transform');
    if (!motion || preference.matches) return;
    ribbonAnimation = motion.animate(ribbon, { x: ['0%', '-50%'] }, { duration: 36, ease: 'linear', repeat: Infinity });
    updateRibbon();
  }
  if (ribbon) new IntersectionObserver(entries => {
    ribbonVisible = entries[0].isIntersecting;
    updateRibbon();
  }).observe(ribbon.parentElement);
  document.addEventListener('visibilitychange', updateRibbon);
  addEventListener('resize', setupHeroScroll, { passive: true });
  document.fonts.ready.then(() => { openPage(); setupHeroScroll(); setupRibbon(); });

  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.getElementById('main-nav');
  let menuOpen = false;
  let menuAnimation;
  let linksAnimation;
  function setMenu(requested) {
    if (!nav || !toggle || !header) return;
    const open = requested && compact.matches;
    const currentOpacity = getComputedStyle(nav).opacity;
    const currentTransform = getComputedStyle(nav).transform;
    menuAnimation?.stop();
    linksAnimation?.stop();
    const changed = open !== menuOpen;
    menuOpen = open;
    toggle.setAttribute('aria-expanded', String(open));
    header.classList.toggle('menu-open', open);
    nav.inert = compact.matches && !open;
    if (compact.matches && motion && !preference.matches && changed) {
      nav.style.opacity = currentOpacity;
      nav.style.transform = currentTransform;
      menuAnimation = motion.animate(nav, { opacity: open ? 1 : 0, y: open ? 0 : -8 }, { type: 'spring', bounce: 0, duration: .3 });
      if (open) linksAnimation = motion.animate(nav.querySelectorAll('a'), { opacity: 1 }, { duration: .16 });
    } else {
      nav.style.removeProperty('opacity');
      nav.style.removeProperty('transform');
    }
  }
  if (nav && toggle) {
    toggle.addEventListener('click', () => setMenu(!menuOpen));
    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menuOpen) { setMenu(false); toggle.focus(); }
    });
    document.addEventListener('pointerdown', event => {
      if (menuOpen && !header.contains(event.target)) setMenu(false);
    });
    compact.addEventListener('change', () => setMenu(false));
    setMenu(false);
  }
  preference.addEventListener('change', () => {
    if (preference.matches) {
      document.documentElement.classList.remove('motion-boot');
      opening.forEach(animation => animation.cancel());
      opening.clear();
      document.querySelectorAll('.hero-word-inner, .hero-lede, .hero-actions, .team-title, .team-lede, .team-hero-photo').forEach(el => {
        ['opacity', 'transform', 'clip-path'].forEach(property => el.style.removeProperty(property));
      });
    }
    setMenu(menuOpen);
    setupHeroScroll();
    setupRibbon();
    render();
  });
})();
