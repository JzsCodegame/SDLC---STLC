// Publish a class once here; drafts never become the homepage's latest lesson.
export const classes = Object.freeze([
  {number:1,title:'Foundations: SDLC to automation',href:'learn.html?class=1#sdlc/lifecycle',published:true},
  {number:2,title:'UI automation',href:'class-two.html',published:true},
  {number:3,title:'Playwright & Cypress component testing',href:'class-three.html',published:true},
]);
export function latestPublishedClass(catalog=classes){
  return catalog.filter(c=>c.published===true&&Number.isInteger(c.number)&&c.number>0).sort((a,b)=>b.number-a.number)[0]||null;
}
export function renderLatestClass(root=document,catalog=classes){
  const item=latestPublishedClass(catalog),link=root.querySelector('[data-latest-class]');
  if(!link||!item)return;
  link.href=item.href;
  link.textContent=`Latest · Class ${item.number}: ${item.title} →`;
}
