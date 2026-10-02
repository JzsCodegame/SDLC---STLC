export type Category = 'Electronics' | 'Lifestyle' | 'Learning';
export type Product = {id:string;name:string;category:Category;priceCents:number;stock:number;description:string;icon:string};
export type CartItem = {productId:string;quantity:number};
export type Customer = {name:string;address:string;city:string;postal:string};
export type Order = {id:string;items:Array<CartItem & {name:string;unitPriceCents:number}>;customer:Customer;totalCents:number;status:'Confirmed'};
export type Account = {id:string;name:string;number:string;balanceCents:number};
export type Transfer = {id:string;fromId:string;toId:string;amountCents:number;status:'Completed'};
export type CoverType = 'auto'|'home';
export type Coverage = 'basic'|'plus';
export type Quote = {id:string;type:CoverType;age:number;coverage:Coverage;premiumCents:number;saved:boolean};
export type Policy = {id:string;type:CoverType;coverage:Coverage;premiumCents:number;status:'Active';quoteId:string|null};
export type Claim = {id:string;policyId:string;incident:string;description:string;status:'Submitted'};
export type Plan = {id:string;name:string;priceCents:number;data:string;features:string[]};
export type Bill = {id:string;description:string;amountCents:number;status:'Due'|'Paid'};
export type SupportTicket = {id:string;subject:string;description:string;status:'Open'};
export type Session = {email:string;name:string};
export type DemoState = {schemaVersion:1;session:Session|null;cart:CartItem[];orders:Order[];accounts:Account[];transfers:Transfer[];quotes:Quote[];policies:Policy[];claims:Claim[];currentPlanId:string;bills:Bill[];tickets:SupportTicket[];sequence:{order:number;transfer:number;quote:number;policy:number;claim:number;ticket:number}};

export const DEMO_USER = {email:'student@miniquiz.demo',password:'Learn123!',name:'Alex Morgan'} as const;
export const PRODUCTS:Product[] = [
 {id:'p-keyboard',name:'Studio Keyboard',category:'Electronics',priceCents:7900,stock:8,description:'A compact keyboard for your next project.',icon:'keyboard'},
 {id:'p-headphones',name:'Focus Headphones',category:'Electronics',priceCents:12900,stock:6,description:'A little more focus for work and study.',icon:'headphones'},
 {id:'p-hub',name:'Everyday USB Hub',category:'Electronics',priceCents:3900,stock:12,description:'One tidy place for your essential connections.',icon:'hub'},
 {id:'p-notebook',name:'Ideas Notebook',category:'Learning',priceCents:1800,stock:20,description:'A fresh page for questions and discoveries.',icon:'notebook'},
 {id:'p-backpack',name:'Day Trip Backpack',category:'Lifestyle',priceCents:5900,stock:10,description:'Your daily essentials, ready to go.',icon:'backpack'},
 {id:'p-bottle',name:'Keep Going Bottle',category:'Lifestyle',priceCents:2400,stock:15,description:'A reusable bottle for your everyday routine.',icon:'bottle'}
];
export const PLANS:Plan[] = [
 {id:'essential',name:'Essential',priceCents:2500,data:'10 GB',features:['Unlimited calls & texts','4G / 5G access','Monthly billing']},
 {id:'everyday',name:'Everyday',priceCents:4500,data:'40 GB',features:['Unlimited calls & texts','10 GB hotspot','Monthly billing']},
 {id:'unlimited',name:'Unlimited',priceCents:6500,data:'Unlimited',features:['Unlimited calls & texts','30 GB hotspot','Monthly billing']}
];
export const formatMoney = (cents:number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
export const cartTotal = (state:DemoState) => state.cart.reduce((sum,item)=>sum+PRODUCTS.find(product=>product.id===item.productId)!.priceCents*item.quantity,0);

export function createSeedState():DemoState {
 return {schemaVersion:1,session:null,cart:[],orders:[],accounts:[{id:'checking',name:'Everyday Checking',number:'DEMO 1042',balanceCents:125000},{id:'savings',name:'Goal Savings',number:'DEMO 2086',balanceCents:380000}],transfers:[],quotes:[],policies:[{id:'POL-0001',type:'auto',coverage:'basic',premiumCents:4500,status:'Active',quoteId:null}],claims:[],currentPlanId:'everyday',bills:[{id:'BILL-1001',description:'Everyday plan - current demo month',amountCents:4500,status:'Due'}],tickets:[],sequence:{order:0,transfer:0,quote:0,policy:1,claim:0,ticket:0}};
}

export type Action =
 | {type:'login';email:string;password:string} | {type:'logout'} | {type:'reset'}
 | {type:'cartAdd';productId:string} | {type:'cartQuantity';productId:string;quantity:number} | {type:'cartRemove';productId:string}
 | {type:'checkout';customer:Customer}
 | {type:'transfer';fromId:string;toId:string;amount:string}
 | {type:'quote';insuranceType:CoverType;age:number;coverage:Coverage} | {type:'quoteSave';quoteId:string}
 | {type:'claim';policyId:string;incident:string;description:string}
 | {type:'selectPlan';planId:string} | {type:'payBill';billId:string}
 | {type:'ticket';subject:string;description:string};

const fail = (message:string):never => {throw new Error(message);};
function required(value:string,label:string,min=2,max=160):string {
 if(typeof value!=='string') return fail(`${label} is required.`);
 const clean=value.trim();
 if(clean.length<min||clean.length>max) return fail(`${label} must contain ${min}-${max} characters.`);
 return clean;
}
export function parseAmount(value:string):number {
 if(typeof value!=='string'||!/^\d{1,7}(?:\.\d{1,2})?$/.test(value.trim())) return fail('Enter an amount with at most two decimal places, such as 25.00.');
 const [whole,decimal='']=value.trim().split('.');
 const cents=Number(whole)*100+Number(decimal.padEnd(2,'0'));
 if(cents<=0) return fail('The transfer amount must be greater than zero.');
 return cents;
}
function nextId(state:DemoState,key:keyof DemoState['sequence'],prefix:string) {
 state.sequence[key]++; return `${prefix}-${String(state.sequence[key]).padStart(4,'0')}`;
}

export function applyAction(previous:DemoState,action:Action):DemoState {
 if(action.type==='login') {
  if(!action.email?.trim()||!action.password) return fail('Enter the demo email and password.');
  if(action.email.trim().toLowerCase()!==DEMO_USER.email||action.password!==DEMO_USER.password) return fail('The demo email or password is incorrect. Use the demonstration account shown here.');
  return {...previous,session:{email:DEMO_USER.email,name:DEMO_USER.name}};
 }
 if(action.type==='logout') return {...previous,session:null};
 if(!previous.session) return fail('Sign in with the demo account before using a practice workflow.');
 if(action.type==='reset') return {...createSeedState(),session:previous.session};
 const state=structuredClone(previous);
 switch(action.type) {
  case 'cartAdd': {
   const product=PRODUCTS.find(item=>item.id===action.productId); if(!product) return fail('That product is unavailable.');
   const existing=state.cart.find(item=>item.productId===product.id); const quantity=(existing?.quantity||0)+1;
   if(quantity>product.stock) return fail(`Only ${product.stock} ${product.name} items are available per demo order.`);
   if(existing) existing.quantity=quantity; else state.cart.push({productId:product.id,quantity});
   return state;
  }
  case 'cartQuantity': {
   const item=state.cart.find(item=>item.productId===action.productId); const product=PRODUCTS.find(item=>item.id===action.productId);
   if(!item||!product) return fail('This item is not in your cart.');
   if(!Number.isInteger(action.quantity)||action.quantity<1||action.quantity>product.stock) return fail(`Quantity must be a whole number from 1 to ${product.stock}. Use Remove to delete the item.`);
   item.quantity=action.quantity; return state;
  }
  case 'cartRemove': state.cart=state.cart.filter(item=>item.productId!==action.productId); return state;
  case 'checkout': {
   if(!state.cart.length) return fail('Add at least one product before checkout.');
   const customer={name:required(action.customer?.name,'Fictional name'),address:required(action.customer?.address,'Fictional street address',5),city:required(action.customer?.city,'City'),postal:required(action.customer?.postal,'Postal code',3,12)};
   if(!/^[A-Za-z0-9 -]+$/.test(customer.postal)) return fail('Use letters, numbers, spaces or a hyphen in the postal code.');
   const order:Order={id:nextId(state,'order','ORD'),customer,items:state.cart.map(item=>{const product=PRODUCTS.find(product=>product.id===item.productId)!;return {...item,name:product.name,unitPriceCents:product.priceCents};}),totalCents:cartTotal(state),status:'Confirmed'};
   state.orders.unshift(order); state.cart=[]; return state;
  }
  case 'transfer': {
   if(action.fromId===action.toId) return fail('Choose two different accounts.');
   const from=state.accounts.find(account=>account.id===action.fromId); const to=state.accounts.find(account=>account.id===action.toId);
   if(!from||!to) return fail('Select a valid source and destination account.');
   const amountCents=parseAmount(action.amount); if(amountCents>from.balanceCents) return fail('Insufficient demo funds in the source account.');
   from.balanceCents-=amountCents; to.balanceCents+=amountCents;
   state.transfers.unshift({id:nextId(state,'transfer','TRF'),fromId:from.id,toId:to.id,amountCents,status:'Completed'}); return state;
  }
  case 'quote': {
   if(!['auto','home'].includes(action.insuranceType)||!['basic','plus'].includes(action.coverage)) return fail('Choose an insurance type and coverage level.');
   if(!Number.isInteger(action.age)||action.age<18||action.age>100) return fail('Use a fictional age from 18 to 100.');
   // Classroom arithmetic only, not real actuarial pricing or underwriting.
   const premiumCents=(action.insuranceType==='auto'?3500:2800)+(action.coverage==='plus'?1800:0)+(action.age<25?1200:0);
   state.quotes.unshift({id:nextId(state,'quote','QTE'),type:action.insuranceType,age:action.age,coverage:action.coverage,premiumCents,saved:false}); return state;
  }
  case 'quoteSave': {
   const quote=state.quotes.find(item=>item.id===action.quoteId); if(!quote) return fail('Generate a quote first.');
   if(quote.saved) return fail('This quote already has a saved demo policy.');
   quote.saved=true; state.policies.unshift({id:nextId(state,'policy','POL'),type:quote.type,coverage:quote.coverage,premiumCents:quote.premiumCents,status:'Active',quoteId:quote.id}); return state;
  }
  case 'claim': {
   if(!state.policies.some(policy=>policy.id===action.policyId)) return fail('Choose an active demo policy.');
   const incident=required(action.incident,'Incident date',10,10); const date=new Date(`${incident}T00:00:00Z`);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(incident)||Number.isNaN(date.valueOf())||date.toISOString().slice(0,10)!==incident) return fail('Enter a valid incident date.');
   if(incident>new Date().toISOString().slice(0,10)) return fail('The incident date cannot be in the future.');
   const description=required(action.description,'Fictional incident description',10,500);
   state.claims.unshift({id:nextId(state,'claim','CLM'),policyId:action.policyId,incident,description,status:'Submitted'}); return state;
  }
  case 'selectPlan': {
   if(!PLANS.some(plan=>plan.id===action.planId)) return fail('Choose an available plan.');
   if(state.currentPlanId===action.planId) return fail('This is already your current plan.');
   state.currentPlanId=action.planId; return state;
  }
  case 'payBill': {
   const bill=state.bills.find(item=>item.id===action.billId); if(!bill) return fail('Choose a valid demo bill.');
   if(bill.status==='Paid') return fail('This demo bill has already been paid.');
   bill.status='Paid'; return state;
  }
  case 'ticket': {
   const subject=required(action.subject,'Subject',3,120); const description=required(action.description,'Fictional support details',10,500);
   state.tickets.unshift({id:nextId(state,'ticket','SUP'),subject,description,status:'Open'}); return state;
  }
  default: return fail('This practice action is not supported.');
 }
}
