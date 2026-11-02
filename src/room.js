// The room: built from primitives and canvas textures, so the starter has no model files to download.
// Units are metres; the desk top is at DESK_Y. To swap in real models later, replace a block here with a
// GLTFLoader load and keep the same names (tv.screen, tapes, notepad, lamp, mug) so main.js keeps working.
import * as THREE from "three";
import { canvasTexture, drawWood, drawCity, drawScreen, drawStatic, drawLabel, drawNotepad, drawClock } from "./textures.js";

export const DESK_Y = 0.76;

export function buildRoom(content) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#05060a");
  const clickables = [];

  const std = (color, roughness = .8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const mesh = (geo, mat, [x, y, z] = [0, 0, 0], parent = scene) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  };
  const box = (w, h, d, mat, pos, parent) => mesh(new THREE.BoxGeometry(w, h, d), mat, pos, parent);

  // ---------------------------------------------------------------- light
  scene.add(new THREE.HemisphereLight("#33415f", "#1a120c", .75));
  const fill = new THREE.PointLight("#ffcf9a", 1.6, 0, 2);   // a dim warm fill from off-screen right, so the tapes read
  fill.position.set(1.4, 1.6, .5); scene.add(fill);
  const moon = new THREE.DirectionalLight("#7f9cff", .7);   // cool light through the window
  moon.position.set(-.6, 2.6, -3); moon.target.position.set(0, .8, 0);
  scene.add(moon, moon.target);

  // ---------------------------------------------------------------- floor, walls, window
  const floorT = drawWood(1024, 1024, { base: "#4a2f1d", planks: 8, seed: 3 });
  floorT.tex.repeat.set(3, 3);
  const floor = mesh(new THREE.PlaneGeometry(8, 8), std("#ffffff", .7, { map: floorT.tex }));
  floor.rotation.x = -Math.PI / 2; floor.castShadow = false;

  const wallMat = std("#2f2a2b", .95);
  const WX = 1.2, WY0 = 1.05, WY1 = 2.45, WZ = -1.6, WT = .12, RH = 3.2;
  box(2.8, RH, WT, wallMat, [-WX - 1.4, RH / 2, WZ]);                  // left of the window
  box(2.8, RH, WT, wallMat, [WX + 1.4, RH / 2, WZ]);                   // right of it
  box(2 * WX, WY0, WT, wallMat, [0, WY0 / 2, WZ]);                     // below
  box(2 * WX, RH - WY1, WT, wallMat, [0, (WY1 + RH) / 2, WZ]);         // above
  box(WT, RH, 6, wallMat, [-3, RH / 2, 1.4]);
  box(WT, RH, 6, wallMat, [3, RH / 2, 1.4]);
  box(6, WT, 6, std("#1d1a1b", 1), [0, RH, 1.4]);

  const frameMat = std("#d6cdbd", .55);
  box(2 * WX + .12, .05, .34, frameMat, [0, WY0, WZ + .1]);           // sill
  box(2 * WX + .12, .06, .16, frameMat, [0, WY1, WZ]);
  box(.06, WY1 - WY0, .16, frameMat, [-WX, (WY0 + WY1) / 2, WZ]);
  box(.06, WY1 - WY0, .16, frameMat, [WX, (WY0 + WY1) / 2, WZ]);
  box(.05, WY1 - WY0, .1, frameMat, [0, (WY0 + WY1) / 2, WZ]);          // mullions
  box(2 * WX, .04, .1, frameMat, [0, 1.95, WZ]);

  const city = drawCity(1024, 512);
  const cityMesh = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.5), new THREE.MeshBasicMaterial({ map: city.tex, toneMapped: false }));
  cityMesh.position.set(0, 1.9, -3.4); scene.add(cityMesh);

  // ---------------------------------------------------------------- desk
  const deskT = drawWood(1024, 512, { base: "#6b4428", planks: 4, seed: 9 });
  const deskMat = std("#ffffff", .5, { map: deskT.tex });
  box(2.9, .05, 1.25, deskMat, [0, DESK_Y - .025, -.35]);
  for (const x of [-1.38, 1.38]) for (const z of [-.92, .2]) box(.06, DESK_Y - .05, .06, std("#3a2516", .6), [x, (DESK_Y - .05) / 2, z]);

  // ---------------------------------------------------------------- the TV on its deck
  const tv = new THREE.Group(); tv.position.set(-.15, DESK_Y, -.55); scene.add(tv);
  box(.8, .09, .5, std("#1b1b1e", .45), [0, .045, 0], tv);
  box(.9, .62, .58, std("#2a2a2e", .5), [0, .40, 0], tv);
  mesh(new THREE.PlaneGeometry(.66, .51), std("#0b0b0d", .3), [-.06, .42, .2905], tv).castShadow = false;
  const screenT = canvasTexture(640, 480);
  const screenMat = new THREE.MeshBasicMaterial({ map: screenT.tex, toneMapped: false });
  const screen = mesh(new THREE.PlaneGeometry(.6, .45), screenMat, [-.06, .42, .291], tv);
  screen.castShadow = false;
  for (const y of [.52, .4]) {
    const k = mesh(new THREE.CylinderGeometry(.026, .026, .02, 20), std("#121214", .4), [.355, y, .3], tv);
    k.rotation.x = Math.PI / 2;
  }
  mesh(new THREE.SphereGeometry(.007, 8, 8), new THREE.MeshBasicMaterial({ color: "#ff5a2a", toneMapped: false }), [.355, .2, .291], tv);
  const clockT = canvasTexture(160, 48);
  mesh(new THREE.PlaneGeometry(.14, .042), new THREE.MeshBasicMaterial({ map: clockT.tex, toneMapped: false }), [.22, .045, .2505], tv).castShadow = false;
  drawClock(clockT);

  // ---------------------------------------------------------------- tapes: one per Work item, stacked
  const shell = std("#151517", .35), shellTop = std("#202024", .45);
  const tapes = content.work.map((item, i) => {
    const label = drawLabel(item, i);
    // +z face is the spine; its label glows a little so it reads in the dark room
    const spine = std("#ffffff", .5, { map: label.tex, emissive: "#ffffff", emissiveMap: label.tex, emissiveIntensity: .35 });
    const mats = [shell, shell, shellTop, shell, spine, shell];
    const t = new THREE.Mesh(new THREE.BoxGeometry(.44, .065, .25), mats);
    t.position.set(.92 + (Math.sin(i * 7.1) * .02), DESK_Y + .0325 + i * .068, -.5);
    t.rotation.y = Math.sin(i * 3.7) * .06;
    t.castShadow = t.receiveShadow = true; scene.add(t);
    t.userData = { kind: "tape", item, rest: t.position.clone(), out: 0 };
    clickables.push(t);
    return t;
  });

  // ---------------------------------------------------------------- the notepad: the Work list
  const noteT = canvasTexture(512, 717);
  let noteRows = drawNotepad(noteT, content.work), noteHover = null;
  // held up, the paper faces away from the lamp, so it carries some light of its own (main.js raises it in moveNote)
  const notepad = mesh(new THREE.PlaneGeometry(.5, .7), std("#ffffff", .95,
    { map: noteT.tex, side: THREE.DoubleSide, emissive: "#ffffff", emissiveMap: noteT.tex, emissiveIntensity: .05 }));
  notepad.rotation.set(-Math.PI / 2, 0, .18);
  notepad.position.set(.42, DESK_Y + .004, -.12);
  notepad.castShadow = false;
  notepad.userData = { kind: "notepad", restPos: notepad.position.clone(), restQuat: notepad.quaternion.clone() };
  clickables.push(notepad);

  // ---------------------------------------------------------------- the desk lamp (a click switches it)
  const lamp = new THREE.Group(); lamp.position.set(-1.05, DESK_Y, -.6); scene.add(lamp);
  const brass = std("#8f6a3a", .35, { metalness: .6 });
  mesh(new THREE.CylinderGeometry(.11, .13, .03, 32), brass, [0, .015, 0], lamp);
  mesh(new THREE.CylinderGeometry(.012, .012, .55, 12), brass, [0, .3, 0], lamp);
  const arm = mesh(new THREE.CylinderGeometry(.01, .01, .24, 12), brass, [.11, .57, 0], lamp); arm.rotation.z = Math.PI / 2;
  const shade = mesh(new THREE.ConeGeometry(.15, .18, 32, 1, true),
    std("#b5452f", .6, { side: THREE.DoubleSide, emissive: "#ff7a3a", emissiveIntensity: .25 }), [.24, .53, 0], lamp);
  shade.rotation.z = -.2;
  const bulbMat = new THREE.MeshBasicMaterial({ color: "#fff1d6", toneMapped: false });
  const bulb = mesh(new THREE.SphereGeometry(.035, 16, 16), bulbMat, [.25, .47, 0], lamp); bulb.castShadow = false;
  const lampLight = new THREE.PointLight("#ffb46b", 4.5, 0, 2);
  lampLight.position.set(.25, .44, 0); lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(1024, 1024); lampLight.shadow.bias = -.003; lampLight.shadow.normalBias = .02; lampLight.shadow.camera.near = .05;
  lamp.add(lampLight);
  for (const m of [shade, bulb]) { m.userData = { kind: "lamp" }; clickables.push(m); }
  let lampOn = true;

  // ---------------------------------------------------------------- a mug (a click is a sip)
  const mug = new THREE.Group(); mug.position.set(-.62, DESK_Y, .08); scene.add(mug);
  const ceramic = std("#e9e4da", .35);
  const cup = mesh(new THREE.CylinderGeometry(.045, .04, .1, 28), ceramic, [0, .05, 0], mug);
  const coffee = mesh(new THREE.CircleGeometry(.041, 28), std("#2a170c", .15), [0, .096, 0], mug); coffee.rotation.x = -Math.PI / 2;
  const handle = mesh(new THREE.TorusGeometry(.027, .008, 8, 20, Math.PI), ceramic, [.045, .05, 0], mug); handle.rotation.z = -Math.PI / 2;
  for (const m of [cup, handle]) { m.userData = { kind: "mug" }; clickables.push(m); }

  screen.userData = { kind: "screen" };
  clickables.push(screen);
  scene.updateMatrixWorld(true);

  // ---------------------------------------------------------------- the TV's picture, and the little animations
  let view = { kind: "home" }, staticUntil = 0, lastDraw = -1, lastTwinkle = 0, lastClock = 0, beaconOn = true, dirty = true;

  return {
    scene, clickables, tapes, notepad, mug,
    tv: {
      group: tv, screen,
      center: screen.getWorldPosition(new THREE.Vector3()),
      size: new THREE.Vector2(.9, .71),          // the casing plus the deck, what a close-up should fit
      get view() { return view; },
      show(next, t, noise = true) { view = next; staticUntil = noise ? t + .28 : 0; dirty = true; },
    },
    lamp: {
      get on() { return lampOn; },
      toggle() { lampOn = !lampOn; lampLight.visible = lampOn; bulbMat.color.set(lampOn ? "#fff1d6" : "#5a4a3a"); },
      light: lampLight,
    },
    note: {
      rowAt(uv) { const y = (1 - uv.y) * noteT.c.height; return noteRows.find(r => y >= r.y0 && y <= r.y1)?.id ?? null; },
      hover(id) { if (id !== noteHover) { noteHover = id; noteRows = drawNotepad(noteT, content.work, id); } },
    },
    update(t) {
      if (t < staticUntil) drawStatic(screenT);
      else if (dirty || t - lastDraw > .25) { drawScreen(screenT, view, content, t); lastDraw = t; dirty = false; }
      screenMat.color.setScalar(.94 + .06 * Math.sin(t * 50) * Math.sin(t * 7.3));   // a faint tube flicker
      if (t - lastTwinkle > .6) { city.twinkle(); lastTwinkle = t; }
      const b = Math.floor(t * 1.2) % 2 === 0; if (b !== beaconOn) { beaconOn = b; city.beacon(b); }
      if (t - lastClock > 10) { drawClock(clockT); lastClock = t; }
    },
  };
}
