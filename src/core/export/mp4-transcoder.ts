import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';

let ffmpegPromise: Promise<FFmpeg> | null = null;

async function getTranscoder() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({ coreURL, wasmURL });
      return ffmpeg;
    })();
  }

  return await ffmpegPromise;
}

export async function transcodeWebmToMp4(
  blob: Blob,
  onProgress?: (progress: number) => void,
) {
  const ffmpeg = await getTranscoder();
  const inputName = `input-${Date.now()}.webm`;
  const outputName = `output-${Date.now()}.mp4`;

  const handleProgress = ({ progress }: { progress: number }) => {
    onProgress?.(progress);
  };

  ffmpeg.on('progress', handleProgress);

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(blob));
    await ffmpeg.exec([
      '-i',
      inputName,
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      outputName,
    ]);

    const data = await ffmpeg.readFile(outputName);
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new Blob([arrayBuffer], { type: 'video/mp4' });
  } finally {
    ffmpeg.off('progress', handleProgress);
    await Promise.allSettled([ffmpeg.deleteFile(inputName), ffmpeg.deleteFile(outputName)]);
  }
}
