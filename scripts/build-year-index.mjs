import fs from 'node:fs/promises';
const catalog=JSON.parse(await fs.readFile('data/fruit-varieties.json','utf8')).items;
const status=JSON.parse(await fs.readFile('data/backfill-status.json','utf8'));
const begin=status.from||'20251010',end=status.to||'20261010';
const overview=[];
let total=0,variants=0;
for(const [code,meta] of Object.entries(catalog)){
 let archive;try{archive=JSON.parse(await fs.readFile('data/history/'+code+'.json','utf8'))}catch(e){console.warn('Not collected',code);continue}
 if(!archive.complete){throw new Error('Historical archive incomplete: '+code)}
 const byVariety=new Map();
 for(const record of archive.samples||[]){
  if(!record||!record.date||record.date<begin||record.date>end||!(Number(record.price)>0))continue;
  const name=record.variety||'미분류',kind=record.kind||'미분류',val=Number(record.price);
  if(!byVariety.has(name))byVariety.set(name,{name,days:new Set(),kinds:{},records:0});
  const v=byVariety.get(name);v.days.add(record.date);v.records++;
  if(!v.kinds[kind]||v.kinds[kind].date<=record.date)
    v.kinds[kind]={date:record.date,price:val,sampleCount:record.sampleCount||0};
  total++;
 }
 if(!byVariety.size)continue;
 const varieties=[...byVariety.values()].map(v=>{
   const latestDate=Object.values(v.kinds).map(k=>k.date).sort().at(-1)||'';
   return {name:v.name,latestDate,observedDays:v.days.size,records:v.records,kinds:v.kinds};
 }).sort((a,b)=>b.latestDate.localeCompare(a.latestDate)||a.name.localeCompare(b.name,'ko'));
 variants+=varieties.length;
 const latestDate=varieties.map(v=>v.latestDate).sort().at(-1);
 overview.push({name:meta.name,itemCode:code,latestDate,observedDays:new Set((archive.samples||[]).map(x=>x.date)).size,varieties});
}
overview.sort((a,b)=>a.name.localeCompare(b.name,'ko'));
const doc={source:'한국농수산식품유통공사(aT) 공식 일별 도·소매 가격정보',basis:'지역/시장별 1kg 환산 실측값을 날짜·품종·거래유형 단위로 묶어 중간값 적용',range:{from:begin,to:end},generatedAt:new Date().toISOString(),itemCount:overview.length,varietyCount:variants,totalObservedGroupDays:total,items:overview};
await fs.writeFile('data/year-index.json',JSON.stringify(doc,null,2)+'\n');
console.log('One-year measured varieties:',overview.length,'fruits',variants,'varieties',total,'group-days');
console.log('Apple:',JSON.stringify(overview.find(x=>x.name==='사과')?.varieties));
