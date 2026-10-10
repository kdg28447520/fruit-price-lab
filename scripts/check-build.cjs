const fs = require('node:fs');
const path = require('node:path');
const {strict:assert}=require('node:assert');
const root='dist';
const read=p=>fs.readFileSync(path.join(root,p));
const exists=p=>fs.existsSync(path.join(root,p));
const checks=[],ok=(n,test)=>{checks.push({check:n,passed:!!test});if(!test)console.error('FAIL',n)};
ok('Homepage included in output',exists('index.html'));
const page=read('index.html').toString('utf8');
ok('Open Graph image tag',page.includes('property="og:image"')&&page.includes('/og-image.jpg'));
ok('OG title matches HTML title',page.match(/<title>([^<]+)<\/title>/)?.[1]===page.match(/<meta property="og:title" content="([^"]+)"/)?.[1]);
ok('OG description matches SEO description',page.match(/name="description" content="([^"]+)"/)?.[1]===page.match(/property="og:description" content="([^"]+)"/)?.[1]);
ok('Favicon linked',page.includes('href="/favicon.svg"'));
ok('Surveyed date and fetch check time code',page.includes('formatSurveyDate(data.date)')&&page.includes('formatCheckedAt(data.checkedAt)'));
ok('robots.txt includes sitemap',read('robots.txt').toString('utf8').includes('/sitemap.xml'));
const site=read('sitemap.xml').toString('utf8');
ok('Sitemap contains root once',((site.match(/<loc>/g)||[]).length===1)&&site.includes('<changefreq>daily</changefreq>'));
ok('SVG favicon well-formed root',read('favicon.svg').toString('utf8').includes('<svg'));
const img=read('og-image.jpg');
ok('OG JPEG signature and size limit',img[0]===255&&img[1]===216&&img.length<5e6);
function jpegDims(b){
 let i=2;while(i<b.length-10){if(b[i]!==255){i++;continue}let marker=b[i+1];if([0xC0,0xC1,0xC2,0xC3].includes(marker))return [b.readUInt16BE(i+7),b.readUInt16BE(i+5)];const n=b.readUInt16BE(i+2);if(n<2)break;i+=2+n}
 return [0,0]
}
ok('OG image exactly 1200x630',JSON.stringify(jpegDims(img))===JSON.stringify([1200,630]));
ok('Apple photos remain available',exists('photos/fruit-apple.jpg'));
ok('Historic price dataset preserved',exists('data/year-index.json')&&exists('data/history/411.json'));
ok('No API secrets or scripts published',!exists('api/prices.js')&&!exists('scripts/build-static.cjs')&&!exists('package.json'));
const report={testedAt:new Date().toISOString(),total:checks.length,passed:checks.filter(x=>x.passed).length,checks};
fs.writeFileSync('data/build-check-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.passed!==report.total)process.exitCode=1;
