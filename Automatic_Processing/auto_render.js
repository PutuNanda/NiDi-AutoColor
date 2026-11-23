'use strict';

const path = require('node:path');
const { Worker } = require('node:worker_threads');
const fs = require('node:fs');
const sharp = require('sharp');
const { pipeline } = require('node:stream/promises');

const configuredWorkers = Number(process.env.AUTO_RENDER_WORKERS);
const MAX_RENDER_WORKERS = 20;
const maxWorkers = Number.isInteger(configuredWorkers) && configuredWorkers > 0
  ? Math.min(MAX_RENDER_WORKERS, configuredWorkers)
  : MAX_RENDER_WORKERS;
const workerPath = path.join(__dirname, 'auto_render_worker.js');
const queue = [];
let activeWorkers = 0;

function dispatch() {
  while (activeWorkers < maxWorkers && queue.length) {
    const task = queue.shift();
    const worker = new Worker(workerPath);
    activeWorkers++;
    let settled = false;
    const finish = async (error, result) => {
      if (settled) return;
      settled = true;
      await worker.terminate().catch(() => {});
      activeWorkers--;
      if (error) task.reject(error);
      else task.resolve(result);
      dispatch();
    };
    worker.once('message', message => {
      if (message?.ok) void finish(null, message);
      else void finish(new Error(message?.error || 'Render otomatis gagal.'));
    });
    worker.once('error', error => void finish(error));
    worker.once('exit', code => {
      if (!settled) void finish(new Error(`Worker render berhenti dengan kode ${code}.`));
    });
    try { worker.postMessage(task.payload); }
    catch (error) { void finish(error); }
  }
}

async function decodeToRawFile(inputPath, rawPath) {
  const transformer = sharp(inputPath, { failOn: 'warning', limitInputPixels: false, unlimited: true })
    .rotate().toColourspace('srgb').ensureAlpha().raw();
  let info = null;
  transformer.once('info', value => { info = value; });
  await pipeline(transformer, fs.createWriteStream(rawPath, { flags: 'wx' }));
  if (!info || !Number.isSafeInteger(info.width * info.height * info.channels)) {
    throw new Error('Dimensi gambar terlalu besar untuk diproses pada perangkat ini.');
  }
  return info;
}

function renderRawToFile(rawPath, outputPath, width, height, settings, format = 'png') {
  return new Promise((resolve, reject) => {
    queue.push({ payload: { rawPath, outputPath, width, height, settings, format }, resolve, reject });
    dispatch();
  });
}

module.exports = { decodeToRawFile, renderRawToFile, maxWorkers };
