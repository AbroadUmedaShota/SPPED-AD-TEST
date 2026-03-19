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
    renderEstimate,
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
    const removeCouponBtn = document.getElementById('removeCouponBtn');
    const saveButton = document.getElementById('saveBizcardSettingsBtn');
    const cancelButton = document.getElementById('cancelBizcardSettings');
    const toggleMemoSectionBtn = document.getElementById('toggleMemoSection');
    const memoSection = document.getElementById('memoSection');
    const internalMemoInput = document.getElementById('internalMemo');
    const premiumOptionsContainer = document.getElementById('premiumOptionsContainer');
    
    const skipBizcardToggle = document.getElementById('skipBizcardToggle');
    const skipBizcardToggleContainer = document.getElementById('skipBizcardToggleContainer');
    const bizcardFormActiveArea = document.getElementById('bizcardFormActiveArea');
    const rightColumnDisabledOverlay = document.getElementById('rightColumnDisabledOverlay');
    // New UI controls: stepper / slider / presets
    const bizcardRequestDecBtn = document.getElementById('bizcardRequestDecBtn');
    const bizcardRequestIncBtn = document.getElementById('bizcardRequestIncBtn');
    const bizcardRequestSlider = document.getElementById('bizcardRequestSlider');

    // Modals
    const bizcardDetailsModal = document.getElementById('bizcardDetailsModal');
    const openBizcardDetailsModalBtn = document.getElementById('openBizcardDetailsModalBtn');
    const closeBizcardDetailsModalBtn = document.getElementById('closeBizcardDetailsModalBtn');
    const closeBizcardDetailsModalActionBtn = document.getElementById('closeBizcardDetailsModalActionBtn');

    const billingNotesModal = document.getElementById('billingNotesModal');
    const openBillingNotesModalBtn = document.getElementById('openBillingNotesModalBtn');
    const closeBillingNotesModalBtn = document.getElementById('closeBillingNotesModalBtn');
    const closeBillingNotesModalActionBtn = document.getElementById('closeBillingNotesModalActionBtn');

    // --- State Management ---
    let state = {
        surveyId: null,
        settings: {},
        initialSettings: {},
        appliedCoupon: null,
        isCouponApplied: false,
        isCouponProcessing: false,
        isSkipped: false
    };

    async function initializePage() {
        const urlParams = new URLSearchParams(window.location.search);
        state.surveyId = urlParams.get('surveyId');

        let surveyData;
        let settingsData;

        try {
            if (state.surveyId) {
                [surveyData, settingsData] = await Promise.all([
                    fetchSurveyData(state.surveyId),
                    fetchBizcardSettings(state.surveyId)
                ]);
            } else {
                const tempDataString = localStorage.getItem('tempSurveyData');
                if (!tempDataString) {
                    showToast('一時的なアンケートデータが見つかりません。作成画面からやり直してください。', 'error');
                    setTimeout(() => { window.location.href = 'surveyCreation.html'; }, 2000);
                    return;
                }
                const tempData = JSON.parse(tempDataString);
                surveyData = {
                    id: null,
                    name: tempData.name,
                    displayTitle: tempData.displayTitle,
                    periodStart: tempData.periodStart,
                    periodEnd: tempData.periodEnd,
                };
                settingsData = tempData.settings?.bizcard || {};
                if (!settingsData.dataConversionPlan) settingsData.dataConversionPlan = DEFAULT_PLAN;
            }

            settingsData.bizcardEnabled = settingsData.bizcardEnabled !== false; // Default true if not explicitly false
            state.isSkipped = !settingsData.bizcardEnabled;

            settingsData.dataConversionPlan = normalizePlanValue(settingsData.dataConversionPlan);
            const planConfig = getPlanConfig(settingsData.dataConversionPlan);
            settingsData.dataConversionSpeed = planConfig?.speedValue || getPlanConfig(DEFAULT_PLAN)?.speedValue || 'normal';
            settingsData.premiumOptions = normalizePremiumOptions(settingsData.premiumOptions);
            const parsedBizcardRequest = parseInt(settingsData.bizcardRequest, 10);
            settingsData.bizcardRequest = Number.isFinite(parsedBizcardRequest) && parsedBizcardRequest >= 0 ? parsedBizcardRequest : 100;

            const sharedCouponKey = 'sharedCoupon_' + (state.surveyId || 'temp');
            const sharedCoupon = localStorage.getItem(sharedCouponKey);
            const normalizedCouponCode = (sharedCoupon !== null ? sharedCoupon : (settingsData.couponCode || '')).trim();
            settingsData.couponCode = normalizedCouponCode;

            if (normalizedCouponCode) {
                try {
                    const validation = await validateCoupon(normalizedCouponCode);
                    if (validation.success) {
                        state.appliedCoupon = { ...validation, code: normalizedCouponCode };
                        state.isCouponApplied = true;
                    } else {
                        state.appliedCoupon = null;
                        state.isCouponApplied = false;
                        localStorage.removeItem(sharedCouponKey); // Clean up invalid
                    }
                } catch (couponError) {
                    console.error('初期クーポン検証エラー:', couponError);
                    state.appliedCoupon = null;
                    state.isCouponApplied = false;
                }
            }

            state.settings = settingsData;
            state.surveyData = surveyData;
            state.initialSettings = JSON.parse(JSON.stringify(settingsData));
            state.initialSettings.premiumOptions = normalizePremiumOptions(state.initialSettings.premiumOptions);

            renderSurveyInfo(surveyData, state.surveyId);
            setInitialFormValues(state.settings);
            
            if (skipBizcardToggle) {
                skipBizcardToggle.checked = state.isSkipped;
                applySkipState();
            }

            setupEventListeners();
            updateFullUI();

        } catch (error) {
            console.error('初期化エラー:', error);
            showToast('ページの読み込みに失敗しました。', 'error');
        }
    }

    function setupEventListeners() {
        const formElements = [bizcardRequestInput, dataConversionPlanSelection];
        formElements.forEach(el => { if(el) el.addEventListener('change', handleFormChange); });
        if(bizcardRequestInput) bizcardRequestInput.addEventListener('input', handleFormChange);

        if (premiumOptionsContainer) premiumOptionsContainer.addEventListener('change', handlePremiumOptionChange);
        if (couponCodeInput) couponCodeInput.addEventListener('input', () => { document.getElementById('couponCodeErrorMessage')?.classList.add('hidden'); });
        if (applyCouponBtn) applyCouponBtn.addEventListener('click', handleApplyCoupon);
        if (removeCouponBtn) removeCouponBtn.addEventListener('click', handleRemoveCoupon);
        if (saveButton) saveButton.addEventListener('click', handleSaveSettings);
        if (cancelButton) cancelButton.addEventListener('click', handleCancel);
        
        // Use click or change on checkbox
        if (skipBizcardToggle) skipBizcardToggle.addEventListener('change', (e) => {
            state.isSkipped = e.target.checked;
            state.settings.bizcardEnabled = !state.isSkipped;
            applySkipState();
            updateFullUI();
        });

        if (toggleMemoSectionBtn) {
            toggleMemoSectionBtn.addEventListener('click', () => {
                if(memoSection) memoSection.classList.toggle('hidden');
                const icon = toggleMemoSectionBtn.querySelector('.material-icons');
                if(icon) icon.classList.toggle('rotate-180');
            });
        }

        // Modals
        if (openBizcardDetailsModalBtn) openBizcardDetailsModalBtn.addEventListener('click', () => bizcardDetailsModal?.showModal());
        if (closeBizcardDetailsModalBtn) closeBizcardDetailsModalBtn.addEventListener('click', () => bizcardDetailsModal?.close());
        if (closeBizcardDetailsModalActionBtn) closeBizcardDetailsModalActionBtn.addEventListener('click', () => bizcardDetailsModal?.close());

        if (openBillingNotesModalBtn) openBillingNotesModalBtn.addEventListener('click', () => billingNotesModal?.showModal());
        if (closeBillingNotesModalBtn) closeBillingNotesModalBtn.addEventListener('click', () => billingNotesModal?.close());
        if (closeBillingNotesModalActionBtn) closeBillingNotesModalActionBtn.addEventListener('click', () => billingNotesModal?.close());

        // --- New stepper / slider / preset event handlers ---
        /**
         * Centralized handler: update state + sync all UI controls + re-calculate estimate.
         */
        function setRequestCount(newVal) {
            const clamped = Math.max(0, Math.min(9999, Math.round(newVal) || 0));
            state.settings.bizcardRequest = clamped;
            if (bizcardRequestInput) bizcardRequestInput.value = clamped;
            if (bizcardRequestSlider) bizcardRequestSlider.value = Math.min(clamped, 5000);
            updateFullUI();
        }


        if (bizcardRequestDecBtn) {
            bizcardRequestDecBtn.addEventListener('click', () => {
                const current = parseInt(bizcardRequestInput?.value || 0, 10);
                setRequestCount(current - 1);
            });
        }
        if (bizcardRequestIncBtn) {
            bizcardRequestIncBtn.addEventListener('click', () => {
                const current = parseInt(bizcardRequestInput?.value || 0, 10);
                setRequestCount(current + 1);
            });
        }
        if (bizcardRequestSlider) {
            bizcardRequestSlider.addEventListener('input', () => {
                setRequestCount(parseInt(bizcardRequestSlider.value, 10));
            });
        }

        // Keep slider in sync when user types directly in the number input
        if (bizcardRequestInput) {
            bizcardRequestInput.addEventListener('input', () => {
                const val = parseInt(bizcardRequestInput.value, 10);
                if (!isNaN(val)) {
                    if (bizcardRequestSlider) bizcardRequestSlider.value = Math.min(val, 5000);
                }
            });
        }
    }

    function applySkipState() {
        if (!bizcardFormActiveArea || !rightColumnDisabledOverlay) return;
        
        if (state.isSkipped) {
            bizcardFormActiveArea.classList.add('opacity-40', 'pointer-events-none', 'grayscale');
            rightColumnDisabledOverlay.classList.remove('hidden');
            skipBizcardToggleContainer.classList.replace('bg-surface-container-low', 'bg-blue-500/10');
            skipBizcardToggleContainer.classList.add('border-blue-500/30');
            
            // Re-validate to remove error borders if they existed
            if (bizcardRequestInput) bizcardRequestInput.classList.remove('border-error');
        } else {
            bizcardFormActiveArea.classList.remove('opacity-40', 'pointer-events-none', 'grayscale');
            rightColumnDisabledOverlay.classList.add('hidden');
            skipBizcardToggleContainer.classList.replace('bg-blue-500/10', 'bg-surface-container-low');
            skipBizcardToggleContainer.classList.remove('border-blue-500/30');
        }
    }

    function hasFormChanged() {
        // Form states
        const currentSettings = {
            bizcardEnabled: !skipBizcardToggle.checked,
            bizcardRequest: Math.max(0, parseInt(bizcardRequestInput?.value || 0, 10)),
            dataConversionPlan: document.querySelector('input[name="dataConversionPlan"]:checked')?.value,
            internalMemo: internalMemoInput?.value || '',
            premiumOptions: getPremiumSelectionsFromDom()
        };

        const initial = state.initialSettings;
        const initialPremium = normalizePremiumOptions(initial.premiumOptions);
        const currentPremium = normalizePremiumOptions(currentSettings.premiumOptions);

        if (currentSettings.bizcardEnabled !== initial.bizcardEnabled) return true;
        
        if (!state.isSkipped) {
            if (currentSettings.bizcardRequest != initial.bizcardRequest) return true;
            if (currentSettings.dataConversionPlan != initial.dataConversionPlan) return true;
            if (currentPremium.multilingual !== initialPremium.multilingual) return true;
            if (!areArraysEqual(currentPremium.additionalItems, initialPremium.additionalItems)) return true;
        }

        if (currentSettings.internalMemo.trim() !== (initial.internalMemo || '').trim()) return true;

        const sharedCouponKey = 'sharedCoupon_' + (state.surveyId || 'temp');
        const initialCoupon = localStorage.getItem(sharedCouponKey) !== null ? localStorage.getItem(sharedCouponKey) : (initial.couponCode || '');
        const currentCouponCode = state.appliedCoupon ? state.appliedCoupon.code : couponCodeInput?.value || '';
        
        if (currentCouponCode !== initialCoupon) return true;

        return false;
    }

    // Warn before unload if dirty
    window.addEventListener('beforeunload', (e) => {
        if (hasFormChanged()) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    function handleCancel() {
        const returnUrl = state.surveyId
            ? `surveyCreation.html?surveyId=${encodeURIComponent(state.surveyId)}`
            : 'surveyCreation.html';
        if (hasFormChanged()) {
            showConfirmationModal(
                `変更が保存されていません。破棄して前の画面に戻りますか？`,
                () => { window.location.href = returnUrl; },
                '変更を破棄して戻る'
            );
        } else {
            window.location.href = returnUrl;
        }
    }

    function handleFormChange(event) {
        if (!event.target) return;
        const name = event.target.name || event.target.id;
        const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;

        if (name === 'dataConversionPlan') {
            const normalizedPlan = normalizePlanValue(value);
            state.settings.dataConversionPlan = normalizedPlan;
            const linkedSpeed = getPlanConfig(normalizedPlan)?.speedValue || getPlanConfig(DEFAULT_PLAN)?.speedValue || 'normal';
            state.settings.dataConversionSpeed = linkedSpeed;
        } else if (name === 'bizcardRequest') {
            state.settings.bizcardRequest = Math.max(0, parseInt(value, 10) || 0);
        }
        updateFullUI();
    }

    function handlePremiumOptionChange(event) {
        if (!event.target || !event.target.name) return;
        state.settings.premiumOptions = normalizePremiumOptions(state.settings.premiumOptions);

        if (event.target.name === 'premiumMultilingual') {
            state.settings.premiumOptions.multilingual = event.target.checked;
        } else if (event.target.name === 'premiumAdditionalItems') {
            const value = event.target.value;
            const items = new Set(state.settings.premiumOptions.additionalItems || []);
            if (event.target.checked) items.add(value);
            else items.delete(value);
            state.settings.premiumOptions.additionalItems = Array.from(items);
        }
        updateFullUI();
    }

    async function handleApplyCoupon() {
        if (state.isCouponProcessing) return;

        const code = couponCodeInput.value.trim();
        if (!code) {
            showCouponError('クーポンコードを入力してください。');
            return;
        }

        state.isCouponProcessing = true;
        updateCouponSectionUI();

        try {
            const result = await validateCoupon(code);
            if (result.success) {
                state.appliedCoupon = { ...result, code };
                state.settings.couponCode = code;
                state.isCouponApplied = true;
                
                // Sync to localStorage
                const sharedCouponKey = 'sharedCoupon_' + (state.surveyId || 'temp');
                localStorage.setItem(sharedCouponKey, code);

                couponCodeInput.value = '';
                document.getElementById('couponCodeErrorMessage')?.classList.add('hidden');
                showToast(`クーポン「${code}」を適用しました。`, 'success');
            } else {
                showCouponError(result.message || '無効なクーポンコードです。');
            }
        } catch (error) {
            console.error('クーポン検証エラー:', error);
            showCouponError('クーポンの検証中にエラーが発生しました。');
        } finally {
            state.isCouponProcessing = false;
            updateCouponSectionUI();
            updateFullUI();
        }
    }

    function handleRemoveCoupon() {
        showConfirmationModal('クーポンを解除すると、アンケート全体の料金お値引きが取り消されます。解除しますか？', () => {
            state.appliedCoupon = null;
            state.isCouponApplied = false;
            state.settings.couponCode = '';
            
            // Sync to localStorage
            const sharedCouponKey = 'sharedCoupon_' + (state.surveyId || 'temp');
            localStorage.removeItem(sharedCouponKey);

            couponCodeInput.value = '';
            showToast('クーポンを解除しました。', 'success');
            updateCouponSectionUI();
            updateFullUI();
        }, 'クーポンを解除');
    }

    function showCouponError(message) {
        const errorContainer = document.getElementById('couponCodeErrorMessage');
        const errorText = document.getElementById('couponCodeErrorText');
        if (errorContainer && errorText) {
            errorText.textContent = message;
            errorContainer.classList.remove('hidden');
        }
    }

    async function handleSaveSettings() {
        // Validation check (only if not skipped)
        if (!state.isSkipped && bizcardRequestInput) {
            const value = parseInt(bizcardRequestInput.value || 0, 10);
            if (value <= 0) {
                showToast('依頼枚数は1以上を入力してください。', 'error');
                bizcardRequestInput.classList.add('border-error');
                return;
            }
        }

        const btnLoading = document.getElementById('saveBizcardSettingsBtnLoading');
        const btnText = document.getElementById('saveBizcardSettingsBtnText');
        
        saveButton.disabled = true;
        btnText.classList.add('opacity-0');
        btnLoading.classList.remove('hidden');

        // Form elements disabling
        document.body.style.pointerEvents = 'none';

        const finalizeSave = () => {
            saveButton.disabled = false;
            btnText.classList.remove('opacity-0');
            btnLoading.classList.add('hidden');
            document.body.style.pointerEvents = 'auto';
        };

        try {
            const savedData = {
                ...state.settings,
                bizcardEnabled: !state.isSkipped,
                couponCode: state.appliedCoupon ? state.appliedCoupon.code : null,
                internalMemo: internalMemoInput ? internalMemoInput.value : ''
            };

            if (!state.surveyId) {
                const tempDataString = localStorage.getItem('tempSurveyData');
                const surveyDataForUpdate = tempDataString ? JSON.parse(tempDataString) : {};
                if (!surveyDataForUpdate.settings) surveyDataForUpdate.settings = {};
                surveyDataForUpdate.settings.bizcard = savedData;
                localStorage.setItem('tempSurveyData', JSON.stringify(surveyDataForUpdate));
                showToast('設定を一時保存しました。', 'success');
                setTimeout(() => { window.location.href = 'surveyCreation.html'; }, 800);
            } else {
                savedData.surveyId = state.surveyId;
                const result = await saveBizcardSettings(savedData);
                if (result.success) {
                    sessionStorage.setItem(`updatedSurvey_${savedData.surveyId}`, JSON.stringify(savedData));
                    showToast('名刺データ化設定を保存しました！', 'success');
                    setTimeout(() => window.location.href = 'surveyCreation.html', 800);
                } else {
                    showToast(result.message || '設定の保存に失敗しました。', 'error');
                }
            }
        } catch (error) {
            console.error('設定保存エラー:', error);
            showToast('設定の保存中にエラーが発生しました。', 'error');
        } finally {
            if (!state.surveyId || !saveButton.disabled) finalizeSave();
        }
    }

    function updateFullUI() {
        state.settings.dataConversionPlan = normalizePlanValue(state.settings.dataConversionPlan);
        const selectedPlanConfig = getPlanConfig(state.settings.dataConversionPlan);
        state.settings.dataConversionSpeed = selectedPlanConfig?.speedValue || getPlanConfig(DEFAULT_PLAN)?.speedValue || 'normal';
        state.settings.premiumOptions = normalizePremiumOptions(state.settings.premiumOptions);

        const parsedBizcardRequest = parseInt(state.settings.bizcardRequest, 10);
        state.settings.bizcardRequest = Number.isFinite(parsedBizcardRequest) && parsedBizcardRequest >= 0 ? parsedBizcardRequest : 100;

        if (bizcardRequestInput && document.activeElement !== bizcardRequestInput) {
            bizcardRequestInput.value = state.settings.bizcardRequest;
        }
        // Keep slider in sync with state
        if (bizcardRequestSlider) {
            bizcardRequestSlider.value = Math.min(state.settings.bizcardRequest, 5000);
        }

        renderDataConversionPlans(DATA_CONVERSION_PLANS, state.settings.dataConversionPlan);
        renderPremiumOptions(PREMIUM_OPTION_GROUPS, state.settings.premiumOptions);

        // Calculate estimate (force zeroes if skipped)
        const estimateSettings = state.isSkipped ? { ...state.settings, bizcardRequest: 0, dataConversionPlan: 'none', premiumOptions: { multilingual: false, additionalItems: [] } } : state.settings;
        
        const estimate = calculateEstimate(estimateSettings, state.appliedCoupon, state.surveyData?.periodEnd);
        
        if (state.isSkipped) {
            estimate.amount = 0;
            estimate.minCharge = 0;
            estimate.requestedCards = 0;
            estimate.premiumTotal = 0;
            const ed = document.getElementById('estimatedCompletionDate');
            if (ed) ed.textContent = 'データ化を実施しない';
        }

        renderEstimate(estimate);
        updateCouponSectionUI();
        
        // Handle validation logic
        if (!state.isSkipped && bizcardRequestInput) {
            const value = parseInt(bizcardRequestInput.value || 0, 10);
            if (value > 0) {
                 bizcardRequestInput.classList.remove('border-error');
                 saveButton.disabled = false;
            } else {
                 saveButton.disabled = true;
            }
        } else {
            if(saveButton) saveButton.disabled = false;
        }
    }

    function updateCouponSectionUI() {
        const inputContainer = document.getElementById('couponInputContainer');
        const appliedContainer = document.getElementById('couponAppliedContainer');
        const codeDisplay = document.getElementById('appliedCouponCodeDisplay');
        const applyLoading = document.getElementById('couponLoadingIndicator');

        if (!inputContainer || !appliedContainer) return;

        if (state.isCouponApplied && state.appliedCoupon) {
            inputContainer.classList.add('hidden');
            appliedContainer.classList.remove('hidden');
            if(codeDisplay) codeDisplay.textContent = state.appliedCoupon.code;
        } else {
            inputContainer.classList.remove('hidden');
            appliedContainer.classList.add('hidden');
        }

        if (state.isCouponProcessing) {
            applyCouponBtn?.classList.add('hidden');
            applyLoading?.classList.remove('hidden');
            if(couponCodeInput) couponCodeInput.disabled = true;
        } else {
            applyCouponBtn?.classList.remove('hidden');
            applyLoading?.classList.add('hidden');
            if(couponCodeInput) couponCodeInput.disabled = false;
        }
        
        const couponSectionWrapper = document.getElementById('couponSectionWrapper');
        if (couponSectionWrapper) {
            if (state.isSkipped) {
                couponSectionWrapper.classList.add('opacity-50', 'pointer-events-none', 'grayscale', 'bg-surface');
            } else {
                couponSectionWrapper.classList.remove('opacity-50', 'pointer-events-none', 'grayscale', 'bg-surface');
            }
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
