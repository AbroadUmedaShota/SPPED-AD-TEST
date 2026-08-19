import {
  escapeHtml,
  getPublishedVoices,
  getVoicePageLabel,
  getVoicePageSummary,
  loadVoiceCollection,
  renderBullets,
  renderParagraphs,
  setupRevealAnimations,
} from './shared.js?v=20260818-oriental-story-v3';

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value || '';
  }
}

function setHeadline(value) {
  const element = document.getElementById('voice-hero-headline');
  if (!element) {
    return;
  }
  if (value === '展示会後の名刺を、翌々日には利用中のCRMへ。') {
    element.innerHTML = '<span class="oriental-headline-line">展示会後の名刺を、</span><span class="oriental-headline-line">翌々日には</span><span class="oriental-headline-line"><span class="oriental-phrase-nowrap">利用中の</span><span class="oriental-phrase-nowrap">CRMへ。</span></span>';
    return;
  }
  element.textContent = value || '';
}

function setHtml(sectionId, bodyId, html) {
  const section = document.getElementById(sectionId);
  const body = document.getElementById(bodyId);
  if (!section || !body) {
    return;
  }
  section.hidden = !html;
  body.innerHTML = html || '';
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
    <ol class="company-story-timeline oriental-flow-list">
      ${items
        .map((item, index) => {
          const [stepLabel, ...detailParts] = String(item || '').split('｜');
          const detail = detailParts.join('｜');
          return `
            <li class="company-story-timeline__item">
              <span class="company-story-timeline__index">${String(index + 1).padStart(2, '0')}</span>
              <div class="company-story-timeline__content">
                ${detail ? `<p class="oriental-flow-step-label">${escapeHtml(stepLabel)}</p>` : ''}
                <p>${escapeHtml(detail || stepLabel)}</p>
              </div>
            </li>
          `;
        })
        .join('')}
    </ol>
  `;
}

function renderMeta(voice) {
  const items = [voice.organizationType, ...(voice.usedFeatures || [])]
    .filter(Boolean)
    .slice(0, 3);
  return items.map((item) => `<span class="voice-pill">${escapeHtml(item)}</span>`).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
  setupRevealAnimations();

  try {
    const collection = await loadVoiceCollection();
    const voice = getPublishedVoices(collection).find((item) => item.slug === 'oriental-motor');
    if (!voice) {
      throw new Error('Voice not found: oriental-motor');
    }

    const label = getVoicePageLabel(voice);
    const summary = getVoicePageSummary(voice);
    document.title = `${label} | SPEED AD 導入事例`;
    document.documentElement.style.setProperty('--voice-accent', voice.accent || '#2757f5');
    document.documentElement.style.setProperty('--voice-accent-strong', voice.accentStrong || voice.accent || '#1238b3');
    document.documentElement.style.setProperty('--voice-accent-soft', `${voice.accent || '#2757f5'}16`);

    setText(
      'voice-hero-eyebrow',
      voice.organizationType ? `${voice.organizationType} / 名刺データ納品・利用中CRM取り込み` : '導入事例'
    );
    setText('voice-hero-company', label);
    setHeadline(voice.voicePageHeadline || summary || label);
    setText('voice-hero-summary', summary);
    const heroMeta = document.getElementById('voice-hero-meta');
    if (heroMeta) {
      heroMeta.innerHTML = renderMeta(voice);
    }

    setHtml('voice-highlights-section', 'voice-highlight-grid', renderHighlights(voice.voicePageHighlights));
    setHtml('voice-overview-section', 'voice-overview-body', renderParagraphs(voice.overview));
    setHtml('voice-operation-section', 'voice-operation-body', renderTimeline(voice.operationImage));
    setHtml('voice-outcome-section', 'voice-outcome-body', renderBullets(voice.outcome));
  } catch (error) {
    console.warn('オリエンタルモーター株式会社様の導入事例を読み込めませんでした:', error);
    setText('voice-hero-company', '導入事例');
    setHeadline('名刺データ化から、次の活用までをもっと速く。');
    setText('voice-hero-summary', '公開中の導入事例は、一覧ページからご確認いただけます。');
    const heroMeta = document.getElementById('voice-hero-meta');
    if (heroMeta) {
      heroMeta.innerHTML = '<span class="voice-pill">導入事例</span>';
    }
    ['voice-highlights-section', 'voice-overview-section', 'voice-operation-section', 'voice-outcome-section']
      .forEach((id) => {
        const section = document.getElementById(id);
        if (section) {
          section.hidden = true;
        }
      });
  }
});
