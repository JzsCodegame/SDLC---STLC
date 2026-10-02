import {readVerifiedRelease} from './automation-release.mjs';

const concepts = [
  {label:'Requirement',title:'Start with an observable promise.',items:['A student can create a ticket with a title and description.','The saved ticket starts with an Open status.','The title must appear in the ticket list.'],caseTitle:'Cannot open the quiz',example:'Create a ticket titled “Cannot open the quiz” and describe the error you saw. After submission, look for that title and its Open status.',question:'Would a click on Create ticket prove the requirement?',answer:'No. The click is an action. The saved ticket title and its initial status are the results we must check.'},
  {label:'Observe',title:'Try the workflow before coding it.',items:['Use the practice app to create one ticket manually.','Try submitting an empty required field.','Notice the success message and how the list changes.'],caseTitle:'Find the expected behaviour',example:'Leave the title blank and try to submit. The app should explain what is missing and must not create an empty ticket.',question:'What should the negative test assert?',answer:'A required-field message appears, and the number of saved tickets does not increase.'},
  {label:'Locate',title:'Choose the element the user recognises.',items:['Find an input by its visible label.','Find a button by its role and accessible name.','Use a stable test identifier when the visible interface cannot identify an element precisely.'],caseTitle:'A useful locator',example:'A field label such as Title tells both the student and the test what the input means. A numbered CSS position tells neither what the field does nor why it matters.',question:'Why can “the third input” break after a layout change?',answer:'Adding another input changes the position even if the Title field still works. A label describes the intended field.'},
  {label:'Assert',title:'Check the result, not just the action.',items:['Fill the form and submit it.','Wait for the ticket to appear using the framework’s assertion or retry behaviour.','Check both its title and its expected status.'],caseTitle:'Did anything get saved?',example:'A test that ends immediately after clicking Create ticket can miss a failed save. An assertion on the resulting ticket exposes that failure.',question:'Should a longer fixed sleep fix a failed assertion?',answer:'First inspect the failure. Wait for the specific expected state; a fixed sleep can hide timing issues and still miss a real defect.'},
  {label:'Regress',title:'Repeat the checks after a change.',items:['Create a ticket and change its status.','Filter the list and confirm the ticket appears in the correct group.','Run the same checks after changing the application.'],caseTitle:'A status filter stops working',example:'Suppose a new design changes the ticket list. Existing status-filter tests should still prove that an Open ticket appears under Open and disappears when another status is selected.',question:'Why keep a test after the original defect is fixed?',answer:'It protects a previously working behaviour when later changes affect the same workflow. That repeated check is regression testing.'},
  {label:'Evidence',title:'Use a failure to explain what happened.',items:['Read the expected and actual result in the failed assertion.','Inspect the browser state and the request or response involved.','Fix the application or an incorrect test expectation, then rerun the check.'],caseTitle:'Expected Open, received Closed',example:'If a new ticket appears as Closed, inspect the API response and the rendered label. The response can help distinguish an incorrect saved status from a display problem.',question:'Does every red test prove an application defect?',answer:'No. Incorrect expectations, test data, locators, or environment failures can also cause it. Explain the evidence before deciding what to change.'}
];
let active=0;
const container=document.querySelector('#lab-concept');
const tabs=document.querySelector('.lab-card-tabs');
function render(){
  const card=concepts[active];
  container.innerHTML=`<div><span class="lab-number">${String(active+1).padStart(2,'0')} / ${card.label.toUpperCase()}</span><h3>${card.title}</h3><ul>${card.items.map(item=>`<li>${item}</li>`).join('')}</ul></div><div class="lab-case"><h4>${card.caseTitle}</h4><p>${card.example}</p><details><summary>${card.question}</summary><p>${card.answer}</p></details></div>`;
  tabs.querySelectorAll('button').forEach((button,i)=>button.setAttribute('aria-pressed',String(active===i)));
  document.querySelector('#lab-position').textContent=`${active+1} of ${concepts.length} concepts`;
  document.querySelector('#lab-previous').disabled=active===0;
  document.querySelector('#lab-next').disabled=active===concepts.length-1;
}
concepts.forEach((card,i)=>{const button=document.createElement('button');button.type='button';button.textContent=`${i+1}. ${card.label}`;button.addEventListener('click',()=>{active=i;render()});tabs.append(button)});
document.querySelector('#lab-previous').addEventListener('click',()=>{if(active>0){active--;render()}});
document.querySelector('#lab-next').addEventListener('click',()=>{if(active<concepts.length-1){active++;render()}});
render();
document.querySelectorAll('[data-framework]').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('[data-framework]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
  const framework=button.dataset.framework;
  document.querySelector('#lab-command').textContent=framework==='playwright'?'.\\Lab.cmd test playwright-headed':'.\\Lab.cmd test cypress-open';
  document.querySelector('#lab-command-help').textContent=framework==='playwright'?'A headed Playwright run opens a browser on this computer. Read the pass/fail results in PowerShell.':'Cypress opens on this computer. Choose E2E Testing, then run help-desk.cy.ts. Press Ctrl+C in PowerShell when finished.';
  document.querySelector('#copy-lab-status').textContent='';
}));
document.querySelector('#copy-lab-command').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(document.querySelector('#lab-command').textContent);document.querySelector('#copy-lab-status').textContent='Command copied.'}
  catch{document.querySelector('#copy-lab-status').textContent='Select the command above and copy it.'}
});
const status=document.querySelector('#lab-availability');
const help=document.querySelector('#kit-help');
try{
  const response=await fetch('lab-config.json',{cache:'no-store'});if(!response.ok)throw new Error('Configuration unavailable');
  const release=readVerifiedRelease(await response.json());
  if(!release)throw new Error('Release pending or incomplete');
  const download=document.querySelector('#kit-download');download.href=release.downloadUrl.href;download.download=release.filename;download.hidden=false;
  const details=document.querySelector('#kit-details');document.querySelector('#kit-version').textContent=release.version;document.querySelector('#kit-checksum').textContent=release.sha256;document.querySelector('#kit-source').textContent=release.sourceCommit;details.hidden=false;
  const notes=document.querySelector('#kit-release');notes.href=release.releaseUrl.href;notes.hidden=false;
  status.textContent=`Verified Windows lab kit ${release.version} is ready to download (${release.bytes.toLocaleString()} bytes).`;
  help.innerHTML=`After downloading, compare the displayed SHA-256 with <a href="${release.checksumsUrl.href}" target="_blank" rel="noopener">SHA256SUMS</a>, extract the kit, then run <code>.\\Lab.cmd check</code>.`;
}catch{status.textContent='The local practice kit is being prepared. Explore the six lesson cards below while your instructor confirms the release.';}
