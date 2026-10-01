const list = document.querySelector('#flashcard-list');
const topic = document.querySelector('#quiz-topic');
const position = document.querySelector('#flashcard-position');
const count = document.querySelector('#flashcard-topic-count');

if (list && topic && position) {
  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.id = 'open-flashcard-review';
  launcher.className = 'flashcard-launcher';
  launcher.setAttribute('aria-haspopup', 'dialog');
  launcher.setAttribute('aria-controls', 'flashcard-review-dialog');
  launcher.innerHTML = '<span class="section-step" aria-hidden="true">01</span><span class="flashcard-launch-copy"><strong>A little review goes a long way</strong><span id="flashcard-launch-summary">Loading your topic flashcards…</span><span class="flashcard-launch-action">Open focused review <span aria-hidden="true">↗</span></span></span>';
  list.before(launcher);

  const dialog = document.createElement('dialog');
  dialog.id = 'flashcard-review-dialog';
  dialog.className = 'flashcard-review-dialog';
  dialog.setAttribute('aria-labelledby', 'flashcard-review-title');
  dialog.setAttribute('aria-describedby', 'flashcard-review-hint');
  dialog.innerHTML = '<header class="flashcard-review-header"><div><p class="eyebrow">ONE QUESTION AT A TIME</p><h2 id="flashcard-review-title" tabindex="-1">Topic flashcards</h2><p id="flashcard-review-hint">Review the question and explanation. Use the arrows to move between cards.</p></div><button class="flashcard-review-close" type="button" aria-label="Close flashcard review">Close <span aria-hidden="true">×</span></button></header><div class="flashcard-review-body"></div><footer class="flashcard-review-footer"><span>Arrow keys move between cards. Esc closes the review.</span><button id="flashcard-to-quiz" type="button">Continue to topic quiz →</button></footer>';
  dialog.querySelector('.flashcard-review-body').append(list);
  document.body.append(dialog);

  const title = dialog.querySelector('#flashcard-review-title');
  const summary = launcher.querySelector('#flashcard-launch-summary');
  function refresh() {
    const name = topic.value || 'Topic';
    const cardPosition = position.textContent.trim();
    title.textContent = `${name} flashcards`;
    summary.textContent = cardPosition ? `${name} · ${cardPosition} · Review in a focused popup` : (count?.textContent || 'Loading your topic flashcards…');
    launcher.disabled = !cardPosition;
  }
  new MutationObserver(refresh).observe(position, {childList:true,subtree:true,characterData:true});
  if (count) new MutationObserver(refresh).observe(count, {childList:true,subtree:true,characterData:true});
  topic.addEventListener('change', refresh);
  refresh();

  let continueToQuiz = false;
  launcher.addEventListener('click', () => {
    continueToQuiz = false;
    refresh();
    dialog.showModal();
    document.documentElement.classList.add('flashcard-review-open');
    title.focus({preventScroll:true});
  });
  dialog.querySelector('.flashcard-review-close').addEventListener('click', () => dialog.close());
  dialog.querySelector('#flashcard-to-quiz').addEventListener('click', () => { continueToQuiz = true; dialog.close(); });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('flashcard-review-open');
    const destination = continueToQuiz ? document.querySelector('#student-name') : launcher;
    destination?.focus({preventScroll:!continueToQuiz});
    if (continueToQuiz) destination?.scrollIntoView({block:'center',behavior:'smooth'});
    continueToQuiz = false;
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Tab') {
      const controls = [...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === title)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.matches('input,textarea,select,[contenteditable]')) return;
    const id = event.key === 'ArrowLeft' ? 'flashcard-prev' : event.key === 'ArrowRight' ? 'flashcard-next' : null;
    if (id) { event.preventDefault(); document.getElementById(id)?.click(); }
  });
}
