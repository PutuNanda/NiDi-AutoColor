const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { randomUUID } = require('node:crypto');
const sharp = require('sharp');
const automaticRenderer = require('./Automatic_Processing/auto_render');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const TEMPLATE_DIR = path.join(__dirname, 'Template');
const AUTO_DIR = path.join(__dirname, 'Automatic_Processing');
const AUTO_INPUT_DIR = path.join(AUTO_DIR, 'input');
const AUTO_OUTPUT_DIR = path.join(AUTO_DIR, 'output');
const AUTO_SETTINGS_FILE = path.join(AUTO_DIR, 'template_settings.json');
const MAX_UPLOAD = 35 * 1024 * 1024;
const MAX_PIXELS = 80_000_000;
const TTL = 30 * 60 * 1000;
const AUTO_JOB_TTL = 6 * 60 * 60 * 1000;
const MAX_AUTO_JOBS = 100;
const images = new Map();
const automaticJobs = new Map();
fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
fs.mkdirSync(AUTO_INPUT_DIR, { recursive: true });
fs.mkdirSync(AUTO_OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(AUTO_SETTINGS_FILE)) {
  fs.writeFileSync(AUTO_SETTINGS_FILE, `${JSON.stringify({ schemaVersion: 1, updatedAt: null, selectedTemplates: [] }, null, 2)}\n`);
}
setInterval(() => {
  const now = Date.now();
  for (const [id, item] of images) if (now - item.created > TTL) images.delete(id);
  for (const [id, job] of automaticJobs) {
    if (Date.now() - job.createdAt > AUTO_JOB_TTL && !['queued', 'processing'].includes(job.status)) {
      automaticJobs.delete(id);
      void Promise.all([
        fs.promises.rm(path.join(AUTO_INPUT_DIR, id), { recursive: true, force: true }),
        fs.promises.rm(path.join(AUTO_OUTPUT_DIR, id), { recursive: true, force: true }),
      ]).catch(error => console.error('Pembersihan file pemrosesan otomatis gagal:', error.message));
    }
  }
}, 60_000).unref();
const bands = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'];
const bandHue = [0, 30, 60, 120, 180, 220, 275, 325];
const OUTPUT_MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', tiff: 'image/tiff', gif: 'image/gif' };
const OUTPUT_EXTENSION = { jpeg: 'jpg', png: 'png', webp: 'webp', avif: 'avif', tiff: 'tiff', gif: 'gif' };
function chooseOutputFormat(meta) {
  if (meta.format === 'heif') return meta.compression === 'av1' ? 'avif' : 'jpeg';
  return Object.hasOwn(OUTPUT_MIME, meta.format) ? meta.format : 'png';
}

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
  return out;
}
function smooth(a,b,x) { const t = Math.max(0,Math.min(1,(x-a)/(b-a || 1))); return t*t*(3-2*t); }
function rgbHsl(r,g,b) {
  const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min, l=(max+min)/2; let h=0,s=0;
  if(d){s=d/(1-Math.abs(2*l-1)); if(max===r)h=((g-b)/d)%6; else if(max===g)h=(b-r)/d+2; else h=(r-g)/d+4; h=(h*60+360)%360;}
  return [h,s,l];
}
function hslRgb(h,s,l) {
  const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m=l-c/2; let a,b,d;
  if(h<60)[a,b,d]=[c,x,0]; else if(h<120)[a,b,d]=[x,c,0]; else if(h<180)[a,b,d]=[0,c,x]; else if(h<240)[a,b,d]=[0,x,c]; else if(h<300)[a,b,d]=[x,0,c]; else [a,b,d]=[c,0,x];
  return [a+m,b+m,d+m];
}
function curveTable(points) {
  const lut = new Float32Array(256);
  for(let i=0;i<256;i++){
    const x=i/255;let segment=0;
    while(segment<points.length-2&&x>points[segment+1].x)segment++;
    const left=points[segment],right=points[segment+1],t=Math.max(0,Math.min(1,(x-left.x)/(right.x-left.x||1)));
    lut[i]=(left.y*(1-t)+right.y*t)*255;
  }
  return lut;
}
function histogramHeader(data) {
  const bins=Array(64).fill(0);
  for(let i=0;i<data.length;i+=4){const y=data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722;bins[Math.min(63,Math.floor(y/256*64))]++;}
  const max=Math.max(1,...bins);return bins.map(value=>Math.round(value/max*1000)).join(',');
}
function luma(data,i){return data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722;}
function processPixels(data,w,h,s) {
  const curves=Object.fromEntries(['master','red','green','blue'].map(channel=>[channel,curveTable(s.curves[channel])]));
  const hslActive=bands.some(k=>Object.values(s.hsl[k]).some(Boolean));
  const wheelNames=['shadows','midtones','highlights'];
  const wheelRgb=wheelNames.map(k=>hslRgb(s.wheels[k].hue,1,.5));
  const zones=[s.wheels.shadows,s.wheels.midtones,s.wheels.highlights];
  const contrast=1+s.contrast/100, exposure=2**(s.exposure/50), bright=s.brightness*.35;
  const start=s.vignetteMidpoint/100*.8, falloff=1+s.vignetteFeather/30, vig=s.vignette/100, roundness=(s.vignetteRoundness+100)/200;
  for(let y=0;y<h;y++){
    const ny=y/Math.max(1,h-1)*2-1;
    for(let x=0;x<w;x++){
      const i=(y*w+x)*4; let r=data[i],g=data[i+1],b=data[i+2];
      r+=s.temperature*.42+s.tint*.12; g-=s.tint*.32; b-=s.temperature*.42-s.tint*.12;
      r=((r-127.5)*contrast+127.5+bright)*exposure; g=((g-127.5)*contrast+127.5+bright)*exposure; b=((b-127.5)*contrast+127.5+bright)*exposure;
      let lum=(r*.2126+g*.7152+b*.0722)/255;
      const tonal=s.shadows*(1-smooth(.12,.62,lum))*.65+s.highlights*smooth(.38,.92,lum)*.55+s.blacks*(1-smooth(.04,.35,lum))*.35+s.whites*smooth(.66,.98,lum)*.35;
      r+=tonal;g+=tonal;b+=tonal;
      r=curves.master[Math.max(0,Math.min(255,Math.round(r)))];
      g=curves.master[Math.max(0,Math.min(255,Math.round(g)))];
      b=curves.master[Math.max(0,Math.min(255,Math.round(b)))];
      r=curves.red[Math.max(0,Math.min(255,Math.round(r)))];
      g=curves.green[Math.max(0,Math.min(255,Math.round(g)))];
      b=curves.blue[Math.max(0,Math.min(255,Math.round(b)))];
      if(s.hue||s.saturation||hslActive){
        let [hue,sat,light]=rgbHsl(Math.max(0,Math.min(255,r))/255,Math.max(0,Math.min(255,g))/255,Math.max(0,Math.min(255,b))/255);
        hue=(hue+s.hue+360)%360; sat=Math.max(0,Math.min(1,sat*(1+s.saturation/100)));
        if(hslActive) for(let k=0;k<bands.length;k++){let d=Math.abs(hue-bandHue[k]);d=Math.min(d,360-d);const weight=Math.max(0,1-d/38);if(!weight)continue;const a=s.hsl[bands[k]];hue=(hue+a.h*.35*weight+360)%360;sat=Math.max(0,Math.min(1,sat*(1+a.s/100*weight)));light=Math.max(0,Math.min(1,light+a.l/100*.3*weight));}
        [r,g,b]=hslRgb(hue,sat,light).map(v=>v*255);
      }
      lum=(r*.2126+g*.7152+b*.0722)/255;
      const zw=[1-smooth(.18,.52,lum),1-Math.abs(smooth(.08,.55,lum)-smooth(.48,.92,lum)),smooth(.45,.88,lum)];
      for(let k=0;k<3;k++){const wheel=zones[k],amount=wheel.amount*zw[k]*.38,color=wheelRgb[k];r=r*(1-amount)+color[0]*255*amount;g=g*(1-amount)+color[1]*255*amount;b=b*(1-amount)+color[2]*255*amount;const lift=wheel.luminance*zw[k]*.42;r+=lift;g+=lift;b+=lift;}
      if(vig){const nx=x/Math.max(1,w-1)*2-1,circle=Math.sqrt(nx*nx+ny*ny)/Math.SQRT2,square=Math.max(Math.abs(nx),Math.abs(ny)),rad=square*(1-roundness)+circle*roundness,edge=Math.max(0,Math.min(1,(rad-start)/(1-start))),v=1-vig*(edge**falloff)*.72;r*=v;g*=v;b*=v;}
      data[i]=Math.max(0,Math.min(255,r));data[i+1]=Math.max(0,Math.min(255,g));data[i+2]=Math.max(0,Math.min(255,b));
    }
  }
  if(s.texture||s.clarity){
    const src=Uint8Array.from(data), tex=s.texture/100*.85, clear=s.clarity/100*.55;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,c=luma(src,i);let near=0,far=0,nc=0,fc=0;
      for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h){near+=luma(src,(yy*w+xx)*4);nc++;}}
      for(const [dx,dy] of [[-4,0],[4,0],[0,-4],[0,4]]){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h){far+=luma(src,(yy*w+xx)*4);fc++;}}
      const d=tex*(c-near/Math.max(1,nc))+clear*(c-far/Math.max(1,fc));for(let ch=0;ch<3;ch++)data[i+ch]=Math.max(0,Math.min(255,data[i+ch]+d));
    }
  }
}
async function rawImage(item) {
  return sharp(item.buffer,{limitInputPixels:MAX_PIXELS,failOn:'warning'}).rotate().ensureAlpha().raw().toBuffer({resolveWithObject:true});
}
async function render(item, settings, preview, format) {
  const {data,info}=await rawImage(item), pixels=Buffer.from(data); processPixels(pixels,info.width,info.height,cleanSettings(settings));
  const histogram=preview?histogramHeader(pixels):undefined;
  let output=sharp(pixels,{raw:{width:info.width,height:info.height,channels:info.channels}});
  if(format==='jpeg')output=output.flatten({background:'#11110f'}).jpeg({quality:94,mozjpeg:true});
  else if(format==='webp')output=output.webp({quality:94});
  else if(format==='avif')output=output.avif({quality:78,effort:4});
  else if(format==='tiff')output=output.tiff({quality:94,compression:'lzw'});
  else if(format==='gif')output=output.gif({effort:5});
  else output=output.png({compressionLevel:preview?3:6});
  return {buffer:await output.toBuffer(),width:info.width,height:info.height,histogram,format};
}
async function listTemplates() {
  const entries=await fs.promises.readdir(TEMPLATE_DIR,{withFileTypes:true});
  const templates=[];
  for(const entry of entries){
    if(!entry.isFile()||!entry.name.toLowerCase().endsWith('.json'))continue;
    try{
      const filename=path.join(TEMPLATE_DIR,entry.name);
      const stats=await fs.promises.stat(filename);
      if(stats.size>256*1024)continue;
      const data=JSON.parse(await fs.promises.readFile(filename,'utf8'));
      const name=templateName(data.name);
      if(`${name}.json`.toLowerCase()!==entry.name.toLowerCase()||!data.settings||typeof data.settings!=='object'||Array.isArray(data.settings))continue;
      const outputFormat=['png','jpg','jpeg'].includes(data.outputFormat)?data.outputFormat:'png';
      templates.push({name,createdAt:String(data.createdAt||stats.mtime.toISOString()),outputFormat,settings:cleanSettings(data.settings)});
    }catch{}
  }
  templates.sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'}));
  return templates;
}
async function readAutomaticTemplateSettings() {
  const settings=JSON.parse(await fs.promises.readFile(AUTO_SETTINGS_FILE,'utf8'));
  if(!settings||!Array.isArray(settings.selectedTemplates))throw new Error('File template_settings.json tidak valid.');
  return {
    schemaVersion:1,
    updatedAt:settings.updatedAt||null,
    selectedTemplates:settings.selectedTemplates.filter(item=>item&&typeof item.name==='string'&&item.settings&&typeof item.settings==='object')
      .map(item=>({name:templateName(item.name),outputFormat:['jpg','jpeg'].includes(item.outputFormat)?'jpeg':'png',settings:cleanSettings(item.settings)})),
  };
}
async function writeAutomaticTemplateSettings(selectedTemplates) {
  const value={schemaVersion:1,updatedAt:new Date().toISOString(),selectedTemplates};
  const temporaryFile=path.join(AUTO_DIR,`template_settings.${randomUUID()}.tmp`);
  await fs.promises.writeFile(temporaryFile,`${JSON.stringify(value,null,2)}\n`,{flag:'wx'});
  await fs.promises.rename(temporaryFile,AUTO_SETTINGS_FILE);
  return value;
}
function safeFilePart(value) {
  return String(value||'').normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80)||'foto';
}
function publicAutomaticJob(job) {
  return {
    id:job.id,jobId:job.id,name:job.name,status:job.status,createdAt:new Date(job.createdAt).toISOString(),
    updatedAt:new Date(job.updatedAt).toISOString(),completed:job.completed,total:job.outputs.length,
    outputs:job.outputs.map(output=>({
      id:output.id,templateName:output.templateName,status:output.status,error:output.error||null,
      fileName:output.fileName,
      downloadUrl:output.status==='done'?`/api/automatic-processing/jobs/${job.id}/outputs/${output.id}`:null,
    })),
  };
}
async function runAutomaticJob(job) {
  job.status='processing';job.updatedAt=Date.now();
  const jobOutputDir=path.join(AUTO_OUTPUT_DIR,job.id);
  const rawPath=path.join(path.dirname(job.inputPath),`decoded-${job.id}.rgba`);
  try{
    const source=await automaticRenderer.decodeToRawFile(job.inputPath,rawPath);
    job.width=source.width;job.height=source.height;
    await fs.promises.mkdir(jobOutputDir,{recursive:true});
    await Promise.all(job.outputs.map(async output=>{
      output.status='processing';job.updatedAt=Date.now();
      const template=job.selectedTemplates.find(item=>item.name===output.templateName);
      try{
        await automaticRenderer.renderRawToFile(rawPath,output.path,source.width,source.height,template.settings,output.format);
        output.status='done';
      }catch(error){
        console.error(`Pemrosesan otomatis ${job.id}/${output.id} gagal:`,error.message);
        output.status='error';output.error='Server tidak dapat memproses foto dengan template ini.';
      }
      job.completed++;job.updatedAt=Date.now();
    }));
  }finally{
    await fs.promises.rm(rawPath,{force:true}).catch(()=>{});
  }
  const successes=job.outputs.filter(output=>output.status==='done').length;
  job.status=successes===job.outputs.length?'done':successes?'partial':'error';
  job.updatedAt=Date.now();
}
async function api(req,res,url) {
  if(req.method==='GET'&&url==='/api/templates'){
    return json(res,200,{templates:await listTemplates()});
  }
  if(req.method==='POST'&&url==='/api/templates'){
    let body;
    try{body=JSON.parse((await readBody(req,256*1024)).toString());}
    catch(error){return json(res,error.status||400,{error:'Data template tidak valid.'});}
    if(!body||typeof body!=='object'||Array.isArray(body))return json(res,400,{error:'Data template tidak valid.'});
    const name=templateName(body.name);
    if(!body.settings||typeof body.settings!=='object'||Array.isArray(body.settings))return json(res,400,{error:'Pengaturan template tidak valid.'});
    const filename=`${name}.json`;
    const existing=await fs.promises.readdir(TEMPLATE_DIR);
    if(existing.some(entry=>entry.toLowerCase()===filename.toLowerCase()))return json(res,409,{error:'Nama template sudah digunakan. Pilih nama lain.'});
    const outputFormat=['png','jpg','jpeg'].includes(body.outputFormat)?body.outputFormat:'png';
    const template={schemaVersion:1,name,createdAt:new Date().toISOString(),outputFormat,settings:cleanSettings(body.settings)};
    try{await fs.promises.writeFile(path.join(TEMPLATE_DIR,filename),`${JSON.stringify(template,null,2)}\n`,{flag:'wx'});}
    catch(error){if(error.code==='EEXIST')return json(res,409,{error:'Nama template sudah digunakan. Pilih nama lain.'});throw error;}
    return json(res,201,{template});
  }
  if(req.method==='DELETE'&&url.startsWith('/api/templates/')){
    let filename;
    try{filename=decodeURIComponent(url.slice('/api/templates/'.length));}
    catch{return json(res,400,{error:'Nama template tidak valid.'});}
    if(!filename.toLowerCase().endsWith('.json'))return json(res,400,{error:'File template harus berekstensi .json.'});
    const requestedName=templateName(filename.slice(0,-5));
    const entries=await fs.promises.readdir(TEMPLATE_DIR);
    const existing=entries.find(entry=>entry.toLowerCase()===`${requestedName}.json`.toLowerCase());
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
    const saved=await writeAutomaticTemplateSettings(selected);
    return json(res,200,saved);
  }
  if(req.method==='GET'&&url==='/api/automatic-processing/jobs'){
    const jobs=[...automaticJobs.values()].sort((a,b)=>b.createdAt-a.createdAt).map(publicAutomaticJob);
    return json(res,200,{jobs,parallelWorkers:automaticRenderer.maxWorkers});
  }
  if(req.method==='POST'&&url==='/api/automatic-processing/jobs'){
    const contentType=String(req.headers['content-type']||'').toLowerCase().split(';')[0].trim();
    if(!contentType.startsWith('image/')&&contentType!=='application/octet-stream')return json(res,415,{error:'Pilih file gambar untuk diproses.'});
    let originalName=String(req.headers['x-file-name']||'foto');
    try{originalName=decodeURIComponent(originalName);}catch{}
    originalName=path.basename(originalName.replace(/\\/g,'/')).replace(/[\x00-\x1f"<>:|?*]/g,'_').slice(0,160)||'foto';
    const stem=path.basename(originalName,path.extname(originalName));
    const id=randomUUID();
    const inputDirectory=path.join(AUTO_INPUT_DIR,id);
    await fs.promises.mkdir(inputDirectory,{recursive:true});
    const uploadPath=path.join(inputDirectory,`${safeFilePart(stem)||'foto'}.upload`);
    try{await pipeline(req,fs.createWriteStream(uploadPath,{flags:'wx'}));}
    catch(error){
      await fs.promises.rm(inputDirectory,{recursive:true,force:true});
      if(!res.headersSent)return json(res,400,{error:'Unggahan foto terputus sebelum selesai.'});
      throw error;
    }
    const inputStats=await fs.promises.stat(uploadPath);
    if(!inputStats.size){await fs.promises.rm(inputDirectory,{recursive:true,force:true});return json(res,400,{error:'File gambar kosong.'});}
    let meta;
    try{meta=await sharp(uploadPath,{limitInputPixels:false,unlimited:true,failOn:'warning'}).metadata();}
    catch{await fs.promises.rm(inputDirectory,{recursive:true,force:true});return json(res,415,{error:'Format gambar tidak didukung atau file rusak.'});}
    if(!['jpeg','png','webp','avif','gif','tiff','heif'].includes(meta.format)||!meta.width||!meta.height){
      await fs.promises.rm(inputDirectory,{recursive:true,force:true});
      return json(res,415,{error:'Format gambar ini belum didukung untuk pemrosesan otomatis.'});
    }
    if(!Number.isSafeInteger(meta.width*meta.height*4)){
      await fs.promises.rm(inputDirectory,{recursive:true,force:true});
      return json(res,413,{error:'Dimensi foto melebihi kapasitas pemrosesan file pada sistem ini.'});
    }
    const inputExtension=meta.format==='heif'?(meta.compression==='av1'?'avif':'heic'):OUTPUT_EXTENSION[meta.format];
    const inputPath=path.join(inputDirectory,`${safeFilePart(stem)||'foto'}.${inputExtension}`);
    await fs.promises.rename(uploadPath,inputPath);
    const selection=await readAutomaticTemplateSettings();
    if(!selection.selectedTemplates.length){await fs.promises.rm(inputDirectory,{recursive:true,force:true});return json(res,400,{error:'Pilih dan simpan minimal satu template terlebih dahulu.'});}
    if(automaticJobs.size>=MAX_AUTO_JOBS){
      const removable=[...automaticJobs.values()].filter(job=>!['queued','processing'].includes(job.status)).sort((a,b)=>a.createdAt-b.createdAt)[0];
      if(!removable){await fs.promises.rm(inputDirectory,{recursive:true,force:true});return json(res,429,{error:'Antrean penuh. Tunggu proses yang berjalan selesai terlebih dahulu.'});}
      automaticJobs.delete(removable.id);
      await Promise.all([
        fs.promises.rm(path.join(AUTO_INPUT_DIR,removable.id),{recursive:true,force:true}),
        fs.promises.rm(path.join(AUTO_OUTPUT_DIR,removable.id),{recursive:true,force:true}),
      ]);
    }
    const now=Date.now();
    const outputs=selection.selectedTemplates.map(template=>{
      const resultId=randomUUID(),format=['jpg','jpeg'].includes(template.outputFormat)?'jpeg':'png';
      const outputExtension=format==='jpeg'?'jpg':'png';
      return {
        id:resultId,templateName:template.name,status:'queued',format,
        fileName:`NiDi_${safeFilePart(stem)}_${safeFilePart(template.name)}.${outputExtension}`,
        path:path.join(AUTO_OUTPUT_DIR,id,`${resultId}.${outputExtension}`),
      };
    });
    const job={id,name:originalName,status:'queued',createdAt:now,updatedAt:now,completed:0,inputPath,selectedTemplates:selection.selectedTemplates,outputs};
    automaticJobs.set(id,job);
    void runAutomaticJob(job).catch(error=>{
      console.error(`Proses otomatis ${id} gagal:`,error.message);
      for(const output of job.outputs)if(output.status==='queued'||output.status==='processing'){
        output.status='error';output.error='Server tidak dapat memproses foto ini.';job.completed++;
      }
      job.status='error';job.updatedAt=Date.now();
    });
    return json(res,202,publicAutomaticJob(job));
  }
  const outputMatch=url.match(/^\/api\/automatic-processing\/jobs\/([\da-f-]{36})\/outputs\/([\da-f-]{36})$/i);
  if(req.method==='GET'&&outputMatch){
    const job=automaticJobs.get(outputMatch[1]);
    const output=job?.outputs.find(item=>item.id===outputMatch[2]);
    if(!output)return json(res,404,{error:'Hasil pemrosesan tidak ditemukan.'});
    if(output.status!=='done')return json(res,409,{error:'Hasil belum siap diunduh.'});
    const type=output.format==='jpeg'?'image/jpeg':'image/png';
    res.writeHead(200,{'Content-Type':type,'Content-Length':(await fs.promises.stat(output.path)).size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`attachment; filename="${output.fileName}"`});
    return fs.createReadStream(output.path).pipe(res);
  }
  const jobMatch=url.match(/^\/api\/automatic-processing\/jobs\/([\da-f-]{36})$/i);
  if(req.method==='GET'&&jobMatch){
    const job=automaticJobs.get(jobMatch[1]);
    return job?json(res,200,publicAutomaticJob(job)):json(res,404,{error:'Proses tidak ditemukan.'});
  }
  if(req.method==='POST'&&url==='/api/upload'){
    if(!String(req.headers['content-type']||'').toLowerCase().startsWith('image/'))return json(res,415,{error:'Pilih file gambar untuk diimpor.'});
    const buffer=await readBody(req,MAX_UPLOAD);if(!buffer.length)return json(res,400,{error:'File gambar kosong.'});
    let meta;try{meta=await sharp(buffer,{limitInputPixels:MAX_PIXELS,failOn:'warning'}).metadata();}catch{return json(res,415,{error:'Format gambar tidak didukung atau file rusak.'});}
    if(!['jpeg','png','webp','avif','gif','tiff','heif'].includes(meta.format))return json(res,415,{error:'Format gambar ini belum didukung.'});
    const swap=[5,6,7,8].includes(meta.orientation||1);if(!meta.width||!meta.height)return json(res,415,{error:'Dimensi foto tidak terbaca.'});
    for(const [id,item] of images)if(Date.now()-item.created>TTL)images.delete(id);
    while(images.size>=8)images.delete(images.keys().next().value);
    const id=randomUUID(),name=path.basename(String(req.headers['x-file-name']||'foto').slice(0,200)).replace(/[\r\n"\\]/g,'')||'foto';
    const outputFormat=chooseOutputFormat(meta),outputExtension=OUTPUT_EXTENSION[outputFormat];
    images.set(id,{buffer,name,outputFormat,outputExtension,created:Date.now()});
    return json(res,201,{imageId:id,width:swap?meta.height:meta.width,height:swap?meta.width:meta.height,outputExtension});
  }
  if(req.method==='POST'&&(url==='/api/preview'||url==='/api/export')){
    let body;try{body=JSON.parse((await readBody(req,1024*1024)).toString());}catch(e){return json(res,e.status||400,{error:'Permintaan edit tidak valid.'});}
    const item=images.get(String(body.imageId||''));if(!item||Date.now()-item.created>TTL){if(item)images.delete(String(body.imageId));return json(res,404,{error:'Foto di server sudah kedaluwarsa. Impor ulang untuk melanjutkan.'});}
    item.created=Date.now();
    try{
      let result; const isPreview=url==='/api/preview'; const isOriginal=isPreview&&body.original;
      if(isOriginal){const {data,info}=await rawImage(item),histogram=histogramHeader(data),buffer=await sharp(data,{raw:{width:info.width,height:info.height,channels:info.channels}}).png({compressionLevel:3}).toBuffer();result={buffer,width:info.width,height:info.height,histogram,format:'png'};}
      else result=await render(item,body.settings,isPreview,isPreview?'png':item.outputFormat);
      const type=OUTPUT_MIME[result.format]||'image/png';
      const headers={'Content-Type':type,'Cache-Control':'no-store','X-Image-Width':result.width,'X-Image-Height':result.height,'X-Histogram':result.histogram||''};
      if(!isPreview){headers['X-Output-Extension']=item.outputExtension;headers['Content-Disposition']=`attachment; filename="NiDi-AutoColor.${item.outputExtension}"`;}
      res.writeHead(200,headers);return res.end(result.buffer);
    }catch(e){console.error('Pemrosesan gambar gagal:',e.message);return json(res,422,{error:'Server tidak dapat memproses foto ini.'});}
  }
  return json(res,404,{error:'API tidak ditemukan.'});
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.wasm':'application/wasm','.svg':'image/svg+xml','.ico':'image/x-icon'};
function staticFile(req,res,pathname){let decoded;try{decoded=decodeURIComponent(pathname);}catch{res.writeHead(400);return res.end('Bad request');}
  const file=path.resolve(PUBLIC_DIR,decoded==='/'?'index.html':decoded.replace(/^\/+/,'')),prefix=PUBLIC_DIR+path.sep;
  if(file.toLowerCase()!==PUBLIC_DIR.toLowerCase()&&!file.toLowerCase().startsWith(prefix.toLowerCase())){res.writeHead(403);return res.end('Forbidden');}
  fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);});
}
http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/')){api(req,res,url.pathname).catch(e=>{if(!res.headersSent&&!res.destroyed)json(res,e.status||500,{error:e.status?e.message:'Terjadi kesalahan di server.'});});return;}if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end('Method not allowed');}staticFile(req,res,url.pathname);}).listen(PORT,()=>console.log(`NiDi AutoColor berjalan di http://localhost:${PORT}`));
