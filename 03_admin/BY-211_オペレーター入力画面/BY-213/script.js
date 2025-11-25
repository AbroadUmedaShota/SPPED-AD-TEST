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
    const mainImageArea = document.getElementById('main-image-area');
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
            mainImage.style.setProperty('--rotation', `${mainImageRotation}deg`);
            mainImage.style.setProperty('--scale', mainImageScale);
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

    function refocusCurrentInput() {
        const activeGroupInputs = document.querySelectorAll('.group-section.active input:not([type="hidden"]), .group-section.active textarea');
        let focused = false;

        // Try to find the first empty input and focus it
        for (const input of activeGroupInputs) {
            if (input.value.trim() === '') {
                input.focus();
                focused = true;
                break;
            }
        }

        // If all inputs are filled, focus on the first input of the group
        if (!focused && activeGroupInputs.length > 0) {
            activeGroupInputs[0].focus();
        }
    }

    // --- Event Listeners ---
    document.addEventListener('click', (e) => {
        // List of tags that can legitimately hold focus or are interactive
        const interactiveTags = ['INPUT', 'TEXTAREA', 'A', 'BUTTON', 'I', 'SPAN'];
        
        // If the click is on an interactive element, or inside a component that should be interactive (like a modal or tooltip), do nothing.
        if (interactiveTags.includes(e.target.tagName) || e.target.closest('.modal, .tooltipped, .btn, .btn-floating, a')) {
            return;
        }
        
        // Otherwise, refocus on the current input field
        refocusCurrentInput();
    });

    thumbnailImage.addEventListener('click', swapImages);

    mainImageArea.addEventListener('mousemove', (e) => {
        const rect = mainImage.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const xPercent = (x / rect.width) * 100;
        const yPercent = (y / rect.height) * 100;
        mainImage.style.setProperty('--x-origin', `${xPercent}%`);
        mainImage.style.setProperty('--y-origin', `${yPercent}%`);
    });

    mainImageArea.addEventListener('mouseleave', () => {
        mainImage.style.setProperty('--x-origin', '50%');
        mainImage.style.setProperty('--y-origin', '50%');
    });

    document.addEventListener('keydown', (e) => {
        // Do not trigger shortcuts if focus is on an input/textarea
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

        if (e.altKey) {
            switch (e.key.toLowerCase()) {
                case 'q':
                    e.preventDefault();
                    swapImages();
                    break;
                case 'r':
                    e.preventDefault();
                    resetBtn.click();
                    break;
                case 'arrowright':
                    e.preventDefault();
                    mainImageRotation += 90;
                    updateTransform();
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    mainImageRotation -= 90;
                    updateTransform();
                    break;
            }
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

    // --- Skip Modal Logic (View Switching Version) ---
    $(document).ready(function() {
        const $skipModal = $('#skip-modal');
        if (!$skipModal.length) return;

        // Views and Footers
        const $reasonView = $('#skip-reason-view');
        const $detailView = $('#skip-detail-view');
        const $reasonFooter = $('#skip-reason-footer');
        const $detailFooter = $('#skip-detail-footer');

        // Controls
        const $reasonRadios = $skipModal.find('input[name="skip_reason_group"]');
        const $detailTextarea = $('#skip-reason-detail-input');

        const skipModalInstance = M.Modal.init($skipModal[0], {
            onOpenStart: function() {
                // Reset to the first view every time
                $reasonView.css('display', 'block');
                $reasonFooter.css('display', 'block');
                $detailView.css('display', 'none');
                $detailFooter.css('display', 'none');

                // Reset form elements
                $reasonRadios.prop('checked', false);
                $detailTextarea.val('');
                $detailTextarea.removeClass('invalid');
                M.updateTextFields();
            }
        });

        // Function to perform the actual skip action
        function performSkip(reason, detail = '') {
            let fullReason = reason;
            if (detail) {
                fullReason += `: ${detail}`;
            }
            M.toast({ html: `スキップしました (理由: ${fullReason})` });
            skipModalInstance.close();
            if (typeof startNewCard === 'function') {
                startNewCard();
            }
        }

        // Use event delegation for robust handling
        $skipModal.on('click', '#skip-next-btn', function() {
            const $checkedRadio = $reasonRadios.filter(':checked');
            if (!$checkedRadio.length) {
                M.toast({ html: 'スキップ理由を選択してください。' });
                return;
            }

            const selectedValue = $checkedRadio.val();
            
            if (selectedValue === 'escalation' || selectedValue === 'other') {
                // Switch to detail view
                $reasonView.css('display', 'none');
                $reasonFooter.css('display', 'none');
                $detailView.css('display', 'block');
                $detailFooter.css('display', 'block');
                $detailTextarea.focus();
            } else {
                // Skip directly
                const reasonText = $checkedRadio.parent().find('span').text();
                performSkip(reasonText);
            }
        });

        $skipModal.on('click', '#skip-back-btn', function() {
            $detailView.css('display', 'none');
            $detailFooter.css('display', 'none');
            $reasonView.css('display', 'block');
            $reasonFooter.css('display', 'block');
        });

        $skipModal.on('click', '#confirm-skip-with-reason-btn', function() {
            const reasonDetail = $detailTextarea.val().trim();
            if (reasonDetail === '') {
                M.toast({ html: '詳細な理由を入力してください。' });
                $detailTextarea.addClass('invalid').focus();
                return;
            }

            const $checkedRadio = $reasonRadios.filter(':checked');
            const reasonText = $checkedRadio.length ? $checkedRadio.parent().find('span').text() : '不明';
            performSkip(reasonText, reasonDetail);
        });
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

        const toHalfWidth = (str) => {
            if (!str) return '';
            return str.replace(/[！-～]/g, (s) => {
                return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
            });
        };

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
                        const address1Input = document.getElementById('address1');
                        
                        address1Input.value = toHalfWidth(fullAddress);
                        M.updateTextFields(); // Update labels
                        showToast('住所を自動入力しました');
                        address1Input.focus(); // Focus the input for immediate editing
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