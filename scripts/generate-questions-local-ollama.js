#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const crypto = require('crypto');

const DEFAULT_STUDY_GUIDE_URL = 'https://docs.google.com/document/d/1RzyuPH6ryIVD6z5iRuyJxmUa6jGLJE_wAB5R4S4mUWA/edit?tab=t.0#heading=h.fmjzqinx4dso';
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3:8b';
const QUESTIONS_FILE = process.env.OUTPUT_FILE || 'questions.json';
const HASH_FILE = process.env.STUDY_GUIDE_HASH_FILE || '.study-guide.sha256';
const UNSTABLE_MARKER_FILE = process.env.UNSTABLE_MARKER_FILE || '.question-generation-unstable';
const QUESTION_COUNT = Number(process.env.QUESTION_COUNT || 25);
const MIN_QUESTIONS_PER_TOPIC = Number(process.env.MIN_QUESTIONS_PER_TOPIC || 25);
const STUDY_GUIDE_URL = process.env.STUDY_GUIDE_URL || process.env.SOURCE_DOCUMENT_URL || DEFAULT_STUDY_GUIDE_URL;
const STUDY_GUIDE_FILE = process.env.STUDY_GUIDE_FILE || '';
const STUDY_GUIDE_TEXT = process.env.STUDY_GUIDE_TEXT || '';
const QUIZ_VARIANT_SEED = process.env.QUIZ_VARIANT_SEED || new Date().toISOString().slice(0, 13);
const MAX_STUDY_GUIDE_CHARS = Number(process.env.MAX_STUDY_GUIDE_CHARS || 60000);
let ollamaUsed = false;

const TOPIC_KEYWORDS = [
  { topic: 'SDLC', patterns: ['sdlc', 'software development life cycle'] },
  { topic: 'STLC', patterns: ['stlc', 'software testing life cycle'] },
  { topic: 'Testing Types', patterns: ['unit test', 'integration test', 'system test', 'acceptance test', 'testing type'] },
  { topic: 'Agile & Scrum', patterns: ['agile', 'scrum', 'sprint', 'kanban'] },
  { topic: 'Requirements', patterns: ['requirement', 'functional', 'non-functional', 'srs'] },
  { topic: 'Design', patterns: ['design', 'architecture', 'uml', 'prototype'] },
  { topic: 'Deployment & DevOps', patterns: ['deployment', 'devops', 'ci/cd', 'jenkins', 'docker'] },
  { topic: 'Defects & Bug Tracking', patterns: ['defect', 'bug', 'severity', 'priority'] },
  { topic: 'Test Artifacts', patterns: ['test case', 'test plan', 'traceability', 'rtm'] },
  { topic: 'Java', patterns: ['java', 'class', 'object', 'inheritance', 'polymorphism', 'encapsulation'] },
  { topic: 'Maintenance', patterns: ['maintenance', 'production support', 'patch'] }
];

const REQUIRED_TOPICS = [
  'Java',
  'SDLC',
  'STLC',
  'Testing Types',
  'Agile & Scrum',
  'Requirements',
  'Design',
  'Deployment & DevOps',
  'Defects & Bug Tracking',
  'Test Artifacts',
  'Maintenance',
  'General Concepts'
];

const JAVA_BLOCKED_TERMS = [
  'arraylist', 'hashmap', 'linkedlist', 'collection', 'collections', ' map<', ' list<', ' set<',
  'exception', 'try', 'catch', 'finally', 'throw', 'throws',
  'jvm', 'jdk', 'jre', 'thread', 'synchronized', 'volatile',
  'stream', 'lambda', 'generic', 'annotation', 'reflection',
  'file', 'jdbc', 'database', 'selenium', 'framework'
];

const JAVA_ALLOWED_TERMS = [
  'java', 'class', 'object', 'constructor', 'method', 'field', 'this',
  'extends', 'implements', 'interface', 'abstract', 'inheritance', 'polymorphism',
  'encapsulation', 'overriding', 'overloading', 'private', 'public', 'static',
  'loop', 'for (', 'while', 'break', 'array', '[]', 'string', 'equals',
  'if', 'else', 'boolean', 'int ', 'variable', 'return', 'print', 'output'
];

const TOPIC_GUIDANCE = {
  Java: 'Beginner Java OOP plus core basics only: classes, objects, constructors, methods, fields, this, encapsulation, inheritance, polymorphism, abstraction, interfaces, loops, arrays, strings, conditionals, variables, boolean logic, and simple output. Do not use blocked advanced Java topics.',
  SDLC: 'Software Development Life Cycle phases, order, purpose, artifacts, and beginner scenarios.',
  STLC: 'Software Testing Life Cycle phases, test planning, test cases, execution, closure, entry and exit criteria.',
  'Testing Types': 'Unit, integration, system, acceptance, functional, non-functional, smoke, sanity, regression, exploratory, performance, security testing.',
  'Agile & Scrum': 'Agile values, Scrum roles, Sprint events, Product Backlog, Sprint Backlog, Increment, Kanban, story points.',
  Requirements: 'Functional and non-functional requirements, SRS, user stories, use cases, acceptance criteria.',
  Design: 'UML, architecture, high-level design, low-level design, prototypes, simple design patterns.',
  'Deployment & DevOps': 'Deployment, DevOps, CI/CD, Jenkins, Docker, release strategies, infrastructure basics.',
  'Defects & Bug Tracking': 'Defect lifecycle, severity, priority, bug reports, reproduction steps, expected vs actual results.',
  'Test Artifacts': 'Test plans, test cases, RTM, traceability, test data, test summary reports.',
  Maintenance: 'Corrective, adaptive, perfective, preventive maintenance, production support, patches, change management.',
  'General Concepts': 'Beginner software engineering and QA concepts that do not fit a more specific topic.'
};

const FALLBACK_BANKS = {
  Java: [
    q('Java class and object: what is printed?', ['class Student { String name = "Mia"; }', 'Student s = new Student();', 'System.out.println(s.name);'], ['Student', 'name', 'Mia', 'null'], 2),
    q('Java constructor: what value is printed?', ['class Car {', '  String model;', '  Car(String model) { this.model = model; }', '}', 'System.out.println(new Car("Civic").model);'], ['Car', 'model', 'Civic', 'null'], 2),
    q('Java encapsulation: what does the getter return?', ['class Counter {', '  private int value = 7;', '  int getValue() { return value; }', '}', 'System.out.println(new Counter().getValue());'], ['0', '7', 'value', 'private'], 1),
    q('Java inheritance: which method is used?', ['class Animal { String sound() { return "sound"; } }', 'class Dog extends Animal { String sound() { return "bark"; } }', 'Animal pet = new Dog();', 'System.out.println(pet.sound());'], ['sound', 'bark', 'Dog', 'Animal'], 1),
    q('Java method overloading: what is printed?', ['class MathBox {', '  int add(int a, int b) { return a + b; }', '  int add(int a, int b, int c) { return a + b + c; }', '}', 'System.out.println(new MathBox().add(1, 2, 3));'], ['3', '6', '123', 'Compilation error'], 1),
    q('Java this keyword: what is printed?', ['class Ticket {', '  int id;', '  Ticket(int id) { this.id = id; }', '}', 'System.out.println(new Ticket(5).id);'], ['0', '5', 'id', 'this'], 1),
    q('Java interface polymorphism: what is printed?', ['interface Alert { String send(); }', 'class EmailAlert implements Alert { public String send() { return "sent"; } }', 'Alert alert = new EmailAlert();', 'System.out.println(alert.send());'], ['Alert', 'EmailAlert', 'sent', 'send'], 2),
    q('Java abstract class: what is printed?', ['abstract class Shape { abstract String name(); }', 'class Circle extends Shape { String name() { return "circle"; } }', 'Shape shape = new Circle();', 'System.out.println(shape.name());'], ['Shape', 'Circle', 'circle', 'abstract'], 2),
    q('Java loop: what is printed?', ['for (int i = 1; i <= 3; i++) {', '  System.out.print(i);', '}'], ['012', '123', '1234', '111'], 1),
    q('Java array length: what is printed?', ['int[] numbers = {2, 4, 6};', 'System.out.println(numbers.length);'], ['2', '3', '4', '6'], 1),
    q('Java array update: what is printed?', ['String[] names = {"Ana", "Bo"};', 'names[1] = "Cam";', 'System.out.println(names[1]);'], ['Ana', 'Bo', 'Cam', '2'], 2),
    q('Java String equality: what is printed?', ['String a = "QA";', 'String b = "QA";', 'System.out.println(a.equals(b));'], ['true', 'false', 'QA', 'Compilation error'], 0),
    q('Java if statement: which word is printed?', ['int age = 18;', 'if (age >= 18) { System.out.println("Adult"); } else { System.out.println("Minor"); }'], ['Adult', 'Minor', '18', 'No output'], 0),
    q('Java boolean logic: what is printed?', ['boolean ready = true;', 'boolean blocked = true;', 'System.out.println(ready && !blocked);'], ['true', 'false', 'ready', 'blocked'], 1),
    q('Java static field: what is printed?', ['class Visit { static int count = 0; }', 'Visit.count++;', 'Visit.count++;', 'System.out.println(Visit.count);'], ['0', '1', '2', 'Compilation error'], 2)
  ],
  SDLC: [
    basic('SDLC scenario: which phase defines scope, schedule, and resources?', ['Planning', 'Testing', 'Deployment', 'Maintenance'], 0),
    basic('SDLC scenario: which phase documents business needs?', ['Design', 'Requirement Analysis', 'Implementation', 'Deployment'], 1),
    basic('SDLC scenario: which phase creates architecture and UI plans?', ['Planning', 'Design', 'Testing', 'Maintenance'], 1)
  ],
  STLC: [
    basic('STLC scenario: which phase reviews requirements for testability?', ['Requirement Analysis', 'Test Closure', 'Deployment', 'Design'], 0),
    basic('STLC scenario: which phase defines scope, resources, schedule, and risks?', ['Test Planning', 'Implementation', 'Production Support', 'Coding'], 0),
    basic('STLC scenario: which phase runs test cases and logs defects?', ['Test Execution', 'Design', 'Planning', 'Requirement Gathering'], 0)
  ],
  'Testing Types': [
    basic('Testing Types: which testing checks that new changes did not break existing features?', ['Regression testing', 'Smoke testing', 'Load testing', 'Usability testing'], 0),
    basic('Testing Types: which testing quickly checks whether a build is stable?', ['Smoke testing', 'Acceptance testing', 'Security testing', 'Localization testing'], 0),
    basic('Testing Types: which testing checks modules working together?', ['Integration testing', 'Unit testing', 'Static testing', 'Alpha testing'], 0)
  ],
  'Agile & Scrum': [
    basic('Agile & Scrum: which event plans the work for the next Sprint?', ['Sprint Planning', 'Daily Scrum', 'Sprint Review', 'Retrospective'], 0),
    basic('Agile & Scrum: which role owns product priority?', ['Product Owner', 'Scrum Master', 'QA Lead', 'Release Manager'], 0),
    basic('Agile & Scrum: which artifact lists ordered product work?', ['Product Backlog', 'RTM', 'Test Plan', 'Deployment Script'], 0)
  ],
  Requirements: [
    basic('Requirements: which statement describes a functional requirement?', ['What the system must do', 'How fast the page must load', 'Which server hosts the app', 'How the sprint is scheduled'], 0),
    basic('Requirements: which statement describes a non-functional requirement?', ['The app must support 500 users at once', 'The user can reset a password', 'The admin can add products', 'The form saves an address'], 0)
  ],
  Design: [
    basic('Design: which diagram can show classes and relationships?', ['UML class diagram', 'Bug report', 'Daily Scrum note', 'Build log'], 0),
    basic('Design: which design level describes detailed module logic?', ['Low-level design', 'Sprint review', 'Smoke testing', 'Bug triage'], 0)
  ],
  'Deployment & DevOps': [
    basic('Deployment & DevOps: which tool can run an automated CI/CD pipeline?', ['Jenkins', 'RTM', 'Use case', 'Severity'], 0),
    basic('Deployment & DevOps: what does Docker package with an app?', ['Runtime dependencies', 'User stories only', 'Bug priority only', 'Manual test steps only'], 0)
  ],
  'Defects & Bug Tracking': [
    basic('Defects & Bug Tracking: what does severity describe?', ['Impact of the defect', 'Order of fixing work', 'Developer seniority', 'Sprint length'], 0),
    basic('Defects & Bug Tracking: what does priority describe?', ['Urgency of fixing the defect', 'How many testers found it', 'How old the ticket is', 'Which browser was used'], 0)
  ],
  'Test Artifacts': [
    basic('Test Artifacts: what does an RTM connect?', ['Requirements to test cases', 'Developers to branches', 'Users to roles', 'Servers to ports'], 0),
    basic('Test Artifacts: what does a test case include?', ['Steps and expected result', 'Only source code', 'Only a server name', 'Only a sprint date'], 0)
  ],
  Maintenance: [
    basic('Maintenance: which type fixes defects after release?', ['Corrective maintenance', 'Perfective maintenance', 'Adaptive maintenance', 'Prototype design'], 0),
    basic('Maintenance: which type improves existing behavior after release?', ['Perfective maintenance', 'Unit testing', 'Sprint planning', 'Requirement traceability'], 0)
  ],
  'General Concepts': [
    basic('General Concepts: what is QA focused on?', ['Improving product quality', 'Only writing code', 'Only deploying servers', 'Only assigning story points'], 0),
    basic('General Concepts: why is documentation useful?', ['It helps teams share and verify understanding', 'It replaces all testing', 'It removes all defects', 'It disables deployment'], 0)
  ]
};

function q(question, codeLines, choices, answer) {
  return { question, code: codeLines.join('\n'), choices, answer };
}

function basic(question, choices, answer) {
  return { question, choices, answer };
}

function requireQuestionCount() {
  if (!Number.isInteger(QUESTION_COUNT) || QUESTION_COUNT < 1 || QUESTION_COUNT > 60) {
    throw new Error('QUESTION_COUNT must be an integer from 1 to 60.');
  }
  if (!Number.isInteger(MIN_QUESTIONS_PER_TOPIC) || MIN_QUESTIONS_PER_TOPIC < 1 || MIN_QUESTIONS_PER_TOPIC > 60) {
    throw new Error('MIN_QUESTIONS_PER_TOPIC must be an integer from 1 to 60.');
  }
}

function googleDocExportUrl(url) {
  const match = url.match(/docs\.google\.com\/document\/d\/([^/?#]+)/);
  if (!match) return url;
  return `https://docs.google.com/document/d/${match[1]}/export?format=txt`;
}

function stripHtml(text) {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function cleanStudyGuide(text) {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_STUDY_GUIDE_CHARS);
}

async function loadStudyGuide() {
  if (STUDY_GUIDE_TEXT.trim()) return cleanStudyGuide(STUDY_GUIDE_TEXT);
  if (STUDY_GUIDE_FILE.trim()) return cleanStudyGuide(await fs.readFile(STUDY_GUIDE_FILE, 'utf8'));

  const url = googleDocExportUrl(STUDY_GUIDE_URL);
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'mini-quiz-academy-local-ollama-generator/1.0' }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch study guide. HTTP ${response.status}. Check sharing/access for ${url}`);
  }
  const contentType = response.headers.get('content-type') || '';
  const raw = await response.text();
  const cleaned = cleanStudyGuide(contentType.includes('html') ? stripHtml(raw) : raw);
  if (!cleaned || cleaned.length < 200) {
    throw new Error('Study guide content is too short or could not be read.');
  }
  return cleaned;
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function readTextIfExists(file) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

async function readQuestionsIfExists(file) {
  const text = await readTextIfExists(file);
  if (!text.trim()) return [];
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error(`${file} must contain a JSON array.`);
  return parsed;
}

function normalizeQuestion(question) {
  return {
    question: String(question.question || '').trim(),
    code: question.code ? String(question.code).trim() : undefined,
    choices: (question.choices || []).map((choice) => String(choice || '').trim()),
    answer: Number(question.answer),
    aiGenerated: question.aiGenerated === true || undefined
  };
}

function questionIdentity(question) {
  return `${question.question || ''} ${question.code || ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
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
  return JAVA_ALLOWED_TERMS.some((term) => text.includes(term))
    && !JAVA_BLOCKED_TERMS.some((term) => text.includes(term));
}

function detectTopic(questionText = '') {
  const text = questionText.toLowerCase();
  const found = TOPIC_KEYWORDS.find(({ patterns }) => patterns.some((pattern) => text.includes(pattern)));
  return found ? found.topic : 'General Concepts';
}

function sanitizeQuestions(rawQuestions) {
  const sanitized = [];
  const seen = new Set();

  for (const raw of rawQuestions) {
    const question = normalizeQuestion(raw);
    if (!question.question) continue;
    if (!Array.isArray(question.choices) || question.choices.length !== 4 || question.choices.some((choice) => !choice)) continue;
    if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer > 3) continue;
    if (detectTopic(question.question) === 'Java' && !isBeginnerJavaQuestion(question)) continue;

    const key = questionIdentity(question);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    if (!question.code) delete question.code;
    if (!question.aiGenerated) delete question.aiGenerated;
    sanitized.push(question);
  }

  return sanitized;
}

function groupByTopic(questions) {
  const grouped = new Map();
  for (const question of questions) {
    const topic = detectTopic(question.question);
    if (!grouped.has(topic)) grouped.set(topic, []);
    grouped.get(topic).push(question);
  }
  return grouped;
}

function validateQuestionBank(questions) {
  const sanitized = sanitizeQuestions(questions);
  const grouped = groupByTopic(sanitized);
  const errors = [];

  if (sanitized.length !== questions.length) {
    errors.push(`Sanitized question count ${sanitized.length} differs from raw count ${questions.length}.`);
  }

  for (const topic of REQUIRED_TOPICS) {
    const count = grouped.get(topic)?.length || 0;
    if (count < MIN_QUESTIONS_PER_TOPIC) {
      errors.push(`${topic} has ${count}/${MIN_QUESTIONS_PER_TOPIC} questions.`);
    }
  }

  const javaQuestions = grouped.get('Java') || [];
  const javaBlockedHits = javaQuestions.filter((question) =>
    JAVA_BLOCKED_TERMS.some((term) => javaQuestionText(question).includes(term))
  );
  if (javaBlockedHits.length > 0) {
    errors.push(`Java blocked-term hits: ${javaBlockedHits.length}.`);
  }

  return { ok: errors.length === 0, errors, sanitized, grouped };
}

function parseOllamaJson(text) {
  const trimmed = String(text || '').trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(trimmed);
  } catch (_) {
    const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0]);
    const objectMatch = trimmed.match(/\{[\s\S]*\}/);
    if (objectMatch) return JSON.parse(objectMatch[0]);
    throw new Error(`Ollama response did not contain JSON. Response: ${trimmed.slice(0, 300)}`);
  }
}

async function callOllama(prompt) {
  ollamaUsed = true;
  console.log(`Calling local Ollama endpoint ${OLLAMA_API_URL} with model ${OLLAMA_MODEL}.`);
  const response = await fetch(OLLAMA_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      format: 'json',
      stream: false,
      options: {
        temperature: Number(process.env.OLLAMA_TEMPERATURE || 0.2),
        top_p: Number(process.env.OLLAMA_TOP_P || 0.9)
      }
    })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Ollama request failed. HTTP ${response.status}: ${text}`);
  }

  const payload = JSON.parse(text);
  if (!payload.response) {
    throw new Error(`Ollama response did not include a response field: ${text.slice(0, 300)}`);
  }
  return payload.response;
}

function buildPrompt(topic, count, existingQuestions, studyGuide) {
  const existingList = existingQuestions
    .slice(0, 35)
    .map((question) => `- ${question.question}`)
    .join('\n');

  return [
    'You generate quiz questions for beginner software testing students.',
    `Create exactly ${count} multiple-choice questions for topic: ${topic}.`,
    `Quiz variant seed: ${QUIZ_VARIANT_SEED}.`,
    `Topic guidance: ${TOPIC_GUIDANCE[topic] || TOPIC_GUIDANCE['General Concepts']}`,
    '',
    'Hard rules:',
    '- Return valid JSON only.',
    '- Return either an array of question objects or an object with a "questions" array.',
    '- Each question needs: question string, choices array of exactly 4 strings, answer zero-based index 0-3.',
    '- Exactly one answer is correct.',
    '- No all-of-the-above or none-of-the-above.',
    '- Avoid duplicates and do not reuse existing questions.',
    '- Prefer practical scenario, output-prediction, and choose-the-correct-answer questions.',
    '- For Java, include short beginner code snippets when useful.',
    `- Java blocked terms: ${JAVA_BLOCKED_TERMS.join(', ')}.`,
    '- Never include blocked Java terms in Java questions.',
    '',
    'Existing questions to avoid:',
    existingList || '(none)',
    '',
    'Study guide excerpt:',
    studyGuide,
    '',
    'JSON shape:',
    '{"questions":[{"question":"...","code":"optional code snippet","choices":["A","B","C","D"],"answer":0}]}'
  ].join('\n');
}

async function generateQuestionsForTopic(topic, count, existingQuestions, studyGuide) {
  const prompt = buildPrompt(topic, count, existingQuestions, studyGuide);
  const text = await callOllama(prompt);
  const parsed = parseOllamaJson(text);
  const rawQuestions = Array.isArray(parsed) ? parsed : parsed.questions;
  if (!Array.isArray(rawQuestions)) {
    throw new Error(`Ollama JSON for ${topic} did not contain a questions array.`);
  }

  const tagged = rawQuestions.map((question) => ({ ...question, aiGenerated: true }));
  const sanitized = sanitizeQuestions(tagged).filter((question) => detectTopic(question.question) === topic);
  if (sanitized.length < Math.min(count, rawQuestions.length)) {
    console.warn(`Ollama returned ${rawQuestions.length} raw ${topic} item(s), ${sanitized.length} passed validation.`);
  }
  return sanitized.slice(0, count);
}

function fallbackQuestions(topic, count, existingQuestions) {
  const bank = FALLBACK_BANKS[topic] || FALLBACK_BANKS['General Concepts'];
  const output = [];
  const seen = new Set(existingQuestions.map(questionIdentity));
  let index = 0;

  while (output.length < count) {
    const base = bank[index % bank.length];
    const cycle = Math.floor(index / bank.length);
    const fallback = {
      ...base,
      question: cycle === 0 ? base.question : `${base.question} (fallback review ${cycle + 1})`
    };
    const key = questionIdentity(fallback);
    if (!seen.has(key)) {
      seen.add(key);
      output.push(fallback);
    }
    index += 1;
  }

  return output;
}

function mergeQuestions(existingQuestions, additions) {
  return sanitizeQuestions([...existingQuestions, ...additions]);
}

async function writeQuestionsSafely(file, questions) {
  const tempFile = `${file}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(questions, null, 2)}\n`, 'utf8');
  await fs.rename(tempFile, file);
}

async function main() {
  requireQuestionCount();
  await fs.rm(UNSTABLE_MARKER_FILE, { force: true });

  console.log(`Loading study guide from ${STUDY_GUIDE_FILE || STUDY_GUIDE_URL || 'STUDY_GUIDE_TEXT'}.`);
  const studyGuide = await loadStudyGuide();
  const currentHash = sha256(studyGuide);
  const previousHash = (await readTextIfExists(HASH_FILE)).trim();
  console.log(`Loaded study guide content (${studyGuide.length} characters, sha256=${currentHash}).`);

  let questions = sanitizeQuestions(await readQuestionsIfExists(QUESTIONS_FILE));
  let validation = validateQuestionBank(questions);
  const unstableReasons = [];

  if (previousHash === currentHash && validation.ok) {
    console.log('Study guide hash unchanged and current questions.json is valid; no change.');
    console.log('ollama_used=false');
    console.log('anthropic_used=false');
    return;
  }

  if (previousHash !== currentHash) {
    try {
      const fresh = await generateQuestionsForTopic('General Concepts', QUESTION_COUNT, questions, studyGuide);
      questions = mergeQuestions(questions, fresh);
      console.log(`Merged ${fresh.length} local Ollama study-guide question(s).`);
    } catch (error) {
      unstableReasons.push(`Ollama study-guide generation failed: ${error.message}`);
      console.warn(unstableReasons[unstableReasons.length - 1]);
    }
  }

  validation = validateQuestionBank(questions);
  questions = validation.sanitized;

  for (const topic of REQUIRED_TOPICS) {
    const grouped = groupByTopic(questions);
    const existing = grouped.get(topic) || [];
    const needed = MIN_QUESTIONS_PER_TOPIC - existing.length;
    if (needed <= 0) continue;

    let additions = [];
    try {
      additions = await generateQuestionsForTopic(topic, needed, existing, studyGuide);
      console.log(`Added ${additions.length} local Ollama question(s) for ${topic}.`);
    } catch (error) {
      unstableReasons.push(`Ollama topic generation failed for ${topic}: ${error.message}`);
      console.warn(unstableReasons[unstableReasons.length - 1]);
    }

    if (additions.length < needed) {
      const fallbackNeeded = needed - additions.length;
      additions = additions.concat(fallbackQuestions(topic, fallbackNeeded, [...existing, ...additions]));
      unstableReasons.push(`Used ${fallbackNeeded} deterministic fallback question(s) for ${topic}.`);
      console.warn(unstableReasons[unstableReasons.length - 1]);
    }

    questions = mergeQuestions(questions, additions);
  }

  validation = validateQuestionBank(questions);
  if (!validation.ok) {
    throw new Error(`Final validation failed; previous questions.json left untouched. ${validation.errors.join(' | ')}`);
  }

  await writeQuestionsSafely(QUESTIONS_FILE, validation.sanitized);
  await fs.writeFile(HASH_FILE, `${currentHash}\n`, 'utf8');

  if (unstableReasons.length) {
    await fs.writeFile(UNSTABLE_MARKER_FILE, `${unstableReasons.join('\n')}\n`, 'utf8');
    console.warn(`Completed with fallback/unstable notes: ${unstableReasons.join(' | ')}`);
  }

  const finalCounts = Object.fromEntries(REQUIRED_TOPICS.map((topic) => [
    topic,
    groupByTopic(validation.sanitized).get(topic)?.length || 0
  ]));
  console.log(`Wrote valid ${QUESTIONS_FILE} using local Ollama/fallback safety net.`);
  console.log(`Question counts: ${JSON.stringify(finalCounts)}`);
  console.log(`ollama_used=${ollamaUsed}`);
  console.log('anthropic_used=false');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
