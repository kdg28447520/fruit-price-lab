const assert=require('node:assert/strict');
const endpoint=require('../api/search-trends.js');
const originals={id:process.env.NAVER_CLIENT_ID,secret:process.env.NAVER_CLIENT_SECRET,fetch:global.fetch};
function res(){
 return {statusCode:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v;return this;},status(code){this.statusCode=code;return this;},json(value){this.body=value;return this;}};
}
(async()=>{
 delete process.env.NAVER_CLIENT_ID;delete process.env.NAVER_CLIENT_SECRET;
 let r=res();
 await endpoint({method:'GET'},r);
 assert.equal(r.statusCode,200);assert.equal(r.body.configured,false);assert.deepEqual(r.body.items,[]);
 r=res();await endpoint({method:'POST'},r);assert.equal(r.statusCode,405);
 process.env.NAVER_CLIENT_ID='fixture-id';process.env.NAVER_CLIENT_SECRET='fixture-credential';
 let calls=0;
 global.fetch=async(url,opt)=>{
  calls++;
  assert.equal(url,'https://openapi.naver.com/v1/datalab/search');
  assert.equal(opt.method,'POST');
  assert.equal(opt.headers['X-Naver-Client-Id'],'fixture-id');
  const q=JSON.parse(opt.body);
  assert.equal(q.timeUnit,'date');assert(q.keywordGroups.length<=5);
  const begin=new Date(q.startDate+'T00:00:00Z');
  return {ok:true,json:async()=>({
   results:q.keywordGroups.map(g=>{
    const data=Array.from({length:28},(_,i)=>{
     const d=new Date(begin.getTime()+i*86400000).toISOString().slice(0,10);
     const ratio=g.groupName==='사과'?(i>=21?30:10):g.groupName==='포도'?(i>=21?8:20):15;
     return {period:d,ratio};
    });
    return {title:g.groupName,data};
   })
  })};
 };
 r=res();await endpoint({method:'GET'},r);
 assert.equal(r.statusCode,200);assert.equal(r.body.ok,true);assert.equal(r.body.configured,true);
 assert.equal(calls,4);assert.equal(r.body.items.length,20);
 const apple=r.body.items.find(x=>x.name==='사과'),grapes=r.body.items.find(x=>x.name==='포도');
 assert.equal(apple.status,'up');assert(apple.change>=15);
 assert.equal(grapes.status,'down');assert(grapes.change<=-15);
 assert(!JSON.stringify(r.body).includes('fixture-credential'));
 assert.match(r.headers['Cache-Control'],/s-maxage=21600/);
 global.fetch=async()=>{throw Error('mock network down')};
 r=res();await endpoint({method:'GET'},r);assert.equal(r.statusCode,502);assert.equal(r.body.ok,false);
 assert.equal(r.body.items.length,0);
 console.log('Naver trend API: disabled, method, batching, comparable periods, rising/falling, caching, credentials not leaked, and outage checks PASS');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{
 if(originals.id===undefined)delete process.env.NAVER_CLIENT_ID;else process.env.NAVER_CLIENT_ID=originals.id;
 if(originals.secret===undefined)delete process.env.NAVER_CLIENT_SECRET;else process.env.NAVER_CLIENT_SECRET=originals.secret;
 global.fetch=originals.fetch;
});
