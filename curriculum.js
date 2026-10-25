// The curriculum is a course map; existing concept lessons are related overviews.
const related = {
  1: ['sdlc/purpose', 'SDLC'], 2: ['sdlc/lifecycle', 'SDLC'],
  3: ['manual/stlc', 'STLC'], 4: ['manual/case', 'Test Artifacts'],
  5: ['manual/defect', 'Defects & Bug Tracking'], 6: ['api/api-layer', 'Testing Types'],
  8: ['tools/git', 'Git'], 9: ['ui/ui-layer', 'Testing Types'],
  10: ['automation/maintenance', 'Testing Types'], 11: ['api/karate', 'Testing Types'],
  12: ['tools/pipeline', 'Deployment & DevOps'], 14: ['ai/llm', 'SDLC'],
  15: ['ai/review', 'Testing Types']
};
const $ = id => document.getElementById(id);
const el = (tag, text, cls) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
};
const lessonLink = module => {
  if (!related[module]) return null;
  const [concept, topic] = related[module];
  const link = el('a', 'Related overview lesson →');
  link.href = `learn.html?topic=${encodeURIComponent(topic)}#${concept}`;
  return link;
};
let sections = [], moduleSections = [], details = [];
let pdfPage = 1;
const pdfPages = 54;
for (let number = 1; number <= pdfPages; number++) {
  const option = el('option', String(number));
  option.value = String(number);
  $('pdf-page-number').append(option);
}
function showPDFPage(number) {
  pdfPage = Math.max(1, Math.min(pdfPages, number));
  $('pdf-page-number').value = String(pdfPage);
  $('pdf-page-image').src = `assets/curriculum/page-${String(pdfPage).padStart(2, '0')}.png`;
  $('pdf-page-image').alt = `Curriculum document, page ${pdfPage} of ${pdfPages}. The text version is available in Read in the hub.`;
  $('pdf-page-status').textContent = `Page ${pdfPage} of ${pdfPages}`;
  $('pdf-previous').disabled = pdfPage === 1;
  $('pdf-next').disabled = pdfPage === pdfPages;
  document.querySelector('.pdf-page-viewport').scrollTo(0, 0);
}
$('pdf-page-number').addEventListener('change', event => showPDFPage(Number(event.target.value)));
$('pdf-previous').addEventListener('click', () => showPDFPage(pdfPage - 1));
$('pdf-next').addEventListener('click', () => showPDFPage(pdfPage + 1));
$('pdf-zoom').addEventListener('change', event => { $('pdf-page-image').style.width = `${event.target.value}%`; });
$('pdf-text-version').addEventListener('click', () => readingMode(false));

function readingMode(pdf) {
  $('online-reader').hidden = pdf;
  $('pdf-reader').hidden = !pdf;
  $('online-mode').setAttribute('aria-pressed', String(!pdf));
  $('pdf-mode').setAttribute('aria-pressed', String(pdf));
  $('curriculum-search').disabled = pdf || sections.length === 0;
  if (pdf && !$('pdf-page-image').hasAttribute('src')) showPDFPage(pdfPage);
}
$('online-mode').addEventListener('click', () => readingMode(false));
$('pdf-mode').addEventListener('click', () => readingMode(true));

function updatePosition(section) {
  document.querySelectorAll('.module-card').forEach(card => {
    const current = card.dataset.section === section.id;
    card.dataset.current = String(current);
    if (current) card.setAttribute('aria-current', 'true'); else card.removeAttribute('aria-current');
  });
  if (section.module) {
    const previous = moduleSections[section.module - 2];
    const next = moduleSections[section.module];
    $('roadmap-position').textContent = `You are here: Module ${section.module} · ${section.moduleTitle}. ` +
      (previous ? `Previous: ${previous.moduleTitle}. ` : 'Start of the course. ') +
      (next ? `Next: ${next.moduleTitle}.` : 'Final course module.');
  } else {
    $('roadmap-position').textContent = `You are reading: ${section.title}.`;
  }
}

function selectSection(id, {scroll = true, record = true, preserveSearch = false} = {}) {
  const section = sections.find(item => item.id === id);
  if (!section) return;
  readingMode(false);
  if (!preserveSearch) $('curriculum-search').value = '';
  filterSections();
  details.forEach(node => { node.hidden = node.id !== id; });
  updatePosition(section);
  if (record && location.hash !== '#' + id) history.pushState(null, '', '#' + id);
  if (scroll) {
    $('curriculum-content').scrollIntoView({block: 'start', behavior: 'instant'});
    $(id).querySelector('h2').focus({preventScroll: true});
  }
}

function filterSections() {
  const term = $('curriculum-search').value.trim().toLocaleLowerCase();
  let count = 0;
  document.querySelectorAll('.module-card').forEach((node, i) => {
    const section = sections[i];
    const text = [section.title, ...section.blocks.map(b => b.text || b.rows?.flat().join(' ') || '')].join(' ');
    node.hidden = !text.toLocaleLowerCase().includes(term);
    if (!node.hidden) count++;
  });
  $('section-count').textContent = term ? count + ' of ' + sections.length + ' sections match' : moduleSections.length + ' modules · ' + sections.length + ' sections';
  $('no-results').hidden = count !== 0;
}

function renderBlocks(blocks, body) {
  let list = null;
  for (const block of blocks) {
    const numbered = block.type === 'text' && block.text.match(/^(\d+)\.\s+(.+)$/s);
    if (numbered) {
      if (!list) {
        list = el('ol');
        list.start = Number(numbered[1]);
        body.append(list);
      }
      const item = el('li', numbered[2]);
      item.value = Number(numbered[1]);
      list.append(item);
      continue;
    }
    list = null;
    if (block.type === 'table') {
      const wrapper = el('div', undefined, 'curriculum-table');
      wrapper.tabIndex = 0;
      wrapper.setAttribute('role', 'region');
      wrapper.setAttribute('aria-label', 'Curriculum table; scroll horizontally if needed');
      const table = el('table'), head = el('thead'), tbody = el('tbody');
      block.rows.forEach((row, i) => {
        const tr = el('tr');
        row.forEach(text => {
          const cell = el(i === 0 ? 'th' : 'td', text);
          if (i === 0) cell.scope = 'col';
          tr.append(cell);
        });
        (i === 0 ? head : tbody).append(tr);
      });
      table.append(head, tbody);
      wrapper.append(table);
      body.append(wrapper);
    } else {
      body.append(el(block.type === 'heading' ? (block.level > 2 ? 'h4' : 'h3') : 'p', block.text));
    }
  }
}

// The visual reader is a view of the original outline, never a second curriculum.
const svgNS = 'http://www.w3.org/2000/svg';
const cleanLabel = text => text.replace(/^(?:\d+|[a-z])\.\s+/i, '');
function svgElement(tag, attributes = {}, text) {
  const node = document.createElementNS(svgNS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  if (text !== undefined) node.textContent = text;
  return node;
}
function wrapLabel(text, width = 38) {
  const lines = [];
  for (const word of text.split(/\s+/)) {
    if (!lines.length || (lines.at(-1) + ' ' + word).length > width) lines.push(word);
    else lines[lines.length - 1] += ' ' + word;
  }
  return lines;
}
function renderVisualMap(section, body) {
  const groups = [];
  let current = null;
  for (const block of section.blocks) {
    if (block.type === 'heading') {
      current = {title: cleanLabel(block.text), items: []};
      groups.push(current);
    } else if (block.type === 'text' && block.text.trim()) {
      if (!current) {
        current = {title: section.module ? 'Course context' : cleanLabel(section.title), items: []};
        groups.push(current);
      }
      current.items.push(cleanLabel(block.text));
    } else if (block.type === 'table') {
      current = {title: 'Course overview', items: block.rows.slice(1).map(row => row.join(' · '))};
      groups.push(current);
    }
  }
  const map = el('section', undefined, 'curriculum-visual-map');
  map.setAttribute('aria-label', `Visual map: ${section.title}`);
  map.append(el('p', section.module ? 'OUTCOME → CONCEPTS → PRACTICE → EVIDENCE' : 'EXPLORE THIS SECTION', 'visual-map-label'));
  const grid = el('div', undefined, 'visual-map-grid');
  const visualGroups = groups.filter(group => group.items.length);
  visualGroups.forEach((group, index) => {
    const card = el('div', undefined, 'visual-map-node');
    const titleLines = wrapLabel(group.title, 33);
    // A concept tree shows every named concept; longer outcomes stay concise.
    // Full explanations remain verbatim in the expandable original outline.
    const conceptTree = group.title === 'What we teach' && group.items.every(item => item.includes(':'));
    const visibleItems = conceptTree ? group.items.map(item => item.slice(0, item.indexOf(':'))) : group.items.slice(0, 3);
    const itemLines = visibleItems.map(item => wrapLabel(item, 39).slice(0, 3));
    const height = 86 + titleLines.length * 22 + itemLines.reduce((total, lines) => total + lines.length * 20 + 14, 0);
    const svg = svgElement('svg', {viewBox: `0 0 380 ${height}`, role: 'img', 'aria-labelledby': `${section.id}-map-${index}-title ${section.id}-map-${index}-desc`});
    svg.append(svgElement('title', {id: `${section.id}-map-${index}-title`}, group.title));
    svg.append(svgElement('desc', {id: `${section.id}-map-${index}-desc`}, visibleItems.join(' · ') + (group.items.length > visibleItems.length ? ' More items in the complete outline below.' : '')));
    svg.append(svgElement('rect', {x: 1, y: 1, width: 378, height: height - 2, rx: 18, fill: '#f4f8f3', stroke: '#cfdbd8'}));
    svg.append(svgElement('circle', {cx: 32, cy: 31, r: 16, fill: '#006a68'}));
    svg.append(svgElement('text', {x: 32, y: 36, 'text-anchor': 'middle', fill: '#fff', 'font-size': 13, 'font-weight': 700}, String(index + 1).padStart(2, '0')));
    let y = 33;
    for (const line of titleLines) {
      svg.append(svgElement('text', {x: 60, y, fill: '#172d36', 'font-size': 17, 'font-weight': 700}, line));
      y += 22;
    }
    y += 17;
    const branchStart = y - 5;
    let branchEnd = branchStart;
    itemLines.forEach((lines, itemIndex) => {
      branchEnd = y - 5;
      svg.append(svgElement('path', {d: `M 18 ${y - 5} H 29`, fill: 'none', stroke: '#84ada6', 'stroke-width': 2}));
      svg.append(svgElement('circle', {cx: 30, cy: y - 5, r: 4, fill: '#006a68'}));
      lines.forEach((line, lineIndex) => {
        const truncated = lineIndex === lines.length - 1 && wrapLabel(visibleItems[itemIndex], 39).length > 3;
        svg.append(svgElement('text', {x: 40, y, fill: '#36545a', 'font-size': 14}, line + (truncated ? '…' : '')));
        y += 20;
      });
      y += 14;
    });
    svg.append(svgElement('path', {d: `M 32 47 Q 18 47 18 ${branchStart} V ${branchEnd}`, fill: 'none', stroke: '#84ada6', 'stroke-width': 2}));
    svg.append(svgElement('text', {x: 22, y: height - 18, fill: '#006a68', 'font-size': 12}, `${group.items.length} ${group.items.length === 1 ? 'point' : 'points'} in the complete outline`));
    card.append(svg);
    grid.append(card);
  });
  map.append(grid, el('p', 'A visual overview of the original curriculum. Open the complete outline for every point; Word and PDF retain the document format.', 'visual-map-note'));
  body.append(map);
}

try {
  const response = await fetch('curriculum-data.json');
  if (!response.ok) throw new Error(`Curriculum response ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.sections) || !data.sections.length) throw new Error('Missing sections');
  sections = data.sections;
  moduleSections = sections.filter(s => s.module);
  $('curriculum-sections').replaceChildren();
  for (const section of sections) {
    const card = el('button', undefined, 'module-card');
    card.type = 'button';
    card.dataset.section = section.id;
    card.setAttribute('aria-controls', section.id);
    card.append(el('span', section.module ? 'MODULE ' + String(section.module).padStart(2, '0') : 'COURSE GUIDE', 'module-number'), el('span', section.moduleTitle || section.title, 'module-title'));
    card.addEventListener('click', () => selectSection(section.id, {preserveSearch: true}));
    $('course-modules').append(card);
  }
  sections.forEach((section, i) => {
    const node = el('article', undefined, 'curriculum-section');
    node.id = section.id;
    node.hidden = true;
    node.setAttribute('aria-labelledby', section.id + '-title');
    const heading = el('h2', section.title);
    heading.id = section.id + '-title';
    heading.tabIndex = -1;
    node.append(heading);
    const body = el('div', undefined, 'section-body');
    renderVisualMap(section, body);
    const outline = el('details', undefined, 'curriculum-full-outline');
    outline.append(el('summary', 'Read the complete original outline'));
    const outlineBody = el('div', undefined, 'curriculum-outline-body');
    renderBlocks(section.blocks, outlineBody);
    outline.append(outlineBody);
    body.append(outline);
    const connection = lessonLink(section.module);
    if (connection) {
      const note = el('p', 'Connect this scope to an available concept card: ');
      note.append(connection);
      body.append(note);
    }
    const navigation = el('nav', undefined, 'section-navigation');
    navigation.setAttribute('aria-label', `Navigation for ${section.title}`);
    for (const [label, next] of [['← Previous section', sections[i - 1]], ['Next section →', sections[i + 1]]]) {
      if (!next) continue;
      const button = el('button', label);
      button.addEventListener('click', () => selectSection(next.id));
      navigation.append(button);
    }
    body.append(navigation);
    node.append(body);
    details.push(node);
    $('curriculum-sections').append(node);
  });
  $('curriculum-search').addEventListener('input', filterSections);
  filterSections();
  const followHash = () => {
    const id = location.hash.slice(1);
    selectSection(sections.some(s => s.id === id) ? id : sections[0].id, {record: false, scroll: false});
  };
  window.addEventListener('hashchange', followHash);
  followHash();
} catch (error) {
  $('curriculum-error').hidden = false;
  $('curriculum-sections').replaceChildren();
  $('curriculum-search').disabled = true;
  $('roadmap-position').textContent = 'Use the Word or PDF edition while the online reader is unavailable.';
  console.error('Curriculum could not load:', error.message);
}
