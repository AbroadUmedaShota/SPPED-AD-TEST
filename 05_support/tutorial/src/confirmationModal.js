import { handleOpenModal, closeModal } from './modalHandler.js';
import { resolveDashboardAssetPath } from './utils.js';

/**
 * Displays a confirmation modal and executes a callback on confirmation.
 * @param {string} message The message to display in the modal.
 * @param {function} onConfirm The callback function to execute if the user confirms.
 * @param {object} [options] Optional parameters.
 * @param {string} [options.title='確認'] The title of the modal.
 * @param {string} [options.confirmText='実行'] The text for the confirm button.
 * @param {string} [options.cancelText='キャンセル'] The text for the cancel button.
 * @param {boolean} [options.defaultCancel=true] If true, the cancel button is focused by default.
 * @param {string|null} [options.url=null] An optional URL to display below the message.
 */
export function showConfirmationModal(message, onConfirm, options = {}) {
    const {
        title = '確認',
        confirmText = '実行',
        cancelText = 'キャンセル',
        defaultCancel = true,
        prompt = null, // New option for input field
        url = null
    } = options;

    handleOpenModal('confirmationModal', resolveDashboardAssetPath('modals/confirmationModal.html'))
        .then(() => {
            const modal = document.getElementById('confirmationModal');
            console.log('ConfirmationModal: Entering then block after modal opened.');
            console.log('ConfirmationModal: Modal element retrieved:', modal);
            if (modal) {
                console.log('ConfirmationModal: Modal innerHTML:', modal.innerHTML);
            }
            if (!modal) {
                throw new Error('Confirmation modal element not found in DOM after handleOpenModal resolved.');
            }
            // 変数宣言を一度にまとめる
            const titleEl = modal.querySelector('#confirmationModalTitle');
            const messageEl = modal.querySelector('#confirmationModalMessage');
            const urlEl = modal.querySelector('#confirmationModalUrl');
            const inputContainer = modal.querySelector('#confirmationModalInputContainer');
            const confirmBtn = modal.querySelector('#confirmActionButton');
            const cancelBtn = modal.querySelector('[data-action="close"]');
            const closeBtn = modal.querySelector('#closeConfirmationModalBtn');

            console.log('ConfirmationModal: inputContainer element:', inputContainer);
            console.log('ConfirmationModal: prompt option received:', options.prompt);

            if (!confirmBtn || !cancelBtn) {
                throw new Error('Confirmation modal confirm or cancel buttons not found within the modal element.');
            }

            if (titleEl) titleEl.textContent = title;
            if (messageEl) messageEl.innerHTML = message;
            
            // --- URL Display Logic ---
            if (urlEl) {
                if (url) {
                    urlEl.textContent = url;
                    urlEl.parentNode.style.display = ''; // Show the container
                } else {
                    urlEl.textContent = '';
                    urlEl.parentNode.style.display = 'none'; // Hide the container
                }
            }
            // --- End URL Display Logic ---

            if (confirmBtn) confirmBtn.textContent = confirmText;
            if (cancelBtn) cancelBtn.textContent = cancelText;

            // --- Prompt/Input Field Logic ---
            let inputEls = {}; // 複数の入力フィールドを格納するためのオブジェクト
            if (inputContainer) {
                inputContainer.innerHTML = ''; // Clear previous content

                if (prompt) {
                    // promptが配列の場合（複数の入力フィールド）
                    if (Array.isArray(prompt)) {
                        prompt.forEach(p => {
                            if (p.type === 'select') {
                                inputContainer.innerHTML += `
                                                                <div class="input-group">
                                                                    <select id="${p.id}" class="input-field" ${p.required ? 'required' : ''}>
                                                                        ${p.options || ''}
                                                                    </select>
                                                                    <label class="input-label" for="${p.id}">${p.label || ''}</label>
                                                                    <div id="${p.id}Error" class="text-error text-sm mt-1 hidden"></div>
                                                                </div>                                `;
                            } else {
                                inputContainer.innerHTML += `
                                    <div class="input-group">
                                        <input type="${p.type || 'text'}" id="${p.id}" class="input-field" placeholder=" " ${p.required ? 'required' : ''}>
                                        <label class="input-label" for="${p.id}">${p.label || ''}</label>
                                        <div id="${p.id}Error" class="text-error text-sm mt-1 hidden"></div>
                                    </div>
                                `;
                            }
                        });
                        // 生成された各入力フィールドへの参照を取得
                        prompt.forEach(p => {
                            const el = document.getElementById(p.id);
                            if (el) {
                                inputEls[p.id] = el;
                            }
                        });
                        console.log(`[confirmationModal] Multiple prompt fields generated:`, inputEls);
                    }
                    // promptが単一オブジェクトの場合（単一入力フィールド）
                    else {
                        console.log(`[confirmationModal] Prompt type detected: ${prompt.type}`);
                        if (prompt.type === 'select') {
                            inputContainer.innerHTML = `
                                <div class="input-group">
                                    <select id="confirmationModalInput" class="input-field" ${prompt.required ? 'required' : ''}>
                                        ${prompt.options || ''}
                                    </select>
                                    <label class="input-label" for="confirmationModalInput">${prompt.label || ''}</label>
                                    <div id="confirmationModalInputError" class="text-error text-sm mt-1 hidden"></div>
                                </div>
                            `;
                        } else {
                            inputContainer.innerHTML = `
                                <div class="input-group">
                                    <input type="${prompt.type || 'text'}" id="confirmationModalInput" class="input-field" placeholder=" " ${prompt.required ? 'required' : ''}>
                                    <label class="input-label" for="confirmationModalInput">${prompt.label || ''}</label>
                                    <div id="confirmationModalInputError" class="text-error text-sm mt-1 hidden"></div>
                                </div>
                            `;
                        }
                        console.log(`[confirmationModal] inputContainer innerHTML after prompt generation:`, inputContainer.innerHTML);
                        const el = document.getElementById('confirmationModalInput');
                        if (el) {
                            inputEls['confirmationModalInput'] = el;
                        }
                        console.log(`[confirmationModal] Single prompt field generated:`, inputEls);
                    }
                }
            }
            // --- End Prompt Logic ---

            // newConfirmBtn, newCancelBtn の宣言と置き換えを早めに実行
            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

            let observer;

            // すべてのエラーメッセージをクリアするヘルパー関数
            const clearAllErrors = () => {
                if (Array.isArray(prompt)) {
                    prompt.forEach(p => {
                        const errorEl = document.getElementById(`${p.id}Error`);
                        if (errorEl) {
                            errorEl.textContent = '';
                            errorEl.classList.add('hidden');
                        }
                        const el = inputEls[p.id];
                        if (el) el.classList.remove('input-error');
                    });
                } else if (prompt && prompt.required) {
                    const errorEl = document.getElementById('confirmationModalInputError');
                    if (errorEl) {
                        errorEl.textContent = '';
                        errorEl.classList.add('hidden');
                    }
                    const el = inputEls['confirmationModalInput'];
                    if (el) el.classList.remove('input-error');
                }
            };

            const cleanup = () => {
                document.removeEventListener('keydown', handleKeyDown);
                if (observer) observer.disconnect();
                clearAllErrors(); // モーダルを閉じる際にエラーをクリア
            };

            // 確認ボタンのクリックハンドラ内で、入力値を取得してonConfirmに渡すロジックを修正
            const confirmAndClose = () => {
                console.log('Confirmation confirmed and closing modal.'); // このログが表示されるか確認
                clearAllErrors(); // 新しいバリデーションの前にエラーをクリア
                let inputValues = {}; // 常にオブジェクトとして収集するように変更
                let allValid = true;
                let passwordMismatch = false;

                // 複数の入力値がある場合（パスワード変更など）
                if (Array.isArray(prompt)) {
                    prompt.forEach(p => {
                        const el = inputEls[p.id];
                        const errorEl = document.getElementById(`${p.id}Error`);
                        if (el) {
                            inputValues[p.id] = el.value;
                            if (p.required && !el.value) {
                                allValid = false;
                                el.classList.add('input-error');
                                if (errorEl) {
                                    errorEl.textContent = 'このフィールドは必須です。';
                                    errorEl.classList.remove('hidden');
                                }
                            } else {
                                el.classList.remove('input-error');
                                if (errorEl) errorEl.classList.add('hidden');
                            }
                        } else {
                            console.warn(`[confirmationModal] Input element with ID ${p.id} not found in inputEls.`);
                            allValid = false; // 要素が見つからない場合は無効と判断
                        }
                    });

                    // パスワードが一致しない場合のバリデーション
                    if (prompt.some(p => p.type === 'password')) { // プロンプトにパスワードフィールドが含まれる場合
                        if (inputValues.newPassword && inputValues.confirmNewPassword && inputValues.newPassword !== inputValues.confirmNewPassword) {
                            passwordMismatch = true;
                            allValid = false;
                            const newPasswordErrorEl = document.getElementById('newPasswordError');
                            const confirmNewPasswordErrorEl = document.getElementById('confirmNewPasswordError');
                            if (newPasswordErrorEl) {
                                newPasswordErrorEl.textContent = 'パスワードが一致しません。';
                                newPasswordErrorEl.classList.remove('hidden');
                            }
                            if (confirmNewPasswordErrorEl) {
                                confirmNewPasswordErrorEl.textContent = 'パスワードが一致しません。';
                                confirmNewPasswordErrorEl.classList.remove('hidden');
                            }
                            inputEls.newPassword.classList.add('input-error');
                            inputEls.confirmNewPassword.classList.add('input-error');
                        }
                    }
                }
                // 単一入力の場合
                else {
                    const el = inputEls['confirmationModalInput'];
                    const errorEl = document.getElementById('confirmationModalInputError');
                    inputValues = el ? el.value : null; // 単一入力の場合は値を直接格納
                    if (prompt && prompt.required && !inputValues) {
                        allValid = false;
                        if (el) el.classList.add('input-error');
                        if (errorEl) {
                            errorEl.textContent = 'このフィールドは必須です。';
                            errorEl.classList.remove('hidden');
                        }
                    } else {
                        if (el) el.classList.remove('input-error');
                        if (errorEl) errorEl.classList.add('hidden');
                    }
                }
                
                console.log('[confirmationModal] allValid status:', allValid, 'Collected inputValues:', inputValues);
                if (!allValid) {
                    // エラーメッセージはインラインで表示されるため、トーストは不要
                    return; // 入力が不完全な場合は処理を中断
                }
                console.log('[confirmationModal] Calling onConfirm with:', inputValues);
                onConfirm(inputValues); // 収集した値をonConfirmに渡す
                closeModal('confirmationModal');
                cleanup();
            };

            const cancelAction = () => {
                console.log('Confirmation cancelled and closing modal.'); // デバッグ用ログ
                closeModal('confirmationModal');
                cleanup();
            };

            // inputEls が空でない場合、最初の入力フィールドにフォーカス
            const firstInputEl = Object.values(inputEls)[0];
            if (firstInputEl) {
                firstInputEl.focus();
            } else if (defaultCancel) {
                newCancelBtn.focus();
            } else {
                newConfirmBtn.focus();
            }

            console.log('[confirmationModal] Attaching click listeners.');
            console.log('[confirmationModal] newConfirmBtn element:', newConfirmBtn.outerHTML);
                        console.log('[confirmationModal] newCancelBtn element:', newCancelBtn.outerHTML);
            
                        // クリックイベントがブロックされないようにスタイルを強制適用
                        newConfirmBtn.style.pointerEvents = 'auto';
                        newConfirmBtn.style.opacity = '1';
                        newCancelBtn.style.pointerEvents = 'auto';
                        newCancelBtn.style.opacity = '1';
                        console.log('[confirmationModal] Forced pointer-events and opacity for buttons.');
            
                        newConfirmBtn.addEventListener('click', confirmAndClose);
                        newCancelBtn.addEventListener('click', cancelAction);
            if (closeBtn) {
                closeBtn.addEventListener('click', cancelAction);
            }
            console.log('[confirmationModal] Click listeners attached.');

            const handleKeyDown = (event) => {
                // 現在アクティブな要素がいずれかの入力フィールドか、または確認ボタンであるかをチェック
                const isActiveInput = Object.values(inputEls).some(el => el === document.activeElement);
                if (event.key === 'Enter' && (isActiveInput || newConfirmBtn === document.activeElement)) {
                    event.preventDefault();
                    confirmAndClose();
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelAction();
                }
            };

            document.addEventListener('keydown', handleKeyDown);

            observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    if (mutation.attributeName === 'data-state' && modal.dataset.state === 'closed') {
                        cleanup();
                    }
                });
            });
            observer.observe(modal, { attributes: true });
        })
        .catch(error => {
            console.error('Error opening confirmation modal:', error);
        });
}