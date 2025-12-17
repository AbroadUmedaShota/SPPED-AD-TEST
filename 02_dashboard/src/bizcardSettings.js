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
    setSaveButtonLoading,
    renderDataConversionPlans,
    renderPremiumOptions
} from './ui/bizcardSettingsRenderer.js';
import { showToast } from './utils.js';
import { showConfirmationModal } from './confirmationModal.js';
import {
    DATA_CONVERSION_PLANS,
    DEFAULT_PLAN,
    PREMIUM_OPTION_GROUPS,
    getPlanConfig,
    normalizePlanValue,
    normalizePremiumOptions
} from './services/bizcardPlans.js';

export function initBizcardSettings() {
    // --- DOM Element Cache ---
    const bizcardRequestInput = document.getElementById('bizcardRequest');
    const dataConversionPlanSelection = document.getElementById('dataConversionPlanSelection');
    const couponCodeInput = document.getElementById('couponCode');
    const applyCouponBtn = document.getElementById('applyCouponBtn');
    const saveButton = document.getElementById('saveBizcardSettingsBtn');
    const cancelButton = document.getElementById('cancelBizcardSettings');
    const toggleMemoSectionBtn = document.getElementById('toggleMemoSection');
    const memoSection = document.getElementById('memoSection');
    const internalMemoInput = document.getElementById('internalMemo');
    const premiumOptionsContainer = document.getElementById('premiumOptionsContainer');

    // --- State Management ---
    let state = {
        surveyId: null,
        settings: {},
        initialSettings: {},
        appliedCoupon: null,
        isCouponApplied: false,
        couponButtonMode: 'apply',
        isCouponProcessing: false
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

            // Set default value for bizcardEnabled to true as the toggle is removed
            settingsData.bizcardEnabled = true;
            settingsData.dataConversionPlan = normalizePlanValue(settingsData.dataConversionPlan);
            const planConfig = getPlanConfig(settingsData.dataConversionPlan);
            settingsData.dataConversionSpeed = planConfig?.speedValue || getPlanConfig(DEFAULT_PLAN)?.speedValue || 'normal';
            settingsData.premiumOptions = normalizePremiumOptions(settingsData.premiumOptions);
            const parsedBizcardRequest = parseInt(settingsData.bizcardRequest, 10);
            settingsData.bizcardRequest = Number.isFinite(parsedBizcardRequest) && parsedBizcardRequest > 0
                ? parsedBizcardRequest
                : 100;

            const normalizedCouponCode = (settingsData.couponCode || '').trim();
            settingsData.couponCode = normalizedCouponCode;

            let initialCouponFeedback = null;
            if (normalizedCouponCode) {
                try {
                    const validation = await validateCoupon(normalizedCouponCode);
                    if (validation.success) {
                        state.appliedCoupon = { ...validation, code: normalizedCouponCode };
                        state.isCouponApplied = true;
                    } else {
                        state.appliedCoupon = null;
                        state.isCouponApplied = false;
                    }
                    initialCouponFeedback = validation;
                } catch (couponError) {
                    console.error('初期クーポン検証エラー:', couponError);
                    state.appliedCoupon = null;
                    state.isCouponApplied = false;
                    initialCouponFeedback = {
                        success: false,
                        message: '保存済みのクーポン確認に失敗しました。再度適用してください。'
                    };
                }
            }

            state.settings = settingsData;
            state.surveyData = surveyData; // surveyDataをstateに保存
            // Deep copy for initial state comparison
            state.initialSettings = JSON.parse(JSON.stringify(settingsData));
            state.initialSettings.premiumOptions = normalizePremiumOptions(state.initialSettings.premiumOptions);

            renderSurveyInfo(surveyData, state.surveyId);
            setInitialFormValues(state.settings);
            if (initialCouponFeedback) {
                displayCouponResult(initialCouponFeedback);
            }

            setupEventListeners();
            updateFullUI();
            initEstimateSidebarToggle();

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
            bizcardRequestInput,
            dataConversionPlanSelection
        ];
        formElements.forEach(el => {
            if(el) el.addEventListener('change', (e) => handleFormChange(e));
        });
        if(bizcardRequestInput) bizcardRequestInput.addEventListener('input', (e) => handleFormChange(e));

        if (premiumOptionsContainer) {
            premiumOptionsContainer.addEventListener('change', handlePremiumOptionChange);
        }

        if (couponCodeInput) {
            couponCodeInput.addEventListener('input', handleCouponInputChange);
        }
        if(applyCouponBtn) applyCouponBtn.addEventListener('click', handleApplyCoupon);
        if(saveButton) saveButton.addEventListener('click', handleSaveSettings);
        if(cancelButton) cancelButton.addEventListener('click', handleCancel);
        if(toggleMemoSectionBtn) {
            toggleMemoSectionBtn.addEventListener('click', () => {
                if(memoSection) memoSection.classList.toggle('hidden');
                const icon = toggleMemoSectionBtn.querySelector('.material-icons');
                if(icon) icon.classList.toggle('rotate-180');
            });
        }
    }

    /**
     * Checks if the form has been modified compared to its initial state.
     * @returns {boolean} True if the form has changed, false otherwise.
     */
    function hasFormChanged() {
        const currentSettings = {
            bizcardRequest: Math.max(0, parseInt(bizcardRequestInput.value, 10) || 0),
            dataConversionPlan: document.querySelector('input[name="dataConversionPlan"]:checked')?.value,
            internalMemo: internalMemoInput.value || '',
            premiumOptions: getPremiumSelectionsFromDom()
        };

        const initial = state.initialSettings;
        const initialPremium = normalizePremiumOptions(initial.premiumOptions);
        const currentPremium = normalizePremiumOptions(currentSettings.premiumOptions);

        if (currentSettings.bizcardRequest != initial.bizcardRequest) return true;
        if (currentSettings.dataConversionPlan != initial.dataConversionPlan) return true;
        if (currentSettings.internalMemo.trim() !== (initial.internalMemo || '').trim()) return true;

        if (currentPremium.multilingual !== initialPremium.multilingual) return true;
        if (!areArraysEqual(currentPremium.additionalItems, initialPremium.additionalItems)) return true;

        if ((couponCodeInput.value || '') !== (initial.couponCode || '')) return true;

        return false;
    }

    /**
     * Handles the cancel button click.
     */
    function handleCancel() {
        if (hasFormChanged()) {
            showConfirmationModal(
                '変更が保存されていません。破棄してアンケート一覧に戻りますか？',
                () => { window.location.href = 'index.html'; },
                '変更を破棄'
            );
        } else {
            window.location.href = 'index.html';
        }
    }

    /**
     * Handles changes in form inputs and updates the UI accordingly.
     */
    function handleFormChange(event) {
        const target = event.target;
        if (!target) return;

        const name = target.name || target.id;
        const value = target.type === 'checkbox' ? target.checked : target.value;

        switch (name) {
            case 'dataConversionPlan':
                {
                    const normalizedPlan = normalizePlanValue(value);
                    state.settings.dataConversionPlan = normalizedPlan;
                    const linkedSpeed = getPlanConfig(normalizedPlan)?.speedValue
                        || getPlanConfig(DEFAULT_PLAN)?.speedValue
                        || 'normal';
                    state.settings.dataConversionSpeed = linkedSpeed;
                }
                break;
            case 'bizcardRequest':
                state.settings.bizcardRequest = Math.max(0, parseInt(value, 10) || 0);
                break;
        }

        updateFullUI();
    }

    function handlePremiumOptionChange(event) {
        const target = event.target;
        if (!target || !target.name) {
            return;
        }

        state.settings.premiumOptions = normalizePremiumOptions(state.settings.premiumOptions);

        if (target.name === 'premiumMultilingual') {
            state.settings.premiumOptions.multilingual = target.checked;
        }

        if (target.name === 'premiumAdditionalItems') {
            const value = target.value;
            const items = new Set(state.settings.premiumOptions.additionalItems || []);
            if (target.checked) {
                items.add(value);
            } else {
                items.delete(value);
            }
            state.settings.premiumOptions.additionalItems = Array.from(items);
        }

        updateFullUI();
    }

    function handleCouponInputChange() {
        updateCouponSectionUI();
    }

    /**
     * Handles the coupon application logic.
     */
    async function handleApplyCoupon() {
        if (state.isCouponProcessing) {
            return;
        }

        const currentMode = state.couponButtonMode;

        if (currentMode === 'remove' && state.appliedCoupon) {
            state.appliedCoupon = null;
            state.isCouponApplied = false;
            state.settings.couponCode = '';
            couponCodeInput.value = '';
            displayCouponResult({ success: true, message: 'クーポンを削除しました' });
            updateFullUI();
            return;
        }

        const code = couponCodeInput.value.trim();
        if (!code) {
            displayCouponResult({ success: false, message: 'クーポンコードを入力してください。' });
            return;
        }

        state.isCouponProcessing = true;
        updateCouponSectionUI();

        const previousCoupon = state.appliedCoupon;

        try {
            const result = await validateCoupon(code);
            displayCouponResult(result);
            if (result.success) {
                state.appliedCoupon = { ...result, code };
                state.settings.couponCode = code;
            } else {
                if (previousCoupon && previousCoupon.code && previousCoupon.code !== code) {
                    state.appliedCoupon = previousCoupon;
                    state.settings.couponCode = previousCoupon.code;
                } else {
                    state.appliedCoupon = null;
                    state.settings.couponCode = '';
                }
            }
        } catch (error) {
            console.error('クーポン検証エラー:', error);
            displayCouponResult({ success: false, message: 'クーポンの検証中にエラーが発生しました。再度お試しください。' });
            if (previousCoupon && previousCoupon.code) {
                state.appliedCoupon = previousCoupon;
                state.settings.couponCode = previousCoupon.code;
            } else {
                state.appliedCoupon = null;
                state.settings.couponCode = '';
            }
        } finally {
            state.isCouponProcessing = false;
            updateFullUI();
        }
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

                // Store updated settings in sessionStorage to be picked up by the list page
                sessionStorage.setItem(`updatedSurvey_${finalSettings.surveyId}`, JSON.stringify(finalSettings));

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
        const settingsFields = document.getElementById('bizcardSettingsFields');
        if(settingsFields) {
            settingsFields.classList.remove('hidden');
        }

        state.settings.dataConversionPlan = normalizePlanValue(state.settings.dataConversionPlan);
        const selectedPlanConfig = getPlanConfig(state.settings.dataConversionPlan);
        state.settings.dataConversionSpeed = selectedPlanConfig?.speedValue
            || getPlanConfig(DEFAULT_PLAN)?.speedValue
            || 'normal';
        state.settings.premiumOptions = normalizePremiumOptions(state.settings.premiumOptions);

        const parsedBizcardRequest = parseInt(state.settings.bizcardRequest, 10);
        state.settings.bizcardRequest = Number.isFinite(parsedBizcardRequest) && parsedBizcardRequest > 0
            ? parsedBizcardRequest
            : 100;

        if (bizcardRequestInput) {
            bizcardRequestInput.value = state.settings.bizcardRequest;
        }

        renderDataConversionPlans(DATA_CONVERSION_PLANS, state.settings.dataConversionPlan);
        renderPremiumOptions(PREMIUM_OPTION_GROUPS, state.settings.premiumOptions);

        const estimate = calculateEstimate(state.settings, state.appliedCoupon, state.surveyData?.periodEnd);
        renderEstimate(estimate);
        updateCouponSectionUI();
        validateForm();
    }

    function updateCouponSectionUI() {
        const couponLoadingIndicator = document.getElementById('couponLoadingIndicator');
        if (!couponCodeInput || !applyCouponBtn || !couponLoadingIndicator) {
            return;
        }

        const trimmedValue = couponCodeInput.value.trim();
        const appliedCoupon = state.appliedCoupon;
        const hasAppliedCoupon = Boolean(appliedCoupon);

        let mode = 'apply';
        if (hasAppliedCoupon) {
            const appliedCode = appliedCoupon.code || '';
            if (trimmedValue && trimmedValue !== appliedCode) {
                mode = 'change';
            } else {
                mode = 'remove';
            }
        }

        state.isCouponApplied = hasAppliedCoupon;
        state.couponButtonMode = mode;

        const labels = {
            apply: '適用',
            change: '変更',
            remove: '削除'
        };
        const ariaLabels = {
            apply: '入力したクーポンコードを適用する',
            change: '入力したクーポンコードで適用内容を変更する',
            remove: '適用済みのクーポンを削除する'
        };

        couponCodeInput.disabled = state.isCouponProcessing;

        if (state.isCouponProcessing) {
            applyCouponBtn.classList.add('hidden');
            couponLoadingIndicator.classList.remove('hidden');
        } else {
            applyCouponBtn.classList.remove('hidden');
            couponLoadingIndicator.classList.add('hidden');

            applyCouponBtn.textContent = labels[mode];
            applyCouponBtn.setAttribute('aria-label', ariaLabels[mode]);
            applyCouponBtn.setAttribute('aria-pressed', mode === 'remove' ? 'true' : 'false');
            
            applyCouponBtn.classList.remove('coupon-action-button--apply', 'coupon-action-button--change', 'coupon-action-button--remove');
            applyCouponBtn.classList.add(`coupon-action-button--${mode}`);
        }
    }

    function getPremiumSelectionsFromDom() {
        const multilingualInput = document.querySelector('input[name="premiumMultilingual"]');
        const additionalInputs = Array.from(document.querySelectorAll('input[name="premiumAdditionalItems"]:checked'));

        return {
            multilingual: Boolean(multilingualInput?.checked),
            additionalItems: additionalInputs.map(input => input.value)
        };
    }

    function initEstimateSidebarToggle() {
        const sidebar = document.getElementById('estimateSidebar');
        const toggleBtn = document.getElementById('toggleEstimateSidebarBtn');

        if (!sidebar || !toggleBtn) {
            return;
        }

        const toggleIcon = toggleBtn.querySelector('.material-icons');

        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('translate-x-full');
            const isCollapsed = sidebar.classList.contains('translate-x-full');

            if (isCollapsed) {
                toggleIcon.textContent = 'chevron_left';
                toggleBtn.setAttribute('aria-expanded', 'false');
            } else {
                toggleIcon.textContent = 'chevron_right';
                toggleBtn.setAttribute('aria-expanded', 'true');
            }
        });
    }

    function areArraysEqual(a = [], b = []) {
        if (!Array.isArray(a) || !Array.isArray(b)) return false;
        if (a.length !== b.length) return false;
        const sortedA = [...a].sort();
        const sortedB = [...b].sort();
        return sortedA.every((value, index) => value === sortedB[index]);
    }

    // --- Initialize Page ---
    initializePage();
}
