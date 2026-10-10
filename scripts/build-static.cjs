// Build only the public-facing static frontend; API functions remain under root /api.
// Vercel "Other" defaults to serving public/ instead of the repository root.
// Explicit dist output preserves index.html, fruit photos, and SEO assets together.
const fs = require('node:fs');
const path = require('node:path');
const output = path.join(process.cwd(),'dist');
fs.rmSync(output,{recursive:true,force:true});
fs.mkdirSync(output,{recursive:true});
function copyFile(from,to){
 if(!fs.existsSync(from))throw Error('Missing required asset: '+from);
 fs.mkdirSync(path.dirname(to),{recursive:true});
 fs.copyFileSync(from,to);
}
copyFile('index.html',path.join(output,'index.html'));
fs.cpSync('public',output,{recursive:true,force:true});
fs.cpSync('photos',path.join(output,'photos'),{recursive:true,force:true});
fs.cpSync('data/history',path.join(output,'data/history'),{recursive:true,force:true});
for(const name of ['fruit-varieties.json','year-index.json','latest.json']){
 copyFile(path.join('data',name),path.join(output,'data',name));
}
// Small comparison dataset for TOP 10 sourcing candidates. Price history stays official;
 // never generate forecast prices or fill missing survey dates.
const historyDir=path.join('data','history');
const archiveCutoff=new Date(Date.now()-46*86400000).toISOString().slice(0,10).replaceAll('-','');
const byKey=new Map();
for(const file of fs.readdirSync(historyDir).filter(x=>/^\\d{3}\\.json$/.test(x))){
 const doc=JSON.parse(fs.readFileSync(path.join(historyDir,file),'utf8'));
 for(const item of doc.samples||[]){
  if(!item||!/^20\\d{6}$/.test(String(item.date||''))||item.date<archiveCutoff||!(Number(item.price)>0))continue;
  if(!(String(item.kind||'')).includes('중도매')||!item.name||!item.variety)continue;
  const key=[item.date,item.name,item.variety].join('|');
  const existing=byKey.get(key);
  if(!existing||Number(item.sampleCount||0)>Number(existing.sampleCount||0))
   byKey.set(key,{date:item.date,name:item.name,variety:item.variety,price:Number(item.price),sampleCount:Number(item.sampleCount)||0});
 }
}
const sourcingSamples=[...byKey.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name,'ko'));
fs.writeFileSync(path.join(output,'data','sourcing-history.json'),JSON.stringify({
 source:'한국농수산식품유통공사(aT) 도·소매 가격정보',
 basis:'동일 품종 중도매 1kg 환산 조사 가격의 조사일별 중간값',
 from:archiveCutoff,
 generatedAt:new Date().toISOString(),
 samples:sourcingSamples
}));
console.log('Sourcing comparison observations:',sourcingSamples.length);
for(const name of ['robots.txt','sitemap.xml','favicon.svg','og-image.jpg']){
 if(!fs.existsSync(path.join(output,name)))throw Error('SEO asset not built: '+name);
}
console.log('Static build complete:',fs.readdirSync(output));
