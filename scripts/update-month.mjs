import fs from 'node:fs/promises';
const catalog=JSON.parse(await fs.readFile('data/fruit-varieties.json','utf8')).items;
const base='https://fruit-price-lab-kdg2844-8355s-projects.vercel.app/api/archive';
const today=new Date(Date.now()+9*3600000),year=today.getUTCFullYear(),month=today.getUTCMonth()+1;
const months=[String(year)+String(month).padStart(2,'0')];
if(today.getUTCDate()<=3){let pmonth=month-1,pyear=year;if(!pmonth){pmonth=12;pyear--}months.push(String(pyear)+String(pmonth).padStart(2,'0'))}
const boundary=new Date(today.getTime()-365*86400000).toISOString().slice(0,10).replaceAll('-');
const limit=350;
let requestCount=0,updatedFiles=0;
async function get(code,month,page){if(++requestCount>limit)throw Error('Daily request safety limit exceeded');const url=base+'?item='+code+'&month='+month+'&page='+page;for(let i=0;i<3;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'FruitPriceLabHistoryMaintenance/1.0'}});const json=await r.json();if(!r.ok||!json.ok)throw Error(json.error||'HTTP '+r.status);return json}catch(e){if(i===2)throw Error(code+' '+month+' '+page+': '+e.message);await new Promise(resolve=>setTimeout(resolve,(i+1)*1000))}}}
async function updateOne(code){
 const dest='data/history/'+code+'.json';
 let old;try{old=JSON.parse(await fs.readFile(dest,'utf8'))}catch{old={itemCode:code,samples:[]}}
 const combined=new Map((old.samples||[]).filter(r=>r.date>=boundary).map(r=>[[r.date,r.variety,r.kind].join('|'),r]));
 for(const month of months){
  const by=new Map();
  for(let page=1;page<=100;page++){
   const j=await get(code,month,page);
   for(const r of j.rows){
    if(r.date<boundary||!r.variety||!r.kind||!(Number(r.price)>0))continue;
    const id=[r.date,r.variety,r.kind].join('|');
    if(!by.has(id))by.set(id,{date:r.date,name:r.name,variety:r.variety,kind:r.kind,values:[]});
    by.get(id).values.push(Number(r.price))
   }
   if(!j.possibleMore||j.rows.length===0&&Number(j.totalCount||0)===0)break;
   if(page===100)throw Error('Page limit reached, refusing incomplete archive '+code+' '+month);
  }
  for(const [key,entry] of [...combined])if(entry.date.slice(0,6)===month)combined.delete(key);
  for(const [key,entry] of by){entry.values.sort((a,b)=>a-b);combined.set(key,{date:entry.date,name:entry.name,variety:entry.variety,kind:entry.kind,price:entry.values[Math.floor(entry.values.length/2)],sampleCount:entry.values.length})}
 }
 const samples=[...combined.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.variety.localeCompare(b.variety,'ko')||a.kind.localeCompare(b.kind,'ko'));
 const result={itemCode:code,source:'한국농수산식품유통공사 일별 도·소매 가격정보',basis:'품종·거래유형별 시장/지역 1kg 환산가격 중간값',from:boundary,to:today.toISOString().slice(0,10).replaceAll('-',''),samples,complete:true};
 if(JSON.stringify(old.samples||[])!==JSON.stringify(samples)){await fs.writeFile(dest,JSON.stringify(result,null,2)+'\n');updatedFiles++}
 console.log('refreshed',code,'samples',samples.length,'API calls',requestCount)
}
await fs.mkdir('data/history',{recursive:true});
for(const code of Object.keys(catalog))await updateOne(code);
console.log('Updated',updatedFiles,'annual archive files, total API calls',requestCount);
