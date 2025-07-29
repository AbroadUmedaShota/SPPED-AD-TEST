import {
    fetchSurveyData,
    fetchBizcardSettings,
    validateCoupon,
    saveBizcardSettings
} from './services/bizcardSettingsService.js';
import { calculateEstimate } from './services/bizcardCalculator.js';
import {
    renderSurveyInfo,
    setInitialFormValues,
    updateSettingsVisibility,
    renderEstimate,
    displayCouponResult,
    validateForm,
    setSaveButtonLoading
} from './ui/bizcardSettingsRenderer.js';
import { showToast } from './utils.js';

export function initBizcardSettings() {
    // --- DOM Element Cache ---
    const bizcardEnabledToggle = document.getElementById('bizcardEnabledToggle');
    const bizcardRequestInput = document.getElementById('bizcardRequest');
    const dataConversionPlanSelection = document.getElementById('dataConversionPlanSelection');
    const dataConversionSpeedSelection = document.getElementById('dataConversionSpeedSelection');
    const couponCodeInput = document.getElementById('couponCode');
    const applyCouponBtn = document.getElementById('applyCouponBtn');
    const saveButton = document.getElementById('saveBizcardSettingsBtn');
    const cancelButton = document.getElementById('cancelBizcardSettings');
    const toggleMemoSectionBtn = document.getElementById('toggleMemoSection');
    const memoSection = document.getElementById('memoSection');
    const internalMemoInput = document.getElementById('internalMemo');

    // --- State Management ---
    let state = {
        surveyId: null,
        settings: {},
        appliedCoupon: null
    };

    /**
     * Initializes the page, fetches data, and sets up event listeners.
     */
    async function initializePage() {
        const urlParams = new URLSearchParams(window.location.search);
        state.surveyId = urlParams.get('surveyId');

        if (!state.surveyId) {
            document.getElementById('pageTitle').textContent = 'アンケートIDが見つかりません';
            showToast('有効なアンケートIDが指定されていません。', 'error');
            return;
        }

        try {
            const [surveyData, settingsData] = await Promise.all([
                fetchSurveyData(state.surveyId),
                fetchBizcardSettings(state.surveyId)
            ]);

            state.settings = settingsData;

            renderSurveyInfo(surveyData, state.surveyId);
            setInitialFormValues(state.settings);

            setupEventListeners();
            updateFullUI();

        } catch (error) {
            console.error('初期化エラー:', error);
            showToast('ページの読み込みに失敗しました。', 'error');
        }
    }

    /**
     * Sets up all event listeners for the page.
     */
    function setupEventListeners() {
        const formElements = [
            bizcardEnabledToggle, bizcardRequestInput,
            dataConversionPlanSelection, dataConversionSpeedSelection
        ];
        formElements.forEach(el => el.addEventListener('change', handleFormChange));
        bizcardRequestInput.addEventListener('input', handleFormChange);

        applyCouponBtn.addEventListener('click', handleApplyCoupon);
        saveButton.addEventListener('click', handleSaveSettings);
        cancelButton.addEventListener('click', () => {
            if (confirm('変更を破棄してアンケート一覧に戻りますか？')) {
                window.location.href = 'index.html';
            }
        });
        toggleMemoSectionBtn.addEventListener('click', () => {
            memoSection.classList.toggle('hidden');
            toggleMemoSectionBtn.querySelector('.material-icons').classList.toggle('rotate-180');
        });
    }

    /**
     * Handles changes in form inputs and updates the UI accordingly.
     */
    function handleFormChange() {
        // Update state from form
        state.settings.bizcardEnabled = bizcardEnabledToggle.checked;
        state.settings.bizcardRequest = parseInt(bizcardRequestInput.value, 10) || 0;
        state.settings.dataConversionPlan = document.querySelector('input[name="dataConversionPlan"]:checked').value;
        state.settings.dataConversionSpeed = document.querySelector('input[name="dataConversionSpeed"]:checked').value;

        updateFullUI();
    }

    /**
     * Handles the coupon application logic.
     */
    async function handleApplyCoupon() {
        const code = couponCodeInput.value.trim();
        if (!code) {
            displayCouponResult({ success: false, message: 'クーポンコードを入力してください。' });
            return;
        }
        const result = await validateCoupon(code);
        displayCouponResult(result);
        if (result.success) {
            state.appliedCoupon = result;
        } else {
            state.appliedCoupon = null;
        }
        updateFullUI();
    }

    /**
     * Handles saving the settings.
     */
    async function handleSaveSettings() {
        if (!validateForm()) {
            showToast('入力内容にエラーがあります。ご確認ください。', 'error');
            return;
        }

        setSaveButtonLoading(true);

        // Collect final settings from state and form
        const finalSettings = {
            ...state.settings,
            surveyId: state.surveyId,
            couponCode: state.appliedCoupon ? state.appliedCoupon.code : null,
            internalMemo: internalMemoInput.value
        };

        try {
            const result = await saveBizcardSettings(finalSettings);
            if (result.success) {
                showToast('名刺データ化設定を保存し、依頼を確定しました！', 'success');
                setTimeout(() => window.location.href = 'index.html', 1000);
            } else {
                showToast(result.message || '設定の保存に失敗しました。', 'error');
                setSaveButtonLoading(false);
            }
        } catch (error) {
            console.error('設定保存エラー:', error);
            showToast('設定の保存中にエラーが発生しました。', 'error');
            setSaveButtonLoading(false);
        }
    }

    /**
     * Updates all relevant parts of the UI based on the current state.
     */
    function updateFullUI() {
        updateSettingsVisibility();
        const estimate = calculateEstimate(state.settings, state.appliedCoupon);
        renderEstimate(estimate);
        validateForm();
    }

    // --- Initialize Page ---
    initializePage();
}