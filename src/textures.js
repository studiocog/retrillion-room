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
// Three layers of buildings; only the nearest layer's windows switch on and off (twinkle), since a farther window
// could be behind a nearer building and repainting it would punch a hole.
export function drawCity(w, h, seed = 11) {
  const t = canvasTexture(w, h), { g } = t, r = rng(seed);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#04050c"); sky.addColorStop(.5, "#10142a"); sky.addColorStop(.78, "#2a2138"); sky.addColorStop(1, "#3b2a33");
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${r() * .6})`; g.fillRect(r() * w, r() * h * .4, 1, 1); }
  g.fillStyle = "#f4ecd8"; g.shadowColor = "#f4ecd8"; g.shadowBlur = 24;
  g.beginPath(); g.arc(w * .76, h * .3, 13, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;

  const layers = [
    { color: "#171b2e", min: .34, max: .58, wmin: 22, wmax: 60, win: .12 },
    { color: "#0e1121", min: .3, max: .52, wmin: 30, wmax: 80, win: .22 },
    { color: "#07080f", min: .26, max: .44, wmin: 45, wmax: 110, win: .32, live: true },
  ];
  const windows = [], beacons = [];
  const paint = win => { g.fillStyle = win.on ? win.lit : win.off; g.fillRect(win.x, win.y, win.w, win.h); };
  for (const L of layers) {
    for (let x = -10; x < w;) {
      const bw = L.wmin + r() * (L.wmax - L.wmin), bh = h * (L.min + r() * (L.max - L.min)), top = h - bh;
      g.fillStyle = L.color; g.fillRect(x, top, bw, bh);
      const cw = 4, ch = 6, gx = 4, gy = 5;
      for (let wy = top + 7; wy < h - ch; wy += ch + gy) for (let wx = x + 5; wx < x + bw - cw - 3; wx += cw + gx) {
        const warm = r() < .85;
        const win = { x: wx, y: wy, w: cw, h: ch, on: r() < L.win, off: "#141724",
          lit: warm ? (r() < .5 ? "#ffc96b" : "#ffe2a8") : "#a8d8ff" };
        paint(win); if (L.live) windows.push(win);
      }
      if (L.live && bh > h * .4) beacons.push({ x: x + bw / 2, y: top - 3 });
      x += bw + r() * 6;
    }
  }
  const beacon = on => { for (const b of beacons) { g.fillStyle = on ? "#ff3b30" : "#2a0c10"; g.fillRect(b.x - 2, b.y - 2, 4, 4); } };
  beacon(true);
  return {
    ...t,
    twinkle() { const win = windows[(r() * windows.length) | 0]; if (win) { win.on = !win.on; paint(win); t.tex.needsUpdate = true; } },
    beacon(on) { beacon(on); t.tex.needsUpdate = true; },
  };
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
