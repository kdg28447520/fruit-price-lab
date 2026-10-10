// Historical public aT agricultural prices. One allowlisted fruit, month and source page per call.
// Raw service key is never returned or exposed to the browser.
const ITEMS=new Map([['411','400'],['412','400'],['413','400'],['414','400'],['415','400'],['416','400'],['418','400'],['419','400'],['420','400'],['421','400'],['423','400'],['424','400'],['425','400'],['426','400'],['427','400'],['428','400'],['429','400'],['430','400'],['221','200'],['222','200'],['226','200'],['257','200'],['422','200']]);
function validMonth(m){
 if(!/^20\d{4}$/.test(m||''))return false;
 const year=+m.slice(0,4),month=+m.slice(4,6);
 if(month<1||month>12)return false;
 const current=new Date(Date.now()+9*3600000),endYear=current.getUTCFullYear(),endMonth=current.getUTCMonth()+1;
 const monthsAgo=(endYear-year)*12+endMonth-month;
 return monthsAgo>=0&&monthsAgo<=13;
}
const num=x=>{if(x===null||x===undefined||x==='')return null;let n=Number(String(x).replace(/,/g,''));return Number.isFinite(n)&&n>0?n:null};
module.exports=async(req,res)=>{
 res.setHeader('X-Robots-Tag','noindex, nofollow');
 if(req.method!=='GET')return res.status(405).json({ok:false,error:'GET only'});
 const item=String(req.query.item||''),month=String(req.query.month||''),page=Number(req.query.page||1);
 if(!ITEMS.has(item)||!validMonth(month)||!Number.isInteger(page)||page<1||page>100)return res.status(400).json({ok:false,error:'Invalid fruit item, month, or page'});
 const key=process.env.DATA_GO_KR_SERVICE_KEY;if(!key)return res.status(503).json({ok:false,error:'API key not configured'});
 const first=month+'01',last=month+String(new Date(+month.slice(0,4),+month.slice(4,6),0).getDate()).padStart(2,'0');
 const url=new URL('https://apis.data.go.kr/B552845/perDay/price');
 for(const [k,v] of Object.entries({serviceKey:key,returnType:'JSON',pageNo:String(page),numOfRows:'1000','cond[exmn_ymd::GTE]':first,'cond[exmn_ymd::LTE]':last,'cond[ctgry_cd::EQ]':ITEMS.get(item),'cond[item_cd::EQ]':item}))url.searchParams.set(k,v);
 const oldest=Date.now()-370*86400000;
 res.setHeader('Cache-Control',+month<+(new Date(Date.now()+9*3600000)).toISOString().slice(0,7).replace('-','')?'public,s-maxage=86400,stale-while-revalidate=86400':'public,s-maxage=21600,stale-while-revalidate=3600');
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(14000)});
  const content=await r.text();
  if(!r.ok)return res.status(502).json({ok:false,error:'Public API HTTP '+r.status});
  let j;try{j=JSON.parse(content)}catch{return res.status(502).json({ok:false,error:'Public API returned non-JSON'});}
  const root=j.response||j,h=root.header||{};
  if(h.resultCode&&!['00','0','000','NORMAL_SERVICE'].includes(String(h.resultCode)))return res.status(502).json({ok:false,error:'Public API '+String(h.resultCode),message:String(h.resultMsg||'').slice(0,100)});
  const b=root.body||root;
  let a=b.items?.item??b.items??b.data?.items??[];if(!Array.isArray(a))a=[a].filter(Boolean);
  const rows=a.map(x=>({date:String(x.exmn_ymd||''),name:String(x.item_nm||''),variety:String(x.vrty_nm||''),kind:String(x.se_nm||''),price:num(x.exmn_dd_cnvs_prc),itemCode:String(x.item_cd||item)})).filter(x=>/^20\d{6}$/.test(x.date)&&x.itemCode===item&&x.price>0&&new Date(x.date.slice(0,4)+'-'+x.date.slice(4,6)+'-'+x.date.slice(6,8)).getTime()>=oldest);
  const total=Number(b.totalCount??b.total_count??a.length);
  return res.status(200).json({ok:true,item,month,page,rows,totalCount:Number.isFinite(total)?total:a.length,pageSize:1000,possibleMore:rows.length===1000||Number.isFinite(total)&&page*1000<total});
 }catch(e){return res.status(502).json({ok:false,error:e.name==='TimeoutError'?'Public API timeout':'Public API unavailable'})}
};
