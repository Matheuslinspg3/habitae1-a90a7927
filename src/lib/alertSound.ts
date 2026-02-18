/**
 * Plays a notification alert sound using the Web Audio API.
 * Handles browser autoplay restrictions by resuming suspended AudioContext.
 * Uses a pleasant two-tone chime instead of a siren.
 */

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return sharedCtx;
}

// Pre-warm AudioContext on first user interaction so future plays work
function warmUpAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
  } catch {
    // ignore
  }
}

// Attach listeners once to unlock audio on first user gesture
if (typeof window !== "undefined") {
  const events = ["click", "touchstart", "keydown"];
  const unlock = () => {
    warmUpAudio();
    events.forEach((e) => document.removeEventListener(e, unlock, true));
  };
  events.forEach((e) => document.addEventListener(e, unlock, { once: true, capture: true }));
}

export async function playAlertSound(volume = 0.7) {
  try {
    const ctx = getAudioContext();

    // Resume if suspended (autoplay policy)
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);

    // Pleasant notification chime: two ascending tones
    const tones = [
      { freq: 587.33, start: 0, duration: 0.15 },     // D5
      { freq: 880, start: 0.18, duration: 0.25 },      // A5
    ];

    const totalDuration = 0.5;

    tones.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const toneGain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

      // Envelope: quick attack, sustain, smooth release
      toneGain.gain.setValueAtTime(0, ctx.currentTime + start);
      toneGain.gain.linearRampToValueAtTime(volume, ctx.currentTime + start + 0.02);
      toneGain.gain.setValueAtTime(volume, ctx.currentTime + start + duration - 0.08);
      toneGain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + duration);

      osc.connect(toneGain);
      toneGain.connect(ctx.destination);

      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);

      osc.onended = () => {
        osc.disconnect();
        toneGain.disconnect();
      };
    });

    // Cleanup gain after total duration
    setTimeout(() => {
      gainNode.disconnect();
    }, totalDuration * 1000 + 100);
  } catch (e) {
    console.warn("Alert sound not supported:", e);
  }
}
