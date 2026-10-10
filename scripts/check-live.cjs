const fs=require('node:fs');const base='https://fruit-price-lab-kdg2844-8355s-projects.vercel.app';
const tests=[];const headers={'User-Agent':'FruitPriceLab-LiveSmoke/1.0'};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function probe(name,path,validate){
 let err='';
 for(let i=0;i<10;i++){
  try{
   const r=await fetch(base+path,{headers,signal:AbortSignal.timeout(20000)});
   const body=await r.arrayBuffer();
   const result=await validate(r,Buffer.from(body));
   if(!r.ok||result!==true)throw Error('HTTP '+r.status+' '+JSON.stringify(result));
   tests.push({name,passed:true,status:r.status});
   return;
  }catch(e){err=String(e.message).slice(0,250);await sleep(4000)}
 }
 tests.push({name,passed:false,error:err});
}
(async()=>{
 await probe('Homepage delivers HTML','/',(r,b)=>r.headers.get('content-type')?.includes('text/html')&&b.toString('utf8').includes('제철과일')&&b.toString('utf8').includes('data-tab="prices"'));
 await probe('Apple photo delivers real JPEG','/photos/fruit-apple.jpg',(r,b)=>r.headers.get('content-type')?.includes('image/')&&b[0]===255&&b[1]===216);
 await probe('Pear photo delivers real JPEG','/photos/fruit-pear.jpg',(r,b)=>r.headers.get('content-type')?.includes('image/')&&b[0]===255&&b[1]===216);
 await probe('Shine Muscat variety photo delivers JPEG','/photos/variety-shine-muscat.jpg',(r,b)=>r.headers.get('content-type')?.includes('image/')&&b[0]===255&&b[1]===216);
 await probe('Annual active-variety list is available','/data/year-index.json',(r,b)=>{try{const o=JSON.parse(b.toString('utf8'));return /^20\\d{6}$/.test(o.range?.from||'')&&/^20\\d{6}$/.test(o.range?.to||'')&&o.itemCount===20&&o.varietyCount===34&&o.items.some(i=>i.name==='사과'&&i.varieties.some(v=>v.name==='후지'&&Number(v.kinds?.소매?.price)>0))}catch{return false}});
 await probe('Fuji one-year historical series available','/data/history/411.json',(r,b)=>{try{const o=JSON.parse(b.toString('utf8'));return o.complete===true&&Array.isArray(o.samples)&&o.samples.length>=300&&o.samples.some(x=>x.variety==='후지'&&x.date<'20261001')}catch{return false}});
 await probe('Official price API returns live data','/api/prices',(r,b)=>{try{const o=JSON.parse(b.toString('utf8'));return o.live===true&&Array.isArray(o.items)&&o.items.length>0}catch{return false}});
 const failed=tests.filter(t=>!t.passed);
 const output={testedAt:new Date().toISOString(),base,total:tests.length,passed:tests.length-failed.length,failed:failed.length,tests};
 fs.writeFileSync('data/live-check-report.json',JSON.stringify(output,null,2)+'\n');
 console.log(JSON.stringify(output,null,2));if(failed.length)process.exitCode=1
})().catch(e=>{console.error(e);process.exitCode=1});
