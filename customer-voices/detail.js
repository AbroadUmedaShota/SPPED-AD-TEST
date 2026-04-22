import {
  escapeHtml,
  getPublishedVoices,
  getVoicePageLabel,
  getVoicePageSummary,
  loadVoiceCollection,
  refreshRevealAnimations,
  renderBullets,
  renderFeatureList,
  renderParagraphs,
  resolveAppRootPath,
  setupRevealAnimations,
} from './shared.js';

function setSectionHtml(sectionId, bodyId, html) {
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

document.addEventListener('DOMContentLoaded', async () => {
  setupRevealAnimations();

  const slug = document.body.dataset.voiceSlug;
  if (!slug) {
    return;
  }

  try {
    const collection = await loadVoiceCollection();
    const voice = getPublishedVoices(collection).find((item) => item.slug === slug);
    if (!voice) {
      throw new Error(`Voice not found: ${slug}`);
    }
    const label = getVoicePageLabel(voice);
    const summary = getVoicePageSummary(voice);

    document.title = `${label} | SPEED AD お客様のお声`;
    document.documentElement.style.setProperty('--voice-accent', voice.accent || '#2757f5');
    document.documentElement.style.setProperty('--voice-accent-strong', voice.accentStrong || voice.accent || '#1238b3');
    document.documentElement.style.setProperty('--voice-accent-soft', `${voice.accent || '#2757f5'}1a`);

    document.getElementById('voice-hero-eyebrow').textContent = `${voice.organizationType} / お客様のお声`;
    document.getElementById('voice-hero-title').textContent = label;
    document.getElementById('voice-hero-lead').textContent = summary;
    document.getElementById('voice-hero-image').src = resolveAppRootPath(voice.heroImage || 'img/top-kv.jpg');
    document.getElementById('voice-hero-image').alt = `${label}のイメージ`;
    document.getElementById('voice-hero-meta').innerHTML = `
      <span class="voice-pill">${escapeHtml(voice.organizationType)}</span>
      <span class="voice-pill">導入事例</span>
      <span class="voice-pill">公開中</span>
    `;

    setSectionHtml('voice-overview', 'voice-overview-body', renderParagraphs(voice.overview));
    setSectionHtml('voice-challenge', 'voice-challenge-body', renderBullets(voice.challenge));
    setSectionHtml('voice-features', 'voice-features-body', renderFeatureList(voice.usedFeatures));
    setSectionHtml('voice-operation', 'voice-operation-body', renderBullets(voice.operationImage));
    setSectionHtml('voice-outcome', 'voice-outcome-body', renderBullets(voice.outcome));

    const quoteSection = document.getElementById('voice-quote');
    if (voice.quote?.text) {
      document.getElementById('voice-quote-text').textContent = voice.quote.text;
      const metaParts = [voice.quote.author, voice.quote.role].filter(Boolean).map((item) => escapeHtml(item));
      document.getElementById('voice-quote-meta').innerHTML = metaParts.join(' / ');
      quoteSection.hidden = false;
    } else {
      quoteSection.hidden = true;
    }
  } catch (error) {
    document.getElementById('voice-hero-title').textContent = '事例を表示できませんでした';
    document.getElementById('voice-hero-lead').textContent = '読み込みに失敗したため、一覧ページから再度お試しください。';
    const main = document.getElementById('voice-detail-main');
    const aside = document.getElementById('voice-detail-aside');
    if (main) {
      main.innerHTML = `
        <section class="voice-detail-section" data-reveal>
          <h2>読み込みエラー</h2>
          <div class="voice-detail-body">
            <p>対象の事例データを読み込めませんでした。公開状態とデータ定義を確認してください。</p>
          </div>
        </section>
      `;
      refreshRevealAnimations(main);
    }
    if (aside) {
      aside.innerHTML = '';
    }
  }
});
