const state = {
  cards: [],
  displayCards: [],
  index: 0,
  answerVisible: false,
  filter: 'all',
  learned: new Set(),
};

const frontText    = document.getElementById('frontText');
const present      = document.getElementById('present');
const aorist       = document.getElementById('aorist');
const future       = document.getElementById('future');
const imperative   = document.getElementById('imperative');
const translation  = document.getElementById('translation');
const progress     = document.getElementById('progress');
const progressBar  = document.getElementById('progressBar');
const learnedBadge = document.getElementById('learnedBadge');
const cardEl       = document.getElementById('card');
const cardInner    = document.getElementById('cardInner');

const prevBtn       = document.getElementById('prevBtn');
const nextBtn       = document.getElementById('nextBtn');
const shuffleBtn    = document.getElementById('shuffleBtn');
const learnedBtn    = document.getElementById('learnedBtn');
const speakBtn         = document.getElementById('speakBtn');
const listBtn          = document.getElementById('listBtn');
const verbListPanel    = document.getElementById('verbListPanel');
const verbListBackdrop = document.getElementById('verbListBackdrop');
const verbListGrid     = document.getElementById('verbListGrid');
const verbSearch       = document.getElementById('verbSearch');
const filterBtns    = document.querySelectorAll('.filter-btn');

// ---------- Speech ----------

let currentAudio = null;

function speak(text) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
    speakBtn.classList.remove('speaking');
  }

  const url = `/tts?q=${encodeURIComponent(text)}`;
  const audio = new Audio(url);
  currentAudio = audio;

  speakBtn.classList.add('speaking');
  audio.onended = () => { speakBtn.classList.remove('speaking'); currentAudio = null; };
  audio.onerror = () => { speakBtn.classList.remove('speaking'); currentAudio = null; };
  audio.play().catch(() => { speakBtn.classList.remove('speaking'); currentAudio = null; });
}

// ---------- localStorage ----------

function loadLearned() {
  try {
    const raw = localStorage.getItem('greek_learned');
    if (raw) JSON.parse(raw).forEach((k) => state.learned.add(k));
  } catch (_) { /* ignore */ }
}

function saveLearned() {
  localStorage.setItem('greek_learned', JSON.stringify([...state.learned]));
}

// ---------- CSV ----------

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.slice(1).map((line) => {
    const parts = line.split(',');
    return {
      present:     parts[0] || '',
      aorist:      parts[1] || '',
      future:      parts[2] || '',
      imperative:  parts[3] || '',
      translation: parts.slice(4).join(',') || '',
    };
  });
}

// ---------- Filter ----------

function getFilteredCards() {
  if (state.filter === 'learned')   return state.cards.filter((c) =>  state.learned.has(c.present));
  if (state.filter === 'unlearned') return state.cards.filter((c) => !state.learned.has(c.present));
  return [...state.cards];
}

function applyFilter() {
  state.displayCards = getFilteredCards();
  state.index = 0;
  state.answerVisible = false;
}

// ---------- Navigation ----------

function navigate(delta) {
  if (!state.displayCards.length) return;

  // Reset flip instantly (no transition) before showing new card
  cardInner.style.transitionDuration = '0s';
  cardInner.classList.remove('flipped');
  void cardInner.offsetWidth;                 // force reflow
  cardInner.style.transitionDuration = '';    // re-enable CSS transition

  state.index = (state.index + delta + state.displayCards.length) % state.displayCards.length;
  state.answerVisible = false;
  render();

  // Slide-in animation
  cardEl.classList.remove('card-anim');
  void cardEl.offsetWidth;
  cardEl.classList.add('card-anim');
}

// ---------- Reveal ----------

function toggleReveal() {
  if (!state.displayCards.length) return;
  state.answerVisible = !state.answerVisible;
  cardInner.classList.toggle('flipped', state.answerVisible);
}

// ---------- Learned ----------

function toggleLearned() {
  if (!state.displayCards.length) return;
  const card = state.displayCards[state.index];
  const prevIndex = state.index;

  if (state.learned.has(card.present)) {
    state.learned.delete(card.present);
  } else {
    state.learned.add(card.present);
  }
  saveLearned();

  if (state.filter !== 'all') {
    state.displayCards = getFilteredCards();
    state.index = Math.min(prevIndex, Math.max(0, state.displayCards.length - 1));
  }
  render();
}

// ---------- Shuffle ----------

function shuffleCards() {
  for (let i = state.displayCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.displayCards[i], state.displayCards[j]] = [state.displayCards[j], state.displayCards[i]];
  }
  state.index = 0;
  state.answerVisible = false;

  // Reset flip and play enter animation
  cardInner.classList.remove('flipped');
  render();
  cardEl.classList.remove('card-anim');
  void cardEl.offsetWidth;
  cardEl.classList.add('card-anim');
}

// ---------- Render ----------

function render() {
  const total        = state.displayCards.length;
  const allTotal     = state.cards.length;
  const learnedCount = state.learned.size;

  document.querySelector('[data-filter="learned"]').textContent =
    learnedCount ? `Повторять (${learnedCount})` : 'Повторять';

  if (!verbListPanel.classList.contains('hidden')) renderVerbList();

  if (!total) {
    frontText.textContent = 'Нет карточек для показа';
    progress.textContent  = `0 / 0`;
    progressBar.style.width = '0%';
    learnedBadge.classList.add('hidden');
    cardEl.classList.remove('card--learned');
    learnedBtn.classList.remove('btn--learned');
    learnedBtn.textContent = 'Изучено';
    return;
  }

  const card      = state.displayCards[state.index];
  const isLearned = state.learned.has(card.present);

  frontText.textContent   = card.present;
  present.textContent     = card.present;
  aorist.textContent      = card.aorist;
  future.textContent      = card.future;
  imperative.textContent  = card.imperative;
  translation.textContent = card.translation;

  progress.textContent    = `${state.index + 1} / ${total}`;
  progressBar.style.width = `${((state.index + 1) / total) * 100}%`;

  cardInner.classList.toggle('flipped', state.answerVisible);

  if (isLearned) {
    learnedBadge.classList.remove('hidden');
    cardEl.classList.add('card--learned');
    if (state.filter === 'learned') {
      learnedBtn.classList.remove('btn--learned');
      learnedBtn.classList.add('btn--reset');
      learnedBtn.textContent = 'Сбросить';
    } else {
      learnedBtn.classList.remove('btn--reset');
      learnedBtn.classList.add('btn--learned');
      learnedBtn.textContent = '✓ Изучено';
    }
  } else {
    learnedBadge.classList.add('hidden');
    cardEl.classList.remove('card--learned');
    learnedBtn.classList.remove('btn--learned', 'btn--reset');
    learnedBtn.textContent = 'Изучено';
  }
}

// ---------- Verb list panel ----------

function renderVerbList() {
  const currentCard = state.displayCards[state.index];
  const query = verbSearch.value.trim().toLowerCase();
  const filtered = query
    ? state.cards.filter((c) =>
        c.present.toLowerCase().includes(query) ||
        c.translation.toLowerCase().includes(query)
      )
    : state.cards;

  verbListGrid.innerHTML = '';

  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.className = 'verb-list-empty';
    empty.textContent = 'Ничего не найдено';
    verbListGrid.appendChild(empty);
    return;
  }

  filtered.forEach((card) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'verb-chip';
    const verbSpan = document.createElement('span');
    verbSpan.className = 'verb-chip-word';
    verbSpan.textContent = card.present;
    const transSpan = document.createElement('span');
    transSpan.className = 'verb-chip-trans';
    transSpan.textContent = card.translation;
    chip.append(verbSpan, transSpan);

    if (state.learned.has(card.present)) chip.classList.add('is-learned');
    if (currentCard && card.present === currentCard.present) chip.classList.add('is-current');
    chip.addEventListener('click', () => {
      state.filter = 'all';
      filterBtns.forEach((b) => b.classList.remove('active'));
      document.querySelector('[data-filter="all"]').classList.add('active');
      applyFilter();
      const idx = state.displayCards.findIndex((c) => c.present === card.present);
      if (idx !== -1) state.index = idx;
      state.answerVisible = false;
      cardInner.classList.remove('flipped');
      render();
      cardEl.classList.remove('card-anim');
      void cardEl.offsetWidth;
      cardEl.classList.add('card-anim');
      closeVerbList();
    });
    verbListGrid.appendChild(chip);
  });
}

function closeVerbList() {
  verbListPanel.classList.add('closing');
  verbListBackdrop.classList.add('closing');
  setTimeout(() => {
    verbListPanel.classList.add('hidden');
    verbListPanel.classList.remove('closing');
    verbListBackdrop.classList.add('hidden');
    verbListBackdrop.classList.remove('closing');
    listBtn.classList.remove('active');
  }, 230);
}

function openVerbList() {
  verbSearch.value = '';
  renderVerbList();
  verbListBackdrop.classList.remove('hidden');
  verbListPanel.classList.remove('hidden');
  listBtn.classList.add('active');
  setTimeout(() => verbSearch.focus(), 280);
}

listBtn.addEventListener('click', () => {
  verbListPanel.classList.contains('hidden') ? openVerbList() : closeVerbList();
});

document.getElementById('verbListClose').addEventListener('click', closeVerbList);
verbListBackdrop.addEventListener('click', closeVerbList);
verbSearch.addEventListener('input', renderVerbList);

// ---------- Load ----------

async function loadCards() {
  try {
    const res  = await fetch('greek_B1_verbs.csv');
    const text = await res.text();
    state.cards = parseCsv(text);
    loadLearned();
    applyFilter();
    render();
    cardEl.classList.add('card-anim');
  } catch (_) {
    frontText.textContent = 'Не удалось загрузить CSV';
    progress.textContent  = '0 / 0';
  }
}

// ---------- Events ----------

prevBtn.addEventListener('click', () => navigate(-1));
nextBtn.addEventListener('click', () => navigate(1));

cardEl.addEventListener('click', (e) => {
  // Don't flip if clicking buttons inside the card (none currently, but safe guard)
  if (e.target.closest('button')) return;
  toggleReveal();
});

speakBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!state.displayCards.length) return;
  speak(state.displayCards[state.index].present);
});

learnedBtn.addEventListener('click', toggleLearned);
shuffleBtn.addEventListener('click', shuffleCards);

filterBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    state.filter = btn.dataset.filter;
    filterBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilter();
    render();
    cardInner.classList.remove('flipped');
    cardEl.classList.remove('card-anim');
    void cardEl.offsetWidth;
    cardEl.classList.add('card-anim');
  });
});

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  switch (e.key) {
    case 'ArrowLeft':  navigate(-1); break;
    case 'ArrowRight': navigate(1);  break;
    case ' ':
    case 'Enter':
      e.preventDefault();
      toggleReveal();
      break;
    case 'l':
    case 'L':
      toggleLearned();
      break;
    case 's':
    case 'S':
      if (state.displayCards.length) speak(state.displayCards[state.index].present);
      break;
  }
});

loadCards();
