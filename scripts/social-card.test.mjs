import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync,mkdtempSync,mkdirSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
import {catalogs,sourceMap} from '../locales.mjs';import {createI18n} from '../i18n.mjs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');const url='https://chameleonjp.codeberg.page/toremeshi/';const tags='#トレメシ #ゲーム制作';
function weight(value){return [...value.replace(/https?:\/\/[^\s]+/gu,'a'.repeat(23))].reduce((n,c)=>{const x=c.codePointAt(0);return n+((x<=0x10ff||(x>=0x2000&&x<=0x200d)||(x>=0x2010&&x<=0x201f)||(x>=0x2032&&x<=0x2037))?1:2)},0)}
test('all fifteen home/result templates end in official two tags and fit X weighted limit',()=>{
 assert.equal(Object.keys(catalogs).length,15);
 for(const language of Object.keys(catalogs)){const t=createI18n({catalogs,sourceMap,stored:language});
  for(const key of ['ui_076','ui_145']){const text=t.text(key,key==='ui_076'?{v0:url}:{v0:100000000,v1:15,v2:url});assert.ok(text.endsWith('\n'+tags),language+' '+key);assert.deepEqual(text.match(/#[^\s]+/gu),['#トレメシ','#ゲーム制作']);assert.equal(text.split(url).length,2);assert.ok(weight(text)<=280,language+' '+key+' '+weight(text));if(key==='ui_145'){assert.ok(text.includes('100000000'));assert.ok(text.includes('15'));}}
 }
});
test('actual fixed PNG is wired into consistent OG/Twitter large-image metadata',()=>{
 for(const attr of ['property="og:image"','name="twitter:image"'])assert.ok(html.includes(`<meta ${attr} content="${url}assets/social-card.png"`));
 assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image"'));for(const [key,value]of [['og:image:width','1200'],['og:image:height','630']])assert.ok(html.includes(`<meta property="${key}" content="${value}"`));
 const p=new URL('../assets/social-card.png',import.meta.url);assert.ok(existsSync(p));const b=readFileSync(p);assert.equal(b.subarray(1,4).toString(),'PNG');assert.equal(b.readUInt32BE(16),1200);assert.equal(b.readUInt32BE(20),630);
});
test('public allowlist contains the adopted image once and excludes capture/test artifacts',()=>{
 const manifest=JSON.parse(readFileSync(new URL('./pages-files.json',import.meta.url)));assert.equal(manifest.required.filter(x=>x==='assets/social-card.png').length,1);for(const p of [...manifest.required,...manifest.optional])assert.ok(!/test-results|capture-receipt|\.svg$|scripts\//.test(p),p);
 const root=mkdtempSync(join(tmpdir(),'tore-social-stage-'));for(const file of [...manifest.required,'scripts/pages-files.json','scripts/prepare-pages.py']){const dest=join(root,file);mkdirSync(dirname(dest),{recursive:true});copyFileSync(new URL('../'+file,import.meta.url),dest);}
 const result=spawnSync('python3',[join(root,'scripts/prepare-pages.py')],{encoding:'utf8',env:{...process.env,GIT_DIR:fileURLToPath(new URL('../.git',import.meta.url)),GIT_WORK_TREE:root}});assert.equal(result.status,0,result.stderr);for(const file of manifest.required)assert.deepEqual(readFileSync(join(root,'_site',file)),readFileSync(new URL('../'+file,import.meta.url)),file);assert.ok(!existsSync(join(root,'_site/scripts')));
});
