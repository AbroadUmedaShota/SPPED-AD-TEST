document.addEventListener('DOMContentLoaded', function () {
    const tableBody = document.getElementById('table-body');
    const firstEditTimeSpan = document.getElementById('first-edit-time');
    const lastEditTimeSpan = document.getElementById('last-edit-time');
    const lastEditorSpan = document.getElementById('last-editor');
    const confirmAllCheck = document.getElementById('confirm-all-check');

    const now = new Date();
    firstEditTimeSpan.textContent = now.toLocaleString();
    lastEditTimeSpan.textContent = now.toLocaleString();
    lastEditorSpan.textContent = '編集者';

    // 元の入力データ
    const originalTableData = [
        { group: "1", label: "メールアドレス", ocr: "sample@example.com", db: "sample@example.com", input1: "handinput1@example.com", input2: "handinput2@example.com", input3: "handinput3@example.com" },
        { group: "2", label: "氏名 (姓)", ocr: "山田", db: "db山田", input1: "", input2: "", input3: "" },
        { group: "2", label: "氏名 (名)", ocr: "太郎", db: "db太郎", input1: "花子", input2: "二郎", input3: "三郎" },
        { group: "3", label: "会社名", ocr: "株式会社サンプル", db: "株式会社サンプル", input1: "株式会社サンプル", input2: "handinput2株式会社サンプル", input3: "handinput3株式会社サンプル" },
        { group: "3", label: "部署名", ocr: "開発部", db: "db開発部", input1: "開発課", input2: "開発課", input3: "開発課" },
        { group: "3", label: "役職名", ocr: "マネージャー", db: "dbマネージャー", input1: "リーダー", input2: "マネージャー", input3: "マネージャー" },
        { group: "4", label: "郵便番号", ocr: "123-4567", db: "db123-4567", input1: "123-4567", input2: "handinput2123-4567", input3: "handinput3123-4567" },
        { group: "4", label: "住所1", ocr: "東京都〇〇区", db: "東京都□□区", input1: "東京都〇〇区", input2: "東京都〇〇区", input3: "handinput3東京都〇〇区" },
        { group: "4", label: "住所2 (建物名)", ocr: "〇〇ビル101", db: "□□ビル101", input1: "〇〇ビル1F", input2: "〇〇ビル101", input3: "〇〇ビル101号" },
        { group: "5", label: "電話番号1", ocr: "03-1234-5678", db: "03-1234-5678", input1: "handinput03-1234-5678", input2: "handinput203-1234-5678", input3: "handinput303-1234-5678" },
        { group: "5", label: "電話番号2", ocr: "03-1234-5679", db: "db03-1234-5679", input1: "handinput03-1234-5679", input2: "handinput203-1234-5679", input3: "03-1234-5679" },
        { group: "5", label: "携帯番号", ocr: "090-1234-5678", db: "db090-1234-5678", input1: "090-1234-5678", input2: "090-1234-5678", input3: "handinput3090-1234-5678" },
        { group: "5", label: "FAX番号", ocr: "03-1234-5670", db: "db03-1234-5670", input1: "03-1234-5671", input2: "03-1234-5671", input3: "03-1234-5670" },
        { group: "6", label: "URL", ocr: "https://sample.com", db: "https://sample.jp", input1: "https://sample.com", input2: "handinput2https://sample.com", input3: "handinput3https://sample.com" },
        { group: "7", label: "その他(メモ等)", ocr: "備考", db: "db備考", input1: "メモ", input2: "備考", input3: "備考" },
        { group: "8", label: "フリー入力", ocr: "フリー", db: "dbフリー", input1: "free", input2: "フリー", input3: "フリー" }
    ];

    function prepareDisplayData(originalData) {
        return originalData.map(item => {
            const processedItem = { ...item };
            if (processedItem.label === "その他(メモ等)") { processedItem.db = ""; processedItem.input1 = ""; processedItem.input2 = ""; processedItem.input3 = ""; }
            if (processedItem.label === "フリー入力") { processedItem.ocr = ""; processedItem.db = ""; processedItem.input1 = ""; processedItem.input2 = ""; processedItem.input3 = ""; }
            const isEqual = (a, b) => (a !== "" && b !== "" && a === b);
            if (isEqual(processedItem.db, processedItem.ocr)) { processedItem.input1 = ""; processedItem.input2 = ""; processedItem.input3 = ""; return processedItem; }
            if (isEqual(processedItem.input1, processedItem.ocr) || isEqual(processedItem.input1, processedItem.db)) { processedItem.input2 = ""; processedItem.input3 = ""; return processedItem; }
            if (isEqual(processedItem.input2, processedItem.ocr) || isEqual(processedItem.input2, processedItem.db) || isEqual(processedItem.input2, processedItem.input1)) { processedItem.input3 = ""; return processedItem; }
            return processedItem;
        });
    }
    const tableData = prepareDisplayData(originalTableData);

    let previousGroup = null;

    function generateTable() {
        tableBody.innerHTML = '';
        previousGroup = null;

        tableData.forEach((data, index) => {
            const row = document.createElement('tr');
            row.setAttribute('data-group', data.group);

            const valuesForInitialValue = [data.ocr, data.db, data.input1, data.input2, data.input3];
            const nonEmptyValuesForInitialValue = valuesForInitialValue.filter(v => v !== null && v !== undefined && v !== "");
            let initialValueMatch = false;
            let mostFrequentValue = "";
            if (data.label === "その他(メモ等)" || data.label === "フリー入力") {
                initialValueMatch = false;
            } else {
                if (nonEmptyValuesForInitialValue.length > 0) {
                    const valueCounts = {};
                    nonEmptyValuesForInitialValue.forEach(v => { valueCounts[v] = (valueCounts[v] || 0) + 1; });
                    const sortedValues = Object.entries(valueCounts).sort(([, countA], [, countB]) => countB - countA);
                    if (sortedValues.length > 0 && sortedValues[0][1] > 1) { initialValueMatch = true; mostFrequentValue = sortedValues[0][0]; }
                    else { initialValueMatch = false; mostFrequentValue = ""; }
                } else { initialValueMatch = false; mostFrequentValue = ""; }
            }

            const originalItem = originalTableData[index];
            const originalValues = [originalItem.ocr, originalItem.db, originalItem.input1, originalItem.input2, originalItem.input3];
            const nonEmptyOriginalValues = originalValues.filter(v => v !== null && v !== undefined && v !== "");
            let autoConfirmMatch = false;
            if (data.label !== "その他(メモ等)" && data.label !== "フリー入力") {
                if (nonEmptyOriginalValues.length > 1) {
                    const originalValueCounts = {};
                    nonEmptyOriginalValues.forEach(v => { originalValueCounts[v] = (originalValueCounts[v] || 0) + 1; });
                    autoConfirmMatch = Object.values(originalValueCounts).some(count => count > 1);
                }
            }

            data.fix = mostFrequentValue;
            data.complete = mostFrequentValue;
            data.initialMatch = initialValueMatch;
            data.confirmed = autoConfirmMatch;

            if (previousGroup && data.group !== previousGroup) { row.style.borderTop = '2px solid #bbb'; }
            previousGroup = data.group;

            let completeClass = data.initialMatch ? " matched-complete" : "";
            let rowClass = data.initialMatch ? "" : "unmatched";
            row.className = rowClass;

            row.innerHTML = `
                <td>${data.label}</td>
                <td class="ocr-value">${data.ocr}</td>
                <td class="db-value">${data.db}</td>
                <td class="input1-value">${data.input1}</td>
                <td class="input2-value">${data.input2}</td>
                <td class="input3-value">${data.input3}</td>
                <td><input type="text" class="fix-input" data-field="${data.label}" value="${data.fix}"></td>
                <td><input type="text" class="complete-input${completeClass}" value="${data.complete}" readonly></td>
                <td><input type="checkbox" class="confirm-check" ${data.confirmed ? 'checked' : ''}></td>
            `;
            tableBody.appendChild(row);

            const cellsToHighlight = row.querySelectorAll('.ocr-value, .db-value, .input1-value, .input2-value, .input3-value');
            const cellValues = Array.from(cellsToHighlight).map(cell => cell.textContent);
            cellsToHighlight.forEach((cell, i) => {
                const currentValue = cell.textContent;
                if (currentValue !== "") {
                    const matchExists = cellValues.some((otherValue, otherIndex) => i !== otherIndex && otherValue === currentValue);
                    if (matchExists) { cell.classList.add('value-matched'); }
                }
            });

            if (data.confirmed) {
                 const fixInput = row.querySelector('.fix-input');
                 if (fixInput) fixInput.readOnly = true;
            }
        });

        initializeMatchStatus();
        updateHeaderCheckboxState();
    }

    function updateLastEditTime() {
        lastEditTimeSpan.textContent = new Date().toLocaleString();
    }

    function updateRowConfirmationState(row, isChecked) {
        const fixInput = row.querySelector('.fix-input');
        const checkbox = row.querySelector('.confirm-check');

        const rowIndex = Array.from(tableBody.children).indexOf(row);
        if (rowIndex !== -1 && tableData[rowIndex]) {
             tableData[rowIndex].confirmed = isChecked;
        }

        if (checkbox && checkbox.checked !== isChecked) { checkbox.checked = isChecked; }

        if(fixInput) fixInput.readOnly = isChecked;

        updateMatchStatusForRow(row);
    }

    function updateHeaderCheckboxState() {
        const allCheckboxes = Array.from(tableBody.querySelectorAll('.confirm-check'));
        const totalCount = allCheckboxes.length;
        if (totalCount === 0) {
            confirmAllCheck.checked = false;
            confirmAllCheck.indeterminate = false;
            return;
        }
        const checkedCount = allCheckboxes.filter(cb => cb.checked).length;

        if (checkedCount === 0) {
            confirmAllCheck.checked = false;
            confirmAllCheck.indeterminate = false;
        } else if (checkedCount === totalCount) {
            confirmAllCheck.checked = true;
            confirmAllCheck.indeterminate = false;
        } else {
            confirmAllCheck.checked = false;
            confirmAllCheck.indeterminate = true;
        }
    }

    tableBody.addEventListener('input', function(event) {
        if (event.target.classList.contains('fix-input')) {
            const fixInput = event.target;
            const row = fixInput.closest('tr');
            const completeInput = row.querySelector('.complete-input');
            if (completeInput) { completeInput.value = fixInput.value; }
            updateLastEditTime();
            updateMatchStatusForRow(row);
        }
    });

    tableBody.addEventListener('change', function(event) {
        if (event.target.classList.contains('confirm-check')) {
            const checkbox = event.target;
            const row = checkbox.closest('tr');
            updateRowConfirmationState(row, checkbox.checked);
            updateHeaderCheckboxState();
            updateLastEditTime();
        }
    });

    confirmAllCheck.addEventListener('change', function() {
        const isChecked = this.checked;
        const allCheckboxes = Array.from(tableBody.querySelectorAll('.confirm-check'));

        allCheckboxes.forEach(checkbox => {
            const row = checkbox.closest('tr');
            if (!row) return;
            updateRowConfirmationState(row, isChecked);
        });

        this.indeterminate = false;
        updateHeaderCheckboxState();
        updateLastEditTime();
    });

    function checkMatchForRow(row) {
        const rowIndex = Array.from(tableBody.children).indexOf(row);
        if (rowIndex !== -1) {
            const data = tableData[rowIndex];
            if (data.label === "その他(メモ等)" || data.label === "フリー入力") { return false; }
        }
        const ocrValue = row.querySelector('.ocr-value')?.textContent || '';
        const dbValue = row.querySelector('.db-value')?.textContent || '';
        const input1Value = row.querySelector('.input1-value')?.textContent || '';
        const input2Value = row.querySelector('.input2-value')?.textContent || '';
        const input3Value = row.querySelector('.input3-value')?.textContent || '';
        const fixInputValue = row.querySelector('.fix-input')?.value || '';
        if (fixInputValue !== "" && [ocrValue, dbValue, input1Value, input2Value, input3Value].filter(v => v !== "").includes(fixInputValue)) { return true; }
        const inputs = [input1Value, input2Value, input3Value].filter(v => v !== "");
        if (inputs.length >= 2) {
             const inputCounts = {};
             inputs.forEach(v => { inputCounts[v] = (inputCounts[v] || 0) + 1; });
             if (Object.values(inputCounts).some(count => count >= 2)) { return true; }
        }
        if (rowIndex !== -1 && originalTableData[rowIndex]) {
            const originalItem = originalTableData[rowIndex];
            if (originalItem.label === "その他(メモ等)" || originalItem.label === "フリー入力") { return false; }
            const originalValues = [originalItem.ocr, originalItem.db, originalItem.input1, originalItem.input2, originalItem.input3];
            const nonEmptyOriginalValues = originalValues.filter(v => v !== null && v !== undefined && v !== "");
            if (nonEmptyOriginalValues.length > 1) {
                const originalValueCounts = {};
                nonEmptyOriginalValues.forEach(v => { originalValueCounts[v] = (originalValueCounts[v] || 0) + 1; });
                if (Object.values(originalValueCounts).some(count => count > 1)) { return true; }
            }
        }
        return false;
    }

    function updateMatchStatusForRow(row) {
        const completeInput = row.querySelector('.complete-input');
        const rowIndex = Array.from(tableBody.children).indexOf(row);
        if (rowIndex === -1) return;

        const data = tableData[rowIndex];
        if (data.label === "その他(メモ等)" || data.label === "フリー入力") {
            completeInput?.classList.remove('matched-complete');
            row.classList.remove('unmatched');
            return;
        }

        const isMatched = checkMatchForRow(row);
        if (isMatched) {
            completeInput?.classList.add('matched-complete');
            row.classList.remove('unmatched');
        } else {
            completeInput?.classList.remove('matched-complete');
            row.classList.add('unmatched');
        }
    }

    function initializeMatchStatus() {
        const rows = tableBody.querySelectorAll('tr');
        rows.forEach(row => { updateMatchStatusForRow(row); });
    }

    function rotateImage(targetImage, direction) {
        const currentRotation = parseInt(targetImage.dataset.rotation || '0', 10);
        let newRotation;
        if (direction === 'cw') { newRotation = (currentRotation + 90) % 360; }
        else if (direction === 'ccw') { newRotation = (currentRotation - 90 + 360) % 360; }
        else { return; }
        targetImage.dataset.rotation = newRotation;
        applyCombinedTransform(targetImage);
    }
    const imageDisplayArea = document.querySelector('.image-display-area');
    imageDisplayArea.addEventListener('click', function(event) {
        if (event.target.classList.contains('rotate-button')) {
            const button = event.target;
            const targetId = button.dataset.target;
            const direction = button.dataset.direction;
            const targetImage = imageDisplayArea.querySelector(`.card-image.${targetId}`);
            if (targetImage) { rotateImage(targetImage, direction); }
        }
    });

    // --- マウス追従ズーム処理 ---
    function applyCombinedTransform(imageElement) {
        const rotation = parseInt(imageElement.dataset.rotation || '0', 10);
        const isZoomed = imageElement.classList.contains('js-zoomed');
        let transformValue = '';
        if (isZoomed) {
            transformValue += 'scale(1.6) '; // 拡大率
        }
        if (rotation !== 0) {
            transformValue += `rotate(${rotation}deg)`; // 回転
        }
        imageElement.style.transform = transformValue.trim();
        // transform-origin は mousemove で設定
    }

    const cardImageWrappers = document.querySelectorAll('.card-image-wrapper'); // ラッパー要素を取得
    cardImageWrappers.forEach(wrapper => {
        const img = wrapper.querySelector('.card-image'); // ラッパー内の画像を取得
        if (!img) return; // 画像がない場合はスキップ

        let isHovering = false;

        wrapper.addEventListener('mouseenter', (e) => {
            isHovering = true;
            img.classList.add('js-zoomed');
            img.style.zIndex = '20';

            const rect = wrapper.getBoundingClientRect();
            const x = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100)); // 0-100%に制限
            const y = Math.max(0, Math.min(100, (e.clientY - rect.top) / rect.height * 100)); // 0-100%に制限
            img.style.transformOrigin = `${x}% ${y}%`;

            applyCombinedTransform(img);
        });

        wrapper.addEventListener('mousemove', (e) => {
            if (!isHovering) return;

            const rect = wrapper.getBoundingClientRect();
             const x = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100));
             const y = Math.max(0, Math.min(100, (e.clientY - rect.top) / rect.height * 100));

            // requestAnimationFrame を使うとよりスムーズになる場合がある (オプション)
            // window.requestAnimationFrame(() => {
                 img.style.transformOrigin = `${x}% ${y}%`;
            // });
        });

        wrapper.addEventListener('mouseleave', () => {
            if (!isHovering) return;
            isHovering = false;
            img.classList.remove('js-zoomed');
            img.style.zIndex = '';
            img.style.transformOrigin = ''; // デフォルトに戻す

            applyCombinedTransform(img); // 縮小（回転のみ適用）
        });
    });
    // --- マウス追従ズームここまで ---


    const modalOverlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const closeModalButton = document.getElementById('close-modal-button');
    function showModal(title, message) { modalTitle.textContent = title; modalMessage.textContent = message; modalOverlay.classList.add('active'); }
    function closeModal() { modalOverlay.classList.remove('active'); }
    function handleButtonClick(title, message){ showModal(title, message); }
    document.getElementById('save-button').addEventListener('click', function () { handleButtonClick('保存確認','保存を実行します。よろしいですか？'); });
    document.getElementById('escalate-button').addEventListener('click', function () { handleButtonClick('エスカレーション確認','エスカレーションを実行します。よろしいですか？'); });
    document.getElementById('cancel-button').addEventListener('click', function () { handleButtonClick('キャンセル確認','入力をキャンセルします。よろしいですか？'); });
    closeModalButton.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', function (e) { if (e.target === modalOverlay) { closeModal(); } });

    generateTable();

}); // DOMContentLoaded end