import {validate,check} from './core.js';
export const KEY='kakeibo_pwa_v11',PREVIOUS=KEY+'_previous';
export function repository(storage){let known=storage.getItem(KEY);return {
 load(){if(!known)return null;return validate(JSON.parse(known))},
 save(s){validate(s);check(storage.getItem(KEY)===known,'別タブで更新されています。再読み込みしてからやり直してください');const raw=JSON.stringify(s);check(raw.length<=2000000,'保存上限です。バックアップ後に記録を整理してください');if(known)storage.setItem(PREVIOUS,known);storage.setItem(KEY,raw);known=raw},
 recover(){const raw=storage.getItem(PREVIOUS);check(raw,'復元用コピーがありません');const s=validate(JSON.parse(raw));storage.setItem(KEY,raw);known=raw;return s}
}}
export async function digest(payload){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload))))].map(b=>b.toString(16).padStart(2,'0')).join('')}
export async function pack(s){validate(s);return {format:'kakeibo-backup',version:11,exportedAt:new Date().toISOString(),sha256:await digest(s),data:s}}
export async function unpack(text){check(text.length<=2000000,'バックアップは2MB以内です');const b=JSON.parse(text);check(b.format==='kakeibo-backup'&&b.version===11,'v1.1の書き出しファイルを選択してください');check(b.sha256===await digest(b.data),'チェックサムが一致しません。ファイルが破損・変更されています');return validate(b.data)}
