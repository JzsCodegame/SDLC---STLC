import {useRef,useState} from 'react';
import {applyAction,createSeedState,DEMO_USER,PLANS,PRODUCTS} from './model.ts';
import type {Action,DemoState,Session} from './model.ts';

export const STORAGE_KEY='mqa-public-practice-v1';
export const SESSION_KEY='mqa-public-practice-session-v1';
export type StorageLike=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
type Loaded={state:DemoState;warning:string|null};

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown)=>typeof v==='string'&&v.length>0&&v.length<=1000;
const cents=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=1_000_000_000;
const rows=(v:unknown,check:(row:any)=>boolean)=>Array.isArray(v)&&v.length<=10000&&v.every(row=>object(row)&&check(row));
const covers=(r:any)=>['auto','home'].includes(r.type)&&['basic','plus'].includes(r.coverage)&&cents(r.premiumCents);
const unique=(rows:Array<{id:string}>)=>new Set(rows.map(row=>row.id)).size===rows.length;

export function validSavedState(value:unknown):value is Omit<DemoState,'session'> {
 if(!object(value)||value.schemaVersion!==1||!object(value.sequence)) return false;
 const s=value as any;
 if(!['order','transfer','quote','policy','claim','ticket'].every(key=>Number.isSafeInteger(s.sequence[key])&&s.sequence[key]>=0&&s.sequence[key]<100000)) return false;
 if(!rows(s.cart,r=>PRODUCTS.some(p=>p.id===r.productId&&Number.isInteger(r.quantity)&&r.quantity>=1&&r.quantity<=p.stock))||new Set(s.cart.map((r:any)=>r.productId)).size!==s.cart.length) return false;
 if(!rows(s.accounts,r=>['checking','savings'].includes(r.id)&&text(r.name)&&text(r.number)&&cents(r.balanceCents))||s.accounts.length!==2||!unique(s.accounts)) return false;
 if(!rows(s.orders,r=>text(r.id)&&r.status==='Confirmed'&&object(r.customer)&&['name','address','city','postal'].every(k=>text(r.customer[k]))&&cents(r.totalCents)&&rows(r.items,(i:any)=>PRODUCTS.some(p=>p.id===i.productId)&&text(i.name)&&cents(i.unitPriceCents)&&Number.isInteger(i.quantity)&&i.quantity>0&&i.quantity<=20)&&r.items.length>0&&r.totalCents===r.items.reduce((total:number,i:any)=>total+i.unitPriceCents*i.quantity,0))) return false;
 if(!rows(s.transfers,r=>text(r.id)&&r.status==='Completed'&&s.accounts.some((a:any)=>a.id===r.fromId)&&s.accounts.some((a:any)=>a.id===r.toId)&&r.fromId!==r.toId&&cents(r.amountCents)&&r.amountCents>0)) return false;
 if(!rows(s.quotes,r=>text(r.id)&&covers(r)&&Number.isInteger(r.age)&&r.age>=18&&r.age<=100&&typeof r.saved==='boolean')) return false;
 if(!rows(s.policies,r=>text(r.id)&&covers(r)&&r.status==='Active'&&(r.quoteId===null||s.quotes.some((q:any)=>q.id===r.quoteId)))) return false;
 if(!rows(s.claims,r=>text(r.id)&&s.policies.some((p:any)=>p.id===r.policyId)&&typeof r.incident==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.incident)&&text(r.description)&&r.status==='Submitted')) return false;
 if(!PLANS.some(p=>p.id===s.currentPlanId)||!rows(s.bills,r=>text(r.id)&&text(r.description)&&cents(r.amountCents)&&['Due','Paid'].includes(r.status))) return false;
 if(!rows(s.tickets,r=>text(r.id)&&text(r.subject)&&text(r.description)&&r.status==='Open')) return false;
 if(![s.orders,s.transfers,s.quotes,s.policies,s.claims,s.bills,s.tickets].every(unique)) return false;
 const counters=[['orders','order'],['transfers','transfer'],['quotes','quote'],['policies','policy'],['claims','claim'],['tickets','ticket']];
 return counters.every(([collection,key])=>s[collection].every((r:any)=>/^[A-Z]{3}-\d{4,}$/.test(r.id)&&Number(r.id.split('-')[1])<=s.sequence[key]));
}

export function loadState(storage:StorageLike):Loaded {
 try {
  const saved=storage.getItem(STORAGE_KEY);
  if(!saved) return {state:createSeedState(),warning:null};
  if(saved.length>2_000_000) throw new Error('Storage exceeds the demo limit.');
  const parsed:unknown=JSON.parse(saved);
  if(!validSavedState(parsed)) throw new Error('Unsupported or invalid saved data.');
  return {state:{...parsed,session:null},warning:null};
 } catch {return {state:createSeedState(),warning:'Saved demo data could not be read. Fresh fictional records have been loaded.'};}
}

export function persistState(storage:StorageLike,state:DemoState):void {
 const {session:ignored,...domain}=state;
 const serialized=JSON.stringify(domain);
 if(serialized.length>2_000_000) throw new Error('Demo storage is full.');
 storage.setItem(STORAGE_KEY,serialized);
}
export function loadSession(storage:StorageLike):Session|null {
 try {const raw=JSON.parse(storage.getItem(SESSION_KEY)||'null');return raw?.email===DEMO_USER.email&&raw?.name===DEMO_USER.name?{email:DEMO_USER.email,name:DEMO_USER.name}:null;} catch {return null;}
}

export function usePlayground() {
 const [loaded]=useState<Loaded>(()=>{
  let result:Loaded;
  try {result=loadState(window.localStorage);} catch {result={state:createSeedState(),warning:'Browser storage is unavailable. Changes will last only while this tab stays open.'};}
  try {result.state.session=loadSession(window.sessionStorage);} catch {}
  return result;
 });
 const [state,setState]=useState(loaded.state);
 const current=useRef(state);
 const [error,setError]=useState<string|null>(null);
 const [storageWarning,setStorageWarning]=useState<string|null>(loaded.warning);
 function dispatch(action:Action):boolean {
  try {
   const next=applyAction(current.current,action);
   let warning:string|null=null;
   try {persistState(window.localStorage,next);} catch {warning='Your change is visible in this tab, but browser storage could not save it. It may be lost when you leave.';}
   try {
    if(next.session) window.sessionStorage.setItem(SESSION_KEY,JSON.stringify(next.session));
    else window.sessionStorage.removeItem(SESSION_KEY);
   } catch {warning='This demo session could not be saved. Sign-in may be needed after a reload.';}
   current.current=next;setState(next);setError(null);setStorageWarning(warning);return true;
  } catch(cause) {setError(cause instanceof Error?cause.message:'The practice action could not be completed.');return false;}
 }
 return {state,dispatch,error,clearError:()=>setError(null),storageWarning};
}
