// Build only the public-facing static frontend; API functions remain under root /api.
// Vercel "Other" defaults to serving public/ instead of the repository root.
// Explicit dist output preserves index.html, fruit photos, and SEO assets together.
const fs = require('node:fs');
const path = require('node:path');
const output = path.join(process.cwd(),'dist');
fs.rmSync(output,{recursive:true,force:true});
fs.mkdirSync(output,{recursive:true});
function copyFile(from,to){
 if(!fs.existsSync(from))throw Error('Missing required asset: '+from);
 fs.mkdirSync(path.dirname(to),{recursive:true});
 fs.copyFileSync(from,to);
}
copyFile('index.html',path.join(output,'index.html'));
fs.cpSync('public',output,{recursive:true,force:true});
fs.cpSync('photos',path.join(output,'photos'),{recursive:true,force:true});
fs.cpSync('data/history',path.join(output,'data/history'),{recursive:true,force:true});
for(const name of ['fruit-varieties.json','year-index.json','latest.json']){
 copyFile(path.join('data',name),path.join(output,'data',name));
}
for(const name of ['robots.txt','sitemap.xml','favicon.svg','og-image.jpg']){
 if(!fs.existsSync(path.join(output,name)))throw Error('SEO asset not built: '+name);
}
console.log('Static build complete:',fs.readdirSync(output));
