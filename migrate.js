import {fresh,validate,check,num,date,copy,addMonth,month,audit} from './core.js';
// Migration runs only after explicit selection. No legacy personal values in code.
export function migrate(v,links={}){
 check(v?.version===1&&v.settings&&Array.isArray(v.records)&&v.records.length<=20000,'v1バックアップの形式が不正です');
 const s=fresh(),t=v.settings;date(t.baseline);num(t.bank,-100000000);num(t.paypay);num(t.creditNov);num(t.savings);
 s.settings={baseline:t.baseline,bank:t.bank,paypay:t.paypay,savings:t.savings,foodBudget:30000,includeBudget:false,openingCards:[{month:month(t.baseline),amount:t.creditNov}]};
 s.rates=[{from:t.baseline,hourly:1490}];
 for(const r of v.records){const b={id:r.id,date:r.date,label:r.label};
 if(r.kind==='work')s.records.push({...b,kind:'work',minutes:r.mins});
 else if(r.kind==='expense'){const received=r.reimbReceived||0,pending=r.reimbPending||0;num(received);num(pending);const share=r.research?r.amount:received+pending;s.records.push({...b,kind:'expense',payment:r.payment,amount:r.amount,category:r.category||'その他',share,...(r.payment==='credit'?{billMonth:r.due?month(date(r.due)):addMonth(month(r.date),1)}:{})});if(received)s.records.push({id:r.id+'-refund',date:r.date,label:'移行時返金 '+r.label,kind:'refund',parent:r.id,payment:'paypay',amount:received})}
 else if(r.kind==='refund'){check(links[r.id],'v1の独立した返金は立替IDへの紐づけが必要です: '+r.id);s.records.push({...b,kind:'refund',parent:links[r.id],payment:'paypay',amount:r.amount})}
 else if(['income','adjust'].includes(r.kind))s.records.push({...b,kind:r.kind,payment:r.payment,amount:r.amount});else throw Error('未対応のv1記録です')
 }
 audit(s,'v1から移行。予測・請求・初期設定の再確認が必要',null,{records:s.records.length});return validate(copy(s));
}
