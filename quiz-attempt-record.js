// Pure snapshot builder; no Firebase access or current-bank reconstruction.
export function buildQuizAttempt({attemptId,studentName,quizTopic,startedAt,completedAt,questions,selections,completionReason='submitted'}) {
 if(!attemptId||!studentName?.trim()||!quizTopic||!Array.isArray(questions)||!questions.length||questions.length>100||!Array.isArray(selections)||!['submitted','timed-out'].includes(completionReason))throw Error('Invalid attempt');
 if(!Number.isFinite(Date.parse(startedAt))||!Number.isFinite(Date.parse(completedAt))||Date.parse(completedAt)<Date.parse(startedAt))throw Error('Invalid attempt timestamps');
 if(selections.length>questions.length)throw Error('Unexpected answers');
 const answers=questions.map((q,i)=>{
  if(typeof q.question!=='string'||!Array.isArray(q.choices)||q.choices.length!==4||q.choices.some(c=>typeof c!=='string')||!Number.isInteger(q.answer)||q.answer<0||q.answer>3)throw Error('Invalid question snapshot');
  const selectedIndex=selections[i]??null;
  if(selectedIndex!==null&&(!Number.isInteger(selectedIndex)||selectedIndex<0||selectedIndex>3))throw Error('Invalid selected answer');
  return {position:i+1,question:q.question,choices:[...q.choices],correctIndex:q.answer,selectedIndex,correct:selectedIndex===q.answer};
 });
 const score=answers.filter(a=>a.correct).length,total=answers.length;
 return {schemaVersion:1,attemptId,studentName:studentName.trim(),identitySource:'student-entered-name',quizTopic,startedAt,completedAt,completionReason,score,total,percent:Math.round(score/total*100),answers};
}
