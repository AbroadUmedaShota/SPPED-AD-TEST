import { showToast, downloadFile, copyTextToClipboard } from './utils.js';
import { closeModal } from './modalHandler.js';

export function buildSurveyAnswerUrl(surveyId) {
    if (!surveyId) return '';
    return `survey-answer.html?surveyId=${surveyId}`;
}

/**
 * Initializes elements specific to the QR Code Modal.
 * This is called after the modal's HTML is loaded into the DOM.
 * @param {HTMLElement} modalElement The root element of the modal overlay.
 */
export function setupQrCodeModalListeners(modalElement) {
    if (!modalElement) {
        console.warn("qrCodeModal element not provided to setupQrCodeModalListeners.");
        return;
    }

    const downloadQrCodeBtn = modalElement.querySelector('#downloadQrCodeBtn');
    const copyUrlBtn = modalElement.querySelector('#copyUrlBtn');
    // Remove existing listeners to prevent duplication
    if (downloadQrCodeBtn) downloadQrCodeBtn.removeEventListener('click', handleDownloadQrCode);
    if (copyUrlBtn) copyUrlBtn.removeEventListener('click', handleCopyUrl);

    // Add new listeners
    if (downloadQrCodeBtn) downloadQrCodeBtn.addEventListener('click', handleDownloadQrCode);
    if (copyUrlBtn) copyUrlBtn.addEventListener('click', handleCopyUrl);

    const closeBtn = modalElement.querySelector('#closeQrCodeModalBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => closeModal('qrCodeModal'));
    }
    const footerCloseBtn = modalElement.querySelector('#footerCloseQrCodeModalBtn');
    if (footerCloseBtn) {
        footerCloseBtn.addEventListener('click', () => closeModal('qrCodeModal'));
    }
}

export function populateQrCodeModal({ surveyId, surveyUrl, qrImageSrc } = {}) {
    const modalElement = document.getElementById('qrCodeModal');
    if (!modalElement) return;

    const qrCodeImage = modalElement.querySelector('#qrCodeImage');
    const qrCodePlaceholder = modalElement.querySelector('#qrCodeImagePlaceholder');
    const qrCodeHint = modalElement.querySelector('#qrCodeImageHint');
    const surveyUrlInput = modalElement.querySelector('#surveyUrlInput');
    const downloadQrCodeBtn = modalElement.querySelector('#downloadQrCodeBtn');
    const copyUrlBtn = modalElement.querySelector('#copyUrlBtn');
    const resolvedUrl = surveyUrl || buildSurveyAnswerUrl(surveyId);
    const hasQrImage = Boolean(qrImageSrc);
    const hasUrl = Boolean(resolvedUrl);

    if (surveyUrlInput) {
        surveyUrlInput.textContent = resolvedUrl || '保存済みアンケートのURLを表示します。';
        surveyUrlInput.dataset.surveyId = surveyId || '';
    }

    if (qrCodeImage) {
        qrCodeImage.src = hasQrImage ? qrImageSrc : '';
        qrCodeImage.dataset.surveyId = surveyId || '';
        qrCodeImage.classList.toggle('hidden', !hasQrImage);
    }

    if (qrCodePlaceholder) {
        qrCodePlaceholder.classList.toggle('hidden', hasQrImage);
    }

    if (qrCodeHint) {
        qrCodeHint.textContent = hasQrImage
            ? 'このQRコードをスキャンしてアンケートに回答してください。'
            : 'QRコード画像は未設定です。右側のURLは利用できます。';
    }

    if (downloadQrCodeBtn) {
        downloadQrCodeBtn.disabled = !hasQrImage;
        downloadQrCodeBtn.setAttribute('aria-disabled', hasQrImage ? 'false' : 'true');
        downloadQrCodeBtn.classList.toggle('opacity-50', !hasQrImage);
        downloadQrCodeBtn.classList.toggle('cursor-not-allowed', !hasQrImage);
    }

    if (copyUrlBtn) {
        copyUrlBtn.disabled = !hasUrl;
        copyUrlBtn.setAttribute('aria-disabled', hasUrl ? 'false' : 'true');
        copyUrlBtn.classList.toggle('opacity-50', !hasUrl);
        copyUrlBtn.classList.toggle('cursor-not-allowed', !hasUrl);
    }
}

function handleDownloadQrCode() {
    const qrCodeImage = document.getElementById('qrCodeImage');
    if (qrCodeImage && qrCodeImage.src) {
        const imageUrl = qrCodeImage.src;
        const surveyId = qrCodeImage.dataset.surveyId;
        const filename = surveyId
            ? `qr_${surveyId}.png`
            : `qr_code_${new Date().getTime()}.png`;
        downloadFile(imageUrl, filename);
        showToast('QRコードのダウンロードを開始しました。', 'success');
    } else {
        showToast('QRコード画像が見つかりません。', 'error');
    }
}

function handleCopyUrl() {
    const surveyUrlInput = document.getElementById('surveyUrlInput');
    if (surveyUrlInput && surveyUrlInput.textContent) {
        copyTextToClipboard(surveyUrlInput.textContent);
    } else {
        showToast('コピー対象のURLが見つかりません。', 'error');
    }
}
