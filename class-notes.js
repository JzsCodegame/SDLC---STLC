import {safeRecordingUrl} from './class-notes-policy.js';
await import('./whiteboard.js');
const series=document.getElementById('notes-series'),classes=document.getElementById('notes-class'),article=document.getElementById('session-notes'),recording=document.getElementById('recording-content'),status=document.getElementById('notes-status'),previous=document.getElementById('notes-previous'),next=document.getElementById('notes-next');
const el=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
let catalog,sessions=[];
function list(parent,items){const ul=document.createElement('ul');for(const item of items)ul.append(el('li',item));parent.append(ul);}
function block(title){const section=document.createElement('section');section.className='notes-section';section.append(el('h3',title));article.append(section);return section;}
function show(){
 const session=sessions.find(s=>s.key===classes.value);if(!session)return;
 const index=sessions.indexOf(session);previous.disabled=index===0;next.disabled=index===sessions.length-1;
 const url=new URL(location.href);url.searchParams.set('series',session.series);url.searchParams.set('class',session.classId);history.replaceState(null,'',url);
 status.textContent=`${catalog.series.find(s=>s.id===session.series).title} · Class ${session.classId}`;
 article.replaceChildren();recording.replaceChildren();article.append(el('h2',session.title));const meta=el('p',`Class ${session.classId} · ${session.date} · ${session.instructor||'Academy instructor'}`);meta.className='notes-meta';article.append(meta);
 if(session.duplicateOf){const p=el('p','This folder contains the same supplied transcript as Class '+session.duplicateOf.split('/')[1]+'. These notes revisit that lesson.');p.className='duplicate-notice';article.append(p);}
 const info=session.recording;const watch=safeRecordingUrl(info?.url,info?.kind);
 if(watch){
  if(info.kind==='media'){const video=document.createElement('video');video.controls=true;video.preload='metadata';video.src=watch;video.addEventListener('error',()=>{if(!recording.querySelector('.playback-help')){const p=el('p','Playback is unavailable here. Try opening the recording below.');p.className='playback-help';recording.append(p);}});recording.append(video);}
  else if(info.embedVerified===true){const iframe=document.createElement('iframe');iframe.src=watch;iframe.title=`Class ${session.classId} recording`;iframe.allow='fullscreen';iframe.referrerPolicy='no-referrer';recording.append(iframe);}
  const a=el('a',info.kind==='webex'?'Open recording in WebEx ↗':'Open recording ↗');a.href=watch;a.target='_blank';a.rel='noopener noreferrer';recording.append(a);
 }else{const p=el('p',info?.availablePrivately?'The recording is preserved. Playback will appear here when its student viewing link is ready.':'A recording link has not been added for this session yet.');p.className='notes-empty';recording.append(p);}
 list(block('Topics covered'),session.keyConcepts);block('Class summary').append(el('p',session.summary));
 const detailed=block('Detailed class notes');
 for(const part of session.sections){const node=document.createElement('section');node.className='notes-section';node.append(el('h4',part.title));detailed.append(node);node.append(el('p',part.text));const ref=el('p',`Transcript reference · ${part.timestamp}`);ref.className='notes-reference';node.append(ref);}
 list(block('Assignments & practice'),session.practice);
 const terms=document.createElement('dl');terms.className='notes-terms';for(const term of session.terms){terms.append(el('dt',term.term),el('dd',term.definition));}block('Key terms').append(terms);
 const review=block('Check your understanding');review.classList.add('notes-review');for(const q of session.review){const detail=document.createElement('details');detail.append(el('summary',q.question),el('p',q.answer));review.append(detail);}
}
function chooseSeries(wanted){sessions=catalog.sessions.filter(s=>s.series===series.value).sort((a,b)=>a.classId.localeCompare(b.classId,undefined,{numeric:true}));classes.replaceChildren();for(const s of sessions)classes.add(new Option(`Class ${s.classId} — ${s.title}`,s.key));if(wanted&&sessions.some(s=>s.classId===wanted))classes.value=`${series.value}/${wanted}`;show();}
series.onchange=()=>chooseSeries();classes.onchange=show;previous.onclick=()=>{classes.selectedIndex=Math.max(0,classes.selectedIndex-1);show();};next.onclick=()=>{classes.selectedIndex=Math.min(classes.length-1,classes.selectedIndex+1);show();};
try{const response=await fetch('./class-notes-data.json',{cache:'no-cache'});if(!response.ok)throw Error('No library');catalog=await response.json();if(catalog.schemaVersion!==1||!Array.isArray(catalog.sessions)||!catalog.sessions.length)throw Error('No sessions');for(const s of catalog.series)series.add(new Option(s.title,s.id));const query=new URL(location.href).searchParams;if(catalog.series.some(s=>s.id===query.get('series')))series.value=query.get('series');chooseSeries(query.get('class'));}catch{status.textContent='Class notes are temporarily unavailable. Please try again later.';series.disabled=classes.disabled=previous.disabled=next.disabled=true;}
