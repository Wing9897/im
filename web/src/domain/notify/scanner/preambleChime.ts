/**
 * Soft public-broadcast-style preambles before local-notify TTS.
 * Mid/low chime register + layered partials (closer to real PA / station cues).
 * Uses Web Audio oscillators (no audio asset required).
 */

import { sleep } from "../../../utils/sleep";

export const PREAMBLE_CHIME_IDS = [
  "broadcast",
  "station",
  "westminster",
  "school",
  "airport",
  "store",
  "door-chime",
  "none",
] as const;

export type PreambleChimeId = (typeof PREAMBLE_CHIME_IDS)[number];

export const DEFAULT_PREAMBLE_CHIME_ID: PreambleChimeId = "broadcast";

type Tone = {
  freq: number;
  start: number;
  dur: number;
  /** Relative loudness before master gain (typical 0.12–0.22). */
  peak?: number;
};

type ChimePreset = {
  tones: ReadonlyArray<Tone>;
  totalMs: number;
};

/** Equal temperament (A4 = 440) — keep mostly G3–E5 for a soft PA register. */
const N = {
  E3: 164.81,
  G3: 196.0,
  A3: 220.0,
  B3: 246.94,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  Fs4: 369.99,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
} as const;

function melody(
  notes: ReadonlyArray<{
    freq: number;
    beat: number;
    beats?: number;
    peak?: number;
  }>,
  beatSec: number,
  trailMs = 700,
): ChimePreset {
  const tones: Tone[] = notes.map((n) => ({
    freq: n.freq,
    start: n.beat * beatSec,
    // Leave a little gap so notes breathe like real chimes.
    dur: (n.beats ?? 1) * beatSec * 0.82,
    peak: n.peak,
  }));
  const end = Math.max(...tones.map((t) => t.start + t.dur));
  return { tones, totalMs: Math.round(end * 1000) + trailMs };
}

const PRESETS: Record<Exclude<PreambleChimeId, "none">, ChimePreset> = {
  // Soft rising PA open (mid register, ~5s).
  broadcast: melody(
    [
      { freq: N.C4, beat: 0, beats: 1.1, peak: 0.16 },
      { freq: N.E4, beat: 1.1, beats: 1.1, peak: 0.17 },
      { freq: N.G4, beat: 2.2, beats: 1.1, peak: 0.18 },
      { freq: N.C5, beat: 3.4, beats: 1.6, peak: 0.19 },
      { freq: N.G4, beat: 5.2, beats: 1.1, peak: 0.15 },
      { freq: N.E4, beat: 6.3, beats: 1.1, peak: 0.14 },
      { freq: N.C4, beat: 7.4, beats: 2.4, peak: 0.16 },
    ],
    0.48,
  ),

  // Metro / station ascending steps (~5s).
  station: melody(
    [
      { freq: N.G3, beat: 0, beats: 0.85, peak: 0.15 },
      { freq: N.C4, beat: 0.95, beats: 0.85, peak: 0.16 },
      { freq: N.E4, beat: 1.9, beats: 0.85, peak: 0.17 },
      { freq: N.G4, beat: 2.85, beats: 1.35, peak: 0.18 },
      { freq: N.E4, beat: 4.4, beats: 1, peak: 0.15 },
      { freq: N.C4, beat: 5.5, beats: 1, peak: 0.14 },
      { freq: N.G3, beat: 6.6, beats: 2.4, peak: 0.14 },
    ],
    0.46,
  ),

  // Westminster quarters, one octave down for warmth (~6s).
  westminster: melody(
    [
      { freq: N.E4, beat: 0, beats: 1.1, peak: 0.16 },
      { freq: N.C4, beat: 1.15, beats: 1.1, peak: 0.15 },
      { freq: N.D4, beat: 2.3, beats: 1.1, peak: 0.15 },
      { freq: N.G3, beat: 3.45, beats: 2.2, peak: 0.16 },
      { freq: N.G3, beat: 5.9, beats: 1.1, peak: 0.15 },
      { freq: N.D4, beat: 7.05, beats: 1.1, peak: 0.15 },
      { freq: N.E4, beat: 8.2, beats: 1.1, peak: 0.16 },
      { freq: N.C4, beat: 9.35, beats: 2.6, peak: 0.16 },
    ],
    0.5,
  ),

  // School / campus motif (~5.5s).
  school: melody(
    [
      { freq: N.C4, beat: 0, beats: 1.1, peak: 0.15 },
      { freq: N.C4, beat: 1.2, beats: 1.1, peak: 0.14 },
      { freq: N.G3, beat: 2.4, beats: 1.1, peak: 0.14 },
      { freq: N.G3, beat: 3.6, beats: 1.1, peak: 0.14 },
      { freq: N.A3, beat: 4.8, beats: 1.1, peak: 0.15 },
      { freq: N.A3, beat: 6, beats: 1.1, peak: 0.15 },
      { freq: N.G3, beat: 7.2, beats: 2.6, peak: 0.16 },
    ],
    0.46,
  ),

  // Airport attention two-tone (~5s).
  airport: melody(
    [
      { freq: N.A3, beat: 0, beats: 1.35, peak: 0.15 },
      { freq: N.E4, beat: 1.5, beats: 1.35, peak: 0.17 },
      { freq: N.A3, beat: 3.15, beats: 1.35, peak: 0.15 },
      { freq: N.E4, beat: 4.65, beats: 1.35, peak: 0.17 },
      { freq: N.Fs4, beat: 6.25, beats: 1.15, peak: 0.15 },
      { freq: N.E4, beat: 7.5, beats: 2.4, peak: 0.16 },
    ],
    0.44,
  ),

  // Soft retail / mall announcement (~5.5s).
  store: melody(
    [
      { freq: N.E3, beat: 0, beats: 1.5, peak: 0.13 },
      { freq: N.G3, beat: 1.3, beats: 1.5, peak: 0.14 },
      { freq: N.B3, beat: 2.6, beats: 1.5, peak: 0.14 },
      { freq: N.E4, beat: 3.9, beats: 2.1, peak: 0.15 },
      { freq: N.B3, beat: 5.9, beats: 1.5, peak: 0.13 },
      { freq: N.G3, beat: 7.2, beats: 1.5, peak: 0.12 },
      { freq: N.E3, beat: 8.5, beats: 2.8, peak: 0.13 },
    ],
    0.44,
  ),

  // Classic ding-dong then settle (~5s).
  "door-chime": melody(
    [
      { freq: N.E4, beat: 0, beats: 1.7, peak: 0.17 },
      { freq: N.C4, beat: 1.5, beats: 2.1, peak: 0.16 },
      { freq: N.E4, beat: 3.9, beats: 1.5, peak: 0.15 },
      { freq: N.C4, beat: 5.3, beats: 1.9, peak: 0.14 },
      { freq: N.G3, beat: 7.2, beats: 2.6, peak: 0.13 },
    ],
    0.46,
  ),
};

const CHIME_ID_SET = new Set<string>(PREAMBLE_CHIME_IDS);

/** Keep audible without harsh clipping once partials are layered. */
const PREAMBLE_MASTER_GAIN = 1.85;
const PREAMBLE_PEAK_CAP = 0.55;

/** Normalize unknown storage values to a known chime id. */
export function sanitizePreambleChimeId(value: unknown): PreambleChimeId {
  if (typeof value !== "string") {
    return DEFAULT_PREAMBLE_CHIME_ID;
  }
  if (CHIME_ID_SET.has(value)) {
    return value as PreambleChimeId;
  }
  return DEFAULT_PREAMBLE_CHIME_ID;
}

/** Soft bell-like voice: warm fundamental + quiet overtone + gentle body. */
function scheduleSoftChime(
  ctx: AudioContext,
  destination: AudioNode,
  tone: Tone,
  now: number,
): void {
  const peak = Math.min(
    PREAMBLE_PEAK_CAP,
    (tone.peak ?? 0.16) * PREAMBLE_MASTER_GAIN,
  );
  const t0 = now + tone.start;
  const attack = Math.min(0.14, Math.max(0.08, tone.dur * 0.22));
  const releaseStart = t0 + Math.max(attack + 0.05, tone.dur * 0.35);

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  master.gain.exponentialRampToValueAtTime(peak * 0.55, releaseStart);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.dur);
  master.connect(destination);

  const partials: Array<{ freq: number; type: OscillatorType; level: number }> =
    [
      { freq: tone.freq, type: "sine", level: 1 },
      { freq: tone.freq * 2, type: "sine", level: 0.16 },
      { freq: tone.freq, type: "triangle", level: 0.1 },
    ];

  for (const partial of partials) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = partial.type;
    osc.frequency.value = partial.freq;
    gain.gain.value = partial.level;
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + tone.dur + 0.05);
  }
}

/** Play the local-notify preamble; no-ops when AudioContext is unavailable or id is none. */
export async function playNotifyPreamble(
  chimeId: PreambleChimeId = DEFAULT_PREAMBLE_CHIME_ID,
): Promise<void> {
  if (typeof window === "undefined" || chimeId === "none") return;

  const preset = PRESETS[chimeId];
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return;

  const ctx = new AudioCtx();
  try {
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    const now = ctx.currentTime;
    for (const tone of preset.tones) {
      scheduleSoftChime(ctx, ctx.destination, tone, now);
    }
    await sleep(preset.totalMs);
  } catch {
    // Best-effort — TTS should still run if the chime fails.
  } finally {
    try {
      await ctx.close();
    } catch {
      // ignore
    }
  }
}
