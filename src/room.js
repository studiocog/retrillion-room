// The room: real models (CC0, from Poly Haven, compressed into models/*.glb) on a desk under a rainy window, plus the
// pieces the site draws itself: the TV's picture, the tapes, the notepad, the city, the rain.
// Units are metres; the desk top is at DESK_Y. main.js only uses what buildRoom returns, so a model can be swapped
// here without touching it.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { canvasTexture, drawWood, drawCityLayers, createRainGlass, drawPlaster, drawScreen, drawStatic, drawLabel, drawNotepad } from "./textures.js";

const TABLE_H = .958, TABLE_SY = .8;
export const DESK_Y = TABLE_H * TABLE_SY;
const MODELS = ["painted_wooden_table", "television_02", "industrial_pipe_lamp", "potted_plant_02", "portable_cassette_player",
  "round_spectacles", "stationery_supplies", "hanging_picture_frame_02", "alarm_clock_01"];

// The TV's glass in the model's own units (measured by eye against the model): centre and size. The picture is a
// slightly bulged plane laid just in front of it, like a tube's face.
const TV_SCALE = 1.6, TV_GLASS = { x: -.012, y: .25, z: .124, w: .31, h: .238 };

export async function buildRoom(content, onProgress = () => {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#04050a");
  const clickables = [];

  // ---------------------------------------------------------------- models
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => onProgress(loaded / total);
  const loader = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
  const base = new URL("../models/", import.meta.url).href;
  const gltfs = await Promise.all(MODELS.map(n => loader.loadAsync(base + n + ".glb")));
  const M = Object.fromEntries(MODELS.map((n, i) => [n, gltfs[i].scene]));
  for (const root of Object.values(M)) root.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  const place = (root, [x, y, z], { s = 1, ry = 0, rx = 0, parent = scene } = {}) => {
    root.position.set(x, y, z); root.rotation.set(rx, ry, 0);
    typeof s === "number" ? root.scale.setScalar(s) : root.scale.set(...s);
    parent.add(root); return root;
  };
  const tag = (root, kind) => root.traverse(o => { if (o.isMesh) { o.userData.kind = kind; clickables.push(o); } });

  const std = (color, roughness = .8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const mesh = (geo, mat, [x, y, z] = [0, 0, 0], parent = scene) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  };
  const box = (w, h, d, mat, pos, parent) => mesh(new THREE.BoxGeometry(w, h, d), mat, pos, parent);

  // ---------------------------------------------------------------- floor, walls, window, curtains
  const floorT = drawWood(1024, 1024, { base: "#3e271a", planks: 8, seed: 3 });
  floorT.tex.repeat.set(3, 3);
  const floor = mesh(new THREE.PlaneGeometry(8, 8), std("#ffffff", .6, { map: floorT.tex }));
  floor.rotation.x = -Math.PI / 2; floor.castShadow = false;

  const plaster = drawPlaster(1024, 1024);
  plaster.tex.repeat.set(2, 2);
  const wallMat = std("#ffffff", .95, { map: plaster.tex });
  const WX = 1.4, WY0 = 1.0, WY1 = 2.5, WZ = -1.6, WT = .14, RH = 3.2;
  box(2.6, RH, WT, wallMat, [-WX - 1.3, RH / 2, WZ]);
  box(2.6, RH, WT, wallMat, [WX + 1.3, RH / 2, WZ]);
  box(2 * WX, WY0, WT, wallMat, [0, WY0 / 2, WZ]);
  box(2 * WX, RH - WY1, WT, wallMat, [0, (WY1 + RH) / 2, WZ]);
  box(WT, RH, 6, wallMat, [-3, RH / 2, 1.4]);
  box(WT, RH, 6, wallMat, [3, RH / 2, 1.4]);
  box(6, WT, 6, std("#191515", 1), [0, RH, 1.4]);
  box(5.6, .12, .03, std("#2a2220", .6), [0, .06, WZ + .085]);                      // skirting board

  const frameMat = std("#e4dccd", .45);
  box(2 * WX + .16, .05, .3, frameMat, [0, WY0, WZ + .1]);                          // sill
  box(2 * WX + .16, .07, .18, frameMat, [0, WY1, WZ]);
  for (const x of [-WX, 0, WX]) box(.07, WY1 - WY0, .18, frameMat, [x, (WY0 + WY1) / 2, WZ]);
  box(2 * WX, .045, .1, frameMat, [0, 1.95, WZ]);                                   // transom

  // curtains: a plane folded into soft waves
  const curtainGeo = new THREE.PlaneGeometry(.7, 2.75, 80, 1);
  { const p = curtainGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 38) * .035 + Math.sin(p.getX(i) * 11) * .02); curtainGeo.computeVertexNormals(); }
  const curtainMat = std("#5b4636", 1, { side: THREE.DoubleSide });
  for (const x of [-WX - .2, WX + .2]) mesh(curtainGeo, curtainMat, [x, 1.43, WZ + .2]);

  // the city at two depths, rain falling between them and the glass, and drops on the glass itself
  const city = drawCityLayers();
  const farMesh = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), new THREE.MeshBasicMaterial({ map: city.far.tex, toneMapped: false }));
  farMesh.position.set(0, 2.3, -5.5); scene.add(farMesh);
  const nearMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.6), new THREE.MeshBasicMaterial({ map: city.near.tex, transparent: true, toneMapped: false }));
  nearMesh.position.set(0, 1.55, -2.7); scene.add(nearMesh);

  const RAIN = 900, rainPos = new Float32Array(RAIN * 6), rainV = new Float32Array(RAIN);
  const resetDrop = (i, y = 1 + Math.random() * 2.2) => {
    const x = (Math.random() - .5) * 3.4, z = -1.75 - Math.random() * .9, len = .05 + Math.random() * .07;
    rainPos.set([x, y, z, x + .01, y + len, z], i * 6); rainV[i] = 3.5 + Math.random() * 2;
  };
  for (let i = 0; i < RAIN; i++) resetDrop(i);
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  scene.add(new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: "#9fb4d9", transparent: true, opacity: .16, toneMapped: false })));

  const glass = createRainGlass();
  const glassMesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * WX, WY1 - WY0),
    new THREE.MeshBasicMaterial({ map: glass.tex, transparent: true, depthWrite: false, toneMapped: false }));
  glassMesh.position.set(0, (WY0 + WY1) / 2, WZ + .01); scene.add(glassMesh);

  // ---------------------------------------------------------------- the desk and what's on it
  place(M.painted_wooden_table, [0, 0, -.42], { s: [1, TABLE_SY, 1] });

  // TV: the model, the picture on its glass, and a little of the picture's light thrown onto the desk
  const tv = place(M.television_02, [-.2, DESK_Y, -.55], { s: TV_SCALE, ry: .1 });
  const screenT = canvasTexture(640, 480);
  const screenMat = new THREE.MeshBasicMaterial({ map: screenT.tex, toneMapped: false });
  const screenGeo = new THREE.PlaneGeometry(TV_GLASS.w, TV_GLASS.h, 16, 12);
  { const p = screenGeo.attributes.position; for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / (TV_GLASS.w / 2), v = p.getY(i) / (TV_GLASS.h / 2); p.setZ(i, .012 * (1 - .5 * (u * u + v * v))); } }
  const screen = mesh(screenGeo, screenMat, [TV_GLASS.x, TV_GLASS.y, TV_GLASS.z], tv);
  screen.castShadow = false; screen.receiveShadow = false;
  screen.userData = { kind: "screen" }; clickables.push(screen);
  const tvGlow = new THREE.PointLight("#ffae52", .5, 2.5, 2);
  tvGlow.position.set(TV_GLASS.x, TV_GLASS.y, TV_GLASS.z + .25); tv.add(tvGlow);

  // tapes, one per Work item, stacked left of the TV
  const shell = std("#141416", .35), shellTop = std("#1e1e22", .45);
  const tapeGeo = new RoundedBoxGeometry(.4, .06, .23, 2, .008);
  const tapes = content.work.map((item, i) => {
    const label = drawLabel(item, i);
    const spine = std("#ffffff", .5, { map: label.tex, emissive: "#ffffff", emissiveMap: label.tex, emissiveIntensity: .3 });
    const t = new THREE.Mesh(tapeGeo, [shell, shell, shellTop, shell, spine, shell]);   // +z face is the spine
    t.position.set(-.84 + Math.sin(i * 7.1) * .015, DESK_Y + .03 + i * .062, -.42);
    t.rotation.y = .22 + Math.sin(i * 3.7) * .05;
    t.castShadow = t.receiveShadow = true; scene.add(t);
    t.userData = { kind: "tape", item, rest: t.position.clone(), out: 0, dir: new THREE.Vector3(Math.sin(t.rotation.y), 0, Math.cos(t.rotation.y)) };
    clickables.push(t);
    return t;
  });

  // the notepad: the Work list
  const noteT = canvasTexture(512, 717);
  let noteRows = drawNotepad(noteT, content.work), noteHover = null;
  const notepad = mesh(new THREE.PlaneGeometry(.42, .59), std("#ffffff", .95,
    { map: noteT.tex, side: THREE.DoubleSide, emissive: "#ffffff", emissiveMap: noteT.tex, emissiveIntensity: .04 }));
  notepad.rotation.set(-Math.PI / 2, 0, .16);
  notepad.position.set(.34, DESK_Y + .004, -.1);
  notepad.castShadow = false;
  notepad.userData = { kind: "notepad", restPos: notepad.position.clone(), restQuat: notepad.quaternion.clone() };
  clickables.push(notepad);

  // the lamp: a spotlight from its bulb onto the desk, and the bulb itself glowing
  const lamp = place(M.industrial_pipe_lamp, [.9, DESK_Y, -.66], { s: 1.7, ry: -2.2 });   // head turned to the desk
  let bulbMat = null;
  lamp.traverse(o => { if (o.isMesh) o.castShadow = false; });   // the light sits inside the shade; it mustn't shadow itself
  lamp.traverse(o => { if (o.isMesh && /glass/i.test(o.material.name)) {
    bulbMat = o.material = o.material.clone();
    bulbMat.emissive = new THREE.Color("#ffcf8a"); bulbMat.emissiveIntensity = 6; bulbMat.toneMapped = false; } });
  lamp.updateMatrixWorld(true);
  const bulbAt = lamp.localToWorld(new THREE.Vector3(0, .297, .065));
  const lampLight = new THREE.SpotLight("#ffae5e", 6, 0, .95, .85, 2);
  lampLight.position.copy(bulbAt);
  lampLight.target.position.set(.05, DESK_Y, -.2);
  lampLight.castShadow = true; lampLight.shadow.mapSize.set(2048, 2048);
  lampLight.shadow.bias = -.0004; lampLight.shadow.normalBias = .015; lampLight.shadow.radius = 6; lampLight.shadow.camera.near = .03;
  const bulbFill = new THREE.PointLight("#ffbb77", .9, 3, 2);                      // what spills past the shade
  bulbFill.position.copy(bulbAt).add(new THREE.Vector3(0, .05, 0));
  scene.add(lampLight, lampLight.target, bulbFill);
  tag(lamp, "lamp");
  let lampOn = true;

  // the rest of the desk
  const walkman = place(M.portable_cassette_player, [.72, DESK_Y + .02, .02], { s: 1.25, rx: -Math.PI / 2, ry: 0 });
  walkman.rotation.z = .5; tag(walkman, "walkman");
  const specs = place(M.round_spectacles, [.62, DESK_Y + .025, -.33], { s: 1.1, ry: 2.4 }); tag(specs, "glasses");
  // the pens come as a flat lay with their cup on its side; the loose pens are enough
  const pens = place(M.stationery_supplies, [.38, DESK_Y + .005, -.72], { s: 1.2, rx: -Math.PI / 2 });
  pens.rotation.z = .3;
  const pencilCup = pens.getObjectByName("stationery_supplies_pencilcup");
  if (pencilCup) pencilCup.visible = false;
  const clock = place(M.alarm_clock_01, [.98, DESK_Y, -.24], { s: 1.3, ry: 2.1 }); tag(clock, "clock");
  const hands = {};
  clock.traverse(o => { if (/hand/.test(o.name)) hands[o.name] = { node: o, base: o.quaternion.clone() }; });

  // a mug
  const mug = new THREE.Group(); mug.position.set(-.48, DESK_Y, .02); scene.add(mug);
  const ceramic = std("#e7e1d6", .3);
  const cup = mesh(new THREE.CylinderGeometry(.045, .04, .1, 32), ceramic, [0, .05, 0], mug);
  const coffee = mesh(new THREE.CircleGeometry(.041, 32), std("#22130a", .1), [0, .096, 0], mug); coffee.rotation.x = -Math.PI / 2;
  const handle = mesh(new THREE.TorusGeometry(.027, .008, 10, 24, Math.PI), ceramic, [.045, .05, 0], mug); handle.rotation.z = -Math.PI / 2;
  for (const m of [cup, handle]) { m.userData.kind = "mug"; clickables.push(m); }

  // the room around the desk
  const plant = place(M.potted_plant_02, [1.75, 0, -1.05], { s: 1.25, ry: .6 }); tag(plant, "plant");
  const leaves = plant.getObjectByName("potted_plant_02_leaves");
  place(M.hanging_picture_frame_02, [-2.05, 1.72, WZ + .075], { s: 1.1 });

  // ---------------------------------------------------------------- light
  scene.add(new THREE.HemisphereLight("#2a3756", "#120c08", .22));
  const moon = new THREE.DirectionalLight("#7d98ff", .42);                           // cool light from the window
  moon.position.set(-.8, 2.8, -3.2); moon.target.position.set(0, .8, 0);
  moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); moon.shadow.bias = -.0005; moon.shadow.radius = 8;
  Object.assign(moon.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -1, near: .5, far: 8 });
  scene.add(moon, moon.target);
  const win = new THREE.RectAreaLight("#8aa6ff", 1.6, 2 * WX, WY1 - WY0);           // the window's glow over the room
  win.position.set(0, (WY0 + WY1) / 2, WZ + .05); win.lookAt(0, (WY0 + WY1) / 2, 2); scene.add(win);

  scene.updateMatrixWorld(true);

  // ---------------------------------------------------------------- the TV's picture, and the little animations
  let view = { kind: "home" }, staticUntil = 0, lastDraw = -1, lastTwinkle = 0, lastClock = 0, beaconOn = true, dirty = true, lastT = 0;
  const qa = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  const setHands = () => {
    const d = new Date(), s = d.getSeconds(), m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
    for (const [name, ang] of [["houd_hand", h / 12], ["minute_hand", m / 60], ["second_hand", s / 60]]) {
      const hd = hands[name]; if (!hd) continue;
      hd.node.quaternion.copy(hd.base).multiply(qa.setFromAxisAngle(Y, -ang * Math.PI * 2));
    }
  };
  setHands();

  return {
    scene, clickables, tapes, notepad, mug, specs, leaves,
    tv: {
      group: tv, screen,
      center: screen.getWorldPosition(new THREE.Vector3()),
      size: new THREE.Vector2(.66, .68),            // the set as a close-up should fit it
      get view() { return view; },
      show(next, t, noise = true) { view = next; staticUntil = noise ? t + .28 : 0; dirty = true; },
    },
    lamp: {
      get on() { return lampOn; },
      toggle() {
        lampOn = !lampOn; lampLight.visible = bulbFill.visible = lampOn;
        if (bulbMat) bulbMat.emissiveIntensity = lampOn ? 6 : 0;
      },
      light: lampLight, moon,
    },
    note: {
      size: [.42, .59],
      rowAt(uv) { const y = (1 - uv.y) * noteT.c.height; return noteRows.find(r => y >= r.y0 && y <= r.y1)?.id ?? null; },
      hover(id) { if (id !== noteHover) { noteHover = id; noteRows = drawNotepad(noteT, content.work, id); } },
    },
    update(t) {
      const dt = Math.min(.05, t - lastT); lastT = t;
      if (t < staticUntil) drawStatic(screenT);
      else if (dirty || t - lastDraw > .25) { drawScreen(screenT, view, content, t); lastDraw = t; dirty = false; }
      const flick = .94 + .06 * Math.sin(t * 50) * Math.sin(t * 7.3);               // a faint tube flicker
      screenMat.color.setScalar(flick); tvGlow.intensity = .5 * flick;
      if (t - lastTwinkle > .6) { city.twinkle(); lastTwinkle = t; }
      const b = Math.floor(t * 1.2) % 2 === 0; if (b !== beaconOn) { beaconOn = b; city.beacon(b); }
      if (t - lastClock > 1) { setHands(); lastClock = t; }
      for (let i = 0; i < RAIN; i++) {
        const o = i * 6, fall = rainV[i] * dt;
        rainPos[o + 1] -= fall; rainPos[o + 4] -= fall; rainPos[o] -= fall * .04; rainPos[o + 3] -= fall * .04;
        if (rainPos[o + 1] < .9) resetDrop(i, 3.2);
      }
      rainGeo.attributes.position.needsUpdate = true;
      glass.draw(dt);
    },
  };
}
