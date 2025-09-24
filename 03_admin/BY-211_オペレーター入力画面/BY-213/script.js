// グループ情報
const groups = ["グループ1", "グループ2", "グループ3", "グループ4", "グループ5", "グループ6", "グループ7", "グループ8"];
let currentGroupIndex = 0;
let currentCardIndex = 0;
let cardData = []; // 名刺データを格納する配列
let inputData = {}; // 入力データを格納するオブジェクト
let cardRotation = {}; // 各名刺の回転状態を保持するオブジェクト
let userEmail; // メールアドレスを保持する変数
let startTime;  // 経過時間計測用の変数

// 名刺データを想定したダミーデータ
const dummyCardData = [
    {
        front: "https://placehold.jp/400x250.png?text=表1",
        back: "https://placehold.jp/400x250.png?text=裏1"
    },
    {
        front: "https://placehold.jp/400x250.png?text=表2",
        back: "https://placehold.jp/400x250.png?text=裏2"
    },
    {
        front: "https://placehold.jp/400x250.png?text=表3",
        back: "https://placehold.jp/400x250.png?text=裏3"
    }
    // 必要に応じて名刺データを追加
];

// ダークモード
const toggleDarkModeButton = document.querySelector('.toggle-dark-mode');
const body = document.body;

toggleDarkModeButton.addEventListener('click', () => {
    body.classList.toggle('dark-mode');
});

// ローテーションボタン
const rotateButton = document.getElementById('rotate-button');
const cardImagesContainer = document.querySelector('.card-area');
const cardImages = document.querySelectorAll('.card-image-wrapper');

rotateButton.addEventListener('click', () => {
    const currentCard = cardData[currentCardIndex];
    if (!cardRotation[currentCardIndex]) {
        cardRotation[currentCardIndex] = 0;
    }

    cardRotation[currentCardIndex] += 1;

    cardImagesContainer.classList.toggle('rotated');
    cardImages.forEach(img => {
        img.classList.toggle('rotated');
        const cardImage = img.querySelector('img');
        if (cardImagesContainer.classList.contains('rotated')) {
            cardImage.style.transform = `rotate(${cardRotation[currentCardIndex] * 90}deg)`;
        } else {
            cardImage.style.transform = `rotate(0deg)`;
        }
    });
});

// グループの表示を制御する関数
function displayCurrentGroup() {
    const groupSections = document.querySelectorAll('.group-section');
    groupSections.forEach((section, index) => {
        if (index === currentGroupIndex) {
            section.classList.add('active');
            const firstInput = section.querySelector('input:not([type="hidden"]), textarea');
            if (firstInput)
                firstInput.focus();
        } else {
            section.classList.remove('active');
        }
    });
}

// 名刺データをロードして画像を表示する関数
function loadCardData() {
    if (cardData.length > currentCardIndex) {
        const card = cardData[currentCardIndex];
        setCardImageSrc('front-image', card.front);
        setCardImageSrc('back-image', card.back);
        setCardRotation(currentCardIndex)
    }
}

// 画像ソースを設定する関数
function setCardImageSrc(imageId, src) {
    document.getElementById(imageId).src = src;
}

// 画像の回転状態を復元する関数
function setCardRotation(currentCardIndex) {
    const cardImagesContainer = document.querySelector('.card-area');
    const cardImages = document.querySelectorAll('.card-image-wrapper');

    cardImages.forEach(img => {
        img.classList.remove('rotated');
        const cardImage = img.querySelector('img');
        cardImage.style.transform = `rotate(0deg)`;
    });
    if (cardRotation[currentCardIndex] && cardRotation[currentCardIndex] > 0) {
        cardImagesContainer.classList.add('rotated');
        cardImages.forEach(img => {
            img.classList.add('rotated');
            const cardImage = img.querySelector('img');
            cardImage.style.transform = `rotate(${cardRotation[currentCardIndex] * 90}deg)`;
        });
    } else {
        cardImagesContainer.classList.remove('rotated');
        cardImages.forEach(img => {
            const cardImage = img.querySelector('img');
            cardImage.style.transform = `rotate(0deg)`;
        });
    }
}


// 入力内容を保存し、カウントアップする関数
function saveInputAndIncrementCount() {
    saveCurrentInput();
     //incrementCardCount();
}

// 入力内容を保存する関数
function saveCurrentInput() {
    const currentGroup = document.querySelector(`.group-section.active`);
    const inputs = currentGroup.querySelectorAll("input, textarea");
    let groupData = {};
    inputs.forEach(input => {
        groupData[input.name] = sanitizeInput(input.value);
    });
    // カードのデータがあるか確認
    if (!inputData[currentCardIndex]) {
        inputData[currentCardIndex] = {};
    }
    inputData[currentCardIndex][groups[currentGroupIndex]] = groupData;

    // let savedData = [];
    // for (const key in groupData) {
    //     if (groupData.hasOwnProperty(key) && groupData[key]) {
    //         savedData.push(`${key}: ${groupData[key]}`);
    //     }
    // }
    // // 保存データがある場合のみアラート表示
    // if (savedData.length > 0) {
    //     showAlert("グループ: " + groups[currentGroupIndex] + ", 入力値: " + savedData.join(", ") + " を保存しました。");
    // }
}
// 次の名刺/グループへ進む関数
function moveToNextCardOrGroup() {
    // 現在のグループに関わらず、名刺を進める
    if (currentCardIndex < cardData.length - 1) {
        currentCardIndex++;
        loadCardData(); // 名刺画像の更新
    } else {
        // 最後の名刺の場合はグループを進める
        if (currentGroupIndex < groups.length - 1) {
            currentGroupIndex++;
        } else {
            // 最後のグループかつ最後の名刺の場合
            showAlert("全てのグループと名刺の入力を完了しました。");
            currentGroupIndex = 0; // 最初のグループに戻る
        }
        currentCardIndex = 0; // 最初の名刺データに戻る
        loadCardData(); // 名刺画像の更新
    }
     displayCurrentGroup(); // グループを更新
}


// スキップ処理関数
function handleSkip() {
    document.getElementById("skip-overlay").classList.add("active");
     // スキップ理由のラジオボタンとテキスト入力欄の表示制御
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
    showAlert("スキップ理由: " + selectedReason +  (otherReasonText ? ' ' + otherReasonText : '' )+ " \n(スキップしました)");
    document.getElementById("skip-overlay").classList.remove("active");
    moveToNextCardOrGroup();
}


// 作業終了関数
function handleSuspend() {
    document.getElementById("confirm-overlay").classList.add("active");
}
function confirmSuspend() {
    saveCurrentInput();
     localStorage.setItem('cardInputData', JSON.stringify(inputData));
    localStorage.setItem('currentCardIndex', currentCardIndex);
    localStorage.setItem('currentGroupIndex', currentGroupIndex);
    localStorage.setItem('cardRotation', JSON.stringify(cardRotation));
    localStorage.setItem('startTime', startTime);
   document.getElementById("confirm-overlay").classList.remove("active");
    showAlert("作業を終了しました。"); // 修正箇所: 保存完了を促す文言を削除
}

function cancelSuspend() {
    document.getElementById("confirm-overlay").classList.remove("active");
}

// メインループ関数
function processCardInput() {
     if (!validateForm())
        return;
    saveInputAndIncrementCount();
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

function cancelSkip() {
    document.getElementById("skip-overlay").classList.remove("active");
}

// ダミーデータを設定して初期表示
cardData = dummyCardData;
loadCardData();
displayCurrentGroup();
resumeWork(); // 作業再開時にデータを復元
// 開始時刻を記録
setInterval(updateElapsedTime, 1000);

function updateElapsedTime() {
    const currentTime = new Date();
    const elapsedTime = currentTime - startTime;
    const seconds = Math.floor(elapsedTime / 1000) % 60;
    const minutes = Math.floor(elapsedTime / (1000 * 60)) % 60;
    const hours = Math.floor(elapsedTime / (1000 * 60 * 60));
    const formattedTime = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    document.getElementById('elapsed-time').textContent = `経過時間: ${formattedTime}`;
}

// 名刺の確定時にカウントをインクリメントする関数
function incrementCardCount() {
    let cardCount = parseInt(localStorage.getItem('cardCount') || '0', 10);
    cardCount++;
    const cardCountElement = document.getElementById('card-count');
    cardCountElement.textContent = `入力済み名刺: ${cardCount}枚`;
    localStorage.setItem('cardCount', cardCount);
}
// 次のグループを表示する関数
function nextGroup() {
    saveCurrentInput();
     if (currentGroupIndex < groups.length - 1) {
        currentGroupIndex++;
    } else {
        showAlert("全てのグループの入力をスキップしました。");
        currentGroupIndex = 0;
        currentCardIndex = 0;
         loadCardData();
    }
    displayCurrentGroup();
}

// 作業再開時のデータ復元
function resumeWork() {
    const savedData = localStorage.getItem('cardInputData');
    const savedRotation = localStorage.getItem('cardRotation');
  //  let cardCount = parseInt(localStorage.getItem('cardCount') || '0', 10);
    // const cardCountElement = document.getElementById('card-count');
    // cardCountElement.textContent = `入力済み名刺: ${cardCount}枚`;
     userEmail = localStorage.getItem('userEmail') || 'example@example.com';
    document.getElementById('user-email').textContent = `入力者アカウント名: ${userEmail}`;
    startTime =  localStorage.getItem('startTime') ? new Date(localStorage.getItem('startTime')) : new Date();
    // リロード時にカウントをリセット
     if(!savedData){
       //  localStorage.setItem('cardCount',0);
       //   cardCountElement.textContent = `入力済み名刺: 0枚`;
          startTime = new Date();
           localStorage.removeItem('startTime');
     }


    if (savedData) {
        inputData = JSON.parse(savedData);
        cardRotation = savedRotation ? JSON.parse(savedRotation) : {};
        currentCardIndex = parseInt(localStorage.getItem('currentCardIndex'));
        currentGroupIndex = parseInt(localStorage.getItem('currentGroupIndex'));
        loadCardData();
        displayCurrentGroup();
    }

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

// 入力データのサニタイズ
function sanitizeInput(input) {
    return input.replace(/[<>]/g, '');
}

$(document).ready(function () {
    // 郵便番号マスクと住所自動補完
    $('#zip').mask('999-9999', {
        completed: function () {
            fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${$('#zip').val()}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('APIエラー: ' + response.status);
                    }
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
});
// イベントリスナーの設定
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