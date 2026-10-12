const $=name=>document.querySelector(`[data-cy="${name}"]`);
document.querySelector('#reset-lab').onclick=()=>{localStorage.removeItem('academy-component-preference');location.reload()};
document.querySelector('#profile').onsubmit=e=>{e.preventDefault();$('profile-result').textContent=`Saved: ${$('name').value} · ${$('notes').value}`};
$('region').onchange=()=>{const region=$('region').value;$('office').disabled=!region;$('office').replaceChildren(...(region?[region+' Office','Remote']:['Choose office']).map(x=>new Option(x,x)))};
$('skills').onchange=()=>{$('skills-result').textContent=[...$('skills').selectedOptions].map(o=>o.value).join(', ')};
$('switch').onclick=()=>{$('switch').setAttribute('aria-checked',String($('switch').getAttribute('aria-checked')!=='true'))};
$('range').oninput=()=>{$('range-result').textContent=$('range').value};
$('city').oninput=()=>{const list=document.querySelector('#city-options');list.hidden=!$('city').value;$('city').setAttribute('aria-expanded',String(!list.hidden));list.querySelectorAll('li').forEach(x=>x.hidden=!x.textContent.toLowerCase().startsWith($('city').value.toLowerCase()))};
for(const name of ['boston','berlin']){const choose=()=>{$('city').value=$(name).textContent;$('city-result').textContent=$(name).textContent;document.querySelector('#city-options').hidden=true;$('city').setAttribute('aria-expanded','false')};$(name).onclick=choose;$(name).onkeydown=e=>{if(e.key==='Enter')choose()}};
for(const name of ['overview','history'])$(name).onclick=()=>{for(const n of ['overview','history']){$(n).setAttribute('aria-selected',String(n===name));document.querySelector('#'+n+'-panel').hidden=n!==name}};
const tooltip=show=>{document.querySelector('#hint').hidden=!show};$('help').onmouseenter=()=>tooltip(true);$('help').onmouseleave=()=>tooltip(false);$('help').onfocus=()=>tooltip(true);$('help').onblur=()=>tooltip(false);
const orders=[{id:'DEMO-1',amount:30},{id:'DEMO-2',amount:10},{id:'DEMO-3',amount:20}];let page=0,sorted=false;
function table(){let rows=orders.filter(x=>x.id.toLowerCase().includes($('filter').value.toLowerCase()));if(sorted)rows.sort((a,b)=>a.amount-b.amount);const visible=rows.slice(page*2,page*2+2);$('rows').replaceChildren(...visible.map(x=>{const tr=document.createElement('tr');const id=document.createElement('td'),amount=document.createElement('td'),action=document.createElement('td'),button=document.createElement('button');id.textContent=x.id;amount.textContent=String(x.amount);button.textContent='Inspect';button.onclick=()=>{button.textContent='Selected '+x.id};action.append(button);tr.append(id,amount,action);return tr}));$('page-number').textContent='Page '+(page+1);$('next-page').disabled=(page+1)*2>=rows.length}
$('filter').oninput=()=>{page=0;table()};$('sort').onclick=()=>{sorted=true;page=0;table()};$('next-page').onclick=()=>{page++;table()};table();
$('open-modal').onclick=()=>{$('modal-note').value=$('modal-result').textContent;$('modal').showModal()};$('modal').onclose=()=>{if($('modal').returnValue==='save')$('modal-result').textContent=$('modal-note').value};
$('alert').onclick=()=>alert('Demo alert');$('confirm').onclick=()=>{$('confirm-result').textContent=confirm('Delete demo order?')?'Order deleted':'Order kept'};
$('upload').onchange=()=>{$('upload-result').textContent=$('upload').files[0]?.name||'No file'};
$('drag').ondragstart=e=>e.dataTransfer.setData('text/plain','Demo task');$('drop').ondragover=e=>e.preventDefault();$('drop').ondrop=e=>{e.preventDefault();if(e.dataTransfer.getData('text/plain')==='Demo task')$('drop').textContent='Completed: Demo task'};$('move-task').onclick=()=>{$('drop').textContent='Completed: Demo task'};
$('delayed').onclick=()=>{$('delayed-result').textContent='Loading…';setTimeout(()=>{$('delayed-result').textContent='Confirmed DEMO-42'},300)};
$('request').onclick=async()=>{$('service-result').textContent='Loading…';try{const response=await fetch('component-status.json');if(!response.ok)throw Error('Request failed');const data=await response.json();$('service-result').textContent=data.status}catch{$('service-result').textContent='Service unavailable — retry'}};
const shadow=$('shadow-host').attachShadow({mode:'open'});shadow.innerHTML='<label>Shadow name<input></label><button>Apply</button><output></output>';shadow.querySelector('button').onclick=()=>{shadow.querySelector('output').textContent=shadow.querySelector('input').value};
$('preference').value=localStorage.getItem('academy-component-preference')||'';$('save-preference').onclick=()=>{localStorage.setItem('academy-component-preference',$('preference').value);$('preference-result').textContent='Preference saved'};
$('keyboard').onkeydown=e=>{if(e.key==='Enter')$('keyboard-result').textContent='Command: '+$('keyboard').value};

$('name').oninput=()=>{$('name').setCustomValidity($('name').value.length<2?'Use at least 2 characters':'')};
$('frame').srcdoc=`<label>Reference<input id=reference></label><button id=confirm>Confirm</button><output></output><script>document.querySelector('button').onclick=()=>{document.querySelector('output').textContent=document.querySelector('input').value}</script>`;
