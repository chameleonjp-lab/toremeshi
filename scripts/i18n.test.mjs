import test from 'node:test';import assert from 'node:assert/strict';
let createI18n;try{({createI18n}=await import('../i18n.mjs'))}catch{}
const catalogs={ja:{ui:{a:'得点 {v0}'},data:{food:'鶏肉'}},en:{ui:{a:'Score {v0}'},data:{food:'Chicken'}},'pt-BR':{ui:{a:'Pontos {v0}'},data:{food:'Frango'}}};
function setup(saved,browser){assert.equal(typeof createI18n,'function','translator exists');return createI18n({catalogs,sourceMap:{'鶏肉':'food'},stored:saved,browser});}
test('saved language wins, browser region matches, unsupported falls back English',()=>{assert.equal(setup('ja',['en-US']).language,'ja');assert.equal(setup(null,['pt-PT']).language,'pt-BR');assert.equal(setup(null,['xx']).language,'en');});
test('full templates preserve values and data meaning; names are not translated automatically',()=>{const t=setup('en',[]);assert.equal(t.text('a',{v0:123}),'Score 123');assert.equal(t.data('鶏肉'),'Chicken');assert.equal(t.data('unknown raw'),'unknown raw');});
test('language changes touch only translator state',()=>{const t=setup('ja',[]);t.set('en');assert.equal(t.text('a',{v0:5}),'Score 5');assert.equal(t.set('unknown'),false);assert.equal(t.language,'en');});
