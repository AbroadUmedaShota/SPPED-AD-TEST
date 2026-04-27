import {
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
} from './shared.js';

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
    { label: '導入前', value: voice.challenge?.[0] || '紙の回収情報が分散' },
    { label: '回収導線', value: voice.operationImage?.[1] || '回答と名刺取得を同じ流れで回収' },
    { label: '導入後', value: voice.outcome?.[0] || '会期後の共有と初動が進めやすく' },
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
    const voice = getPublishedVoices(collection).find((item) => item.slug === 'company-monitor');
    if (!voice) {
      throw new Error('Voice not found: company-monitor');
    }

    const label = getVoicePageLabel(voice);
    const summary = getVoicePageSummary(voice);
    const headline = voice.voicePageHeadline || summary || label;
    const highlights = Array.isArray(voice.voicePageHighlights) && voice.voicePageHighlights.length > 0
      ? voice.voicePageHighlights
      : buildFallbackHighlights(voice);
    const quoteAuthor = voice.publicQuoteAuthor || voice.quote?.author || '';

    document.title = `${label} | SPEED AD お客様のお声`;
    document.documentElement.style.setProperty('--voice-accent', voice.accent || '#2757f5');
    document.documentElement.style.setProperty('--voice-accent-strong', voice.accentStrong || voice.accent || '#1238b3');
    document.documentElement.style.setProperty('--voice-accent-soft', `${voice.accent || '#2757f5'}16`);

    setText('voice-hero-eyebrow', `${voice.organizationType || '導入事例'} / Customer Voices`);
    setText('voice-hero-company', label);
    setText('voice-hero-headline', headline);
    setText('voice-hero-summary', summary);
    setText(
      'voice-hero-caption',
      voice.voicePageImageCaption || '展示会現場の回収導線と、会期後の共有をイメージしたキービジュアルです。'
    );

    const heroImage = document.getElementById('voice-hero-image');
    if (heroImage) {
      heroImage.src = resolveAppRootPath(voice.heroImage || 'img/top-kv.jpg');
      heroImage.alt = `${label} 導入事例のキービジュアル`;
    }

    const heroMeta = document.getElementById('voice-hero-meta');
    if (heroMeta) {
      heroMeta.innerHTML = `
        <span class="voice-pill">${escapeHtml(voice.organizationType || '導入事例')}</span>
        <span class="voice-pill">展示会運用</span>
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
      `${label} 展示会会場イメージ`
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
      `${label} ブースイメージ`
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
    setText('voice-hero-company', 'お客様のお声');
    setText('voice-hero-headline', '事例を表示できませんでした');
    setText('voice-hero-summary', '読み込みに失敗したため、一覧ページから再度お試しください。');
    setText('voice-hero-caption', '公開状態とデータ定義を確認してください。');
    hideSectionsOnError();
  }
});
