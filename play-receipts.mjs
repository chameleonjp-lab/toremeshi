export const normalizeName=value=>String(value||'').trim().slice(0,10).replace(/[\uD800-\uDBFF]$/,'');
// A submission ID is not a participant identity. No legacy-name ownership is inferred.
export function createReceipts({storage,uuid,version}) {
 const prefix='toremeshi:receipts:v1:', memory=new Map();
 const normalize=normalizeName;
 const valid=p=>p&&p.game==='toremeshi'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.id)&&typeof p.name==='string'&&p.name===normalize(p.name)&&p.eligible===Boolean(p.name)&&typeof p.version==='string'&&p.result&&Number.isInteger(p.result.score)&&p.result.score>=0&&p.result.score<=22500&&Number.isInteger(p.result.correct)&&p.result.correct>=0&&p.result.correct<=15&&Number.isFinite(p.result.totalAnswerMs)&&p.result.totalAnswerMs>=0&&['pending','sending','failed','sent','anonymous'].includes(p.status);
 const payload=p=>JSON.stringify([p.id,p.game,p.version,p.name,p.eligible,p.result]);
 function save(p){p.persisted=false;if(!valid(p))return;try{const raw=storage.getItem(prefix+p.id);const old=raw?JSON.parse(raw):null;if(raw&&(!valid(old)||payload(old)!==payload(p)))throw Error('Conflicting receipt');if(old?.status==='sent')p.status='sent';storage.setItem(prefix+p.id,JSON.stringify(p));p.persisted=true;}catch(_){}memory.set(p.id,p);}
 function start(name){let id=null;for(let attempt=0;attempt<3;attempt++){let candidate;try{candidate=uuid()}catch(_){break}let exists=memory.has(candidate);try{exists=exists||storage.getItem(prefix+candidate)!==null&&storage.getItem(prefix+candidate)!==undefined}catch(_){}if(!exists){id=candidate;break}}return {id,game:'toremeshi',version,name:normalize(name),eligible:Boolean(normalize(name)),result:null,status:'playing',persisted:false};}
 function finish(p,result){if(!p||p.result)return p;p.result=Object.freeze(JSON.parse(JSON.stringify(result)));p.status=p.eligible?'pending':'anonymous';save(p);return p;}
 function status(p,value){if(p.status!=='sent')p.status=value;save(p);}
 function list(){const found=new Map();try{for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!key?.startsWith(prefix))continue;try{const p=JSON.parse(storage.getItem(key));if(!valid(p)||key!==prefix+p.id)continue;if(p.status==='sending')p.status='failed';p.persisted=true;found.set(p.id,p);}catch(_){}}}catch(_){}for(const [id,p] of memory){if(found.get(id)?.status==='sent')p.status='sent';found.set(id,p);}return [...found.values()];}
 return {start,finish,status,list,valid};
}
