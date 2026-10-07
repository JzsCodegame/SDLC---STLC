// Only reviewed student notes are public. Raw recordings/transcripts stay private.
const classId=document.body.classList.contains('class-two-page')?'2':'1';
const section=document.createElement('section');section.className='class-session-notes';section.id='class-session-notes';
section.innerHTML='<h2>Class recordings &amp; notes</h2><p>Choose a session to revisit what we covered.</p><label>Session <select aria-label="Class notes session"></select></label><div class="session-notes-content" aria-live="polite"></div>';
document.querySelector('.classroom-shell>main').append(section);
const select=section.querySelector('select'),content=section.querySelector('.session-notes-content');
function render(session){
 content.replaceChildren();
 const add=(tag,value)=>{const el=document.createElement(tag);el.textContent=value;content.append(el);return el;};
 if(!session){add('p','Notes for this class have not been published yet. They will appear here after the recording or transcript is processed and reviewed.');return;}
 add('h3',`Class ${session.id} · ${session.title}`);add('p',session.date);
 add('p',session.summary);
 for(const part of session.sections){add('h4',part.title);if(part.timestamp)add('p',`Recording reference: ${part.timestamp}`);add('p',part.text);}
 add('h4','Review questions');
 for(const item of session.review){const details=document.createElement('details'),summary=document.createElement('summary'),answer=document.createElement('p');summary.textContent=item.question;answer.textContent=item.answer;details.append(summary,answer);content.append(details);}
}
try{
 const response=await fetch('./class-sessions.json',{cache:'no-cache'});if(!response.ok)throw Error('Notes unavailable');
 const catalog=await response.json();if(catalog.schemaVersion!==1||!Array.isArray(catalog.sessions))throw Error('Invalid catalog');
 const sessions=catalog.sessions.filter(s=>s.id===classId||s.id.startsWith(classId+'.'));
 if(!sessions.length){select.disabled=true;select.add(new Option('No published sessions',''));render(null);}
 else{for(const session of sessions)select.add(new Option(`Class ${session.id} — ${session.title}`,session.id));const requested=new URL(location.href).searchParams.get('session');if(sessions.some(s=>s.id===requested))select.value=requested;const update=()=>render(sessions.find(s=>s.id===select.value));select.onchange=update;update();}
}catch{select.disabled=true;content.textContent='Class notes are temporarily unavailable. Please try again later.';}
