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
    renderDataConversionPlans
} from './ui/bizcardSettingsRenderer.js';
import { showToast } from './utils.js';
import { showConfirmationModal } from './confirmationModal.js';

const DATA_CONVERSION_PLANS = [
    {
        value: 'free',
        title: { ja: '無料トライアル', en: 'Free Trial' },
        price: { ja: '¥0', en: '¥0' },
        priceNote: { ja: '月額・初期費用なし', en: 'No monthly or initial fee' },
        badges: [
            { text: { ja: '対象項目: 氏名 / 会社名 / メール', en: 'Fields: Name / Company / Email' }, tone: 'info' },
            { text: { ja: '月間50枚まで', en: 'Up to 50 cards / month' }, tone: 'limit' }
        ],
        description: {
            ja: '名刺データ化をまずは試したい方向け。OCRによる自動抽出のみ提供します。',
            en: 'Entry plan with OCR-only extraction for teams trying the service.'
        },
        highlights: [
            { ja: '納期目安: 3営業日', en: 'Turnaround: 3 business days' },
            { ja: '納品形式: CSVダウンロード', en: 'Delivery: CSV download' }
        ]
    },
    {
        value: 'standard',
        title: { ja: 'スタンダード', en: 'Standard' },
        price: { ja: '¥5,000', en: '¥5,000' },
        priceNote: { ja: '基本料金', en: 'Base charge' },
        badges: [
            { text: { ja: '対象項目: 氏名 / 会社名 / 部署 / 役職 / メール', en: 'Fields: Name / Company / Department / Title / Email' }, tone: 'info' },
            { text: { ja: '月間300枚まで', en: 'Up to 300 cards / month' }, tone: 'limit' }
        ],
        description: {
            ja: 'もっとも選ばれている標準プラン。有人によるダブルチェックで高精度なデータを納品します。',
            en: 'Most popular plan with human double-checks for high accuracy.'
        },
        highlights: [
            { ja: '納期目安: 2営業日', en: 'Turnaround: 2 business days' },
            { ja: '納品形式: CSV / Excel', en: 'Delivery: CSV / Excel' }
        ]
    },
    {
        value: 'premium',
        title: { ja: 'プレミアム', en: 'Premium' },
        price: { ja: '¥12,000', en: '¥12,000' },
        priceNote: { ja: '高度な名寄せ・重複排除込み', en: 'Includes advanced deduplication' },
        badges: [
            { text: { ja: '対象項目: スタンダード項目 + SNS・QR情報', en: 'Fields: Standard + Social / QR data' }, tone: 'info' },
            { text: { ja: '月間1,000枚まで', en: 'Up to 1,000 cards / month' }, tone: 'limit' }
        ],
        description: {
            ja: 'イベントや展示会で大量の名刺を扱う企業向け。CRM連携用の整形データを納品します。',
            en: 'Ideal for events with high volume, delivering CRM-ready formatted data.'
        },
        highlights: [
            { ja: '納期目安: 1営業日', en: 'Turnaround: 1 business day' },
            { ja: '納品形式: CSV / Excel / Salesforce', en: 'Delivery: CSV / Excel / Salesforce' }
        ]
    },
    {
        value: 'enterprise',
        title: { ja: 'エンタープライズ', en: 'Enterprise' },
        price: { ja: '¥25,000〜', en: '¥25,000+' },
        priceNote: { ja: 'ボリューム割引 & カスタム要件対応', en: 'Volume pricing & custom workflows' },
        badges: [
            { text: { ja: '対象項目: プレミアム項目 + カスタム項目', en: 'Fields: Premium + Custom fields' }, tone: 'info' },
            { text: { ja: '月間無制限（個別見積り）', en: 'Unlimited (custom quote)' }, tone: 'limit' }
        ],
        description: {
            ja: '専任オペレーターや機密保持契約など大規模運用に対応。ワークフロー連携も個別に設計します。',
            en: 'Supports dedicated operators, NDAs, and bespoke workflow integrations.'
        },
        highlights: [
            { ja: '納期目安: 個別スケジュール', en: 'Turnaround: Custom schedule' },
            { ja: '納品形式: CRM / MAプラットフォーム連携', en: 'Delivery: CRM / MA platform integrations' }
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

            // Set default value for bizcardEnabled to true as the toggle is removed
            settingsData.bizcardEnabled = true;

            state.settings = settingsData;
            // Deep copy for initial state comparison
            state.initialSettings = JSON.parse(JSON.stringify(settingsData)); 

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
        const workPlanSelection = document.getElementById('workPlanSelection');
        const formElements = [
            bizcardRequestInput,
            dataConversionPlanSelection, dataConversionSpeedSelection, workPlanSelection
        ];
        formElements.forEach(el => {
            if(el) el.addEventListener('change', (e) => handleFormChange(e));
        });
        if(bizcardRequestInput) bizcardRequestInput.addEventListener('input', (e) => handleFormChange(e));

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
            bizcardRequest: parseInt(bizcardRequestInput.value, 10) || 0,
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
                state.settings.bizcardRequest = parseInt(value, 10) || 0;
                break;
        }

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
        const settingsFields = document.getElementById('bizcardSettingsFields');
        if(settingsFields) {
            settingsFields.classList.remove('hidden');
        }

        if (!state.settings.dataConversionPlan && DATA_CONVERSION_PLANS.length > 0) {
            state.settings.dataConversionPlan = DATA_CONVERSION_PLANS[0].value;
        }

        renderDataConversionPlans(DATA_CONVERSION_PLANS, state.settings.dataConversionPlan);

        const estimate = calculateEstimate(state.settings, state.appliedCoupon);
        renderEstimate(estimate);
        validateForm();
    }

    // --- Initialize Page ---
    initializePage();
}