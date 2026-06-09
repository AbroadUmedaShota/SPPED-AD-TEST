import {
  applyImageFallback,
  escapeHtml,
  getPublishedVoices,
  loadVoiceCollection,
  refreshRevealAnimations,
  renderFeatureList,
  resolveAppRootPath,
  setupRevealAnimations,
} from './shared.js?v=20260609-resilience';

function getVoicePageLabel(voice = {}) {
  return voice.voicePageLabel || voice.label || '';
}

function getVoicePageSummary(voice = {}) {
  return voice.voicePageSummary || voice.listingSummary || '';
}

function renderVoiceCard(voice, index) {
  const label = getVoicePageLabel(voice);
  const summary = getVoicePageSummary(voice);
  return `
    <a
      class="voice-listing-card"
      href="./${escapeHtml(voice.slug)}/"
      data-reveal
      style="transition-delay: ${index * 70}ms;"
    >
      <div class="voice-listing-card__media" data-image-frame>
        <img src="${resolveAppRootPath(voice.heroImage || 'img/top-kv.jpg')}" alt="${escapeHtml(label)}のイメージ">
        <span class="voice-image-fallback" data-image-fallback hidden>画像を表示できません</span>
      </div>
      <div class="voice-listing-card__content">
        <div class="voice-listing-card__meta">
          <span class="voice-pill">${escapeHtml(voice.organizationType)}</span>
          <span class="voice-pill">導入事例</span>
        </div>
        <h2 class="voice-listing-card__title">${escapeHtml(label)}</h2>
        <p class="voice-listing-card__summary">${escapeHtml(summary)}</p>
        ${renderFeatureList(voice.usedFeatures || [])}
        <span class="voice-inline-link">詳細を見る</span>
      </div>
    </a>
  `;
}

document.addEventListener('DOMContentLoaded', async () => {
  setupRevealAnimations();

  const grid = document.getElementById('voice-index-grid');
  const count = document.getElementById('voice-count');
  if (!grid || !count) {
    return;
  }

  try {
    const collection = await loadVoiceCollection();
    const voices = getPublishedVoices(collection);
    count.textContent = `${voices.length}件の導入事例`;
    grid.innerHTML = voices.map(renderVoiceCard).join('');
    grid.querySelectorAll('.voice-listing-card__media img')
      .forEach((image) => applyImageFallback(image));
    refreshRevealAnimations(grid);
  } catch (error) {
    count.textContent = '一時的に表示できません';
    grid.innerHTML = `
      <div class="voice-detail-card" data-reveal>
        <h2>導入事例を表示できませんでした</h2>
        <div class="voice-detail-body">
          <p>通信状態を確認し、時間をおいて再度お試しください。</p>
        </div>
      </div>
    `;
    refreshRevealAnimations(grid);
  }
});
