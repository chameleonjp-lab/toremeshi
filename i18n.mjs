export function createI18n({catalogs,sourceMap={},stored,browser=[]}) {
 function match(value){const code=String(value||'').toLowerCase();if(code==='zh-tw'||code==='zh-hk'||code.startsWith('zh-hant'))return catalogs['zh-Hant']?'zh-Hant':null;if(code==='zh-cn'||code==='zh-sg'||code.startsWith('zh-hans')||code==='zh')return catalogs['zh-Hans']?'zh-Hans':null;if(code.startsWith('pt'))return catalogs['pt-BR']?'pt-BR':null;return Object.keys(catalogs).find(k=>k.toLowerCase()===code)||Object.keys(catalogs).find(k=>k.toLowerCase()===code.split('-')[0])||null;}
 let language=catalogs[stored]?stored:browser.map(match).find(Boolean)||'en';
 function text(key,values={}){const template=catalogs[language]?.ui[key]??catalogs.en?.ui[key]??catalogs.ja.ui[key]??key;return template.replace(/\{(v\d+)\}/g,(m,k)=>values[k]===undefined?m:String(values[k]));}
 function data(source){const key=sourceMap[source];return key?(catalogs[language]?.data[key]??catalogs.en?.data[key]??source):source;}
 return {get language(){return language},text,data,set(value){if(!catalogs[value])return false;language=value;return true},languages:Object.keys(catalogs)};
}
