document.addEventListener('DOMContentLoaded', () => {
    // Manually initialize Materialize components
    const tooltips = document.querySelectorAll('.tooltipped');
    M.Tooltip.init(tooltips);
    const modals = document.querySelectorAll('.modal:not(#suggestions-modal):not(#skip-modal)');
    M.Modal.init(modals);

    // Manually set width for the user profile modal to override Materialize default
    const userProfileModal = document.getElementById('user-profile-modal');
    if (userProfileModal) {
        userProfileModal.style.width = '560px';
    }



    // --- DOM Element Selection ---
    const mainImage = document.getElementById('main-image');
    const thumbnailImage = document.getElementById('thumbnail-image');
    const rotateBtn = document.getElementById('rotate-btn');
    const resetBtn = document.getElementById('reset-btn');
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const toggleDarkModeButton = document.getElementById('toggle-dark-mode');
    const body = document.body;
    const elapsedTimeElement = document.getElementById('elapsed-time');
    const cardCountElement = document.getElementById('card-count');
    const avgTimeElement = document.getElementById('avg-time');
    const taskNameElement = document.getElementById('current-task-name');
    const modalTaskNameElement = document.getElementById('modal-user-task');

    // --- State Variables ---
    const groups = ["グループ1", "グループ2", "グループ3", "グループ4", "グループ5", "グループ6", "グループ7", "グループ8"];
    let currentGroupIndex = 0;
    let userEmail;
    let cardStartTime;
    let cardCount = 0;
    let sessionTotalSeconds = 0;
    let mainImageRotation = 0;
    let mainImageScale = 1;
    let isFront = true;
    const frontImageSrc = "../../sample/表.png";
    const backImageSrc = "../../sample/裏.png";

    // --- Functions ---

    function showToast(message) {
        const toastInstance = M.toast({ html: message, classes: 'rounded' });
    }

    function formatTime(totalSeconds) {
        const seconds = totalSeconds % 60;
        const minutes = Math.floor(totalSeconds / 60) % 60;
        const hours = Math.floor(totalSeconds / 3600);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function updateTaskName() {
        if (!taskNameElement) return;
        const taskNumber = String(cardCount + 1).padStart(3, '0');
        const taskName = `#${taskNumber}`;
        taskNameElement.textContent = `タスク: ${taskName}`;
        if (modalTaskNameElement) {
            modalTaskNameElement.textContent = taskName;
        }
    }

    function updateTransform() {
        if (mainImage) {
            mainImage.style.transform = `rotate(${mainImageRotation}deg) scale(${mainImageScale})`;
        }
    }

    function swapImages() {
        if (!mainImage || !thumbnailImage) return;
        const mainSrc = isFront ? frontImageSrc : backImageSrc;
        const thumbSrc = isFront ? backImageSrc : frontImageSrc;
        mainImage.src = thumbSrc;
        mainImage.alt = isFront ? "名刺の裏面" : "名刺の表面";
        thumbnailImage.src = mainSrc;
        thumbnailImage.alt = isFront ? "名刺の表面サムネイル" : "名刺の裏面サムネイル";
        isFront = !isFront;
    }

    function displayCurrentGroup() {
        document.querySelectorAll('.group-section').forEach((section, index) => {
            section.classList.toggle('active', index === currentGroupIndex);
        });
        const firstInput = document.querySelector('.group-section.active input:not([type="hidden"]), .group-section.active textarea');
        if (firstInput) firstInput.focus();

        if (window.updateSnippetButtonsForGroup) {
            window.updateSnippetButtonsForGroup(groups[currentGroupIndex]);
        }
    }

    function startNewCard() {
        document.querySelectorAll('input, textarea').forEach(el => el.value = '');
        M.updateTextFields();

        currentGroupIndex = 0;
        cardStartTime = new Date();
        elapsedTimeElement.classList.remove('time-warning');
        updateTaskName(); // Update task name for the new card
        displayCurrentGroup();
    }

    function moveToNextCardOrGroup() {
        if (currentGroupIndex < groups.length - 1) {
            currentGroupIndex++;
            displayCurrentGroup();
        } else {
            const cardElapsedTimeSeconds = Math.floor((new Date() - cardStartTime) / 1000);
            sessionTotalSeconds += cardElapsedTimeSeconds;
            cardCount++;
            const avgTime = sessionTotalSeconds / cardCount;

            cardCountElement.textContent = `処理枚数: ${cardCount}`;
            avgTimeElement.textContent = `平均時間: ${avgTime.toFixed(1)}s`;

            showToast(`カード完了 (処理時間: ${cardElapsedTimeSeconds.toFixed(1)}s)`);
            startNewCard();
        }
    }

    function updateElapsedTime() {
        if (!cardStartTime) return;
        const totalSeconds = Math.floor((new Date() - cardStartTime) / 1000);
        elapsedTimeElement.textContent = `経過時間: ${formatTime(totalSeconds)}`;

        const WARNING_THRESHOLD_SECONDS = 15;
        if (totalSeconds > WARNING_THRESHOLD_SECONDS) {
            elapsedTimeElement.classList.add('time-warning');
        } else {
            elapsedTimeElement.classList.remove('time-warning');
        }
    }

    function loadUser() {
        userEmail = localStorage.getItem('userEmail') || 'example@example.com';
        document.getElementById('user-email').textContent = `入力者: ${userEmail}`;
        document.getElementById('modal-user-email').textContent = userEmail;
    }

    function validateForm() {
        const email = document.getElementById('email').value;
        if (email && !/^[\s\S]+@[\s\S]+\.[\s\S]+$/.test(email)) {
            showToast('有効なメールアドレスを入力してください');
            return false;
        }
        return true;
    }

    function processCardInput() {
        if (!validateForm()) return;
        moveToNextCardOrGroup();
    }

    // --- Event Listeners ---
    thumbnailImage.addEventListener('click', swapImages);
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 'q') {
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
            e.preventDefault();
            swapImages();
        }
    });

    rotateBtn.addEventListener('click', () => {
        mainImageRotation += 90;
        updateTransform();
    });

    resetBtn.addEventListener('click', () => {
        mainImageRotation = 0;
        mainImageScale = 1;
        zoomSlider.value = 1;
        updateTransform();
    });

    zoomSlider.addEventListener('input', () => {
        mainImageScale = zoomSlider.value;
        updateTransform();
    });

    zoomOutBtn.addEventListener('click', () => {
        zoomSlider.stepDown();
        mainImageScale = zoomSlider.value;
        updateTransform();
    });

    zoomInBtn.addEventListener('click', () => {
        zoomSlider.stepUp();
        mainImageScale = zoomSlider.value;
        updateTransform();
    });

    mainImage.addEventListener('wheel', (e) => {
        e.preventDefault();
        const scaleAmount = e.deltaY < 0 ? 0.1 : -0.1;
        mainImageScale = Math.max(parseFloat(zoomSlider.min), Math.min(parseFloat(zoomSlider.max), parseFloat(mainImageScale) + scaleAmount));
        zoomSlider.value = mainImageScale;
        updateTransform();
    });

    toggleDarkModeButton.addEventListener('click', (e) => {
        e.preventDefault();
        body.classList.toggle('dark-mode');
    });

    document.getElementById('confirm-button').addEventListener('click', processCardInput);
    document.addEventListener('keydown', (e) => {
        if (event.ctrlKey && event.key === 'Enter') {
            e.preventDefault();
            processCardInput();
        }
    });

    // Modal-related event listeners

    // --- New, Robust Skip Modal Initialization ---
    const skipModalEl = document.getElementById('skip-modal');
    const skipModalInstance = M.Modal.init(skipModalEl, { // This defines the instance for the skip modal
        onOpenEnd: () => {
            const skipReasonRadios = skipModalEl.querySelectorAll('input[name="skip_reason_group"]');
            const sharedInput = skipModalEl.querySelector('#shared-reason-input');

            const handleChange = () => {
                const selectedValue = skipModalEl.querySelector('input[name="skip_reason_group"]:checked')?.value;
                const sharedInput = skipModalEl.querySelector('#shared-reason-input');
                const shouldBeDisabled = !(selectedValue === 'escalation' || selectedValue === 'other');

                if (shouldBeDisabled) {
                    sharedInput.setAttribute('disabled', 'disabled');
                } else {
                    sharedInput.removeAttribute('disabled');
                }
                
                // Also re-trigger materialize label handling
                M.updateTextFields();

                if (!shouldBeDisabled) {
                    sharedInput.focus();
                }
            };

            skipReasonRadios.forEach(radio => {
                radio.addEventListener('change', handleChange);
            });
            
            handleChange(); // Run once on open to set initial state
        }
    });

    // Get instance for the suspend modal, which was initialized generically
    const suspendModalInstance = M.Modal.getInstance(document.getElementById('suspend-modal'));

    // New listener for the confirm button, separate from the initialization
    document.getElementById('confirm-skip-btn').addEventListener('click', () => {
        const checkedRadio = document.querySelector('input[name="skip_reason_group"]:checked');
        if (!checkedRadio) {
            showToast('スキップ理由を選択してください。');
            return;
        }
        const selectedValue = checkedRadio.value;
        let reasonText = checkedRadio.nextElementSibling.textContent;
        if (selectedValue === 'escalation' || selectedValue === 'other') {
            const detailReason = document.getElementById('shared-reason-input').value;
            if (detailReason) {
                reasonText += `: ${detailReason}`;
            }
        }
        showToast(`スキップしました (理由: ${reasonText})`);
        skipModalInstance.close(); // This uses the instance defined above
        startNewCard();
    });

    // --- Suspend Modal Logic (unchanged) ---
    document.getElementById('confirm-suspend-button').addEventListener('click', () => {
        showToast('作業を終了しました。');
        suspendModalInstance.close(); // This now has its instance variable
        // Optionally, redirect or clear session here
    });

    // --- Initial Execution ---
    loadUser();
    startNewCard();
    setInterval(updateElapsedTime, 1000);

    // Zip-code auto-fill (using jQuery)
    if (window.jQuery) {
        // Apply the mask for formatting

        const searchAddressByZip = () => {
            const zip = $('#zip').val();
            if (!zip) {
                showToast('郵便番号を入力してください');
                return;
            }
            
            fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zip}`)
                .then(response => {
                    if (!response.ok) throw new Error('Network response was not ok');
                    return response.json();
                })
                .then(data => {
                    if (data.status === 200 && data.results) {
                        const res = data.results[0];
                        const fullAddress = (res.address1 || '') + (res.address2 || '') + (res.address3 || '');
                        $('#address1').val(fullAddress);
                        M.updateTextFields(); // Update labels
                        showToast('住所を自動入力しました');
                    } else {
                        showToast(`住所が見つかりませんでした (エラー: ${data.message})`);
                    }
                })
                .catch(err => {
                    console.error('Zip code fetch error:', err);
                    showToast('住所の検索中にエラーが発生しました');
                });
        };

        document.getElementById('zip-search-btn').addEventListener('click', searchAddressByZip);
    }
});