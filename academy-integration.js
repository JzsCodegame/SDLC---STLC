// Bridges the existing quiz/flashcard app to the authored learning sections.
const routes={
 SDLC:['sdlc','lifecycle'],STLC:['manual','stlc'],Requirements:['requirements','rule'],Design:['sdlc','design'],
 'Testing Types':['regression','definition'],'Test Artifacts':['manual','case'],'Defects & Bug Tracking':['manual','defect'],
 'Deployment & DevOps':['sdlc','devops'],Maintenance:['sdlc','maintenance'],Git:['tools','git'],GitHub:['tools','git'],
 Jenkins:['tools','pipeline'],Docker:['tools','docker']
};
const selected=document.querySelector('#quiz-topic'),flashcards=document.querySelector('#flashcard-topic');
const entry=document.querySelector('#topic-lesson');
let restored=false;
function remember(topic){try{sessionStorage.setItem('academy-quiz-topic',topic);}catch{}}
function renderEntry(){const topic=selected.value,r=routes[topic];remember(topic);entry.querySelector('h3').textContent=r?`${topic}: learn before you quiz`:`Explore the automation learning journey`;
 entry.querySelector('p').textContent=r?'Study one concept at a time with copyable wiki notes, a concept diagram, a mind map, and an interactive lesson. Then return to this quiz.':`A dedicated ${topic} visual lesson is not included in this class yet. You can still review the SDLC-to-automation journey.`;
 entry.querySelector('a').href=`learn.html?topic=${encodeURIComponent(topic)}#${(r||['sdlc','lifecycle']).join('/')}`;
 entry.querySelector('a').textContent=r?`Open ${topic} visual lessons →`:'Explore the learning journey →';
 document.querySelector('#academy-learning-link').href=entry.querySelector('a').href;
}
function ready(){if(!selected.options.length)return;if(!restored){let wanted=new URLSearchParams(location.search).get('topic');if(!wanted){try{wanted=sessionStorage.getItem('academy-quiz-topic');}catch{}}
 if(wanted&&[...selected.options].some(o=>o.value===wanted)){selected.value=wanted;selected.dispatchEvent(new Event('change'));}restored=true;}renderEntry();}
selected.addEventListener('change',renderEntry);flashcards.addEventListener('change',renderEntry);new MutationObserver(ready).observe(selected,{childList:true});ready();
