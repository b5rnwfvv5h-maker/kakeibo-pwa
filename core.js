/* Pure accounting domain. No network, DOM or storage. */
export const VERSION=11, LIMIT=100000000;
export const copy=x=>JSON.parse(JSON.stringify(x));
export const today=()=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`};
export function check(v,msg){if(!v)throw Error(msg)}
export function date(s){check(typeof s==='string'&&/^20\d\d-\d\d-\d\d$/.test(s)&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s,'日付は2000〜2099年の実在日を指定してください');return s}
export function ym(s){check(typeof s==='string'&&/^20\d\d-(0[1-9]|1[0-2])$/.test(s),'年月は YYYY-MM で指定してください');return s}
export const month=d=>d.slice(0,7);
export function addMonth(m,n){const [y,a]=m.split('-').map(Number),d=new Date(Date.UTC(y,a-1+n,1));return d.toISOString().slice(0,7)}
export const endMonth=m=>new Date(Date.UTC(+m.slice(0,4),+m.slice(5),0)).toISOString().slice(0,10);
export function num(v,min=0,max=LIMIT){check(Number.isSafeInteger(v)&&v>=min&&v<=max,'金額・数値の範囲が不正です');return v}
function str(v,max=200){check(typeof v==='string'&&v.length>0&&v.length<=max&&!/[\u0000-\u001f]/.test(v),'文字列が空、長すぎる、または制御文字を含みます');return v}
export const uid=()=>crypto.randomUUID();
export function fresh(){return {version:VERSION,settings:null,records:[],rates:[],settlements:[],audit:[]}}
export function rateAt(s,d){return [...s.rates].filter(r=>r.from<=d).sort((a,b)=>b.from.localeCompare(a.from))[0]?.hourly||0}
export function wage(s,m){const a=s.records.filter(r=>r.kind==='work'&&month(r.date)===m);let basic=0;for(const r of a){const rate=rateAt(s,r.date);check(rate>0,`${r.date} に適用する時給がありません`);basic+=Math.round(rate*r.minutes/60)}return {basic,travel:a.length*540,total:basic+a.length*540,count:a.length}}
export const paid=(s,id)=>s.records.filter(r=>r.kind==='refund'&&r.parent===id).reduce((a,r)=>a+r.amount,0);
export function receivables(s){return s.records.filter(r=>(r.kind==='expense'&&r.share>0)||r.kind==='claim').map(r=>({...r,received:paid(s,r.id),remaining:(r.share??r.amount)-paid(s,r.id)}))}
export function cardExpected(s,m){const opening=s.settings.openingCards.find(x=>x.month===m);const fixed=addMonth(m,-1)>=month(s.settings.baseline)?fixedAt(s,addMonth(m,-1)).filter(x=>x.payment==='credit').reduce((a,x)=>a+x.amount,0):0;return (opening?opening.amount:fixed)+s.records.filter(r=>r.kind==='expense'&&r.payment==='credit'&&r.billMonth===m).reduce((a,r)=>a+r.amount,0)}
export const expected=(s,type,m)=>type==='card'?cardExpected(s,m):wage(s,m).total;
export const settlement=(s,type,m)=>s.settlements.find(x=>x.type===type&&x.month===m);
export function validate(s){
 check(s&&s.version===VERSION,'対応するv1.1バックアップではありません');
 for(const k of ['records','rates','settlements','audit'])check(Array.isArray(s[k])&&s[k].length<=20000,`${k} が不正です`);
 check(s.settings&&typeof s.settings==='object','初期設定が必要です');const t=s.settings;date(t.baseline);num(t.bank,-LIMIT);num(t.paypay);num(t.savings);num(t.foodBudget);check(typeof t.includeBudget==='boolean','予算設定が不正です');check(Array.isArray(t.openingCards)&&t.openingCards.length<=120,'開始時請求が不正です');
 validateFixed(s);const oms=new Set();for(const x of t.openingCards){ym(x.month);num(x.amount);check(!oms.has(x.month),'開始時請求月が重複しています');oms.add(x.month);check(x.month>=month(t.baseline),'開始時請求月が基準日前です')}
 const ds=new Set();for(const r of s.rates){date(r.from);num(r.hourly,1,100000);check(!ds.has(r.from),'時給の発効日が重複しています');ds.add(r.from)}
 const ids=new Set();for(const r of s.records){str(r.id,80);check(/^[\w-]+$/.test(r.id)&&!ids.has(r.id),'記録IDが不正・重複しています');ids.add(r.id);date(r.date);check(r.date>=t.baseline,'基準日前の記録があります');str(r.label);check(['expense','refund','claim','income','adjust','work'].includes(r.kind),'記録種別が不正です');
 if(r.kind==='work'){num(r.minutes,1,1440);check(rateAt(s,r.date)>0,'勤務日に適用する時給がありません')}
 else{num(r.amount,r.kind==='adjust'?-LIMIT:1);if(r.kind!=='claim')check(['bank','paypay','credit'].includes(r.payment),'支払方法が不正です');if(r.kind!=='expense')check(r.payment!=='credit','カードでの入金・調整はできません')}
 if(r.kind==='expense'){str(r.category,30);num(r.share,0,r.amount);if(r.payment==='credit'){ym(r.billMonth);check(r.billMonth>=addMonth(month(r.date),1),'請求月は利用月の翌月以降です')}}
 if(r.kind==='refund'){str(r.parent,80);check(r.payment==='paypay','返金先はPayPayです')}
 if(r.kind==='claim')check(r.share===undefined,'開始時立替に自己負担属性は指定できません');
 }
 for(const r of s.records.filter(x=>x.kind==='refund')){const p=s.records.find(x=>x.id===r.parent);check(p&&(p.kind==='expense'||p.kind==='claim')&&(p.share??p.amount)>0,'返金先の立替がありません');check(r.date>=p.date,'返金日が立替日より前です')}
 for(const r of receivables(s))check(r.remaining>=0,'返金額が立替額を超えています');
 const sk=new Set();for(const x of s.settlements){check(['card','salary'].includes(x.type),'照合種別が不正です');ym(x.month);date(x.payDate);check(x.payDate>=t.baseline&&month(x.payDate)===(x.type==='card'?x.month:addMonth(x.month,1)),'照合の入出金月が不正です');num(x.amount);num(x.estimate);str(x.note);check(!sk.has(x.type+x.month),'照合月が重複しています');sk.add(x.type+x.month)}
 for(const x of s.audit){str(x.at,50);str(x.action,200);check(x.before===null||typeof x.before==='object','訂正履歴が不正です');check(x.after===null||typeof x.after==='object','訂正履歴が不正です')}
 return s;
}
export function audit(s,action,before,after){s.audit.push({at:new Date().toISOString(),action,before:copy(before),after:copy(after)})}
export function reconcile(s,type,m,amount,payDate,note){ym(m);num(amount);date(payDate);str(note);const old=settlement(s,type,m)||null;const next={type,month:m,amount,payDate,note,estimate:expected(s,type,m)};s.settlements=s.settlements.filter(x=>!(x.type===type&&x.month===m));s.settlements.push(next);audit(s,'照合・確定額の訂正',old,next);validate(s);return next}
export function budget(s,m){let food=({'2026-11':26000,'2026-12':28500,'2027-01':32500,'2027-02':42000,'2027-03':46500})[m]??s.settings.foodBudget;return {食費:food,交際費:20000,日用品:3000}}
export function totals(s,m){const t={};for(const r of s.records.filter(r=>r.kind==='expense'&&month(r.date)===m))t[r.category]=(t[r.category]||0)+r.amount-r.share;return t}
export function forecast(s,through){date(through);const t=s.settings;let bank=t.bank,paypay=t.paypay,auto=0;const ev=[];const push=(d,kind,amount,label)=>{if(d>=t.baseline&&d<=through)ev.push({date:d,kind,amount,label,seq:ev.length})};
 for(let m=month(t.baseline);m<=month(through);m=addMonth(m,1)){
 for(const x of fixedAt(s,m).filter(x=>x.payment!=='credit'))push(x.date,x.payment+'Out',x.amount,x.label+'（定期予定）');
 const c=settlement(s,'card',m);push(c?.payDate||m+'-26','bankOut',c?c.amount:cardExpected(s,m),c?'カード確定額':'カード請求見込');
 const workMonth=addMonth(m,-1),w=settlement(s,'salary',workMonth);push(w?.payDate||m+'-25','bankIn',w?w.amount:wage(s,workMonth).total,w?'給与確定額（手取り）':'給与見込（控除前・交通費込）');
 if(t.includeBudget){const used=monthlySpending(s,m,true).categories;for(const [cat,limit] of Object.entries(budget(s,m)))push(endMonth(m),'bankOut',Math.max(0,limit-(used[cat]||0)),cat+' 未入力予算（仮定）')}
 }
 for(const r of s.records){if(r.kind==='work'||r.kind==='claim'||(r.kind==='expense'&&r.payment==='credit'))continue;push(r.date,r.payment+(r.kind==='expense'?'Out':'In'),r.amount,r.label)}
 // Same-day refunds/income precede expenses. Real payment order may differ.
 ev.sort((a,b)=>a.date.localeCompare(b.date)||(a.kind.endsWith('In')?0:1)-(b.kind.endsWith('In')?0:1)||a.seq-b.seq);
 const events=[];for(const e of ev){if(e.kind==='paypayOut'){const n=Math.max(0,Math.ceil((e.amount-paypay)/5000));if(n){bank-=n*5000;paypay+=n*5000;auto+=n;events.push({date:e.date,kind:'transfer',amount:n*5000,label:'PayPayオートチャージ'})}paypay-=e.amount}else if(e.kind==='paypayIn')paypay+=e.amount;else if(e.kind==='bankIn')bank+=e.amount;else bank-=e.amount;events.push(e)}
 const m=month(through),reserve=t.savings+(m==='2026-12'?48000:m==='2027-01'?14000:0);return {bank,paypay,auto,events,reserve,available:bank-reserve};
}
export function parse(s,input,defaultDate=today()){
 check(typeof input==='string'&&input.length<=500,'入力は500文字以内です');let text=input.normalize('NFKC').trim(),d=defaultDate;
 const dm=text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s+/);const short=!dm&&text.match(/^(\d{1,2})[/-](\d{1,2})\s+/);
 if(dm){d=`${dm[1]}-${dm[2].padStart(2,'0')}-${dm[3].padStart(2,'0')}`;text=text.slice(dm[0].length)}else if(short){d=`${defaultDate.slice(0,4)}-${short[1].padStart(2,'0')}-${short[2].padStart(2,'0')}`;text=text.slice(short[0].length)}date(d);check(d>=s.settings.baseline,'基準日前の取引は入力できません');
 const base={id:uid(),date:d};let m=text.match(/^(?:(\d+(?:\.\d+)?)時間)?(?:(\d+)分)?$/);
 if(m&&(m[1]||m[2])){const minutes=+(m[1]||0)*60+ +(m[2]||0);num(minutes,1,1440);if(m[1]&&m[2])check(+m[2]<60,'分は60未満です');check(rateAt(s,d)>0,'先に勤務日の時給を設定してください');return {...base,kind:'work',minutes,label:`勤務 ${minutes}分`}}
 const number='([+-]?\\d+(?:,\\d{3})*)';const n=x=>Number(x.replaceAll(',',''));
 m=text.match(new RegExp('^(銀行調整|PayPay調整)\\s*'+number+'円?$','i'));if(m)return {...base,kind:'adjust',payment:m[1]==='銀行調整'?'bank':'paypay',amount:num(n(m[2]),-LIMIT),label:m[1]};
 m=text.match(/^返金\s+([\w-]+)\s+(\d+(?:,\d{3})*)円?$/);if(m){const parent=s.records.find(r=>r.id===m[1]);check(parent,'立替IDが見つかりません。立替画面でコピーしてください');return {...base,kind:'refund',parent:parent.id,payment:'paypay',amount:num(n(m[2]),1),label:'返金 '+parent.label}}
 check(!text.startsWith('返金'),'返金は「返金 立替ID 金額」の形式です');
 m=text.match(/^(収入|開始時立替)\s+(\d+(?:,\d{3})*)円?(?:\s+(.+))?$/);if(m)return {...base,kind:m[1]==='収入'?'income':'claim',payment:'bank',amount:num(n(m[2]),1),label:m[3]||m[1]};
 m=text.match(/^(.+?)\s+(\d+(?:,\d{3})*)円?(?:\s+(.*))?$/);check(m,'形式を読み取れません。入力例を確認してください');const label=m[1],amount=num(n(m[2]),1),tail=m[3]||'';let payment='bank',share=0,billMonth=addMonth(month(d),1);
 check((tail.replace('半額PayPay返金予定','半額返金予定').match(/クレカ|カード|PayPay|iD|銀行/gi)||[]).length<=1,'支払方法は1つだけ指定してください');
 check((tail.match(/自己負担|半額(?:PayPay)?返金予定|\(立て替え\)/g)||[]).length<=1,'自己負担の指定は1つだけです');
 let rest=tail.replace('半額PayPay返金予定','半額返金予定').replace(/クレカ|カード|PayPay|iD|銀行/gi,x=>{payment=/クレカ|カード/.test(x)?'credit':/paypay/i.test(x)?'paypay':'bank';return ''});
 rest=rest.replace(/(?:自己負担)\s*(\d+)円?/g,(_,v)=>{share=amount-num(+v,0,amount);return ''}).replace(/半額(?:PayPay)?返金予定/g,()=>{share=Math.floor(amount/2);return ''}).replace(/\(立て替え\)/g,()=>{share=amount;return ''});
 rest=rest.replace(/請求\s*(20\d\d-\d\d)/g,(_,v)=>{billMonth=ym(v);return ''}).replace(/(\d{1,2})月(?:26日)?請求/g,(_,v)=>{let y=+d.slice(0,4);if(+v<+d.slice(5,7))y++;billMonth=ym(`${y}-${v.padStart(2,'0')}`);return ''});
 check(!rest.trim(),'未対応の指定があります。受取済の返金は立替画面から別に記録してください');
 const category=/交際|飲み|会食|友人|外食/.test(label)?'交際費':/食|飲料|コーヒー/.test(label)?'食費':/日用品|洗剤|雑貨/.test(label)?'日用品':/ETC|交通|電車|定期/.test(label)?'交通費':'その他';
 return {...base,kind:'expense',label,amount,payment,share,category,...(payment==='credit'?{billMonth}:{})};
}
export function addRecord(s,r){s.records.push(r);audit(s,'記録を追加',null,r);validate(s)}
export function removeRecord(s,id,reason){str(reason);const r=s.records.find(r=>r.id===id);check(r,'記録がありません');check(!s.records.some(x=>x.parent===id),'先に紐づく返金を削除してください');s.records=s.records.filter(x=>x.id!==id);audit(s,'記録を削除: '+reason,r,null);validate(s)}

export function defaultFixed(){return [[5,'Amazon Prime',890,'paypay'],[12,'DAZN',2600,'paypay'],[21,'Netflix',890,'paypay'],[31,'ジム',3000,'credit'],[31,'ChatGPT',3000,'credit'],[31,'日経電子版',4277,'credit']].map(([day,label,amount,payment],i)=>({id:'fixed-'+i,revisions:[{from:'2000-01',day,label,amount,payment,category:'固定費',enabled:true}]}))}
export function fixedHistory(s){return s.settings.fixedExpenses??defaultFixed()}
export function fixedAt(s,m){ym(m);return fixedHistory(s).flatMap(item=>{const r=[...item.revisions].filter(x=>x.from<=m).sort((a,b)=>b.from.localeCompare(a.from))[0];if(!r||!r.enabled)return [];const d=m+'-'+String(Math.min(r.day,+endMonth(m).slice(-2))).padStart(2,'0');return d<s.settings.baseline?[]:[{...r,id:item.id,date:d}]})}
export function validateFixed(s){if(s.settings.fixedExpenses===undefined)return;check(Array.isArray(s.settings.fixedExpenses)&&s.settings.fixedExpenses.length<=200,'固定支出は200件までです');const ids=new Set();for(const x of s.settings.fixedExpenses){str(x.id,80);check(/^[\w-]+$/.test(x.id)&&!ids.has(x.id),'固定支出IDが不正です');ids.add(x.id);check(Array.isArray(x.revisions)&&x.revisions.length>0&&x.revisions.length<=240,'固定支出の履歴が不正です');const months=new Set();for(const r of x.revisions){ym(r.from);check(!months.has(r.from),'固定支出の適用月が重複しています');months.add(r.from);str(r.label);str(r.category,30);num(r.amount,1);num(r.day,1,31);check(['bank','paypay','credit'].includes(r.payment),'固定支出の支払元が不正です');check(typeof r.enabled==='boolean','固定支出の状態が不正です')}}}
export function saveFixed(s,id,revision,reason){str(reason,150);if(!s.settings.fixedExpenses)s.settings.fixedExpenses=defaultFixed();let item=id?s.settings.fixedExpenses.find(x=>x.id===id):null;check(!id||item,'固定支出が見つかりません');const before=item?copy(item):null;if(!item){item={id:uid(),revisions:[]};s.settings.fixedExpenses.push(item)}item.revisions=item.revisions.filter(x=>x.from!==revision.from);item.revisions.push(copy(revision));validateFixed(s);audit(s,'固定支出変更: '+reason,before,item);return item.id}
export function monthlySpending(s,m,includeFixed=true){const categories=totals(s,m);if(includeFixed)for(const x of fixedAt(s,m))categories[x.category]=(categories[x.category]||0)+x.amount;return {categories,total:Object.values(categories).reduce((a,x)=>a+x,0)}}
export function monthComparison(s,m,total,previous){if(addMonth(m,-1)<month(s.settings.baseline))return '前月比：比較データなし';if(previous===0)return total===0?'前月比 0円':'前月比 ＋'+total.toLocaleString('ja-JP')+'円（前月0円）';const delta=(total-previous)/previous*100;return '前月比 '+(delta>0?'＋':delta<0?'−':'')+Math.abs(delta).toFixed(1)+'%'}
