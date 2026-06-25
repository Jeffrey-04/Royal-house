/**
 * Notification sonore — initialisation paresseuse (évite TDZ/SSR Rollup).
 * Utilise le fichier WAV bundlé si disponible, sinon bip Web Audio API.
 */

import notificationUrl from "../assets/sounds/notification.wav?url";

let audio: HTMLAudioElement | null | undefined = undefined; // undefined = non initialisé

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (audio !== undefined) return audio;

  const a = new Audio(notificationUrl);
  a.preload = "auto";
  a.volume = 0.6;
  // Marque comme prêt ou indisponible de façon synchrone
  if (a.readyState >= 3) {
    audio = a;
  } else {
    audio = null; // utilisera beep en attendant
    a.addEventListener("canplaythrough", () => { audio = a; }, { once: true });
    a.addEventListener("error", () => { audio = null; }, { once: true });
    a.load();
  }
  return audio;
}

function beep() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1100, t + 0.08);
    osc.frequency.setValueAtTime(880, t + 0.16);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.start(t);
    osc.stop(t + 0.45);
  } catch { /* Web Audio non dispo (SSR ou politique navigateur) */ }
}

export function playNotificationSound() {
  if (typeof window === "undefined") return;
  const a = getAudio();
  if (a) {
    a.currentTime = 0;
    a.play().catch(() => beep());
  } else {
    beep();
  }
}
