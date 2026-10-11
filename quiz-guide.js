const entry=document.querySelector('.practice-entry');
const launch=document.createElement('button');
launch.type='button';launch.id='quiz-guide-launch';launch.className='quiz-guide-launch';
launch.textContent='Read the quiz guide →';launch.setAttribute('aria-haspopup','dialog');
launch.setAttribute('aria-controls','quiz-guide-dialog');
entry.querySelector('.section-heading').after(launch);
const dialog=document.createElement('dialog');
dialog.id='quiz-guide-dialog';dialog.className='quiz-guide-dialog';
dialog.setAttribute('aria-labelledby','quiz-guide-title');
dialog.innerHTML='<header><div><p class="eyebrow">02 / PREPARE BEFORE YOU START</p><h2 id="quiz-guide-title">Your quiz guide</h2></div><button type="button" id="quiz-guide-close" aria-label="Close quiz guide">Close ×</button></header><article id="quiz-guide-card" aria-live="polite"></article><footer><button type="button" id="quiz-guide-prev">← Previous</button><span id="quiz-guide-position"></span><button type="button" id="quiz-guide-next">Next →</button></footer>';
document.body.append(dialog);
let index=0;
const topic=()=>document.querySelector('#quiz-topic').value||'your topic';
const focus={
 SDLC:'Review Planning, Requirements Analysis, Design, Development, Testing, Deployment and Maintenance. Connect each stage to its purpose, business decisions and QA responsibilities.',
 STLC:'Review requirement analysis, test planning, test cases, environment and data setup, execution, defect evidence and completion. Distinguish confirmation testing from regression testing.',
 ServiceNow:'Review incidents, problems, changes, requests and the Service Catalog. Practice workflows, approvals, roles, SLAs, Business Rules, integrations, asset lifecycles and CMDB relationships. Use the rules stated in each scenario.'
};
function cards(){return [
 ['Choose your learning focus','You selected '+topic()+'. Confirm this is the topic you intend to take. Read the topic material before starting the timer.'],
 ['Review the material first',focus[topic()]||'Open the selected topic’s learning material and review its definitions, examples and expected outcomes. Use the visual learning journey for related foundations; ask your instructor about material not yet available.'],
 ['Work through the matching flashcards','Open “A little review goes a long way” and review all 25 cards for your selected topic. Try answering before reading the explanation. Return to the material for any answer you cannot explain in your own words.'],
 ['Practice reasoning through scenarios','Identify the business goal, the stated rule, the action and the expected result. Compare every option. Do not assume a company’s approval, priority or SLA configuration is universal. Challenging questions require connecting ideas, not guessing from keywords.'],
 ['Know the quiz controls','Enter your name and click Start topic quiz when ready. There are 25 questions and a 5-minute timer; Java coding quizzes allow 10 minutes. Choose one answer, then click Next. You cannot return to previous questions. The timer ends the attempt automatically.'],
 ['Ready—or review again?','Start when you can explain the core concepts and apply them to an example. Your result shows the quiz topic and score. If something is unclear, review the flashcards or ask your instructor before starting.']
];}
function render(){
 const all=cards(),card=dialog.querySelector('#quiz-guide-card');card.replaceChildren();
 const h=document.createElement('h3'),p=document.createElement('p');h.textContent=all[index][0];p.textContent=all[index][1];card.append(h,p);
 dialog.querySelector('#quiz-guide-position').textContent=(index+1)+' / '+all.length;
 dialog.querySelector('#quiz-guide-prev').disabled=index===0;
 dialog.querySelector('#quiz-guide-next').textContent=index===all.length-1?'Return to preparation ✓':'Next →';
}
launch.onclick=()=>{index=0;render();dialog.showModal();dialog.querySelector('#quiz-guide-close').focus();};
dialog.querySelector('#quiz-guide-close').onclick=()=>dialog.close();
dialog.querySelector('#quiz-guide-prev').onclick=()=>{if(index>0){index--;render();}};
dialog.querySelector('#quiz-guide-next').onclick=()=>{if(index===cards().length-1)dialog.close();else{index++;render();}};
dialog.addEventListener('keydown',e=>{
 if(e.key==='ArrowRight'&&index<cards().length-1){e.preventDefault();index++;render();}
 if(e.key==='ArrowLeft'&&index>0){e.preventDefault();index--;render();}
});
dialog.addEventListener('close',()=>launch.focus());
