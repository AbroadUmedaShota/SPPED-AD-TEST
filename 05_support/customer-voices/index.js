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

function renderGenericVoiceGuide() {
  return `
    <div class="voice-detail-card" data-reveal>
      <h2>公開中の導入事例を順次ご案内しています</h2>
      <div class="voice-detail-body">
        <p>展示会やアンケート運用での活用イメージは、公開可能な範囲で順次更新しています。</p>
        <p><a class="voice-inline-link" href="../help/">ヘルプセンターを見る</a></p>
      </div>
    </div>
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
    if (!voices.length) {
      count.textContent = '公開準備中';
      grid.innerHTML = renderGenericVoiceGuide();
      refreshRevealAnimations(grid);
      return;
    }
    grid.innerHTML = voices.map(renderVoiceCard).join('');
    grid.querySelectorAll('.voice-listing-card__media img')
      .forEach((image) => applyImageFallback(image));
    refreshRevealAnimations(grid);
  } catch (error) {
    console.warn('導入事例一覧の読み込みに失敗しました:', error);
    count.textContent = '公開事例';
    grid.innerHTML = renderGenericVoiceGuide();
    refreshRevealAnimations(grid);
  }
});
