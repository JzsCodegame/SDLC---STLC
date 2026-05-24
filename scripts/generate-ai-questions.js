#!/usr/bin/env node
'use strict';

/**
 * generate-ai-questions.js
 *
 * Uses the Claude API to supplement questions.json so every topic
 * has at least MIN_QUESTIONS_PER_TOPIC entries.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=<key> node scripts/generate-ai-questions.js
 *
 * Optional env vars:
 *   MIN_QUESTIONS_PER_TOPIC  (default: 25)
 *   CLAUDE_MODEL             (default: claude-opus-4-5)
 */

const fs = require('fs/promises');
const path = require('path');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const QUESTIONS_FILE = path.join(__dirname, '..', 'questions.json');
const MIN_QUESTIONS_PER_TOPIC = Number(process.env.MIN_QUESTIONS_PER_TOPIC) || 25;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-5';

// Topic definitions matching detectTopic() in app.js
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
  { topic: 'Java', patterns: ['java', 'jvm', 'jdk', 'jre', 'class', 'object', 'inheritance', 'polymorphism'] },
  { topic: 'Maintenance', patterns: ['maintenance', 'production support', 'patch'] },
];

// Topic-specific generation guidance for Claude
const TOPIC_PROMPTS = {
  Java: {
    description: 'Java OOP (Object-Oriented Programming)',
    guidance: `Focus on practical, exercise-based questions covering:
- Core OOP: inheritance, polymorphism, encapsulation, abstraction
- Interfaces vs abstract classes
- Method overloading vs overriding
- Access modifiers (public, private, protected, default)
- Constructors (default, parameterized, copy)
- Static vs instance members
- Java collections (ArrayList, HashMap, LinkedList)
- Exception handling (try-catch-finally, checked vs unchecked)
- Basic Java syntax (loops, conditionals, arrays)
- JVM, JDK, JRE differences
Include output-prediction exercises like "What is the output of this Java code?" and "Which code snippet correctly demonstrates...?"
Every question text MUST contain the word "Java" or a Java-specific keyword (e.g. "JVM", "JDK", "ArrayList").`,
  },
  SDLC: {
    description: 'Software Development Life Cycle (SDLC)',
    guidance: `Focus on:
- SDLC phases and their order (Planning, Analysis, Design, Implementation, Testing, Deployment, Maintenance)
- Waterfall vs Agile vs Spiral vs V-Model
- Entry/exit criteria for each phase
- Role responsibilities in SDLC
- Documentation produced at each phase
Every question text MUST contain "SDLC" or "Software Development Life Cycle".`,
  },
  STLC: {
    description: 'Software Testing Life Cycle (STLC)',
    guidance: `Focus on:
- STLC phases (Requirement Analysis, Test Planning, Test Case Development, Environment Setup, Test Execution, Test Closure)
- Test plan components and test summary reports
- Entry/exit criteria per STLC phase
- Metrics used in test closure
Every question text MUST contain "STLC" or "Software Testing Life Cycle".`,
  },
  'Testing Types': {
    description: 'Software Testing Types',
    guidance: `Focus on:
- Unit, integration, system, and acceptance testing definitions and differences
- Functional vs non-functional testing
- Black-box vs white-box vs grey-box testing
- Regression, smoke, sanity, exploratory testing
- Performance, load, stress, security testing
Every question must mention a specific testing type by name.`,
  },
  'Agile & Scrum': {
    description: 'Agile methodology and Scrum framework',
    guidance: `Focus on:
- Agile Manifesto values and principles
- Scrum roles (Product Owner, Scrum Master, Dev Team)
- Scrum artifacts (Product Backlog, Sprint Backlog, Increment)
- Scrum ceremonies (Sprint Planning, Daily Standup, Sprint Review, Retrospective)
- Kanban principles and WIP limits
- Story points and velocity
Every question must contain "Agile", "Scrum", "Sprint", or "Kanban".`,
  },
  Requirements: {
    description: 'Software Requirements Engineering',
    guidance: `Focus on:
- Functional vs non-functional requirements
- Software Requirements Specification (SRS) document
- User stories, use cases, acceptance criteria
- Requirement qualities (clear, testable, complete, consistent)
- Stakeholder analysis
Every question must contain "requirement", "functional", "non-functional", or "SRS".`,
  },
  Design: {
    description: 'Software Design and Architecture',
    guidance: `Focus on:
- UML diagrams (class, sequence, use-case, activity)
- Design patterns (Singleton, Factory, Observer, MVC)
- High-level vs low-level design
- Software architecture styles (microservices, monolith, layered)
- Prototyping approaches
Every question must contain "design", "architecture", "UML", or "prototype".`,
  },
  'Deployment & DevOps': {
    description: 'Deployment and DevOps practices',
    guidance: `Focus on:
- CI/CD pipelines and tools (Jenkins, GitHub Actions)
- Docker containers and Docker commands
- Deployment strategies (blue-green, canary, rolling)
- Infrastructure as Code concepts
- DevOps culture and practices
Every question must contain "deployment", "DevOps", "CI/CD", "Jenkins", or "Docker".`,
  },
  'Defects & Bug Tracking': {
    description: 'Defect management and bug tracking',
    guidance: `Focus on:
- Defect life cycle stages
- Severity vs priority classification
- Bug report components (steps to reproduce, expected vs actual)
- Defect tracking tools (Jira, Bugzilla)
- Root cause analysis
Every question must contain "defect", "bug", "severity", or "priority".`,
  },
  'Test Artifacts': {
    description: 'Software testing artifacts',
    guidance: `Focus on:
- Test plan components and purpose
- Test case structure (ID, description, steps, expected result)
- Requirements Traceability Matrix (RTM)
- Test summary report
- Test data management
Every question must contain "test case", "test plan", "traceability", or "RTM".`,
  },
  Maintenance: {
    description: 'Software Maintenance',
    guidance: `Focus on:
- Types of maintenance (corrective, adaptive, perfective, preventive)
- Production support processes
- Patch management
- Change management in maintenance phase
- SLA and support tiers
Every question must contain "maintenance", "production support", or "patch".`,
  },
  'General Concepts': {
    description: 'General software engineering concepts',
    guidance: `Focus on general software engineering fundamentals that do not fall into a more specific category.`,
  },
};

function detectTopic(questionText = '') {
  const text = questionText.toLowerCase();
  const found = TOPIC_KEYWORDS.find(({ patterns }) =>
    patterns.some((pattern) => text.includes(pattern))
  );
  return found ? found.topic : 'General Concepts';
}

function groupByTopic(questions) {
  const map = new Map();
  questions.forEach((q) => {
    const topic = detectTopic(q.question);
    if (!map.has(topic)) map.set(topic, []);
    map.get(topic).push(q);
  });
  return map;
}

async function callClaude(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function generateQuestionsForTopic(topic, count, existingQuestions) {
  const topicDef = TOPIC_PROMPTS[topic] || TOPIC_PROMPTS['General Concepts'];

  const existingList = existingQuestions
    .map((q) => `- ${q.question}`)
    .join('\n');

  const prompt = `You are a quiz question writer for a software engineering training course.

Generate exactly ${count} multiple-choice questions about: ${topicDef.description}

${topicDef.guidance}

Additional requirements:
- Make each question exercise-based and practical (predict output, spot the error, choose the correct implementation)
- Provide exactly 4 answer choices per question (labeled option A through D internally)
- Exactly one choice must be correct
- Distractors should be plausible but clearly wrong to someone who knows the topic
- Do NOT duplicate any of these existing questions:
${existingList || '(none yet)'}

Return ONLY a valid JSON array — no markdown fences, no explanation, no trailing text.
Use this exact structure:
[
  {
    "question": "Question text here?",
    "choices": ["Option A", "Option B", "Option C", "Option D"],
    "answer": 0
  }
]
Where "answer" is the 0-based index of the correct choice (0 = first choice, 1 = second, etc.).`;

  console.log(`  Calling Claude to generate ${count} question(s) for "${topic}"...`);
  const text = await callClaude(prompt);

  // Extract JSON array from the response (Claude sometimes wraps in backticks)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(
      `No JSON array found in Claude response for topic "${topic}". Response: ${text.substring(0, 300)}`
    );
  }

  let generated;
  try {
    generated = JSON.parse(jsonMatch[0]);
  } catch (parseErr) {
    throw new Error(
      `Failed to parse Claude JSON for topic "${topic}": ${parseErr.message}. Raw: ${jsonMatch[0].substring(0, 300)}`
    );
  }

  if (!Array.isArray(generated)) {
    throw new Error(`Expected array from Claude for topic "${topic}", got: ${typeof generated}`);
  }

  // Validate and tag each question as AI-generated
  const valid = generated.filter((q) => {
    if (typeof q.question !== 'string' || !q.question.trim()) return false;
    if (!Array.isArray(q.choices) || q.choices.length !== 4) return false;
    if (typeof q.answer !== 'number' || q.answer < 0 || q.answer > 3) return false;
    return true;
  });

  if (valid.length < generated.length) {
    console.warn(
      `  Warning: ${generated.length - valid.length} invalid question(s) discarded for topic "${topic}".`
    );
  }

  return valid.map((q) => ({ ...q, aiGenerated: true }));
}

async function main() {
  if (!ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is not set.');
    console.error('Usage: ANTHROPIC_API_KEY=<key> node scripts/generate-ai-questions.js');
    process.exit(1);
  }

  console.log(`Reading questions from ${QUESTIONS_FILE}...`);
  let questions;
  try {
    const raw = await fs.readFile(QUESTIONS_FILE, 'utf8');
    questions = JSON.parse(raw);
    console.log(`  Loaded ${questions.length} existing question(s).`);
  } catch (err) {
    console.error(`Failed to read ${QUESTIONS_FILE}: ${err.message}`);
    process.exit(1);
  }

  const topicMap = groupByTopic(questions);

  // Determine which topics need supplementing
  const allTopics = Object.keys(TOPIC_PROMPTS);
  const toGenerate = [];

  for (const topic of allTopics) {
    const count = topicMap.get(topic)?.length || 0;
    const needed = MIN_QUESTIONS_PER_TOPIC - count;
    if (needed > 0) {
      toGenerate.push({ topic, existing: topicMap.get(topic) || [], needed });
    }
  }

  if (toGenerate.length === 0) {
    console.log(`All topics already have at least ${MIN_QUESTIONS_PER_TOPIC} questions. Nothing to do.`);
    return;
  }

  console.log(`\nTopics needing AI-generated questions:`);
  toGenerate.forEach(({ topic, existing, needed }) => {
    console.log(`  "${topic}": ${existing.length} existing, need ${needed} more`);
  });
  console.log('');

  let totalAdded = 0;
  for (const { topic, existing, needed } of toGenerate) {
    try {
      const generated = await generateQuestionsForTopic(topic, needed, existing);
      questions = questions.concat(generated);
      totalAdded += generated.length;
      console.log(`  ✓ Added ${generated.length} AI question(s) for "${topic}".`);
    } catch (err) {
      console.error(`  ✗ Failed to generate questions for "${topic}": ${err.message}`);
    }
  }

  if (totalAdded > 0) {
    await fs.writeFile(QUESTIONS_FILE, JSON.stringify(questions, null, 2) + '\n', 'utf8');
    console.log(`\nDone. Added ${totalAdded} AI-generated question(s). Total: ${questions.length}.`);
    console.log(`Updated ${QUESTIONS_FILE}.`);
  } else {
    console.log('\nNo questions were added (all generation attempts failed).');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
