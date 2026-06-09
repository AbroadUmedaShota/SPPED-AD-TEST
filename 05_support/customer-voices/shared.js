import { resolveSupportBasePath } from '../assets/js/utils.js';

const VOICE_COLLECTION_VERSION = '20260522-remove-primary-caption';
const VOICE_FETCH_TIMEOUT_MS = 5000;
const VOICE_RETRY_DELAY_MS = 600;
const VOICE_FETCH_ATTEMPTS = 2;

export function resolveAppRootPath(path) {
  if (!path) {
    return path;
  }
  if (/^(https?:)?\/\//.test(path)) {
    return path;
  }
  const base = resolveSupportBasePath();
  const clean = path.replace(/^\/+/, '');
  if (clean.startsWith('assets/')) {
    return `${base}/${clean}`;
  }
  if (clean.startsWith('data/') || clean.startsWith('img/')) {
    return `${base}/assets/${clean}`;
  }
  return `${base}/${clean}`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function fetchWithTimeout(url, timeoutMs = VOICE_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function fetchJsonWithRetry(url, options = {}) {
  const timeoutMs = options.timeoutMs || VOICE_FETCH_TIMEOUT_MS;
  const retryDelayMs = options.retryDelayMs || VOICE_RETRY_DELAY_MS;
  const attempts = options.attempts || VOICE_FETCH_ATTEMPTS;
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, timeoutMs);
      if (!response.ok) {
        throw new Error(`Failed to load JSON: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await delay(retryDelayMs);
      }
    }
  }

  throw lastError || new Error('Failed to load JSON.');
}

export async function loadVoiceCollection() {
  return fetchJsonWithRetry(resolveAppRootPath(`data/customer-voices.json?v=${VOICE_COLLECTION_VERSION}`));
}

export function applyImageFallback(image, label = '画像を表示できません') {
  if (!image) {
    return;
  }
  const frame = image.closest('[data-image-frame]') || image.parentElement;
  if (!frame) {
    return;
  }
  let fallback = frame.querySelector('[data-image-fallback]');
  if (!fallback) {
    fallback = document.createElement('span');
    fallback.className = 'voice-image-fallback';
    fallback.dataset.imageFallback = '';
    fallback.hidden = true;
    frame.appendChild(fallback);
  }
  fallback.textContent = label;
  fallback.hidden = true;
  frame.classList.remove('is-image-unavailable');
  frame.classList.add('voice-image-frame');
  image.hidden = false;

  const showFallback = () => {
    frame.classList.add('is-image-unavailable');
    image.hidden = true;
    fallback.hidden = false;
  };

  image.addEventListener('error', showFallback, { once: true });
  if (image.complete && image.naturalWidth === 0) {
    showFallback();
  }
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
