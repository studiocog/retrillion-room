// Small synthesized sounds, so there are no audio files to fetch. Browsers only allow audio after a user gesture,
// which is one reason the room has a "Click to enter" gate: start() runs on that click.
export function createSound() {
  let ctx = null, master = null, noise = null, on = false;

  function start() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = .5; master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * .5, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    on = true;
  }

  function burst(dur, freq, q, gain) {
    if (!on) return;
    const t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise; f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    src.connect(f).connect(g).connect(master); src.start(t); src.stop(t + dur);
  }

  function tone(from, to, dur, gain) {
    if (!on) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur);
  }

  return {
    start,
    get on() { return on; },
    set on(v) { on = !!v && !!ctx; if (on && ctx.state === "suspended") ctx.resume(); },
    click: () => burst(.03, 4000, 2, .35),
    static: () => burst(.28, 3000, .4, .22),
    thunk: () => { tone(140, 50, .15, .6); burst(.05, 2500, 1, .3); },   // a tape going in
    sip: () => burst(.22, 700, 3, .25),
    lamp: () => { burst(.02, 6000, 4, .5); tone(900, 700, .03, .15); },
    rustle: () => { burst(.35, 5000, .7, .12); setTimeout(() => burst(.25, 4200, .7, .08), 120); },
    // a short tape-warbly arpeggio from the cassette player
    tune() {
      if (!on) return;
      burst(.05, 2500, 1, .25);
      [392, 494, 587, 740, 587, 494].forEach((f, i) => {
        const t = ctx.currentTime + .12 + i * .16, o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
        o.type = "triangle"; o.frequency.value = f; lfo.frequency.value = 5; lg.gain.value = f * .006;
        lfo.connect(lg).connect(o.frequency);
        g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.18, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + .3);
        o.connect(g).connect(master); o.start(t); lfo.start(t); o.stop(t + .32); lfo.stop(t + .32);
      });
    },
  };
}
