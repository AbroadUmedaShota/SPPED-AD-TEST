const APP_ROOT_PREFIX = window.location.pathname.includes('/customer-voices/') ? '../' : '';

export function resolveAppRootPath(path) {
  if (!path) {
    return path;
  }
  if (/^(https?:)?\/\//.test(path)) {
    return path;
  }
  return `${APP_ROOT_PREFIX}${path.replace(/^\/+/, '')}`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function loadVoiceCollection() {
  const response = await fetch(resolveAppRootPath('data/customer-voices.json'));
  if (!response.ok) {
    throw new Error(`Failed to load customer voices: ${response.status}`);
  }
  return response.json();
}

export function getPublishedVoices(collection) {
  return Array.isArray(collection?.voices)
    ? collection.voices.filter((voice) => voice?.publishStatus === 'published')
    : [];
}

export function getVoicePageLabel(voice = {}) {
  return voice.voicePageLabel || voice.label || '';
}

export function getVoicePageSummary(voice = {}) {
  return voice.voicePageSummary || voice.listingSummary || '';
}

export function renderFeatureList(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return '';
  }
  return `
    <ul class="voice-feature-list">
      ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
    </ul>
  `;
}

export function renderParagraphs(items = []) {
  const normalized = Array.isArray(items) ? items : items ? [items] : [];
  if (normalized.length === 0) {
    return '';
  }
  return normalized.map((item) => `<p>${escapeHtml(item)}</p>`).join('');
}

export function renderBullets(items = []) {
  const normalized = Array.isArray(items) ? items : items ? [items] : [];
  if (normalized.length === 0) {
    return '';
  }
  return `
    <ul class="voice-detail-list">
      ${normalized.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
    </ul>
  `;
}

const registeredRevealElements = new WeakSet();
let revealObserver = null;
let supportsIntersectionReveal = false;
let revealInitialized = false;

function markRevealReady() {
  if (document.body) {
    document.body.classList.add('is-ready');
  }
}

function collectRevealElements(root = document) {
  const revealElements = [];
  if (root?.nodeType === Node.ELEMENT_NODE && root.matches('[data-reveal]')) {
    revealElements.push(root);
  }
  if (typeof root?.querySelectorAll === 'function') {
    revealElements.push(...root.querySelectorAll('[data-reveal]'));
  }
  return revealElements;
}

function registerRevealElement(element) {
  if (!element || registeredRevealElements.has(element)) {
    return;
  }

  registeredRevealElements.add(element);

  if (supportsIntersectionReveal && revealObserver) {
    revealObserver.observe(element);
    return;
  }

  element.classList.add('is-visible');
}

export function refreshRevealAnimations(root = document) {
  if (!revealInitialized) {
    setupRevealAnimations();
    return;
  }

  collectRevealElements(root).forEach(registerRevealElement);
  markRevealReady();
}

export function setupRevealAnimations() {
  if (!revealInitialized) {
    revealInitialized = true;
    supportsIntersectionReveal = 'IntersectionObserver' in window;

    if (supportsIntersectionReveal) {
      revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              return;
            }
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.16 }
      );
    }
  }

  refreshRevealAnimations(document);
}
