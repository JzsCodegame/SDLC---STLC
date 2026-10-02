import { FormEvent, useEffect, useRef, useState } from 'react';
import { Account, DEMO_USER, PLANS, PRODUCTS, cartTotal, formatMoney } from './model';
import { usePlayground } from './store';
import './styles.css';

type Area = 'dashboard' | 'commerce' | 'banking' | 'insurance' | 'telecom';
const areas: Array<{id: Area; label: string; eyebrow: string}> = [
  {id: 'dashboard', label: 'Dashboard', eyebrow: 'Your practice home'},
  {id: 'commerce', label: 'Commerce', eyebrow: 'Shop with fictional products'},
  {id: 'banking', label: 'Banking', eyebrow: 'Move fictional balances'},
  {id: 'insurance', label: 'Insurance', eyebrow: 'Quote, save, and claim'},
  {id: 'telecom', label: 'Telecom', eyebrow: 'Manage a demo mobile plan'}
];

function AccountName({accountId, accounts}: {accountId: string; accounts: Account[]}) {
  return <>{accounts.find((account) => account.id === accountId)?.name ?? accountId}</>;
}

function ProductIcon({kind}: {kind: string}) {
  const common = {viewBox: '0 0 48 48', role: 'img' as const, 'aria-label': `${kind} illustration`};
  if (kind === 'keyboard') return <svg {...common}><rect x="6" y="15" width="36" height="20" rx="3"/><path d="M11 21h2m4 0h2m4 0h2m4 0h2m4 0h2M11 28h20m4 0h2"/></svg>;
  if (kind === 'headphones') return <svg {...common}><path d="M10 28v-5a14 14 0 0 1 28 0v5M10 27h7v11h-4a3 3 0 0 1-3-3zm28 0h-7v11h4a3 3 0 0 0 3-3z"/></svg>;
  if (kind === 'hub') return <svg {...common}><rect x="11" y="17" width="26" height="15" rx="3"/><path d="M17 22h.1m6 0h.1m6 0h.1M24 17V9m-8 23v7m16-7v7"/></svg>;
  if (kind === 'notebook') return <svg {...common}><rect x="12" y="8" width="24" height="32" rx="2"/><path d="M18 8v32m5-22h8m-8 6h8m-8 6h8"/></svg>;
  if (kind === 'backpack') return <svg {...common}><path d="M13 39V19a7 7 0 0 1 7-7h8a7 7 0 0 1 7 7v20zM19 12V9h10v3M13 27h22M19 33h10"/></svg>;
  return <svg {...common}><path d="M18 7h12M20 7v7h8V7M16 14h16l2 26H14zM18 22h12"/></svg>;
}

export default function App() {
  const {state, dispatch, error, clearError, storageWarning} = usePlayground();
  const [area, setArea] = useState<Area>('dashboard');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);
  const [pendingTransfer, setPendingTransfer] = useState<{fromId: string; toId: string; amount: string} | null>(null);
  const checkoutDialog = useRef<HTMLDialogElement>(null);
  const transferDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const requested = window.location.hash.slice(1) as Area;
    if (areas.some((item) => item.id === requested)) setArea(requested);
  }, []);
  useEffect(() => {
    if (checkoutOpen && !checkoutDialog.current?.open) checkoutDialog.current?.showModal();
    if (!checkoutOpen && checkoutDialog.current?.open) checkoutDialog.current.close();
  }, [checkoutOpen]);
  useEffect(() => {
    if (pendingTransfer && !transferDialog.current?.open) transferDialog.current?.showModal();
    if (!pendingTransfer && transferDialog.current?.open) transferDialog.current.close();
  }, [pendingTransfer]);

  function go(next: Area) {
    clearError();
    setArea(next);
    window.history.replaceState(null, '', `#${next}`);
  }
  function submit(action: Parameters<typeof dispatch>[0]) { return dispatch(action); }
  const activePlan = PLANS.find((plan) => plan.id === state.currentPlanId)!;

  if (!state.session) {
    return <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <a className="back-link" href="../index.html">← Back to Academy</a>
        <p className="eyebrow">MINI QUIZ PRACTICE</p>
        <h1 id="login-title">Practice everyday service journeys.</h1>
        <p className="lede">Use one demonstration account to try shopping, banking, insurance, and telecom workflows.</p>
        <p className="training-note" role="note">Fictional training data, saved in this browser; no real transactions.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <form className="login-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); submit({type: 'login', email: String(form.get('email') ?? ''), password: String(form.get('password') ?? '')}); }}>
          <label htmlFor="demo-email">Demo email<input id="demo-email" name="email" type="email" autoComplete="username" defaultValue={DEMO_USER.email} /></label>
          <label htmlFor="demo-password">Demo password<input id="demo-password" name="password" type="password" autoComplete="current-password" defaultValue={DEMO_USER.password} /></label>
          <button className="button primary" type="submit" data-testid="demo-login">Sign in to practise</button>
        </form>
        <p className="hint">Demo credentials: <code>{DEMO_USER.email}</code> / <code>{DEMO_USER.password}</code></p>
      </section>
    </main>;
  }

  const cartItems = state.cart.map((item) => ({...item, product: PRODUCTS.find((product) => product.id === item.productId)!}));
  return <div className="app-shell">
    <a className="skip-link" href="#practice-main">Skip to practice content</a>
    <header className="site-header">
      <a className="brand" href="#dashboard" onClick={() => go('dashboard')}><span aria-hidden="true">mp</span>Mini Quiz <strong>Practice</strong></a>
      <div className="header-actions"><span className="student-name">Hi, {state.session.name}</span><button className="text-button" type="button" onClick={() => submit({type: 'logout'})}>Sign out</button></div>
    </header>
    <div className="practice-layout">
      <aside className="sidebar" aria-label="Practice areas">
        <p className="eyebrow">PRACTICE AREAS</p>
        <nav>{areas.map((item) => <button key={item.id} type="button" className={area === item.id ? 'nav-item active' : 'nav-item'} aria-current={area === item.id ? 'page' : undefined} onClick={() => go(item.id)}>{item.label}</button>)}</nav>
        <p className="sidebar-note">Your learning records stay on this browser. Use Reset demo data if you want to begin again.</p>
        <button className="text-button" type="button" onClick={() => { if (submit({type: 'reset'})) go('dashboard'); }}>Reset demo data</button>
        <a className="back-link" href="../index.html">← Back to Academy</a>
      </aside>
      <main id="practice-main" className="practice-main" tabIndex={-1}>
        <p className="training-note" role="note">Fictional training data, saved in this browser; no real transactions.</p>
        {storageWarning && <p className="form-error" role="status">{storageWarning}</p>}
        {error && <div className="notice error-notice" role="alert"><span>{error}</span><button type="button" aria-label="Dismiss message" onClick={clearError}>×</button></div>}
        {area === 'dashboard' && <Dashboard state={state} go={go} activePlan={activePlan.name} />}
        {area === 'commerce' && <Commerce search={search} setSearch={setSearch} category={category} setCategory={setCategory} cartItems={cartItems} cartTotalCents={cartTotal(state)} orders={state.orders} checkoutSuccess={checkoutSuccess} onAction={submit} onCheckout={() => { clearError(); setCheckoutOpen(true); }} />}
        {area === 'banking' && <Banking accounts={state.accounts} transfers={state.transfers} onConfirm={(transfer) => { clearError(); setPendingTransfer(transfer); }} />}
        {area === 'insurance' && <Insurance state={state} onAction={submit} />}
        {area === 'telecom' && <Telecom state={state} onAction={submit} activePlan={activePlan} />}
      </main>
    </div>
    <dialog ref={checkoutDialog} aria-labelledby="checkout-title" onCancel={() => { clearError(); setCheckoutOpen(false); }} onClose={() => { clearError(); setCheckoutOpen(false); }}><CheckoutForm total={cartTotal(state)} error={error} onCancel={() => { clearError(); setCheckoutOpen(false); }} onSubmit={(customer) => { if (submit({type: 'checkout', customer})) { setCheckoutSuccess('Your fictional order is confirmed.'); setCheckoutOpen(false); } }} /></dialog>
    <dialog ref={transferDialog} aria-labelledby="transfer-title" onCancel={() => { clearError(); setPendingTransfer(null); }} onClose={() => { clearError(); setPendingTransfer(null); }}>{pendingTransfer && <TransferConfirm transfer={pendingTransfer} accounts={state.accounts} error={error} onCancel={() => { clearError(); setPendingTransfer(null); }} onConfirm={() => { if (submit({type: 'transfer', ...pendingTransfer})) setPendingTransfer(null); }} />}</dialog>
  </div>;
}

function Dashboard({state, go, activePlan}: {state: ReturnType<typeof usePlayground>['state']; go: (area: Area) => void; activePlan: string}) {
  const cards = [
    ['Commerce', state.orders.length ? `${state.orders.length} confirmed order${state.orders.length === 1 ? '' : 's'}` : 'Browse the demo catalog', 'commerce'],
    ['Banking', formatMoney(state.accounts.reduce((sum, account) => sum + account.balanceCents, 0)), 'banking'],
    ['Insurance', `${state.policies.length} active demo polic${state.policies.length === 1 ? 'y' : 'ies'}`, 'insurance'],
    ['Telecom', `${activePlan} plan`, 'telecom']
  ] as const;
  return <section className="page-intro"><p className="eyebrow">WELCOME BACK</p><h1>Choose a service journey.</h1><p className="lede">Each space has working controls and clear results to help you practise common customer tasks.</p><div className="domain-grid">{cards.map(([title, detail, target]) => <article className="domain-card" key={title}><p className="eyebrow">{title}</p><h2>{detail}</h2><button className="button secondary" type="button" onClick={() => go(target)} data-testid={`open-${target}`}>Open {title}</button></article>)}</div></section>;
}

function Commerce({search, setSearch, category, setCategory, cartItems, cartTotalCents, orders, checkoutSuccess, onAction, onCheckout}: {search: string; setSearch: (value: string) => void; category: string; setCategory: (value: string) => void; cartItems: Array<{productId: string; quantity: number; product: typeof PRODUCTS[number]}>; cartTotalCents: number; orders: ReturnType<typeof usePlayground>['state']['orders']; checkoutSuccess: string | null; onAction: (action: Parameters<ReturnType<typeof usePlayground>['dispatch']>[0]) => boolean; onCheckout: () => void}) {
  const products = PRODUCTS.filter((product) => (category === 'All' || product.category === category) && `${product.name} ${product.description}`.toLowerCase().includes(search.toLowerCase()));
  const latestOrder = orders[0];
  return <section><PageTitle eyebrow="COMMERCE" title="A small, fictional shop." text="Find a product, adjust quantities, and complete a demonstration checkout." /><p className="task-note"><strong>Try it:</strong> filter the catalog, add an item, and enter fictional delivery details. <strong>Expected:</strong> a confirmed order clears the cart.</p>{checkoutSuccess && <p className="success-notice" role="status">{checkoutSuccess}</p>}<div className="shop-toolbar"><label htmlFor="catalog-search">Search catalog<input id="catalog-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" /></label><label htmlFor="catalog-category">Category<select id="catalog-category" value={category} onChange={(event) => setCategory(event.target.value)}><option>All</option><option>Electronics</option><option>Lifestyle</option><option>Learning</option></select></label></div><div className="two-column"><div><div className="catalog-grid">{products.length ? products.map((product) => <article className="product-card" key={product.id}><span className="product-icon"><ProductIcon kind={product.icon} /></span><p className="eyebrow">{product.category}</p><h2>{product.name}</h2><p>{product.description}</p><strong>{formatMoney(product.priceCents)}</strong><button type="button" className="button secondary" onClick={() => onAction({type: 'cartAdd', productId: product.id})} data-testid={`add-${product.id}`}>Add to cart</button></article>) : <p className="empty" role="status">No products match that search.</p>}</div>{latestOrder && <article className="result-card order-confirmation" aria-live="polite"><p className="eyebrow">ORDER CONFIRMATION · {latestOrder.id}</p><h2>{latestOrder.status}</h2><p>{latestOrder.items.map((item) => `${item.quantity} × ${item.name}`).join(', ')}</p><strong>{formatMoney(latestOrder.totalCents)}</strong><p>Fictional delivery: {latestOrder.customer.name}, {latestOrder.customer.address}, {latestOrder.customer.city} {latestOrder.customer.postal}</p></article>}</div><aside className="workflow-card cart" aria-labelledby="cart-title"><p className="eyebrow">YOUR CART</p><h2 id="cart-title">{cartItems.length ? `${cartItems.length} item${cartItems.length === 1 ? '' : 's'}` : 'Nothing added yet'}</h2>{cartItems.map(({product, quantity}) => <div className="cart-row" key={product.id}><div><strong>{product.name}</strong><span>{formatMoney(product.priceCents)}</span></div><label>Quantity<input aria-label={`${product.name} quantity`} type="number" min="1" max={product.stock} value={quantity} onChange={(event) => { const value = Number(event.target.value); if (Number.isInteger(value)) onAction({type: 'cartQuantity', productId: product.id, quantity: value}); }} /></label><button className="text-button" type="button" onClick={() => onAction({type: 'cartRemove', productId: product.id})}>Remove</button></div>)}<div className="total-row"><span>Total</span><strong>{formatMoney(cartTotalCents)}</strong></div><button className="button primary" type="button" disabled={!cartItems.length} onClick={onCheckout} data-testid="open-checkout">Checkout</button></aside></div></section>;
}

function CheckoutForm({total, error, onCancel, onSubmit}: {total: number; error: string | null; onCancel: () => void; onSubmit: (customer: {name: string; address: string; city: string; postal: string}) => void}) { return <div className="modal-content"><form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onSubmit({name: String(form.get('name') ?? ''), address: String(form.get('address') ?? ''), city: String(form.get('city') ?? ''), postal: String(form.get('postal') ?? '')}); }}><p className="eyebrow">DEMONSTRATION CHECKOUT</p><h2 id="checkout-title">Confirm a fictional order.</h2>{error && <p className="form-error" role="alert">{error}</p>}<p>Order total: <strong>{formatMoney(total)}</strong></p><label htmlFor="checkout-name">Fictional name<input id="checkout-name" name="name" required /></label><label htmlFor="checkout-address">Fictional street address<input id="checkout-address" name="address" required /></label><div className="form-pair"><label htmlFor="checkout-city">City<input id="checkout-city" name="city" required /></label><label htmlFor="checkout-postal">Postal code<input id="checkout-postal" name="postal" required /></label></div><div className="modal-actions"><button className="button secondary" type="button" onClick={onCancel}>Cancel</button><button className="button primary" type="submit" data-testid="confirm-checkout">Confirm order</button></div></form></div>; }

function Banking({accounts, transfers, onConfirm}: {accounts: Account[]; transfers: Array<{id: string; fromId: string; toId: string; amountCents: number; status: string}>; onConfirm: (transfer: {fromId: string; toId: string; amount: string}) => void}) { return <section><PageTitle eyebrow="BANKING" title="Move a fictional balance." text="Review the ledger and confirm a transfer between your two demo accounts." /><p className="task-note"><strong>Try it:</strong> select two accounts and enter an amount such as 25.00. <strong>Expected:</strong> confirmation updates both balances and adds a completed ledger row.</p><div className="balance-grid">{accounts.map((account) => <article key={account.id} className="balance-card"><p>{account.name}</p><h2>{formatMoney(account.balanceCents)}</h2><span>{account.number}</span></article>)}</div><div className="two-column"><form className="workflow-card" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onConfirm({fromId: String(form.get('from') ?? ''), toId: String(form.get('to') ?? ''), amount: String(form.get('amount') ?? '')}); }}><p className="eyebrow">TRANSFER</p><h2>Set up a demo transfer</h2><label htmlFor="transfer-from">From account<select id="transfer-from" name="from" defaultValue={accounts[0]?.id}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {formatMoney(account.balanceCents)}</option>)}</select></label><label htmlFor="transfer-to">To account<select id="transfer-to" name="to" defaultValue={accounts[1]?.id}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {formatMoney(account.balanceCents)}</option>)}</select></label><label htmlFor="transfer-amount">Amount<input id="transfer-amount" name="amount" inputMode="decimal" placeholder="25.00" required /></label><button className="button primary" type="submit" data-testid="review-transfer">Review transfer</button></form><Ledger accounts={accounts} transfers={transfers} /></div></section>; }

function Ledger({accounts, transfers}: {accounts: Account[]; transfers: Array<{id: string; fromId: string; toId: string; amountCents: number; status: string}>}) { return <section className="workflow-card"><p className="eyebrow">LEDGER</p><h2>Completed transfers</h2>{transfers.length ? <ul className="record-list">{transfers.map((transfer) => <li key={transfer.id}><strong>{transfer.id}</strong><span><AccountName accountId={transfer.fromId} accounts={accounts} /> → <AccountName accountId={transfer.toId} accounts={accounts} /></span><em>{formatMoney(transfer.amountCents)} · {transfer.status}</em></li>)}</ul> : <p className="empty">No demo transfers yet.</p>}</section>; }

function TransferConfirm({transfer, accounts, error, onCancel, onConfirm}: {transfer: {fromId: string; toId: string; amount: string}; accounts: Account[]; error: string | null; onCancel: () => void; onConfirm: () => void}) { return <div className="modal-content"><p className="eyebrow">TRANSFER CONFIRMATION</p><h2 id="transfer-title">Review this demo transfer.</h2>{error && <p className="form-error" role="alert">{error}</p>}<p><strong>{transfer.amount}</strong> from <AccountName accountId={transfer.fromId} accounts={accounts} /> to <AccountName accountId={transfer.toId} accounts={accounts} />.</p><p className="hint">This changes only the fictional balances stored in this browser.</p><div className="modal-actions"><button className="button secondary" type="button" onClick={onCancel}>Go back</button><button className="button primary" type="button" onClick={onConfirm} data-testid="confirm-transfer">Confirm transfer</button></div></div>; }

function Insurance({state, onAction}: {state: ReturnType<typeof usePlayground>['state']; onAction: (action: Parameters<ReturnType<typeof usePlayground>['dispatch']>[0]) => boolean}) { const latestQuote = state.quotes[0]; return <section><PageTitle eyebrow="INSURANCE" title="Practise a fictional policy journey." text="Create a simple classroom quote, save it as a demo policy, and submit a claim. Prices are illustrative classroom arithmetic, not real underwriting." /><p className="task-note"><strong>Try it:</strong> choose a type, age, and coverage, then save the quote. <strong>Expected:</strong> the quote becomes an active demo policy for a claim.</p><div className="two-column"><div><form className="workflow-card" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onAction({type: 'quote', insuranceType: String(form.get('type')) as 'auto' | 'home', age: Number(form.get('age')), coverage: String(form.get('coverage')) as 'basic' | 'plus'}); }}><p className="eyebrow">QUOTE</p><h2>Price a demo policy</h2><label htmlFor="quote-type">Insurance type<select id="quote-type" name="type"><option value="auto">Auto</option><option value="home">Home</option></select></label><label htmlFor="quote-age">Fictional age<input id="quote-age" name="age" type="number" min="18" max="100" defaultValue="30" required /></label><label htmlFor="quote-coverage">Coverage<select id="quote-coverage" name="coverage"><option value="basic">Basic</option><option value="plus">Plus</option></select></label><button className="button primary" type="submit" data-testid="create-quote">Generate quote</button></form>{latestQuote && <article className="result-card" aria-live="polite"><p className="eyebrow">LATEST QUOTE · {latestQuote.id}</p><h2>{formatMoney(latestQuote.premiumCents)} / month</h2><p>{latestQuote.type} · {latestQuote.coverage} coverage · age {latestQuote.age}</p><button className="button secondary" type="button" disabled={latestQuote.saved} onClick={() => onAction({type: 'quoteSave', quoteId: latestQuote.id})}>{latestQuote.saved ? 'Policy saved' : 'Save demo policy'}</button></article>}</div><div><form className="workflow-card" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); if (onAction({type: 'claim', policyId: String(form.get('policy')), incident: String(form.get('incident')), description: String(form.get('description'))})) event.currentTarget.reset(); }}><p className="eyebrow">CLAIM</p><h2>Submit a fictional claim</h2><label htmlFor="claim-policy">Active policy<select id="claim-policy" name="policy">{state.policies.map((policy) => <option key={policy.id} value={policy.id}>{policy.id} · {policy.type} · {policy.coverage}</option>)}</select></label><label htmlFor="claim-incident">Incident date<input id="claim-incident" name="incident" type="date" required /></label><label htmlFor="claim-description">Fictional incident details<textarea id="claim-description" name="description" rows={4} required /></label><button className="button primary" type="submit" data-testid="submit-claim">Submit claim</button></form><section className="workflow-card compact"><p className="eyebrow">CLAIM STATUS</p>{state.claims.length ? <ul className="record-list">{state.claims.map((claim) => <li key={claim.id}><strong>{claim.id}</strong><span>{claim.incident} · {claim.description}</span><em>{claim.status}</em></li>)}</ul> : <p className="empty">No claims submitted.</p>}</section></div></div></section>; }

function Telecom({state, onAction, activePlan}: {state: ReturnType<typeof usePlayground>['state']; onAction: (action: Parameters<ReturnType<typeof usePlayground>['dispatch']>[0]) => boolean; activePlan: typeof PLANS[number]}) { return <section><PageTitle eyebrow="TELECOM" title="Manage a fictional mobile service." text="Compare plans, pay a demo bill, and create a support ticket." /><p className="task-note"><strong>Try it:</strong> choose a plan, pay the displayed demo bill, and describe a support need. <strong>Expected:</strong> the plan updates for the next billing period, the bill reads Paid, and the ticket is Open.</p><section className="plan-grid" aria-label="Available demo plans">{PLANS.map((plan) => <article key={plan.id} className={plan.id === activePlan.id ? 'plan-card selected' : 'plan-card'}><p className="eyebrow">{plan.id === activePlan.id ? 'CURRENT PLAN' : 'DEMO PLAN'}</p><h2>{plan.name}</h2><strong>{formatMoney(plan.priceCents)} / month</strong><p>{plan.data}</p><ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul><button className="button secondary" type="button" disabled={plan.id === activePlan.id} onClick={() => onAction({type: 'selectPlan', planId: plan.id})}>{plan.id === activePlan.id ? 'Current plan' : 'Choose this plan'}</button></article>)}</section><div className="two-column"><section className="workflow-card"><p className="eyebrow">BILLING</p><h2>Demo bills</h2>{state.bills.map((bill) => <div className="bill-row" key={bill.id}><span><strong>{bill.description}</strong><em>{bill.id} · {bill.status}</em></span><span>{formatMoney(bill.amountCents)}</span><button className="button secondary" type="button" disabled={bill.status === 'Paid'} onClick={() => onAction({type: 'payBill', billId: bill.id})}>{bill.status === 'Paid' ? 'Paid' : 'Pay demo bill'}</button></div>)}</section><div><form className="workflow-card" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); if (onAction({type: 'ticket', subject: String(form.get('subject')), description: String(form.get('description'))})) event.currentTarget.reset(); }}><p className="eyebrow">SUPPORT</p><h2>Open a demo ticket</h2><label htmlFor="ticket-subject">Subject<input id="ticket-subject" name="subject" required /></label><label htmlFor="ticket-description">Fictional support details<textarea id="ticket-description" name="description" rows={3} required /></label><button className="button primary" type="submit" data-testid="open-ticket">Create ticket</button></form>{state.tickets.length > 0 && <section className="workflow-card compact" aria-live="polite"><p className="eyebrow">OPEN TICKETS</p><ul className="record-list">{state.tickets.map((ticket) => <li key={ticket.id}><strong>{ticket.id} · {ticket.subject}</strong><span>{ticket.description}</span><em>{ticket.status}</em></li>)}</ul></section>}</div></div></section>; }

function PageTitle({eyebrow, title, text}: {eyebrow: string; title: string; text: string}) { return <header className="page-intro"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="lede">{text}</p></header>; }
