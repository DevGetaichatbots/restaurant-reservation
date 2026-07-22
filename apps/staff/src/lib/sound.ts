import { useDeviceSettingsStore } from "./device-settings-store";

let sharedContext: AudioContext | null = null;

/** A short two-tone chime, synthesized rather than shipped as an audio
 *  file — one less asset to get wrong, and it respects the device's own
 *  volume/mute setting (proposal §11's /settings spec) rather than the
 *  system media volume alone. */
export function playAlertSound(): void {
  const { soundEnabled, volume } = useDeviceSettingsStore.getState();
  if (!soundEnabled || typeof window === "undefined") return;

  try {
    sharedContext ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = sharedContext;
    if (ctx.state === "suspended") void ctx.resume();

    const now = ctx.currentTime;
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.14;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume * 0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  } catch {
    // Autoplay policies can block sound before the first user tap — a
    // silent no-op is the right failure mode, not a console error every load.
  }
}
