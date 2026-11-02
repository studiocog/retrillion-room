// Everything the room shows as a picture is drawn here into a canvas: the TV's screen, the tape labels, the notepad,
// the city out the window, the wood. Text drawn from the page's content means the room needs no image files, and
// changing the HTML changes the room.
import * as THREE from "three";

export function canvasTexture(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { c, g, tex };
}

// a small seeded random, so the city and the wood come out the same on every visit
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function wrap(g, text, maxW) {
  const lines = []; let line = "";
  for (const word of String(text).split(/\s+/)) {
    const next = line ? line + " " + word : word;
    if (line && g.measureText(next).width > maxW) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const MONO = (px, wt = 400) => `${wt} ${px}px "IBM Plex Mono", monospace`;
const GROT = (px, wt = 700) => `${wt} ${px}px "Space Grotesk", sans-serif`;
const HAND = (px, wt = 400) => `${wt} ${px}px Kalam, cursive`;

// ------------------------------------------------------------------ wood (floor and desk)
export function drawWood(w, h, { base = "#5b3a22", planks = 8, seed = 7 } = {}) {
  const t = canvasTexture(w, h), { g } = t, r = rng(seed), ph = h / planks, col = new THREE.Color(base);
  for (let i = 0; i < planks; i++) {
    const c = col.clone().offsetHSL((r() - .5) * .02, (r() - .5) * .08, (r() - .5) * .06);
    g.fillStyle = "#" + c.getHexString(); g.fillRect(0, i * ph, w, ph);
    for (let k = 0; k < 36; k++) {   // grain: long, slightly wavy strokes
      const y = i * ph + r() * ph, amp = 1 + r() * 2, f = .004 + r() * .01;
      g.strokeStyle = `rgba(0,0,0,${.04 + r() * .08})`; g.lineWidth = .5 + r() * 1.5;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 24) g.lineTo(x, y + Math.sin(x * f + k) * amp);
      g.stroke();
    }
    g.fillStyle = "rgba(0,0,0,.35)";
    g.fillRect(0, i * ph, w, 2);            // seam between planks
    g.fillRect(r() * w, i * ph, 2, ph);     // a butt joint
  }
  t.tex.wrapS = t.tex.wrapT = THREE.RepeatWrapping;
  return t;
}

// ------------------------------------------------------------------ the city out the window
// Two pictures at two depths, so the city moves with parallax as the camera does:
//   far   the sky, a hazy glow off the streets, and two soft skylines (blurred: out of focus behind the glass)
//   near  one sharper skyline on a clear background, with windows that switch on and off (twinkle), rooftop water
//         tanks, red beacons, and big out-of-focus street lights (bokeh) along the bottom
const blurOK = typeof CanvasRenderingContext2D !== "undefined" && "filter" in CanvasRenderingContext2D.prototype;

function skyline(g, r, w, h, { color, min, max, wmin, wmax, win, cw = 4, ch = 6, onWindow }) {
  const out = [];
  for (let x = -10; x < w;) {
    const bw = wmin + r() * (wmax - wmin), bh = h * (min + r() * (max - min)), top = h - bh;
    g.fillStyle = color; g.fillRect(x, top, bw, bh);
    if (r() < .3) { g.fillRect(x + bw * .3, top - 10, bw * .12, 10); }            // a rooftop box
    for (let wy = top + 8; wy < h - ch; wy += ch + 5) for (let wx = x + 5; wx < x + bw - cw - 3; wx += cw + 4) {
      const warm = r() < .82;
      const wnd = { x: wx, y: wy, w: cw, h: ch, on: r() < win, off: "#121521",
        lit: warm ? (r() < .5 ? "#ffc067" : "#ffe0a3") : "#9fd2ff" };
      onWindow?.(wnd);
      g.fillStyle = wnd.on ? wnd.lit : wnd.off; g.fillRect(wnd.x, wnd.y, wnd.w, wnd.h);
    }
    out.push({ x, bw, top, bh });
    x += bw + r() * 5;
  }
  return out;
}

export function drawCityLayers(seed = 11) {
  const r = rng(seed);
  // far
  const far = canvasTexture(1024, 576), fg = far.g, FW = 1024, FH = 576;
  const sky = fg.createLinearGradient(0, 0, 0, FH);
  sky.addColorStop(0, "#03040a"); sky.addColorStop(.45, "#0c1024"); sky.addColorStop(.75, "#2a2036"); sky.addColorStop(1, "#5a3a3a");
  fg.fillStyle = sky; fg.fillRect(0, 0, FW, FH);
  for (let i = 0; i < 90; i++) { fg.fillStyle = `rgba(255,255,255,${r() * .45})`; fg.fillRect(r() * FW, r() * FH * .35, 1, 1); }
  fg.fillStyle = "#efe6d2"; fg.shadowColor = "#efe6d2"; fg.shadowBlur = 30;
  fg.beginPath(); fg.arc(FW * .18, FH * .22, 11, 0, Math.PI * 2); fg.fill(); fg.shadowBlur = 0;
  if (blurOK) fg.filter = "blur(2.5px)";
  skyline(fg, r, FW, FH, { color: "#1a1d31", min: .28, max: .5, wmin: 18, wmax: 50, win: .1, cw: 3, ch: 4 });
  if (blurOK) fg.filter = "blur(1.4px)";
  skyline(fg, r, FW, FH, { color: "#11142a", min: .22, max: .42, wmin: 26, wmax: 70, win: .18, cw: 3, ch: 5 });
  if (blurOK) fg.filter = "none";
  const haze = fg.createLinearGradient(0, FH * .6, 0, FH);                         // the street glow
  haze.addColorStop(0, "rgba(255,140,80,0)"); haze.addColorStop(1, "rgba(255,140,80,.28)");
  fg.fillStyle = haze; fg.fillRect(0, FH * .6, FW, FH * .4);

  // near
  const near = canvasTexture(1024, 560), ng = near.g, NW = 1024, NH = 560;
  const windows = [];
  if (blurOK) ng.filter = "blur(.8px)";                                             // a little soft: seen through wet glass
  const blds = skyline(ng, r, NW, NH, { color: "#06070d", min: .3, max: .62, wmin: 60, wmax: 150, win: .3, cw: 5, ch: 8,
    onWindow: wnd => windows.push(wnd) });
  if (blurOK) ng.filter = "none";
  const beacons = blds.filter(b => b.bh > NH * .5).map(b => ({ x: b.x + b.bw / 2, y: b.top - 4 }));
  for (let i = 0; i < 26; i++) {                                                   // out-of-focus street lights
    const x = r() * NW, y = NH - r() * NH * .12, rad = 8 + r() * 22, warm = r() < .75;
    const grd = ng.createRadialGradient(x, y, 0, x, y, rad);
    const col = warm ? "255,170,90" : "140,200,255";
    grd.addColorStop(0, `rgba(${col},.55)`); grd.addColorStop(.7, `rgba(${col},.25)`); grd.addColorStop(1, `rgba(${col},0)`);
    ng.fillStyle = grd; ng.beginPath(); ng.arc(x, y, rad, 0, Math.PI * 2); ng.fill();
  }
  const paint = wnd => { ng.fillStyle = wnd.on ? wnd.lit : wnd.off; ng.fillRect(wnd.x, wnd.y, wnd.w, wnd.h); };
  const beacon = on => { for (const b of beacons) { ng.clearRect(b.x - 3, b.y - 3, 6, 6); ng.fillStyle = on ? "#ff3b30" : "#3a0d12"; ng.fillRect(b.x - 2, b.y - 2, 4, 4); } };
  beacon(true);
  return {
    far, near,
    twinkle() { const w = windows[(r() * windows.length) | 0]; if (w) { w.on = !w.on; paint(w); near.tex.needsUpdate = true; } },
    beacon(on) { beacon(on); near.tex.needsUpdate = true; },
  };
}

// ------------------------------------------------------------------ rain on the glass
// Small drops that stay put, and a few bigger ones that run down, leaving a wet trail. Drawn as faint highlights:
// the glass catches the city's light where the water is.
export function createRainGlass(w = 512, h = 300, seed = 5) {
  const t = canvasTexture(w, h), { g } = t, r = rng(seed);
  const still = Array.from({ length: 260 }, () => ({ x: r() * w, y: r() * h, s: .35 + r() * .9 }));
  const fresh = () => ({ x: r() * w, y: -20 - r() * h, v: 18 + r() * 50, s: 1 + r() * 1.1, wob: r() * 10 });
  const runners = Array.from({ length: 12 }, fresh);
  const drop = (x, y, s, a = 1) => {
    g.fillStyle = `rgba(150,170,215,${.12 * a})`; g.beginPath(); g.ellipse(x, y, s, s * 1.25, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = `rgba(255,240,220,${.22 * a})`; g.fillRect(x - s * .35, y - s * .7, Math.max(.8, s * .4), Math.max(.8, s * .4));
  };
  return {
    ...t,
    draw(dt) {
      g.clearRect(0, 0, w, h);
      for (const d of still) drop(d.x, d.y, d.s, .8);
      for (const d of runners) {
        d.y += d.v * dt * (.4 + Math.random() * 1.2);
        d.x += Math.sin(d.y * .05 + d.wob) * .15;
        if (d.y > h + 20) Object.assign(d, fresh());
        const trail = g.createLinearGradient(0, d.y - 60, 0, d.y);
        trail.addColorStop(0, "rgba(190,210,255,0)"); trail.addColorStop(1, "rgba(190,210,255,.16)");
        g.strokeStyle = trail; g.lineWidth = d.s * .9; g.beginPath(); g.moveTo(d.x, d.y - 60); g.lineTo(d.x, d.y); g.stroke();
        drop(d.x, d.y, d.s);
      }
      t.tex.needsUpdate = true;
    },
  };
}

// ------------------------------------------------------------------ plaster for the walls
export function drawPlaster(w, h, { base = "#4a403c", seed = 21 } = {}) {
  const t = canvasTexture(w, h), { g } = t, r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) {                                                   // broad, soft unevenness
    const x = r() * w, y = r() * h, rad = 40 + r() * 140, grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const c = r() < .5 ? "0,0,0" : "255,240,220";
    grd.addColorStop(0, `rgba(${c},.05)`); grd.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = grd; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 9000; i++) {                                                 // fine grain
    g.fillStyle = r() < .5 ? `rgba(0,0,0,${r() * .08})` : `rgba(255,255,255,${r() * .05})`;
    g.fillRect(r() * w, r() * h, 1 + r(), 1 + r());
  }
  t.tex.wrapS = t.tex.wrapT = THREE.RepeatWrapping;
  return t;
}

// ------------------------------------------------------------------ the TV's screen
const AMBER = "#ffb54a", DIM = "rgba(255,181,74,.55)";

export function drawScreen(s, view, content, now) {
  const { c, g } = s, W = c.width, H = c.height, P = 40, blink = Math.floor(now * 2) % 2 === 0;
  g.fillStyle = "#120b04"; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, H / 2, H * .1, W / 2, H / 2, W * .65);
  glow.addColorStop(0, "rgba(255,150,40,.12)"); glow.addColorStop(1, "rgba(0,0,0,.55)");
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.fillStyle = AMBER; g.shadowColor = AMBER; g.shadowBlur = 10; g.textAlign = "left"; g.textBaseline = "alphabetic";

  const head = (left, right) => {
    g.font = MONO(20, 600); g.fillText(left, P, P + 12);
    g.textAlign = "right"; g.fillText(right, W - P, P + 12); g.textAlign = "left";
  };
  const para = (text, px, y, maxLines, lh = px * 1.4) => {
    if (maxLines <= 0) return y;
    g.font = MONO(px); const L = wrap(g, text, W - 2 * P);
    L.slice(0, maxLines).forEach((l, i) => g.fillText(i === maxLines - 1 && L.length > maxLines ? l + " …" : l, P, y + i * lh));
    return y + Math.min(L.length, maxLines) * lh;
  };
  const big = (text, px, y, maxLines = 2) => {
    g.font = GROT(px); const L = wrap(g, text.toUpperCase(), W - 2 * P).slice(0, maxLines);
    L.forEach((l, i) => g.fillText(l, P, y + i * px * 1.04));
    return y + L.length * px * 1.04;
  };

  if (view.kind === "home") {
    head("CH 00", blink ? "● LIVE" : "");
    const y = big(content.name, 64, 150);
    para(content.tagline, 21, y + 10, 4);
    g.font = MONO(20, 600); g.fillText("▶ PICK A TAPE" + (blink ? " _" : ""), P, H - P);
  } else if (view.kind === "about") {
    head("CH 01 · ABOUT", blink ? "▶" : "");
    let y = 112;
    for (const p of content.about) { y = para(p, 19, y, Math.floor((H - 70 - y) / 27)) + 12; if (y > H - 80) break; }
    g.font = MONO(15); g.fillStyle = DIM; g.fillText("FULL TEXT: TEXT VERSION ↘", P, H - P + 6);
  } else if (view.kind === "work") {
    head("CH -- · NO SIGNAL", "");
    big("Insert tape", 58, H / 2 - 10);
    g.font = MONO(20); g.fillText("pick a line on the notepad" + (blink ? " _" : ""), P, H / 2 + 40);
  } else if (view.kind === "tape") {
    const it = view.item, secs = Math.max(0, now - view.t0);
    const clock = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;
    head(`CH ${String(view.index + 1).padStart(2, "0")} ▶ PLAY`, clock);
    let y = big(it.title, 54, 140);
    g.font = MONO(20, 600); g.fillStyle = DIM; g.fillText(it.years, P, y); g.fillStyle = AMBER;
    para(it.blurb, 21, y + 44, 5);
    if (it.href) { g.font = MONO(18, 600); g.fillText("↗ " + new URL(it.href).host + "  (click screen)", P, H - P); }
    g.fillStyle = DIM; g.fillRect(W - P - 140, H - P - 26, 140, 5);   // the tape running
    g.fillStyle = AMBER; g.fillRect(W - P - 140, H - P - 26, 140 * ((secs % 30) / 30), 5);
  }
  g.shadowBlur = 0;
  g.fillStyle = "rgba(0,0,0,.28)";                       // scanlines
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 2);
  s.tex.needsUpdate = true;
}

let noiseC = null;
export function drawStatic(s) {
  if (!noiseC) { noiseC = document.createElement("canvas"); noiseC.width = 160; noiseC.height = 120; }
  const ng = noiseC.getContext("2d"), im = ng.createImageData(160, 120);
  for (let i = 0; i < im.data.length; i += 4) {
    const v = Math.random() * 255; im.data[i] = v; im.data[i + 1] = v * .8; im.data[i + 2] = v * .55; im.data[i + 3] = 255;
  }
  ng.putImageData(im, 0, 0);
  s.g.imageSmoothingEnabled = false; s.g.drawImage(noiseC, 0, 0, s.c.width, s.c.height); s.g.imageSmoothingEnabled = true;
  s.tex.needsUpdate = true;
}

// ------------------------------------------------------------------ tape spines
export function drawLabel(item, i) {
  const t = canvasTexture(512, 76), { g } = t;
  g.fillStyle = item.color; g.fillRect(0, 0, 512, 76);
  g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(0, 0, 512, 6); g.fillRect(0, 70, 512, 6);
  g.fillStyle = "#f6efe0"; g.fillRect(14, 14, 56, 48);
  g.textBaseline = "middle"; g.textAlign = "center";
  g.fillStyle = item.color; g.font = GROT(30); g.fillText(String(i + 1).padStart(2, "0"), 42, 40);
  g.textAlign = "left"; g.fillStyle = "#fff"; g.font = GROT(32); g.fillText(item.title.toUpperCase(), 88, 40, 290);
  g.textAlign = "right"; g.font = MONO(20, 500); g.fillText(item.years, 498, 40, 110);
  return t;
}

// ------------------------------------------------------------------ the notepad (the Work list)
// Returns each row's band in canvas pixels, so a click's UV on the paper can find its line.
export function drawNotepad(t, items, hoverId = null) {
  const { c, g } = t, W = c.width, H = c.height;
  g.fillStyle = "#f2d977"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#7a2a1f"; g.fillRect(0, 0, W, 26);
  g.strokeStyle = "rgba(40,80,160,.35)"; g.lineWidth = 2;
  for (let y = 150; y < H - 10; y += 44) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.strokeStyle = "rgba(200,40,40,.55)"; g.beginPath(); g.moveTo(66, 26); g.lineTo(66, H); g.stroke();
  g.textBaseline = "alphabetic";
  g.fillStyle = "#1d2a4a"; g.font = HAND(64, 700); g.fillText("Work", 82, 110);
  g.font = HAND(22); g.textAlign = "right"; g.fillText("click a line to play it", W - 24, 110); g.textAlign = "left";
  const rows = [];
  items.forEach((it, i) => {
    const y = 150 + 44 * (i + 1) - 10;   // the baseline sits on its ruled line
    if (it.id === hoverId) { g.fillStyle = "rgba(255,110,50,.32)"; g.fillRect(70, y - 32, W - 86, 40); }
    g.fillStyle = "#c0392b"; g.font = HAND(22); g.fillText(String(i + 1).padStart(2, "0"), 24, y);
    g.fillStyle = "#1d2a4a"; g.font = HAND(30, 700); g.fillText(it.title, 82, y, 290);
    g.font = HAND(22); g.textAlign = "right"; g.fillText(it.years, W - 24, y); g.textAlign = "left";
    rows.push({ id: it.id, y0: y - 34, y1: y + 10 });
  });
  g.fillStyle = "rgba(29,42,74,.55)"; g.font = HAND(20); g.fillText("Esc to put it down", 82, H - 28);
  t.tex.needsUpdate = true;
  return rows;
}

// ------------------------------------------------------------------ the deck's clock
export function drawClock(t) {
  const { g, c } = t, d = new Date();
  g.fillStyle = "#050806"; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#4dff88"; g.shadowColor = "#4dff88"; g.shadowBlur = 8;
  g.font = MONO(34, 600); g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`, c.width / 2, c.height / 2 + 2);
  g.shadowBlur = 0; t.tex.needsUpdate = true;
}
