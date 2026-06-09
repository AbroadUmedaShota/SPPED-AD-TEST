import {
  applyImageFallback,
  escapeHtml,
  getPublishedVoices,
  getVoicePageLabel,
  getVoicePageSummary,
  loadVoiceCollection,
  renderBullets,
  renderFeatureList,
  renderParagraphs,
  resolveAppRootPath,
  setupRevealAnimations,
} from './shared.js?v=20260609-resilience';

function setHtml(sectionId, bodyId, html) {
  const section = document.getElementById(sectionId);
  const body = document.getElementById(bodyId);
  if (!section || !body) {
    return;
  }
  if (!html) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  body.innerHTML = html;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value || '';
  }
}

function setFigure(sectionId, imageId, captionId, path, caption, alt) {
  const section = document.getElementById(sectionId);
  const image = document.getElementById(imageId);
  const captionNode = document.getElementById(captionId);
  if (!section || !image || !captionNode) {
    return;
  }
  if (!path) {
    section.hidden = true;
    return;
  }
  image.src = resolveAppRootPath(path);
  image.alt = alt || '';
  applyImageFallback(image);
  captionNode.textContent = caption || '';
  section.hidden = false;
}

function renderHighlights(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return '';
  }
  return items
    .slice(0, 3)
    .map((item) => `
      <article class="company-story-highlight">
        <p class="company-story-highlight__label">${escapeHtml(item.label || '')}</p>
        <p class="company-story-highlight__value">${escapeHtml(item.value || '')}</p>
      </article>
    `)
    .join('');
}

function renderTimeline(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return '';
  }
  return `
    <ol class="company-story-timeline">
      ${items
        .map(
          (item, index) => `
            <li class="company-story-timeline__item">
              <span class="company-story-timeline__index">${String(index + 1).padStart(2, '0')}</span>
              <div class="company-story-timeline__content">
                <p>${escapeHtml(item)}</p>
              </div>
            </li>
          `
        )
        .join('')}
    </ol>
  `;
}

function buildFallbackHighlights(voice) {
  return [
    { label: '導入前', value: voice.challenge?.[0] || '紙運用で工程が連なり、調査期間が圧迫されていた' },
    { label: '運用フロー', value: voice.operationImage?.[1] || '配布資料のQRから対象者がスマートフォンで回答' },
    { label: '導入後', value: voice.outcome?.[0] || '紙運用のコストを抑え、調査期間を確保' },
  ];
}

function hideSectionsOnError() {
  [
    'voice-highlights-section',
    'voice-quote-section',
    'voice-body-image-primary-section',
    'voice-challenge-section',
    'voice-outcome-section',
    'voice-operation-section',
    'voice-overview-section',
    'voice-features-section',
    'voice-body-image-secondary-section',
  ].forEach((id) => {
    const section = document.getElementById(id);
    if (section) {
      section.hidden = true;
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  setupRevealAnimations();

  try {
    const collection = await loadVoiceCollection();
    const voice = getPublishedVoices(collection).find((item) => item.slug === 'university-survey');
    if (!voice) {
      throw new Error('Voice not found: university-survey');
    }

    const label = getVoicePageLabel(voice);
    const summary = getVoicePageSummary(voice);
    const headline = voice.voicePageHeadline || summary || label;
    const highlights = Array.isArray(voice.voicePageHighlights) && voice.voicePageHighlights.length > 0
      ? voice.voicePageHighlights
      : buildFallbackHighlights(voice);
    const quoteAuthor = voice.publicQuoteAuthor || voice.quote?.author || '';

    document.title = `${label} | SPEED AD 導入事例`;
    document.documentElement.style.setProperty('--voice-accent', voice.accent || '#0f8f85');
    document.documentElement.style.setProperty('--voice-accent-strong', voice.accentStrong || voice.accent || '#0a5f59');
    document.documentElement.style.setProperty('--voice-accent-soft', `${voice.accent || '#0f8f85'}16`);

    setText('voice-hero-eyebrow', voice.organizationType ? `${voice.organizationType} / 導入事例` : '導入事例');
    setText('voice-hero-company', label);
    setText('voice-hero-headline', headline);
    setText('voice-hero-summary', summary);
    setText(
      'voice-hero-caption',
      voice.voicePageImageCaption || '配布資料に印刷したQRコードから、対象者がスマートフォンで回答するイメージです。'
    );

    const heroImage = document.getElementById('voice-hero-image');
    if (heroImage) {
      heroImage.src = resolveAppRootPath(voice.heroImage || 'img/top-kv.jpg');
      heroImage.alt = `${label} 導入事例のキービジュアル`;
      applyImageFallback(heroImage);
    }

    const heroMeta = document.getElementById('voice-hero-meta');
    if (heroMeta) {
      heroMeta.innerHTML = `
        <span class="voice-pill">${escapeHtml(voice.organizationType || '導入事例')}</span>
        <span class="voice-pill">アンケート機能のみで運用</span>
        <span class="voice-pill">公開中</span>
      `;
    }

    setHtml('voice-highlights-section', 'voice-highlight-grid', renderHighlights(highlights));
    setFigure(
      'voice-body-image-primary-section',
      'voice-body-image-primary',
      'voice-body-image-primary-caption',
      voice.bodyImagePrimary,
      voice.bodyImagePrimaryCaption,
      `${label} 実態調査運用イメージ`
    );
    setHtml('voice-challenge-section', 'voice-challenge-body', renderBullets(voice.challenge));
    setHtml('voice-outcome-section', 'voice-outcome-body', renderBullets(voice.outcome));
    setHtml('voice-operation-section', 'voice-operation-body', renderTimeline(voice.operationImage));
    setHtml('voice-overview-section', 'voice-overview-body', renderParagraphs(voice.overview));
    setHtml('voice-features-section', 'voice-features-body', renderFeatureList(voice.usedFeatures));
    setFigure(
      'voice-body-image-secondary-section',
      'voice-body-image-secondary',
      'voice-body-image-secondary-caption',
      voice.bodyImageSecondary,
      voice.bodyImageSecondaryCaption,
      `${label} 集計シーンイメージ`
    );

    const quoteSection = document.getElementById('voice-quote-section');
    if (voice.quote?.text) {
      setText('voice-quote-text', voice.quote.text);
      setText('voice-quote-meta', quoteAuthor);
      quoteSection.hidden = false;
    } else if (quoteSection) {
      quoteSection.hidden = true;
    }
  } catch (error) {
    console.warn('導入事例詳細の読み込みに失敗しました:', error);
    setText('voice-hero-company', '導入事例');
    setText('voice-hero-headline', 'SPEED ADの活用事例を見る');
    setText('voice-hero-summary', '展示会やアンケート運用での活用イメージを、公開可能な範囲で順次紹介しています。');
    setText('voice-hero-caption', '導入事例の公開情報を案内するイメージです。');
    const heroMeta = document.getElementById('voice-hero-meta');
    if (heroMeta) {
      heroMeta.innerHTML = `
        <span class="voice-pill">導入事例</span>
        <span class="voice-pill">活用イメージ</span>
      `;
    }
    const heroImage = document.getElementById('voice-hero-image');
    if (heroImage) {
      heroImage.src = resolveAppRootPath('img/top-kv.jpg');
      heroImage.alt = 'SPEED AD 導入事例のイメージ';
      applyImageFallback(heroImage);
    }
    hideSectionsOnError();
  }
});
