import {forecast,copy,month,endMonth,ym} from './core.js';
// Registered spending uses purchase date and self burden. Repayment is never income here.
export function analyze(s,period,mode='ledger'){
 const annual=/^20\d\d$/.test(period);if(!annual)ym(period);
 const from=annual?period+'-01-01':period+'-01',to=annual?period+'-12-31':endMonth(period);
 const series=Array.from({length:annual?12:+to.slice(-2)},(_,i)=>({key:annual?`${period}-${String(i+1).padStart(2,'0')}`:`${period}-${String(i+1).padStart(2,'0')}`,label:annual?`${i+1}月`:`${i+1}日`,income:0,expense:0}));
 const add=(date,type,value)=>{if(date<from||date>to)return;const row=series.find(x=>x.key===(annual?month(date):date));if(row)row[type]+=value};
 if(mode==='cash'){
 const clean=copy(s);clean.settings.includeBudget=false;
 for(const e of forecast(clean,to).events){if(e.kind==='transfer')continue;add(e.date,e.kind.endsWith('In')?'income':'expense',e.amount)}
 }else{
 for(const r of s.records){if(r.kind==='expense')add(r.date,'expense',r.amount-r.share);if(r.kind==='income')add(r.date,'income',r.amount)}
 for(const x of s.settlements)if(x.type==='salary')add(x.payDate,'income',x.amount);
 }
 const income=series.reduce((a,x)=>a+x.income,0),expense=series.reduce((a,x)=>a+x.expense,0);return {income,expense,net:income-expense,series};
}
export function accountEvents(s,through,account){
 const clean=copy(s);clean.settings.includeBudget=false;
 return forecast(clean,through).events.flatMap(e=>{if(e.kind==='transfer')return [{...e,delta:account==='bank'?-e.amount:e.amount}];if(!e.kind.startsWith(account))return [];return [{...e,delta:e.kind.endsWith('In')?e.amount:-e.amount}]});
}
