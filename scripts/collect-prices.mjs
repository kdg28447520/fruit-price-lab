import fs from 'node:fs/promises';
const url='https://fruit-price-lab-kdg2844-8355s-projects.vercel.app/api/prices';
const response=await fetch(url,{headers:{'Cache-Control':'no-cache','User-Agent':'fruit-price-lab-github-scheduler/1.0'},signal:AbortSignal.timeout(55000)});
if(!response.ok)throw Error('Price API HTTP '+response.status);
const payload=await response.json();if(!payload.live||!Array.isArray(payload.items)||payload.items.length===0)throw Error('Price API has no confirmed live prices');
const fmt=(v)=>Number(v).toFixed(0);
const by=new Map();
for(const item of payload.items){
 const price=Number(item.pricePerKg);
 if(!Number.isFinite(price)||price<=0||!item.name)continue;
 const kind=String(item.kind||'미분류');
 const key=item.name+'|'+kind;
 if(!by.has(key))by.set(key,[]);
 by.get(key).push(price);
}
const date=String(payload.date);
if(!/^\d{8}$/.test(date)||by.size===0)throw Error('Missing valid surveyed dates or comparable kg prices');
const observations=[];
for(const [key,values] of by){values.sort((a,b)=>a-b);const [name,kind]=key.split('|');observations.push({date,name,kind,price:Number(fmt(values[Math.floor(values.length/2)])),sampleCount:values.length})}
await fs.mkdir('data',{recursive:true});
let existing=[];try{existing=JSON.parse(await fs.readFile('data/history.json','utf8')).samples||[]}catch{}
const map=new Map(existing.map(x=>[[x.date,x.name,x.kind].join('|'),x]));
for(const o of observations)map.set([o.date,o.name,o.kind].join('|'),o);
const samples=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name)).filter(x=>x.date>=new Date(Date.now()-400*86400000).toISOString().slice(0,10).replaceAll('-',''));
await fs.writeFile('data/history.json',JSON.stringify({samples,source:'aT public API, price-per-kilogram median by fruit and wholesale/retail type',lastCollectedAt:new Date().toISOString()},null,2)+'\n');
await fs.writeFile('data/latest.json',JSON.stringify({date,items:payload.items,checkedAt:payload.checkedAt,source:'aT 공공데이터'},null,2)+'\n');
console.log('Saved',observations.length,'groups,',samples.length,'historical data points, survey date',date);
