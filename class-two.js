import {sections,flashcards,quiz} from './class-two-content.js';
import {examples,setup,starter,reference} from './class-two-examples.js';
import {modules as conceptLibrary} from './learning-content.js';
import {openVisualLesson} from './visual-lessons.js';
const $=id=>document.getElementById(id);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sectionIndex=0,cardIndex=0,flashIndex=0;
const progressKey='mini-quiz-class-two-checklist-v1';
let progress={};try{const value=JSON.parse(localStorage.getItem(progressKey)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))progress=value;}catch{}
function renderLesson(){
 const section=sections[sectionIndex],card=section.cards[cardIndex];
 $('section-nav').innerHTML=sections.map((s,i)=>`<button type="button" data-section="${i}" ${i===sectionIndex?'aria-current="step"':''}>${i+1}. ${escape(s.title)} · ${s.minutes} min</button>`).join('');
 $('lesson-card').innerHTML=`<div><p class="eyebrow">${sectionIndex+1} / ${escape(section.title)}</p><h3>${escape(card.title)}</h3><p>${escape(card.text)}</p></div><div class="lesson-case"><p class="eyebrow">MAKE IT CONCRETE</p><pre><code>${escape(card.example)}</code></pre><details><summary>${escape(card.question)}</summary><p>${escape(card.answer)}</p></details></div>`;
 const relatedIds=['requirements','tools','ui','assertions','automation','regression','ui','regression'];
 const mod=conceptLibrary.find(x=>x.id===relatedIds[sectionIndex]);
 const materialButton=document.createElement('button');materialButton.type='button';materialButton.className='visual-open';materialButton.textContent='Open related study material →';
 materialButton.onclick=()=>openVisualLesson(mod,mod.cards[0],materialButton);
 $('lesson-card').append(materialButton);
 $('card-position').textContent=`Part ${sectionIndex+1} of ${sections.length} · Card ${cardIndex+1} of ${section.cards.length}`;
 $('previous-card').disabled=sectionIndex===0&&cardIndex===0;
 $('next-card').disabled=sectionIndex===sections.length-1&&cardIndex===section.cards.length-1;
}
$('section-nav').addEventListener('click',e=>{const b=e.target.closest('[data-section]');if(!b)return;sectionIndex=Number(b.dataset.section);cardIndex=0;renderLesson();});
$('previous-card').addEventListener('click',()=>{if(cardIndex>0)cardIndex--;else if(sectionIndex>0){sectionIndex--;cardIndex=sections[sectionIndex].cards.length-1;}renderLesson();});
$('next-card').addEventListener('click',()=>{if(cardIndex<sections[sectionIndex].cards.length-1)cardIndex++;else if(sectionIndex<sections.length-1){sectionIndex++;cardIndex=0;}renderLesson();});
const options=new Map([['starter',{code:starter,purpose:'Complete the TODOs. The deliberate starter failure prevents an unfinished test from looking successful.'}],['reference',{code:reference,purpose:'Four complete worked UI tests. Run them, then write and explain your own extension.'}],...examples.map(x=>[x.id,{code:setup+'\n'+x.code+'\n',purpose:x.requirement}])]);
for(const x of examples){const option=document.createElement('option');option.value=x.id;option.textContent=x.title;$('example-choice').append(option);}
const drafts=new Map();let selected='starter';
function chooseExample(value){drafts.set(selected,$('class-two-editor').value);selected=value;$('example-choice').value=value;$('class-two-editor').value=drafts.get(value)??options.get(value).code;$('example-purpose').textContent=options.get(value).purpose;$('copy-status').textContent='';}
$('class-two-editor').value=starter;$('example-purpose').textContent=options.get('starter').purpose;
$('example-choice').addEventListener('change',()=>chooseExample($('example-choice').value));
$('reset-code').addEventListener('click',()=>{drafts.delete(selected);$('class-two-editor').value=options.get(selected).code;$('copy-status').textContent='Selected example restored. Your workspace files were not changed.';});
$('copy-code').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('class-two-editor').value);$('copy-status').textContent='Code copied. Paste it into your student spec, save, then run.';}catch{$('class-two-editor').focus();$('class-two-editor').select();$('copy-status').textContent='Select and copy the code with Ctrl+C or your browser’s copy command.';}});
$('download-code').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([$('class-two-editor').value],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='class-two.spec.ts';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('copy-status').textContent='Spec downloaded. Place it in your student practice-app/tests/playwright folder.';});
$('exercise-list').innerHTML=examples.map((x,i)=>`<article><p class="eyebrow">EXERCISE ${i+1} / ${i===0?'GUIDED':'EXTEND'}</p><h3>${escape(x.title)}</h3><p><strong>Requirement:</strong> ${escape(x.requirement)}</p><p>${escape(x.challenge)}</p><button type="button" data-example="${x.id}">Study this worked test</button><label><input type="checkbox" data-progress="${x.id}" ${progress[x.id]===true?'checked':''}>I saved this test and can explain its result.</label></article>`).join('');
function updateProgress(){const done=examples.filter(x=>progress[x.id]===true).length;$('progress-summary').textContent=`${done} of ${examples.length} exercise self-checks marked. This checklist does not verify a runner result.`;try{localStorage.setItem(progressKey,JSON.stringify(progress));}catch{$('progress-summary').textContent+=' Browser storage unavailable; this checklist lasts only while the page stays open.';}}
$('exercise-list').addEventListener('click',e=>{const b=e.target.closest('[data-example]');if(!b)return;chooseExample(b.dataset.example);$('workbench').scrollIntoView({behavior:'smooth'});$('example-choice').focus();});
$('exercise-list').addEventListener('change',e=>{if(!e.target.dataset.progress)return;progress[e.target.dataset.progress]=e.target.checked;updateProgress();});
$('clear-progress').addEventListener('click',()=>{progress={};document.querySelectorAll('[data-progress]').forEach(x=>x.checked=false);updateProgress();});
function renderFlash(){const [front,back]=flashcards[flashIndex];$('flash-front').textContent=front;$('flash-back').textContent=back;$('flash-back').hidden=true;$('reveal-flash').textContent='Reveal answer';$('reveal-flash').setAttribute('aria-expanded','false');$('flash-position').textContent=`${flashIndex+1} of ${flashcards.length}`;}
$('reveal-flash').setAttribute('aria-controls','flash-back');
$('reveal-flash').addEventListener('click',()=>{$('flash-back').hidden=!$('flash-back').hidden;$('reveal-flash').textContent=$('flash-back').hidden?'Reveal answer':'Hide answer';$('reveal-flash').setAttribute('aria-expanded',String(!$('flash-back').hidden));});
$('previous-flash').addEventListener('click',()=>{flashIndex=(flashIndex+flashcards.length-1)%flashcards.length;renderFlash();});
$('next-flash').addEventListener('click',()=>{flashIndex=(flashIndex+1)%flashcards.length;renderFlash();});
$('quiz-questions').innerHTML=quiz.map((x,i)=>`<fieldset><legend>${i+1}. ${escape(x.q)}</legend>${x.choices.map((choice,j)=>`<label><input type="radio" name="question-${i}" value="${j}">${escape(choice)}</label>`).join('')}<p class="question-feedback" id="feedback-${i}" hidden></p></fieldset>`).join('');
$('review-quiz').addEventListener('submit',e=>{e.preventDefault();let correct=0,answered=0;quiz.forEach((x,i)=>{const choice=document.querySelector(`input[name="question-${i}"]:checked`);const ok=choice&&Number(choice.value)===x.correct;if(choice)answered++;if(ok)correct++;const feedback=$('feedback-'+i);feedback.hidden=false;feedback.textContent=(ok?'Correct. ':choice?'Review this answer. ':'Choose an answer. ')+x.why;});$('quiz-result').textContent=`${correct} of ${quiz.length} correct; ${answered} answered. Review the explanations and try again. No score was submitted.`;});
renderLesson();renderFlash();updateProgress();
