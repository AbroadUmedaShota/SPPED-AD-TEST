import { showToast, downloadFile, copyTextToClipboard } from './utils.js';
import { closeModal } from './modalHandler.js';

const DEFAULT_QR_IMAGE_SRC = 'sample_qr.png';

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
    const qrCodeImage = modalElement.querySelector('#qrCodeImage');
    const surveyUrlInput = modalElement.querySelector('#surveyUrlInput');

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

    if (qrCodeImage && !qrCodeImage.src) {
        qrCodeImage.src = DEFAULT_QR_IMAGE_SRC;
    }
}

function buildSurveyQrUrl(surveyId) {
    if (!surveyId) return '';
    return `survey-answer.html?surveyId=${surveyId}`;
}

export function populateQrCodeModal({ surveyId, surveyUrl, qrImageSrc } = {}) {
    if (!surveyId && !surveyUrl && !qrImageSrc) return;

    const modalElement = document.getElementById('qrCodeModal');
    if (!modalElement) return;

    const qrCodeImage = modalElement.querySelector('#qrCodeImage');
    const surveyUrlInput = modalElement.querySelector('#surveyUrlInput');
    const resolvedUrl = surveyUrl || buildSurveyQrUrl(surveyId);

    if (surveyUrlInput && resolvedUrl) {
        surveyUrlInput.textContent = resolvedUrl;
        surveyUrlInput.dataset.surveyId = surveyId || '';
    }

    if (qrCodeImage) {
        qrCodeImage.src = qrImageSrc || qrCodeImage.src || DEFAULT_QR_IMAGE_SRC;
        qrCodeImage.dataset.surveyId = surveyId || '';
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
