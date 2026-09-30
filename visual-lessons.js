// Existing interactive teaching models; concept diagrams live in concept-diagrams.js.
const stages=[
['Planning','Planning','Establish the purpose, scope, feasibility, resources, and risks of the proposed software change. Example: plan a quiz feature that helps students practice a lesson.'],
['Requirements Analysis','Requirements Analysis','Understand, document, and validate what the software must do. Example: five equally weighted questions with three correct answers must display 60%. Resolve ambiguous rules before implementation.'],
['Design','Design','Define the architecture, data, interfaces, and user experience that will satisfy the requirements. Example: design answer selection, submission, scoring, and feedback.'],
['Development','Development','Implement the agreed design in code and perform developer checks. Example: build the quiz page and scoring logic.'],
['Testing','Testing','Evaluate the software against requirements and investigate defects. Example: verify known scores, missing-input behavior, and regression risks. Testing activities can begin before coding.'],
['Deployment','Deployment','Release the software to its intended environment through the agreed process. Example: publish a tested, identifiable version of the quiz feature.'],
['Maintenance','Maintenance','Support and improve the released software, including defect fixes and adaptation to changed needs. Feedback can initiate another lifecycle iteration.']];
const regression=[
['Purpose','Protect existing behavior','Ask whether a change has adversely affected something that previously worked.'],
['Impact','Follow affected dependencies','A scoring change may affect calculation, display, and persisted results. Trace the actual implementation.'],
['Confirmation','Recheck the specific fix','Repeat the case that exposed the defect. This is confirmation testing; checking wider side effects is regression testing.'],
['Selection','Choose checks by risk','Prioritize affected behavior using likelihood of failure, business impact, dependencies, and time.'],
['Limits','State what the evidence covers','Passing results cover the selected cases and conditions. They do not prove that no other defects exist.']];
const api=[
['Client','Prepare known inputs','Illustrative fixture: answer key A B C A B; submitted answers A B C D E. Three answers match.'],
['Request','Send a contract-defined request','Proposed request: POST /quiz/submit with quizId and answers. This endpoint has not been implemented in this lesson.'],
['Service','Apply the agreed rule','The hypothetical service compares the answers and calculates 3 ÷ 5 × 100 = 60.'],
['Response','Inspect the service result','The chosen example contract returns HTTP 200 and percentage: 60. Check the status and the business data separately.'],
['UI','Check what the student sees','A browser check verifies the displayed score. A correct API response does not prove that the page rendered it correctly.']];

export function lessonFor(mod,card){
  if(mod.id==='sdlc'&&['lifecycle','feedback','planning','requirements-analysis','design','development','testing','deployment','maintenance','devops'].includes(card.id))return {kind:'cycle',label:'SDLC · Software Development Lifecycle',nodes:stages,initial:Math.max(0,['planning','requirements-analysis','design','development','testing','deployment','maintenance'].indexOf(card.id))};
  if(mod.id==='regression')return {kind:'mindmap',label:'Regression · explore the connections',nodes:regression,initial:({definition:0,impact:1,confirmation:2,risk:3,limits:4})[card.id]};
  if(mod.id==='api'&&['api-layer','request','response','combine'].includes(card.id))return {kind:'sequence',label:'UI and API · follow one request',nodes:api,initial:({request:1,response:3,combine:4})[card.id]||0};
  if(card.flow)return {kind:'flow',label:'Process · one step at a time',nodes:card.flow.map((x,i)=>[x,x,processDetail(mod.id,card.id,x,i,card)])};
  return {kind:'focus',label:'Micro-lesson · one concept, three views',nodes:[['Understand',card.title,card.idea],['Connect','Connect it to our website',card.example],['Recall',card.prompt,card.answer]]};
}
function processDetail(mid,cid,label,i,card){
 const details={stlc:['Analyze what must be tested and identify gaps in the requirements.','Plan scope, risks, resources, and how results will be judged.','Design cases with inputs, actions, and expected outcomes.','Prepare the environment, test data, and tools.','Execute checks and investigate differences from expected behavior.','Report results, remaining risks, and lessons learned.'],pattern:['Set up the required state and controlled data.','Perform the action under test.','Compare the observed result with the expected outcome.','Remove or reset data created by the test when needed.'],pipeline:['Record the intended change and its revision.','Install the project dependencies needed by the runner.','Execute the configured checks against the intended environment.','Keep results and diagnostics tied to the run.'],review:['Give the assistant real requirements and interface details.','Treat generated code as a proposal.','Verify selectors, expectations, data use, and assumptions.','Run only after the real application and fixture are ready.','Inspect evidence; a passing result only covers what was checked.'],why:['Define the intended behavior before selecting tools.','Encode controlled actions and meaningful assertions.','Execute the prepared checks in a known environment.','Interpret the result against the requirement and the test conditions.'],'ui-layer':['Choose answers using the actual page controls.','Submit through the student-facing interaction.','Compare the displayed score with the agreed expectation.'],acceptance:['Prepare known input values from a controlled fixture.','Perform the specified action.','Check the exact result defined in the acceptance criterion.']};
 return details[cid]?.[i]||`${label} is one part of this concept. ${card.idea}`;
}
export {openVisualLesson} from './visual-dialog.js';
