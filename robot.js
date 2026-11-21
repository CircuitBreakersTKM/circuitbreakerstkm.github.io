(() => {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const explorer = document.querySelector('.robot-explorer');
  const tabs = [...document.querySelectorAll('[data-robot-tab]')];
  const panels = [...document.querySelectorAll('[data-robot-panel]')];
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
  if (explorer && tabs.length) {
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
