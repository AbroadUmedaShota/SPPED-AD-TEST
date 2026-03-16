import { resolveDashboardDataPath } from './utils.js';
import {
    formatMessage,
    normalizeLocale,
    resolveLocalizedValue
} from './services/i18n/messages.js';

async function loadSurveyById(surveyId) {
    if (!surveyId) return null;
    const dataPath = resolveDashboardDataPath(`surveys/${surveyId}.json`);
    const response = await fetch(dataPath);
    if (!response.ok) {
        throw new Error(`Survey definition file was not found (ID: ${surveyId})`);
    }
    return response.json();
}

function getLocale(params, survey) {
    return normalizeLocale(
        params.get('answerLocale')
        || survey?.defaultAnswerLocale
        || survey?.editorLanguage
        || 'ja'
    );
}

function getThankYouMessage(settings, locale) {
    const message = settings?.thankYouMessage;
    return resolveLocalizedValue(message, locale);
}

function renderThankYouPage({ surveyId, locale, survey, isContinuous }) {
    document.documentElement.lang = locale;
    document.title = formatMessage(locale, 'thankYouScreen.documentTitle');

    const titleEl = document.getElementById('thank-you-title');
    const bodyEl = document.getElementById('thank-you-body');
    const container = document.getElementById('continuous-answer-container');
    const button = document.getElementById('continuous-answer-button');

    const thankYouSettings = survey?.thankYouScreenSettings || survey?.settings?.thankYouScreen || {};
    const thankYouTitle = formatMessage(locale, 'thankYouScreen.title');
    const thankYouBody = getThankYouMessage(thankYouSettings, locale)
        || resolveLocalizedValue(thankYouSettings.description, locale)
        || formatMessage(locale, 'thankYouScreen.body');

    if (titleEl) {
        titleEl.textContent = thankYouTitle;
    }
    if (bodyEl) {
        bodyEl.textContent = thankYouBody;
    }

    if (isContinuous && surveyId && container && button) {
        container.classList.remove('hidden');
        button.href = `survey-answer.html?surveyId=${encodeURIComponent(surveyId)}&answerLocale=${encodeURIComponent(locale)}`;
        button.textContent = formatMessage(locale, 'thankYouScreen.continuousAnswerButton');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const surveyId = params.get('surveyId');
    const isContinuous = params.get('continuous') === 'true';

    try {
        const survey = await loadSurveyById(surveyId);
        const locale = getLocale(params, survey);
        renderThankYouPage({ surveyId, locale, survey, isContinuous });
    } catch (error) {
        console.error('Failed to initialize thank-you screen:', error);
        const locale = normalizeLocale(params.get('answerLocale') || 'ja');
        renderThankYouPage({ surveyId, locale, survey: null, isContinuous: false });
    }
});
