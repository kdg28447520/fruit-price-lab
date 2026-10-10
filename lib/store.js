const {get,put}=require('@vercel/blob');const access='private';
const path='fruit-lab/history-v1.json';
async function read(){if(!process.env.BLOB_READ_WRITE_TOKEN)return {samples:[],storageReady:false};const r=await get(path,{access});if(!r||r.statusCode!==200)return {samples:[],storageReady:true};const d=await new Response(r.stream).json();return {samples:Array.isArray(d.samples)?d.samples:[],storageReady:true}}
async function save(samples){if(!process.env.BLOB_READ_WRITE_TOKEN)throw Error('BLOB_READ_WRITE_TOKEN not configured');await put(path,JSON.stringify({samples,updatedAt:new Date().toISOString()}),{access,overwrite:true,addRandomSuffix:false,contentType:'application/json'})}
module.exports={read,save};