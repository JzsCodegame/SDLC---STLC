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
const questionCode = document.getElementById('question-code');
const choicesForm = document.getElementById('choices');
const resultSummary = document.getElementById('result-summary');
const recentScoresContainer = document.getElementById('recent-scores');

const flashcardList = document.getElementById('flashcard-list');
const flashcardTopicSelect = document.getElementById('flashcard-topic');
const flashcardTopicCount = document.getElementById('flashcard-topic-count');
const flashcardCarousel = document.getElementById('flashcard-carousel');
const flashcardCard = document.getElementById('flashcard-card');
const flashcardPrevBtn = document.getElementById('flashcard-prev');
const flashcardNextBtn = document.getElementById('flashcard-next');
const flashcardPosition = document.getElementById('flashcard-position');
const quizTopicSelect = document.getElementById('quiz-topic');
const javaPracticeLab = document.getElementById('java-practice-lab');
const javaEditor = document.getElementById('java-editor');
const javaOutput = document.getElementById('java-output');
const javaResetBtn = document.getElementById('java-reset-btn');
const javaOutputBtn = document.getElementById('java-output-btn');

let questions = [];
let currentIndex = 0;
let score = 0;
let timer = null;
let timeRemaining = 300;
let studentName = '';
let selectedQuizQuestions = [];
let selectedQuizTopic = 'Java';
let availableTopics = new Map();
let currentFlashcardQuestions = [];
let currentFlashcardTopic = 'Java';
let currentFlashcardIndex = 0;
const totalQuestions = 25;
const DEFAULT_QUIZ_SECONDS = 300;
const JAVA_QUIZ_SECONDS = 600;
const SCORES_REFRESH_INTERVAL = 30000; // 30 seconds
const FIRESTORE_PROCESSING_DELAY = 1000; // 1 second
const MAX_FLASHCARD_TOPICS = 20;
const FLASHCARDS_PER_TOPIC = totalQuestions;
const TOPIC_DISPLAY_ORDER = [
  'Java',
  'SDLC',
  'STLC',
  'Git',
  'GitHub',
  'Jenkins',
  'Docker',
  'ServiceNow',
  'Testing Types',
  'Agile & Scrum',
  'Requirements',
  'Design',
  'Defects & Bug Tracking',
  'Test Artifacts',
  'Maintenance',
  'Deployment & DevOps',
  'General Concepts'
];
const GUARANTEED_TOPIC_FALLBACKS = ['Java', 'Git', 'GitHub', 'Jenkins', 'Docker', 'ServiceNow'];
const TOPIC_KEYWORDS = [
  { topic: 'ServiceNow', patterns: ['servicenow', 'service now', 'incident', 'change request', 'problem ticket', 'service catalog', 'catalog item', 'assignment group', 'sla', 'cmdb'] },
  { topic: 'GitHub', patterns: ['github', 'pull request', 'pr review', 'repository hosting', 'fork', 'github actions'] },
  { topic: 'Git', patterns: ['git ', 'git:', 'version control', 'commit', 'staging area', 'branch', 'merge', 'clone', 'checkout', 'git status', 'git add', 'git commit', 'git pull', 'git push'] },
  { topic: 'Jenkins', patterns: ['jenkins', 'build job', 'pipeline job', 'console log', 'workspace', 'build trigger', 'cron trigger', 'artifact archive'] },
  { topic: 'Docker', patterns: ['docker', 'container', 'image tag', 'dockerfile', 'port mapping', 'volume mount'] },
  { topic: 'SDLC', patterns: ['sdlc', 'software development life cycle'] },
  { topic: 'STLC', patterns: ['stlc', 'software testing life cycle'] },
  { topic: 'Testing Types', patterns: ['unit test', 'integration test', 'system test', 'acceptance test', 'testing type'] },
  { topic: 'Agile & Scrum', patterns: ['agile', 'scrum', 'sprint', 'kanban'] },
  { topic: 'Requirements', patterns: ['requirement', 'functional', 'non-functional', 'srs'] },
  { topic: 'Design', patterns: ['design', 'architecture', 'uml', 'prototype'] },
  { topic: 'Defects & Bug Tracking', patterns: ['defect', 'bug', 'severity', 'priority'] },
  { topic: 'Test Artifacts', patterns: ['test case', 'test plan', 'traceability', 'rtm'] },
  { topic: 'Java', patterns: ['java', 'jvm', 'jdk', 'jre', 'class', 'object', 'inheritance', 'polymorphism'] },
  { topic: 'Maintenance', patterns: ['maintenance', 'production support', 'patch'] },
  { topic: 'Deployment & DevOps', patterns: ['deployment', 'deploy', 'release', 'rollback', 'staging', 'production environment', 'devops', 'ci/cd'] }
];
const JAVA_LAB_SAMPLE = {
  code: [
    'class Main {',
    '  public static void main(String[] args) {',
    '    int score = 82;',
    '    String result = score >= 70 ? "pass" : "review";',
    '    System.out.println(result);',
    '  }',
    '}'
  ].join('\n'),
  output: 'pass'
};

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


function getBundledFallbackQuestions() {
  const javaQuestions = getJavaW3PracticeQuestions();
  return javaQuestions.slice(0, 25);
}

function renderEmptyFlashcardState(message) {
  if (!flashcardList) return;
  flashcardList.querySelectorAll('details').forEach((item) => item.remove());
  if (flashcardCard) flashcardCard.innerHTML = '';
  if (flashcardCarousel) flashcardCarousel.classList.add('hidden');
  if (flashcardPosition) flashcardPosition.textContent = '';
  if (flashcardPrevBtn) flashcardPrevBtn.disabled = true;
  if (flashcardNextBtn) flashcardNextBtn.disabled = true;
  if (flashcardTopicCount) flashcardTopicCount.textContent = message;
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
    questions = getBundledFallbackQuestions();
    renderFlashcardList();
  }

  if (!questions.length) {
    questions = getBundledFallbackQuestions();
    renderFlashcardList();
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
  if (javaIndex > -1) orderedTopics.splice(javaIndex, 1);
  if (topicMap.has('Java') || !orderedTopics.length) orderedTopics.unshift('Java');

  orderedTopics.forEach((topic) => {
    const option = document.createElement('option');
    option.value = topic;
    option.textContent = topic;
    quizTopicSelect.appendChild(option);
  });

  syncJavaPracticeLab();
}

function syncJavaPracticeLab() {
  if (!javaPracticeLab) return;

  const isJavaTopic = (quizTopicSelect?.value || 'Java') === 'Java';
  javaPracticeLab.classList.toggle('hidden', !isJavaTopic);

  if (isJavaTopic && javaEditor && !javaEditor.value.trim()) {
    javaEditor.value = JAVA_LAB_SAMPLE.code;
  }
}

function resetJavaPracticeLab() {
  if (!javaEditor || !javaOutput) return;
  javaEditor.value = JAVA_LAB_SAMPLE.code;
  javaOutput.textContent = '';
}

function showJavaPracticeOutput() {
  if (!javaOutput) return;
  javaOutput.textContent = JAVA_LAB_SAMPLE.output;
}

function syncFlashcardsToQuizTopic() {
  syncJavaPracticeLab();

  const selectedTopic = quizTopicSelect?.value;
  if (!selectedTopic || !flashcardTopicSelect || !availableTopics.has(selectedTopic)) return;

  flashcardTopicSelect.value = selectedTopic;
  renderFlashcardTopic(availableTopics, selectedTopic);
}

quizTopicSelect?.addEventListener('change', syncFlashcardsToQuizTopic);
javaResetBtn?.addEventListener('click', resetJavaPracticeLab);
javaOutputBtn?.addEventListener('click', showJavaPracticeOutput);



function getJavaW3PracticeQuestions() {
  return [
    {
      question: 'Java code output: what is printed?',
      code: [
        'class Main {',
        '  public static void main(String[] args) {',
        '    System.out.println("Hello Java");',
        '  }',
        '}'
      ].join('\n'),
      choices: ['Hello Java', 'Hello', 'Java', 'No output'],
      answer: 0
    },
    {
      question: 'Java code output: what value is printed?',
      code: [
        'class Main {',
        '  public static void main(String[] args) {',
        '    int total = 10 + 5;',
        '    System.out.println(total);',
        '  }',
        '}'
      ].join('\n'),
      choices: ['10', '15', '105', '5'],
      answer: 1
    },
    {
      question: 'Java code output: what is printed by the loop?',
      code: [
        'for (int i = 1; i <= 3; i++) {',
        '  System.out.print(i);',
        '}'
      ].join('\n'),
      choices: ['012', '123', '1234', '111'],
      answer: 1
    },
    {
      question: 'Java code output: which word is printed?',
      code: [
        'int age = 18;',
        'if (age >= 18) {',
        '  System.out.println("Adult");',
        '} else {',
        '  System.out.println("Minor");',
        '}'
      ].join('\n'),
      choices: ['Adult', 'Minor', '18', 'No output'],
      answer: 0
    },
    {
      question: 'Java code output: what does this String comparison print?',
      code: [
        'String a = "QA";',
        'String b = "QA";',
        'System.out.println(a.equals(b));'
      ].join('\n'),
      choices: ['true', 'false', 'QA', 'Compilation error'],
      answer: 0
    },
    {
      question: 'Java arrays: what is printed?',
      code: [
        'int[] numbers = {2, 4, 6};',
        'System.out.println(numbers.length);'
      ].join('\n'),
      choices: ['2', '3', '4', '6'],
      answer: 1
    },
    {
      question: 'Java methods: which result is printed?',
      code: [
        'static int add(int a, int b) {',
        '  return a + b;',
        '}',
        'System.out.println(add(2, 3));'
      ].join('\n'),
      choices: ['2', '3', '5', '23'],
      answer: 2
    },
    {
      question: 'Java OOP: what is printed because of method overriding?',
      code: [
        'class Animal { String sound() { return "sound"; } }',
        'class Dog extends Animal { String sound() { return "bark"; } }',
        'Animal pet = new Dog();',
        'System.out.println(pet.sound());'
      ].join('\n'),
      choices: ['sound', 'bark', 'Dog', 'Animal'],
      answer: 1
    },
    {
      question: 'Java constructors: what is printed?',
      code: [
        'class Car {',
        '  String model;',
        '  Car(String model) { this.model = model; }',
        '}',
        'Car car = new Car("Civic");',
        'System.out.println(car.model);'
      ].join('\n'),
      choices: ['Car', 'model', 'Civic', 'null'],
      answer: 2
    },
    {
      question: 'Java encapsulation: which value is printed through the getter?',
      code: [
        'class Counter {',
        '  private int value = 7;',
        '  int getValue() { return value; }',
        '}',
        'System.out.println(new Counter().getValue());'
      ].join('\n'),
      choices: ['0', '7', 'value', 'private'],
      answer: 1
    },
    {
      question: 'Java static members: what is printed?',
      code: [
        'class Visit { static int count = 0; }',
        'Visit.count++;',
        'Visit.count++;',
        'System.out.println(Visit.count);'
      ].join('\n'),
      choices: ['0', '1', '2', 'Compilation error'],
      answer: 2
    },
    {
      question: 'Java array update: what is printed after changing one element?',
      code: [
        'String[] names = {"Ana", "Bo"};',
        'names[1] = "Cam";',
        'System.out.println(names[1]);'
      ].join('\n'),
      choices: ['Ana', 'Bo', 'Cam', '2'],
      answer: 2
    },
    {
      question: 'Java method overloading: which result is printed?',
      code: [
        'class MathBox {',
        '  int add(int a, int b) { return a + b; }',
        '  int add(int a, int b, int c) { return a + b + c; }',
        '}',
        'System.out.println(new MathBox().add(1, 2, 3));'
      ].join('\n'),
      choices: ['3', '6', '123', 'Compilation error'],
      answer: 1
    },
    {
      question: 'Java object fields: what is printed after setting the field?',
      code: [
        'class Student {',
        '  String name;',
        '}',
        'Student student = new Student();',
        'student.name = "Mia";',
        'System.out.println(student.name);'
      ].join('\n'),
      choices: ['Student', 'name', 'Mia', 'null'],
      answer: 2
    },
    {
      question: 'Java setter method: what value is printed?',
      code: [
        'class Account {',
        '  private int balance;',
        '  void setBalance(int balance) {',
        '    this.balance = balance;',
        '  }',
        '  int getBalance() {',
        '    return balance;',
        '  }',
        '}',
        'Account account = new Account();',
        'account.setBalance(50);',
        'System.out.println(account.getBalance());'
      ].join('\n'),
      choices: ['0', '50', 'balance', 'Compilation error'],
      answer: 1
    },
    {
      question: 'Java do-while loop: what is printed?',
      code: [
        'int i = 5;',
        'do {',
        '  System.out.println(i);',
        '} while (i < 5);'
      ].join('\n'),
      choices: ['5', 'No output', '4', 'Compilation error'],
      answer: 0
    },
    {
      question: 'Java boolean logic: what does this print?',
      code: [
        'boolean ready = true;',
        'boolean blocked = true;',
        'System.out.println(ready && !blocked);'
      ].join('\n'),
      choices: ['true', 'false', 'ready', 'blocked'],
      answer: 1
    },
    {
      question: 'Java ternary operator: which word is printed?',
      code: [
        'int score = 82;',
        'String result = score >= 70 ? "pass" : "review";',
        'System.out.println(result);'
      ].join('\n'),
      choices: ['pass', 'review', '82', 'true'],
      answer: 0
    },
    {
      question: 'Java enhanced for loop: what sum is printed?',
      code: [
        'int sum = 0;',
        'for (int n : new int[] {1, 2, 3}) {',
        '  sum += n;',
        '}',
        'System.out.println(sum);'
      ].join('\n'),
      choices: ['3', '6', '123', '0'],
      answer: 1
    },
    {
      question: 'Java interface polymorphism: what is printed?',
      code: [
        'interface Alert { String send(); }',
        'class EmailAlert implements Alert {',
        '  public String send() { return "sent"; }',
        '}',
        'Alert alert = new EmailAlert();',
        'System.out.println(alert.send());'
      ].join('\n'),
      choices: ['Alert', 'EmailAlert', 'sent', 'send'],
      answer: 2
    },
    {
      question: 'Java abstract class: what is printed?',
      code: [
        'abstract class Shape { abstract String name(); }',
        'class Circle extends Shape { String name() { return "circle"; } }',
        'Shape shape = new Circle();',
        'System.out.println(shape.name());'
      ].join('\n'),
      choices: ['Shape', 'Circle', 'circle', 'abstract'],
      answer: 2
    },
    {
      question: 'Java field default values: what is printed for an int field?',
      code: [
        'class Score { int value; }',
        'Score score = new Score();',
        'System.out.println(score.value);'
      ].join('\n'),
      choices: ['0', 'null', 'undefined', 'Compilation error'],
      answer: 0
    },
    {
      question: 'Java this keyword: what is printed?',
      code: [
        'class Ticket {',
        '  int id;',
        '  Ticket(int id) { this.id = id; }',
        '}',
        'System.out.println(new Ticket(5).id);'
      ].join('\n'),
      choices: ['0', '5', 'id', 'this'],
      answer: 1
    },
    {
      question: 'Java break statement: what is printed?',
      code: [
        'for (int i = 0; i < 4; i++) {',
        '  if (i == 2) break;',
        '  System.out.print(i);',
        '}'
      ].join('\n'),
      choices: ['01', '012', '0123', '23'],
      answer: 0
    },
    {
      question: 'Java String concatenation: what is printed?',
      code: [
        'String topic = "Java";',
        'int level = 101;',
        'System.out.println(topic + level);'
      ].join('\n'),
      choices: ['Java101', 'Java 101', 'topic101', 'Compilation error'],
      answer: 0
    }
  ];
}

function getGeneralSoftwarePracticeQuestions() {
  return [
    { question: 'SDLC scenario: which phase defines project scope, schedule, and resources?', choices: ['Planning', 'Testing', 'Deployment', 'Maintenance'], answer: 0 },
    { question: 'SDLC scenario: which phase turns business needs into documented requirements?', choices: ['Design', 'Requirement Analysis', 'Implementation', 'Deployment'], answer: 1 },
    { question: 'SDLC scenario: which phase creates architecture, database, and UI plans before coding?', choices: ['Planning', 'Design', 'Testing', 'Maintenance'], answer: 1 },
    { question: 'SDLC scenario: which phase builds the actual application code?', choices: ['Implementation', 'Planning', 'Test Closure', 'Production Support'], answer: 0 },
    { question: 'SDLC scenario: which phase releases the tested application to users?', choices: ['Design', 'Deployment', 'Requirement Analysis', 'Unit Testing'], answer: 1 },
    { question: 'STLC scenario: which phase reviews requirements to identify what must be tested?', choices: ['Requirement Analysis', 'Test Closure', 'Deployment', 'Design'], answer: 0 },
    { question: 'STLC scenario: which phase defines test scope, resources, schedule, and risks?', choices: ['Test Planning', 'Implementation', 'Production Support', 'Coding'], answer: 0 },
    { question: 'STLC scenario: which phase writes detailed steps and expected results?', choices: ['Environment Setup', 'Test Case Development', 'Deployment', 'Maintenance'], answer: 1 },
    { question: 'STLC scenario: which phase runs test cases and logs defects?', choices: ['Test Execution', 'Design', 'Planning', 'Requirement Gathering'], answer: 0 },
    { question: 'STLC scenario: which phase summarizes results and lessons learned?', choices: ['Test Closure', 'Coding', 'Deployment', 'Backlog Grooming'], answer: 0 },
    { question: 'Git: which command shows changed files before a commit?', choices: ['git status', 'git clone', 'git init', 'git remote'], answer: 0 },
    { question: 'Git: which command stages a file for the next commit?', choices: ['git add', 'git push', 'git log', 'git branch'], answer: 0 },
    { question: 'Git: what does a branch let a team do?', choices: ['Work on changes separately', 'Delete the repository', 'Run a server', 'Create a Docker image'], answer: 0 },
    { question: 'Git: which command records staged changes in local history?', choices: ['git commit', 'git pull', 'git clone', 'git fetch'], answer: 0 },
    { question: 'Git: which command sends local commits to a remote repository?', choices: ['git push', 'git status', 'git add', 'git log'], answer: 0 },
    { question: 'GitHub: what is a pull request mainly used for?', choices: ['Review and discuss changes before merging', 'Start a local server', 'Create a test case', 'Install Docker'], answer: 0 },
    { question: 'GitHub: what does an issue usually track?', choices: ['A bug, task, or requested change', 'Only compiled code', 'Only a password', 'Only a server port'], answer: 0 },
    { question: 'GitHub: what is a fork?', choices: ['A personal copy of a repository', 'A failed build', 'A test report', 'A production release'], answer: 0 },
    { question: 'Jenkins: what does a build job usually do?', choices: ['Runs automated steps such as build, test, or deploy', 'Writes user stories only', 'Stores meeting notes only', 'Replaces Git'], answer: 0 },
    { question: 'Jenkins: where would you look first to debug a failed build?', choices: ['Console log', 'Product backlog', 'Class diagram', 'RTM only'], answer: 0 },
    { question: 'Jenkins: what does a scheduled trigger do?', choices: ['Starts a job automatically at configured times', 'Deletes source code', 'Creates a Java class', 'Changes a bug severity'], answer: 0 },
    { question: 'Docker: what is a container?', choices: ['A runnable package of an app and its environment', 'A Git branch', 'A Jira ticket', 'A test case'], answer: 0 },
    { question: 'Docker: what does a Dockerfile describe?', choices: ['Steps to build an image', 'Steps to write a user story', 'Steps to assign severity', 'Steps to create an RTM'], answer: 0 },
    { question: 'Docker: why is port mapping used?', choices: ['To expose a container port on the host', 'To rename a branch', 'To close a defect', 'To write a constructor'], answer: 0 },
    { question: 'ServiceNow: what is an incident usually used for?', choices: ['Restoring service after something is broken', 'Writing Java code', 'Creating a Docker image', 'Merging a branch'], answer: 0 },
    { question: 'ServiceNow: what does a change request control?', choices: ['Planned changes to a service or system', 'Only local Git commits', 'Only quiz scores', 'Only CSS colors'], answer: 0 },
    { question: 'ServiceNow: why is an assignment group useful?', choices: ['It routes work to the right support team', 'It runs unit tests', 'It builds a Docker image', 'It changes Java output'], answer: 0 },
    { question: 'ServiceNow: what does an SLA measure?', choices: ['Expected response or resolution time', 'Number of Git branches', 'Docker image size only', 'Java class count only'], answer: 0 },
    { question: 'Deployment & DevOps: what is a production deployment?', choices: ['Releasing tested software to users', 'Writing a class diagram', 'Renaming a meeting note', 'Changing a logo color'], answer: 0 },
    { question: 'Deployment & DevOps: why is rollback planning useful?', choices: ['It gives a way to recover if a release has problems', 'It replaces all testing', 'It deletes the backlog', 'It removes the need for approvals'], answer: 0 },
    { question: 'Deployment & DevOps: what is a staging environment used for?', choices: ['Testing a release in a production-like place', 'Writing lesson notes only', 'Choosing a font family', 'Drawing a class mascot'], answer: 0 },
    { question: 'Testing Types: which testing checks that recent changes did not break existing behavior?', choices: ['Regression testing', 'Smoke testing', 'Load testing', 'Usability testing'], answer: 0 },
    { question: 'Testing Types: which testing quickly verifies that a build is stable enough for deeper QA?', choices: ['Smoke testing', 'Acceptance testing', 'Security testing', 'Localization testing'], answer: 0 },
    { question: 'Testing Types: which testing validates a small bug fix or narrow feature change?', choices: ['Sanity testing', 'Performance testing', 'Compatibility testing', 'Exploratory testing'], answer: 0 },
    { question: 'Testing Types: which testing checks multiple modules working together?', choices: ['Integration testing', 'Unit testing', 'Static testing', 'Alpha testing'], answer: 0 },
    { question: 'Testing Types: which testing confirms the full product works end to end?', choices: ['System testing', 'Unit testing', 'Code review', 'Branch testing'], answer: 0 },
    { question: 'Agile & Scrum: which event plans the work selected for the next Sprint?', choices: ['Sprint Planning', 'Daily Scrum', 'Sprint Review', 'Retrospective'], answer: 0 },
    { question: 'Agile & Scrum: which event inspects progress and blockers each day?', choices: ['Daily Scrum', 'Sprint Review', 'Release Planning', 'Backlog Freeze'], answer: 0 },
    { question: 'Agile & Scrum: which role owns product priority and the backlog?', choices: ['Product Owner', 'Scrum Master', 'QA Lead', 'Release Manager'], answer: 0 },
    { question: 'Agile & Scrum: which role facilitates Scrum and removes blockers?', choices: ['Scrum Master', 'Product Owner', 'Database Admin', 'Business Sponsor'], answer: 0 },
    { question: 'Agile & Scrum: which artifact lists ordered work for the product?', choices: ['Product Backlog', 'Test Summary Report', 'RTM', 'Deployment Script'], answer: 0 },
    { question: 'Requirements: which statement describes a functional requirement?', choices: ['What the system must do', 'How fast the page must load', 'Which server hosts the app', 'How the sprint is scheduled'], answer: 0 },
    { question: 'Requirements: which statement describes a non-functional requirement?', choices: ['The app must support 500 users at once', 'The user can reset a password', 'The admin can add products', 'The form saves an address'], answer: 0 },
    { question: 'Defects & Bug Tracking: what does severity describe?', choices: ['Impact of the defect', 'Order of fixing work', 'Developer seniority', 'Sprint length'], answer: 0 },
    { question: 'Defects & Bug Tracking: what does priority describe?', choices: ['Urgency of fixing the defect', 'How many testers found it', 'How old the ticket is', 'Which browser was used'], answer: 0 },
    { question: 'Test Artifacts: what does an RTM connect?', choices: ['Requirements to test cases', 'Developers to branches', 'Users to roles', 'Servers to ports'], answer: 0 }
  ];
}

function getTopicPracticeQuestions(topic) {
  if (topic === 'Java') return getJavaW3PracticeQuestions();

  const generalPractice = getGeneralSoftwarePracticeQuestions();
  const matchingTopicPractice = generalPractice.filter((question) => detectTopic(question.question) === topic);
  return matchingTopicPractice.length ? matchingTopicPractice : generalPractice;
}

function javaQuestionText(question) {
  return [
    question.question,
    question.code,
    ...(Array.isArray(question.choices) ? question.choices : [])
  ].join(' ').toLowerCase();
}

function isBeginnerJavaQuestion(question) {
  const text = javaQuestionText(question);
  const advancedPatterns = [
    'arraylist', 'hashmap', 'linkedlist', 'collection', 'collections', ' map<', ' list<', ' set<',
    'exception', 'try', 'catch', 'finally', 'throw', 'throws',
    'jvm', 'jdk', 'jre', 'thread', 'synchronized', 'volatile',
    'stream', 'lambda', 'generic', 'annotation', 'reflection',
    'file', 'jdbc', 'database', 'selenium', 'framework'
  ];
  const beginnerPatterns = [
    'java', 'class', 'object', 'constructor', 'method', 'field', 'this',
    'extends', 'implements', 'interface', 'abstract', 'inheritance', 'polymorphism',
    'encapsulation', 'overriding', 'overloading', 'private', 'public', 'static',
    'loop', 'for (', 'while', 'break', 'array', '[]', 'string', 'equals',
    'if', 'else', 'boolean', 'int ', 'variable', 'return', 'print', 'output'
  ];

  return beginnerPatterns.some((pattern) => text.includes(pattern))
    && !advancedPatterns.some((pattern) => text.includes(pattern));
}

function filterTopicQuestions(topic, candidateQuestions) {
  if (topic !== 'Java') return candidateQuestions;
  return candidateQuestions.filter(isBeginnerJavaQuestion);
}

function questionIdentity(question) {
  const code = question.code ? ` ${question.code}` : '';
  return `${question.question || ''}${code}`.toLowerCase().replace(/\s+/g, ' ').trim();
}

function addUniqueQuestions(target, seen, candidates, maxCount) {
  candidates.forEach((question) => {
    if (target.length >= maxCount) return;
    const key = questionIdentity(question);
    if (!key || seen.has(key)) return;
    seen.add(key);
    target.push(question);
  });
}

function completeQuestionSet(topic, topicQuestions, count = totalQuestions) {
  const completed = [];
  const seen = new Set();
  const filteredTopicQuestions = filterTopicQuestions(topic, topicQuestions);
  const sameTopicQuestions = filterTopicQuestions(
    topic,
    questions.filter((question) => detectTopic(question.question) === topic)
  );
  const topicPracticeQuestions = filterTopicQuestions(topic, getTopicPracticeQuestions(topic));
  const broadPractice = topic === 'Java'
    ? getJavaW3PracticeQuestions()
    : [...getTopicPracticeQuestions(topic), ...getGeneralSoftwarePracticeQuestions()];

  addUniqueQuestions(completed, seen, pickRandomItems(filteredTopicQuestions, count), count);
  addUniqueQuestions(completed, seen, pickRandomItems(sameTopicQuestions, count), count);
  addUniqueQuestions(completed, seen, pickRandomItems(topicPracticeQuestions, count), count);
  addUniqueQuestions(completed, seen, pickRandomItems(broadPractice, count), count);

  while (completed.length < count && broadPractice.length) {
    const fallback = broadPractice[completed.length % broadPractice.length];
    completed.push({
      ...fallback,
      question: `${fallback.question} (practice review ${completed.length + 1})`
    });
  }

  return completed.slice(0, count);
}

function getQuestionDisplayParts(question) {
  let prompt = String(question.question || '').trim();
  let code = String(question.code || '').trim();
  const codeFenceMatch = prompt.match(/```(?:java)?\s*([\s\S]*?)```/i);

  if (!code && codeFenceMatch) {
    code = codeFenceMatch[1].trim();
  }

  if (codeFenceMatch) {
    prompt = prompt.replace(codeFenceMatch[0], '').replace(/\s+/g, ' ').trim();
  }

  return { prompt, code };
}

function getCorrectChoice(question) {
  const answerIndex = Number(question.answer);
  if (!Array.isArray(question.choices) || !Number.isInteger(answerIndex)) return '';
  return String(question.choices[answerIndex] || '').trim();
}

function buildFlashcardExplanation(question, topic) {
  const answer = getCorrectChoice(question);
  const display = getQuestionDisplayParts(question);
  const prompt = `${display.prompt || question.question || ''} ${display.code || ''}`.toLowerCase();
  const detectedTopic = topic || detectTopic(question.question);

  if (!answer) {
    return 'High-level: review the question, identify the main concept, and connect it to the best matching choice.';
  }

  if (detectedTopic === 'Java') {
    if (display.code || /print|output|value/.test(prompt)) {
      return `High-level: trace the Java code step by step; the value or output resolves to "${answer}".`;
    }
    if (/oop|object|class|inheritance|polymorphism|encapsulation|method|constructor/.test(prompt)) {
      return `High-level: this is checking the Java OOP idea connected to "${answer}".`;
    }
    return `High-level: remember the Java concept represented by "${answer}" and match it to the code or wording.`;
  }

  if (/sdlc|stlc|phase|life cycle/.test(prompt)) {
    return `High-level: "${answer}" is the lifecycle step that best fits the scenario in the question.`;
  }
  if (/agile|scrum|sprint|backlog|product owner|scrum master/.test(prompt)) {
    return `High-level: "${answer}" is the Agile or Scrum role, event, or artifact the question is describing.`;
  }
  if (/defect|bug|severity|priority/.test(prompt)) {
    return `High-level: "${answer}" is the bug-tracking concept that explains impact, urgency, or defect handling.`;
  }
  if (/requirement|functional|non-functional|srs/.test(prompt)) {
    return `High-level: "${answer}" identifies the requirement type or requirement document idea being tested.`;
  }
  if (/test|testing|rtm|traceability|smoke|sanity|regression/.test(prompt)) {
    return `High-level: "${answer}" is the testing term that matches the purpose or activity in the question.`;
  }

  return `High-level: focus on "${answer}" as the core concept and connect the question wording back to it.`;
}

function getPreparedTopicQuestions(topic) {
  const topicQuestions = availableTopics.get(topic) || [];
  if (topicQuestions.length >= FLASHCARDS_PER_TOPIC) {
    return topicQuestions.slice(0, FLASHCARDS_PER_TOPIC);
  }

  return completeQuestionSet(topic, topicQuestions, FLASHCARDS_PER_TOPIC);
}

function selectQuizQuestionsByTopic(topic) {
  selectedQuizTopic = topic || 'Java';
  selectedQuizQuestions = getPreparedTopicQuestions(topic);
}

function getQuizDurationSeconds(topic = selectedQuizTopic) {
  return topic === 'Java' ? JAVA_QUIZ_SECONDS : DEFAULT_QUIZ_SECONDS;
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
  selectQuizQuestionsByTopic(selectedTopic);

  if (selectedQuizQuestions.length !== totalQuestions) {
    alert(`Could not prepare ${totalQuestions} questions for ${selectedTopic}. Please choose another topic.`);
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
  const display = getQuestionDisplayParts(currentQuestion);

  progressDisplay.textContent = `Question ${currentIndex + 1} of ${total}`;

  questionText.textContent = '';
  if (currentQuestion.aiGenerated) {
    const badge = document.createElement('span');
    badge.className = 'ai-badge';
    badge.textContent = '✨ AI';
    questionText.appendChild(badge);
  }
  questionText.appendChild(document.createTextNode(display.prompt || currentQuestion.question));

  if (questionCode) {
    questionCode.textContent = '';
    questionCode.classList.add('hidden');
    if (display.code) {
      questionCode.textContent = display.code;
      questionCode.classList.remove('hidden');
    }
  }

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
  const explicitTopic = TOPIC_DISPLAY_ORDER.find((topic) =>
    text === topic.toLowerCase()
      || text.startsWith(`${topic.toLowerCase()}:`)
      || text.startsWith(`${topic.toLowerCase()} `)
  );
  if (explicitTopic) return explicitTopic;

  const found = TOPIC_KEYWORDS.find(({ patterns }) => patterns.some((pattern) => text.includes(pattern)));
  return found ? found.topic : 'General Concepts';
}


function ensureJavaTopic(topicMap) {
  const normalized = new Map(topicMap);
  GUARANTEED_TOPIC_FALLBACKS.forEach((topic) => {
    if (!normalized.has(topic)) {
      normalized.set(topic, getTopicPracticeQuestions(topic));
    }
  });

  [...normalized.keys()].forEach((topic) => {
    normalized.set(topic, completeQuestionSet(topic, normalized.get(topic) || [], totalQuestions));
  });

  return normalized;
}

function buildTopicMap() {
  const grouped = new Map();
  questions.forEach((question) => {
    const topic = detectTopic(question.question);
    if (!grouped.has(topic)) grouped.set(topic, []);
    grouped.get(topic).push(question);
  });

  const sortedEntries = [...grouped.entries()].sort((a, b) => {
    const countDifference = b[1].length - a[1].length;
    if (countDifference) return countDifference;
    const aIndex = TOPIC_DISPLAY_ORDER.indexOf(a[0]);
    const bIndex = TOPIC_DISPLAY_ORDER.indexOf(b[0]);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });
  const limitedEntries = sortedEntries.slice(0, MAX_FLASHCARD_TOPICS);
  return ensureJavaTopic(new Map(limitedEntries));
}

function renderFlashcardTopic(topicMap, topic) {
  if (!flashcardList) return;

  flashcardList.querySelectorAll('details').forEach((item) => item.remove());

  const selectedTopic = topic && topicMap.has(topic) ? topic : topicMap.keys().next().value;
  const selectedQuestions = getPreparedTopicQuestions(selectedTopic);
  currentFlashcardTopic = selectedTopic;
  currentFlashcardQuestions = selectedQuestions;
  currentFlashcardIndex = 0;

  if (flashcardTopicCount) {
    flashcardTopicCount.textContent = `Showing ${selectedQuestions.length} prep flashcards for "${selectedTopic}". These match the quiz questions currently loaded.`;
  }

  renderCurrentFlashcard();
}

function renderCurrentFlashcard() {
  if (!flashcardCard) return;

  flashcardCard.innerHTML = '';
  const total = currentFlashcardQuestions.length;

  if (!total) {
    if (flashcardCarousel) flashcardCarousel.classList.add('hidden');
    if (flashcardPosition) flashcardPosition.textContent = '';
    if (flashcardPrevBtn) flashcardPrevBtn.disabled = true;
    if (flashcardNextBtn) flashcardNextBtn.disabled = true;
    return;
  }

  if (flashcardCarousel) flashcardCarousel.classList.remove('hidden');
  currentFlashcardIndex = Math.max(0, Math.min(currentFlashcardIndex, total - 1));

  const question = currentFlashcardQuestions[currentFlashcardIndex];
  const display = getQuestionDisplayParts(question);
  const correctChoice = getCorrectChoice(question);

  const heading = document.createElement('h4');
  heading.className = 'flashcard-question';
  if (question.aiGenerated) {
    const badge = document.createElement('span');
    badge.className = 'ai-badge';
    badge.textContent = '✨ AI';
    heading.appendChild(badge);
  }
  heading.appendChild(document.createTextNode(`${currentFlashcardIndex + 1}. ${display.prompt || question.question}`));

  const answer = document.createElement('div');
  answer.className = 'flashcard-answer';

  const answerLine = document.createElement('p');
  answerLine.className = 'flashcard-answer-line';
  answerLine.textContent = `Answer: ${correctChoice || 'Review this concept'}`;

  const explanation = document.createElement('p');
  explanation.className = 'flashcard-overview';
  explanation.textContent = buildFlashcardExplanation(question, currentFlashcardTopic);

  flashcardCard.appendChild(heading);
  if (display.code) {
    const code = document.createElement('pre');
    code.className = 'flashcard-code';
    code.textContent = display.code;
    flashcardCard.appendChild(code);
  }
  answer.appendChild(answerLine);
  answer.appendChild(explanation);
  flashcardCard.appendChild(answer);

  if (flashcardPosition) {
    flashcardPosition.textContent = `Card ${currentFlashcardIndex + 1} of ${total}`;
  }
  if (flashcardPrevBtn) flashcardPrevBtn.disabled = total <= 1;
  if (flashcardNextBtn) flashcardNextBtn.disabled = total <= 1;
}

function moveFlashcard(direction) {
  if (!currentFlashcardQuestions.length) return;
  const total = currentFlashcardQuestions.length;
  currentFlashcardIndex = (currentFlashcardIndex + direction + total) % total;
  renderCurrentFlashcard();
}

function renderFlashcardList() {
  if (!flashcardList || !flashcardTopicSelect) return;

  const topicMap = ensureJavaTopic(buildTopicMap());

  if (!topicMap.size) {
    availableTopics = new Map([['Java', getJavaW3PracticeQuestions()]]);
    populateQuizTopicDropdown(availableTopics);
    if (flashcardTopicSelect) flashcardTopicSelect.innerHTML = '<option value="Java">Java</option>';
    renderEmptyFlashcardState('No study-guide questions loaded. Showing Java practice fallback.');
    return;
  }

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
    const selectedTopic = flashcardTopicSelect.value;
    if (quizTopicSelect && [...quizTopicSelect.options].some((option) => option.value === selectedTopic)) {
      quizTopicSelect.value = selectedTopic;
      syncJavaPracticeLab();
    }
    renderFlashcardTopic(topicMap, selectedTopic);
  };

  const selectedTopic = quizTopicSelect?.value || flashcardTopicSelect.value;
  if (selectedTopic && topicMap.has(selectedTopic)) {
    flashcardTopicSelect.value = selectedTopic;
  }

  renderFlashcardTopic(topicMap, flashcardTopicSelect.value);
}

flashcardPrevBtn?.addEventListener('click', () => moveFlashcard(-1));
flashcardNextBtn?.addEventListener('click', () => moveFlashcard(1));


function startTimer() {
  timeRemaining = getQuizDurationSeconds();
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
  timeRemaining = getQuizDurationSeconds();
  disableCopyPasteBlocking();
  document.body.classList.remove('quiz-active');
}
