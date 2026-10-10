import fs from 'node:fs/promises';
import path from 'node:path';
const manifest=JSON.parse(await fs.readFile('data/photos-manifest.json','utf8'));
const entries=[...Object.entries(manifest.fruits).map(([key,v])=>({key,...v})),...Object.entries(manifest.varieties).map(([key,v])=>({key,...v}))];
await fs.mkdir('photos',{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function getJson(url){const r=await fetch(url,{headers:{'User-Agent':'FruitPriceLab/1.0 (https://github.com/kdg28447520/fruit-price-lab)','Accept':'application/json'},signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('MediaWiki '+r.status);return r.json()}
async function one(p){
 const dest=path.join('photos',p.asset);
 try{const exists=await fs.readFile(dest);if(exists[0]===255&&exists[1]===216)return {key:p.key,ok:true,existing:true}}catch{}
 for(let trial=0;trial<3;trial++){
  try{
   const url='https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url&iiurlwidth=640&titles='+encodeURIComponent('File:'+p.filename);
   const data=await getJson(url);
   const file=data.query?.pages?.[0];
   if(!file||file.missing||!file.imageinfo?.[0])throw Error('File missing on Commons');
   const remote=file.imageinfo[0].thumburl||file.imageinfo[0].url;
   const r=await fetch(remote,{headers:{'User-Agent':'FruitPriceLab/1.0 (https://github.com/kdg28447520/fruit-price-lab)'},signal:AbortSignal.timeout(35000)});
   if(!r.ok)throw Error('Photo HTTP '+r.status);
   const bytes=Buffer.from(await r.arrayBuffer());
   if(bytes.length<1000||bytes.length>4500000||bytes[0]!==255||bytes[1]!==216)throw Error('Invalid JPG bytes or unsupported size');
   await fs.writeFile(dest,bytes);
   console.log('Downloaded',p.key,bytes.length);
   return {key:p.key,ok:true};
  }catch(e){if(trial===2){console.error('Photo failed:',p.key,e.message);return {key:p.key,ok:false,error:e.message}}await pause(1300*(trial+1));}
 }
}
const results=[];for(let i=0;i<entries.length;i+=3){results.push(...await Promise.all(entries.slice(i,i+3).map(one)))}
const ok=results.filter(x=>x.ok).length;
await fs.writeFile('data/photo-sync-status.json',JSON.stringify({checkedAt:new Date().toISOString(),total:entries.length,successful:ok,failed:results.filter(x=>!x.ok)},null,2)+'\n');
console.log('Photo sync',ok,'/',entries.length);
if(ok<15)process.exitCode=1;
