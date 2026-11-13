let context: AudioContext | null = null;

/**
 * Must be called from a user gesture. Resolves true only once audio is actually
 * running, so the control never claims sound that the device cannot play.
 */
export async function enableSound(): Promise<boolean> {
  if (typeof window.AudioContext !== "function") {
    return false;
  }
  try {
    context ??= new AudioContext();
    await context.resume();
    return context.state === "running";
  } catch {
    return false;
  }
}

export function disableSound(): void {
  void context?.suspend();
}

/** A short synthesised hammer strike: inharmonic partials plus an impact burst. */
export function playStrike(power: number): void {
  if (!context || context.state !== "running") {
    return;
  }
  const audio = context;
  const now = audio.currentTime;
  const master = audio.createGain();
  master.gain.value = 0.2 * Math.min(1, Math.max(0.2, power));
  master.connect(audio.destination);

  const base = 500 + Math.random() * 90;
  const partials = [
    { ratio: 1, peak: 0.9, decay: 1.5 },
    { ratio: 2.32, peak: 0.55, decay: 1.1 },
    { ratio: 3.86, peak: 0.4, decay: 0.8 },
    { ratio: 5.2, peak: 0.25, decay: 0.5 },
    { ratio: 7.9, peak: 0.15, decay: 0.3 },
  ];
  for (const partial of partials) {
    const oscillator = audio.createOscillator();
    oscillator.frequency.value =
      base * partial.ratio * (1 + (Math.random() - 0.5) * 0.01);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(partial.peak, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + partial.decay);
    oscillator.connect(gain).connect(master);
    oscillator.start(now);
    oscillator.stop(now + partial.decay + 0.05);
  }

  const length = Math.floor(audio.sampleRate * 0.06);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    samples[index] = (Math.random() * 2 - 1) * (1 - index / length) ** 2;
  }
  const noise = audio.createBufferSource();
  noise.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 3200;
  filter.Q.value = 0.8;
  const noiseGain = audio.createGain();
  noiseGain.gain.value = 0.7;
  noise.connect(filter).connect(noiseGain).connect(master);
  noise.start(now);

  window.setTimeout(() => master.disconnect(), 1800);
}
