import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,cartTotal,createSeedState,DEMO_USER,parseAmount,PRODUCTS} from '../src/model.ts';
import {loadSession,loadState,persistState,SESSION_KEY,STORAGE_KEY,validSavedState} from '../src/store.ts';

const signedIn=()=>applyAction(createSeedState(),{type:'login',email:DEMO_USER.email,password:DEMO_USER.password});
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};

test('demo login rejects invalid credentials and logout retains domain records',()=>{
 const seed=createSeedState();
 assert.throws(()=>applyAction(seed,{type:'login',email:'',password:''}),/Enter the demo/);
 assert.throws(()=>applyAction(seed,{type:'login',email:DEMO_USER.email,password:'incorrect'}),/incorrect/);
 assert.throws(()=>applyAction(seed,{type:'cartAdd',productId:'p-notebook'}),/Sign in/);
 let state=applyAction(seed,{type:'login',email:' STUDENT@MINIQUIZ.DEMO ',password:DEMO_USER.password});
 state=applyAction(state,{type:'cartAdd',productId:'p-notebook'});
 const loggedOut=applyAction(state,{type:'logout'});
 assert.equal(loggedOut.session,null); assert.deepEqual(loggedOut.cart,state.cart); assert.equal(seed.session,null);
});

test('cart quantity and checkout produce an exact immutable order snapshot',()=>{
 let state=signedIn(); const customer={name:'Taylor Example',address:'100 Demo Lane',city:'Sample City',postal:'DEMO 10'};
 assert.throws(()=>applyAction(state,{type:'checkout',customer}),/at least one/);
 state=applyAction(state,{type:'cartAdd',productId:'p-keyboard'});
 state=applyAction(state,{type:'cartQuantity',productId:'p-keyboard',quantity:2});
 state=applyAction(state,{type:'cartAdd',productId:'p-notebook'});
 assert.equal(cartTotal(state),17600);
 for(const quantity of [0,-1,1.5,9,NaN]) assert.throws(()=>applyAction(state,{type:'cartQuantity',productId:'p-keyboard',quantity}),/whole number/);
 assert.throws(()=>applyAction(state,{type:'checkout',customer:{...customer,address:''}}),/street address/);
 const ordered=applyAction(state,{type:'checkout',customer});
 assert.equal(ordered.cart.length,0); assert.equal(ordered.orders[0].id,'ORD-0001'); assert.equal(ordered.orders[0].totalCents,17600);
 assert.equal(ordered.orders[0].items[0].unitPriceCents,7900); assert.equal(state.cart.length,2); assert.equal(state.orders.length,0);
 const again=applyAction(ordered,{type:'cartAdd',productId:'p-keyboard'}); assert.equal(again.orders[0].items[0].quantity,2);
});

test('transfers preserve total funds exactly and all invalid requests leave balances unchanged',()=>{
 assert.equal(parseAmount('0.01'),1); assert.equal(parseAmount('10.10'),1010);
 for(const amount of ['-1','0','0.001','1e3','Infinity','', '1,000']) assert.throws(()=>parseAmount(amount));
 let state=signedIn(); const before=structuredClone(state);
 for(const action of [{fromId:'checking',toId:'checking',amount:'1.00'},{fromId:'checking',toId:'missing',amount:'1.00'},{fromId:'checking',toId:'savings',amount:'1250.01'},{fromId:'checking',toId:'savings',amount:'-1'}]) assert.throws(()=>applyAction(state,{type:'transfer',...action}));
 assert.deepEqual(state,before);
 state=applyAction(state,{type:'transfer',fromId:'checking',toId:'savings',amount:'10.10'});
 assert.deepEqual(state.accounts.map(account=>account.balanceCents),[123990,381010]);
 assert.equal(state.accounts.reduce((sum,account)=>sum+account.balanceCents,0),505000);
 assert.deepEqual(state.transfers[0],{id:'TRF-0001',fromId:'checking',toId:'savings',amountCents:1010,status:'Completed'});
});

test('illustrative quotes save once and claims require a real demo policy and valid details',()=>{
 let state=signedIn();
 assert.throws(()=>applyAction(state,{type:'quote',insuranceType:'auto',age:17,coverage:'basic'}),/18 to 100/);
 state=applyAction(state,{type:'quote',insuranceType:'auto',age:22,coverage:'plus'});
 assert.equal(state.quotes[0].premiumCents,6500); assert.equal(state.policies.length,1);
 state=applyAction(state,{type:'quoteSave',quoteId:state.quotes[0].id});
 assert.equal(state.policies[0].id,'POL-0002'); assert.equal(state.quotes[0].saved,true);
 assert.throws(()=>applyAction(state,{type:'quoteSave',quoteId:state.quotes[0].id}),/already/);
 const details={type:'claim',policyId:'POL-0002',incident:'2026-01-15',description:'Fictional windscreen damage for classroom practice.'};
 for(const change of [{policyId:'missing'},{incident:'2026-02-31'},{incident:'9999-12-31'},{description:'short'}]) assert.throws(()=>applyAction(state,{...details,...change}));
 state=applyAction(state,details); assert.equal(state.claims[0].status,'Submitted'); assert.equal(state.claims[0].policyId,'POL-0002');
});

test('telecom plan change preserves current bill and simulated payment cannot repeat',()=>{
 let state=signedIn();
 assert.throws(()=>applyAction(state,{type:'selectPlan',planId:'unknown'}),/available/);
 state=applyAction(state,{type:'selectPlan',planId:'unlimited'});
 assert.equal(state.currentPlanId,'unlimited'); assert.equal(state.bills[0].amountCents,4500);
 assert.throws(()=>applyAction(state,{type:'selectPlan',planId:'unlimited'}),/already/);
 state=applyAction(state,{type:'payBill',billId:'BILL-1001'}); assert.equal(state.bills[0].status,'Paid');
 assert.throws(()=>applyAction(state,{type:'payBill',billId:'BILL-1001'}),/already/);
 assert.throws(()=>applyAction(state,{type:'ticket',subject:'Hi',description:'short'}));
 state=applyAction(state,{type:'ticket',subject:'Demo network issue',description:'Fictional connection issue used for UI automation.'});
 assert.equal(state.tickets[0].id,'SUP-0001'); assert.equal(state.tickets[0].status,'Open');
});

test('versioned persistence keeps workflows while credentials remain out of stored domain data',()=>{
 const local=memory(); const session=memory();
 let state=signedIn(); state=applyAction(state,{type:'cartAdd',productId:PRODUCTS[0].id}); state=applyAction(state,{type:'transfer',fromId:'checking',toId:'savings',amount:'0.01'});
 persistState(local,state); const stored=local.getItem(STORAGE_KEY);
 assert.ok(!stored.includes(DEMO_USER.password)); assert.ok(!stored.includes(DEMO_USER.email)); assert.ok(!stored.includes('session'));
 const restored=loadState(local); assert.equal(restored.warning,null); assert.equal(restored.state.session,null); assert.deepEqual(restored.state.cart,state.cart); assert.deepEqual(restored.state.transfers,state.transfers);
 session.setItem(SESSION_KEY,JSON.stringify(state.session)); assert.deepEqual(loadSession(session),state.session);
 session.removeItem(SESSION_KEY); assert.equal(loadSession(session),null);
 const reset=applyAction(state,{type:'reset'}); assert.deepEqual({...reset,session:null},createSeedState()); assert.deepEqual(reset.session,state.session);
});

test('corrupt or incompatible local storage recovers with a warning instead of broken UI state',()=>{
 const storage=memory();
 for(const invalid of ['{bad json','null',JSON.stringify({schemaVersion:99}),JSON.stringify({...createSeedState(),cart:[{productId:'unknown',quantity:1}]}),JSON.stringify({...createSeedState(),accounts:null}),JSON.stringify({...createSeedState(),currentPlanId:'missing'})]) {
  storage.setItem(STORAGE_KEY,invalid); const result=loadState(storage); assert.ok(result.warning); assert.deepEqual(result.state,createSeedState());
 }
 const valid=createSeedState(); delete valid.session; assert.equal(validSavedState(valid),true);
 const blocked={getItem(){throw new Error('disabled');},setItem(){throw new Error('quota');},removeItem(){}};
 assert.ok(loadState(blocked).warning); assert.throws(()=>persistState(blocked,signedIn()),/quota/);
});
