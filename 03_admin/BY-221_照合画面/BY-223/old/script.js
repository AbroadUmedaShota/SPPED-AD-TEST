document.addEventListener('DOMContentLoaded', function () {
    const tableBody = document.getElementById('table-body');
    const now = new Date();
    document.getElementById('first-edit-time').textContent = now.toLocaleString();
    document.getElementById('last-edit-time').textContent = now.toLocaleString();
    document.getElementById('last-editor').textContent = '編集者'
    // テーブルデータ定義
    const tableData = [
        {
            group: "1",
            label: "メールアドレス",
            ocr: "sample@example.com",
            db: "db@example.com",
            input1: "handinput1@example.com",
            input2: "handinput2@example.com",
            input3: "handinput3@example.com",
            fix: "sample@example.com",
            complete: "sample@example.com",
            matched: false,
            inputMatched: false
        },
        {
            group: "2",
            label: "氏名 (姓)",
            ocr: "山田",
            db: "db山田",
            input1: "handinput山田",
            input2: "handinput2山田",
            input3: "handinput3山田",
            fix: "山田",
            complete: "山田",
            matched: false,
            inputMatched: false
        },
        {
            group: "2",
            label: "氏名 (名)",
            ocr: "太郎",
            db: "db太郎",
            input1: "handinput太郎",
            input2: "handinput2太郎",
            input3: "handinput3太郎",
            fix: "太郎",
            complete: "太郎",
            matched: false,
            inputMatched: false
        },
        {
            group: "3",
            label: "会社名",
            ocr: "株式会社サンプル",
            db: "db株式会社サンプル",
            input1: "handinput株式会社サンプル",
            input2: "handinput2株式会社サンプル",
            input3: "handinput3株式会社サンプル",
            fix: "株式会社サンプル",
            complete: "株式会社サンプル",
            matched: false,
            inputMatched: false
        },
        {
            group: "3",
            label: "部署名",
            ocr: "開発部",
            db: "db開発部",
            input1: "handinput開発部",
            input2: "handinput2開発部",
            input3: "handinput3開発部",
            fix: "開発部",
            complete: "開発部",
            matched: false,
            inputMatched: false
        },
        {
            group: "3",
            label: "役職名",
            ocr: "マネージャー",
            db: "dbマネージャー",
            input1: "handinputマネージャー",
            input2: "handinputマネージャー",
            input3: "handinput3マネージャー",
            fix: "マネージャー",
            complete: "マネージャー",
            matched: true,
            inputMatched: true
        },
        {
            group: "4",
            label: "郵便番号",
            ocr: "123-4567",
            db: "db123-4567",
            input1: "handinput123-4567",
            input2: "handinput2123-4567",
            input3: "handinput3123-4567",
            fix: "123-4567",
            complete: "123-4567",
            matched: false,
            inputMatched: false
        },
        {
            group: "4",
            label: "住所1",
            ocr: "東京都〇〇区",
            db: "db東京都〇〇区",
            input1: "handinput東京都〇〇区",
            input2: "handinput2東京都〇〇区",
            input3: "handinput3東京都〇〇区",
            fix: "東京都〇〇区",
            complete: "東京都〇〇区",
            matched: false,
            inputMatched: false
        },
        {
            group: "4",
            label: "住所2 (建物名)",
            ocr: "〇〇ビル101",
            db: "db〇〇ビル101",
            input1: "handinput〇〇ビル101",
            input2: "handinput2〇〇ビル101",
            input3: "handinput3〇〇ビル101",
            fix: "〇〇ビル101",
            complete: "〇〇ビル101",
            matched: false,
            inputMatched: false
        },
        {
            group: "5",
            label: "電話番号1",
            ocr: "03-1234-5678",
            db: "db03-1234-5678",
            input1: "handinput03-1234-5678",
            input2: "handinput203-1234-5678",
            input3: "handinput303-1234-5678",
            fix: "03-1234-5678",
            complete: "03-1234-5678",
            matched: false,
            inputMatched: false
        },
        {
            group: "5",
            label: "電話番号2",
            ocr: "03-1234-5679",
            db: "db03-1234-5679",
            input1: "handinput03-1234-5679",
            input2: "handinput203-1234-5679",
            input3: "handinput303-1234-5679",
            fix: "03-1234-5679",
            complete: "03-1234-5679",
            matched: false,
            inputMatched: false
        },
        {
            group: "5",
            label: "携帯番号",
            ocr: "090-1234-5678",
            db: "db090-1234-5678",
            input1: "handinput090-1234-5678",
            input2: "handinput2090-1234-5678",
            input3: "handinput3090-1234-5678",
            fix: "090-1234-5678",
            complete: "090-1234-5678",
            matched: false,
            inputMatched: false
        },
        {
            group: "5",
            label: "FAX番号",
            ocr: "03-1234-5670",
            db: "db03-1234-5670",
            input1: "handinput03-1234-5670",
            input2: "handinput203-1234-5670",
            input3: "handinput303-1234-5670",
            fix: "03-1234-5670",
            complete: "03-1234-5670",
            matched: false,
            inputMatched: false
        },
        {
            group: "6",
            label: "URL",
            ocr: "https://sample.com",
            db: "dbhttps://sample.com",
            input1: "handinputhttps://sample.com",
            input2: "handinput2https://sample.com",
            input3: "handinput3https://sample.com",
            fix: "https://sample.com",
            complete: "https://sample.com",
            matched: false,
            inputMatched: false
        },
        {
            group: "7",
            label: "その他(メモ等)",
            ocr: "備考",
            db: "db備考",
            input1: "handinput備考",
            input2: "handinput2備考",
            input3: "handinput3備考",
            fix: "備考",
            complete: "備考",
            matched: false,
            inputMatched: false
        },
        {
            group: "8",
            label: "フリー入力",
            ocr: "フリー",
            db: "dbフリー",
            input1: "handinputフリー",
            input2: "handinput2フリー",
            input3: "handinput3フリー",
            fix: "フリー",
            complete: "フリー",
            matched: false,
            inputMatched: false
        }
    ];
    // テーブルのボディ要素を取得
    tableData.forEach(data => {
        const row = document.createElement('tr');
        row.setAttribute('data-group', data.group);
        let completeClass = "";
        if (data.matched) {
            completeClass = " matched-complete";
        }
        row.innerHTML = `
                  <td>${data.label}</td>
                  <td class="ocr-value">${data.ocr}</td>
                  <td class="db-value">${data.db}</td>
                   <td class="input1-value">${data.input1}</td>
                   <td class="input2-value">${data.input2}</td>
                     <td class="input3-value">${data.input3}</td>
                  <td><input type="text" class="fix-input" data-field="${data.label}" value="${data.fix}"></td>
                  <td><input type="text" class="complete-input${completeClass}" value="${data.complete}" readonly></td>
                `;
        tableBody.appendChild(row);
    });
    const fixInputs = document.querySelectorAll('.fix-input');
    // 修正入力と完成内容の連動
    fixInputs.forEach(fixInput => {
        fixInput.addEventListener('input', function () {
            const completeInput = this.closest('tr').querySelector('.complete-input');
            if (completeInput) {
                completeInput.value = this.value;
            }
            // 編集時に最終編集時間を更新
            document.getElementById('last-edit-time').textContent = new Date().toLocaleString();
            updateMatchStatus();
        });
    });
    // マッチング判定を関数化
    function checkMatch(fixValue, ocrValue, dbValue, input1Value, input2Value, input3Value) {
      if(fixValue === ocrValue || fixValue === dbValue || fixValue === input1Value || fixValue === input2Value || fixValue === input3Value){
         return true;
      }
      return checkInputMatch(input1Value, input2Value, input3Value)
    }
    function checkInputMatch(input1Value, input2Value, input3Value){
      return input1Value === input2Value || input1Value === input3Value || input2Value === input3Value;
    }
    function updateMatchStatus() {
        const rows = document.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const ocrValue = row.querySelector('.ocr-value')?.textContent || '';
            const dbValue = row.querySelector('.db-value')?.textContent || '';
            const input1Value = row.querySelector('.input1-value')?.textContent || '';
            const input2Value = row.querySelector('.input2-value')?.textContent || '';
            const input3Value = row.querySelector('.input3-value')?.textContent || '';
            const fixInput = row.querySelector('.fix-input');
            const fixInputValue = fixInput?.value || '';
            const completeInput = row.querySelector('.complete-input');
            completeInput?.classList.remove('matched-complete');
            row.classList.remove('unmatched');
            let isMatched = checkMatch(fixInputValue, ocrValue, dbValue, input1Value, input2Value, input3Value)

            if (isMatched) {
                completeInput?.classList.add('matched-complete');
            } else {
                row.classList.add('unmatched');
                completeInput?.classList.remove('matched-complete');
            }
        });
    }
    updateMatchStatus();
    // モーダル関連の処理
    const modalOverlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const closeModalButton = document.getElementById('close-modal-button');

    function showModal(title, message) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalOverlay.classList.add('active');
        modalContent.focus();
    }
    function closeModal() {
        modalOverlay.classList.remove('active');
    }
    // モーダル表示処理の共通化
    function handleButtonClick(title, message){
        showModal(title, message);
    }
    // 保存ボタンクリック時の処理
    document.getElementById('save-button').addEventListener('click', function () {
       handleButtonClick('保存確認','保存を実行します。よろしいですか？');
    });

    // エスカレーションボタンクリック時の処理
    document.getElementById('escalate-button').addEventListener('click', function () {
        handleButtonClick('エスカレーション確認','エスカレーションを実行します。よろしいですか？');
    });

    // キャンセルボタンクリック時の処理
    document.getElementById('cancel-button').addEventListener('click', function () {
        handleButtonClick('キャンセル確認','入力をキャンセルします。よろしいですか？');
    });
    // モーダルを閉じる処理
     closeModalButton.addEventListener('click', closeModal);
     modalOverlay.addEventListener('click', function (e) {
         if (e.target === modalOverlay) {
              closeModal();
          }
      });
});