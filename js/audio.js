/* =====================================================================
   Sound: everything is synthesized live with Web Audio. There are no audio files.
   Wind (filtered noise) + low drone + interface beeps
   ===================================================================== */
window.Sound = (function () {
  let ctx, master, wind, windF, drone = [], on = true;
  try { on = localStorage.getItem('mars-sound') !== 'off'; } catch (e) {}

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = on ? .7 : 0; master.connect(ctx.destination);
    // wind
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b = 0; for (let i = 0; i < len; i++) { b = .985 * b + .015 * (Math.random() * 2 - 1); d[i] = b * 6; }
    wind = ctx.createBufferSource(); wind.buffer = buf; wind.loop = true;
    windF = ctx.createBiquadFilter(); windF.type = 'bandpass'; windF.frequency.value = 420; windF.Q.value = .6;
    const wg = ctx.createGain(); wg.gain.value = .22;
    wind.connect(windF).connect(wg).connect(master); wind.start();
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .07; lg.gain.value = 220; lfo.connect(lg).connect(windF.frequency); lfo.start();
    // drone: stacked fifths
    for (const [f, g] of [[55, .05], [82.4, .03], [110.3, .018]]) {
      const o = ctx.createOscillator(), gg = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; gg.gain.value = g;
      const tr = ctx.createOscillator(), tg = ctx.createGain(); tr.frequency.value = .05 + Math.random() * .05; tg.gain.value = g * .6; tr.connect(tg).connect(gg.gain); tr.start();
      o.connect(gg).connect(master); o.start(); drone.push(gg);
    }
  }
  function tone(freq, dur = .12, type = 'triangle', vol = .12, when = 0) {
    if (!ctx || !on) return;
    const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
  }
  return {
    init,
    get on() { return on; },
    toggle() { on = !on; try { localStorage.setItem('mars-sound', on ? 'on' : 'off'); } catch (e) {}
      if (master) master.gain.setTargetAtTime(on ? .7 : 0, ctx.currentTime, .1); return on; },
    click() { tone(660, .06, 'square', .04); },
    plus() { tone(880, .08, 'triangle', .07); },
    minus() { tone(440, .08, 'triangle', .07); },
    alert() { tone(740, .18, 'square', .06); tone(554, .25, 'square', .06, .2); },
    good() { tone(523, .12); tone(659, .12, 'triangle', .1, .1); tone(784, .2, 'triangle', .1, .2); },
    bad() { tone(220, .3, 'sawtooth', .05); tone(196, .4, 'sawtooth', .05, .15); },
    beep() { tone(1320, .05, 'sine', .05); },
    storm(x) { if (windF && ctx) { windF.Q.setTargetAtTime(.6 - x * .3, ctx.currentTime, 1); } if (ctx) master && wind && (wind.playbackRate.value = 1 + x * .6); },
    whoosh() {
      if (!ctx || !on) return;
      const t = ctx.currentTime, len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len);
      const s = ctx.createBufferSource(); s.buffer = buf; const f = ctx.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(2400, t + 1.2); f.frequency.exponentialRampToValueAtTime(300, t + 2);
      const g = ctx.createGain(); g.gain.value = .25; s.connect(f).connect(g).connect(master); s.start(t);
    }
  };
})();
