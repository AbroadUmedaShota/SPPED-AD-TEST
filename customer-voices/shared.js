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

export function setupRevealAnimations() {
  const revealElements = document.querySelectorAll('[data-reveal]');
  if (revealElements.length === 0) {
    document.body.classList.add('is-ready');
    return;
  }

  const markReady = () => {
    document.body.classList.add('is-ready');
  };

  if (!('IntersectionObserver' in window)) {
    revealElements.forEach((element) => element.classList.add('is-visible'));
    markReady();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.16 }
  );

  revealElements.forEach((element) => observer.observe(element));
  requestAnimationFrame(markReady);
}
