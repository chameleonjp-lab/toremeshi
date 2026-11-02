import {chromium,webkit} from 'playwright';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {catalogs} from '../locales.mjs';import {inspectShareTarget} from './share-visibility.mjs';
const root=path.resolve(new URL('..',import.meta.url).pathname),origin='https://toremeshi.test',official='https://chameleonjp.codeberg.page/toremeshi/';
const engine=process.env.BROWSER_ENGINE||'chromium';assert.ok(['chromium','webkit'].includes(engine));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'scripts/pages-files.json'),'utf8')),allowed=new Set([...manifest.required,...manifest.optional]);
const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.csv':'text/csv','.json':'application/json','.png':'image/png'};
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.equal(source.split('<script type="module">').length,2);
const html=source.replace('<script type="module">','<script type="module">\nwindow.__shareTest={getStats:()=>structuredClone(stats),getState:()=>state,tr:(...args)=>tr(...args)};');
const out=path.join(root,'test-results/share-visible');fs.mkdirSync(out,{recursive:true});const receipts=[];
const browser=await ({chromium,webkit})[engine].launch({headless:true});
try{
 for(const lang of Object.keys(catalogs))for(const orientation of ['portrait',...(['ja','en','de'].includes(lang)?['landscape']:[])]){
  const context=await browser.newContext({viewport:orientation==='portrait'?{width:393,height:852}:{width:852,height:393},hasTouch:true,locale:lang,serviceWorkers:'block'});const forbidden=[],errors=[];
  await context.route('**/*',async route=>{
   const request=route.request(),u=new URL(request.url());if(!['GET','HEAD'].includes(request.method())){forbidden.push({method:request.method(),path:u.pathname});return route.abort('blockedbyclient')}
   if(u.origin==='https://cdn.jsdelivr.net'&&u.pathname==='/npm/@supabase/supabase-js/+esm')return route.fulfill({contentType:'application/javascript',body:`export const createClient=()=>({rpc:async(name)=>{window.__rpc.push(name);if(name!=='get_best_score_ranking')throw Error('No score submission is allowed');return{data:[],error:null}}});`,headers:{'access-control-allow-origin':'*'}});
   let file;
   if(u.origin===origin){const relative=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname.slice(1));if(allowed.has(relative))file=path.join(root,relative);if(relative==='assets/characters/trainer.glb'&&!fs.existsSync(file))return route.fulfill({status:404,body:''});}
   else if(u.origin==='https://cdn.jsdelivr.net'&&u.pathname.startsWith('/npm/three@0.184.0/')){const relative=u.pathname.slice('/npm/three@0.184.0/'.length),base=path.join(root,'node_modules/three'),candidate=path.resolve(base,relative);if((relative.startsWith('build/')||relative.startsWith('examples/jsm/'))&&candidate.startsWith(base+path.sep)&&candidate.endsWith('.js'))file=candidate;}
   if(!file||!fs.existsSync(file)){forbidden.push({method:request.method(),origin:u.origin,path:u.pathname});return route.abort('blockedbyclient')}
   return route.fulfill({contentType:mime[path.extname(file)]||'application/octet-stream',body:request.method()==='HEAD'?Buffer.alloc(0):file===path.join(root,'index.html')?html:fs.readFileSync(file),headers:{'access-control-allow-origin':'*'}});
  });
  await context.routeWebSocket('**/*',ws=>{forbidden.push({webSocket:true});ws.close()});
  await context.addInitScript(language=>{localStorage.setItem('toremeshi:language:v1',language);localStorage.setItem('toremeshi:sound:v1',JSON.stringify({enabled:false,volume:0}));window.__rpc=[];window.__intents=[];window.open=()=>({opener:null,location:{replace:u=>window.__intents.push(u)}});const real=setTimeout;window.setTimeout=(fn,ms,...args)=>real(fn,Math.min(ms||0,5),...args);},lang);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/');await page.locator('.name-input').waitFor({state:'visible'});
  const representative=['ja','en','de'].includes(lang);
  async function share(screen,expected){
   const button=page.locator('button.common-x-share');assert.equal(await button.count(),1);await button.scrollIntoViewIfNeeded();const geometry=await button.evaluate(inspectShareTarget);
   for(const k of ['visible','viewport','unclipped','hit','fits'])assert.equal(geometry[k],true,`${lang} ${orientation} ${screen} ${k} ${JSON.stringify(geometry)}`);assert.ok(geometry.width>=44&&geometry.height>=44);
   assert.equal(await button.textContent(),await page.evaluate(()=>__shareTest.tr('ui_075')));const colors=await button.evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}));assert.deepEqual(colors,{background:'rgb(0, 0, 0)',color:'rgb(255, 255, 255)'});
   if(representative)await page.screenshot({path:path.join(out,`${engine}-${lang}-${orientation}-${screen}.png`)});
   const count=await page.evaluate(()=>__intents.length);await button.tap();const intents=await page.evaluate(()=>__intents);assert.equal(intents.length,count+1);const intent=new URL(intents.at(-1));assert.equal(intent.origin,'https://x.com');assert.equal(intent.pathname,'/intent/post');assert.equal(intent.searchParams.get('text'),expected);assert.equal(await page.locator('#commonShareFallback').evaluate(el=>el.open),false);return geometry;
  }
  const home=await share('home',await page.evaluate(url=>__shareTest.tr('ui_076',{v0:url}),official));
  await page.locator('.name-input').fill('');await page.locator('#panel > button.primary').tap();await page.locator('.intro-start').tap();
  for(let i=0;i<15;i++){await page.locator('.choice:not([disabled])').first().tap();await page.locator('.next-action').tap();}
  await page.locator('.result-grid').waitFor({state:'visible'});const before=await page.evaluate(()=>__shareTest.getStats());
  const expected=await page.evaluate(({stats,url})=>__shareTest.tr('ui_145',{v0:stats.score,v1:stats.correct,v2:url}),{stats:before,url:official});const result=await share('result',expected);assert.deepEqual(await page.evaluate(()=>__shareTest.getStats()),before);
  assert.deepEqual(await page.evaluate(()=>__rpc.filter(x=>x!=='get_best_score_ranking')),[]);assert.deepEqual(forbidden,[]);assert.deepEqual(errors,[]);
  receipts.push({lang,orientation,home,result,anonymous:true,score:before.score,productionWrites:0});await context.close();
 }
 fs.writeFileSync(path.join(out,`${engine}-receipt.json`),JSON.stringify(receipts,null,2));console.log(JSON.stringify({engine,cases:receipts.length,homeResult:true,productionWrites:0}));
}finally{await browser.close()}
