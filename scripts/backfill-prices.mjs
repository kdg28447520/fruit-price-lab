import fs from 'node:fs/promises';
const BASE='https://fruit-price-lab-kdg2844-8355s-projects.vercel.app/api/archive';
const CODES=['411','412','413','414','415','416','418','419','420','421','423','424','425','426','427','428','429','430','221','222','226','257','422'];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const today=new Date(Date.now()+9*3600000),yearAgo=new Date(today.getTime()-365*86400000);
const beginning=yearAgo.toISOString().slice(0,10).replaceAll('-',''),end=today.toISOString().slice(0,10).replaceAll('-','');
const months=[];for(let year=yearAgo.getUTCFullYear(),month=yearAgo.getUTCMonth()+1;year<today.getUTCFullYear()||(year===today.getUTCFullYear()&&month<=today.getUTCMonth()+1);){months.push(String(year)+String(month).padStart(2,'0'));month++;if(month===13){year++;month=1}}
let requestCount=0;
const MAX=Number(process.env.BACKFILL_CALL_LIMIT||6500);
async function download(code,month,page){
 if(++requestCount>MAX)throw Error('Safety request budget '+MAX+' reached; rerun to resume');
 const url=BASE+'?item='+code+'&month='+month+'&page='+page;
 for(let t=0;t<4;t++){
  try{
   const r=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'fruit-price-backfill/1.0'}});
   const body=await r.json();
   if(!r.ok||!body.ok)throw Error(body.error||'HTTP '+r.status);
   if(!Array.isArray(body.rows))throw Error('Rows missing');
   return body;
  }catch(e){if(t===3)throw Error(month+'/'+code+'/'+page+' '+e.message);await sleep(1500*(t+1))}
 }
}
const readJson=async(file,fallback)=>{try{return JSON.parse(await fs.readFile(file,'utf8'))}catch{return fallback}};
await fs.mkdir('data/history',{recursive:true});
const status=await readJson('data/backfill-status.json',{});
const done=status.done&&typeof status.done==='object'?status.done:{};
let totalSamples=0,completed=0;
for(const code of CODES){
 const target='data/history/'+code+'.json';
 const prev=await readJson(target,{samples:[]});
 const sampleMap=new Map((prev.samples||[]).filter(x=>x.date>=beginning&&x.date<=end).map(x=>[[x.date,x.variety,x.kind].join('|'),x]));
 for(const month of months){
  const id=code+'-'+month;
  if(done[id]){completed++;continue}
  const values=new Map();
  let pages=0;
  for(let page=1;page<=100;page++){
   const data=await download(code,month,page);
   pages++;
   for(const r of data.rows){
    if(r.date<beginning||r.date>end||!r.name||!(r.price>0))continue;
    const variety=r.variety||'미분류',kind=r.kind||'미분류';
    const k=[r.date,variety,kind].join('|');
    if(!values.has(k))values.set(k,{date:r.date,name:r.name,variety,kind,values:[]});
    values.get(k).values.push(r.price);
   }
   const count=Number(data.totalCount||0);
   if(page*1000>=count&&count>0 || !data.possibleMore || data.rows.length===0 && count===0)break;
   if(page>=100)throw Error('Page limit exceeded '+id+'; cannot claim complete');
   await sleep(120);
  }
  for(const [k,v] of values){v.values.sort((a,b)=>a-b);sampleMap.set(k,{date:v.date,name:v.name,variety:v.variety,kind:v.kind,price:v.values[Math.floor(v.values.length/2)],sampleCount:v.values.length})}
  done[id]={pages,records:[...values.values()].reduce((sum,x)=>sum+x.values.length,0),groups:values.size,completedAt:new Date().toISOString()};
  completed++;
  const samples=[...sampleMap.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.variety.localeCompare(b.variety,'ko')||a.kind.localeCompare(b.kind,'ko'));
  await fs.writeFile(target,JSON.stringify({itemCode:code,source:'한국농수산식품유통공사 일별 도·소매 가격정보',basis:'지역/등급 합산하지 않고 품종별·거래유형별 1kg 환산가격 중간값',from:beginning,to:end,samples,complete:months.every(m=>done[code+'-'+m])},null,2)+'\n');
  await fs.writeFile('data/backfill-status.json',JSON.stringify({from:beginning,to:end,totalMonths:months.length,totalItems:CODES.length,done,requestCountLastRun:requestCount,updatedAt:new Date().toISOString()},null,2)+'\n');
  console.log(id,'completed, pages',pages,'groups',values.size,'requests',requestCount);
  await sleep(130);
 }
 totalSamples+=sampleMap.size;
}
console.log('1-year backfill finished',completed,'/',CODES.length*months.length,'groups',totalSamples,'API pages used',requestCount);
