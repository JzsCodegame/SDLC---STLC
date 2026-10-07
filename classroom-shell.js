// Shared class chrome: preserve lesson content and class-specific controllers.
const isTwo=document.body.classList.contains('class-two-page');
document.body.classList.add('classroom-page');
const nav=document.querySelector('.academy-nav nav');
nav.innerHTML=`<details class="class-picker"><summary>${isTwo?'Class Two':'Class One'} <span aria-hidden="true">▾</span></summary><div class="class-picker-panel"><button type="button" data-class-scroll="-1" aria-label="Scroll classes up">▲</button><nav aria-label="Choose a class" class="class-picker-list"><a href="learn.html?class=1#sdlc/lifecycle" ${!isTwo?'aria-current="page"':''}>Class One</a><a href="class-two.html" ${isTwo?'aria-current="page"':''}>Class Two</a></nav><button type="button" data-class-scroll="1" aria-label="Scroll classes down">▼</button></div></details><a href="index.html?topic=SDLC">Quiz &amp; flashcards</a><a href="automation.html">Automation lab</a><a href="curriculum.html">Curriculum</a>`;
const picker=nav.querySelector('.class-picker');
picker.querySelectorAll('[data-class-scroll]').forEach(button=>button.onclick=()=>picker.querySelector('.class-picker-list').scrollBy({top:Number(button.dataset.classScroll)*80,behavior:'smooth'}));
document.addEventListener('click',event=>{if(!picker.contains(event.target))picker.open=false;});
picker.addEventListener('keydown',event=>{if(event.key==='Escape'){picker.open=false;picker.querySelector('summary').focus();}});
if(isTwo){
 const main=document.querySelector('main');
 const shell=document.createElement('div');shell.className='shell classroom-shell';
 main.before(shell);
 const aside=document.createElement('aside');aside.className='classroom-path';
 aside.innerHTML='<p class="eyebrow">YOUR LEARNING PATH</p><h1>From idea<br>to assurance.</h1><p class="intro">One concept. One card.<br>Build the connections.</p><p class="small">Class Two · UI automation</p>';
 aside.append(document.getElementById('section-nav'));
 aside.insertAdjacentHTML('beforeend','<p class="small">Practice progress stays in this browser. Save code in your assigned workspace.</p>');
 shell.append(aside,main);
 const toolbar=document.createElement('header');toolbar.className='top classroom-toolbar';
 toolbar.innerHTML='<span class="lesson-identity">THE CLASSROOM</span><span class="edition">LEARN A LITTLE. CONNECT A LOT.</span><button id="whiteboard-launch" aria-haspopup="dialog" aria-controls="class-whiteboard">✎ Whiteboard</button><button id="guide-toggle" aria-expanded="false" aria-controls="guide">How to use</button>';
 shell.before(toolbar);
 main.insertAdjacentHTML('afterbegin','<a class="app-return" href="learn.html?class=1#sdlc/lifecycle">← Return to Class One</a><section id="guide" hidden><h2>Your classroom is here</h2><ol><li>Choose a section, then move through its concept cards.</li><li>Open related study material for wiki notes, a diagram, a mind map, or an interactive lesson.</li><li>Use the whiteboard to sketch an idea; your board stays with you between classes in this browser.</li><li>Try the exercises in your assigned workspace, then check your understanding.</li></ol><p>Lesson code prepares text. Tests run in the assigned workspace.</p></section>');
 document.getElementById('guide-toggle').onclick=()=>{const guide=document.getElementById('guide');guide.hidden=!guide.hidden;document.getElementById('guide-toggle').setAttribute('aria-expanded',String(!guide.hidden));};
 document.querySelector('.class-hero').classList.add('class-intro');
 document.querySelector('#review-title').closest('section').id='review';
 document.getElementById('lesson-card').before(Object.assign(document.createElement('nav'),{className:'tabs',ariaLabel:'Lesson mode',innerHTML:'<a href="#lesson">Concept cards</a><a href="#review">Mini quiz &amp; recall</a>'}));
}else{
 document.querySelector('.top').classList.add('classroom-toolbar');
 document.querySelector('.shell').classList.add('classroom-shell');
 document.querySelector('.shell>aside').classList.add('classroom-path');
 document.querySelector('.class-routes').insertAdjacentHTML('beforeend','<a href="class-two.html">Continue to Class Two →</a><a href="automation.html">Automation workspace</a>');
}
await import('./whiteboard.js');
await import('./class-session-notes.js');
