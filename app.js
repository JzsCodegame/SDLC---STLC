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

const flashcardList = document.getElementById('flashcard-list');
const flashcardTopicSelect = document.getElementById('flashcard-topic');
const flashcardTopicCount = document.getElementById('flashcard-topic-count');
const quizTopicSelect = document.getElementById('quiz-topic');

let questions = [];
let currentIndex = 0;
let score = 0;
let timer = null;
let timeRemaining = 300;
let studentName = '';
let selectedQuizQuestions = [];
let availableTopics = new Map();
const totalQuestions = 25;
const SCORES_REFRESH_INTERVAL = 30000; // 30 seconds
const FIRESTORE_PROCESSING_DELAY = 1000; // 1 second
const MAX_FLASHCARD_TOPICS = 10;
const FLASHCARDS_PER_TOPIC = 20;

// Helper functions to prevent copy/paste during quiz
function preventCopyPaste(event) {
  event.preventDefault();
}

function preventKeyboardShortcuts(event) {
  // Prevent Ctrl+C, Ctrl+V, Ctrl+X, Cmd+C, Cmd+V, Cmd+X
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && (key === 'a' || key === 'c' || key === 'v' || key === 'x')) {
    event.preventDefault();
  }
}

function clearQuizSelection() {
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed) return;

  const anchorNode = selection.anchorNode;
  const focusNode = selection.focusNode;

  if (quizScreen.contains(anchorNode) || quizScreen.contains(focusNode)) {
    selection.removeAllRanges();
  }
}

function enableCopyPasteBlocking() {
  document.addEventListener('copy', preventCopyPaste);
  document.addEventListener('cut', preventCopyPaste);
  document.addEventListener('paste', preventCopyPaste);
  document.addEventListener('contextmenu', preventCopyPaste);
  document.addEventListener('keydown', preventKeyboardShortcuts);
  document.addEventListener('selectionchange', clearQuizSelection);
}

function disableCopyPasteBlocking() {
  document.removeEventListener('copy', preventCopyPaste);
  document.removeEventListener('cut', preventCopyPaste);
  document.removeEventListener('paste', preventCopyPaste);
  document.removeEventListener('contextmenu', preventCopyPaste);
  document.removeEventListener('keydown', preventKeyboardShortcuts);
  document.removeEventListener('selectionchange', clearQuizSelection);
}

// Load questions from questions.json with fallback to Firestore
async function loadQuestions() {
  try {
    const response = await fetch('questions.json', { cache: 'no-store' });
    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      console.log('Loaded questions from questions.json');
      questions = data;
      renderFlashcardList();
      return;
    }

    console.log('questions.json returned empty, falling back to Firestore');
  } catch (error) {
    console.log('questions.json failed, falling back to Firestore:', error);
  }

  // Fallback to Firestore
  try {
    const firestoreQuestions = await loadQuestionsFromFirestore();
    if (firestoreQuestions && firestoreQuestions.length > 0) {
      console.log('Loaded questions from Firestore');
      questions = firestoreQuestions;
      renderFlashcardList();
      return;
    }

    console.error('Firestore returned empty question set.');
    questions = [];
  } catch (error) {
    console.error('Failed to load questions from Firestore:', error);
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

function populateQuizTopicDropdown(topicMap) {
  if (!quizTopicSelect) return;

  quizTopicSelect.innerHTML = '';
  const orderedTopics = [...topicMap.keys()];
  const javaIndex = orderedTopics.indexOf('Java');
  if (javaIndex > -1) {
    orderedTopics.splice(javaIndex, 1);
  }
  orderedTopics.unshift('Java');

  orderedTopics.forEach((topic) => {
    const option = document.createElement('option');
    option.value = topic;
    option.textContent = topic;
    quizTopicSelect.appendChild(option);
  });
}



function getJavaW3PracticeQuestions() {
  return [
    { question: 'Which keyword is used to define a class in Java?', choices: ['class', 'define', 'struct', 'object'], answer: 0 },
    { question: 'Which method is the entry point of a Java application?', choices: ['run()', 'main()', 'start()', 'init()'], answer: 1 },
    { question: 'Which primitive type stores true/false values?', choices: ['bool', 'boolean', 'bit', 'flag'], answer: 1 },
    { question: 'Which symbol ends a statement in Java?', choices: [':', '.', ';', ','], answer: 2 },
    { question: 'Which keyword is used to inherit a class?', choices: ['inherits', 'extends', 'implements', 'super'], answer: 1 },
    { question: 'Which access modifier makes a member visible only within its own class?', choices: ['public', 'protected', 'private', 'default'], answer: 2 },
    { question: 'Which keyword is used to create an object?', choices: ['make', 'new', 'create', 'object'], answer: 1 },
    { question: 'Which loop executes at least once?', choices: ['for', 'while', 'do...while', 'foreach'], answer: 2 },
    { question: 'Which package is imported automatically in every Java program?', choices: ['java.util', 'java.io', 'java.lang', 'java.net'], answer: 2 },
    { question: 'Which method compares string values correctly?', choices: ['==', 'equals()', 'compareTo() only', 'matches() only'], answer: 1 },
    { question: 'What is the default value of an int field?', choices: ['null', '0', '1', 'undefined'], answer: 1 },
    { question: 'Which keyword prevents method overriding?', choices: ['static', 'final', 'const', 'sealed'], answer: 1 },
    { question: 'Which interface supports dynamic-size lists?', choices: ['Set', 'Map', 'List', 'Queue'], answer: 2 },
    { question: 'Which class is commonly used for key-value pairs?', choices: ['ArrayList', 'HashMap', 'LinkedList', 'TreeSet'], answer: 1 },
    { question: 'Which exception is unchecked?', choices: ['IOException', 'SQLException', 'NullPointerException', 'ClassNotFoundException'], answer: 2 },
    { question: 'Which keyword handles exceptions?', choices: ['throw', 'catch', 'error', 'except'], answer: 1 },
    { question: 'Which block always runs after try/catch (normally)?', choices: ['end', 'cleanup', 'finally', 'last'], answer: 2 },
    { question: 'Which keyword refers to the current object?', choices: ['this', 'self', 'current', 'me'], answer: 0 },
    { question: 'Which keyword calls the parent class constructor?', choices: ['parent', 'base', 'super', 'this'], answer: 2 },
    { question: 'Which collection does NOT allow duplicates?', choices: ['List', 'Set', 'ArrayList', 'Vector'], answer: 1 },
    { question: 'Which type is used for decimal numbers (higher precision than float)?', choices: ['double', 'decimal', 'number', 'real'], answer: 0 },
    { question: 'Which operator checks equality of primitive values?', choices: ['=', '===', '==', 'equals'], answer: 2 },
    { question: 'Which keyword is used to define a constant variable?', choices: ['const', 'final', 'static', 'immutable'], answer: 1 },
    { question: 'Which JVM component turns bytecode into machine code at runtime?', choices: ['JRE', 'JIT compiler', 'JDK', 'javac'], answer: 1 },
    { question: 'Which tool compiles .java files to .class files?', choices: ['java', 'jar', 'javac', 'javadoc'], answer: 2 }
  ];
}

function selectQuizQuestionsByTopic(topic) {
  const topicQuestions = availableTopics.get(topic) || [];
  if (topic === 'Java') {
    const javaGuideQuestions = topicQuestions.length ? pickRandomItems(topicQuestions, Math.min(totalQuestions, topicQuestions.length)) : [];
    const supplementalQuestions = getJavaW3PracticeQuestions();
    const needed = Math.max(0, totalQuestions - javaGuideQuestions.length);
    selectedQuizQuestions = [...javaGuideQuestions, ...pickRandomItems(supplementalQuestions, needed)];
    return;
  }

  selectedQuizQuestions = pickRandomItems(topicQuestions, totalQuestions);
}


function populateQuizTopicDropdown(topicMap) {
  if (!quizTopicSelect) return;

  quizTopicSelect.innerHTML = '';
  const orderedTopics = [...topicMap.keys()];
  const javaIndex = orderedTopics.indexOf('Java');
  if (javaIndex > -1) {
    orderedTopics.splice(javaIndex, 1);
  }
  orderedTopics.unshift('Java');

  orderedTopics.forEach((topic) => {
    const option = document.createElement('option');
    option.value = topic;
    option.textContent = topic;
    quizTopicSelect.appendChild(option);
  });
}




function getJavaW3PracticeQuestions() {
  return [
    { question: 'Which keyword is used to define a class in Java?', choices: ['class', 'define', 'struct', 'object'], answer: 0 },
    { question: 'Which method is the entry point of a Java application?', choices: ['run()', 'main()', 'start()', 'init()'], answer: 1 },
    { question: 'Which primitive type stores true/false values?', choices: ['bool', 'boolean', 'bit', 'flag'], answer: 1 },
    { question: 'Which symbol ends a statement in Java?', choices: [':', '.', ';', ','], answer: 2 },
    { question: 'Which keyword is used to inherit a class?', choices: ['inherits', 'extends', 'implements', 'super'], answer: 1 },
    { question: 'Which access modifier makes a member visible only within its own class?', choices: ['public', 'protected', 'private', 'default'], answer: 2 },
    { question: 'Which keyword is used to create an object?', choices: ['make', 'new', 'create', 'object'], answer: 1 },
    { question: 'Which loop executes at least once?', choices: ['for', 'while', 'do...while', 'foreach'], answer: 2 },
    { question: 'Which package is imported automatically in every Java program?', choices: ['java.util', 'java.io', 'java.lang', 'java.net'], answer: 2 },
    { question: 'Which method compares string values correctly?', choices: ['==', 'equals()', 'compareTo() only', 'matches() only'], answer: 1 },
    { question: 'What is the default value of an int field?', choices: ['null', '0', '1', 'undefined'], answer: 1 },
    { question: 'Which keyword prevents method overriding?', choices: ['static', 'final', 'const', 'sealed'], answer: 1 },
    { question: 'Which interface supports dynamic-size lists?', choices: ['Set', 'Map', 'List', 'Queue'], answer: 2 },
    { question: 'Which class is commonly used for key-value pairs?', choices: ['ArrayList', 'HashMap', 'LinkedList', 'TreeSet'], answer: 1 },
    { question: 'Which exception is unchecked?', choices: ['IOException', 'SQLException', 'NullPointerException', 'ClassNotFoundException'], answer: 2 },
    { question: 'Which keyword handles exceptions?', choices: ['throw', 'catch', 'error', 'except'], answer: 1 },
    { question: 'Which block always runs after try/catch (normally)?', choices: ['end', 'cleanup', 'finally', 'last'], answer: 2 },
    { question: 'Which keyword refers to the current object?', choices: ['this', 'self', 'current', 'me'], answer: 0 },
    { question: 'Which keyword calls the parent class constructor?', choices: ['parent', 'base', 'super', 'this'], answer: 2 },
    { question: 'Which collection does NOT allow duplicates?', choices: ['List', 'Set', 'ArrayList', 'Vector'], answer: 1 },
    { question: 'Which type is used for decimal numbers (higher precision than float)?', choices: ['double', 'decimal', 'number', 'real'], answer: 0 },
    { question: 'Which operator checks equality of primitive values?', choices: ['=', '===', '==', 'equals'], answer: 2 },
    { question: 'Which keyword is used to define a constant variable?', choices: ['const', 'final', 'static', 'immutable'], answer: 1 },
    { question: 'Which JVM component turns bytecode into machine code at runtime?', choices: ['JRE', 'JIT compiler', 'JDK', 'javac'], answer: 1 },
    { question: 'Which tool compiles .java files to .class files?', choices: ['java', 'jar', 'javac', 'javadoc'], answer: 2 }
  ];
}

function selectQuizQuestionsByTopic(topic) {
  const topicQuestions = availableTopics.get(topic) || [];
  if (topic === 'Java') {
    const javaGuideQuestions = topicQuestions.length ? pickRandomItems(topicQuestions, Math.min(totalQuestions, topicQuestions.length)) : [];
    const supplementalQuestions = getJavaW3PracticeQuestions();
    const needed = Math.max(0, totalQuestions - javaGuideQuestions.length);
    selectedQuizQuestions = [...javaGuideQuestions, ...pickRandomItems(supplementalQuestions, needed)];
    return;
  }

  selectedQuizQuestions = pickRandomItems(topicQuestions, totalQuestions);
}

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

  const selectedTopic = quizTopicSelect?.value || 'Java';
  if (selectedTopic === 'Java') {
    const javaCount = (availableTopics.get('Java') || []).length;
    if (javaCount < totalQuestions) {
      alert(`Study guide has ${javaCount} Java question(s). Filling remaining ${totalQuestions - javaCount} with W3-style Java practice questions.`);
    }
  }

  selectQuizQuestionsByTopic(selectedTopic);

  if (!selectedQuizQuestions.length) {
    alert(`No questions are currently available for ${selectedTopic}. Please choose another topic.`);
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

  const isCorrect = Number(selected.value) === selectedQuizQuestions[currentIndex].answer;
  if (isCorrect) score += 1;

  currentIndex += 1;

  if (currentIndex >= Math.min(totalQuestions, selectedQuizQuestions.length)) {
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

  document.body.classList.add('quiz-active');
  startScreen.classList.add('hidden');
  quizScreen.classList.remove('hidden');

  enableCopyPasteBlocking();
  startTimer();
  renderQuestion();
}

function renderQuestion() {
  const total = Math.min(totalQuestions, selectedQuizQuestions.length);
  const currentQuestion = selectedQuizQuestions[currentIndex];

  progressDisplay.textContent = `Question ${currentIndex + 1} of ${total}`;

  questionText.textContent = '';
  if (currentQuestion.aiGenerated) {
    const badge = document.createElement('span');
    badge.className = 'ai-badge';
    badge.textContent = '✨ AI';
    questionText.appendChild(badge);
  }
  questionText.appendChild(document.createTextNode(currentQuestion.question));

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



function pickRandomItems(items, count) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function detectTopic(questionText = '') {
  const text = questionText.toLowerCase();
  const topicKeywords = [
    { topic: 'SDLC', patterns: ['sdlc', 'software development life cycle'] },
    { topic: 'STLC', patterns: ['stlc', 'software testing life cycle'] },
    { topic: 'Testing Types', patterns: ['unit test', 'integration test', 'system test', 'acceptance test', 'testing type'] },
    { topic: 'Agile & Scrum', patterns: ['agile', 'scrum', 'sprint', 'kanban'] },
    { topic: 'Requirements', patterns: ['requirement', 'functional', 'non-functional', 'srs'] },
    { topic: 'Design', patterns: ['design', 'architecture', 'uml', 'prototype'] },
    { topic: 'Deployment & DevOps', patterns: ['deployment', 'devops', 'ci/cd', 'jenkins', 'docker'] },
    { topic: 'Defects & Bug Tracking', patterns: ['defect', 'bug', 'severity', 'priority'] },
    { topic: 'Test Artifacts', patterns: ['test case', 'test plan', 'traceability', 'rtm'] },
    { topic: 'Java', patterns: ['java', 'jvm', 'jdk', 'jre', 'class', 'object', 'inheritance', 'polymorphism'] },
    { topic: 'Maintenance', patterns: ['maintenance', 'production support', 'patch'] }
  ];

  const found = topicKeywords.find(({ patterns }) => patterns.some((pattern) => text.includes(pattern)));
  return found ? found.topic : 'General Concepts';
}

function buildTopicMap() {
  const grouped = new Map();
  questions.forEach((question) => {
    const topic = detectTopic(question.question);
    if (!grouped.has(topic)) grouped.set(topic, []);
    grouped.get(topic).push(question);
  });

  const sortedEntries = [...grouped.entries()].sort((a, b) => b[1].length - a[1].length);
  const limitedEntries = sortedEntries.slice(0, MAX_FLASHCARD_TOPICS);
  if (!limitedEntries.some(([topic]) => topic === 'Java') && grouped.has('Java')) {
    limitedEntries.pop();
    limitedEntries.unshift(['Java', grouped.get('Java')]);
  }
  return new Map(limitedEntries);
}

function renderFlashcardTopic(topicMap, topic) {
  if (!flashcardList) return;

  flashcardList.querySelectorAll('details').forEach((item) => item.remove());

  const selectedTopic = topic && topicMap.has(topic) ? topic : topicMap.keys().next().value;
  const topicQuestions = topicMap.get(selectedTopic) || [];
  const selectedQuestions = pickRandomItems(topicQuestions, FLASHCARDS_PER_TOPIC);

  if (flashcardTopicCount) {
    flashcardTopicCount.textContent = `Showing ${selectedQuestions.length} flashcards from “${selectedTopic}”.`;
  }

  selectedQuestions.forEach((question, index) => {
    const details = document.createElement('details');
    details.className = 'flashcard-item';

    const summary = document.createElement('summary');
    if (question.aiGenerated) {
      const badge = document.createElement('span');
      badge.className = 'ai-badge';
      badge.textContent = '✨ AI';
      summary.appendChild(badge);
    }
    summary.appendChild(document.createTextNode(`${index + 1}. ${question.question}`));

    const answer = document.createElement('p');
    answer.className = 'flashcard-answer';
    answer.textContent = `Answer: ${question.choices[question.answer]}`;

    details.appendChild(summary);
    details.appendChild(answer);
    flashcardList.appendChild(details);
  });
}

function renderFlashcardList() {
  if (!flashcardList || !flashcardTopicSelect) return;

  const topicMap = buildTopicMap();
  availableTopics = topicMap;
  populateQuizTopicDropdown(topicMap);

  flashcardTopicSelect.innerHTML = '';
  [...topicMap.keys()].forEach((topic) => {
    const option = document.createElement('option');
    option.value = topic;
    option.textContent = topic;
    flashcardTopicSelect.appendChild(option);
  });

  flashcardTopicSelect.onchange = () => {
    renderFlashcardTopic(topicMap, flashcardTopicSelect.value);
  };

  renderFlashcardTopic(topicMap, flashcardTopicSelect.value);
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
  disableCopyPasteBlocking();
  document.body.classList.remove('quiz-active');
  quizScreen.classList.add('hidden');
  resultScreen.classList.remove('hidden');

  const total = Math.min(totalQuestions, selectedQuizQuestions.length);
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
  disableCopyPasteBlocking();
  document.body.classList.remove('quiz-active');
}
