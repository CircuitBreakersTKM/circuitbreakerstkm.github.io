(() => {
  const thisScript = document.currentScript;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  // Tabbed panels: the robot explorer in the archive and the Hra 1 run switcher on the homepage.
  document.querySelectorAll('.robot-explorer, .run-switch').forEach(explorer => {
    const tabs = [...explorer.querySelectorAll('[data-robot-tab]')];
    const panels = [...explorer.querySelectorAll('[data-robot-panel]')];
    if (!tabs.length) return;
    let tabAnimations = [];
    let selection = 0;
    function clearTabAnimations() {
      selection++;
      tabAnimations.forEach(animation => animation.stop());
      tabAnimations = [];
      panels.forEach(panel => { panel.classList.remove('is-leaving'); panel.style.removeProperty('opacity'); });
    }
    function selectTab(tab, transition = true) {
      const previousOpacity = panels.map(panel => getComputedStyle(panel).visibility === 'hidden' ? 0 : Number(getComputedStyle(panel).opacity));
      clearTabAnimations();
      const revision = selection;
      const next = document.getElementById(`panel-${tab.dataset.robotTab}`);
      tabs.forEach(button => {
        const selected = button === tab;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
      });
      panels.forEach((panel, index) => {
        panel.hidden = panel !== next;
        if (!transition || !window.Motion || preference.matches) return;
        if (panel !== next && previousOpacity[index] > 0) panel.classList.add('is-leaving');
        panel.style.opacity = String(previousOpacity[index]);
        const animation = Motion.animate(panel, { opacity: panel === next ? 1 : 0 }, { duration: .2 });
        tabAnimations.push(animation);
        animation.then(() => {
          if (revision !== selection) return;
          panel.classList.remove('is-leaving');
          panel.style.removeProperty('opacity');
        });
      });
    }
    explorer.classList.add('is-interactive');
    const tablist = explorer.querySelector('.explorer-tabs');
    tablist.hidden = false;
    tablist.setAttribute('role', 'tablist');
    tabs.forEach((tab, index) => {
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', `panel-${tab.dataset.robotTab}`);
      const panel = panels[index];
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id);
      panel.tabIndex = 0;
      tab.addEventListener('click', () => selectTab(tab));
      tab.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next !== undefined) { event.preventDefault(); tabs[next].focus(); selectTab(tabs[next]); }
      });
    });
    selectTab(tabs[0], false);
  });

  // Run maps enlarge in place. Without JS (or with a modifier key) the link still opens the image file.
  const mapLinks = [...document.querySelectorAll('.run-link')];
  if (mapLinks.length && typeof HTMLDialogElement === 'function') {
    const box = document.createElement('dialog');
    box.className = 'lightbox';
    box.setAttribute('aria-label', 'Zvětšený plánek');
    box.innerHTML = '<button type="button" class="lightbox-close mono" aria-label="Zavřít zvětšený plánek">Zavřít <span aria-hidden="true">✕</span></button><div class="lightbox-scroll"><img alt="" decoding="async"></div>';
    document.body.append(box);
    const picture = box.querySelector('img');
    const scroller = box.querySelector('.lightbox-scroll');
    let shown = null;
    mapLinks.forEach(link => link.addEventListener('click', event => {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const small = link.querySelector('img');
      // The copy already on the page shows at once; the full-size file replaces it when it has loaded.
      shown = link;
      picture.src = small.currentSrc || small.src;
      const full = new Image();
      full.src = link.href;
      full.decode().then(() => { if (shown === link) picture.src = link.href; }).catch(() => {});
      picture.alt = small.alt;
      picture.width = small.width;
      picture.height = small.height;
      // The detail size is known up front, so the view can be centred before the large file has loaded.
      picture.style.setProperty('--natural-width', `${small.getAttribute('width')}px`);
      box.classList.remove('is-zoomed');
      box.showModal();
    }));
    box.addEventListener('click', event => {
      if (event.target !== picture) { box.close(); return; }
      // A second click shows the map at its real size, centred on the point that was clicked.
      const rect = picture.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const zoomed = box.classList.toggle('is-zoomed');
      if (zoomed) {
        scroller.scrollLeft = x * scroller.scrollWidth - scroller.clientWidth / 2;
        scroller.scrollTop = y * scroller.scrollHeight - scroller.clientHeight / 2;
      }
    });
    box.addEventListener('close', () => box.classList.remove('is-zoomed'));
  }

  // Run animations: each map can be swapped for a replay of the run from the robot's log. The drawing comes
  // from the player in animations/ (kept as generated); its own controls are hidden and the bar under the
  // map drives it instead. The player and a run's data (100-250 kB) load on the first click only.
  // On a phone the replay opens over the whole screen instead of inside the card.
  const animated = [...document.querySelectorAll('.run-card[data-run-anim]')];
  if (animated.length && thisScript) {
    const folder = new URL('animations/', thisScript.src);
    const version = new URL(thisScript.src).search;
    const phone = matchMedia('(max-width: 620px), (pointer: coarse) and (max-height: 620px)');
    const loading = new Map();
    const load = file => {
      if (!loading.has(file)) loading.set(file, new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = new URL(file, folder).href + version;
        script.onload = resolve;
        script.onerror = () => { loading.delete(file); script.remove(); reject(new Error(file)); };
        document.head.append(script);
      }));
      return loading.get(file);
    };
    const BAR = '<button type="button" class="run-play mono"><i class="run-play-icon" aria-hidden="true"></i><span class="run-play-label">Přehrát animaci</span></button>'
      + '<input class="run-seek" type="range" min="0" max="1000" value="0" aria-label="Čas animace">'
      + '<span class="run-clock mono"></span>'
      + '<button type="button" class="run-rate mono" aria-label="Rychlost přehrávání">1×</button>'
      + '<button type="button" class="run-close mono"><span class="run-close-label">Plánek</span> <span aria-hidden="true">✕</span></button>';
    const SKIN = ':host { font:inherit; color:inherit; background:transparent } .wrap { max-width:none; padding:0 } #title { display:none }'
      + ' canvas { border-radius:0 } .note { margin:12px 0 0; color:#616161; font-size:.8125rem; line-height:1.5 } .note:empty { display:none }'
      + ' :host([data-theater]) .note { margin:0; padding:10px 12px; background:#fff }'
      + ' @media (orientation:landscape) and (max-height:620px) { :host([data-theater]) .note { display:none } }';
    // Per card: its bar's parts (ui) and, once loaded, the player's (player).
    const cards = new Map();
    let theater = null;   // the full-screen frame, built on first use
    let staged = null;    // the card whose replay is in it

    function setLive(card, on) {
      const { ui } = cards.get(card);
      ui.bar.classList.toggle('is-live', on);
      if (on) sync(card); else { ui.bar.classList.remove('is-paused'); ui.play.removeAttribute('aria-label'); }
    }
    // anchor: the swap was asked for from the bar, so the bar stays where it is on screen. The Hra 1 picture
    // is twice as tall as its replay; without this the card would shrink away from under the pointer.
    function showInline(card, on, anchor = false) {
      const { ui } = cards.get(card);
      const before = ui.slot.getBoundingClientRect().top;
      card.classList.toggle('is-animating', on);
      // While one card of a pair plays, the other no longer holds the cell open at its picture's height.
      if (card.parentElement.matches('.run-panels')) card.parentElement.classList.toggle('has-anim', on);
      setLive(card, on);
      if (anchor) {
        // Again on the next frames: the replay's canvas takes its height a moment after it is shown.
        const hold = () => scrollBy({ top: ui.slot.getBoundingClientRect().top - before, behavior: 'instant' });
        hold();
        requestAnimationFrame(() => { hold(); requestAnimationFrame(hold); });
      }
    }
    // The site's bar mirrors the player every frame while it is live.
    function sync(card) {
      const { ui, player } = cards.get(card);
      if (!player || !ui.bar.classList.contains('is-live')) return;
      if (player.play) {
        const paused = player.play.textContent.trim() === '▶';
        ui.bar.classList.toggle('is-paused', paused);
        ui.play.setAttribute('aria-label', paused ? 'Přehrát animaci' : 'Pozastavit animaci');
        if (!player.dragging) ui.seek.value = player.seek.value;
        ui.seek.style.setProperty('--p', `${ui.seek.value / 10}%`);
        const clock = player.time.textContent;
        if (ui.clock.textContent !== clock) ui.clock.textContent = clock;
        ui.rate.textContent = player.rate.textContent;
      }
      requestAnimationFrame(() => sync(card));
    }
    function buildTheater() {
      const box = document.createElement('dialog');
      box.className = 'run-theater';
      box.setAttribute('aria-label', 'Animace jízdy');
      box.innerHTML = '<div class="run-theater-frame"><div class="run-theater-stage"></div><p class="run-theater-hint mono">Na šířku je obraz větší</p><div class="run-theater-bar"></div></div>';
      document.body.append(box);
      const frame = box.firstElementChild;
      box.addEventListener('close', leaveTheater);
      // Leaving real full screen (back gesture, system button) closes the replay too.
      document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && box.open && box.dataset.full) box.close(); });
      return { box, frame, stage: frame.children[0], bar: frame.children[2] };
    }
    function enterTheater(card) {
      const { ui, player } = cards.get(card);
      theater ??= buildTheater();
      staged = card;
      const canvas = player.host.shadowRoot.querySelector('canvas');
      theater.frame.style.setProperty('--ratio', String(canvas.width / canvas.height || 1.9));
      player.host.setAttribute('data-theater', '');
      theater.stage.append(ui.stage);
      theater.bar.append(ui.bar);
      ui.closeLabel.textContent = 'Zavřít';
      delete theater.box.dataset.full;
      theater.box.showModal();
      setLive(card, true);
      // Where the browser allows it (Android), take the real full screen and turn it to landscape.
      // A dialog itself cannot go full screen, so its frame does.
      if (theater.frame.requestFullscreen) {
        theater.frame.requestFullscreen({ navigationUI: 'hide' }).then(() => {
          theater.box.dataset.full = '1';
          return screen.orientation?.lock?.('landscape');
        }).catch(() => {});
      }
    }
    function leaveTheater() {
      const card = staged;
      if (!card) return;
      staged = null;
      const { ui, player } = cards.get(card);
      player.host.showcase.pause();
      setLive(card, false);
      player.host.removeAttribute('data-theater');
      ui.link.after(ui.stage);
      ui.slot.append(ui.bar);
      ui.closeLabel.textContent = 'Plánek';
      try { screen.orientation?.unlock?.(); } catch (error) { /* not locked */ }
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      if (theater.box.open) theater.box.close();
      ui.play.focus({ preventScroll: true });
    }
    function stop(card, anchor = false) {
      if (staged === card) { leaveTheater(); return; }
      cards.get(card).player?.host.showcase.pause();
      showInline(card, false, anchor);
    }
    async function start(card) {
      const entry = cards.get(card);
      const { ui } = entry;
      if (!ui.stage) {
        ui.stage = document.createElement('div');
        ui.stage.className = 'run-anim';
        const host = document.createElement('div');
        host.dataset.showcase = card.dataset.runAnim;
        ui.stage.append(host);
        ui.link.after(ui.stage);
      }
      const host = ui.stage.firstElementChild;
      if (!entry.player) {
        ui.play.disabled = true;
        ui.label.textContent = 'Načítám…';
        try {
          await load('showcase-player.js');
          await load(`${card.dataset.runAnim}.js`);
          window.Showcase.scan();
          if (!host.showcase) throw new Error('player did not mount');
        } catch (error) {
          ui.play.disabled = false;
          ui.label.textContent = 'Animaci se nepodařilo načíst';
          return;
        }
        ui.play.disabled = false;
        ui.label.textContent = 'Přehrát animaci';
        const inner = host.shadowRoot;
        const [seek, time, play, rate] = ['seek', 'time', 'play', 'rate'].map(id => inner.getElementById(id));
        const style = document.createElement('style');
        // If a regenerated player ever drops these parts, its own controls stay and the bar only closes it.
        const own = seek && time && play && rate;
        style.textContent = SKIN + (own ? ' .bar { display:none }' : '');
        inner.append(style);
        ui.bar.classList.toggle('is-plain', !own);
        entry.player = own ? { host, seek, time, play, rate, dragging: false } : { host };
      }
      if (phone.matches) enterTheater(card); else showInline(card, true, true);
      host.showcase.seek(0);
      host.showcase.play();
    }
    animated.forEach(card => {
      const slot = document.createElement('div');
      slot.className = 'run-bar-slot';
      slot.innerHTML = `<div class="run-bar">${BAR}</div>`;
      card.querySelector('.run-caption').before(slot);
      const bar = slot.firstElementChild;
      const find = name => bar.querySelector(`.run-${name}`);
      const ui = { slot, bar, link: card.querySelector('.run-link'), stage: null, play: find('play'), label: find('play-label'), seek: find('seek'), clock: find('clock'), rate: find('rate'), close: find('close'), closeLabel: find('close-label') };
      cards.set(card, { ui, player: null });
      ui.play.addEventListener('click', () => {
        const { player } = cards.get(card);
        if (!bar.classList.contains('is-live')) { start(card); return; }
        if (bar.classList.contains('is-paused')) player.host.showcase.play(); else player.host.showcase.pause();
      });
      ui.seek.addEventListener('input', () => {
        const { host } = cards.get(card).player;
        host.showcase.seek(host.showcase.duration * ui.seek.value / 1000);
      });
      ui.seek.addEventListener('pointerdown', () => { cards.get(card).player.dragging = true; });
      ['pointerup', 'pointercancel', 'change'].forEach(type => ui.seek.addEventListener(type, () => { cards.get(card).player.dragging = false; }));
      ui.rate.addEventListener('click', () => cards.get(card).player.rate.click());
      ui.close.addEventListener('click', () => { stop(card, true); ui.play.focus({ preventScroll: true }); });
      // A card swapped out by its tabs goes back to the picture, so nothing plays unseen.
      new MutationObserver(() => { if (card.hidden && card.classList.contains('is-animating')) stop(card); }).observe(card, { attributes: true, attributeFilter: ['hidden'] });
    });
  }

  const demo = document.querySelector('.swerve-demo');
  if (!demo) return;
  const svg = document.getElementById('swerve-svg');
  const chassis = document.getElementById('swerve-chassis');
  const grid = svg.querySelector('.swerve-grid-fill');
  const deck = demo.querySelector('.swerve-deck');
  const stick = demo.querySelector('.joystick');
  const knobEl = demo.querySelector('.joystick-knob');
  const resetButton = demo.querySelector('[data-swerve-reset]');
  const headingOutputs = [...demo.querySelectorAll('[data-heading]')];
  const stickAngleOutput = demo.querySelector('[data-stick-angle]');
  const stickSpeedOutput = demo.querySelector('[data-stick-speed]');
  const turnOutput = demo.querySelector('[data-turn]');
  const wheels = [...demo.querySelectorAll('.swerve-wheel')].map(el => ({
    el, tread: el.querySelector('.wheel-tread'), vector: el.querySelector('.wheel-vector'),
    shaft: el.querySelector('.vector-shaft'), head: el.querySelector('.vector-head')
  }));
  const cells = [...demo.querySelectorAll('[data-module]')].map(el => ({
    el, angle: el.querySelector('[data-angle]'), speed: el.querySelector('[data-speed]'), angleText: '', speedText: '',
    dial: el.querySelector('[data-dial]'), dialVector: el.querySelector('[data-dial-vector]'),
    dialShaft: el.querySelector('[data-dial-vector] line'), dialHead: el.querySelector('[data-dial-vector] path')
  }));

  // Module positions in the chassis frame (y points down, angles grow clockwise).
  const MODULES = [[-90, -90], [90, -90], [-90, 90], [90, 90]];
  const WHEEL_MAX = 220;                                   // fastest a wheel can go, px/s
  const TURN_MAX = .8 * WHEEL_MAX / Math.hypot(90, 90);    // rad/s at full turn input
  const DEADZONE = .08;
  const TAP_TURN = 300;                                    // a short tap still turns visibly, ms
  const knob = { x: 0, y: 0, vx: 0, vy: 0, damping: 1 };
  const pose = { x: 0, y: 0, rotation: 0 };
  const camera = { x: 0, y: 0 };
  const modules = MODULES.map(() => ({ angle: 0, speed: 0, tread: 0, pending: 0 }));
  const keys = new Set();
  const holds = new Map();
  const keyVectors = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
  let drag;
  let turn = 0;
  let resetting = false;
  let visible = true;
  let frameId = 0;
  let last = 0;
  let headingText = '';
  const input = { angle: 0, amount: 0, turn: 0, text: '' };
  const shortest = degrees => ((degrees + 180) % 360 + 360) % 360 - 180;
  const travel = () => Math.max(1, (stick.clientWidth - knobEl.offsetWidth) / 2);
  // Past the rim the knob keeps following, with growing resistance.
  const rubberband = (overshoot, dimension) => overshoot * dimension * .55 / (dimension + .55 * overshoot);

  function spring(axis, velocity, target, dt) {
    // Damping ratio + response, integrated in small steps so it stays stable at any frame rate.
    const omega = 2 * Math.PI / .3;
    for (let left = dt; left > 0; left -= 1 / 240) {
      const step = Math.min(left, 1 / 240);
      knob[velocity] += (-omega * omega * (knob[axis] - target) - 2 * knob.damping * omega * knob[velocity]) * step;
      knob[axis] += knob[velocity] * step;
    }
  }
  function turnInput() {
    let sum = 0;
    holds.forEach(hold => { sum += hold.direction; });
    return Math.max(-1, Math.min(1, sum));
  }
  function frame(now) {
    frameId = 0;
    const reduced = preference.matches;
    const dt = Math.min(.034, Math.max(.001, (now - last) / 1000));
    last = now;
    const reach = travel();

    if (drag) {
      // 1:1 with the pointer. A press beside the knob closes its gap within a few frames instead of jumping.
      const ease = reduced ? 0 : Math.exp(-(now - drag.start) / 45);
      let x = drag.x + drag.gapX * ease;
      let y = drag.y + drag.gapY * ease;
      const distance = Math.hypot(x, y);
      if (distance > reach) {
        const shown = reach + rubberband(distance - reach, reach);
        x *= shown / distance; y *= shown / distance;
      }
      knob.x = x; knob.y = y;
      drag.history.push({ x, y, time: now });
      while (drag.history.length > 2 && now - drag.history[0].time > 90) drag.history.shift();
    } else {
      let targetX = 0, targetY = 0;
      keys.forEach(key => { targetX += keyVectors[key][0]; targetY += keyVectors[key][1]; });
      const length = Math.hypot(targetX, targetY) || 1;
      targetX *= reach / length; targetY *= reach / length;
      if (reduced) Object.assign(knob, { x: targetX, y: targetY, vx: 0, vy: 0 });
      else { spring('x', 'vx', targetX, dt); spring('y', 'vy', targetY, dt); }
      if (!keys.size && Math.hypot(knob.x, knob.y) < .05 && Math.hypot(knob.vx, knob.vy) < 2) Object.assign(knob, { x: 0, y: 0, vx: 0, vy: 0 });
    }

    // Joystick -> field velocity, buttons -> turn rate.
    let stickX = knob.x / reach, stickY = knob.y / reach;
    const deflection = Math.hypot(stickX, stickY);
    const amount = deflection > DEADZONE ? (Math.min(1, deflection) - DEADZONE) / (1 - DEADZONE) : 0;
    stickX = deflection ? stickX / deflection * amount : 0;
    stickY = deflection ? stickY / deflection * amount : 0;
    const turnTarget = turnInput();
    turn = reduced ? turnTarget : turn + (turnTarget - turn) * (1 - Math.exp(-dt / .09));
    if (!turnTarget && Math.abs(turn) < .002) turn = 0;
    if (amount || turnTarget) resetting = false;
    input.amount = amount; input.turn = turn;
    if (amount) input.angle = Math.atan2(stickX, -stickY) * 180 / Math.PI;

    if (resetting) {
      const pull = reduced ? 1 : 1 - Math.exp(-dt / .16);
      pose.x -= pose.x * pull; pose.y -= pose.y * pull; pose.rotation -= pose.rotation * pull;
      camera.x -= camera.x * pull; camera.y -= camera.y * pull;
      modules.forEach(module => { module.speed = 0; module.pending = 0; });
      if (Math.hypot(pose.x, pose.y) < .2 && Math.abs(pose.rotation) < .2 && Math.hypot(camera.x, camera.y) < .2) {
        Object.assign(pose, { x: 0, y: 0, rotation: 0 }); Object.assign(camera, { x: 0, y: 0 });
        resetting = false;
      }
    } else {
      // Inverse kinematics: field velocity -> chassis velocity, plus omega x module position for each wheel.
      const theta = pose.rotation * Math.PI / 180;
      const fieldX = stickX * WHEEL_MAX, fieldY = stickY * WHEEL_MAX;
      const omega = turn * TURN_MAX;
      const chassisX = Math.cos(theta) * fieldX + Math.sin(theta) * fieldY;
      const chassisY = -Math.sin(theta) * fieldX + Math.cos(theta) * fieldY;
      const wanted = MODULES.map(([x, y]) => ({ x: chassisX - omega * y, y: chassisY + omega * x }));
      // No wheel may exceed its top speed: scale the whole command down together.
      const fastest = Math.max(...wanted.map(v => Math.hypot(v.x, v.y)));
      const scale = fastest > WHEEL_MAX ? WHEEL_MAX / fastest : 1;
      const steer = reduced ? 1 : 1 - Math.exp(-dt / .06);
      let aligned = 0, driven = 0;
      modules.forEach((module, index) => {
        const speed = Math.hypot(wanted[index].x, wanted[index].y) * scale / WHEEL_MAX;
        if (speed < .012) { module.speed = 0; module.pending = 0; return; }   // idle wheels keep their angle
        let delta = shortest(Math.atan2(wanted[index].x, -wanted[index].y) * 180 / Math.PI - module.angle);
        let direction = 1;
        // Never steer more than 90 degrees: drive the wheel backwards instead.
        if (Math.abs(delta) > 90) { delta = shortest(delta + 180); direction = -1; }
        module.angle += delta * steer;
        module.pending = delta * (1 - steer);
        const grip = Math.cos(module.pending * Math.PI / 180);   // a wheel still turning into place pushes less
        module.speed = direction * speed * grip;
        module.tread += module.speed * WHEEL_MAX * dt;
        aligned += grip; driven++;
      });
      // The robot moves with exactly the command the wheels are showing.
      const progress = driven ? scale * aligned / driven : 0;
      pose.x += fieldX * progress * dt;
      pose.y += fieldY * progress * dt;
      pose.rotation += omega * progress * dt * 180 / Math.PI;
      // Follow at the edge of the view, without clamping or resetting world coordinates.
      if (Math.abs(pose.x - camera.x) > slack.x) camera.x = pose.x - Math.sign(pose.x - camera.x) * slack.x;
      if (Math.abs(pose.y - camera.y) > slack.y) camera.y = pose.y - Math.sign(pose.y - camera.y) * slack.y;
    }
    render();
    const settling = modules.some(module => Math.abs(module.pending) > .2);
    if (drag || keys.size || holds.size || resetting || settling || turn || knob.x || knob.y || knob.vx || knob.vy) start();
  }
  function render() {
    knobEl.style.transform = `translate3d(${knob.x.toFixed(2)}px, ${knob.y.toFixed(2)}px, 0)`;
    chassis.setAttribute('transform', `translate(${pose.x.toFixed(2)} ${pose.y.toFixed(2)}) rotate(${pose.rotation.toFixed(2)})`);
    svg.setAttribute('viewBox', `${camera.x.toFixed(2)} ${camera.y.toFixed(2)} 520 460`);
    grid.setAttribute('x', camera.x.toFixed(2)); grid.setAttribute('y', camera.y.toFixed(2));
    let driving = false;
    modules.forEach((module, index) => {
      const wheel = wheels[index];
      const share = Math.abs(module.speed);
      const length = 22 + 34 * share;
      driving = driving || share > .01;
      wheel.el.setAttribute('transform', `rotate(${module.angle.toFixed(2)})`);
      wheel.vector.setAttribute('transform', `rotate(${module.speed < 0 ? 180 : 0})`);
      wheel.vector.style.opacity = Math.min(1, share * 8).toFixed(2);
      wheel.shaft.setAttribute('y2', (-length).toFixed(1));
      wheel.head.setAttribute('transform', `translate(0 ${(-length).toFixed(1)})`);
      wheel.tread.style.strokeDashoffset = module.tread.toFixed(1);
      // Text is rewritten only when the rounded value changes, and its box never changes width.
      const cell = cells[index];
      if (!cell) return;
      const percent = Math.round(module.speed * 100);
      const angleText = `${Math.round(shortest(module.angle)) || 0}°`;
      const speedText = `${percent > 0 ? '+' : percent < 0 ? '−' : ''}${Math.abs(percent)} %`;
      if (angleText !== cell.angleText) cell.angle.textContent = cell.angleText = angleText;
      if (speedText !== cell.speedText) cell.speed.textContent = cell.speedText = speedText;
      cell.el.style.setProperty('--share', share.toFixed(3));
      // The dial shows the same wheel relative to the robot's front, whatever way the robot faces.
      if (!cell.dial) return;
      const reach = 8 + 20 * share;
      cell.dial.setAttribute('transform', `rotate(${module.angle.toFixed(1)})`);
      cell.dialVector.setAttribute('transform', `rotate(${module.speed < 0 ? 180 : 0})`);
      cell.dialVector.style.opacity = Math.min(1, share * 8).toFixed(2);
      cell.dialShaft.setAttribute('y2', (-reach).toFixed(1));
      cell.dialHead.setAttribute('transform', `translate(0 ${(-reach).toFixed(1)})`);
    });
    // What the controls are asking for, shown next to them.
    const turnPercent = Math.round(input.turn * 100);
    const inputText = `${input.amount ? Math.round(((input.angle % 360) + 360) % 360) % 360 + '°' : '–'}|${Math.round(input.amount * 100)} %|${turnPercent > 0 ? '+' : turnPercent < 0 ? '−' : ''}${Math.abs(turnPercent)} %`;
    if (inputText !== input.text && stickAngleOutput) {
      input.text = inputText;
      [stickAngleOutput.textContent, stickSpeedOutput.textContent, turnOutput.textContent] = inputText.split('|');
    }
    const heading = `${Math.round(((pose.rotation % 360) + 360) % 360) % 360}°`;
    if (heading !== headingText) { headingText = heading; headingOutputs.forEach(output => { output.textContent = heading; }); }
    demo.classList.toggle('is-driving', driving);
  }
  // How far the robot may drift from the middle before the view follows it. The diagram is cropped
  // to fill its box, so a short phone-sized view gets less room than a tall one.
  const slack = { x: 85, y: 55 };
  function measureView() {
    const scale = Math.max(svg.clientWidth / 520, svg.clientHeight / 460);
    if (!scale) return;
    slack.x = Math.max(0, svg.clientWidth / scale / 2 - 175);
    slack.y = Math.max(0, svg.clientHeight / scale / 2 - 175);
  }
  if (window.ResizeObserver) new ResizeObserver(measureView).observe(svg);
  measureView();
  function start() {
    if (frameId || !visible || document.hidden) return;
    if (!last || performance.now() - last > 100) last = performance.now() - 16;
    frameId = requestAnimationFrame(frame);
  }

  // Joystick: glued to the pointer from the press, released into a spring that inherits the finger's velocity.
  function endDrag() {
    if (!drag) return;
    const first = drag.history[0], latest = drag.history[drag.history.length - 1];
    const span = first && latest ? (latest.time - first.time) / 1000 : 0;
    knob.vx = span > .01 ? Math.max(-1400, Math.min(1400, (latest.x - first.x) / span)) : 0;
    knob.vy = span > .01 ? Math.max(-1400, Math.min(1400, (latest.y - first.y) / span)) : 0;
    // Only a release that carried momentum earns a little bounce.
    knob.damping = Math.hypot(knob.vx, knob.vy) > 260 ? .8 : 1;
    drag = undefined;
    stick.classList.remove('is-dragging');
    start();
  }
  stick.addEventListener('pointerdown', event => {
    if (event.button > 0 || drag) return;
    const rect = stick.getBoundingClientRect();   // measured at the press: the stage moves with the page
    const centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height / 2;
    const x = event.clientX - centerX, y = event.clientY - centerY;
    const onKnob = Math.hypot(x - knob.x, y - knob.y) <= knobEl.offsetWidth / 2 + 6;
    drag = {
      id: event.pointerId, centerX, centerY, start: performance.now(), history: [],
      // On the knob: keep the offset where it was grabbed. Beside it: the knob comes to the finger.
      offsetX: onKnob ? x - knob.x : 0, offsetY: onKnob ? y - knob.y : 0,
      gapX: onKnob ? 0 : knob.x - x, gapY: onKnob ? 0 : knob.y - y
    };
    drag.x = x - drag.offsetX; drag.y = y - drag.offsetY;
    knob.vx = knob.vy = 0;
    try { stick.setPointerCapture(event.pointerId); } catch (error) { /* synthetic pointers cannot be captured */ }
    stick.classList.add('is-dragging');
    stick.focus({ preventScroll: true });
    event.preventDefault();
    start();
  });
  stick.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    drag.x = event.clientX - drag.centerX - drag.offsetX;
    drag.y = event.clientY - drag.centerY - drag.offsetY;
    start();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => stick.addEventListener(type, event => {
    if (drag && event.pointerId === drag.id) endDrag();
  }));
  stick.addEventListener('keydown', event => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (keyVectors[key]) { event.preventDefault(); keys.add(key); knob.damping = 1; start(); }
    if ((key === 'q' || key === 'e') && !event.repeat) hold(`key-${key}`, key === 'q' ? -1 : 1);
  });
  stick.addEventListener('keyup', event => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (keys.delete(key)) start();
    if (key === 'q' || key === 'e') release(`key-${key}`);
  });
  stick.addEventListener('blur', () => { keys.clear(); release('key-q'); release('key-e'); start(); });

  // Turn buttons: the robot turns from the press itself and for as long as it is held.
  function hold(source, direction) {
    const existing = holds.get(source);
    if (existing) clearTimeout(existing.timer);
    holds.set(source, { direction, since: performance.now() });
    start();
  }
  function release(source, immediately = false) {
    const active = holds.get(source);
    if (!active || active.timer) return;
    const remaining = immediately ? 0 : TAP_TURN - (performance.now() - active.since);
    if (remaining > 0) active.timer = setTimeout(() => { holds.delete(source); start(); }, remaining);
    else { holds.delete(source); start(); }
  }
  demo.querySelectorAll('[data-rotate]').forEach(button => {
    const direction = Number(button.dataset.rotate);
    const source = `button-${direction}`;
    let lastKey = 0;
    const down = () => { button.classList.add('is-held'); hold(source, direction); };
    const up = () => { button.classList.remove('is-held'); release(source); };
    button.addEventListener('pointerdown', event => {
      if (event.button > 0) return;
      try { button.setPointerCapture(event.pointerId); } catch (error) { /* synthetic pointers cannot be captured */ }
      down();
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => button.addEventListener(type, up));
    button.addEventListener('keydown', event => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault(); lastKey = performance.now();
      if (!event.repeat) down();
    });
    button.addEventListener('keyup', event => {
      if (event.key === ' ' || event.key === 'Enter') { lastKey = performance.now(); up(); }
    });
    button.addEventListener('blur', up);
    // Activation without a pointer or key press (assistive technology) still gives one visible turn.
    button.addEventListener('click', event => {
      if (event.detail || performance.now() - lastKey < 600) return;
      hold(`${source}-tap`, direction); release(`${source}-tap`);
    });
  });
  function releaseAll() {
    keys.clear();
    [...holds.keys()].forEach(source => { clearTimeout(holds.get(source).timer); holds.delete(source); });
    demo.querySelectorAll('.rotate-button.is-held').forEach(button => button.classList.remove('is-held'));
    endDrag();
  }
  deck.addEventListener('contextmenu', event => event.preventDefault());
  resetButton.addEventListener('click', () => {
    pose.rotation = shortest(pose.rotation);
    resetting = true;
    start();
  });
  // In single-column layouts the wheel numbers sit between the diagram and the controls,
  // so they stay in view while a thumb is on the joystick.
  const readout = demo.querySelector('.swerve-readout');
  const copy = demo.querySelector('.swerve-main');
  const singleColumn = matchMedia('(max-width: 980px)');
  function placeReadout() {
    if (!readout) return;
    if (singleColumn.matches) deck.before(readout); else copy.append(readout);
  }
  singleColumn.addEventListener('change', placeReadout);
  placeReadout();
  deck.hidden = false;
  resetButton.hidden = false;
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) start(); else releaseAll();
  }).observe(demo);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); else start(); });
  addEventListener('blur', releaseAll);
  preference.addEventListener('change', () => { clearTabAnimations(); start(); });
  render();
})();
