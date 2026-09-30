import {examples,projectCases} from './lesson-context.js';
const esc=s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
export function examplePanel(mod,card){
  return `<section class="concept-examples" aria-label="Examples for ${esc(card.title)}"><p class="eyebrow">MAKE THE CONNECTION</p><div class="example-switch" role="group" aria-label="Choose an example"><button data-example="analogy" aria-pressed="true">Everyday analogy</button><button data-example="workplace" aria-pressed="false">Workplace case</button><button data-example="website" aria-pressed="false">Our website</button>${projectCases[`${mod.id}/${card.id}`]?'<button data-example="project" aria-pressed="false">Actual project case</button>':''}</div><div class="example-content" aria-live="polite"></div></section>`;
}
export function bindExamples(container,mod,card){
  const panel=container.querySelector('.concept-examples');
  if(!panel)return;
  const item=examples[`${mod.id}/${card.id}`];
  function show(mode){
    panel.querySelectorAll('[data-example]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.example===mode)));
    const body=panel.querySelector('.example-content');
    if(mode==='project'){
      const actual=projectCases[`${mod.id}/${card.id}`];
      body.innerHTML=`<p class="example-label">Observed during this academy's local development · September 28, 2026</p><dl><dt>What happened</dt><dd>${esc(actual.situation)}</dd><dt>What the evidence showed</dt><dd>${esc(actual.check)}</dd><dt>What changed</dt><dd>${esc(actual.resolution)}</dd><dt>Takeaway</dt><dd>${esc(actual.lesson)}</dd></dl><p class="small">A discussion of completed development work. This is not a live student exercise.</p>`;
    }
    else if(mode==='website')body.innerHTML=`<p class="example-label">Illustrative academy scenario</p><p>${esc(card.example)}</p><p class="small">A teaching example. A hands-on activity requires the actual website behavior, test data, and runnable checks.</p>`;
    else if(mode==='workplace')body.innerHTML=`<p class="example-label">Illustrative workplace scenario · not a reported incident</p><dl><dt>Situation</dt><dd>${esc(item.situation)}</dd><dt>What to check</dt><dd>${esc(item.check)}</dd><dt>Why it matters</dt><dd>${esc(item.impact)}</dd></dl>`;
    else body.innerHTML=`<p>${esc(item.analogy)}</p><p><strong>Connect it to software:</strong> ${esc(item.connection)}</p><details class="analogy-limit"><summary>Where the analogy stops</summary><p>${esc(item.limit)}</p></details>`;
  }
  panel.querySelectorAll('[data-example]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.example)));
  show('analogy');
}
