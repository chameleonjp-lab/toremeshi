import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(new URL('..',import.meta.url).pathname),origin='https://toremeshi.test';
const manifest=JSON.parse(fs.readFileSync(path.join(root,'scripts/pages-files.json'),'utf8'));
const allowed=new Set([...manifest.required,...manifest.optional]);
const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.csv':'text/csv'};
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:1000,height:1000},locale:'ja-JP',deviceScaleFactor:1,serviceWorkers:'block'});
 const forbidden=[],errors=[];
 await context.route('**/*',async route=>{
  const request=route.request(),u=new URL(request.url());
  if(!['GET','HEAD'].includes(request.method())){forbidden.push({method:request.method(),path:u.pathname});return route.abort('blockedbyclient')}
  let file;
  if(u.origin===origin){
   const relative=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname.slice(1));
   if(allowed.has(relative))file=path.join(root,relative);
   // This optional model is absent in the actual repository. Preserve the real built-in fallback.
   if(relative==='assets/characters/trainer.glb'&&!fs.existsSync(file))return route.fulfill({status:404,body:''});
  }else if(u.origin==='https://cdn.jsdelivr.net'&&u.pathname.startsWith('/npm/three@0.184.0/')){
   const relative=u.pathname.slice('/npm/three@0.184.0/'.length);
   const base=path.join(root,'node_modules/three');const candidate=path.resolve(base,relative);
   if((relative.startsWith('build/')||relative.startsWith('examples/jsm/'))&&candidate.startsWith(base+path.sep)&&candidate.endsWith('.js'))file=candidate;
  }
  if(!file||!fs.existsSync(file)){forbidden.push({method:request.method(),origin:u.origin,path:u.pathname});return route.abort('blockedbyclient')}
  let body=fs.readFileSync(file);
  if(file===path.join(root,'three-client.js')){
   const source=body.toString();assert.equal(source.split('renderer.render(scene, camera);').length,2);
   body=Buffer.from(source.replace('renderer.render(scene, camera);','renderer.render(scene, camera); window.__trainerFrames=(window.__trainerFrames||0)+1;'));
  }
  return route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body:request.method()==='HEAD'?Buffer.alloc(0):body,headers:{'access-control-allow-origin':'*'}});
 });
 await context.routeWebSocket('**/*',ws=>{forbidden.push({webSocket:true});ws.close()});
 await context.addInitScript(()=>{localStorage.setItem('toremeshi:language:v1','ja');localStorage.setItem('toremeshi:sound:v1',JSON.stringify({enabled:false,volume:0}));let seed=23;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);window.open=()=>null;});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/');await page.locator('.name-input').fill('');await page.locator('#panel > button.primary').click();
 await page.locator('.intro-start').click();await page.locator('.choice').first().waitFor({state:'visible'});await page.waitForFunction(()=>{const c=document.querySelector('#three-character-container canvas');return window.__trainerFrames>=5&&c?.width>100&&c?.height>100});
 const framesAfterReveal=await page.evaluate(()=>window.__trainerFrames);await page.waitForFunction(before=>window.__trainerFrames>=before+2,framesAfterReveal);
 const renderer=await page.locator('#three-character-container canvas').evaluate(canvas=>{const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');return{width:canvas.width,height:canvas.height,contextLost:!gl||gl.isContextLost()}});
 assert.equal(renderer.contextLost,false);assert.ok(renderer.width>100&&renderer.height>100);
 const out=path.join(root,'test-results/share-capture');fs.mkdirSync(out,{recursive:true});
 await page.locator('#panel').screenshot({path:path.join(out,'toremeshi-real-question.png')});
 await page.locator('#three-character-container').screenshot({path:path.join(out,'toremeshi-real-trainer.png')});
 assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
 fs.writeFileSync(path.join(out,'capture-receipt.json'),JSON.stringify({seed:23,renderer,anonymous:true,productionWrites:0,externalRequests:0,question:await page.locator('#panel').innerText(),source:'actual first question and existing built-in trainer; no rule/data/model edits'},null,2));
}finally{await browser.close()}
