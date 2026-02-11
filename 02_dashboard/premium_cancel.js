document.addEventListener('DOMContentLoaded', () => {
    // --- Cancel Confirmation Modal Logic ---
    const cancelConfirmationModal = document.getElementById('cancelConfirmationModal');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    const cancelCancelBtn = document.getElementById('cancel-cancel-btn');
    const cancelButton = document.getElementById('cancel-button'); // 解約ページの「解約する」ボタン

    // モーダルを開く関数
    function openCancelConfirmationModal() {
        if (cancelConfirmationModal) {
            cancelConfirmationModal.classList.remove('hidden');
            void cancelConfirmationModal.offsetWidth; // Force reflow
            cancelConfirmationModal.classList.remove('opacity-0');
            const modalContent = cancelConfirmationModal.querySelector('#cancel-confirmation-content');
            if (modalContent) {
                modalContent.classList.remove('scale-95');
            }
        }
    }

    // モーダルを閉じる関数
    function closeCancelConfirmationModal() {
        if (cancelConfirmationModal) {
            cancelConfirmationModal.classList.add('opacity-0');
            const modalContent = cancelConfirmationModal.querySelector('#cancel-confirmation-content');
            if (modalContent) {
                modalContent.classList.add('scale-95');
            }
            setTimeout(() => {
                cancelConfirmationModal.classList.add('hidden');
            }, 300); // Transition duration
        }
    }

    // 解約ボタンクリックイベント
    if (cancelButton) {
        cancelButton.addEventListener('click', (event) => {
            event.preventDefault(); // デフォルトのフォーム送信を防ぐ
            openCancelConfirmationModal();
        });
    }

    // 確認モーダルの「はい、解約する」ボタンクリックイベント
    if (confirmCancelBtn) {
        confirmCancelBtn.addEventListener('click', () => {
            // ここで解約処理（APIコールなど）を実行するが、今回は直接完了ページへ遷移
            // 解約理由をサーバーに送信する処理などをここに追加
            const cancelReason = document.getElementById('cancelReason').value;
            console.log('解約理由:', cancelReason);

            closeCancelConfirmationModal();
            window.location.href = 'premium_cancel_complete.html'; // 解約完了ページへ遷移
        });
    }

    // 確認モーダルの「いいえ、キャンセル」ボタンクリックイベント
    if (cancelCancelBtn) {
        cancelCancelBtn.addEventListener('click', closeCancelConfirmationModal);
    }

    // モーダル外クリックで閉じる処理
    if (cancelConfirmationModal) {
        cancelConfirmationModal.addEventListener('click', (event) => {
            if (event.target === cancelConfirmationModal) { // オーバーレイ部分をクリックした場合のみ
                closeCancelConfirmationModal();
            }
        });
    }
});