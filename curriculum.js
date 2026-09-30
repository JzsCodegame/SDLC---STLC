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
    card.dataset.current = String(card.dataset.section === section.id);
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

function selectSection(id, {scroll = true, record = true} = {}) {
  const section = sections.find(item => item.id === id);
  if (!section) return;
  readingMode(false);
  $('curriculum-search').value = '';
  filterSections();
  details.forEach(node => { node.open = node.id === id; });
  updatePosition(section);
  if (record && location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
  if (scroll) {
    $(id).scrollIntoView({block: 'start'});
    $(id).querySelector('summary').focus({preventScroll: true});
  }
}

function filterSections() {
  const term = $('curriculum-search').value.trim().toLocaleLowerCase();
  let count = 0;
  details.forEach((node, i) => {
    const section = sections[i];
    const text = [section.title, ...section.blocks.map(b => b.text || b.rows?.flat().join(' ') || '')].join(' ');
    node.hidden = !text.toLocaleLowerCase().includes(term);
    if (!node.hidden) count++;
  });
  document.querySelector('.course-roadmap').hidden = !!term;
  $('section-count').textContent = term ? `${count} of ${sections.length} sections match` : `${sections.length} sections`;
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

try {
  const response = await fetch('curriculum-data.json');
  if (!response.ok) throw new Error(`Curriculum response ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.sections) || !data.sections.length) throw new Error('Missing sections');
  sections = data.sections;
  moduleSections = sections.filter(s => s.module);
  $('curriculum-sections').replaceChildren();
  for (const section of moduleSections) {
    const card = el('article', undefined, 'module-card');
    card.dataset.section = section.id;
    card.append(el('span', `MODULE ${String(section.module).padStart(2, '0')}`, 'module-number'), el('h3', section.moduleTitle));
    const button = el('button', 'Read module scope →');
    button.addEventListener('click', () => selectSection(section.id));
    card.append(button, lessonLink(section.module) || el('span', 'Curriculum scope', 'scope-label'));
    $('course-modules').append(card);
  }
  sections.forEach((section, i) => {
    const node = el('details', undefined, 'curriculum-section');
    node.id = section.id;
    node.name = 'curriculum-sections';
    const summary = el('summary', section.title);
    summary.addEventListener('click', event => {
      event.preventDefault();
      if (node.open) node.open = false;
      else selectSection(section.id, {scroll: false});
    });
    node.append(summary);
    const body = el('div', undefined, 'section-body');
    renderBlocks(section.blocks, body);
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
  const empty = el('p', 'No matching sections. Try a broader term or clear the search.');
  empty.id = 'no-results';
  empty.hidden = true;
  $('curriculum-sections').append(empty);
  $('curriculum-search').addEventListener('input', filterSections);
  filterSections();
  const followHash = () => {
    if (location.hash) selectSection(location.hash.slice(1), {record: false});
    else { details.forEach(node => { node.open = false; }); }
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
