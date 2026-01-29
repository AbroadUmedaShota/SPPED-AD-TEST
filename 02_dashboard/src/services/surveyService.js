import { resolveDashboardDataPath } from '../utils.js';
import {
    loadPlanCapabilities,
    normalizePlanTier,
    getCapabilitiesForTier
} from './planCapabilityService.js';
/**
 * アンケートデータをサーバーやファイルから取得します。
 * @returns {Promise<object>} アンケートデータのJSONオブジェクト
 * @throws {Error} データの取得に失敗した場合
 */
export async function fetchSurveyData() {
    try {
        // 現在はローカルのJSONを指していますが、将来的にはAPIエンドポイントに変更可能
        const response = await fetch(resolveDashboardDataPath('surveys/sample_survey.json'));
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch survey data:', error);
        // エラーを呼び出し元に再スローして、UI側でエラーハンドリングできるようにする
        throw error;
    }
}

/**
 * フォームからアンケートデータを収集します。
 * @returns {object} 収集されたアンケートデータ
 */
export function collectSurveyDataFromDOM() {
    const surveyData = {};

    // 基本情報の収集
    surveyData.name = document.getElementById('surveyName').value;
    surveyData.displayTitle = document.getElementById('displayTitle').value;
    surveyData.description = document.getElementById('description').value;
    surveyData.periodStart = document.getElementById('periodStart').value;
    surveyData.periodEnd = document.getElementById('periodEnd').value;
    surveyData.deadline = document.getElementById('deadline').value;
    surveyData.memo = document.getElementById('memo').value;

    // 名刺データ関連の収集
    surveyData.bizcardEnabled = document.getElementById('bizcardEnabled') ? document.getElementById('bizcardEnabled').value : '';
    surveyData.bizcardRequest = document.getElementById('bizcardRequest') ? document.getElementById('bizcardRequest').value : '';

    // お礼メール設定の収集
    surveyData.thankYouEmailSettings = document.getElementById('thankYouEmailSettings') ? document.getElementById('thankYouEmailSettings').value : '';

    // 質問グループの収集
    surveyData.questionGroups = [];
    document.querySelectorAll('.question-group').forEach(groupElement => {
        const group = {
            groupId: groupElement.dataset.groupId,
            title: groupElement.querySelector('.group-title-input').value,
            questions: []
        };

        groupElement.querySelectorAll('.question-item').forEach(questionElement => {
            const question = {
                questionId: questionElement.dataset.questionId,
                type: questionElement.dataset.questionType, // data-question-type属性から直接取得
                text: questionElement.querySelector('.question-text-input').value,
                required: questionElement.querySelector('.required-checkbox').checked
            };

            // 選択肢の収集 (シングルアンサー、マルチアンサー、マトリックスの場合)
            if (['single_answer', 'multi_answer', 'matrix_sa', 'matrix_ma'].includes(question.type)) {
                question.options = [];
                questionElement.querySelectorAll('.options-container .option-text-input').forEach((optionInput, index) => {
                    question.options.push({
                        optionId: `opt_${question.questionId}_${index + 1}`,
                        text: optionInput.value
                    });
                });
            }

            group.questions.push(question);
        });
        surveyData.questionGroups.push(group);
    });

    return surveyData;
}

const LOCAL_STORAGE_KEY = 'surveyCreationData';

/**
 * 収集したアンケートデータをlocalStorageに保存します。
 * @param {object} surveyData 保存するアンケートデータ
 */
export function saveSurveyDataToLocalStorage(surveyData) {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(surveyData));
        
    } catch (e) {
        console.error('Error saving survey data to localStorage:', e);
    }
}

/**
 * localStorageからアンケートデータを読み込みます。
 * @returns {object | null} 読み込んだアンケートデータ、または存在しない場合はnull
 */
export function loadSurveyDataFromLocalStorage() {
    try {
        const data = localStorage.getItem(LOCAL_STORAGE_KEY);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error('Error loading survey data from localStorage:', e);
        return null;
    }
}

/**
 * プラン制限に対してアンケートの設問数を検証します。
 * @param {object} surveyData
 * @param {string} planTier
 * @returns {Promise<{ok: boolean, limit?: number, count?: number}>}
 */
export async function validateSurveyPlanLimits(surveyData, planTier) {
    const capabilities = await loadPlanCapabilities();
    const tier = normalizePlanTier(planTier);
    const planCaps = getCapabilitiesForTier(tier, capabilities);
    const maxQuestions = planCaps?.maxQuestions;

    if (typeof maxQuestions !== 'number') {
        return { ok: true };
    }

    const count = (surveyData?.questionGroups || []).reduce((sum, group) => sum + (group.questions?.length || 0), 0);
    if (count > maxQuestions) {
        return { ok: false, limit: maxQuestions, count };
    }

    return { ok: true, limit: maxQuestions, count };
}
