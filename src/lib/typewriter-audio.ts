// One reusable buffer/context per editor, created only after user interaction.
export class TypewriterAudio {
  private context: AudioContext;
  private buffer: AudioBuffer;
  private output: GainNode;
  private enabled = true;
  private disposed = false;

  constructor() {
    this.context = new AudioContext();
    this.output = this.context.createGain();
    this.output.connect(this.context.destination);
    this.buffer = this.context.createBuffer(
      1,
      Math.ceil(this.context.sampleRate * 0.095),
      this.context.sampleRate,
    );
    const samples = this.buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      const t = i / this.context.sampleRate;
      // A sharp strike, metallic body, then the softer return of the mechanism.
      const strike = (Math.random() * 2 - 1) * Math.exp(-t * 210);
      const metal =
        (Math.sin(2 * Math.PI * 1850 * t) +
          0.45 * Math.sin(2 * Math.PI * 3270 * t)) *
        Math.exp(-t * 100);
      const release =
        t > 0.028 ? (Math.random() * 2 - 1) * Math.exp(-(t - 0.028) * 160) : 0;
      samples[i] = (strike * 0.6 + metal * 0.3 + release * 0.22) * 0.16;
    }
  }

  unlock() {
    if (this.disposed || this.context.state !== "suspended") return;
    void this.context.resume().catch(() => {});
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!this.disposed)
      this.output.gain.setValueAtTime(
        enabled ? 1 : 0,
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
        this.context.state !== "running" ||
        performance.now() - requestedAt > 100
      )
        return;
      try {
        const source = this.context.createBufferSource();
        source.buffer = this.buffer;
        source.playbackRate.value = 0.94 + Math.random() * 0.12;
        source.connect(this.output);
        source.onended = () => source.disconnect();
        source.start();
      } catch {
        // Audio is optional; it must never interrupt writing.
      }
    };
    if (this.context.state === "running") strike();
    else
      void this.context
        .resume()
        .then(strike)
        .catch(() => {});
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.output.disconnect();
    void this.context.close().catch(() => {});
  }
}
