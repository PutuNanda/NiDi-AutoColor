const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const sharp = require('sharp');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_UPLOAD = 35 * 1024 * 1024;
const MAX_PIXELS = 80_000_000;
const TTL = 30 * 60 * 1000;
const images = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [id, item] of images) if (now - item.created > TTL) images.delete(id);
}, 60_000).unref();
const bands = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'];
const bandHue = [0, 30, 60, 120, 180, 220, 275, 325];

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
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
  const keys = { temperature: [-100,100], tint: [-100,100], hue: [-180,180], contrast: [-100,100], brightness: [-100,100], exposure: [-100,100], highlights: [-100,100], shadows: [-100,100], whites: [-100,100], blacks: [-100,100], texture: [-100,100], clarity: [-100,100], saturation: [-100,100], vignette: [-100,100], vignetteMidpoint: [0,100], vignetteFeather: [1,100] };
  const out = {};
  for (const [key, [min, max]] of Object.entries(keys)) out[key] = clamp(input[key], min, max, key === 'vignetteMidpoint' ? 45 : key === 'vignetteFeather' ? 70 : 0);
  out.curve = Array.from({ length: 5 }, (_, i) => clamp(input.curve?.[i], 0, 1, i / 4));
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
  for(let i=0;i<256;i++){const x=i/255,k=Math.min(3,Math.floor(x*4)),t=Math.min(1,(x-k/4)*4);lut[i]=(points[k]*(1-t)+points[k+1]*t)*255;}
  return lut;
}
function luma(data,i){return data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722;}
function processPixels(data,w,h,s) {
  const lut=curveTable(s.curve), hslActive=bands.some(k=>Object.values(s.hsl[k]).some(Boolean));
  const wheelNames=['shadows','midtones','highlights'];
  const wheelRgb=wheelNames.map(k=>hslRgb(s.wheels[k].hue,1,.5));
  const zones=[s.wheels.shadows,s.wheels.midtones,s.wheels.highlights];
  const contrast=1+s.contrast/100, exposure=2**(s.exposure/50), bright=s.brightness*.35;
  const start=s.vignetteMidpoint/100*.8, falloff=1+s.vignetteFeather/30, vig=s.vignette/100;
  for(let y=0;y<h;y++){
    const ny=y/Math.max(1,h-1)*2-1;
    for(let x=0;x<w;x++){
      const i=(y*w+x)*4; let r=data[i],g=data[i+1],b=data[i+2];
      r+=s.temperature*.42+s.tint*.12; g-=s.tint*.32; b-=s.temperature*.42-s.tint*.12;
      r=((r-127.5)*contrast+127.5+bright)*exposure; g=((g-127.5)*contrast+127.5+bright)*exposure; b=((b-127.5)*contrast+127.5+bright)*exposure;
      let lum=(r*.2126+g*.7152+b*.0722)/255;
      const tonal=s.shadows*(1-smooth(.12,.62,lum))*.65+s.highlights*smooth(.38,.92,lum)*.55+s.blacks*(1-smooth(.04,.35,lum))*.35+s.whites*smooth(.66,.98,lum)*.35;
      r+=tonal;g+=tonal;b+=tonal;
      lum=(r*.2126+g*.7152+b*.0722)/255; const mapped=lut[Math.max(0,Math.min(255,Math.round(lum*255)))], scale=lum>.003?mapped/(lum*255):1;
      r*=scale;g*=scale;b*=scale;
      if(s.hue||s.saturation||hslActive){
        let [hue,sat,light]=rgbHsl(Math.max(0,Math.min(255,r))/255,Math.max(0,Math.min(255,g))/255,Math.max(0,Math.min(255,b))/255);
        hue=(hue+s.hue+360)%360; sat=Math.max(0,Math.min(1,sat*(1+s.saturation/100)));
        if(hslActive) for(let k=0;k<bands.length;k++){let d=Math.abs(hue-bandHue[k]);d=Math.min(d,360-d);const weight=Math.max(0,1-d/38);if(!weight)continue;const a=s.hsl[bands[k]];hue=(hue+a.h*.35*weight+360)%360;sat=Math.max(0,Math.min(1,sat*(1+a.s/100*weight)));light=Math.max(0,Math.min(1,light+a.l/100*.3*weight));}
        [r,g,b]=hslRgb(hue,sat,light).map(v=>v*255);
      }
      lum=(r*.2126+g*.7152+b*.0722)/255;
      const zw=[1-smooth(.18,.52,lum),1-Math.abs(smooth(.08,.55,lum)-smooth(.48,.92,lum)),smooth(.45,.88,lum)];
      for(let k=0;k<3;k++){const wheel=zones[k],amount=wheel.amount*zw[k]*.38,color=wheelRgb[k];r=r*(1-amount)+color[0]*255*amount;g=g*(1-amount)+color[1]*255*amount;b=b*(1-amount)+color[2]*255*amount;const lift=wheel.luminance*zw[k]*.42;r+=lift;g+=lift;b+=lift;}
      if(vig){const nx=x/Math.max(1,w-1)*2-1,rad=Math.sqrt(nx*nx+ny*ny)/Math.SQRT2,edge=Math.max(0,Math.min(1,(rad-start)/(1-start))),v=1-vig*(edge**falloff)*.72;r*=v;g*=v;b*=v;}
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
async function rawImage(item, preview) {
  let p=sharp(item.buffer,{limitInputPixels:MAX_PIXELS,failOn:'warning'}).rotate().ensureAlpha();
  if(preview)p=p.resize({width:1400,height:1000,fit:'inside',withoutEnlargement:true});
  return p.raw().toBuffer({resolveWithObject:true});
}
async function render(item, settings, preview, format) {
  const {data,info}=await rawImage(item,preview), pixels=Buffer.from(data); processPixels(pixels,info.width,info.height,cleanSettings(settings));
  let output=sharp(pixels,{raw:{width:info.width,height:info.height,channels:info.channels}});
  output=format==='jpeg'?output.flatten({background:'#11110f'}).jpeg({quality:94,mozjpeg:true}):output.png({compressionLevel:6});
  return {buffer:await output.toBuffer(),width:info.width,height:info.height};
}
async function api(req,res,url) {
  if(req.method==='POST'&&url==='/api/upload'){
    if(!String(req.headers['content-type']||'').toLowerCase().startsWith('image/'))return json(res,415,{error:'Pilih file gambar untuk diimpor.'});
    const buffer=await readBody(req,MAX_UPLOAD);if(!buffer.length)return json(res,400,{error:'File gambar kosong.'});
    let meta;try{meta=await sharp(buffer,{limitInputPixels:MAX_PIXELS,failOn:'warning'}).metadata();}catch{return json(res,415,{error:'Format gambar tidak didukung atau file rusak.'});}
    if(!['jpeg','png','webp','avif','gif','tiff','heif'].includes(meta.format))return json(res,415,{error:'Format gambar ini belum didukung.'});
    const swap=[5,6,7,8].includes(meta.orientation||1);if(!meta.width||!meta.height)return json(res,415,{error:'Dimensi foto tidak terbaca.'});
    for(const [id,item] of images)if(Date.now()-item.created>TTL)images.delete(id);
    while(images.size>=8)images.delete(images.keys().next().value);
    const id=randomUUID(),name=path.basename(String(req.headers['x-file-name']||'foto').slice(0,200)).replace(/[\r\n"\\]/g,'')||'foto';
    images.set(id,{buffer,name,created:Date.now()});return json(res,201,{imageId:id,width:swap?meta.height:meta.width,height:swap?meta.width:meta.height});
  }
  if(req.method==='POST'&&(url==='/api/preview'||url==='/api/export')){
    let body;try{body=JSON.parse((await readBody(req,1024*1024)).toString());}catch(e){return json(res,e.status||400,{error:'Permintaan edit tidak valid.'});}
    const item=images.get(String(body.imageId||''));if(!item||Date.now()-item.created>TTL){if(item)images.delete(String(body.imageId));return json(res,404,{error:'Foto di server sudah kedaluwarsa. Impor ulang untuk melanjutkan.'});}
    item.created=Date.now();
    try{
      let result; const isPreview=url==='/api/preview'; const isOriginal=isPreview&&body.original;
      if(isOriginal){const {data,info}=await sharp(item.buffer,{limitInputPixels:MAX_PIXELS,failOn:'warning'}).rotate().resize({width:1400,height:1000,fit:'inside',withoutEnlargement:true}).jpeg({quality:88}).toBuffer({resolveWithObject:true});result={buffer:data,width:info.width,height:info.height};}
      else result=await render(item,body.settings,isPreview,isPreview||body.format==='jpeg'?'jpeg':'png');
      const type=(isPreview||body.format==='jpeg')?'image/jpeg':'image/png';res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Image-Width':result.width,'X-Image-Height':result.height});return res.end(result.buffer);
    }catch(e){console.error('Pemrosesan gambar gagal:',e.message);return json(res,422,{error:'Server tidak dapat memproses foto ini.'});}
  }
  return json(res,404,{error:'API tidak ditemukan.'});
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon'};
function staticFile(req,res,pathname){let decoded;try{decoded=decodeURIComponent(pathname);}catch{res.writeHead(400);return res.end('Bad request');}
  const file=path.resolve(PUBLIC_DIR,decoded==='/'?'index.html':decoded.replace(/^\/+/,'')),prefix=PUBLIC_DIR+path.sep;
  if(file.toLowerCase()!==PUBLIC_DIR.toLowerCase()&&!file.toLowerCase().startsWith(prefix.toLowerCase())){res.writeHead(403);return res.end('Forbidden');}
  fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);});
}
http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/')){api(req,res,url.pathname).catch(e=>{if(!res.headersSent&&!res.destroyed)json(res,e.status||500,{error:e.status?e.message:'Terjadi kesalahan di server.'});});return;}if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end('Method not allowed');}staticFile(req,res,url.pathname);}).listen(PORT,()=>console.log(`NiDi AutoColor berjalan di http://localhost:${PORT}`));
