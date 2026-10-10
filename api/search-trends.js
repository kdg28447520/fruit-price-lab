const {KEYWORDS}=require('../lib/naver-keywords');
const DAY=86400000;
const iso=t=>new Date(t).toISOString().slice(0,10);
function trends(item,prev,recent,end){
 const rows=(item.data||[]).filter(x=>x&&typeof x.period==='string'&&Number.isFinite(Number(x.ratio)));
 const before=rows.filter(x=>x.period>=prev&&x.period<recent);
 const after=rows.filter(x=>x.period>=recent&&x.period<=end);
 const avg=a=>a.reduce((n,x)=>n+Number(x.ratio),0)/a.length;
 if(before.length<5||after.length<5||avg(before)<1)return {status:'insufficient',change:null};
 const change=Math.round((avg(after)/avg(before)-1)*1000)/10;
 return {status:change>=15?'up':change<=-15?'down':'flat',change};
}
async function batch(items,options){
 const r=await fetch('https://openapi.naver.com/v1/datalab/search',{
  method:'POST',
  headers:{'X-Naver-Client-Id':options.id,'X-Naver-Client-Secret':options.credential,'Content-Type':'application/json'},
  body:JSON.stringify({startDate:options.start,endDate:options.end,timeUnit:'date',keywordGroups:items.map(([name,keywords])=>({groupName:name,keywords}))}),
  signal:AbortSignal.timeout(10000)
 });
 if(!r.ok)throw Error('Naver status '+r.status);
 const body=await r.json();
 if(!Array.isArray(body.results))throw Error('Invalid response');
 return body.results;
}
module.exports=async(req,res)=>{
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({ok:false,message:'GET required'});}
 const id=process.env.NAVER_CLIENT_ID,credential=process.env.NAVER_CLIENT_SECRET;
 if(!id||!credential){
  res.setHeader('Cache-Control','public, s-maxage=1800');
  return res.status(200).json({ok:false,configured:false,items:[],message:'네이버 데이터랩 API 연결 대기'});
 }
 const kst=Date.now()+9*3600000;
 const options={id,credential,start:iso(kst-28*DAY),end:iso(kst-DAY),prev:iso(kst-14*DAY),recent:iso(kst-7*DAY)};
 const entries=Object.entries(KEYWORDS),parts=[];
 for(let i=0;i<entries.length;i+=5)parts.push(entries.slice(i,i+5));
 const results=await Promise.allSettled(parts.map(p=>batch(p,options)));
 const found=new Map(),fail=results.filter(x=>x.status==='rejected').length;
 results.forEach(r=>{if(r.status==='fulfilled')r.value.forEach(item=>{
  if(Object.hasOwn(KEYWORDS,item.title))found.set(item.title,trends(item,options.prev,options.recent,options.end));
 })});
 if(fail===parts.length){
  res.setHeader('Cache-Control','public, s-maxage=90');
  return res.status(502).json({ok:false,configured:true,items:[],message:'네이버 API 조회 오류'});
 }
 const items=entries.map(([name,keywords])=>({name,keywords,...(found.get(name)||{status:'unavailable',change:null})}));
 res.setHeader('Cache-Control','public, s-maxage=21600, stale-while-revalidate=43200');
 return res.status(200).json({ok:true,configured:true,complete:fail===0,source:'네이버 데이터랩 통합검색 상대지수',period:{startDate:options.start,endDate:options.end},items});
};
