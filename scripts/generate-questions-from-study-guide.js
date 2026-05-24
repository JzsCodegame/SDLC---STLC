#!/usr/bin/env node

const fs = require('fs/promises');

const DEFAULT_STUDY_GUIDE_URL = 'https://docs.google.com/document/d/1RzyuPH6ryIVD6z5iRuyJxmUa6jGLJE_wAB5R4S4mUWA/edit?tab=t.0#heading=h.fmjzqinx4dso';
const OPENAI_API_BASE = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const ANTHROPIC_API_BASE = process.env.ANTHROPIC_API_BASE || 'https://api.anthropic.com/v1';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
const ANTHROPIC_VERSION = process.env.ANTHROPIC_VERSION || '2023-06-01';
const AI_PROVIDER = (process.env.AI_PROVIDER || (!OPENAI_API_KEY && ANTHROPIC_API_KEY ? 'anthropic' : 'openai')).toLowerCase();
const QUESTION_COUNT = Number(process.env.QUESTION_COUNT || 25);
const OUTPUT_FILE = process.env.OUTPUT_FILE || 'questions.json';
const STUDY_GUIDE_URL = process.env.STUDY_GUIDE_URL || process.env.SOURCE_DOCUMENT_URL || DEFAULT_STUDY_GUIDE_URL;
const STUDY_GUIDE_FILE = process.env.STUDY_GUIDE_FILE || '';
const STUDY_GUIDE_TEXT = process.env.STUDY_GUIDE_TEXT || '';
const QUIZ_VARIANT_SEED = process.env.QUIZ_VARIANT_SEED || new Date().toISOString().slice(0, 13);
const MAX_STUDY_GUIDE_CHARS = Number(process.env.MAX_STUDY_GUIDE_CHARS || 60000);

function requireQuestionCount() {
  if (!Number.isInteger(QUESTION_COUNT) || QUESTION_COUNT < 1 || QUESTION_COUNT > 60) {
    throw new Error('QUESTION_COUNT must be an integer from 1 to 60.');
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
  if (STUDY_GUIDE_TEXT.trim()) {
    return cleanStudyGuide(STUDY_GUIDE_TEXT);
  }

  if (STUDY_GUIDE_FILE.trim()) {
    const fileText = await fs.readFile(STUDY_GUIDE_FILE, 'utf8');
    return cleanStudyGuide(fileText);
  }

  const url = googleDocExportUrl(STUDY_GUIDE_URL);
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'mini-quiz-academy-question-generator/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch study guide. HTTP ${response.status}. Check sharing/access for ${url}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const raw = await response.text();
  const text = contentType.includes('html') ? stripHtml(raw) : raw;
  const cleaned = cleanStudyGuide(text);

  if (!cleaned || cleaned.length < 200) {
    throw new Error('Study guide content is too short or could not be read. Check the study guide URL/export permissions.');
  }

  return cleaned;
}

function outputTextFromResponse(data) {
  if (typeof data.output_text === 'string') {
    return data.output_text;
  }

  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === 'string') {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join('\n').trim();
}

function outputTextFromAnthropicResponse(data) {
  const chunks = [];
  for (const item of data.content || []) {
    if (item.type === 'text' && typeof item.text === 'string') {
      chunks.push(item.text);
    }
  }
  return chunks.join('\n').trim();
}

function outputToolInputFromAnthropicResponse(data) {
  for (const item of data.content || []) {
    if (item.type === 'tool_use' && item.name === 'record_quiz_questions' && item.input) {
      return item.input;
    }
  }
  return null;
}

function parseJson(text) {
  const trimmed = text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  return JSON.parse(trimmed);
}

function normalizeQuestion(question) {
  return {
    question: String(question.question || '').trim(),
    choices: (question.choices || []).map((choice) => String(choice || '').trim()),
    answer: Number(question.answer)
  };
}

function validateQuestions(rawQuestions) {
  if (!Array.isArray(rawQuestions)) {
    throw new Error('Generated response did not contain a questions array.');
  }

  const questions = rawQuestions.map(normalizeQuestion);
  const seen = new Set();

  for (const [index, item] of questions.entries()) {
    if (!item.question) {
      throw new Error(`Question ${index + 1} is missing question text.`);
    }
    if (!Array.isArray(item.choices) || item.choices.length !== 4 || item.choices.some((choice) => !choice)) {
      throw new Error(`Question ${index + 1} must have exactly 4 non-empty choices.`);
    }
    if (!Number.isInteger(item.answer) || item.answer < 0 || item.answer > 3) {
      throw new Error(`Question ${index + 1} answer must be an index from 0 to 3.`);
    }

    const key = item.question.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) {
      throw new Error(`Duplicate generated question: ${item.question}`);
    }
    seen.add(key);
  }

  if (questions.length !== QUESTION_COUNT) {
    throw new Error(`Expected ${QUESTION_COUNT} questions, got ${questions.length}.`);
  }

  return questions;
}

function buildQuestionSchema({ constrained = true } = {}) {
  const arraySchema = {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      properties: {
        question: { type: 'string' },
        choices: {
          type: 'array',
          items: { type: 'string' }
        },
        answer: {
          type: 'integer'
        }
      },
      required: ['question', 'choices', 'answer']
    }
  };

  if (constrained) {
    arraySchema.minItems = QUESTION_COUNT;
    arraySchema.maxItems = QUESTION_COUNT;
    arraySchema.items.properties.choices.minItems = 4;
    arraySchema.items.properties.choices.maxItems = 4;
    arraySchema.items.properties.answer.minimum = 0;
    arraySchema.items.properties.answer.maximum = 3;
  }

  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      questions: arraySchema
    },
    required: ['questions']
  };
}

function systemInstructions() {
  return [
    'You generate quiz questions for beginner QA, SDLC, STLC, and software testing students.',
    'Use only the provided study guide content. Do not invent facts outside the guide.',
    'Each question must have one clear correct answer and three plausible distractors.',
    'When Java, OOP, class, object, inheritance, polymorphism, Selenium automation, or Java basics appear in the study guide, include Java questions.',
    'Java questions should be W3Schools-style practice: short code snippets, output prediction, spot-the-error, or choose-the-correct-code exercises.',
    'Avoid trick questions, repeated questions, all-of-the-above, and none-of-the-above.',
    'Return only data that matches the requested JSON schema.'
  ].join(' ');
}

function userPrompt(studyGuide) {
  return [
    `Create exactly ${QUESTION_COUNT} multiple-choice quiz questions.`,
    `Quiz variant seed: ${QUIZ_VARIANT_SEED}. Use it to vary question selection across scheduled hourly runs.`,
    'Question format required by the app: question string, choices array of exactly four strings, answer as the zero-based index of the correct choice.',
    'If the question is about Java, include the word "Java" in the question and prefer a compact code sample inside the question text.',
    '',
    'Study guide:',
    studyGuide
  ].join('\n');
}

async function generateQuestionsWithOpenAI(studyGuide) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai.');
  }

  const schema = buildQuestionSchema({ constrained: true });

  const body = {
    model: OPENAI_MODEL,
    instructions: systemInstructions(),
    input: userPrompt(studyGuide),
    text: {
      format: {
        type: 'json_schema',
        name: 'quiz_question_set',
        strict: true,
        schema
      }
    },
    temperature: Number(process.env.OPENAI_TEMPERATURE || 0.7),
    max_output_tokens: Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 7000)
  };

  const response = await fetch(`${OPENAI_API_BASE}/responses`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI question generation failed. HTTP ${response.status}: ${responseText}`);
  }

  const data = JSON.parse(responseText);
  const outputText = outputTextFromResponse(data);
  if (!outputText) {
    throw new Error('OpenAI response did not contain output text.');
  }

  const payload = parseJson(outputText);
  return validateQuestions(payload.questions || payload);
}

async function generateQuestionsWithAnthropic(studyGuide) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic.');
  }

  const schema = buildQuestionSchema({ constrained: false });
  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: Number(process.env.ANTHROPIC_MAX_TOKENS || 7000),
    temperature: Number(process.env.ANTHROPIC_TEMPERATURE || 0.7),
    system: systemInstructions(),
    messages: [
      {
        role: 'user',
        content: userPrompt(studyGuide)
      }
    ],
    tools: [
      {
        name: 'record_quiz_questions',
        description: 'Record the generated multiple-choice quiz questions.',
        input_schema: schema
      }
    ],
    tool_choice: {
      type: 'tool',
      name: 'record_quiz_questions'
    }
  };

  const response = await fetch(`${ANTHROPIC_API_BASE}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Anthropic question generation failed. HTTP ${response.status}: ${responseText}`);
  }

  const data = JSON.parse(responseText);
  if (data.stop_reason === 'refusal') {
    throw new Error('Anthropic question generation was refused by the model.');
  }
  if (data.stop_reason === 'max_tokens') {
    throw new Error('Anthropic question generation reached max_tokens before completing JSON. Increase ANTHROPIC_MAX_TOKENS.');
  }

  const toolInput = outputToolInputFromAnthropicResponse(data);
  if (toolInput) {
    return validateQuestions(toolInput.questions || toolInput);
  }

  const outputText = outputTextFromAnthropicResponse(data);
  if (!outputText) {
    throw new Error('Anthropic response did not contain a tool_use input or output text.');
  }

  const payload = parseJson(outputText);
  return validateQuestions(payload.questions || payload);
}

async function generateQuestions(studyGuide) {
  if (AI_PROVIDER === 'openai') {
    return generateQuestionsWithOpenAI(studyGuide);
  }
  if (AI_PROVIDER === 'anthropic' || AI_PROVIDER === 'claude') {
    return generateQuestionsWithAnthropic(studyGuide);
  }
  throw new Error(`Unsupported AI_PROVIDER "${AI_PROVIDER}". Use "openai" or "anthropic".`);
}

async function main() {
  requireQuestionCount();

  console.log(`Loading study guide from ${STUDY_GUIDE_FILE || STUDY_GUIDE_URL || 'STUDY_GUIDE_TEXT'}`);
  const studyGuide = await loadStudyGuide();
  console.log(`Loaded study guide content (${studyGuide.length} characters).`);

  const selectedModel = AI_PROVIDER === 'anthropic' || AI_PROVIDER === 'claude' ? ANTHROPIC_MODEL : OPENAI_MODEL;
  console.log(`Generating ${QUESTION_COUNT} questions with ${AI_PROVIDER}:${selectedModel}.`);
  const questions = await generateQuestions(studyGuide);

  const tempFile = `${OUTPUT_FILE}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(questions, null, 2)}\n`, 'utf8');
  await fs.rename(tempFile, OUTPUT_FILE);

  console.log(`Wrote ${questions.length} generated questions to ${OUTPUT_FILE}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

