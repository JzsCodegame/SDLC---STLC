// Public teaching examples; one source for the lesson and runnable reference.
export const testFile='tests/playwright/class-two.spec.ts';
export const setup=`import { test, expect } from '@playwright/test';

test.beforeEach(async ({ request, page }) => {
  // Reset only the runner's isolated test records, never the manual Help Desk.
  expect((await request.post('/api/test/reset')).ok()).toBeTruthy();
  await page.goto('/');
  await expect(page.getByTestId('ticket-count')).toHaveText('3');
});
`;
export const examples=[
 {id:'create',title:'Create and keep a ticket',requirement:'A valid new ticket starts Open and remains after a reload.',code:`test('Class Two: create starts Open and survives reload', async ({ page }) => {
  const title = 'Class Two cannot open the lesson';
  await page.getByLabel('Your name').fill('Practice Student');
  await page.getByLabel('Title', { exact: false }).fill(title);
  await page.getByLabel('Description').fill('The lesson button does not open the lesson.');
  await page.getByRole('button', { name: 'Create ticket', exact: true }).click();
  const ticket = page.locator('.ticket').filter({ hasText: title });
  await expect(ticket).toHaveCount(1);
  await expect(ticket).toContainText('Open');
  await page.reload();
  await expect(ticket).toBeVisible();
  await expect(ticket).toContainText('Open');
});`,challenge:'Change the fictional title and description. Keep the Open and reload assertions.'},
 {id:'status',title:'Change a status and filter',requirement:'A resolved ticket appears under Resolved and disappears under Open.',code:`test('Class Two: resolve and filter a ticket', async ({ page }) => {
  const ticket = page.getByTestId('ticket-T-1001');
  await ticket.click();
  await page.getByLabel('Ticket status').selectOption('resolved');
  await page.getByRole('button', { name: 'Save status', exact: true }).click();
  await page.getByLabel('Filter by status').selectOption('resolved');
  await expect(ticket).toContainText('Resolved');
  await page.getByLabel('Filter by status').selectOption('open');
  await expect(page.locator('.ticket-list')).toHaveAttribute('aria-busy', 'false');
  await expect(ticket).toHaveCount(0);
});`,challenge:'Repeat for In progress using the value in_progress. Explain why visible text differs from the stored value.'},
 {id:'validation',title:'Reject an empty form',requirement:'Missing required details show validation errors and create no new ticket.',code:`test('Class Two: empty form adds no ticket', async ({ page }) => {
  await page.getByRole('button', { name: 'Create ticket', exact: true }).click();
  await expect(page.getByText('Title must contain 3–120 characters.')).toBeVisible();
  await expect(page.getByText('Your name must contain 3–120 characters.')).toBeVisible();
  await expect(page.getByTestId('ticket-count')).toHaveText('3');
});`,challenge:'Add a boundary case with a two-character title. Keep the expected error and unchanged ticket count.'},
 {id:'search',title:'Recover from no search results',requirement:'An unmatched search explains the empty state; clearing it restores the tickets.',code:`test('Class Two: empty search result recovers', async ({ page }) => {
  await page.getByLabel('Search tickets').fill('class-two-no-match-987');
  await expect(page.getByRole('heading', { name: 'No matching tickets' })).toBeVisible();
  await page.getByLabel('Search tickets').clear();
  await expect(page.getByTestId('ticket-count')).toHaveText('3');
  await expect(page.locator('.ticket')).toHaveCount(3);
});`,challenge:'Search for an existing ticket title, assert one match, then clear and verify recovery.'}
];
export const reference=setup+'\n'+examples.map(x=>x.code).join('\n\n')+'\n';
export const starter=setup+`
test('Class Two: my first UI requirement', async ({ page }) => {
  // Arrange: beforeEach starts with three isolated practice tickets.
  // TODO: locate and fill Your name, Title and Description.
  // TODO: click Create ticket using its role and accessible name.
  // TODO: assert that your exact ticket exists and starts Open.
  // TODO: reload and prove the ticket remains.
  throw new Error('Complete the TODOs and remove this deliberate starter failure.');
});
`;
