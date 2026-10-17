import {buildQuizAttempt} from './quiz-attempt-record.js';

// Keep the quiz's original order and wording even if another bank is loaded.
export function createQuizAttemptSession({questions, studentName, quizTopic,
  attemptId = crypto.randomUUID(), now = () => new Date().toISOString()}) {
  const snapshot = structuredClone(questions);
  const startedAt = now();
  const selections = Array(snapshot.length).fill(null);
  let completed = null;
  let pending = null;
  let acknowledged = false;
  return {
    select(position, selectedIndex) {
      if (completed) return;
      if (!Number.isInteger(position) || position < 0 || position >= snapshot.length ||
          !Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3) {
        throw Error('Invalid answer selection');
      }
      selections[position] = selectedIndex;
    },
    finish(completionReason = 'submitted') {
      if (!completed) completed = buildQuizAttempt({attemptId, studentName, quizTopic,
        startedAt, completedAt: now(), questions: snapshot, selections, completionReason});
      return structuredClone(completed);
    },
    save(write) {
      if (!completed) return Promise.reject(Error('Quiz has not ended'));
      if (acknowledged) return Promise.resolve(attemptId);
      if (pending) return pending;
      pending = Promise.resolve().then(() => write(structuredClone(completed))).then(() => {
        acknowledged = true;
        return attemptId;
      }).finally(() => { pending = null; });
      return pending;
    }
  };
}
