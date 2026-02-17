/**
 * Plays a civil-defense–style alert siren using the Web Audio API.
 * Two-tone alternating pattern (common in emergency sirens).
 * No external files needed — pure synthesized audio.
 */
export function playAlertSound(volume = 0.7) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.connect(ctx.destination);

    // Two-tone siren: alternates between two frequencies
    const toneA = 880;  // Hz — high tone
    const toneB = 660;  // Hz — low tone
    const cycleDuration = 0.25; // seconds per tone
    const totalCycles = 3;
    const totalDuration = totalCycles * 2 * cycleDuration; // 1.5s total

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.connect(gainNode);

    // Schedule frequency alternation
    for (let i = 0; i < totalCycles * 2; i++) {
      const time = ctx.currentTime + i * cycleDuration;
      const freq = i % 2 === 0 ? toneA : toneB;
      osc.frequency.setValueAtTime(freq, time);
    }

    // Fade out at the end for a clean finish
    gainNode.gain.setValueAtTime(volume, ctx.currentTime + totalDuration - 0.15);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + totalDuration);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + totalDuration);

    // Cleanup
    osc.onended = () => {
      osc.disconnect();
      gainNode.disconnect();
      ctx.close();
    };
  } catch (e) {
    // Silently fail if AudioContext not available
    console.warn("Alert sound not supported:", e);
  }
}