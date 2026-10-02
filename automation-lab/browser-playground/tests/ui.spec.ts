import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{await page.goto('./');await page.getByTestId('demo-login').click();await expect(page.getByRole('heading',{name:'Choose a service journey.'})).toBeVisible();});

test('checkout produces an order confirmation and survives browser reload',async({page})=>{
 await expect(page.getByRole('link',{name:'Back to Academy'})).toHaveAttribute('href','../index.html');
 await page.getByRole('button',{name:'Commerce',exact:true}).click();
 await page.getByLabel('Search catalog').fill('Notebook');await expect(page.locator('.product-card')).toHaveCount(1);
 await page.getByTestId('add-p-notebook').click();await page.getByLabel('Ideas Notebook quantity').fill('2');
 await page.getByTestId('open-checkout').click();const dialog=page.getByRole('dialog',{name:'Confirm a fictional order.'});
 await dialog.getByLabel('Fictional name').fill('Taylor Example');await dialog.getByLabel('Fictional street address').fill('x');await dialog.getByLabel('City',{exact:true}).fill('Sample City');await dialog.getByLabel('Postal code').fill('DEMO 10');
 await page.getByTestId('confirm-checkout').click();await expect(dialog.getByRole('alert')).toContainText('street address');await expect(dialog).toBeVisible();
 await dialog.getByLabel('Fictional street address').fill('100 Demo Lane');await page.getByTestId('confirm-checkout').click();await expect(dialog).not.toBeVisible();
 await expect(page.getByText('ORD-0001',{exact:false})).toBeVisible();await expect(page.getByText('$36.00',{exact:true}).first()).toBeVisible();await expect(page.getByTestId('open-checkout')).toBeDisabled();
 await page.reload();await expect(page.getByText('ORD-0001',{exact:false})).toBeVisible();
});

test('invalid transfer stays visible in its modal and cannot change balances',async({page})=>{
 await page.getByRole('button',{name:'Banking',exact:true}).click();
 await page.getByLabel('Amount',{exact:true}).fill('2000.00');await page.getByTestId('review-transfer').click();await page.getByTestId('confirm-transfer').click();
 const dialog=page.getByRole('dialog',{name:'Review this demo transfer.'});await expect(dialog.getByRole('alert')).toContainText('Insufficient demo funds');
 await expect(page.locator('.balance-card').first()).toContainText('$1,250.00');await expect(page.locator('.balance-card').nth(1)).toContainText('$3,800.00');
 await dialog.getByRole('button',{name:'Go back'}).click();await page.getByLabel('Amount',{exact:true}).fill('25.10');await page.getByTestId('review-transfer').click();await expect(dialog.getByRole('alert')).toHaveCount(0);await page.getByTestId('confirm-transfer').click();
 await expect(dialog).not.toBeVisible();await expect(page.getByText('TRF-0001',{exact:true})).toBeVisible();await expect(page.locator('.balance-card').first()).toContainText('$1,224.90');await expect(page.locator('.balance-card').nth(1)).toContainText('$3,825.10');
});

test('insurance quote, saved policy and submitted claim have observable results',async({page})=>{
 await page.getByRole('button',{name:'Insurance',exact:true}).click();await page.getByLabel('Fictional age').fill('22');await page.getByRole('combobox',{name:/^Coverage/}).selectOption('plus');await page.getByTestId('create-quote').click();
 await expect(page.getByRole('heading',{name:'$65.00 / month'})).toBeVisible();await page.getByRole('button',{name:'Save demo policy'}).click();await expect(page.getByRole('button',{name:'Policy saved'})).toBeDisabled();
 await page.getByLabel('Active policy').selectOption('POL-0002');await page.getByLabel('Incident date').fill('2026-01-15');await page.getByLabel('Fictional incident details').fill('Fictional windscreen damage for classroom practice.');await page.getByTestId('submit-claim').click();
 await expect(page.getByText('CLM-0001',{exact:true})).toBeVisible();await expect(page.getByText('Submitted',{exact:true})).toBeVisible();
});

test('telecom service changes and logout retain fictional records',async({page})=>{
 await page.getByRole('button',{name:'Telecom',exact:true}).click();
 const unlimited=page.locator('.plan-card').filter({has:page.getByRole('heading',{name:'Unlimited',exact:true})});await unlimited.getByRole('button',{name:'Choose this plan'}).click();
 await expect(unlimited.getByRole('button',{name:'Current plan'})).toBeDisabled();
 await page.getByRole('button',{name:'Pay demo bill'}).click();await expect(page.getByRole('button',{name:'Paid',exact:true})).toBeDisabled();
 await page.getByLabel('Subject',{exact:true}).fill('Demo connection issue');await page.getByLabel('Fictional support details').fill('Fictional network issue recorded during class.');await page.getByTestId('open-ticket').click();await expect(page.getByText('SUP-0001',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Sign out'}).click();await expect(page.getByTestId('demo-login')).toBeVisible();await page.getByTestId('demo-login').click();await page.getByRole('button',{name:'Telecom',exact:true}).click();await expect(page.getByText('SUP-0001',{exact:false})).toBeVisible();
});

test('mobile layout contains every domain at 390 pixels and keeps the Academy link accessible',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 for(const area of ['Dashboard','Commerce','Banking','Insurance','Telecom']) {
  await page.getByRole('button',{name:area,exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 }
 const backlink=page.getByRole('link',{name:'Back to Academy'});
 await expect(backlink).toHaveAttribute('href','../index.html');await backlink.scrollIntoViewIfNeeded();await expect(backlink).toBeInViewport();
});
