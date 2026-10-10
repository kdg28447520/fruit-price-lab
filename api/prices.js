// Official aT daily wholesale/retail prices; required filters per supplied specification.
const GOODS=[['400','411'],['400','412'],['400','413'],['400','414'],['400','415'],['400','416'],['400','418'],['400','419'],['400','420'],['400','421'],['400','423'],['400','424'],['400','425'],['400','428'],['400','429'],['200','221'],['200','222'],['200','226'],['200','257'],['200','422']];
const P=Number(process.env.FRUIT_API_MAX_ITEMS||1000);
function num(v){if(v==null||v==='')return null;const n=Number(String(v).replace(/,/g,''));return Number.isFinite(n)&&n>0?n:null}
function kstDay(daysAgo=0){return new Date(Date.now()+9*3600000-daysAgo*86400000).toISOString().slice(0,10).replace(/-/g,'')}
function unpack(data){const root=data.response||data;const h=root.header||{};if(h.resultCode&&!['0','00','000','NORMAL_SERVICE'].includes(String(h.resultCode)))throw Error('정부 API 코드 '+h.resultCode+' '+String(h.resultMsg||'').slice(0,80));const body=root.body||root;let rows=body.items?.item??body.items??body.data?.items??[];if(!Array.isArray(rows))rows=[rows].filter(Boolean);return {rows,total:Number(body.totalCount||rows.length)}}
async function fetchOne(key,cat,code,start,end){const url=new URL('https://apis.data.go.kr/B552845/perDay/price');const args={serviceKey:key,returnType:'JSON',pageNo:'1',numOfRows:String(Math.min(1000,Math.max(10,P))),'cond[exmn_ymd::GTE]':start,'cond[exmn_ymd::LTE]':end,'cond[ctgry_cd::EQ]':cat,'cond[item_cd::EQ]':code};Object.entries(args).forEach(([k,v])=>url.searchParams.set(k,v));const response=await fetch(url,{signal:AbortSignal.timeout(9000)});if(!response.ok)throw Error('HTTP '+response.status);const raw=await response.text();let obj;try{obj=JSON.parse(raw)}catch{throw Error('JSON 형식이 아닌 응답')};return unpack(obj)}
function mapRow(r){const pricePerKg=num(r.exmn_dd_cnvs_prc),unitPrice=num(r.exmn_dd_prc);return {name:String(r.item_nm||''),price:pricePerKg??unitPrice,pricePerKg,unitPrice,variety:String(r.vrty_nm||''),varietyCode:String(r.vrty_cd||''),grade:String(r.grd_nm||''),unit:String(r.unit_sz||'')+String(r.unit||''),kind:String(r.se_nm||''),kindCode:String(r.se_cd||''),date:String(r.exmn_ymd||''),region:String(r.sgg_nm||''),market:String(r.mrkt_nm||''),categoryCode:String(r.ctgry_cd||''),itemCode:String(r.item_cd||'')}}
module.exports=async function(req,res){res.setHeader('Cache-Control','public, s-maxage=21600, stale-while-revalidate=3600');const key=process.env.DATA_GO_KR_SERVICE_KEY;if(!key)return res.status(503).json({live:false,message:'서버 API 인증키 설정이 없습니다.'});const from=kstDay(10),to=kstDay();const settled=await Promise.allSettled(GOODS.map(([c,i])=>fetchOne(key,c,i,from,to)));let rows=[],errors=[],partial=[];settled.forEach((x,i)=>{if(x.status==='fulfilled'){rows.push(...x.value.rows.map(mapRow));if(x.value.total>x.value.rows.length)partial.push(GOODS[i].join(':'))}else errors.push(GOODS[i].join(':')+': '+String(x.reason?.message||'요청 실패'))});rows=rows.filter(x=>x.name&&x.price!==null&&/^\d{8}$/.test(x.date));if(!rows.length)return res.status(502).json({live:false,message:'공식 가격을 조회하지 못했습니다.',details:errors.slice(0,3),checkedAt:new Date().toISOString()});const latest=rows.reduce((a,x)=>x.date>a?x.date:a,'');let list=rows.filter(x=>x.date===latest);const uniq=new Map();for(const x of list){uniq.set([x.date,x.name,x.variety,x.grade,x.unit,x.kind,x.region,x.market].join('|'),x)}list=[...uniq.values()];
// Use only like-for-like kilogram prices; median across reporting markets per fruit, type and day.
const groups=new Map();
for(const r of rows){
  if(!(r.pricePerKg>0))continue;
  const kind=r.kind||'미분류';
  const key=[r.date,r.name,r.variety||'품종 미상',kind].join('|');
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(r.pricePerKg);
}
const history=[...groups].map(([key,prices])=>{
  prices.sort((a,b)=>a-b);
  const [date,name,variety,kind]=key.split('|');
  return {date,name,variety,kind,price:prices[Math.floor(prices.length/2)],sampleCount:prices.length};
}).sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name)||a.kind.localeCompare(b.kind));
// Distinguish most recent surveyed day for each official variety and trade type.
// Do NOT treat an unreported historical variety as today's price.
const varietyBins=new Map();
for(const r of rows){
 if(!(r.pricePerKg>0))continue;
 const key=[r.itemCode,r.varietyCode||r.variety,r.kind||'미분류'].join('|');
 const existing=varietyBins.get(key);
 if(!existing||r.date>existing.date) varietyBins.set(key,{date:r.date,values:[r.pricePerKg],r});
 else if(r.date===existing.date)existing.values.push(r.pricePerKg);
}
const varietySummaries=[...varietyBins.values()].map(({date,values,r})=>{
 values.sort((a,b)=>a-b);
 return {date,name:r.name,itemCode:r.itemCode,variety:r.variety,varietyCode:r.varietyCode,kind:r.kind,price:values[Math.floor(values.length/2)],sampleCount:values.length}
}).sort((a,b)=>a.name.localeCompare(b.name,'ko')||a.variety.localeCompare(b.variety,'ko')||b.date.localeCompare(a.date));
res.status(200).json({live:true,date:latest,checkedAt:new Date().toISOString(),items:list,history,varietySummaries,count:list.length,partial:partial.length>0,warnings:{failedItems:errors.length,truncatedGroups:partial.length},source:'한국농수산식품유통공사 일별 도·소매 가격정보',priceBasis:'kg 환산가격 우선, 없으면 원 거래단위 가격'})};
