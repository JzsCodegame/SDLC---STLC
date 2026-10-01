describe('Academy Help Desk: the same regression checks',()=>{
 beforeEach(()=>{cy.request('POST','/api/test/reset');cy.visit('/');cy.get('[data-testid="ticket-count"]').should('have.text','3')});
 it('required fields prevent an empty ticket',()=>{cy.contains('button','Create ticket').click();cy.contains('Title must contain 3–120 characters.').should('be.visible');cy.contains('Your name must contain 3–120 characters.').should('be.visible');cy.request('/api/tickets').its('body.tickets').should('have.length',3)});
 it('creates a ticket, persists it after reload, and finds it by title',()=>{
  cy.get('#student').type('Test Student');cy.get('#title').type('Cannot open the quiz');cy.get('#description').type('The quiz button returns to the course page.');cy.contains('button','Create ticket').click();cy.contains('.ticket','Cannot open the quiz').should('contain.text','Open');
  cy.reload();cy.get('#search').type('Cannot open the quiz');cy.get('.ticket').should('have.length',1);cy.contains('.ticket','Cannot open the quiz').should('be.visible');
 });
 it('updates a status and verifies the filter',()=>{cy.get('[data-testid="ticket-T-1001"]').click();cy.get('#edit-status').select('in_progress');cy.contains('button','Save status').click();cy.get('#status-filter').select('open');cy.get('.ticket-list').should('have.attr','aria-busy','false');cy.get('[data-testid="ticket-T-1001"]').should('not.exist');cy.get('#status-filter').select('in_progress');cy.get('[data-testid="ticket-T-1001"]').should('contain.text','In progress')});
 it('explains how to recover from an empty search',()=>{cy.get('#search').type('no-matching-ticket-123');cy.contains('No matching tickets').should('be.visible');cy.get('#search').clear();cy.get('.ticket').should('have.length',3)});
 it('cancel preserves a ticket and reset requires confirmation',()=>{
  cy.get('[data-testid="ticket-T-1001"]').click();cy.get('#edit-status').select('resolved');cy.get('dialog[open]').contains('button','Cancel').click();cy.request('/api/tickets/T-1001').its('body.ticket.status').should('eq','open');
  cy.request('POST','/api/tickets',{title:'Temporary ticket',student:'Test Student',description:'Created to verify the reset confirmation.'});cy.reload();cy.contains('button','Reset practice records').click();cy.get('dialog[open]').contains('button','Cancel').click();cy.request('/api/tickets').its('body.tickets').should('have.length',4);
  cy.contains('button','Reset practice records').click();cy.contains('button','Confirm reset').click();cy.get('[data-testid="ticket-count"]').should('have.text','3');
 });
 it('returns an API record and rejects invalid status',()=>{cy.request('POST','/api/tickets',{title:'API practice',student:'Test Student',description:'Create a ticket without using the form.'}).then(response=>{expect(response.status).to.eq(201);expect(response.body.ticket.status).to.eq('open');const id=response.body.ticket.id;cy.request({method:'PATCH',url:'/api/tickets/'+id,body:{status:'unknown'},failOnStatusCode:false}).its('status').should('eq',400);cy.request('/api/tickets/'+id).its('body.ticket.title').should('eq','API practice')})});
});
