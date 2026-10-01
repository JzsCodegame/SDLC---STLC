import {test,expect} from '@playwright/test';
test.beforeEach(async({request,page})=>{expect((await request.post('/api/test/reset')).ok()).toBeTruthy();await page.goto('/');await expect(page.getByTestId('ticket-count')).toHaveText('3')});
test('required fields prevent an empty ticket',async({page,request})=>{
 await page.getByRole('button',{name:'Create ticket',exact:true}).click();
 await expect(page.getByText('Title must contain 3–120 characters.')).toBeVisible();
 await expect(page.getByText('Your name must contain 3–120 characters.')).toBeVisible();
 expect((await (await request.get('/api/tickets')).json()).tickets).toHaveLength(3);
});
test('create a ticket, persist it after reload, then find it by title',async({page})=>{
 await page.getByLabel('Your name').fill('Test Student');await page.getByLabel('Title',{exact:false}).fill('Cannot open the quiz');await page.getByLabel('Description').fill('The quiz button returns to the course page.');
 await page.getByRole('button',{name:'Create ticket',exact:true}).click();
 const ticket=page.locator('.ticket').filter({hasText:'Cannot open the quiz'});await expect(ticket).toContainText('Open');
 await page.reload();await page.getByLabel('Search tickets').fill('Cannot open the quiz');await expect(page.locator('.ticket')).toHaveCount(1);await expect(ticket).toBeVisible();
});
test('update a status and verify the filter',async({page})=>{
 await page.getByTestId('ticket-T-1001').click();await page.getByLabel('Ticket status').selectOption('in_progress');await page.getByRole('button',{name:'Save status'}).click();
 await page.getByLabel('Filter by status').selectOption('open');await expect(page.locator('.ticket-list')).toHaveAttribute('aria-busy','false');await expect(page.getByTestId('ticket-T-1001')).toHaveCount(0);
 await page.getByLabel('Filter by status').selectOption('in_progress');await expect(page.getByTestId('ticket-T-1001')).toContainText('In progress');
});
test('a search with no match explains how to recover',async({page})=>{
 await page.getByLabel('Search tickets').fill('no-matching-ticket-123');await expect(page.getByRole('heading',{name:'No matching tickets'})).toBeVisible();
 await page.getByLabel('Search tickets').clear();await expect(page.locator('.ticket')).toHaveCount(3);
});
test('cancel keeps edits unchanged and reset requires confirmation',async({page,request})=>{
 await page.getByTestId('ticket-T-1001').click();await page.getByLabel('Ticket status').selectOption('resolved');await page.getByRole('button',{name:'Cancel',exact:true}).click();
 expect((await (await request.get('/api/tickets/T-1001')).json()).ticket.status).toBe('open');
 await request.post('/api/tickets',{data:{title:'Temporary ticket',student:'Test Student',description:'Created to verify the reset confirmation.'}});await page.reload();
 await page.getByRole('button',{name:'Reset practice records'}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();expect((await (await request.get('/api/tickets')).json()).tickets).toHaveLength(4);
 await page.getByRole('button',{name:'Reset practice records'}).click();await page.getByRole('button',{name:'Confirm reset'}).click();await expect(page.getByTestId('ticket-count')).toHaveText('3');
});
test('the API returns the created record and rejects invalid status',async({request})=>{
 const response=await request.post('/api/tickets',{data:{title:'API practice',student:'Test Student',description:'Create a ticket without using the form.'}});expect(response.status()).toBe(201);const {ticket}=await response.json();expect(ticket.status).toBe('open');
 expect((await request.patch('/api/tickets/'+ticket.id,{data:{status:'unknown'}})).status()).toBe(400);
 expect((await (await request.get('/api/tickets/'+ticket.id)).json()).ticket.title).toBe('API practice');
});
