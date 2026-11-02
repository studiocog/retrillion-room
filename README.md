# Room starter

A personal site that is a small 3D room: a TV, a stack of tapes, a notepad, a desk lamp, a mug and a city at night.
It uses the same techniques found when reverse-engineering felixrieseberg.com (see `../felixrieseberg-com/REPORT.md`),
with original content and design and no model or image files.

## Credits

3D models from [Poly Haven](https://polyhaven.com/models) (CC0): painted wooden table, television 02, industrial pipe lamp,
potted plant 02, portable cassette player, round spectacles, stationery supplies, hanging picture frame 02, alarm clock 01.
They were compressed for the web with `gltf-transform optimize --compress meshopt` into `models/*.glb`.

## Run it

```bash
node serve.mjs
```

Then open http://localhost:5174. No install step: three.js 0.169 comes from jsDelivr through the import map in `index.html`.
Any static host works for deploying it (Cloudflare Pages, Netlify, GitHub Pages).

## How it works

| Piece | File | What it does |
|---|---|---|
| Content | `index.html` (`main.flat`) | The real content as plain HTML: the no-WebGL site, what search engines and screen readers get, and what the room reads. **Edit your name, About and Work here.** |
| Gate | `index.html` inline script | Picks room or plain page before first paint (WebGL 2 check, `?view=flat`), runs the loading bar, falls back to the plain page after 20 s if the room never comes. |
| Reader | `src/content.js` | Turns the HTML into `{ name, tagline, about[], work[] }`. Each `<li>` in `#work` becomes a tape (`data-id`, `data-years`, `data-color`). |
| Pictures | `src/textures.js` | Draws everything into canvas textures: the TV screen (home / about / tape / no signal), tape spines, the notepad, the city, wood, the deck clock. |
| Room | `src/room.js` | Builds the room from primitives, lights it (lamp with shadows, cool window light, warm fill), and exposes `tv`, `tapes`, `notepad`, `lamp`, `mug`. |
| Runtime | `src/main.js` | Renderer, bloom, camera views fitted to the screen's shape, hash routing, hover/click raycasting, keyboard, Lo-fi mode, the frame loop. |
| Sound | `src/sound.js` | Synthesized clicks, static, tape thunk, sip, lamp switch: no audio files. Starts on the "Click to enter" click, which browsers require. |

Routes: `#home`, `#about` (TV close-up), `#work` (notepad held up), `#work/<id>` (that tape playing).
Keys: `A` about, `W` work, `1–9` tapes, `Esc` back.

## Make it yours

1. Change the text in `index.html`. Add or remove `<li>`s in `#work`; the tapes and notepad follow.
2. Colours: each tape's `data-color`; the TV's amber is `AMBER` in `textures.js`; the page colours are tokens at the top of `style.css`.
3. Props: add a mesh in `room.js`, give it `userData.kind`, push it to `clickables`, and handle that kind in `main.js`'s click handler.

## Going further (what makes the reference site look photoreal)

- **Real models.** Model the room in Blender, export GLB with meshopt compression (`gltfpack -cc`), and load it with
  `GLTFLoader` + `MeshoptDecoder`. Keep the object names `room.js` exposes so `main.js` doesn't change.
- **Baked lighting.** Bake light and shadow into the textures in Blender (Cycles → Bake). Most of the realism comes from this,
  and it is cheaper to render than live shadows.
- **AVIF textures**, about a third of the size of JPEG, plus small placeholders for things the first view doesn't show.
- **A byte-accurate loading bar** once there are real files to download (`THREE.LoadingManager.onProgress`).
- **A CMS.** Render the same `main.flat` markup from Ghost, Astro or Eleventy templates; `content.js` doesn't care where it came from.
