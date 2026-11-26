/* Showcase player: draws one run (a "scene" made by tools/autonomous/showcase_animations.py)
   into any element. Generated pages carry it inline; for an existing web page use the files
   in docs/showcase/animations/embed:

     a div with data-showcase="game2_manual", then the scripts showcase-player.js and
     game2_manual.js (embed/example.html shows it)

   Add data-autoplay to start by itself. Each player lives in its own shadow root, so the
   page's styles and ids do not touch it and several players can share a page. */
(function () {
"use strict";
const CSS = `:host { display: block; background: #fff; color: #1a1a1a;
               font: 15px/1.35 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .wrap { max-width: 1600px; margin: 0 auto; padding: 8px 10px 10px; box-sizing: border-box; }
  h1 { font-size: clamp(15px, 2.2vw, 22px); margin: 2px 0 6px; font-weight: 700; }
  canvas { display: block; width: 100%; height: auto; border-radius: 4px; background: #fff; }
  .bar { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
  button { font: inherit; border: 1px solid #b8bcc4; background: #f4f5f7; border-radius: 6px;
           padding: 4px 10px; min-width: 44px; cursor: pointer; }
  button:hover { background: #e9ebef; }
  input[type=range] { flex: 1; min-width: 60px; accent-color: #1e50c8; }
  .time { font-variant-numeric: tabular-nums; min-width: 9ch; text-align: right; }
  .note { color: #5a5f69; font-size: 13px; margin-top: 4px; }`;
const MARKUP = `<div class="wrap">
  <h1 id="title"></h1>
  <canvas id="c"></canvas>
  <div class="bar">
    <button id="play" aria-label="Přehrát / pozastavit">❚❚</button>
    <input id="seek" type="range" min="0" max="1000" value="0" aria-label="Čas">
    <span class="time" id="time"></span>
    <button id="rate" aria-label="Rychlost přehrávání">1×</button>
  </div>
  <div class="note" id="note"></div>
</div>`;

function mount(host, S, options = {}) {
const root = host.shadowRoot || host.attachShadow({ mode: "open" });
root.innerHTML = `<style>${CSS}</style>${MARKUP}`;
const $ = id => root.getElementById(id);
const cv = $("c"), g = cv.getContext("2d");
const bg = new Image();
let scale = 1, now = 0, playing = !!options.autoplay, rate = 1, last = null, visible = true;

const R = S.robot, N = R.x.length, DT = R.dt, DUR = S.dur;
const px = (x, y) => [(S.map.ox + x * S.map.sx) * scale, (S.map.oy - y * S.map.sy) * scale];
const len = m => m * S.map.sx * scale;
const cz = (v, d = 1) => v.toFixed(d).replace(".", ",");

function pose(t) {
  const f = Math.min(Math.max(t / DT, 0), N - 1), i = Math.min(Math.floor(f), N - 2), u = f - i;
  const mix = a => (a[i] + (a[i + 1] - a[i]) * u) / 100;
  return { x: mix(R.x), y: mix(R.y), h: mix(R.h), v: mix(R.v) };
}
function local(p, fwd, left) {
  const c = Math.cos(p.h), s = Math.sin(p.h);
  return [p.x + fwd * c - left * s, p.y + fwd * s + left * c];
}
const STOPS = [[0, [40, 60, 150]], [0.8, [26, 150, 140]], [1.6, [240, 150, 40]], [2.4, [214, 39, 40]]];
function speedColour(v, alpha) {
  let c = STOPS[3][1];
  for (let k = 0; k < 3; k++) {
    const [a, ca] = STOPS[k], [b, cb] = STOPS[k + 1];
    if (v <= b) { const f = Math.max(0, (v - a) / (b - a)); c = ca.map((q, i) => q + f * (cb[i] - q)); break; }
  }
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`;
}

function trail(t) {
  const end = Math.min(Math.floor(t / DT), N - 1);
  const start = S.trail ? Math.max(0, end - Math.round(S.trail / DT)) : 0;
  g.lineCap = "round"; g.lineWidth = Math.max(2, len(S.trail ? 0.022 : 0.03));
  for (let i = start; i < end; i++) {
    const alpha = S.trail ? 0.15 + 0.8 * (i - start) / Math.max(1, end - start) : 1;
    g.strokeStyle = speedColour(R.v[i] / 100, alpha);
    g.beginPath(); g.moveTo(...px(R.x[i] / 100, R.y[i] / 100));
    g.lineTo(...px(R.x[i + 1] / 100, R.y[i + 1] / 100)); g.stroke();
  }
}
function square(cx, cy, a, half, fill, stroke, width) {
  const c = Math.cos(a), s = Math.sin(a);
  g.beginPath();
  [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([u, v], k) => {
    const p = px(cx + half * (u * c - v * s), cy + half * (u * s + v * c));
    k ? g.lineTo(...p) : g.moveTo(...p);
  });
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = width; g.stroke(); }
}
function footprint(p, colour, fill, width) {
  square(p.x, p.y, p.h, S.half, fill, colour, width);
  g.strokeStyle = colour; g.lineWidth = width * 2.6; g.lineCap = "butt";
  g.beginPath(); g.moveTo(...px(...local(p, S.half, S.half))); g.lineTo(...px(...local(p, S.half, -S.half))); g.stroke();
}
function label(x, y, text, colour) {
  const size = Math.max(11, len(0.105));
  g.font = `700 ${size}px system-ui, sans-serif`;
  const w = g.measureText(text).width, pad = size * 0.3;
  let [cx, cy] = px(x, y);
  cx = Math.min(Math.max(cx, w / 2 + pad + 2), cv.width - w / 2 - pad - 2);
  cy = Math.min(Math.max(cy, size / 2 + pad + 2), cv.height - size / 2 - pad - 2);
  g.fillStyle = "rgba(255,255,255,.9)"; g.strokeStyle = colour; g.lineWidth = Math.max(1, size * 0.09);
  g.beginPath(); g.roundRect(cx - w / 2 - pad, cy - size / 2 - pad, w + 2 * pad, size + 2 * pad, size * 0.25);
  g.fill(); g.stroke();
  g.fillStyle = colour; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, cx, cy + size * 0.04);
}
function marks(t, layer) {
  for (const m of S.marks) {
    if (m.t > t || (m.end !== undefined && m.end < t) || (m.k === "t") !== (layer === "text")) continue;
    if (m.k === "c") {
      g.beginPath(); g.arc(...px(m.x, m.y), len(m.r), 0, 7); g.fillStyle = m.col; g.fill();
      g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = Math.max(1, len(0.012)); g.stroke();
    } else if (m.k === "q") {
      square(m.x, m.y, m.a, m.half, m.col, "#fff", Math.max(1, len(0.015)));
    } else if (m.k === "p") {
      footprint(m, m.col, m.fill, Math.max(1.5, len(m.w || 0.012)));
    } else if (m.k === "l") {
      g.strokeStyle = m.col; g.lineWidth = Math.max(1.5, len(m.w || 0.014)); g.setLineDash(m.dash ? [len(0.06), len(0.05)] : []);
      g.beginPath(); g.moveTo(...px(m.x, m.y)); g.lineTo(...px(m.x2, m.y2)); g.stroke(); g.setLineDash([]);
    } else if (m.k === "t") {
      label(m.x, m.y, m.text.replace("{t}", cz(Math.min(t, m.until ?? t)) + " s"), m.col);
    }
  }
}
// Objects: keyframes [t, x, y, angle, state]. States: 0 on the floor, 1 held by the robot
// (x, y are then forward / left of its centre), 2 in the air, 3 at rest in a goal, 4 gone.
function objectAt(o, t) {
  const k = o.k; let lo = 0, hi = k.length - 1;
  if (t <= k[0][0]) return { x: k[0][1], y: k[0][2], a: k[0][3], s: k[0][4], u: 0 };
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; k[mid][0] <= t ? lo = mid : hi = mid - 1; }
  const a = k[lo], b = k[Math.min(lo + 1, k.length - 1)];
  const u = b[0] > a[0] ? Math.min(1, (t - a[0]) / (b[0] - a[0])) : 0;
  if (a[4] === 1) return { x: a[1], y: a[2], a: a[3], s: 1, u };
  let bx = b[1], by = b[2];
  if (b[4] === 1 && a[4] !== 1) [bx, by] = local(pose(b[0]), b[1], b[2]);  // moving into the robot
  let da = b[3] - a[3]; da = Math.atan2(Math.sin(da), Math.cos(da));
  return { x: a[1] + (bx - a[1]) * u, y: a[2] + (by - a[2]) * u, a: a[3] + da * u, s: a[4], u };
}
function objects(t, p, held) {
  for (const o of S.objs) {
    const q = objectAt(o, t);
    if (q.s === 4 || (q.s === 1) !== held) continue;
    let x = q.x, y = q.y, a = q.a, lift = 0;
    if (q.s === 1) { [x, y] = local(p, q.x, q.y); a = p.h + q.a; }
    if (q.s === 2) lift = Math.sin(Math.PI * q.u);
    if (o.kind === "ball") {
      const r = len(o.r * (1 + 0.9 * lift));
      if (lift > 0) { g.beginPath(); g.arc(...px(x, y - 0.05 * lift), len(o.r), 0, 7); g.fillStyle = "rgba(0,0,0,.14)"; g.fill(); }
      g.beginPath(); g.arc(...px(x, y), r, 0, 7);
      g.fillStyle = q.s === 3 ? "#d9a514" : "#f2c81e"; g.fill();
      g.strokeStyle = "#5d4a06"; g.lineWidth = Math.max(1, len(0.012)); g.stroke();
    } else {
      square(x, y, a, o.r, q.s === 3 ? "#d9731a" : "#f08a24", "#5a2c05", Math.max(1, len(0.014)));
    }
  }
}
function robot(t, p) {
  const busy = k => S.states.some(s => s.k === k && s.a <= t && t < s.b);
  square(p.x, p.y, p.h, S.half, "rgba(30,80,200,.22)", "#1e50c8", Math.max(2, len(0.022)));
  g.lineCap = "butt"; g.lineWidth = Math.max(3, len(0.05));
  g.strokeStyle = "#1e50c8";
  g.beginPath(); g.moveTo(...px(...local(p, S.half, S.half))); g.lineTo(...px(...local(p, S.half, -S.half))); g.stroke();
  if (busy("intake")) {
    g.strokeStyle = "#00963c";
    g.beginPath(); g.moveTo(...px(...local(p, -S.half, S.half))); g.lineTo(...px(...local(p, -S.half, -S.half))); g.stroke();
  }
  if (busy("shoot")) { g.beginPath(); g.arc(...px(p.x, p.y), len(0.13), 0, 7); g.fillStyle = "rgba(200,0,0,.8)"; g.fill(); }
  if (S.arm) {  // the gripper's arm, reaching ahead of the front bumper
    g.strokeStyle = busy("carry") ? "#b85c00" : "rgba(30,80,200,.75)"; g.lineWidth = Math.max(2, len(0.03));
    g.beginPath(); g.moveTo(...px(...local(p, S.half, S.arm[1]))); g.lineTo(...px(...local(p, S.arm[0], S.arm[1]))); g.stroke();
  }
}
function hud(t, p) {
  const size = Math.max(12, len(0.12));
  g.font = `600 ${size}px system-ui, sans-serif`; g.textBaseline = "top"; g.textAlign = "left";
  const lines = [`${cz(Math.min(t, DUR))} s`, `${cz(p.v)} m/s`];
  for (const c of S.counters) lines.push(`${c.label}: ${c.times.filter(q => q <= t).length}`);
  const w = Math.max(...lines.map(s => g.measureText(s).width)) + size * 0.8, h = lines.length * size * 1.3 + size * 0.5;
  const [x, y] = [cv.width - w - size * 0.5, size * 0.5];
  g.fillStyle = "rgba(255,255,255,.88)"; g.strokeStyle = "#9aa0aa"; g.lineWidth = 1;
  g.beginPath(); g.roundRect(x, y, w, h, size * 0.3); g.fill(); g.stroke();
  g.fillStyle = "#1a1a1a";
  lines.forEach((s, k) => g.fillText(s, x + size * 0.4, y + size * 0.3 + k * size * 1.3));
}
function draw() {
  const t = Math.min(now, DUR), p = pose(t);
  g.clearRect(0, 0, cv.width, cv.height);
  if (bg.complete && bg.naturalWidth) g.drawImage(bg, 0, 0, cv.width, cv.height);
  trail(t); marks(t, "shapes"); objects(t, p, false); robot(t, p); objects(t, p, true); marks(t, "text"); hud(t, p);
  $("seek").value = Math.round(1000 * t / DUR);
  $("time").textContent = `${cz(t)} / ${cz(DUR)} s`;
}
function resize() {
  const ratio = window.devicePixelRatio || 1, w = Math.round((cv.clientWidth || 800) * ratio);
  if (w === cv.width) { draw(); return; }
  cv.width = w; cv.height = Math.round(w * S.h / S.w);
  scale = cv.width / S.w; draw();
}
function frame(ts) {
  if (playing && visible && last !== null) {
    now += rate * Math.min(0.1, (ts - last) / 1000);
    if (now >= DUR) { now = DUR; setPlaying(false); }
  }
  last = ts; draw(); requestAnimationFrame(frame);
}
function setPlaying(on) {
  if (on && now >= DUR) now = 0;
  playing = on; $("play").textContent = on ? "❚❚" : "▶";
}
// For the page around it: element.showcase.seek(12.5), .play(), .pause(), .duration.
host.showcase = { seek(t) { now = Math.min(Math.max(t, 0), DUR); draw(); }, play() { setPlaying(true); },
                  pause() { setPlaying(false); }, duration: DUR };
$("title").textContent = S.title;
$("note").textContent = S.note || "";
$("play").onclick = () => setPlaying(!playing);
$("seek").oninput = e => { now = DUR * e.target.value / 1000; draw(); };
$("rate").onclick = e => { rate = rate === 1 ? 2 : rate === 2 ? 4 : 1; e.target.textContent = rate + "×"; };
new ResizeObserver(resize).observe(cv);
// Off screen it stands still, so several players on one page cost nothing.
new IntersectionObserver(e => { visible = e[e.length - 1].isIntersecting; }).observe(cv);
bg.onload = resize; bg.src = S.bg;
setPlaying(playing); resize(); requestAnimationFrame(frame);
return host.showcase;
}

const runs = {};
function scan() {
  document.querySelectorAll("[data-showcase]").forEach(el => {
    const scene = runs[el.dataset.showcase];
    if (scene && !el.showcase) mount(el, scene, { autoplay: el.hasAttribute("data-autoplay") });
  });
}
window.Showcase = { mount, scan, add(name, scene) { runs[name] = scene; scan(); } };
(window.ShowcaseQueue || []).forEach(([name, scene]) => { runs[name] = scene; });
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan); else scan();
})();
