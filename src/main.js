// The room's runtime: renderer and post-processing, camera views, hash routing, clicks and keys.
// Routes: #home, #about (the TV close up), #work (the notepad held up), #work/<id> (that tape playing on the TV).
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { readContent } from "./content.js";
import { buildRoom } from "./room.js";
import { createSound } from "./sound.js";

const html = document.documentElement;
const progress = p => window.__progress?.(p);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } },
                set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

if (html.classList.contains("room")) start().catch(err => { console.error(err); html.classList.remove("room"); });

async function start() {
  progress(.15);
  // canvas text needs its fonts loaded first, or the first screens draw in a fallback face
  await Promise.all(['600 20px "IBM Plex Mono"', '700 40px "Space Grotesk"', "700 40px Kalam", "400 20px Kalam"]
    .map(f => document.fonts.load(f))).catch(() => {});
  progress(.4);

  const content = readContent();
  const canvas = document.getElementById("gl");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const camera = new THREE.PerspectiveCamera(45, 1, .05, 50);
  const room = buildRoom(content);
  progress(.65);

  // post-processing: the scene, then bloom (the screen, bulb and city windows glow), then tone mapping and sRGB
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(room.scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .5, .45, .85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------------------------------------------------------------- quality and sound controls
  const sound = createSound();
  const soundBtn = document.getElementById("sound"), lofiBtn = document.getElementById("lofi"), backBtn = document.getElementById("back");
  const hintEl = document.getElementById("hint");
  let lofi = store.get("room.lofi") ? store.get("room.lofi") === "1" : matchMedia("(pointer: coarse)").matches;
  function applyQuality() {
    renderer.setPixelRatio(lofi ? 1 : Math.min(devicePixelRatio, 2));
    composer.setPixelRatio(renderer.getPixelRatio());
    room.lamp.light.castShadow = !lofi;
    lofiBtn.setAttribute("aria-pressed", String(lofi));
    lofiBtn.textContent = lofi ? "Lo-fi on" : "Lo-fi";
    resize();
  }
  lofiBtn.onclick = () => { lofi = !lofi; store.set("room.lofi", lofi ? "1" : "0"); applyQuality(); };
  soundBtn.onclick = () => { sound.on = !sound.on; soundBtn.textContent = sound.on ? "Sound on" : "Sound off"; soundBtn.setAttribute("aria-pressed", String(sound.on)); };

  // ---------------------------------------------------------------- camera views (recomputed on resize)
  // Each view is a camera position and a point it looks at, pulled back far enough that what it frames fits the
  // screen's width as well as its height (a phone held upright needs a lot more distance).
  const V = { home: { pos: new THREE.Vector3(), look: new THREE.Vector3() }, tv: { pos: new THREE.Vector3(), look: new THREE.Vector3() },
              note: { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }, intro: { pos: new THREE.Vector3() } };
  const fit = (w, h) => { const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); return Math.max(h / (2 * tanH), w / (2 * tanH * camera.aspect)); };
  function computeViews() {
    const d = fit(2.5, 1.35);
    V.home.look.set(0, 1.1, -.5);
    V.home.pos.set(.05, 1.1 + d * .12, -.5 + d);
    const c = room.tv.center, dt = fit(room.tv.size.x * 1.2, room.tv.size.y * 1.2);
    V.tv.look.copy(c); V.tv.pos.set(c.x, c.y + .02, c.z + dt);
    // the notepad held up: in front of the home camera, facing it
    const dir = V.home.look.clone().sub(V.home.pos).normalize();
    V.note.pos.copy(V.home.pos).addScaledVector(dir, fit(.5 * 1.15, .7 * 1.15));
    V.note.quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(V.home.pos, V.home.look, new THREE.Vector3(0, 1, 0)));
    V.intro.pos.copy(V.home.pos).add(new THREE.Vector3(.2, .35, 1.4));
  }

  // ---------------------------------------------------------------- tweens (one per channel: a new camera move replaces the old)
  const tweens = new Map();
  const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  function tween(channel, ms, step) {
    if (reduceMotion || ms <= 0) { tweens.delete(channel); step(1); return; }
    tweens.set(channel, { t0: performance.now(), ms, step });
  }
  function runTweens(now) {
    for (const [ch, tw] of tweens) {
      const k = Math.min(1, (now - tw.t0) / tw.ms);
      tw.step(ease(k));
      if (k === 1) tweens.delete(ch);
    }
  }

  const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  function moveCamera(view, ms) {
    const p0 = cam.pos.clone(), l0 = cam.look.clone();
    tween("cam", ms, k => { cam.pos.lerpVectors(p0, view.pos, k); cam.look.lerpVectors(l0, view.look, k); });
  }
  const note = room.notepad, ud = note.userData;
  function moveNote(present, ms) {
    const p0 = note.position.clone(), q0 = note.quaternion.clone();
    const p1 = present ? V.note.pos : ud.restPos, q1 = present ? V.note.quat : ud.restQuat;
    const mat = note.material, e0 = mat.emissiveIntensity, e1 = present ? .75 : .05;
    tween("note", ms, k => {
      mat.emissiveIntensity = e0 + (e1 - e0) * k;
      note.position.lerpVectors(p0, p1, k);
      note.position.y += Math.sin(k * Math.PI) * .08;   // lifted in an arc, not slid through the desk
      note.quaternion.slerpQuaternions(q0, q1, k);
    });
  }

  // ---------------------------------------------------------------- routes
  const TITLES = { about: "About", work: "Work" };
  let route = { page: "home" }, entered = false, selected = null;
  const parse = h => {
    const [page, id] = h.replace(/^#\/?/, "").split("/");
    if (page === "about") return { page: "about" };
    if (page === "work") return id ? { page: "tape", id } : { page: "work" };
    return { page: "home" };
  };
  const now = () => performance.now() / 1000;
  const viewFor = r => (r.page === "about" || r.page === "tape") ? V.tv : V.home;

  function place(ms) {
    moveCamera(viewFor(route), ms);
    moveNote(route.page === "work", ms * .8);
  }

  function go(r, ms = 1100) {
    const item = r.page === "tape" ? content.work.find(w => w.id === r.id) : null;
    if (r.page === "tape" && !item) { location.hash = "#work"; return; }
    const prev = route; route = r;
    selected = item ? item.id : null;
    place(ms);
    const changed = prev.page !== r.page || prev.id !== r.id;
    if (changed || !entered) {
      room.tv.show(item ? { kind: "tape", item, index: content.work.indexOf(item), t0: now() } : { kind: r.page }, now());
      if (item) sound.thunk(); else sound.click();
      sound.static();
    }
    backBtn.hidden = r.page === "home";
    const label = r.page === "tape" ? item.title : TITLES[r.page];
    document.title = label ? `${label} · ${content.name}` : content.name;
    setHint();
  }
  // read the hash, not `route`: hashchange is async, so two quick Escs would otherwise both see the old page
  const back = () => { location.hash = parse(location.hash).page === "tape" ? "#work" : "#home"; };
  backBtn.onclick = back;
  addEventListener("hashchange", () => { if (entered) go(parse(location.hash)); });

  // ---------------------------------------------------------------- pointer: hover and click
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2(), pointer = { x: 0, y: 0 };
  let hover = null;
  const touch = matchMedia("(pointer: coarse)").matches;
  const HINTS = {
    home: touch ? "Tap a tape, the TV, the notepad, the lamp" : "Click a tape, the TV, the notepad, the lamp · A about · W work",
    about: "Esc to step back",
    work: "Pick a line on the notepad · Esc to put it down",
    tape: "Esc for the list",
  };
  function setHint() {
    let h = HINTS[route.page];
    if (hover) {
      const k = hover.object.userData.kind;
      if (k === "tape") h = `Play “${hover.object.userData.item.title}”`;
      else if (k === "notepad") { const id = route.page === "work" ? room.note.rowAt(hover.uv) : null; h = id ? `Play “${content.work.find(w => w.id === id).title}”` : "Open the Work list"; }
      else if (k === "screen") h = route.page === "tape" && room.tv.view.item?.href ? `Visit ${new URL(room.tv.view.item.href).host}` : route.page === "home" ? "Watch: About" : h;
      else if (k === "lamp") h = room.lamp.on ? "Switch the lamp off" : "Switch the lamp on";
      else if (k === "mug") h = "Have a sip";
    }
    hintEl.textContent = h;
  }
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    pointer.x = ndc.x; pointer.y = ndc.y;
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects(room.clickables, false)[0] || null;
  }
  canvas.addEventListener("pointermove", e => {
    if (!entered) return;
    hover = pick(e);
    canvas.classList.toggle("hot", !!hover);
    room.note.hover(hover?.object === note && route.page === "work" ? room.note.rowAt(hover.uv) : null);
    setHint();
  });
  canvas.addEventListener("click", e => {
    if (!entered) return;
    const hit = pick(e); if (!hit) return;
    const k = hit.object.userData.kind;
    if (k === "tape") location.hash = `#work/${hit.object.userData.item.id}`;
    else if (k === "notepad") {
      const id = route.page === "work" ? room.note.rowAt(hit.uv) : null;
      location.hash = id ? `#work/${id}` : "#work";
    } else if (k === "screen") {
      const href = room.tv.view.item?.href;
      if (route.page === "tape" && href) window.open(href, "_blank", "noopener");
      else if (route.page === "home") location.hash = "#about";
    } else if (k === "lamp") { room.lamp.toggle(); sound.lamp(); setHint(); }
    else if (k === "mug") {
      sound.sip();
      tween("mug", 700, k2 => { room.mug.rotation.z = Math.sin(k2 * Math.PI * 3) * (1 - k2) * .12; });
    }
  });
  addEventListener("keydown", e => {
    if (!entered || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Escape") back();
    else if (e.key === "a" || e.key === "A") location.hash = "#about";
    else if (e.key === "w" || e.key === "W") location.hash = "#work";
    else if (/^[1-9]$/.test(e.key) && content.work[+e.key - 1]) location.hash = `#work/${content.work[+e.key - 1].id}`;
  });

  // ---------------------------------------------------------------- size
  function resize() {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h, false); composer.setSize(w, h);
    computeViews();
    if (entered) place(0); else cam.pos.copy(V.intro.pos), cam.look.copy(V.home.look);
  }
  addEventListener("resize", resize);
  applyQuality();

  // ---------------------------------------------------------------- the frame loop
  const par = new THREE.Vector2(), tmp = new THREE.Vector3();
  function frame(ms) {
    runTweens(ms);
    // a little parallax with the pointer, less when close up
    const amt = viewFor(route) === V.tv ? .25 : 1;
    par.x += (pointer.x * .05 * amt - par.x) * .05; par.y += (pointer.y * .03 * amt - par.y) * .05;
    camera.position.copy(cam.pos).add(tmp.set(par.x, par.y, 0));
    camera.lookAt(cam.look);
    // the playing tape slides out of the stack, a hovered one a little
    for (const t of room.tapes) {
      const want = t.userData.item.id === selected ? .16 : hover?.object === t ? .05 : 0;
      t.userData.out += (want - t.userData.out) * .15;
      t.position.z = t.userData.rest.z + t.userData.out;
    }
    room.update(ms / 1000);
    if (lofi) renderer.render(room.scene, camera); else composer.render();
  }

  // build every shader before the gate opens, so the first frames after the click don't stall
  room.tv.show({ kind: "home" }, now(), false);
  room.update(now());
  renderer.compile(room.scene, camera);
  frame(performance.now());
  renderer.setAnimationLoop(frame);
  progress(1);
  window.__roomReady = true;

  // ---------------------------------------------------------------- the gate
  const gate = document.getElementById("gate");
  document.getElementById("enter").addEventListener("click", () => {
    sound.start();
    soundBtn.textContent = sound.on ? "Sound on" : "Sound off"; soundBtn.setAttribute("aria-pressed", String(sound.on));
    gate.classList.add("gone"); setTimeout(() => gate.remove(), 1000);
    document.getElementById("room").removeAttribute("aria-hidden");
    entered = true;
    go(parse(location.hash), 1800);
  }, { once: true });
}
