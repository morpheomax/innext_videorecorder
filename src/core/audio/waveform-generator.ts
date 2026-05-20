const waveformCache = new Map<string, number[]>();

export async function generateWaveform(blob: Blob, bars = 60) {
  const safeBars = Math.max(12, Math.min(240, Math.floor(bars)));
  const cacheKey = `${blob.size}-${blob.type}-${safeBars}`;
  const cached = waveformCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const AudioContextConstructor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioContextConstructor();

  try {
    const buffer = await audioContext.decodeAudioData(await blob.arrayBuffer());
    const channelData = buffer.getChannelData(0);
    const samplesPerBar = Math.max(1, Math.floor(channelData.length / safeBars));
    const values: number[] = [];

    for (let index = 0; index < safeBars; index += 1) {
      const start = index * samplesPerBar;
      const end = Math.min(channelData.length, start + samplesPerBar);
      let peak = 0;

      for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
        peak = Math.max(peak, Math.abs(channelData[sampleIndex] ?? 0));
      }

      values.push(peak);
    }

    const max = Math.max(...values, 0.01);
    const normalized = values.map((value) => value / max);
    waveformCache.set(cacheKey, normalized);
    return normalized;
  } finally {
    void audioContext.close();
  }
}
