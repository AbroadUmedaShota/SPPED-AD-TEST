import {
    fetchSurveyData,
    fetchBizcardSettings,
    validateCoupon,
    saveBizcardSettings
} from './services/bizcardSettingsService.js';
import { calculateEstimate, SPEED_OPTIONS } from './services/bizcardCalculator.js';
import {
    renderSurveyInfo,
    setInitialFormValues,
    updateSettingsVisibility,
    renderEstimate,
    displayCouponResult,
    validateForm,
    setSaveButtonLoading,
    renderDataConversionPlans,
    renderDataConversionSpeeds
} from './ui/bizcardSettingsRenderer.js';
import { showToast } from './utils.js';
import { showConfirmationModal } from './confirmationModal.js';

const DATA_CONVERSION_FEATURES = {
    basicFields: {
        key: 'basic-fields',
        text: {
            ja: '対象項目: 氏名 / メールアドレス',
            en: 'Fields: Name / Email'
        }
    },
    monthlyLimit50: {
        key: 'monthly-limit-50',
        text: {
            ja: '月間50枚まで',
            en: 'Up to 50 cards / month'
        }
    },
    turnaround6Days: {
        key: 'turnaround-6-days',
        text: {
            ja: '納期目安: 6営業日',
            en: 'Turnaround: 6 business days'
        }
    },
    retention90Days: {
        key: 'retention-90-days',
        text: {
            ja: 'データ保存期間: 90日間',
            en: 'Data retention: 90 days'
        }
    },
    extendedFields: {
        key: 'extended-fields',
        text: {
            ja: '対象項目: 氏名 / メール / 会社名 / 部署 / 役職 / 郵便番号 / 住所 / 電話 / 携帯 / Webサイト',
            en: 'Fields: Name / Email / Company / Department / Title / Zip / Address / Phone / Mobile / Website'
        }
    },
    doubleCheck: {
        key: 'double-check',
        text: {
            ja: '有人ダブルチェックで高精度',
            en: 'High accuracy with human double-checks'
        }
    },
    socialQrFields: {
        key: 'social-qr-fields',
        text: {
            ja: 'SNS・QRコードなどの追加項目',
            en: 'Includes social and QR data'
        }
    },
    crmReadyData: {
        key: 'crm-ready-data',
        text: {
            ja: 'CRM連携向けの整形データ',
            en: 'CRM-ready formatted data'
        }
    },
    sameDaySupport: {
        key: 'same-day-support',
        text: {
            ja: '最短当日納品に対応',
            en: 'Same-day delivery available'
        }
    },
    unlimitedRetention: {
        key: 'unlimited-retention',
        text: {
            ja: 'データ保存期間: 無期限',
            en: 'Data retention: Unlimited'
        }
    }
};

const FREE_PLAN_BASE_FEATURES = [
    DATA_CONVERSION_FEATURES.basicFields,
    DATA_CONVERSION_FEATURES.monthlyLimit50
];

const FREE_PLAN_ADDITIONAL_FEATURES = [
    DATA_CONVERSION_FEATURES.turnaround6Days,
    DATA_CONVERSION_FEATURES.retention90Days
];

const STANDARD_PLAN_BASE_FEATURES = [
    ...FREE_PLAN_BASE_FEATURES,
    ...FREE_PLAN_ADDITIONAL_FEATURES
];

const STANDARD_PLAN_ADDITIONAL_FEATURES = [
    DATA_CONVERSION_FEATURES.extendedFields,
    DATA_CONVERSION_FEATURES.doubleCheck
];

const PREMIUM_PLAN_BASE_FEATURES = [
    ...STANDARD_PLAN_BASE_FEATURES,
    ...STANDARD_PLAN_ADDITIONAL_FEATURES
];

const PREMIUM_PLAN_ADDITIONAL_FEATURES = [
    DATA_CONVERSION_FEATURES.socialQrFields,
    DATA_CONVERSION_FEATURES.crmReadyData,
    DATA_CONVERSION_FEATURES.sameDaySupport,
    DATA_CONVERSION_FEATURES.unlimitedRetention
];

const DATA_CONVERSION_PLANS = [
    {
        value: 'free',
        title: { ja: 'お試しプラン', en: 'Trial Plan' },
        price: { ja: '¥50/枚', en: '¥50/card' },
        priceNote: { ja: '2項目対応（氏名・メールアドレス）', en: 'Includes 2 fields (Name & Email)' },
        basePlanKey: null,
        baseFeatures: [...FREE_PLAN_BASE_FEATURES],
        additionalFeatures: [...FREE_PLAN_ADDITIONAL_FEATURES],
        badges: [
            { text: { ja: '対象項目: 氏名 / メールアドレス', en: 'Fields: Name / Email' }, tone: 'info' },
            { text: { ja: '月間50枚まで', en: 'Up to 50 cards / month' }, tone: 'limit' }
        ],
        description: {
            ja: '名刺データ化をまずは試したい方向け。',
            en: 'For those who want to try business card digitization.'
        },
        highlights: [
            { ja: '納期目安: 6営業日', en: 'Turnaround: 6 business days' },
            { ja: 'データ保存期間: 90日間', en: 'Data retention: 90 days' }
        ]
    },
    {
        value: 'standard',
        title: { ja: 'スタンダード', en: 'Standard' },
        price: { ja: '¥50/枚〜', en: '¥50/card〜' },
        priceNote: { ja: '10項目データ化（通常作業 @50円）', en: 'Up to 10 fields (Normal @¥50/card)' },
        basePlanKey: 'free',
        baseFeatures: [...STANDARD_PLAN_BASE_FEATURES],
        additionalFeatures: [...STANDARD_PLAN_ADDITIONAL_FEATURES],
        badges: [
            { text: { ja: '対象項目: 氏名 / メール / 会社名 / 部署 / 役職 / 郵便番号 / 住所 / 電話 / 携帯 / Webサイト', en: 'Fields: Name / Email / Company / Department / Title / Zip / Address / Phone / Mobile / Website' }, tone: 'info' }
        ],
        description: {
            ja: 'もっとも選ばれている標準プラン。有人によるダブルチェックで高精度なデータを納品します。',
            en: 'Most popular plan with human double-checks for high accuracy.'
        },
        highlights: [
            { ja: '納期目安: 6営業日（通常作業）', en: 'Turnaround: 6 business days (Normal)' },
            { ja: 'データ保存期間: 90日間', en: 'Data retention: 90 days' }
        ]
    },
    {
        value: 'premium',
        title: { ja: 'プレミアム', en: 'Premium' },
        price: { ja: '要お見積もり', en: 'Custom quote' },
        priceNote: { ja: '月額契約（個別見積り）', en: 'Monthly contract (custom quote)' },
        basePlanKey: 'standard',
        baseFeatures: [...PREMIUM_PLAN_BASE_FEATURES],
        additionalFeatures: [...PREMIUM_PLAN_ADDITIONAL_FEATURES],
        badges: [
            { text: { ja: '対象項目: スタンダード項目 + SNS・QR情報', en: 'Fields: Standard + Social / QR data' }, tone: 'info' }
        ],
        description: {
            ja: 'イベントや展示会で大量の名刺を扱う企業向け。CRM連携用の整形データを納品します。',
            en: 'Ideal for events with high volume, delivering CRM-ready formatted data.'
        },
        highlights: [
            { ja: '納期目安: 最短当日〜6営業日', en: 'Turnaround: Same-day to 6 business days' },
            { ja: 'データ保存期間: 無期限', en: 'Data retention: Unlimited' }
        ]
    }
];

export function initBizcardSettings() {
    // --- DOM Element Cache ---
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
            settingsData.dataConversionPlan = settingsData.dataConversionPlan || 'free';
            settingsData.dataConversionSpeed = settingsData.dataConversionSpeed || 'normal';
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

            renderSurveyInfo(surveyData, state.surveyId);
            setInitialFormValues(state.settings);
            if (initialCouponFeedback) {
                displayCouponResult(initialCouponFeedback);
            }

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
            bizcardRequestInput,
            dataConversionPlanSelection,
            dataConversionSpeedSelection
        ];
        formElements.forEach(el => {
            if(el) el.addEventListener('change', (e) => handleFormChange(e));
        });
        if(bizcardRequestInput) bizcardRequestInput.addEventListener('input', (e) => handleFormChange(e));

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
            dataConversionSpeed: document.querySelector('input[name="dataConversionSpeed"]:checked')?.value,
            internalMemo: internalMemoInput.value || ''
        };

        const initial = state.initialSettings;

        if (currentSettings.bizcardRequest != initial.bizcardRequest) return true;
        if (currentSettings.dataConversionPlan != initial.dataConversionPlan) return true;
        if (currentSettings.dataConversionSpeed != initial.dataConversionSpeed) return true;
        if (currentSettings.internalMemo.trim() !== (initial.internalMemo || '').trim()) return true;
        
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
                state.settings.dataConversionPlan = value;
                break;
            case 'dataConversionSpeed':
                state.settings.dataConversionSpeed = value;
                break;
            case 'bizcardRequest':
                state.settings.bizcardRequest = Math.max(0, parseInt(value, 10) || 0);
                break;
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

        // Speed plan restriction logic
        const isTrialPlan = state.settings.dataConversionPlan === 'free';
        const speedPlanSection = document.getElementById('speed-plan-section');
        if (speedPlanSection) {
            if (isTrialPlan) {
                speedPlanSection.classList.add('opacity-50', 'pointer-events-none');
            } else {
                speedPlanSection.classList.remove('opacity-50', 'pointer-events-none');
            }
        }

        const speedOptions = document.querySelectorAll('input[name="dataConversionSpeed"]');
        
        speedOptions.forEach(radio => {
            if (radio.value !== 'normal') {
                radio.disabled = isTrialPlan;
            }
        });

        if (isTrialPlan) {
            const normalPlanRadio = document.querySelector('input[name="dataConversionSpeed"][value="normal"]');
            if (normalPlanRadio) normalPlanRadio.checked = true;
            state.settings.dataConversionSpeed = 'normal';
        }

        if (!state.settings.dataConversionPlan && DATA_CONVERSION_PLANS.length > 0) {
            state.settings.dataConversionPlan = DATA_CONVERSION_PLANS[0].value;
        }
        if (!state.settings.dataConversionSpeed) {
            state.settings.dataConversionSpeed = 'normal';
        }
        const parsedBizcardRequest = parseInt(state.settings.bizcardRequest, 10);
        state.settings.bizcardRequest = Number.isFinite(parsedBizcardRequest) && parsedBizcardRequest > 0
            ? parsedBizcardRequest
            : 100;

        if (bizcardRequestInput) {
            bizcardRequestInput.value = state.settings.bizcardRequest;
        }

        renderDataConversionPlans(DATA_CONVERSION_PLANS, state.settings.dataConversionPlan);

        // データ化スピードプラン（@単価表記）
        const SPEED_LABELS = {
            normal: { ja: '通常作業プラン', en: 'Normal' },
            express: { ja: '特急作業プラン', en: 'Express' },
            superExpress: { ja: '超特急作業プラン', en: 'Super Express' },
            onDemand: { ja: 'オンデマンドプラン', en: 'On-Demand' }
        };
        const speedList = Object.entries(SPEED_OPTIONS).map(([key, val]) => ({
            value: key,
            title: SPEED_LABELS[key] || { ja: key, en: key },
            unitPrice: val.price_per_card,
            days: val.days
        }));
        renderDataConversionSpeeds(speedList, state.settings.dataConversionSpeed);

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

    // --- Initialize Page ---
    initializePage();
}
