#!/usr/bin/env node

const fs = require('fs/promises');

const SHEET_CSV_URL = process.env.GOOGLE_SHEET_CSV_URL;
const OUTPUT_FILE = process.env.STUDENTS_OUTPUT_FILE || 'students.json';
const MAX_STUDENTS_RAW = process.env.MAX_STUDENTS;
const DEFAULT_MAX_STUDENTS = 20;

function resolveMaxStudents() {
  if (MAX_STUDENTS_RAW === undefined || MAX_STUDENTS_RAW.trim() === '') {
    return DEFAULT_MAX_STUDENTS;
  }

  if (!/^\d+$/.test(MAX_STUDENTS_RAW.trim())) {
    throw new Error('MAX_STUDENTS must be a non-negative integer.');
  }

  return Number(MAX_STUDENTS_RAW.trim());
}
const SOURCE_DOCUMENT_URL = process.env.SOURCE_DOCUMENT_URL || '';

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function toObjects(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = values[idx] ?? '';
    });
    return obj;
  });
}

async function main() {
  if (!SHEET_CSV_URL) {
    throw new Error('GOOGLE_SHEET_CSV_URL is required. Use the Google Sheet CSV export URL.');
  }

  const maxStudents = resolveMaxStudents();

  const response = await fetch(SHEET_CSV_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch sheet. HTTP ${response.status}`);
  }

  const csvText = await response.text();
  const rows = toObjects(csvText);
  const selected = rows.slice(0, maxStudents).map((row, index) => ({
    id: index + 1,
    name: row.name || row.student || row.student_name || Object.values(row)[0] || ''
  })).filter((student) => student.name);

  const payload = {
    publishedAt: new Date().toISOString(),
    totalPublished: selected.length,
    sourceDocumentUrl: SOURCE_DOCUMENT_URL,
    students: selected
  };

  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`Published ${selected.length} students to ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
