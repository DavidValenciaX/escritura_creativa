const SAMPLE_URL = "/audio/typewriter-key.wav";
const VOLUME = 0.32;
let sampleData: Promise<ArrayBuffer> | undefined;

function loadSample() {
  sampleData ??= fetch(SAMPLE_URL)
    .then((response) => {
      if (!response.ok) throw new Error("Typewriter recording unavailable");
      return response.arrayBuffer();
    })
    .catch((error: unknown) => {
      sampleData = undefined;
      throw error;
    });
  return sampleData;
}

// Fetch ahead of the first keystroke without creating or starting an AudioContext.
export function preloadTypewriterSound() {
  void loadSample().catch(() => {});
}

// Real Hermes Precisa 305 recording; see public/audio/README.md for provenance.
export class TypewriterAudio {
  private context: AudioContext;
  private buffer: AudioBuffer | null = null;
  private ready: Promise<void>;
  private output: GainNode;
  private enabled = true;
  private disposed = false;

  constructor() {
    this.context = new AudioContext();
    this.output = this.context.createGain();
    this.output.gain.value = VOLUME;
    this.output.connect(this.context.destination);
    this.ready = loadSample()
      // decodeAudioData consumes its ArrayBuffer, so keep the cached original.
      .then((data) =>
        this.disposed ? null : this.context.decodeAudioData(data.slice(0)),
      )
      .then((buffer) => {
        if (!this.disposed) this.buffer = buffer;
      })
      .catch(() => {});
  }

  unlock() {
    if (this.disposed || this.context.state !== "suspended") return;
    void this.context.resume().catch(() => {});
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!this.disposed)
      this.output.gain.setValueAtTime(
        enabled ? VOLUME : 0,
        this.context.currentTime,
      );
  }

  play() {
    if (this.disposed || !this.enabled) return;
    const requestedAt = performance.now();
    const strike = () => {
      // Never queue stale keystrokes if the browser takes time to allow audio.
      if (
        this.disposed ||
        !this.enabled ||
        !this.buffer ||
        this.context.state !== "running" ||
        performance.now() - requestedAt > 100
      )
        return;
      try {
        const source = this.context.createBufferSource();
        source.buffer = this.buffer;
        source.connect(this.output);
        source.onended = () => source.disconnect();
        source.start();
      } catch {
        // Audio is optional; it must never interrupt writing.
      }
    };
    if (this.buffer && this.context.state === "running") strike();
    else
      void Promise.all([
        this.ready,
        this.context.state === "running" ? undefined : this.context.resume(),
      ])
        .then(strike)
        .catch(() => {});
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.buffer = null;
    this.output.disconnect();
    void this.context.close().catch(() => {});
  }
}
