import { createWorkerPool } from 'flashraw/worker';
import UTIF from 'utif';

const pool = createWorkerPool({
  size: 1,
  workerUrl: new URL('./flashraw-worker.js', import.meta.url),
});

export async function decodeRaw(file) {
  const frame = await pool.decode(file, {
    output: 'rgba8',
    backend: 'auto',
    demosaic: 'auto',
    colorSpace: 'srgb',
    limits: { maxSamples: 640_000_000 },
  });
  if (frame.width * frame.height > 160_000_000) {
    throw new Error('Foto RAW melebihi batas 160 megapiksel.');
  }
  const pixels = frame.data instanceof Uint8ClampedArray
    ? frame.data
    : new Uint8ClampedArray(frame.data);
  const bitmap = await createImageBitmap(new ImageData(pixels, frame.width, frame.height));
  return bitmap;
}

export async function decodeTiff(file) {
  const buffer = await file.arrayBuffer();
  const ifds = UTIF.decode(buffer);
  if (!ifds.length) throw new Error('File TIFF tidak memiliki halaman gambar.');

  const image = ifds[0];
  UTIF.decodeImage(buffer, image);
  if (!image.width || !image.height || !image.data) {
    throw new Error('Data piksel TIFF tidak dapat dibaca.');
  }

  const source = UTIF.toRGBA8(image);
  const orientation = Number(image.t274?.[0] ?? image.t274 ?? 1);
  const swapsAxes = orientation >= 5 && orientation <= 8;
  const width = swapsAxes ? image.height : image.width;
  const height = swapsAxes ? image.width : image.height;
  let pixels = new Uint8ClampedArray(source.buffer, source.byteOffset, source.byteLength);

  if (orientation >= 2 && orientation <= 8) {
    pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        let targetX, targetY;
        switch (orientation) {
          case 2: targetX = image.width - 1 - x; targetY = y; break;
          case 3: targetX = image.width - 1 - x; targetY = image.height - 1 - y; break;
          case 4: targetX = x; targetY = image.height - 1 - y; break;
          case 5: targetX = y; targetY = x; break;
          case 6: targetX = image.height - 1 - y; targetY = x; break;
          case 7: targetX = image.height - 1 - y; targetY = image.width - 1 - x; break;
          case 8: targetX = y; targetY = image.width - 1 - x; break;
        }
        const sourceIndex = (y * image.width + x) * 4;
        const targetIndex = (targetY * width + targetX) * 4;
        pixels[targetIndex] = source[sourceIndex];
        pixels[targetIndex + 1] = source[sourceIndex + 1];
        pixels[targetIndex + 2] = source[sourceIndex + 2];
        pixels[targetIndex + 3] = source[sourceIndex + 3];
      }
    }
  }

  return createImageBitmap(new ImageData(pixels, width, height));
}

export function closeRawDecoder() {
  pool.terminate();
}
