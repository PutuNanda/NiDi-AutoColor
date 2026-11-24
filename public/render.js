(() => {
  'use strict';

  const rawExtensions = new Set([
    'cr3', 'cr2', 'crw', 'arw', 'srf', 'sr2', 'arq', 'nef', 'nrw', 'raf', 'rw2', 'raw',
    'orf', 'ori', '3fr', 'fff', 'iiq', 'dng', 'rwl', 'x3f', 'pef', 'gpr', 'srw', 'mrw',
    'mos', 'kdc', 'dcr', 'dcs', 'erf', 'mef', 'ari',
  ]);
  const tiffExtensions = new Set(['tif', 'tiff']);
  async function decodeImageFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    if (tiffExtensions.has(extension)) {
      try {
        const decoder = await import('/vendor/format-decoder.js');
        return await decoder.decodeTiff(file);
      } catch (error) {
        throw new Error(`TIFF .${extension} gagal dibuka: ${error.message}`);
      }
    }
    if (rawExtensions.has(extension)) {
      try {
        const decoder = await import('/vendor/format-decoder.js');
        return await decoder.decodeRaw(file);
      } catch (error) {
        throw new Error(`RAW .${extension} gagal dibuka: ${error.message}`);
      }
    }
    try {
      return await createImageBitmap(file);
    } catch {
      throw new Error(`Browser ini tidak dapat membaca .${extension}. Coba ekspor sebagai JPEG atau PNG.`);
    }
  }

  function rendererWorker() {
    let source = null;
    let latestJob = 0;
    let sourceVersion = 0;
    let maskRasterCache = { key: '', width: 0, height: 0, value: null };
    const bands = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'];
    const bandHue = [0, 30, 60, 120, 180, 220, 275, 325];
    const clamp = (value, min, max, fallback = 0) => Number.isFinite(Number(value))
      ? Math.max(min, Math.min(max, Number(value))) : fallback;
    const smooth = (a, b, value) => {
      const t = Math.max(0, Math.min(1, (value - a) / (b - a || 1)));
      return t * t * (3 - 2 * t);
    };
    function rgbHsl(r, g, b) {
      const max = Math.max(r, g, b), min = Math.min(r, g, b), difference = max - min;
      const lightness = (max + min) / 2;
      let hue = 0, saturation = 0;
      if (difference) {
        saturation = difference / (1 - Math.abs(2 * lightness - 1));
        if (max === r) hue = ((g - b) / difference) % 6;
        else if (max === g) hue = (b - r) / difference + 2;
        else hue = (r - g) / difference + 4;
        hue = (hue * 60 + 360) % 360;
      }
      return [hue, saturation, lightness];
    }
    function hslRgb(hue, saturation, lightness) {
      const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
      const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
      const match = lightness - chroma / 2;
      let r, g, b;
      if (hue < 60) [r, g, b] = [chroma, x, 0];
      else if (hue < 120) [r, g, b] = [x, chroma, 0];
      else if (hue < 180) [r, g, b] = [0, chroma, x];
      else if (hue < 240) [r, g, b] = [0, x, chroma];
      else if (hue < 300) [r, g, b] = [x, 0, chroma];
      else [r, g, b] = [chroma, 0, x];
      return [r + match, g + match, b + match];
    }
    function cleanCurve(sourceCurve) {
      const points = Array.isArray(sourceCurve) ? sourceCurve.map((point, index) => typeof point === 'number'
        ? { x: index / Math.max(1, sourceCurve.length - 1), y: point }
        : { x: Number(point?.x), y: Number(point?.y) })
        .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)) : [];
      const inner = points.filter(point => point.x > .005 && point.x < .995)
        .map(point => ({ x: clamp(point.x, .01, .99), y: clamp(point.y, 0, 1) }))
        .sort((a, b) => a.x - b.x);
      const accepted = [];
      for (const point of inner) {
        if (accepted.length < 8 && point.x - (accepted.at(-1)?.x ?? 0) >= .01) accepted.push(point);
      }
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
        const fallback = key === 'vignetteMidpoint' ? 45 : key === 'vignetteFeather' ? 70 : 0;
        settings[key] = clamp(input[key], min, max, fallback);
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
      const sourceMask = input.mask || {};
      let pointCount = 0;
      const strokes = (Array.isArray(sourceMask.strokes) ? sourceMask.strokes : []).slice(0, 400).map(stroke => {
        const points = (Array.isArray(stroke?.points) ? stroke.points : []).slice(0, 512)
          .filter(point => point && typeof point === 'object' && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)))
          .map(point => ({ x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1) }));
        if (!points.length || pointCount + points.length > 5000) return null;
        pointCount += points.length;
        return { erase: Boolean(stroke.erase), size: clamp(stroke.size, .001, 2, .05), points };
      }).filter(Boolean);
      settings.mask = {
        strokes,
        inverted: Boolean(sourceMask.inverted),
        brushSize: clamp(sourceMask.brushSize, 8, 240, 72),
      };
      return settings;
    }
    function buildMaskRaster(mask, fullWidth, fullHeight) {
      if (!mask?.strokes?.length) return null;
      const width = Math.min(1024, Math.max(1, Math.round(fullWidth)));
      const height = Math.min(2048, Math.max(1, Math.round(width * fullHeight / Math.max(1, fullWidth))));
      const alpha = new Uint8Array(width * height);
      for (const stroke of mask.strokes) {
        const points = stroke.points;
        const radius = Math.max(.5, stroke.size * width / 2), feather = Math.max(.75, radius * .2);
        const segmentCount = Math.max(1, points.length - 1);
        for (let segment = 0; segment < segmentCount; segment++) {
          const start = points[segment], end = points[Math.min(segment + 1, points.length - 1)];
          const x1 = start.x * (width - 1), y1 = start.y * (height - 1);
          const x2 = end.x * (width - 1), y2 = end.y * (height - 1);
          const dx = x2 - x1, dy = y2 - y1, lengthSq = dx * dx + dy * dy;
          const minX = Math.max(0, Math.floor(Math.min(x1, x2) - radius - 1));
          const maxX = Math.min(width - 1, Math.ceil(Math.max(x1, x2) + radius + 1));
          const minY = Math.max(0, Math.floor(Math.min(y1, y2) - radius - 1));
          const maxY = Math.min(height - 1, Math.ceil(Math.max(y1, y2) + radius + 1));
          for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
            const t = lengthSq ? Math.max(0, Math.min(1, ((x + .5 - x1) * dx + (y + .5 - y1) * dy) / lengthSq)) : 0;
            const distance = Math.hypot(x + .5 - (x1 + t * dx), y + .5 - (y1 + t * dy));
            const coverage = Math.max(0, Math.min(1, (radius - distance) / feather));
            if (!coverage) continue;
            const index = y * width + x, old = alpha[index] / 255;
            alpha[index] = Math.round((stroke.erase ? old * (1 - coverage) : old + (1 - old) * coverage) * 255);
          }
        }
      }
      if (mask.inverted) for (let index = 0; index < alpha.length; index++) alpha[index] = 255 - alpha[index];
      return { width, height, data: alpha };
    }
    function curveTable(points) {
      const table = new Float32Array(256);
      for (let index = 0; index < 256; index++) {
        const x = index / 255;
        let segment = 0;
        while (segment < points.length - 2 && x > points[segment + 1].x) segment++;
        const left = points[segment], right = points[segment + 1];
        const t = Math.max(0, Math.min(1, (x - left.x) / (right.x - left.x || 1)));
        table[index] = (left.y * (1 - t) + right.y * t) * 255;
      }
      return table;
    }
    const luma = (data, index) => data[index] * .2126 + data[index + 1] * .7152 + data[index + 2] * .0722;
    function processPixels(data, width, height, settings, offsetX, offsetY, fullWidth, fullHeight) {
      const original = settings.maskRaster ? Uint8Array.from(data) : null;
      const curves = Object.fromEntries(['master', 'red', 'green', 'blue'].map(channel => [channel, curveTable(settings.curves[channel])]));
      const hslActive = bands.some(key => Object.values(settings.hsl[key]).some(Boolean));
      const wheelNames = ['shadows', 'midtones', 'highlights'];
      const wheelColors = wheelNames.map(key => hslRgb(settings.wheels[key].hue, 1, .5));
      const zones = wheelNames.map(key => settings.wheels[key]);
      const contrast = 1 + settings.contrast / 100;
      const exposure = 2 ** (settings.exposure / 50);
      const brightness = settings.brightness * .35;
      const start = settings.vignetteMidpoint / 100 * .8;
      const falloff = 1 + settings.vignetteFeather / 30;
      const vignette = settings.vignette / 100;
      const roundness = (settings.vignetteRoundness + 100) / 200;
      for (let y = 0; y < height; y++) {
        const globalY = offsetY + y;
        const ny = globalY / Math.max(1, fullHeight - 1) * 2 - 1;
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          let r = data[index], g = data[index + 1], b = data[index + 2];
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
            if (hslActive) {
              for (let bandIndex = 0; bandIndex < bands.length; bandIndex++) {
                let distance = Math.abs(hue - bandHue[bandIndex]);
                distance = Math.min(distance, 360 - distance);
                const weight = Math.max(0, 1 - distance / 38);
                if (!weight) continue;
                const adjustment = settings.hsl[bands[bandIndex]];
                hue = (hue + adjustment.h * .35 * weight + 360) % 360;
                saturation = Math.max(0, Math.min(1, saturation * (1 + adjustment.s / 100 * weight)));
                lightness = Math.max(0, Math.min(1, lightness + adjustment.l / 100 * .3 * weight));
              }
            }
            [r, g, b] = hslRgb(hue, saturation, lightness).map(value => value * 255);
          }
          luminance = (r * .2126 + g * .7152 + b * .0722) / 255;
          const wheelWeights = [
            1 - smooth(.18, .52, luminance),
            1 - Math.abs(smooth(.08, .55, luminance) - smooth(.48, .92, luminance)),
            smooth(.45, .88, luminance),
          ];
          for (let wheelIndex = 0; wheelIndex < 3; wheelIndex++) {
            const wheel = zones[wheelIndex], amount = wheel.amount * wheelWeights[wheelIndex] * .38;
            const color = wheelColors[wheelIndex];
            r = r * (1 - amount) + color[0] * 255 * amount;
            g = g * (1 - amount) + color[1] * 255 * amount;
            b = b * (1 - amount) + color[2] * 255 * amount;
            const lift = wheel.luminance * wheelWeights[wheelIndex] * .42;
            r += lift; g += lift; b += lift;
          }
          if (vignette) {
            const globalX = offsetX + x;
            const nx = globalX / Math.max(1, fullWidth - 1) * 2 - 1;
            const circle = Math.sqrt(nx * nx + ny * ny) / Math.SQRT2;
            const square = Math.max(Math.abs(nx), Math.abs(ny));
            const radius = square * (1 - roundness) + circle * roundness;
            const edge = Math.max(0, Math.min(1, (radius - start) / (1 - start)));
            const factor = 1 - vignette * (edge ** falloff) * .72;
            r *= factor; g *= factor; b *= factor;
          }
          data[index] = Math.max(0, Math.min(255, r));
          data[index + 1] = Math.max(0, Math.min(255, g));
          data[index + 2] = Math.max(0, Math.min(255, b));
        }
      }
      if (settings.texture || settings.clarity) {
        const sourcePixels = Uint8Array.from(data);
        const texture = settings.texture / 100 * .85;
        const clarity = settings.clarity / 100 * .55;
        const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        const wideOffsets = [[-4, 0], [4, 0], [0, -4], [0, 4]];
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            const center = luma(sourcePixels, index);
            let near = 0, far = 0, nearCount = 0, farCount = 0;
            for (const [dx, dy] of offsets) {
              const xx = x + dx, yy = y + dy;
              if (xx >= 0 && xx < width && yy >= 0 && yy < height) {
                near += luma(sourcePixels, (yy * width + xx) * 4); nearCount++;
              }
            }
            for (const [dx, dy] of wideOffsets) {
              const xx = x + dx, yy = y + dy;
              if (xx >= 0 && xx < width && yy >= 0 && yy < height) {
                far += luma(sourcePixels, (yy * width + xx) * 4); farCount++;
              }
            }
            const detail = texture * (center - near / Math.max(1, nearCount))
              + clarity * (center - far / Math.max(1, farCount));
            for (let channel = 0; channel < 3; channel++) {
              data[index + channel] = Math.max(0, Math.min(255, data[index + channel] + detail));
            }
          }
        }
      }
      if (original) {
        const mask = settings.maskRaster;
        for (let y = 0; y < height; y++) {
          const mapY = Math.max(0, Math.min(mask.height - 1, (offsetY + y + .5) / fullHeight * mask.height - .5));
          const y0 = Math.floor(mapY), y1 = Math.min(mask.height - 1, y0 + 1), fy = mapY - y0;
          for (let x = 0; x < width; x++) {
            const mapX = Math.max(0, Math.min(mask.width - 1, (offsetX + x + .5) / fullWidth * mask.width - .5));
            const x0 = Math.floor(mapX), x1 = Math.min(mask.width - 1, x0 + 1), fx = mapX - x0;
            const top = mask.data[y0 * mask.width + x0] * (1 - fx) + mask.data[y0 * mask.width + x1] * fx;
            const bottom = mask.data[y1 * mask.width + x0] * (1 - fx) + mask.data[y1 * mask.width + x1] * fx;
            const amount = (top * (1 - fy) + bottom * fy) / 255, index = (y * width + x) * 4;
            for (let channel = 0; channel < 3; channel++) data[index + channel] = original[index + channel] * (1 - amount) + data[index + channel] * amount;
          }
        }
      }
    }
    function addHistogram(data, width, height, x, y, coreX, coreY, coreWidth, coreHeight, bins) {
      for (let row = 0; row < coreHeight; row++) {
        for (let column = 0; column < coreWidth; column++) {
          const index = ((coreY + row) * width + coreX + column) * 4;
          const brightness = data[index] * .2126 + data[index + 1] * .7152 + data[index + 2] * .0722;
          bins[Math.min(63, Math.floor(brightness / 256 * 64))]++;
        }
      }
    }
    const yieldToMessages = () => new Promise(resolve => setTimeout(resolve, 0));
    async function render(message) {
      const job = message.id, version = sourceVersion;
      if (!source) { self.postMessage({ type: 'error', id: job, error: 'Impor foto terlebih dahulu.' }); return; }
      const originalWidth = source.width, originalHeight = source.height;
      let width, height;
      if (message.width && message.height) {
        width = Math.max(1, Math.round(message.width)); height = Math.max(1, Math.round(message.height));
      } else {
        const maxDimension = Math.max(1, message.maxDimension || 1600);
        const scale = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight));
        width = Math.max(1, Math.round(originalWidth * scale));
        height = Math.max(1, Math.round(originalHeight * scale));
      }
      const outputCanvas = new OffscreenCanvas(width, height);
      const outputContext = outputCanvas.getContext('2d', { willReadFrequently: true });
      const tileCanvas = new OffscreenCanvas(1, 1);
      const tileContext = tileCanvas.getContext('2d', { willReadFrequently: true });
      const scaleX = originalWidth / width, scaleY = originalHeight / height;
      const settings = cleanSettings(message.settings);
      const maskKey = JSON.stringify(settings.mask);
      if (maskKey !== maskRasterCache.key || width !== maskRasterCache.width || height !== maskRasterCache.height) {
        maskRasterCache = { key: maskKey, width, height, value: buildMaskRaster(settings.mask, width, height) };
      }
      settings.maskRaster = maskRasterCache.value;
      const bins = Array(64).fill(0);
      const type = message.typeHint || 'image/png';
      const tileWidth = 512, tileHeight = 256, margin = 4;
      for (let y = 0; y < height; y += tileHeight) {
        for (let x = 0; x < width; x += tileWidth) {
          if (job !== latestJob || version !== sourceVersion) {
            self.postMessage({ type: 'cancelled', id: job });
            return;
          }
          const coreWidth = Math.min(tileWidth, width - x);
          const coreHeight = Math.min(tileHeight, height - y);
          const left = Math.max(0, x - margin), top = Math.max(0, y - margin);
          const right = Math.min(width, x + coreWidth + margin);
          const bottom = Math.min(height, y + coreHeight + margin);
          const tileW = right - left, tileH = bottom - top;
          tileCanvas.width = tileW; tileCanvas.height = tileH;
          tileContext.clearRect(0, 0, tileW, tileH);
          tileContext.drawImage(
            source,
            left * scaleX, top * scaleY, tileW * scaleX, tileH * scaleY,
            0, 0, tileW, tileH,
          );
          const pixels = tileContext.getImageData(0, 0, tileW, tileH);
          processPixels(pixels.data, tileW, tileH, settings, left, top, width, height);
          if (type === 'image/jpeg') {
            for (let index = 0; index < pixels.data.length; index += 4) {
              const alpha = pixels.data[index + 3] / 255;
              pixels.data[index] = pixels.data[index] * alpha + 255 * (1 - alpha);
              pixels.data[index + 1] = pixels.data[index + 1] * alpha + 255 * (1 - alpha);
              pixels.data[index + 2] = pixels.data[index + 2] * alpha + 255 * (1 - alpha);
              pixels.data[index + 3] = 255;
            }
          }
          addHistogram(pixels.data, tileW, tileH, x, y, x - left, y - top, coreWidth, coreHeight, bins);
          outputContext.putImageData(pixels, left, top, x - left, y - top, coreWidth, coreHeight);
          await yieldToMessages();
        }
      }
      if (job !== latestJob || version !== sourceVersion) {
        self.postMessage({ type: 'cancelled', id: job });
        return;
      }
      const blob = await outputCanvas.convertToBlob({ type, quality: 1 });
      if (job !== latestJob || version !== sourceVersion) {
        self.postMessage({ type: 'cancelled', id: job });
        return;
      }
      const maximum = Math.max(1, ...bins);
      const histogram = bins.map(value => Math.round(value / maximum * 1000));
      self.postMessage({ type: 'rendered', id: job, blob, width, height, histogram });
    }
    self.onmessage = event => {
      const message = event.data;
      if (message.type === 'load') {
        sourceVersion++;
        latestJob = 0;
        if (source) source.close();
        source = message.bitmap;
        self.postMessage({ type: 'loaded', id: message.id, width: source.width, height: source.height });
      } else if (message.type === 'render') {
        latestJob = message.id;
        void render(message).catch(error => self.postMessage({ type: 'error', id: message.id, error: error.message || 'Render gagal.' }));
      }
    };
  }

  class ClientImageRenderer {
    constructor() {
      this.worker = null;
      this.workerUrl = '';
      this.sequence = 0;
      this.loadVersion = 0;
      this.pending = new Map();
      this.width = 0;
      this.height = 0;
    }
    ensureWorker() {
      if (this.worker) return;
      if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
        throw new Error('Browser ini belum mendukung pemrosesan foto langsung. Coba browser versi terbaru.');
      }
      const script = `(${rendererWorker.toString()})()`;
      this.workerUrl = URL.createObjectURL(new Blob([script], { type: 'text/javascript' }));
      this.worker = new Worker(this.workerUrl);
      this.worker.onmessage = event => this.handleMessage(event.data);
      this.worker.onerror = () => this.failAll(new Error('Worker pemrosesan foto berhenti. Muat ulang halaman lalu coba lagi.'));
    }
    handleMessage(message) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      if (message.type === 'loaded') {
        this.width = message.width; this.height = message.height;
        this.pending.delete(message.id); pending.resolve({ width: this.width, height: this.height });
      } else if (message.type === 'rendered') {
        this.pending.delete(message.id);
        pending.resolve({ blob: message.blob, width: message.width, height: message.height, histogram: message.histogram });
      } else if (message.type === 'cancelled') {
        this.pending.delete(message.id); pending.resolve(null);
      } else if (message.type === 'error') {
        this.pending.delete(message.id); pending.reject(new Error(message.error));
      }
    }
    failAll(error) {
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
      this.worker?.terminate(); this.worker = null;
      if (this.workerUrl) URL.revokeObjectURL(this.workerUrl);
      this.workerUrl = '';
    }
    load(file) {
      this.ensureWorker();
      const id = ++this.sequence;
      const loadVersion = ++this.loadVersion;
      for (const [pendingId, pending] of this.pending) {
        this.pending.delete(pendingId); pending.resolve(null);
      }
      return decodeImageFile(file).then(bitmap => {
        if (loadVersion !== this.loadVersion) { bitmap.close(); return null; }
        if (bitmap.width * bitmap.height > 160_000_000) {
          bitmap.close(); throw new Error('Foto terlalu besar untuk diproses oleh browser ini (maksimal 160 megapiksel).');
        }
        return new Promise((resolve, reject) => {
          this.pending.set(id, { kind: 'load', resolve, reject });
          this.worker.postMessage({ type: 'load', id, bitmap }, [bitmap]);
        });
      });
    }
    render(settings, options = {}) {
      this.ensureWorker();
      const id = ++this.sequence;
      for (const [pendingId, pending] of this.pending) {
        if (pending.kind === 'render') { this.pending.delete(pendingId); pending.resolve(null); }
      }
      return new Promise((resolve, reject) => {
        this.pending.set(id, { kind: 'render', resolve, reject });
        this.worker.postMessage({ type: 'render', id, settings, ...options });
      });
    }
    destroy() {
      for (const pending of this.pending.values()) pending.resolve(null);
      this.pending.clear();
      this.worker?.terminate(); this.worker = null;
      if (this.workerUrl) URL.revokeObjectURL(this.workerUrl);
      this.workerUrl = '';
    }
  }

  const importExtensions = new Set([
    'jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp', 'tif', 'tiff', 'heic', 'heif', 'hif',
    'jxl', 'psd', 'psb', 'exr', ...rawExtensions,
  ]);
  window.NiDiRender = {
    create: () => new ClientImageRenderer(),
    supports: file => file.type.startsWith('image/') || importExtensions.has(file.name.split('.').pop().toLowerCase()),
  };
})();
