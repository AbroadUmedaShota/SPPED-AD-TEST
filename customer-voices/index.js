import {
  escapeHtml,
  getPublishedVoices,
  loadVoiceCollection,
  refreshRevealAnimations,
  renderFeatureList,
  resolveAppRootPath,
  setupRevealAnimations,
} from './shared.js';

function renderVoiceCard(voice, index) {
  return `
    <a
      class="voice-listing-card"
      href="./${escapeHtml(voice.slug)}.html"
      data-reveal
      style="transition-delay: ${index * 70}ms;"
    >
      <div class="voice-listing-card__media">
        <img src="${resolveAppRootPath(voice.heroImage || 'img/top-kv.jpg')}" alt="${escapeHtml(voice.label)}のイメージ">
      </div>
      <div class="voice-listing-card__content">
        <div class="voice-listing-card__meta">
          <span class="voice-pill">${escapeHtml(voice.organizationType)}</span>
          <span class="voice-pill">導入事例</span>
        </div>
        <h2 class="voice-listing-card__title">${escapeHtml(voice.label)}</h2>
        <p class="voice-listing-card__summary">${escapeHtml(voice.listingSummary)}</p>
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
    count.textContent = `${voices.length}件の公開事例`;
    grid.innerHTML = voices.map(renderVoiceCard).join('');
    refreshRevealAnimations(grid);
  } catch (error) {
    count.textContent = '公開準備中';
    grid.innerHTML = `
      <div class="voice-detail-card" data-reveal>
        <h2>お客様のお声を準備しています</h2>
        <div class="voice-detail-body">
          <p>導入事例の読み込みに失敗しました。時間をおいて再度お試しください。</p>
        </div>
      </div>
    `;
    refreshRevealAnimations(grid);
  }
});
