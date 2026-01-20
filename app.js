import { loadQuestionsFromFirestore, saveScoreToFirestore, loadRecentScores } from './firebase-config.js';

const startScreen = document.getElementById('start-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');

const startBtn = document.getElementById('start-btn');
const nextBtn = document.getElementById('next-btn');
const restartBtn = document.getElementById('restart-btn');

const nameInput = document.getElementById('student-name');
const studentDisplay = document.getElementById('student-display');
const timerDisplay = document.getElementById('timer');
const progressDisplay = document.getElementById('progress');
const questionText = document.getElementById('question-text');
const choicesForm = document.getElementById('choices');
const resultSummary = document.getElementById('result-summary');
const recentScoresContainer = document.getElementById('recent-scores');

let questions = [];
let currentIndex = 0;
let score = 0;
let timer = null;
let timeRemaining = 300;
let studentName = '';

const totalQuestions = 10;
const SCORES_REFRESH_INTERVAL = 30000; // 30 seconds
const FIRESTORE_PROCESSING_DELAY = 1000; // 1 second

// Load questions from Firestore with fallback to questions.json
async function loadQuestions() {
  try {
    // Try Firestore first
    const firestoreQuestions = await loadQuestionsFromFirestore();
    
    if (firestoreQuestions && firestoreQuestions.length > 0) {
      console.log('Loaded questions from Firestore');
      questions = firestoreQuestions;
      return;
    }
    
    console.log('Firestore returned empty, falling back to questions.json');
  } catch (error) {
    console.log('Firestore failed, falling back to questions.json:', error);
  }
  
  // Fallback to questions.json
  try {
    const response = await fetch('questions.json');
    const data = await response.json();
    console.log('Loaded questions from questions.json');
    questions = data;
  } catch (error) {
    console.error('Failed to load questions from questions.json:', error);
    questions = [];
  }
}

// Initialize questions on page load
loadQuestions();

// Load and display recent scores
async function displayRecentScores() {
  const scores = await loadRecentScores();
  
  if (!scores || scores.length === 0) {
    recentScoresContainer.innerHTML = '<p class="no-scores">No recent scores yet</p>';
    return;
  }
  
  recentScoresContainer.innerHTML = '';
  
  scores.forEach(scoreData => {
    const scoreItem = document.createElement('div');
    scoreItem.className = 'score-item';
    
    const scoreName = document.createElement('div');
    scoreName.className = 'score-name';
    scoreName.textContent = scoreData.studentName;
    
    const scoreResult = document.createElement('div');
    scoreResult.className = 'score-result';
    
    const percentSpan = document.createElement('span');
    percentSpan.className = 'score-percent';
    if (scoreData.percent >= 80) {
      percentSpan.classList.add('high');
    } else if (scoreData.percent >= 60) {
      percentSpan.classList.add('medium');
    }
    percentSpan.textContent = `${scoreData.percent}%`;
    
    scoreResult.innerHTML = `${scoreData.score}/${scoreData.total}`;
    scoreResult.appendChild(percentSpan);
    
    const scoreTime = document.createElement('div');
    scoreTime.className = 'score-time';
    if (scoreData.timestamp) {
      scoreTime.textContent = formatTimeAgo(scoreData.timestamp);
    }
    
    scoreItem.appendChild(scoreName);
    scoreItem.appendChild(scoreResult);
    if (scoreTime.textContent) {
      scoreItem.appendChild(scoreTime);
    }
    
    recentScoresContainer.appendChild(scoreItem);
  });
}

// Format timestamp as "X minutes/hours ago"
function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  
  const now = new Date();
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  return 'Today';
}

// Initialize recent scores on page load
displayRecentScores();

// Refresh recent scores every 30 seconds
setInterval(displayRecentScores, SCORES_REFRESH_INTERVAL);

startBtn.addEventListener('click', () => {
  studentName = nameInput.value.trim();
  if (!studentName) {
    nameInput.focus();
    return;
  }

  if (!questions.length) {
    alert('Questions could not be loaded. Please try again later.');
    return;
  }

  startQuiz();
});

nextBtn.addEventListener('click', (event) => {
  event.preventDefault();
  const selected = choicesForm.querySelector('input[name="choice"]:checked');
  if (!selected) {
    alert('Please select an answer.');
    return;
  }

  const isCorrect = Number(selected.value) === questions[currentIndex].answer;
  if (isCorrect) score += 1;

  currentIndex += 1;

  if (currentIndex >= Math.min(totalQuestions, questions.length)) {
    finishQuiz();
  } else {
    renderQuestion();
  }
});

restartBtn.addEventListener('click', () => {
  resetState();
  startScreen.classList.remove('hidden');
  resultScreen.classList.add('hidden');
});

function startQuiz() {
  resetState();
  studentDisplay.textContent = `Student: ${studentName}`;

  startScreen.classList.add('hidden');
  quizScreen.classList.remove('hidden');

  startTimer();
  renderQuestion();
}

function renderQuestion() {
  const total = Math.min(totalQuestions, questions.length);
  const currentQuestion = questions[currentIndex];

  progressDisplay.textContent = `Question ${currentIndex + 1} of ${total}`;
  questionText.textContent = currentQuestion.question;

  choicesForm.innerHTML = '';
  currentQuestion.choices.forEach((choice, index) => {
    const label = document.createElement('label');
    label.className = 'choice';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'choice';
    input.value = index;

    const span = document.createElement('span');
    span.textContent = choice;

    label.appendChild(input);
    label.appendChild(span);
    choicesForm.appendChild(label);
  });

  nextBtn.textContent = currentIndex === total - 1 ? 'Finish' : 'Next';
}

function startTimer() {
  timeRemaining = 300;
  updateTimer();
  timer = setInterval(() => {
    timeRemaining -= 1;
    updateTimer();

    if (timeRemaining <= 0) {
      finishQuiz();
    }
  }, 1000);
}

function updateTimer() {
  const minutes = String(Math.floor(timeRemaining / 60)).padStart(2, '0');
  const seconds = String(timeRemaining % 60).padStart(2, '0');
  timerDisplay.textContent = `${minutes}:${seconds}`;
}

function finishQuiz() {
  clearInterval(timer);
  quizScreen.classList.add('hidden');
  resultScreen.classList.remove('hidden');

  const total = Math.min(totalQuestions, questions.length);
  const percent = Math.round((score / total) * 100);

  resultSummary.textContent = `${studentName}, you scored ${score}/${total} (${percent}%).`;
  
  // Save score to Firestore and refresh recent scores
  saveScoreToFirestore(studentName, score, total, percent).then((success) => {
    if (success) {
      // Wait a moment for Firestore to process, then refresh
      setTimeout(() => {
        displayRecentScores();
      }, FIRESTORE_PROCESSING_DELAY);
    }
  });
}

function resetState() {
  clearInterval(timer);
  currentIndex = 0;
  score = 0;
  timeRemaining = 300;
}
