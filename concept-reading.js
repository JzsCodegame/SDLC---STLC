import {materials} from './concept-materials.js';
import {examples} from './lesson-context.js';
import {esc} from './concept-diagrams.js';
export function readingSections(mod,card){const m=materials[`${mod.id}/${card.id}`],e=examples[`${mod.id}/${card.id}`];return [
 ['Meaning',[card.idea]],
 ['Technical elements',m.items.map(item=>`${item[0]}: ${item.slice(1).join('. ')}`)],
 ['How to reason about it',m.notes],
 ['Illustrative workplace example',[`Situation: ${e.situation}`,`What to check: ${e.check}`,`Why it matters: ${e.impact}`]],
 ['Analogy and its limit',[`Analogy: ${e.analogy}`,`Connection to the concept: ${e.connection}`,`Limit: ${e.limit}`]],
 ['Website connection',[card.example,'This example explains the concept. It does not run an automation test or provide a live API lab.']],
 ['Related concepts',m.links.map(([key,relation])=>`${relation[0].toUpperCase()+relation.slice(1)}: ${materials[key].title}.`)],
 ['Check your understanding',[`Question: ${card.prompt}`,`Answer: ${card.answer}`]]
 ];}
export function wikiText(mod,card){return `${card.title}\n${mod.title} | Mini Quiz Tech & AI Academy\n\n`+readingSections(mod,card).map(([heading,items],i)=>`${i+1}. ${heading}\n${items.map((line,j)=>`   ${String.fromCharCode(97+j)}. ${line}`).join('\n')}`).join('\n\n');}
export function readingPanel(mod,card){return `<div class="wiki-tools"><button id="copy-wiki">Copy wiki text</button><button id="select-wiki">Select plain text</button><span id="copy-status" role="status" aria-live="polite"></span></div><p class="small">Read one section at a time. The diagrams use these same technical elements.</p><article class="study-wiki" aria-label="Technical reading for ${esc(card.title)}">${readingSections(mod,card).map(([title,items],i)=>`<section><h3>${i+1}. ${esc(title)}</h3><ol type="a">${items.map(line=>{const colon=line.indexOf(':');return `<li>${colon>0&&colon<45?`<strong>${esc(line.slice(0,colon+1))}</strong>${esc(line.slice(colon+1))}`:esc(line)}</li>`;}).join('')}</ol></section>`).join('')}</article><div class="wiki-plain" hidden><label for="wiki-plain">Plain text · copy with Ctrl+C or your device’s copy command</label><textarea id="wiki-plain" readonly spellcheck="false">${esc(wikiText(mod,card))}</textarea></div>`;}
export function bindReading(root,mod,card){const button=root.querySelector('#copy-wiki');if(!button)return;const status=root.querySelector('#copy-status');const select=()=>{root.querySelector('.wiki-plain').hidden=false;const area=root.querySelector('#wiki-plain');area.focus();area.select();area.setSelectionRange(0,area.value.length);};root.querySelector('#select-wiki').onclick=select;button.onclick=async()=>{try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(wikiText(mod,card));status.textContent='Wiki text copied.';}catch{select();status.textContent='Automatic copying is unavailable. The plain text is selected for manual copying.';}};}
export function relationshipLinks(mod,card){return `<ul class="concept-links">${materials[`${mod.id}/${card.id}`].links.map(([key,relation])=>`<li><span>${esc(relation)}</span><a href="learn.html#${esc(key)}">${esc(materials[key].title)} →</a></li>`).join('')}</ul>`;}
