import {examples,projectCases} from './lesson-context.js';
import {workedExamples} from './worked-examples.js';
const esc=s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
export function examplePanel(mod,card){
  return `<section class="concept-examples" aria-label="Examples for ${esc(card.title)}"><p class="eyebrow">WORK THROUGH AN EXAMPLE</p><p class="example-instruction">Read the situation, follow the steps, then explain your answer before revealing the reasoning.</p><div class="example-switch" role="group" aria-label="Choose an example"><button data-example="worked" aria-pressed="true">Step-by-step example</button><button data-example="analogy" aria-pressed="false">Everyday analogy</button>${projectCases[`${mod.id}/${card.id}`]?'<button data-example="project" aria-pressed="false">Recorded app example</button>':''}</div><div class="example-content" aria-live="polite"></div></section>`;
}
export function bindExamples(container,mod,card){
  const panel=container.querySelector('.concept-examples');
  if(!panel)return;
  const key=`${mod.id}/${card.id}`,item=examples[key],worked=workedExamples[key];
  if(!worked)throw new Error(`Missing worked example: ${key}`);
  function show(mode){
    panel.querySelectorAll('[data-example]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.example===mode)));
    const body=panel.querySelector('.example-content');
    if(mode==='project'){
      const actual=projectCases[`${mod.id}/${card.id}`];
      body.innerHTML=`<p class="example-label">Observed during this academy's local development · September 28, 2026</p><dl><dt>What happened</dt><dd>${esc(actual.situation)}</dd><dt>What the evidence showed</dt><dd>${esc(actual.check)}</dd><dt>What changed</dt><dd>${esc(actual.resolution)}</dd><dt>Takeaway</dt><dd>${esc(actual.lesson)}</dd></dl><p class="small">A discussion of completed development work. This is not a live student exercise.</p>`;
    }
    else if(mode==='worked')body.innerHTML=`<p class="example-label">Class discussion · illustrative software scenario</p><h4 class="example-title">${esc(worked.title)}</h4><p class="example-situation">${esc(worked.context)}</p><ol class="example-steps">${worked.steps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol><div class="example-practice"><p class="example-question"><strong>Your turn:</strong> ${esc(worked.question)}</p><details class="example-answer"><summary>Reveal the reasoning</summary><p>${esc(worked.answer)}</p></details></div><p class="example-takeaway"><strong>Key point:</strong> ${esc(worked.takeaway)}</p>`;
    else body.innerHTML=`<dl><dt>Familiar situation</dt><dd>${esc(item.analogy)}</dd><dt>Software meaning</dt><dd>${esc(item.connection)}</dd></dl><details class="analogy-limit"><summary>Where the comparison stops</summary><p>${esc(item.limit)}</p></details>`;
  }
  panel.querySelectorAll('[data-example]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.example)));
  show('worked');
}
