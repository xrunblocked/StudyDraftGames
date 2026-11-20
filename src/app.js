const STORAGE_FAVORITES_KEY = 'studydraft_favorites_v1';

/**
 * @typedef {Object} IframeConfig
 * @property {string} src
 * @property {string} [title]
 * @property {string} [allow]
 * @property {string} [sandbox]
 * @property {string} [html]
 */

/**
 * @typedef {Object} GameEntry
 * @property {string} id
 * @property {string} title
 * @property {string} category
 * @property {string} description
 * @property {string} controls
 * @property {string} [thumbnail]
 * @property {boolean} [featured]
 * @property {IframeConfig} iframe
 */

const PAGE_SIZE = 48;
const FEATURED_ROTATE_MS = 7000;

const state = {
  /** @type {GameEntry[]} */
  baseGames: [],
  /** @type {GameEntry[]} */
  featuredGames: [],
  featuredIndex: 0,
  /** @type {number | null} */
  featuredTimerId: null,
  featuredRemainingMs: FEATURED_ROTATE_MS,
  featuredLastTickAt: 0,
  featuredPaused: false,
  /** @type {string[]} */
  favorites: [],
  activeCategory: 'all',
  searchQuery: '',
  visibleLimit: PAGE_SIZE,
  /** @type {GameEntry | null} */
  currentGame: null,
  theaterWide: false,
};

const els = {
  catalogView: /** @type {HTMLElement} */ (document.getElementById('catalogView')),
  playerView: /** @type {HTMLElement} */ (document.getElementById('playerView')),
  gamesGrid: /** @type {HTMLElement} */ (document.getElementById('gamesGrid')),
  paginationBar: /** @type {HTMLElement} */ (document.getElementById('paginationBar')),
  paginationInfo: /** @type {HTMLElement} */ (document.getElementById('paginationInfo')),
  loadMoreBtn: /** @type {HTMLButtonElement} */ (document.getElementById('loadMoreBtn')),
  showAllBtn: /** @type {HTMLButtonElement} */ (document.getElementById('showAllBtn')),
  emptyState: /** @type {HTMLElement} */ (document.getElementById('emptyState')),
  errorState: /** @type {HTMLElement} */ (document.getElementById('errorState')),
  errorMessage: /** @type {HTMLElement} */ (document.getElementById('errorMessage')),
  resultCount: /** @type {HTMLElement} */ (document.getElementById('resultCount')),
  gameSearchInput: /** @type {HTMLInputElement} */ (document.getElementById('gameSearchInput')),
  heroSection: /** @type {HTMLElement | null} */ (document.getElementById('heroSection')),
  heroCopyStage: /** @type {HTMLElement | null} */ (document.getElementById('heroCopyStage')),
  heroKicker: /** @type {HTMLElement} */ (document.getElementById('heroKicker')),
  heroTitle: /** @type {HTMLElement} */ (document.getElementById('heroTitle')),
  heroDescription: /** @type {HTMLElement} */ (document.getElementById('heroDescription')),
  heroImage: /** @type {HTMLImageElement} */ (document.getElementById('heroImage')),
  heroBackdrop: /** @type {HTMLImageElement | null} */ (document.getElementById('heroBackdrop')),
  heroImageOutgoing: /** @type {HTMLImageElement | null} */ (document.getElementById('heroImageOutgoing')),
  heroMediaFrame: /** @type {HTMLElement} */ (document.getElementById('heroMediaFrame')),
  heroCarouselBar: /** @type {HTMLElement | null} */ (document.getElementById('heroCarouselBar')),
  heroDots: /** @type {HTMLElement | null} */ (document.getElementById('heroDots')),
  heroPrevBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('heroPrevBtn')),
  heroNextBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('heroNextBtn')),
  playFeaturedBtn: /** @type {HTMLButtonElement} */ (document.getElementById('playFeaturedBtn')),
  randomGameBtn: /** @type {HTMLButtonElement} */ (document.getElementById('randomGameBtn')),
  topbarRandomBtn: /** @type {HTMLButtonElement} */ (document.getElementById('topbarRandomBtn')),
  resetFiltersBtn: /** @type {HTMLButtonElement} */ (document.getElementById('resetFiltersBtn')),
  retryLoadBtn: /** @type {HTMLButtonElement} */ (document.getElementById('retryLoadBtn')),
  brandHomeLink: /** @type {HTMLAnchorElement} */ (document.getElementById('brandHomeLink')),
  backToLibraryBtn: /** @type {HTMLButtonElement} */ (document.getElementById('backToLibraryBtn')),
  playerTitle: /** @type {HTMLElement} */ (document.getElementById('playerTitle')),
  playerMeta: /** @type {HTMLElement} */ (document.getElementById('playerMeta')),
  playerDescription: /** @type {HTMLElement} */ (document.getElementById('playerDescription')),
  playerControlsText: /** @type {HTMLElement} */ (document.getElementById('playerControlsText')),
  iframeStage: /** @type {HTMLElement} */ (document.getElementById('iframeStage')),
  playerFavoriteBtn: /** @type {HTMLButtonElement} */ (document.getElementById('playerFavoriteBtn')),
  reloadFrameBtn: /** @type {HTMLButtonElement} */ (document.getElementById('reloadFrameBtn')),
  theaterToggleBtn: /** @type {HTMLButtonElement} */ (document.getElementById('theaterToggleBtn')),
  fullscreenBtn: /** @type {HTMLButtonElement} */ (document.getElementById('fullscreenBtn')),
  brandLogoImg: /** @type {HTMLImageElement | null} */ (document.getElementById('brandLogoImg')),
  appFavicon: /** @type {HTMLLinkElement | null} */ (document.getElementById('appFavicon')),
};

function loadLocalData() {
  try {
    const rawFavs = localStorage.getItem(STORAGE_FAVORITES_KEY);
    state.favorites = rawFavs ? JSON.parse(rawFavs) : [];
    if (!Array.isArray(state.favorites)) state.favorites = [];
  } catch {
    state.favorites = [];
  }
}

function saveFavorites() {
  localStorage.setItem(STORAGE_FAVORITES_KEY, JSON.stringify(state.favorites));
}

/**
 * @returns {GameEntry[]}
 */
function getAllGames() {
  return state.baseGames;
}

/**
 * @param {string} id
 * @returns {boolean}
 */
function isFavorite(id) {
  return state.favorites.includes(id);
}

/**
 * @param {string} id
 */
function toggleFavorite(id) {
  if (isFavorite(id)) {
    state.favorites = state.favorites.filter((item) => item !== id);
  } else {
    state.favorites = [...state.favorites, id];
  }
  saveFavorites();
  renderCatalog();
  if (state.currentGame && state.currentGame.id === id) {
    updatePlayerFavoriteButton();
  }
}

async function fetchGamesCatalog() {
  els.errorState.hidden = true;
  try {
    let response = await fetch('./games.json', { cache: 'no-store' });
    if (!response.ok) {
      response = await fetch('./public/games.json', { cache: 'no-store' });
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} while loading games catalog`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('games.json must contain a JSON array of game entries.');
    }
    state.baseGames = data.filter((entry) => entry && entry.id && entry.title && entry.iframe && entry.iframe.src);
    updateFeaturedHero();
    renderCatalog();
    handleInitialHash();
  } catch (err) {
    els.gamesGrid.innerHTML = '';
    els.paginationBar.hidden = true;
    els.emptyState.hidden = true;
    els.errorState.hidden = false;
    els.errorMessage.textContent = err instanceof Error ? err.message : 'Unable to load game catalog.';
  }
}

function clearFeaturedTimer() {
  if (state.featuredTimerId !== null) {
    window.clearTimeout(state.featuredTimerId);
    state.featuredTimerId = null;
  }
}

function scheduleFeaturedRotation(delayMs = FEATURED_ROTATE_MS) {
  clearFeaturedTimer();
  state.featuredRemainingMs = delayMs;
  if (state.featuredGames.length < 2 || state.featuredPaused || state.currentGame || document.hidden) {
    return;
  }
  state.featuredLastTickAt = performance.now();
  state.featuredTimerId = window.setTimeout(() => {
    state.featuredTimerId = null;
    showFeaturedAt(state.featuredIndex + 1, true);
  }, delayMs);
}

function setHeroPaused(paused) {
  state.featuredPaused = paused;
  if (els.heroSection) {
    els.heroSection.classList.toggle('is-paused', paused);
  }
  if (paused) {
    if (state.featuredTimerId !== null) {
      const elapsed = performance.now() - state.featuredLastTickAt;
      state.featuredRemainingMs = Math.max(400, state.featuredRemainingMs - elapsed);
      clearFeaturedTimer();
    }
  } else {
    scheduleFeaturedRotation(state.featuredRemainingMs);
  }
}

function buildHeroDots() {
  if (!els.heroCarouselBar || !els.heroDots) return;
  if (state.featuredGames.length < 2) {
    els.heroCarouselBar.hidden = true;
    return;
  }
  els.heroCarouselBar.hidden = false;
  els.heroDots.innerHTML = '';

  state.featuredGames.forEach((game, idx) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = `hero-dot${idx === state.featuredIndex ? ' is-active' : ''}`;
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-selected', idx === state.featuredIndex ? 'true' : 'false');
    dot.setAttribute('aria-label', `Feature ${game.title}`);
    dot.title = game.title;
    dot.addEventListener('click', () => {
      if (idx === state.featuredIndex) return;
      showFeaturedAt(idx, true);
    });
    els.heroDots?.appendChild(dot);
  });
}

function restartActiveDotAnimation() {
  if (!els.heroDots) return;
  const dots = els.heroDots.querySelectorAll('.hero-dot');
  dots.forEach((dot, idx) => {
    const active = idx === state.featuredIndex;
    dot.classList.remove('is-active');
    dot.setAttribute('aria-selected', active ? 'true' : 'false');
    if (active) {
      void /** @type {HTMLElement} */ (dot).offsetWidth;
      dot.classList.add('is-active');
    }
  });
}

/**
 * @param {number} targetIndex
 * @param {boolean} animate
 */
function showFeaturedAt(targetIndex, animate = true) {
  const list = state.featuredGames;
  if (list.length === 0) return;

  const nextIdx = ((targetIndex % list.length) + list.length) % list.length;
  const featured = list[nextIdx];
  const prevSrc = !els.heroImage.hidden ? els.heroImage.src : '';
  state.featuredIndex = nextIdx;

  if (animate && els.heroImageOutgoing && prevSrc && featured.thumbnail && prevSrc !== featured.thumbnail) {
    els.heroImageOutgoing.src = prevSrc;
    els.heroImageOutgoing.hidden = false;
    els.heroImageOutgoing.classList.remove('is-leaving');
    void els.heroImageOutgoing.offsetWidth;
    els.heroImageOutgoing.classList.add('is-leaving');
    els.heroImageOutgoing.onanimationend = () => {
      if (els.heroImageOutgoing) {
        els.heroImageOutgoing.hidden = true;
        els.heroImageOutgoing.classList.remove('is-leaving');
      }
    };
  }

  if (animate && els.heroCopyStage) {
    els.heroCopyStage.classList.remove('is-animating');
    void els.heroCopyStage.offsetWidth;
    els.heroCopyStage.classList.add('is-animating');
  }

  els.heroKicker.textContent = `Featured Game · ${featured.category} · ${featured.controls}`;
  els.heroTitle.textContent = featured.title;
  els.heroDescription.textContent = featured.description;

  const fallback = /** @type {HTMLElement} */ (els.heroMediaFrame.querySelector('.media-fallback'));
  const fallbackTitle = /** @type {HTMLElement} */ (fallback.querySelector('.fallback-title'));
  fallbackTitle.textContent = featured.title;

  if (featured.thumbnail) {
    els.heroImage.hidden = false;
    fallback.hidden = true;
    els.heroImage.classList.remove('is-entering');
    els.heroImage.src = featured.thumbnail;
    els.heroImage.alt = `${featured.title} preview`;
    if (els.heroBackdrop) {
      els.heroBackdrop.hidden = false;
      els.heroBackdrop.src = featured.thumbnail;
    }
    if (animate) {
      void els.heroImage.offsetWidth;
      els.heroImage.classList.add('is-entering');
    }
    els.heroImage.onerror = () => {
      els.heroImage.hidden = true;
      if (els.heroBackdrop) els.heroBackdrop.hidden = true;
      fallback.hidden = false;
    };
  } else {
    els.heroImage.hidden = true;
    if (els.heroBackdrop) els.heroBackdrop.hidden = true;
    fallback.hidden = false;
  }

  const launchFeatured = () => openGamePlayer(featured.id);
  els.playFeaturedBtn.onclick = launchFeatured;
  els.heroMediaFrame.onclick = launchFeatured;
  els.heroMediaFrame.setAttribute('aria-label', `Play ${featured.title}`);

  restartActiveDotAnimation();
  scheduleFeaturedRotation(FEATURED_ROTATE_MS);
}

function updateFeaturedHero() {
  const games = getAllGames();
  if (games.length === 0) return;
  let featuredList = games.filter((g) => g.featured && g.thumbnail);
  if (featuredList.length < 2) {
    featuredList = games.filter((g) => g.thumbnail).slice(0, 8);
  }
  if (featuredList.length === 0) {
    featuredList = [games[0]];
  }

  state.featuredGames = featuredList;
  state.featuredIndex = 0;

  // Preload thumbnails for smooth crossfades
  featuredList.forEach((game) => {
    if (game.thumbnail) {
      const preload = new Image();
      preload.referrerPolicy = 'no-referrer';
      preload.src = game.thumbnail;
    }
  });

  if (els.heroSection) {
    els.heroSection.style.setProperty('--hero-duration', `${FEATURED_ROTATE_MS}ms`);
  }

  buildHeroDots();
  showFeaturedAt(0, false);
}

/**
 * @returns {GameEntry[]}
 */
function getFilteredGames() {
  const query = state.searchQuery.trim().toLowerCase();
  return getAllGames().filter((game) => {
    const matchesCategory =
      state.activeCategory === 'all' ||
      (state.activeCategory === 'Favorites' ? isFavorite(game.id) : game.category === state.activeCategory);

    if (!matchesCategory) return false;
    if (!query) return true;

    return (
      game.title.toLowerCase().includes(query) ||
      game.category.toLowerCase().includes(query) ||
      game.description.toLowerCase().includes(query) ||
      game.controls.toLowerCase().includes(query)
    );
  });
}

function syncCategoryUI() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    const cat = btn.getAttribute('data-category');
    const isActive = cat === state.activeCategory;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  document.querySelectorAll('[data-nav-filter]').forEach((link) => {
    const cat = link.getAttribute('data-nav-filter');
    link.classList.toggle('active', cat === state.activeCategory && !state.currentGame);
  });
}

function renderCatalog() {
  syncCategoryUI();
  if (!els.errorState.hidden) return;

  const filtered = getFilteredGames();
  els.resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'game' : 'games'}`;
  els.gamesGrid.innerHTML = '';

  if (filtered.length === 0) {
    els.emptyState.hidden = false;
    els.paginationBar.hidden = true;
    return;
  }

  els.emptyState.hidden = true;

  const visibleGames = filtered.slice(0, state.visibleLimit);
  if (filtered.length > visibleGames.length) {
    els.paginationBar.hidden = false;
    els.paginationInfo.textContent = `Showing ${visibleGames.length} of ${filtered.length} games`;
    const remaining = filtered.length - visibleGames.length;
    els.loadMoreBtn.textContent = `Load ${Math.min(PAGE_SIZE, remaining)} More`;
    els.showAllBtn.textContent = `Show All (${filtered.length})`;
  } else {
    els.paginationBar.hidden = true;
  }

  const fragment = document.createDocumentFragment();
  visibleGames.forEach((game) => {
    const card = document.createElement('article');
    card.className = 'game-card';

    const thumbBtn = document.createElement('button');
    thumbBtn.type = 'button';
    thumbBtn.className = 'card-thumb-btn';
    thumbBtn.setAttribute('aria-label', `Play ${game.title}`);
    thumbBtn.addEventListener('click', () => openGamePlayer(game.id));

    const fallback = document.createElement('div');
    fallback.className = 'media-fallback';
    fallback.textContent = game.title;

    if (game.thumbnail) {
      const img = document.createElement('img');
      img.src = game.thumbnail;
      img.alt = `${game.title} thumbnail`;
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      fallback.hidden = true;
      img.addEventListener('error', () => {
        img.hidden = true;
        fallback.hidden = false;
      });
      thumbBtn.appendChild(img);
    }
    thumbBtn.appendChild(fallback);

    const body = document.createElement('div');
    body.className = 'card-body';

    const meta = document.createElement('p');
    meta.className = 'card-meta';
    const shortControls = game.controls.split('·')[0].trim();
    meta.textContent = `${game.category} · ${shortControls}`;

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = game.title;

    const desc = document.createElement('p');
    desc.className = 'card-desc';
    desc.textContent = game.description;

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'btn-primary card-play-btn';
    playBtn.textContent = 'Play';
    playBtn.addEventListener('click', () => openGamePlayer(game.id));

    const favBtn = document.createElement('button');
    favBtn.type = 'button';
    const favored = isFavorite(game.id);
    favBtn.className = `btn-secondary card-fav-btn${favored ? ' is-active' : ''}`;
    favBtn.textContent = favored ? 'Saved' : 'Save';
    favBtn.setAttribute('aria-pressed', favored ? 'true' : 'false');
    favBtn.addEventListener('click', () => toggleFavorite(game.id));

    actions.append(playBtn, favBtn);
    body.append(meta, title, desc, actions);
    card.append(thumbBtn, body);
    fragment.appendChild(card);
  });

  els.gamesGrid.appendChild(fragment);
}

/**
 * Build and mount the <iframe> element directly from the game's JSON entry.
 * @param {GameEntry} game
 */
function mountGameIframe(game) {
  els.iframeStage.innerHTML = '';

  const iframe = document.createElement('iframe');
  iframe.src = game.iframe.src;
  iframe.title = game.iframe.title || `${game.title} Game`;
  iframe.allow = game.iframe.allow || 'fullscreen; autoplay';
  if (game.iframe.sandbox) {
    iframe.setAttribute('sandbox', game.iframe.sandbox);
  }
  iframe.setAttribute('allowfullscreen', '');
  iframe.loading = 'eager';

  iframe.addEventListener('load', () => {
    try {
      iframe.focus();
    } catch {
      // Cross-origin iframe focus may be ignored by browser policy
    }
  });

  els.iframeStage.appendChild(iframe);
}

function updatePlayerFavoriteButton() {
  if (!state.currentGame) return;
  const favored = isFavorite(state.currentGame.id);
  els.playerFavoriteBtn.textContent = favored ? 'Saved' : 'Save';
  els.playerFavoriteBtn.classList.toggle('is-active', favored);
  els.playerFavoriteBtn.setAttribute('aria-pressed', favored ? 'true' : 'false');
}

/**
 * @param {string} gameId
 */
function openGamePlayer(gameId) {
  const game = getAllGames().find((item) => item.id === gameId);
  if (!game) return;

  state.currentGame = game;
  clearFeaturedTimer();
  els.catalogView.hidden = true;
  els.playerView.hidden = false;

  els.playerTitle.textContent = game.title;
  els.playerMeta.textContent = `${game.category} · ${game.controls}`;
  els.playerDescription.textContent = game.description;
  els.playerControlsText.textContent = game.controls;

  updatePlayerFavoriteButton();
  mountGameIframe(game);
  syncCategoryUI();

  if (window.location.hash !== `#play/${game.id}`) {
    history.replaceState(null, '', `#play/${game.id}`);
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function closeGamePlayer() {
  state.currentGame = null;
  els.iframeStage.innerHTML = '';
  els.playerView.hidden = true;
  els.catalogView.hidden = false;
  els.playerView.classList.remove('theater-wide');
  state.theaterWide = false;
  els.theaterToggleBtn.textContent = 'Wide View';
  els.theaterToggleBtn.classList.remove('is-active');
  syncCategoryUI();
  scheduleFeaturedRotation(FEATURED_ROTATE_MS);

  if (window.location.hash.startsWith('#play/')) {
    history.replaceState(null, '', '#catalog');
  }
}

function handleInitialHash() {
  const hash = window.location.hash;
  if (hash.startsWith('#play/')) {
    const id = hash.slice('#play/'.length);
    if (getAllGames().some((g) => g.id === id)) {
      openGamePlayer(id);
    }
  }
}

function bindEvents() {
  // Category segmented tabs
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeCategory = btn.getAttribute('data-category') || 'all';
      state.visibleLimit = PAGE_SIZE;
      renderCatalog();
    });
  });

  // Topbar nav filters
  document.querySelectorAll('[data-nav-filter]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const category = link.getAttribute('data-nav-filter') || 'all';
      state.activeCategory = category;
      state.visibleLimit = PAGE_SIZE;
      if (state.currentGame) {
        closeGamePlayer();
      }
      renderCatalog();
    });
  });

  els.brandHomeLink.addEventListener('click', (e) => {
    e.preventDefault();
    state.activeCategory = 'all';
    state.searchQuery = '';
    state.visibleLimit = PAGE_SIZE;
    els.gameSearchInput.value = '';
    if (state.currentGame) {
      closeGamePlayer();
    }
    renderCatalog();
  });

  els.gameSearchInput.addEventListener('input', (e) => {
    const target = /** @type {HTMLInputElement} */ (e.target);
    state.searchQuery = target.value;
    state.visibleLimit = PAGE_SIZE;
    renderCatalog();
  });

  els.loadMoreBtn.addEventListener('click', () => {
    state.visibleLimit += PAGE_SIZE;
    renderCatalog();
  });

  els.showAllBtn.addEventListener('click', () => {
    state.visibleLimit = getAllGames().length + 1000;
    renderCatalog();
  });

  els.resetFiltersBtn.addEventListener('click', () => {
    state.activeCategory = 'all';
    state.searchQuery = '';
    state.visibleLimit = PAGE_SIZE;
    els.gameSearchInput.value = '';
    renderCatalog();
  });

  els.retryLoadBtn.addEventListener('click', () => {
    fetchGamesCatalog();
  });

  function launchRandomGame() {
    const games = getAllGames();
    if (games.length === 0) return;
    const pick = games[Math.floor(Math.random() * games.length)];
    openGamePlayer(pick.id);
  }

  els.randomGameBtn.addEventListener('click', launchRandomGame);
  els.topbarRandomBtn.addEventListener('click', launchRandomGame);

  // Player controls
  els.backToLibraryBtn.addEventListener('click', closeGamePlayer);

  els.playerFavoriteBtn.addEventListener('click', () => {
    if (state.currentGame) toggleFavorite(state.currentGame.id);
  });

  els.reloadFrameBtn.addEventListener('click', () => {
    if (state.currentGame) mountGameIframe(state.currentGame);
  });

  els.theaterToggleBtn.addEventListener('click', () => {
    state.theaterWide = !state.theaterWide;
    els.playerView.classList.toggle('theater-wide', state.theaterWide);
    els.theaterToggleBtn.classList.toggle('is-active', state.theaterWide);
    els.theaterToggleBtn.textContent = state.theaterWide ? 'Standard View' : 'Wide View';
  });

  els.fullscreenBtn.addEventListener('click', () => {
    const iframe = els.iframeStage.querySelector('iframe');
    const target = iframe || els.iframeStage;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (target.requestFullscreen) {
      target.requestFullscreen().catch(() => {});
    }
  });

  // Featured carousel controls & pause on hover / tab hidden
  if (els.heroPrevBtn) {
    els.heroPrevBtn.addEventListener('click', () => {
      showFeaturedAt(state.featuredIndex - 1, true);
    });
  }

  if (els.heroNextBtn) {
    els.heroNextBtn.addEventListener('click', () => {
      showFeaturedAt(state.featuredIndex + 1, true);
    });
  }

  if (els.heroSection) {
    els.heroSection.addEventListener('mouseenter', () => setHeroPaused(true));
    els.heroSection.addEventListener('mouseleave', () => setHeroPaused(false));
  }

  els.heroMediaFrame.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      els.heroMediaFrame.click();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      setHeroPaused(true);
    } else {
      setHeroPaused(false);
    }
  });
}

function bindLogoFallback() {
  if (!els.brandLogoImg) return;
  const applyFallback = () => {
    const logoFallback = './public/assets/aistudio/STUDY_DRAFT_2f72f02d.png';
    const iconFallback = './public/assets/aistudio/STUDY_DRAFT__1__69f40c81.png';
    if (els.brandLogoImg && !els.brandLogoImg.src.includes('/public/')) {
      els.brandLogoImg.src = logoFallback;
    }
    if (els.appFavicon) {
      els.appFavicon.href = iconFallback;
    }
    document.querySelectorAll('link[rel="apple-touch-icon"]').forEach((link) => {
      link.setAttribute('href', iconFallback);
    });
  };

  if (els.brandLogoImg.complete && els.brandLogoImg.naturalWidth === 0) {
    applyFallback();
  } else {
    els.brandLogoImg.addEventListener('error', applyFallback, { once: true });
  }
}

function init() {
  bindLogoFallback();
  loadLocalData();
  bindEvents();
  fetchGamesCatalog();
}

init();
