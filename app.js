const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { randomUUID } = require('node:crypto');
const sharp = require('sharp');
const automaticRenderer = require('./Automatic_Processing/auto_render');
const { cleanMask } = require('./Automatic_Processing/masking');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const TEMPLATE_DIR = path.join(__dirname, 'Template');
const AUTO_DIR = path.join(__dirname, 'Automatic_Processing');
const AUTO_INPUT_DIR = path.join(AUTO_DIR, 'input');
const AUTO_OUTPUT_DIR = path.join(AUTO_DIR, 'output');
const AUTO_SETTINGS_FILE = path.join(AUTO_DIR, 'template_settings.json');
const MIN_DELETE_AFTER_MINUTES = 1;
const MAX_DELETE_AFTER_MINUTES = 10080;
const DEFAULT_DELETE_AFTER_MINUTES = 60;
const MIN_MAX_WORKERS = 1;
const MAX_MAX_WORKERS = 100;
const DEFAULT_MAX_WORKERS = 100;
const MAX_ACTIVE_AUTO_PHOTOS = 100;
const automaticJobs = new Map();
const automaticDeletionTimers = new Map();
fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
fs.mkdirSync(AUTO_INPUT_DIR, { recursive: true });
fs.mkdirSync(AUTO_OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(AUTO_SETTINGS_FILE)) {
  fs.writeFileSync(AUTO_SETTINGS_FILE, `${JSON.stringify({ schemaVersion: 1, updatedAt: null, deleteAfterMinutes: DEFAULT_DELETE_AFTER_MINUTES, maxWorkers: DEFAULT_MAX_WORKERS, selectedTemplates: [] }, null, 2)}\n`);
}
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of automaticJobs) {
    if (job.expiresAt && job.expiresAt <= now && !['uploading', 'queued', 'processing'].includes(job.status) && !job.downloadsInProgress) void deleteAutomaticJobFiles(id);
  }
}, 5_000).unref();
void restoreAutomaticDeletionTimers();
const bands = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'];
const OUTPUT_EXTENSION = { jpeg: 'jpg', png: 'png', webp: 'webp', avif: 'avif', tiff: 'tiff', gif: 'gif' };

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
function templateName(value) {
  if (typeof value !== 'string') throw Object.assign(new Error('Nama template harus berupa teks.'), { status: 400 });
  const name = value.trim();
  if (!name || name.length > 64 || !/^[A-Za-z0-9 _-]+$/.test(name)) {
    throw Object.assign(new Error('Nama hanya boleh berisi huruf, angka, spasi, underscore, dan tanda hubung; maksimal 64 karakter.'), { status: 400 });
  }
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(name)) {
    throw Object.assign(new Error('Nama tersebut tidak dapat digunakan sebagai nama file.'), { status: 400 });
  }
  return name;
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0; let tooLarge = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) { tooLarge = true; chunks.length = 0; }
      else if (!tooLarge) chunks.push(chunk);
    });
    req.on('end', () => tooLarge ? reject(Object.assign(new Error('Ukuran data terlalu besar.'), { status: 413 })) : resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
const clamp = (v, lo, hi, d = 0) => Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : d;
function cleanSettings(input = {}) {
  const keys = { temperature: [-100,100], tint: [-100,100], hue: [-180,180], contrast: [-100,100], brightness: [-100,100], exposure: [-100,100], highlights: [-100,100], shadows: [-100,100], whites: [-100,100], blacks: [-100,100], texture: [-100,100], clarity: [-100,100], saturation: [-100,100], vignette: [-100,100], vignetteMidpoint: [0,100], vignetteRoundness: [-100,100], vignetteFeather: [1,100] };
  const out = {};
  for (const [key, [min, max]] of Object.entries(keys)) out[key] = clamp(input[key], min, max, key === 'vignetteMidpoint' ? 45 : key === 'vignetteFeather' ? 70 : 0);
  const cleanCurve = (source) => {
    const points = Array.isArray(source) ? source.map((point, index) => {
      if (typeof point === 'number') return { x: index / Math.max(1, source.length - 1), y: point };
      return { x: Number(point?.x), y: Number(point?.y) };
    }).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)) : [];
    const inner = points.filter(point => point.x > .005 && point.x < .995)
      .map(point => ({ x: clamp(point.x, .01, .99), y: clamp(point.y, 0, 1) }))
      .sort((a, b) => a.x - b.x);
    const accepted = [];
    for (const point of inner) if (accepted.length < 8 && point.x - (accepted.at(-1)?.x ?? 0) >= .01) accepted.push(point);
    return [{ x: 0, y: 0 }, ...accepted, { x: 1, y: 1 }];
  };
  const inputCurves = input.curves || {};
  out.curves = Object.fromEntries(['master', 'red', 'green', 'blue'].map(channel => [channel, cleanCurve(inputCurves[channel] || (channel === 'master' ? input.curve : null))]));
  out.hsl = Object.fromEntries(bands.map(b => [b, { h: clamp(input.hsl?.[b]?.h,-100,100), s: clamp(input.hsl?.[b]?.s,-100,100), l: clamp(input.hsl?.[b]?.l,-100,100) }]));
  out.wheels = Object.fromEntries(['shadows','midtones','highlights'].map(k => [k, { hue: clamp(input.wheels?.[k]?.hue,0,360), amount: clamp(input.wheels?.[k]?.amount,0,1), luminance: clamp(input.wheels?.[k]?.luminance,-50,50) }]));
  out.mask = cleanMask(input.mask);
  return out;
}
async function listTemplates() {
  const entries=await fs.promises.readdir(TEMPLATE_DIR,{withFileTypes:true});
  const templates=[];
  for(const entry of entries){
    if(!entry.isFile()||!entry.name.toLowerCase().endsWith('.nd'))continue;
    try{
      const filename=path.join(TEMPLATE_DIR,entry.name);
      const stats=await fs.promises.stat(filename);
      if(stats.size>8*1024*1024)continue;
      const data=JSON.parse(await fs.promises.readFile(filename,'utf8'));
      const name=templateName(data.name);
      if(`${name}.nd`.toLowerCase()!==entry.name.toLowerCase()||!data.settings||typeof data.settings!=='object'||Array.isArray(data.settings))continue;
      const outputFormat=['png','jpg','jpeg'].includes(data.outputFormat)?data.outputFormat:'png';
      templates.push({name,createdAt:String(data.createdAt||stats.mtime.toISOString()),outputFormat,settings:cleanSettings(data.settings)});
    }catch{}
  }
  templates.sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'}));
  return templates;
}
async function migrateLegacyTemplates() {
  const entries=await fs.promises.readdir(TEMPLATE_DIR,{withFileTypes:true});
  for(const entry of entries){
    if(!entry.isFile()||!entry.name.toLowerCase().endsWith('.json'))continue;
    try{
      const source=path.join(TEMPLATE_DIR,entry.name);
      const stats=await fs.promises.stat(source);
      if(stats.size>8*1024*1024)continue;
      const data=JSON.parse(await fs.promises.readFile(source,'utf8'));
      const name=templateName(data.name);
      if(`${name}.json`.toLowerCase()!==entry.name.toLowerCase()||!data.settings||typeof data.settings!=='object'||Array.isArray(data.settings))continue;
      const target=path.join(TEMPLATE_DIR,`${name}.nd`);
      try{await fs.promises.access(target);continue;}catch(error){if(error.code!=='ENOENT')throw error;}
      await fs.promises.rename(source,target);
    }catch(error){if(error.code!=='ENOENT')console.error(`Migrasi template ${entry.name} gagal:`,error.message);}
  }
}
async function importTemplates(input) {
  const rawTemplates=Array.isArray(input)?input:Array.isArray(input?.templates)?input.templates:[input];
  if(!rawTemplates.length||rawTemplates.length>1000)throw Object.assign(new Error('File harus berisi 1–1.000 template.'),{status:400});
  const staged=[];const seen=new Set();
  for(const raw of rawTemplates){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Object.assign(new Error('Data template tidak valid.'),{status:400});
    let name;
    try{name=templateName(raw.name);}catch(error){throw Object.assign(error,{status:400});}
    if(!raw.settings||typeof raw.settings!=='object'||Array.isArray(raw.settings))throw Object.assign(new Error(`Pengaturan template "${name}" tidak valid.`),{status:400});
    const key=name.toLowerCase();
    if(seen.has(key))throw Object.assign(new Error(`File berisi nama template ganda: "${name}".`),{status:400});
    seen.add(key);
    const createdAt=typeof raw.createdAt==='string'&&Number.isFinite(Date.parse(raw.createdAt))?raw.createdAt:new Date().toISOString();
    const outputFormat=['png','jpg','jpeg'].includes(raw.outputFormat)?raw.outputFormat:'png';
    staged.push({name,createdAt,outputFormat,settings:cleanSettings(raw.settings)});
  }
  const existing=(await fs.promises.readdir(TEMPLATE_DIR)).map(name=>name.toLowerCase());
  const conflict=staged.find(template=>existing.includes(`${template.name}.nd`.toLowerCase()));
  if(conflict)throw Object.assign(new Error(`Template "${conflict.name}" sudah ada. Ubah nama di file .nd sebelum mengimpor.`),{status:409});
  const created=[];
  try{
    for(const template of staged){
      const filename=`${template.name}.nd`;
      const file=path.join(TEMPLATE_DIR,filename);
      const data={schemaVersion:1,...template};
      await fs.promises.writeFile(file,`${JSON.stringify(data,null,2)}\n`,{flag:'wx'});
      created.push(file);
    }
  }catch(error){
    await Promise.all(created.map(file=>fs.promises.unlink(file).catch(()=>{})));
    if(error.code==='EEXIST')throw Object.assign(new Error('Salah satu template dengan nama tersebut sudah ada.'),{status:409});
    throw error;
  }
  return staged.map(({name,createdAt,outputFormat,settings})=>({name,createdAt,outputFormat,settings}));
}
async function readAutomaticTemplateSettings() {
  const settings=JSON.parse(await fs.promises.readFile(AUTO_SETTINGS_FILE,'utf8'));
  if(!settings||!Array.isArray(settings.selectedTemplates))throw new Error('File template_settings.json tidak valid.');
  const savedDeleteAfter=Number(settings.deleteAfterMinutes);
  const deleteAfterMinutes=Number.isInteger(savedDeleteAfter)&&savedDeleteAfter>=MIN_DELETE_AFTER_MINUTES&&savedDeleteAfter<=MAX_DELETE_AFTER_MINUTES
    ?savedDeleteAfter:DEFAULT_DELETE_AFTER_MINUTES;
  const savedMaxWorkers=Number(settings.maxWorkers);
  const maxWorkers=Number.isInteger(savedMaxWorkers)&&savedMaxWorkers>=MIN_MAX_WORKERS&&savedMaxWorkers<=MAX_MAX_WORKERS
    ?savedMaxWorkers:DEFAULT_MAX_WORKERS;
  return {
    schemaVersion:1,
    updatedAt:settings.updatedAt||null,
    deleteAfterMinutes,
    maxWorkers,
    selectedTemplates:settings.selectedTemplates.filter(item=>item&&typeof item.name==='string'&&item.settings&&typeof item.settings==='object')
      .map(item=>({name:templateName(item.name),outputFormat:['jpg','jpeg'].includes(item.outputFormat)?'jpeg':'png',settings:cleanSettings(item.settings)})),
  };
}
async function writeAutomaticTemplateSettings(selectedTemplates,deleteAfterMinutes,maxWorkers) {
  const value={schemaVersion:1,updatedAt:new Date().toISOString(),deleteAfterMinutes,maxWorkers,selectedTemplates};
  const temporaryFile=path.join(AUTO_DIR,`template_settings.${randomUUID()}.tmp`);
  await fs.promises.writeFile(temporaryFile,`${JSON.stringify(value,null,2)}\n`,{flag:'wx'});
  await fs.promises.rename(temporaryFile,AUTO_SETTINGS_FILE);
  return value;
}
function safeFilePart(value) {
  return String(value||'').normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80)||'foto';
}
function scheduleDiskCleanup(id,expiresAt) {
  if(!/^[\da-f-]{36}$/i.test(id)||!Number.isFinite(expiresAt))return;
  const existing=automaticDeletionTimers.get(id);
  if(existing)clearTimeout(existing);
  const delay=Math.min(2_147_000_000,Math.max(0,expiresAt-Date.now()));
  const timer=setTimeout(()=>{
    automaticDeletionTimers.delete(id);
    if(expiresAt<=Date.now()){
      if(automaticJobs.get(id)?.downloadsInProgress)scheduleDiskCleanup(id,Date.now()+5_000);
      else void deleteAutomaticJobFiles(id);
    }
    else scheduleDiskCleanup(id,expiresAt);
  },delay);
  timer.unref();automaticDeletionTimers.set(id,timer);
}
async function deleteAutomaticJobFiles(id) {
  if(!/^[\da-f-]{36}$/i.test(id))return;
  automaticJobs.delete(id);
  const timer=automaticDeletionTimers.get(id);
  if(timer)clearTimeout(timer);
  automaticDeletionTimers.delete(id);
  await Promise.all([
    fs.promises.rm(path.join(AUTO_INPUT_DIR,id),{recursive:true,force:true}),
    fs.promises.rm(path.join(AUTO_OUTPUT_DIR,id),{recursive:true,force:true}),
  ]).catch(error=>{
    console.error('Pembersihan file pemrosesan otomatis gagal:',error.message);
    scheduleDiskCleanup(id,Date.now()+30_000);
  });
}
async function restoreAutomaticDeletionTimers() {
  try{
    const entries=await fs.promises.readdir(AUTO_INPUT_DIR,{withFileTypes:true});
    for(const entry of entries){
      if(!entry.isDirectory()||!/^[\da-f-]{36}$/i.test(entry.name))continue;
      try{
        const retention=JSON.parse(await fs.promises.readFile(path.join(AUTO_INPUT_DIR,entry.name,'retention.json'),'utf8'));
        scheduleDiskCleanup(entry.name,Number(retention.expiresAt));
      }catch{
        try{
          const [inputStats,outputStats]=await Promise.all([
            fs.promises.stat(path.join(AUTO_INPUT_DIR,entry.name)),
            fs.promises.stat(path.join(AUTO_OUTPUT_DIR,entry.name)).catch(()=>null),
          ]);
          const latestWrite=Math.max(inputStats.mtimeMs,outputStats?.mtimeMs||0);
          scheduleDiskCleanup(entry.name,latestWrite+DEFAULT_DELETE_AFTER_MINUTES*60_000);
        }catch{}
      }
    }
  }catch(error){console.error('Pemulihan timer penghapusan gagal:',error.message);}
}
async function setAutomaticJobExpiry(job) {
  job.completedAt=Date.now();
  job.expiresAt=job.completedAt+job.deleteAfterMinutes*60_000;
  job.updatedAt=job.completedAt;
  scheduleDiskCleanup(job.id,job.expiresAt);
  await writeAutomaticJobRetention(job);
}
async function writeAutomaticJobRetention(job) {
  const file=path.join(AUTO_INPUT_DIR,job.id,'retention.json');
  const temporary=`${file}.${randomUUID()}.tmp`;
  try{
    await fs.promises.writeFile(temporary,`${JSON.stringify({deleteAfterMinutes:job.deleteAfterMinutes,completedAt:job.completedAt,expiresAt:job.expiresAt},null,2)}\n`,{flag:'wx'});
    await fs.promises.rename(temporary,file);
  }catch(error){
    await fs.promises.rm(temporary,{force:true}).catch(()=>{});
    console.error(`Penyimpanan timer hapus untuk ${job.id} gagal:`,error.message);
  }
}
function automaticOutputsStatus(outputs) {
  if(outputs.some(output=>output.status==='processing'))return 'processing';
  if(outputs.some(output=>output.status==='queued'))return 'queued';
  if(!outputs.length)return 'waiting_for_upload';
  const completed=outputs.filter(output=>output.status==='done').length;
  return completed===outputs.length?'done':completed?'partial':'error';
}
function updateAutomaticJob(job) {
  const photos=job.photos.map(photo=>photo.status||automaticOutputsStatus(photo.outputs));
  job.status=job.pendingUploads?'uploading':photos.includes('processing')?'processing':photos.includes('queued')?'queued':automaticOutputsStatus(job.photos.flatMap(photo=>photo.outputs));
  job.updatedAt=Date.now();
}
function publicAutomaticJob(job) {
  const photos=job.photos.map(photo=>{
    const photoCompleted=photo.outputs.filter(output=>output.status==='done').length;
    return {
      photoId:photo.id,name:photo.name,status:photo.status||automaticOutputsStatus(photo.outputs),
      uploadedAt:new Date(photo.createdAt).toISOString(),completed:photoCompleted,total:photo.outputs.length,
      outputs:photo.outputs.map(output=>({
        id:output.id,templateName:output.templateName,status:output.status,error:output.error||null,
        fileName:output.fileName,
      })),
    };
  });
  const outputs=job.photos.flatMap(photo=>photo.outputs);
  const completed=outputs.filter(output=>output.status==='done').length;
  return {
    id:job.id,jobId:job.id,status:job.status,
    createdAt:new Date(job.createdAt).toISOString(),updatedAt:new Date(job.updatedAt).toISOString(),
    photoCount:job.photos.length,uploadsInProgress:job.pendingUploads,completed,total:outputs.length,
    deleteAfterMinutes:job.deleteAfterMinutes,selectedTemplates:job.selectedTemplates.map(template=>template.name),
    completedAt:job.completedAt?new Date(job.completedAt).toISOString():null,
    expiresAt:job.expiresAt?new Date(job.expiresAt).toISOString():null,
    downloadUrl:completed?`/api/automatic-processing/jobs/${job.id}/download`:null,photos,
  };
}
async function clearAutomaticJobExpiry(job) {
  const timer=automaticDeletionTimers.get(job.id);
  if(timer)clearTimeout(timer);
  automaticDeletionTimers.delete(job.id);
  job.expiresAt=null;job.completedAt=null;
  await fs.promises.rm(path.join(AUTO_INPUT_DIR,job.id,'retention.json'),{force:true}).catch(()=>{});
}
async function maybeFinishAutomaticJob(job) {
  updateAutomaticJob(job);
  if(job.pendingUploads)return;
  const outputs=job.photos.flatMap(photo=>photo.outputs);
  if(outputs.some(output=>output.status==='queued'||output.status==='processing'))return;
  if(job.expiresAt)return;
  if(job.photos.length)await setAutomaticJobExpiry(job);
}
function safeOriginalFileName(value) {
  let name=String(value||'foto');
  try{name=decodeURIComponent(name);}catch{}
  name=name.replace(/\\/g,'/').split('/').pop().replace(/[\x00-\x1f"<>:|?*]/g,'_').slice(0,160);
  return name||'foto';
}
function outputFileName(originalName,templateName,extension) {
  const parsed=path.parse(originalName);
  return `${parsed.name||'foto'} (${templateName}).${extension}`;
}
function outputExtensionFor(originalName,format) {
  const inputExtension=path.extname(originalName).slice(1);
  if(format==='jpeg'&&/^(jpe?g)$/i.test(inputExtension))return inputExtension;
  return format==='jpeg'?'jpg':'png';
}
function activeAutomaticPhotoCount() {
  let active=0;
  for(const job of automaticJobs.values()){
    active+=job.pendingUploads;
    active+=job.photos.filter(photo=>['queued','processing'].includes(photo.status||automaticOutputsStatus(photo.outputs))).length;
  }
  return active;
}
async function runAutomaticPhoto(job,photo) {
  const jobOutputDir=path.join(AUTO_OUTPUT_DIR,job.id,'photos',photo.id);
  const rawPath=path.join(AUTO_INPUT_DIR,job.id,'photos',`decoded-${photo.id}.rgba`);
  for(const output of photo.outputs)output.status='queued';
  photo.status='processing';updateAutomaticJob(job);
  try{
    const source=await automaticRenderer.decodeToRawFile(photo.inputPath,rawPath);
    photo.status='queued';updateAutomaticJob(job);
    await fs.promises.mkdir(jobOutputDir,{recursive:true});
    await Promise.all(photo.outputs.map(async output=>{
      const template=job.selectedTemplates.find(item=>item.name===output.templateName);
      try{
        await automaticRenderer.renderRawToFile(rawPath,output.path,source.width,source.height,template.settings,output.format,status=>{
          output.status=status;photo.status=automaticOutputsStatus(photo.outputs);updateAutomaticJob(job);
        });
        output.status='done';
      }catch(error){
        console.error(`Pemrosesan otomatis ${job.id}/${photo.id}/${output.id} gagal:`,error.message);
        output.status='error';output.error='Server tidak dapat memproses foto dengan template ini.';
      }
      photo.status=automaticOutputsStatus(photo.outputs);
      updateAutomaticJob(job);
    }));
  }catch(error){
    console.error(`Pemrosesan otomatis ${job.id}/${photo.id} gagal:`,error.message);
    for(const output of photo.outputs)if(output.status==='queued'||output.status==='processing'){
      output.status='error';output.error='Server tidak dapat memproses foto ini.';
    }
  }finally{
    await fs.promises.rm(rawPath,{force:true}).catch(()=>{});
  }
  photo.status=automaticOutputsStatus(photo.outputs);
  await maybeFinishAutomaticJob(job);
}
async function receiveAutomaticPhoto(req,job) {
  const contentType=String(req.headers['content-type']||'').toLowerCase().split(';')[0].trim();
  if(!contentType.startsWith('image/')&&contentType!=='application/octet-stream')
    return {status:415,body:{error:'Pilih file gambar untuk diproses.'}};
  if(activeAutomaticPhotoCount()>=MAX_ACTIVE_AUTO_PHOTOS)
    return {status:429,body:{error:'Antrean sedang penuh. Coba unggah kembali setelah sebagian proses selesai.'}};
  job.pendingUploads++;updateAutomaticJob(job);
  await clearAutomaticJobExpiry(job);
  const photoId=randomUUID();
  const inputDirectory=path.join(AUTO_INPUT_DIR,job.id,'photos');
  const uploadPath=path.join(inputDirectory,`${photoId}.upload`);
  let response={status:202,body:null};
  try{
    await pipeline(req,fs.createWriteStream(uploadPath,{flags:'wx'}));
    const inputStats=await fs.promises.stat(uploadPath);
    if(!inputStats.size)throw Object.assign(new Error('File gambar kosong.'),{status:400});
    let meta;
    try{meta=await sharp(uploadPath,{limitInputPixels:false,unlimited:true,failOn:'warning'}).metadata();}
    catch{throw Object.assign(new Error('Format gambar tidak didukung atau file rusak.'),{status:415});}
    if(!['jpeg','png','webp','avif','gif','tiff','heif'].includes(meta.format)||!meta.width||!meta.height)
      throw Object.assign(new Error('Format gambar ini belum didukung untuk pemrosesan otomatis.'),{status:415});
    if(!Number.isSafeInteger(meta.width*meta.height*4))
      throw Object.assign(new Error('Dimensi foto melebihi kapasitas pemrosesan file pada sistem ini.'),{status:413});
    const originalName=safeOriginalFileName(req.headers['x-file-name']||'foto');
    const inputExtension=meta.format==='heif'?(meta.compression==='av1'?'avif':'heic'):OUTPUT_EXTENSION[meta.format];
    const inputPath=path.join(inputDirectory,`${photoId}.${inputExtension}`);
    await fs.promises.rename(uploadPath,inputPath);
    const outputs=job.selectedTemplates.map(template=>{
      const outputId=randomUUID(),format=['jpg','jpeg'].includes(template.outputFormat)?'jpeg':'png';
      const outputExtension=outputExtensionFor(originalName,format);
      return {
        id:outputId,templateName:template.name,status:'queued',format,
        fileName:outputFileName(originalName,template.name,outputExtension),
        path:path.join(AUTO_OUTPUT_DIR,job.id,'photos',photoId,`${outputId}.${outputExtension}`),
      };
    });
    const photo={id:photoId,name:originalName,inputPath,createdAt:Date.now(),status:'queued',outputs};
    job.photos.push(photo);
    updateAutomaticJob(job);
    void runAutomaticPhoto(job,photo);
    response.body={jobId:job.id,photoId,name:originalName,status:photo.status,total:outputs.length};
  }catch(error){
    await fs.promises.rm(uploadPath,{force:true}).catch(()=>{});
    response={status:error.status||400,body:{error:error.status?error.message:'Unggahan foto terputus sebelum selesai.'}};
  }finally{
    job.pendingUploads--;
    await maybeFinishAutomaticJob(job);
  }
  return response;
}
async function api(req,res,url) {
  if(req.method==='GET'&&url==='/api/templates'){
    return json(res,200,{templates:await listTemplates()});
  }
  if(req.method==='POST'&&url==='/api/templates'){
    let body;
    try{body=JSON.parse((await readBody(req,8*1024*1024)).toString());}
    catch(error){return json(res,error.status||400,{error:'Data template tidak valid.'});}
    if(!body||typeof body!=='object'||Array.isArray(body))return json(res,400,{error:'Data template tidak valid.'});
    const name=templateName(body.name);
    if(!body.settings||typeof body.settings!=='object'||Array.isArray(body.settings))return json(res,400,{error:'Pengaturan template tidak valid.'});
    const filename=`${name}.nd`;
    const existing=await fs.promises.readdir(TEMPLATE_DIR);
    if(existing.some(entry=>entry.toLowerCase()===filename.toLowerCase()))return json(res,409,{error:'Nama template sudah digunakan. Pilih nama lain.'});
    const outputFormat=['png','jpg','jpeg'].includes(body.outputFormat)?body.outputFormat:'png';
    const template={schemaVersion:1,name,createdAt:new Date().toISOString(),outputFormat,settings:cleanSettings(body.settings)};
    try{await fs.promises.writeFile(path.join(TEMPLATE_DIR,filename),`${JSON.stringify(template,null,2)}\n`,{flag:'wx'});}
    catch(error){if(error.code==='EEXIST')return json(res,409,{error:'Nama template sudah digunakan. Pilih nama lain.'});throw error;}
    return json(res,201,{template});
  }
  if(req.method==='POST'&&url==='/api/templates/import'){
    let body;
    try{body=JSON.parse((await readBody(req,64*1024*1024)).toString());}
    catch(error){return json(res,error.status||400,{error:'File .nd tidak berisi JSON template yang valid.'});}
    try{return json(res,201,{templates:await importTemplates(body)});}
    catch(error){return json(res,error.status||400,{error:error.status?error.message:'Template tidak dapat diimpor.'});}
  }
  if(req.method==='DELETE'&&url.startsWith('/api/templates/')){
    let filename;
    try{filename=decodeURIComponent(url.slice('/api/templates/'.length));}
    catch{return json(res,400,{error:'Nama template tidak valid.'});}
    if(!filename.toLowerCase().endsWith('.nd'))return json(res,400,{error:'File template harus berekstensi .nd.'});
    const requestedName=templateName(filename.slice(0,-3));
    const entries=await fs.promises.readdir(TEMPLATE_DIR);
    const existing=entries.find(entry=>entry.toLowerCase()===`${requestedName}.nd`.toLowerCase());
    if(!existing)return json(res,404,{error:'Template tidak ditemukan.'});
    await fs.promises.unlink(path.join(TEMPLATE_DIR,existing));
    return json(res,200,{deleted:requestedName});
  }
  if(req.method==='GET'&&url==='/api/automatic-processing/templates'){
    const settings=await readAutomaticTemplateSettings();
    return json(res,200,settings);
  }
  if(req.method==='POST'&&url==='/api/automatic-processing/templates'){
    let body;
    try{body=JSON.parse((await readBody(req,1024*1024)).toString());}
    catch(error){return json(res,error.status||400,{error:'Pilihan template tidak valid.'});}
    if(!body||typeof body!=='object'||Array.isArray(body)||!Array.isArray(body.templateNames))return json(res,400,{error:'Pilihan template tidak valid.'});
    if(body.templateNames.length>20)return json(res,400,{error:'Maksimal 20 template dapat dipilih.'});
    const currentSettings=await readAutomaticTemplateSettings();
    const deleteAfterMinutes=body.deleteAfterMinutes===undefined?currentSettings.deleteAfterMinutes:Number(body.deleteAfterMinutes);
    const maxWorkers=body.maxWorkers===undefined?currentSettings.maxWorkers:Number(body.maxWorkers);
    if(!Number.isInteger(deleteAfterMinutes)||deleteAfterMinutes<MIN_DELETE_AFTER_MINUTES||deleteAfterMinutes>MAX_DELETE_AFTER_MINUTES)
      return json(res,400,{error:`Delete After harus diatur antara ${MIN_DELETE_AFTER_MINUTES} dan ${MAX_DELETE_AFTER_MINUTES} menit.`});
    if(!Number.isInteger(maxWorkers)||maxWorkers<MIN_MAX_WORKERS||maxWorkers>MAX_MAX_WORKERS)
      return json(res,400,{error:`Max Parallel Workers harus diatur antara ${MIN_MAX_WORKERS} dan ${MAX_MAX_WORKERS}.`});
    const available=await listTemplates();
    const selected=[];const seen=new Set();
    for(const rawName of body.templateNames){
      const name=templateName(rawName),key=name.toLowerCase();
      if(seen.has(key))continue;
      const template=available.find(item=>item.name.toLowerCase()===key);
      if(!template)return json(res,404,{error:`Template "${name}" tidak ditemukan.`});
      seen.add(key);
      selected.push({name:template.name,outputFormat:template.outputFormat,settings:template.settings});
    }
    const saved=await writeAutomaticTemplateSettings(selected,deleteAfterMinutes,maxWorkers);
    automaticRenderer.setMaxWorkers(maxWorkers);
    return json(res,200,saved);
  }
  if(req.method==='POST'&&url==='/api/automatic-processing/jobs'){
    const contentType=String(req.headers['content-type']||'').toLowerCase().split(';')[0].trim();
    if(!contentType.startsWith('image/')&&contentType!=='application/octet-stream')return json(res,415,{error:'Pilih file gambar untuk diproses.'});
    const selection=await readAutomaticTemplateSettings();
    if(!selection.selectedTemplates.length)return json(res,400,{error:'Pilih dan simpan minimal satu template terlebih dahulu.'});
    const id=randomUUID(),now=Date.now();
    const job={
      id,status:'uploading',createdAt:now,updatedAt:now,completedAt:null,expiresAt:null,
      deleteAfterMinutes:selection.deleteAfterMinutes,selectedTemplates:selection.selectedTemplates,
      photos:[],pendingUploads:0,downloadsInProgress:0,
    };
    automaticJobs.set(id,job);
    try{
      await Promise.all([
        fs.promises.mkdir(path.join(AUTO_INPUT_DIR,id,'photos'),{recursive:true}),
        fs.promises.mkdir(path.join(AUTO_OUTPUT_DIR,id,'photos'),{recursive:true}),
      ]);
    }catch(error){
      automaticJobs.delete(id);
      await Promise.all([
        fs.promises.rm(path.join(AUTO_INPUT_DIR,id),{recursive:true,force:true}),
        fs.promises.rm(path.join(AUTO_OUTPUT_DIR,id),{recursive:true,force:true}),
      ]);
      throw error;
    }
    const response=await receiveAutomaticPhoto(req,job);
    if(response.status!==202){
      await deleteAutomaticJobFiles(id);
      return json(res,response.status,response.body);
    }
    return json(res,response.status,response.body);
  }
  const photoUploadMatch=url.match(/^\/api\/automatic-processing\/jobs\/([\da-f-]{36})\/photos$/i);
  if(req.method==='POST'&&photoUploadMatch){
    const job=automaticJobs.get(photoUploadMatch[1]);
    if(!job)return json(res,404,{error:'ID proses tidak ditemukan atau sudah kedaluwarsa.'});
    if(job.expiresAt&&job.expiresAt<=Date.now()){
      if(!job.downloadsInProgress)await deleteAutomaticJobFiles(job.id);
      return json(res,404,{error:'ID proses tidak ditemukan atau sudah kedaluwarsa.'});
    }
    const response=await receiveAutomaticPhoto(req,job);
    return json(res,response.status,response.body);
  }
  const statusMatch=url.match(/^\/api\/automatic-processing\/jobs\/([\da-f-]{36})\/status$/i);
  if(req.method==='GET'&&statusMatch){
    const job=automaticJobs.get(statusMatch[1]);
    if(!job)return json(res,404,{error:'ID proses tidak ditemukan atau sudah kedaluwarsa.'});
    if(job.expiresAt&&job.expiresAt<=Date.now()){
      if(!job.downloadsInProgress)await deleteAutomaticJobFiles(job.id);
      return json(res,404,{error:'ID proses tidak ditemukan atau sudah kedaluwarsa.'});
    }
    updateAutomaticJob(job);
    return json(res,200,{...publicAutomaticJob(job),parallelWorkers:automaticRenderer.maxWorkers});
  }
  const downloadMatch=url.match(/^\/api\/automatic-processing\/jobs\/([\da-f-]{36})\/download$/i);
  if(req.method==='GET'&&downloadMatch){
    const job=automaticJobs.get(downloadMatch[1]);
    if(!job)return json(res,404,{error:'ID proses tidak ditemukan atau sudah kedaluwarsa.'});
    if(job.expiresAt&&job.expiresAt<=Date.now()){
      if(!job.downloadsInProgress)await deleteAutomaticJobFiles(job.id);
      return json(res,404,{error:'ID proses tidak ditemukan atau sudah kedaluwarsa.'});
    }
    const completedPhotos=job.photos.filter(photo=>photo.outputs.some(output=>output.status==='done'));
    if(!completedPhotos.length)return json(res,409,{error:'Belum ada hasil foto yang selesai untuk diunduh.'});
    const {ZipArchive}=await import('archiver');
    const archive=new ZipArchive({zlib:{level:0}});
    archive.on('warning',error=>{
      console.warn(`Peringatan ZIP ${job.id}:`,error.message);
      if(error.code==='ENOENT'&& !res.destroyed)res.destroy(error);
    });
    archive.on('error',error=>{
      console.error(`Pembuatan ZIP ${job.id} gagal:`,error.message);
      if(!res.headersSent)json(res,500,{error:'Hasil foto tidak dapat dikemas untuk diunduh.'});
      else res.destroy(error);
    });
    res.writeHead(200,{
      'Content-Type':'application/zip','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
      'Content-Disposition':`attachment; filename="NiDi_AutoColor_${job.id}.zip"`,
    });
    job.downloadsInProgress++;
    let downloadReleased=false;
    const releaseDownload=()=>{
      if(downloadReleased)return;
      downloadReleased=true;
      job.downloadsInProgress=Math.max(0,job.downloadsInProgress-1);
    };
    res.once('finish',releaseDownload);
    res.once('close',releaseDownload);
    archive.pipe(res);
    const usedFolders=new Map();
    for(const photo of completedPhotos){
      const base=safeFilePart(path.parse(photo.name).name);
      const count=(usedFolders.get(base)||0)+1;usedFolders.set(base,count);
      const folder=count===1?base:`${base} (${count})`;
      for(const output of photo.outputs)if(output.status==='done')
        archive.file(output.path,{name:path.posix.join(folder,output.fileName)});
    }
    return archive.finalize();
  }
  return json(res,404,{error:'API tidak ditemukan.'});
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.wasm':'application/wasm','.svg':'image/svg+xml','.ico':'image/x-icon'};
function staticFile(req,res,pathname){let decoded;try{decoded=decodeURIComponent(pathname);}catch{res.writeHead(400);return res.end('Bad request');}
  const file=path.resolve(PUBLIC_DIR,decoded==='/'?'index.html':decoded.replace(/^\/+/,'')),prefix=PUBLIC_DIR+path.sep;
  if(file.toLowerCase()!==PUBLIC_DIR.toLowerCase()&&!file.toLowerCase().startsWith(prefix.toLowerCase())){res.writeHead(403);return res.end('Forbidden');}
  fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);});
}
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/')){api(req,res,url.pathname).catch(e=>{if(!res.headersSent&&!res.destroyed)json(res,e.status||500,{error:e.status?e.message:'Terjadi kesalahan di server.'});});return;}if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end('Method not allowed');}staticFile(req,res,url.pathname);});
void migrateLegacyTemplates().then(async()=>{
  const settings=await readAutomaticTemplateSettings();
  automaticRenderer.setMaxWorkers(settings.maxWorkers);
  server.listen(PORT,()=>console.log(`NiDi AutoColor berjalan di http://localhost:${PORT}`));
}).catch(error=>{console.error('Inisialisasi server gagal:',error.message);process.exitCode=1;});
