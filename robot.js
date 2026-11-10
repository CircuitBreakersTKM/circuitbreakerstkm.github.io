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
  const engine = window.anime;
  const chassis = document.getElementById('swerve-chassis');
  const svg = document.getElementById('swerve-svg');
  const wheels = [...demo.querySelectorAll('.swerve-wheel')];
  const pad = demo.querySelector('.gamepad');
  const description = demo.querySelector('.swerve-description');
  const svgDescription = document.getElementById('swerve-svg-desc');
  const count = document.getElementById('queue-count');
  const xOutput = document.getElementById('pose-x');
  const yOutput = document.getElementById('pose-y');
  const headingOutput = document.getElementById('pose-heading');
  const commands = {
    up: { x: 0, y: -60, rotation: 0, label: 'Jízda nahoru podle hřiště' },
    down: { x: 0, y: 60, rotation: 0, label: 'Jízda dolů podle hřiště' },
    left: { x: -60, y: 0, rotation: 0, label: 'Jízda doleva podle hřiště' },
    right: { x: 60, y: 0, rotation: 0, label: 'Jízda doprava podle hřiště' },
    spin: { x: 0, y: 0, rotation: 90, label: 'Otočení o 90° doprava' }
  };
  const pose = { x: 0, y: 0, rotation: 0 };
  const steering = wheels.map(() => ({ angle: 0, drive: 1 }));
  const moduleLocations = [[-90, -90], [90, -90], [-90, 90], [90, 90]];
  const camera = { x: 0, y: 0 };
  const queue = [];
  let timeline;
  let target;
  let moduleTarget;
  let running = false;
  let visible = true;
  let revision = 0;
  const shortest = degrees => ((degrees + 180) % 360 + 360) % 360 - 180;

  function render() {
    chassis.setAttribute('transform', `translate(${pose.x} ${pose.y}) rotate(${pose.rotation})`);
    // Follow at the edge of the view, without clamping or resetting world coordinates.
    if (Math.abs(pose.x - camera.x) > 85) camera.x = pose.x - Math.sign(pose.x - camera.x) * 85;
    if (Math.abs(pose.y - camera.y) > 55) camera.y = pose.y - Math.sign(pose.y - camera.y) * 55;
    svg.setAttribute('viewBox', `${camera.x} ${camera.y} 520 460`);
    const grid = svg.querySelector('rect[fill="url(#swerve-grid)"]');
    grid.setAttribute('x', camera.x); grid.setAttribute('y', camera.y);
    xOutput.textContent = String(Math.round(pose.x));
    yOutput.textContent = String(Math.round(-pose.y));
    headingOutput.textContent = `${Math.round(pose.rotation)}°`;
    wheels.forEach((wheel, index) => {
      wheel.setAttribute('transform', `rotate(${steering[index].angle})`);
      wheel.querySelector('.wheel-vector').setAttribute('transform', `rotate(${steering[index].drive < 0 ? 180 : 0})`);
    });
  }
  function queueStatus() { count.textContent = String(queue.length); }
  function setRunning(value) {
    running = value; demo.classList.toggle('is-driving', value);
    if (!value) pad.querySelectorAll('.is-command-active').forEach(button => button.classList.remove('is-command-active'));
  }
  function updateVisibility() {
    if (!timeline) return;
    if (document.hidden || !visible) timeline.pause();
    else timeline.play();
  }
  function next() {
    if (running || !queue.length) return;
    const name = queue.shift();
    const command = commands[name];
    queueStatus();
    target = { x: pose.x + command.x, y: pose.y + command.y, rotation: pose.rotation + command.rotation };
    const theta = pose.rotation * Math.PI / 180;
    const desired = moduleLocations.map(([x, y], index) => {
      // Inverse kinematics: field velocity -> chassis velocity + omega cross module position.
      const vx = command.rotation ? -y : Math.cos(theta) * command.x + Math.sin(theta) * command.y;
      const vy = command.rotation ? x : -Math.sin(theta) * command.x + Math.cos(theta) * command.y;
      let delta = shortest(Math.atan2(vx, -vy) * 180 / Math.PI - steering[index].angle);
      let drive = 1;
      if (Math.abs(delta) > 90) { delta = shortest(delta + 180); drive = -1; }
      return { angle: steering[index].angle + delta, drive };
    });
    moduleTarget = desired;
    steering.forEach((state, index) => { state.drive = desired[index].drive; });
    description.textContent = command.label + '. Další povel naváže na tuto polohu.';
    svgDescription.textContent = command.label;
    if (!engine || preference.matches) {
      Object.assign(pose, target);
      steering.forEach((state, index) => { state.angle = desired[index].angle; });
      render(); next(); return;
    }
    setRunning(true);
    pad.querySelector(`[data-swerve="${name}"]`).classList.add('is-command-active');
    const thisRevision = revision;
    const start = { ...pose };
    const steerDuration = Math.max(120, Math.max(...desired.map((state, index) => Math.abs(state.angle - steering[index].angle))) / 360 * 1000);
    timeline = engine.createTimeline({ autoplay: false })
      .add(steering, { angle: (_, index) => desired[index].angle, duration: steerDuration, ease: 'inOutSine', onUpdate: render }, 0)
      .add(pose, { ...target, duration: 850, ease: 'inOutSine', onUpdate: () => {
        const travel = command.rotation ? (pose.rotation - start.rotation) * Math.PI / 180 * Math.hypot(90, 90) : Math.hypot(pose.x - start.x, pose.y - start.y);
        wheels.forEach((wheel, index) => { wheel.querySelector('.wheel-tread').style.strokeDashoffset = String(travel * steering[index].drive); });
        render();
      } }, steerDuration);
    timeline.then(() => {
      if (thisRevision !== revision) return;
      timeline = undefined; setRunning(false); render(); next();
    });
    timeline.play(); updateVisibility();
  }
  function reset() {
    revision++;
    timeline?.cancel(); timeline = undefined;
    queue.length = 0; target = undefined;
    Object.assign(pose, { x: 0, y: 0, rotation: 0 });
    Object.assign(camera, { x: 0, y: 0 });
    steering.forEach(state => { state.angle = 0; state.drive = 1; });
    setRunning(false); queueStatus(); render();
    description.textContent = 'Robot je zpět uprostřed hřiště. Fronta je prázdná.';
    svgDescription.textContent = description.textContent;
  }
  function enqueue(name) {
    if (name === 'reset') { reset(); return; }
    queue.push(name); queueStatus(); next();
  }
  pad.hidden = false;
  pad.querySelectorAll('[data-swerve]').forEach(button => button.addEventListener('click', () => enqueue(button.dataset.swerve)));
  pad.addEventListener('keydown', event => {
    const name = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', e: 'spin', E: 'spin', r: 'reset', R: 'reset' }[event.key];
    if (name) { event.preventDefault(); enqueue(name); }
  });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; updateVisibility(); }).observe(demo);
  document.addEventListener('visibilitychange', updateVisibility);
  preference.addEventListener('change', () => {
    clearTabAnimations();
    if (preference.matches && running) {
      revision++; timeline?.cancel(); timeline = undefined;
      Object.assign(pose, target);
      steering.forEach((state, index) => { state.angle = moduleTarget[index].angle; });
      setRunning(false); render(); next();
    }
  });
  render();
})();
