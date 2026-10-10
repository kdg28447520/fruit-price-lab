const fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const latest=JSON.parse(fs.readFileSync('data/latest.json','utf8'));
const catalog=JSON.parse(fs.readFileSync('data/fruit-varieties.json','utf8'));
const history=JSON.parse(fs.readFileSync('data/history.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('data/photos-manifest.json','utf8'));
const summaries=latest.items.map(r=>({name:r.name,variety:r.variety,date:r.date,kind:r.kind,price:r.pricePerKg,sampleCount:1}));
const logs=[],results=[];
const vc=new VirtualConsole();vc.on('jsdomError',e=>logs.push(e.message));vc.on('error',e=>logs.push(e));
function pass(name,condition,detail=''){results.push({name,passed:!!condition,detail:!condition?detail:undefined});}
const dom=new JSDOM(html,{url:'https://fruit-price-lab.example.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(window){
 window.HTMLElement.prototype.scrollIntoView=function(){};
 window.fetch=async function(url){
   if(String(url).startsWith('/data/fruit-varieties.json'))return {ok:true,json:async()=>catalog};
   if(String(url).startsWith('/api/prices'))return {ok:true,json:async()=>({live:true,...latest,history:history.samples,varietySummaries:summaries})};
   if(String(url).startsWith('/data/history/'))return {ok:false,status:404,json:async()=>({samples:[]})};
   throw Error('Unexpected fetch '+url);
 };
}});
const doc=dom.window.document;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 await wait(180);
 const expectedNames=[...new Set(latest.items.filter(x=>Number(x.pricePerKg)>0).map(x=>x.name))];
 pass('Only observed fruit categories',doc.querySelectorAll('[data-fruit]').length===expectedNames.length,'count '+doc.querySelectorAll('[data-fruit]').length+'; expected='+expectedNames.length); 
 pass('No unpriced fruit categories', [...doc.querySelectorAll('[data-fruit]')].every(x=>expectedNames.includes(x.dataset.fruit)));
 pass('Official price status',doc.querySelector('#status')?.textContent?.includes('실측'),'status='+doc.querySelector('#status')?.textContent);
 pass('Photo credits visible',doc.querySelectorAll('#creditList li').length===26,'links='+doc.querySelectorAll('#creditList li').length);
 const all=[...doc.querySelectorAll('[data-fruit]')].map(b=>b.dataset.fruit);
 let n=0,variantsFail=[];
 for(const name of all){
   const el=[...doc.querySelectorAll('[data-fruit]')].find(b=>b.dataset.fruit===name);if(!el){variantsFail.push(name+': card missing');continue}
   el.click();
   const variants=[...doc.querySelectorAll('[data-variety]')].map(b=>b.dataset.variety);
   if(variants.length===0)variantsFail.push(name+': no varieties');
   for(const v of variants){
     const node=[...doc.querySelectorAll('[data-variety]')].find(b=>b.dataset.variety===v);
     node.click();n++;
     if(doc.querySelector('#detailSection')?.hidden || !doc.querySelector('#detailName')?.textContent)variantsFail.push(name+'/'+v+' detail hidden');
   }
 }
 const expectedVariants=[...new Set(latest.items.filter(x=>Number(x.pricePerKg)>0).map(x=>x.name+'|'+(x.variety||'미분류')))];
 pass('Only priced fruit and variety buttons',all.length===expectedNames.length&&variantsFail.length===0&&n===expectedVariants.length,'categories='+all.length+' variants='+n+' expectedVariants='+expectedVariants.length+' failed='+variantsFail.slice(0,5).join(','));
 const apple=[...doc.querySelectorAll('[data-fruit]')].find(b=>b.dataset.fruit==='사과');
 if(apple)apple.click();
 const apples=[...doc.querySelectorAll('[data-variety]')];
 pass('Apple varieties only when observed',apples.every(x=>latest.items.some(row=>row.name==='사과'&&row.variety===x.dataset.variety&&Number(row.pricePerKg)>0)));
 const hongro=apples.find(e=>e.dataset.variety==='홍로');
 if(hongro)hongro.click();
 pass('Hongro shows official prices',doc.querySelector('#wholesaleValue')?.textContent?.includes('원'),'value='+doc.querySelector('#wholesaleValue')?.textContent);
 pass('Region selector initialized',doc.querySelector('#regionSelect')?.options?.length>1);
 const region=doc.querySelector('#regionSelect');
 if([...region.options].some(o=>o.value==='서울')){region.value='서울';region.dispatchEvent(new dom.window.Event('change',{bubbles:true}));}
 pass('Region switch filters rows',!doc.querySelector('#priceRows')?.textContent.includes('부산'));
 const kind=doc.querySelector('#kindSelect');kind.value='소매';kind.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 pass('Wholesaler/retail chart switch',doc.querySelector('#trendInfo').textContent.length>5);
 for(const tab of ['prices','seller','calendar']){doc.querySelector('[data-tab="'+tab+'"]').click();pass(tab+' menu tab',doc.querySelector('#'+tab)?.classList.contains('on'))}
 doc.querySelector('#sale').value='24000';doc.querySelector('#sale').dispatchEvent(new dom.window.Event('input',{bubbles:true}));
 pass('Profit margin calculator',doc.querySelector('#profit')?.textContent.includes('원')&&doc.querySelector('#details')?.textContent.includes('손익분기'));
 pass('12 calendar months',doc.querySelectorAll('[data-month]').length===12);
 pass('Four chart period choices',doc.querySelectorAll('#periodSelect option').length===4); 
 doc.querySelector('#periodSelect').value='365';doc.querySelector('#periodSelect').dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 pass('One-year chart period switches',doc.querySelector('#periodSelect').value==='365');
 pass('No empty-price messaging in UI',![...doc.querySelectorAll('[data-fruit], [data-variety]')].some(x=>x.textContent.includes('시세 없음')||x.textContent.includes('가격정보 확인')));
 doc.querySelector('[data-month="3"]').click();pass('Calendar month navigation',doc.querySelector('#monthTitle')?.textContent.includes('3월'));
 const entries=[...Object.values(manifest.fruits),...Object.values(manifest.varieties)];
 const missing=entries.filter(e=>!fs.existsSync('photos/'+e.asset));
 pass('All 26 verified photos local',missing.length===0,'missing='+missing.map(x=>x.asset).join(','));
 pass('Photo sources match category, not unrelated clipart',entries.length===26&&Object.keys(manifest.fruits).length===23);
 pass('No runtime console errors',logs.length===0,logs.join('; '));
 const failed=results.filter(x=>!x.passed);
 const report={testedAt:new Date().toISOString(),total:results.length,passed:results.length-failed.length,failed:failed.length,fruitCategories:all.length,variantClicks:n,photoAssets:entries.length,checks:results};
 fs.writeFileSync('data/ui-check-report.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({total:report.total,passed:report.passed,failed:report.failed,fruitCategories:report.fruitCategories,variantClicks:report.variantClicks,photoAssets:report.photoAssets,issues:failed},null,2));
 dom.window.close();
 if(failed.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
