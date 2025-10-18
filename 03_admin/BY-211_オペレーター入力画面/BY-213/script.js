// グループ情報
const groups = ["グループ1", "グループ2", "グループ3", "グループ4", "グループ5", "グループ6", "グループ7", "グループ8"];
let currentGroupIndex = 0;
let userEmail; // メールアドレスを保持する変数
let startTime;  // 経過時間計測用の変数

// --- 初期化処理 ---
document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    const mainImage = document.getElementById('main-image');
    const thumbnailContainer = document.querySelector('.thumbnail-container');
    const rotateBtn = document.getElementById('rotate-btn');
    const resetBtn = document.getElementById('reset-btn');
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const toggleDarkModeButton = document.querySelector('.toggle-dark-mode');
    const body = document.body;

    // 画像操作の状態変数
    let mainImageRotation = 0;
    let mainImageScale = 1;
    let isFront = true;
    const frontImageSrc = "../../sample/表.png";
    const backImageSrc = "../../sample/裏.png";

    // --- 画像操作関連の関数 ---
    function updateTransform() {
        if (mainImage) {
            mainImage.style.transformOrigin = 'center'; // 回転の中心を明示的に設定
            mainImage.style.transform = `rotate(${mainImageRotation}deg) scale(${mainImageScale})`;
        }
    }

    function swapImages() {
        const currentThumb = thumbnailContainer.querySelector('img');
        if (!mainImage || !currentThumb) return;

        const mainSrc = isFront ? frontImageSrc : backImageSrc;
        const thumbSrc = isFront ? backImageSrc : frontImageSrc;

        mainImage.src = thumbSrc;
        mainImage.alt = isFront ? "名刺の裏面" : "名刺の表面";
        currentThumb.src = mainSrc;
        currentThumb.alt = isFront ? "名刺の表面サムネイル" : "名刺の裏面サムネイル";
        
        isFront = !isFront;
    }

    // --- イベントリスナー設定 ---

    // 画像切り替え (クリック)
    if (thumbnailContainer) {
        thumbnailContainer.addEventListener('click', swapImages);
    }

    // 画像切り替え (ショートカット)
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 'q') {
            // 入力フィールドにフォーカスがある場合は何もしない
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
                return;
            }
            e.preventDefault();
            swapImages();
        }
    });

    // 新しいコントロールパネルのイベントリスナー
    if (rotateBtn) {
        rotateBtn.addEventListener('click', () => {
            mainImageRotation += 90;
            updateTransform();
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            mainImageRotation = 0;
            mainImageScale = 1;
            zoomSlider.value = 1;
            updateTransform();
        });
    }

    if (zoomSlider) {
        zoomSlider.addEventListener('input', () => {
            mainImageScale = zoomSlider.value;
            updateTransform();
        });
    }

    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            zoomSlider.stepDown();
            mainImageScale = zoomSlider.value;
            updateTransform();
        });
    }

    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            zoomSlider.stepUp();
            mainImageScale = zoomSlider.value;
            updateTransform();
        });
    }

    // 拡大・縮小機能 (ホイール)
    if (mainImage) {
        mainImage.addEventListener('wheel', (e) => {
            e.preventDefault();
            const scaleAmount = 0.1;
            if (e.deltaY < 0) {
                mainImageScale = Math.min(parseFloat(zoomSlider.max), parseFloat(mainImageScale) + scaleAmount);
            } else {
                mainImageScale = Math.max(parseFloat(zoomSlider.min), parseFloat(mainImageScale) - scaleAmount);
            }
            zoomSlider.value = mainImageScale;
            updateTransform();
        });
        toggleDarkModeButton.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
        });
    }

    displayCurrentGroup();
    resumeWork();
    setInterval(updateElapsedTime, 1000);
    setupEventListeners();
});


// グループの表示を制御する関数
function displayCurrentGroup() {
    const groupSections = document.querySelectorAll('.group-section');
    groupSections.forEach((section, index) => {
        if (index === currentGroupIndex) {
            section.classList.add('active');
            const firstInput = section.querySelector('input:not([type="hidden"]), textarea');
            if (firstInput) firstInput.focus();
        } else {
            section.classList.remove('active');
        }
    });
}

// 次のグループへ進む関数
function moveToNextCardOrGroup() {
    if (currentGroupIndex < groups.length - 1) {
        currentGroupIndex++;
    } else {
        showAlert("全てのグループの入力を完了しました。");
        currentGroupIndex = 0;
    }
    displayCurrentGroup();
}

// スキップ処理関数
function handleSkip() {
    document.getElementById("skip-overlay").classList.add("active");
    const otherReasonRadio = document.querySelector('input[name="skip-reason"][value="other"]');
    const otherReasonInput = document.getElementById('skip-reason-other-input');
    otherReasonRadio.addEventListener('change', function() {
        otherReasonInput.style.display = this.checked ? 'block' : 'none';
    });
}

// スキップ実行関数
function confirmSkip() {
    const selectedReason = document.querySelector('input[name="skip-reason"]:checked').value;
    let otherReasonText = "";
    if (selectedReason === 'other') {
        otherReasonText = document.getElementById('other-reason-text').value;
    }
    showAlert("スキップ理由: " + selectedReason + (otherReasonText ? ' ' + otherReasonText : '') + " \n(スキップしました)");
    document.getElementById("skip-overlay").classList.remove("active");
    moveToNextCardOrGroup();
}

function cancelSkip() {
    document.getElementById("skip-overlay").classList.remove("active");
}

// 作業終了関数
function handleSuspend() {
    document.getElementById("confirm-overlay").classList.add("active");
}

function confirmSuspend() {
    document.getElementById("confirm-overlay").classList.remove("active");
    showAlert("作業を終了しました。");
}

function cancelSuspend() {
    document.getElementById("confirm-overlay").classList.remove("active");
}

// メイン処理関数
function processCardInput() {
    if (!validateForm()) return;
    moveToNextCardOrGroup();
}

// アラート表示関数
function showAlert(message) {
    const alertOverlay = document.getElementById("alert-overlay");
    const alertBox = alertOverlay.querySelector(".alert-box");
    alertBox.textContent = message;
    alertOverlay.classList.add("active");
    setTimeout(() => {
        alertOverlay.classList.remove("active");
    }, 1000);
}

// 経過時間更新
function updateElapsedTime() {
    if (!startTime) return;
    const currentTime = new Date();
    const elapsedTime = currentTime - startTime;
    const seconds = Math.floor(elapsedTime / 1000) % 60;
    const minutes = Math.floor(elapsedTime / (1000 * 60)) % 60;
    const hours = Math.floor(elapsedTime / (1000 * 60 * 60));
    const formattedTime = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    document.getElementById('elapsed-time').textContent = `経過時間: ${formattedTime}`;
}

// 作業再開時のデータ復元
function resumeWork() {
    userEmail = localStorage.getItem('userEmail') || 'example@example.com';
    document.getElementById('user-email').textContent = `入力者アカウント名: ${userEmail}`;
    startTime = localStorage.getItem('startTime') ? new Date(localStorage.getItem('startTime')) : new Date();
}

// フォームバリデーション
function validateForm() {
    const email = document.getElementById('email').value;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
        showAlert('有効なメールアドレスを入力してください');
        return false;
    }
    return true;
}

// イベントリスナー設定
function setupEventListeners() {
    document.getElementById('confirm-button').addEventListener('click', processCardInput);
    document.getElementById('skip-button').addEventListener('click', handleSkip);
    document.getElementById('suspend-button').addEventListener('click', handleSuspend);
    document.getElementById('confirm-skip-button').addEventListener('click', confirmSkip);
    document.getElementById('cancel-skip-button').addEventListener('click', cancelSkip);
    document.getElementById('confirm-suspend-button').addEventListener('click', confirmSuspend);
    document.getElementById('cancel-suspend-button').addEventListener('click', cancelSuspend);

    document.addEventListener('keydown', function (event) {
        if (event.ctrlKey && event.key === 'Enter') {
            event.preventDefault();
            processCardInput();
        }
    });

    // 郵便番号からの住所自動入力 (jQueryを使用)
    if (window.jQuery) {
        $('#zip').mask('999-9999', {
            completed: function () {
                fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${$('#zip').val()}`)
                    .then(response => {
                        if (!response.ok) throw new Error('APIエラー: ' + response.status);
                        return response.json();
                    })
                    .then(response => {
                        if (response.results && response.results.length > 0) {
                            const address = response.results[0];
                            $('#address1').val(`${address.address1}${address.address2}${address.address3}`);
                        }
                    })
                    .catch(error => {
                        showAlert('住所検索中にエラーが発生しました: ' + error.message);
                    });
            }
        });
    }
}