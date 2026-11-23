'use strict';

const { parentPort } = require('node:worker_threads');
const fs = require('node:fs');
const { pipeline } = require('node:stream/promises');
const sharp = require('sharp');

const bands = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'];
const bandHue = [0, 30, 60, 120, 180, 220, 275, 325];
const clamp = (value, min, max, fallback = 0) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;

function cleanCurve(source) {
  const points = Array.isArray(source) ? source.map((point, index) => typeof point === 'number'
    ? { x: index / Math.max(1, source.length - 1), y: point }
    : { x: Number(point?.x), y: Number(point?.y) })
    .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)) : [];
  const inner = points.filter(point => point.x > .005 && point.x < .995)
    .map(point => ({ x: clamp(point.x, .01, .99), y: clamp(point.y, 0, 1) }))
    .sort((a, b) => a.x - b.x);
  const accepted = [];
  for (const point of inner) if (accepted.length < 8 && point.x - (accepted.at(-1)?.x ?? 0) >= .01) accepted.push(point);
  return [{ x: 0, y: 0 }, ...accepted, { x: 1, y: 1 }];
}

function cleanSettings(input = {}) {
  const limits = {
    temperature: [-100, 100], tint: [-100, 100], hue: [-180, 180], contrast: [-100, 100],
    brightness: [-100, 100], exposure: [-100, 100], highlights: [-100, 100], shadows: [-100, 100],
    whites: [-100, 100], blacks: [-100, 100], texture: [-100, 100], clarity: [-100, 100],
    saturation: [-100, 100], vignette: [-100, 100], vignetteMidpoint: [0, 100],
    vignetteRoundness: [-100, 100], vignetteFeather: [1, 100],
  };
  const settings = {};
  for (const [key, [min, max]] of Object.entries(limits)) {
    settings[key] = clamp(input[key], min, max, key === 'vignetteMidpoint' ? 45 : key === 'vignetteFeather' ? 70 : 0);
  }
  const curves = input.curves || {};
  settings.curves = Object.fromEntries(['master', 'red', 'green', 'blue'].map(channel => [
    channel, cleanCurve(curves[channel] || (channel === 'master' ? input.curve : null)),
  ]));
  settings.hsl = Object.fromEntries(bands.map(band => [band, {
    h: clamp(input.hsl?.[band]?.h, -100, 100),
    s: clamp(input.hsl?.[band]?.s, -100, 100),
    l: clamp(input.hsl?.[band]?.l, -100, 100),
  }]));
  settings.wheels = Object.fromEntries(['shadows', 'midtones', 'highlights'].map(key => [key, {
    hue: clamp(input.wheels?.[key]?.hue, 0, 360),
    amount: clamp(input.wheels?.[key]?.amount, 0, 1),
    luminance: clamp(input.wheels?.[key]?.luminance, -50, 50),
  }]));
  return settings;
}

function smooth(a, b, value) { const t = Math.max(0, Math.min(1, (value - a) / (b - a || 1))); return t * t * (3 - 2 * t); }
function rgbHsl(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min, light = (max + min) / 2;
  let hue = 0, saturation = 0;
  if (delta) {
    saturation = delta / (1 - Math.abs(2 * light - 1));
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return [hue, saturation, light];
}
function hslRgb(hue, saturation, light) {
  const chroma = (1 - Math.abs(2 * light - 1)) * saturation;
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = light - chroma / 2;
  let r, g, b;
  if (hue < 60) [r, g, b] = [chroma, x, 0];
  else if (hue < 120) [r, g, b] = [x, chroma, 0];
  else if (hue < 180) [r, g, b] = [0, chroma, x];
  else if (hue < 240) [r, g, b] = [0, x, chroma];
  else if (hue < 300) [r, g, b] = [x, 0, chroma];
  else [r, g, b] = [chroma, 0, x];
  return [r + m, g + m, b + m];
}
function curveTable(points) {
  const lut = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = i / 255; let segment = 0;
    while (segment < points.length - 2 && x > points[segment + 1].x) segment++;
    const left = points[segment], right = points[segment + 1];
    const t = Math.max(0, Math.min(1, (x - left.x) / (right.x - left.x || 1)));
    lut[i] = (left.y * (1 - t) + right.y * t) * 255;
  }
  return lut;
}
function luma(data, index) { return data[index] * .2126 + data[index + 1] * .7152 + data[index + 2] * .0722; }

function processPixels(data, width, height, settings, offsetX, offsetY, fullWidth, fullHeight) {
  const curves = Object.fromEntries(['master', 'red', 'green', 'blue'].map(channel => [channel, curveTable(settings.curves[channel])]));
  const hslActive = bands.some(key => Object.values(settings.hsl[key]).some(Boolean));
  const wheelNames = ['shadows', 'midtones', 'highlights'];
  const wheelColors = wheelNames.map(key => hslRgb(settings.wheels[key].hue, 1, .5));
  const zones = wheelNames.map(key => settings.wheels[key]);
  const contrast = 1 + settings.contrast / 100;
  const exposure = 2 ** (settings.exposure / 50);
  const brightness = settings.brightness * .35;
  const vignetteStart = settings.vignetteMidpoint / 100 * .8;
  const falloff = 1 + settings.vignetteFeather / 30;
  const vignette = settings.vignette / 100;
  const roundness = (settings.vignetteRoundness + 100) / 200;
  for (let y = 0; y < height; y++) {
    const globalY = offsetY + y;
    const ny = globalY / Math.max(1, fullHeight - 1) * 2 - 1;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let r = data[i], g = data[i + 1], b = data[i + 2];
      r += settings.temperature * .42 + settings.tint * .12;
      g -= settings.tint * .32;
      b -= settings.temperature * .42 - settings.tint * .12;
      r = ((r - 127.5) * contrast + 127.5 + brightness) * exposure;
      g = ((g - 127.5) * contrast + 127.5 + brightness) * exposure;
      b = ((b - 127.5) * contrast + 127.5 + brightness) * exposure;
      let luminance = (r * .2126 + g * .7152 + b * .0722) / 255;
      const tonal = settings.shadows * (1 - smooth(.12, .62, luminance)) * .65
        + settings.highlights * smooth(.38, .92, luminance) * .55
        + settings.blacks * (1 - smooth(.04, .35, luminance)) * .35
        + settings.whites * smooth(.66, .98, luminance) * .35;
      r += tonal; g += tonal; b += tonal;
      r = curves.master[Math.max(0, Math.min(255, Math.round(r)))];
      g = curves.master[Math.max(0, Math.min(255, Math.round(g)))];
      b = curves.master[Math.max(0, Math.min(255, Math.round(b)))];
      r = curves.red[Math.max(0, Math.min(255, Math.round(r)))];
      g = curves.green[Math.max(0, Math.min(255, Math.round(g)))];
      b = curves.blue[Math.max(0, Math.min(255, Math.round(b)))];
      if (settings.hue || settings.saturation || hslActive) {
        let [hue, saturation, lightness] = rgbHsl(
          Math.max(0, Math.min(255, r)) / 255,
          Math.max(0, Math.min(255, g)) / 255,
          Math.max(0, Math.min(255, b)) / 255,
        );
        hue = (hue + settings.hue + 360) % 360;
        saturation = Math.max(0, Math.min(1, saturation * (1 + settings.saturation / 100)));
        if (hslActive) for (let k = 0; k < bands.length; k++) {
          let distance = Math.abs(hue - bandHue[k]); distance = Math.min(distance, 360 - distance);
          const weight = Math.max(0, 1 - distance / 38); if (!weight) continue;
          const adjustment = settings.hsl[bands[k]];
          hue = (hue + adjustment.h * .35 * weight + 360) % 360;
          saturation = Math.max(0, Math.min(1, saturation * (1 + adjustment.s / 100 * weight)));
          lightness = Math.max(0, Math.min(1, lightness + adjustment.l / 100 * .3 * weight));
        }
        [r, g, b] = hslRgb(hue, saturation, lightness).map(value => value * 255);
      }
      luminance = (r * .2126 + g * .7152 + b * .0722) / 255;
      const wheelWeights = [
        1 - smooth(.18, .52, luminance),
        1 - Math.abs(smooth(.08, .55, luminance) - smooth(.48, .92, luminance)),
        smooth(.45, .88, luminance),
      ];
      for (let k = 0; k < 3; k++) {
        const wheel = zones[k], amount = wheel.amount * wheelWeights[k] * .38, color = wheelColors[k];
        r = r * (1 - amount) + color[0] * 255 * amount;
        g = g * (1 - amount) + color[1] * 255 * amount;
        b = b * (1 - amount) + color[2] * 255 * amount;
        const lift = wheel.luminance * wheelWeights[k] * .42;
        r += lift; g += lift; b += lift;
      }
      if (vignette) {
        const globalX = offsetX + x;
        const nx = globalX / Math.max(1, fullWidth - 1) * 2 - 1;
        const circle = Math.sqrt(nx * nx + ny * ny) / Math.SQRT2;
        const square = Math.max(Math.abs(nx), Math.abs(ny));
        const radius = square * (1 - roundness) + circle * roundness;
        const edge = Math.max(0, Math.min(1, (radius - vignetteStart) / (1 - vignetteStart)));
        const factor = 1 - vignette * (edge ** falloff) * .72;
        r *= factor; g *= factor; b *= factor;
      }
      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
    }
  }
  if (settings.texture || settings.clarity) {
    const source = Uint8Array.from(data), texture = settings.texture / 100 * .85, clarity = settings.clarity / 100 * .55;
    const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const wideOffsets = [[-4, 0], [4, 0], [0, -4], [0, 4]];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4, center = luma(source, i);
      let near = 0, far = 0, nearCount = 0, farCount = 0;
      for (const [dx, dy] of offsets) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && xx < width && yy >= 0 && yy < height) { near += luma(source, (yy * width + xx) * 4); nearCount++; }
      }
      for (const [dx, dy] of wideOffsets) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && xx < width && yy >= 0 && yy < height) { far += luma(source, (yy * width + xx) * 4); farCount++; }
      }
      const detail = texture * (center - near / Math.max(1, nearCount)) + clarity * (center - far / Math.max(1, farCount));
      for (let channel = 0; channel < 3; channel++) data[i + channel] = Math.max(0, Math.min(255, data[i + channel] + detail));
    }
  }
}

async function readExact(handle, buffer, offset, length, position) {
  let completed = 0;
  while (completed < length) {
    const result = await handle.read(buffer, offset + completed, length - completed, position + completed);
    if (!result.bytesRead) throw new Error('Data gambar terpotong saat dibaca.');
    completed += result.bytesRead;
  }
}

async function writeExact(handle, buffer, offset, length, position) {
  let completed = 0;
  while (completed < length) {
    const result = await handle.write(buffer, offset + completed, length - completed, position + completed);
    if (!result.bytesWritten) throw new Error('Hasil render gagal ditulis ke disk.');
    completed += result.bytesWritten;
  }
}

async function renderTask(task) {
  const width = Number(task.width), height = Number(task.height);
  const rawLength = width * height * 4;
  if (!Number.isSafeInteger(rawLength) || width < 1 || height < 1) throw new Error('Dimensi gambar melebihi kapasitas file system.');
  const rawOutputPath = `${task.outputPath}.rgba.tmp`;
  const source = await fs.promises.open(task.rawPath, 'r');
  const destination = await fs.promises.open(rawOutputPath, 'w+');
  try {
    const sourceStats = await source.stat();
    if (sourceStats.size < rawLength) throw new Error('Data gambar tidak lengkap.');
    await destination.truncate(rawLength);
    const settings = cleanSettings(task.settings);
    const tileHeight = 256, margin = 4;
    const maxTileWidth = Math.max(512, Math.floor((32 * 1024 * 1024) / ((tileHeight + margin * 2) * 4)) - margin * 2);
    const tileWidth = Math.min(width, maxTileWidth);
    for (let y = 0; y < height; y += tileHeight) {
      for (let x = 0; x < width; x += tileWidth) {
        const coreWidth = Math.min(tileWidth, width - x);
        const coreHeight = Math.min(tileHeight, height - y);
        const left = Math.max(0, x - margin), top = Math.max(0, y - margin);
        const right = Math.min(width, x + coreWidth + margin);
        const bottom = Math.min(height, y + coreHeight + margin);
        const tileW = right - left, tileH = bottom - top;
        const tileBuffer = Buffer.allocUnsafe(tileW * tileH * 4);
        if (tileW === width) {
          await readExact(source, tileBuffer, 0, tileBuffer.length, top * width * 4);
        } else {
          for (let row = 0; row < tileH; row++) {
            const rowBytes = tileW * 4;
            const sourcePosition = ((top + row) * width + left) * 4;
            await readExact(source, tileBuffer, row * rowBytes, rowBytes, sourcePosition);
          }
        }
        const pixels = new Uint8ClampedArray(tileBuffer.buffer, tileBuffer.byteOffset, tileBuffer.byteLength);
        processPixels(pixels, tileW, tileH, settings, left, top, width, height);
        if (task.format === 'jpeg') {
          for (let index = 0; index < pixels.length; index += 4) {
            const alpha = pixels[index + 3] / 255;
            pixels[index] = pixels[index] * alpha + 255 * (1 - alpha);
            pixels[index + 1] = pixels[index + 1] * alpha + 255 * (1 - alpha);
            pixels[index + 2] = pixels[index + 2] * alpha + 255 * (1 - alpha);
            pixels[index + 3] = 255;
          }
        }
        if (x === 0 && coreWidth === width) {
          const sourceOffset = (y - top) * tileW * 4;
          await writeExact(destination, tileBuffer, sourceOffset, coreWidth * coreHeight * 4, y * width * 4);
        } else {
          for (let row = 0; row < coreHeight; row++) {
            const sourceOffset = ((y - top + row) * tileW + (x - left)) * 4;
            const destinationPosition = ((y + row) * width + x) * 4;
            await writeExact(destination, tileBuffer, sourceOffset, coreWidth * 4, destinationPosition);
          }
        }
      }
    }
    await destination.close();
    await source.close();
    const encoder = sharp({ raw: { width, height, channels: 4 }, limitInputPixels: false, unlimited: true });
    if (task.format === 'jpeg') encoder.jpeg({ quality: 100, chromaSubsampling: '4:4:4' });
    else encoder.png({ compressionLevel: 6 });
    await pipeline(fs.createReadStream(rawOutputPath), encoder, fs.createWriteStream(task.outputPath));
    return { width, height, size: (await fs.promises.stat(task.outputPath)).size, format: task.format };
  } finally {
    await source.close().catch(() => {});
    await destination.close().catch(() => {});
    await fs.promises.rm(rawOutputPath, { force: true }).catch(() => {});
  }
}

parentPort.on('message', async task => {
  try {
    const result = await renderTask(task);
    parentPort.postMessage({ ok: true, ...result });
  } catch (error) {
    parentPort.postMessage({ ok: false, error: error.message || 'Render otomatis gagal.' });
  }
});
