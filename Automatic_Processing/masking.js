'use strict';

const clamp = (value, min, max, fallback = 0) => Number.isFinite(Number(value))
  ? Math.max(min, Math.min(max, Number(value))) : fallback;

function cleanMask(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  let pointCount = 0;
  const strokes = (Array.isArray(source.strokes) ? source.strokes : []).slice(0, 400).map(stroke => {
    if (!stroke || typeof stroke !== 'object') return null;
    const points = (Array.isArray(stroke.points) ? stroke.points : []).slice(0, 512)
      .filter(point => point && typeof point === 'object' && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)))
      .map(point => ({ x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1) }));
    if (!points.length || pointCount + points.length > 5000) return null;
    pointCount += points.length;
    return { erase: Boolean(stroke.erase), size: clamp(stroke.size, .001, 2, .05), points };
  }).filter(Boolean);
  return {
    strokes,
    inverted: Boolean(source.inverted),
    brushSize: clamp(source.brushSize, 8, 240, 72),
  };
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

function applyMask(data, original, mask, width, height, offsetX, offsetY, fullWidth, fullHeight) {
  if (!mask || !original) return;
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

module.exports = { cleanMask, buildMaskRaster, applyMask };
