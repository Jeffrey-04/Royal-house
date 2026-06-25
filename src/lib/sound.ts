/**
 * Notification sonore.
 * Utilise le fichier WAV bundlé par Vite,
 * sinon génère un bip court via Web Audio API.
 */

import notificationUrl from "../assets/sounds/notification.wav?url";

let audio: HTMLAudioElement | null = null;

if (typeof window !== "undefined") {
  const a = new Audio(notificationUrl);
  a.preload = "auto";
  a.volume = 0.6;
  a.addEventListener("canplaythrough", () => { audio = a; }, { once: true });
  a.addEventListener("error", () => { audio = null; });
  a.load();
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
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(() => beep());
  } else {
    beep();
  }
}
