/* ============================================================
   SOUND — synthesized in-browser (WebAudio), no audio files.
   Duolingo-flavoured: bright bubbly correct, soft buzz wrong,
   pop on tap, whoosh on flip, fanfare on complete.
   ============================================================ */
const Sound = (() => {
  let ctx;
  let muted = false;

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // single tone helper
  function tone(freq, start, dur, type = "sine", gain = 0.25, glideTo = null) {
    const a = ac();
    const t0 = a.currentTime + start;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  const play = (fn) => { if (!muted) try { fn(); } catch (e) {} };

  return {
    toggleMute() { muted = !muted; return muted; },
    unlock() { ac(); },

    tap()  { play(() => tone(520, 0, 0.09, "triangle", 0.18, 660)); },

    flip() { play(() => tone(300, 0, 0.16, "sine", 0.14, 620)); },

    // bright rising two-note "ding" — the happy correct
    correct() {
      play(() => {
        tone(660,  0.00, 0.12, "triangle", 0.22);
        tone(880,  0.09, 0.16, "triangle", 0.24);
        tone(1320, 0.09, 0.20, "sine",     0.10);
      });
    },

    // soft low "eh-eh" — gentle, not harsh
    wrong() {
      play(() => {
        tone(196, 0.00, 0.16, "sawtooth", 0.14, 165);
        tone(155, 0.14, 0.20, "sawtooth", 0.14, 130);
      });
    },

    combo(n) {
      play(() => {
        const base = 660 + Math.min(n, 8) * 60;
        tone(base, 0, 0.10, "triangle", 0.20);
        tone(base * 1.5, 0.07, 0.14, "triangle", 0.16);
      });
    },

    // little ascending fanfare
    finish() {
      play(() => {
        const notes = [523, 659, 784, 1047]; // C E G C
        notes.forEach((f, i) => tone(f, i * 0.12, 0.28, "triangle", 0.22));
        tone(1568, 0.48, 0.4, "sine", 0.12);
      });
    },
  };
})();

window.Sound = Sound;
