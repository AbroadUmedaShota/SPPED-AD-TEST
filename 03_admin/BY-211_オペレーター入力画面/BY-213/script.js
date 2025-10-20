document.addEventListener('DOMContentLoaded', () => {
    // Materialize Components Initialization
    M.AutoInit();
    const skipModalInstance = M.Modal.getInstance(document.getElementById('skip-modal'));
    const suspendModalInstance = M.Modal.getInstance(document.getElementById('suspend-modal'));

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

    // --- State Variables ---
    const groups = ["グループ1", "グループ2", "グループ3", "グループ4", "グループ5", "グループ6", "グループ7", "グループ8"];
    let currentGroupIndex = 0;
    let userEmail;
    let startTime;
    let mainImageRotation = 0;
    let mainImageScale = 1;
    let isFront = true;
    const frontImageSrc = "../../sample/表.png";
    const backImageSrc = "../../sample/裏.png";

    // --- Functions ---

    function showToast(message) {
        M.toast({ html: message });
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
    }

    function moveToNextCardOrGroup() {
        if (currentGroupIndex < groups.length - 1) {
            currentGroupIndex++;
        } else {
            showToast('全てのグループの入力を完了しました。');
            currentGroupIndex = 0;
        }
        displayCurrentGroup();
    }

    function updateElapsedTime() {
        if (!startTime) return;
        const currentTime = new Date();
        const elapsedTime = currentTime - startTime;
        const totalSeconds = Math.floor(elapsedTime / 1000);
        const seconds = totalSeconds % 60;
        const minutes = Math.floor(totalSeconds / 60) % 60;
        const hours = Math.floor(totalSeconds / 3600);
        const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        const timeElement = document.getElementById('elapsed-time');
        timeElement.textContent = `経過時間: ${formattedTime}`;

        const WARNING_THRESHOLD_SECONDS = 15;
        if (totalSeconds > WARNING_THRESHOLD_SECONDS) {
            timeElement.classList.add('time-warning');
        }
    }

    function resumeWork() {
        userEmail = localStorage.getItem('userEmail') || 'example@example.com';
        document.getElementById('user-email').textContent = `入力者: ${userEmail}`;
        startTime = localStorage.getItem('startTime') ? new Date(localStorage.getItem('startTime')) : new Date();
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
    document.getElementById('confirm-skip-button').addEventListener('click', () => {
        const selectedReason = document.querySelector('input[name="skip-reason"]:checked').value;
        let reason = selectedReason;
        if (reason === 'other') {
            reason += ': ' + document.getElementById('other-reason-text').value;
        }
        showToast(`スキップしました (理由: ${reason})`);
        skipModalInstance.close();
        moveToNextCardOrGroup();
    });

    document.getElementById('confirm-suspend-button').addEventListener('click', () => {
        showToast('作業を終了しました。');
        suspendModalInstance.close();
        // Optionally, redirect or clear session here
    });

    document.querySelector('input[name="skip-reason"][value="other"]').addEventListener('change', function() {
        document.getElementById('skip-reason-other-input').style.display = this.checked ? 'block' : 'none';
    });

    // --- Initial Execution ---
    displayCurrentGroup();
    resumeWork();
    setInterval(updateElapsedTime, 1000);

    // Zip-code auto-fill (using jQuery)
    if (window.jQuery) {
        // Apply the mask for formatting
        $('#zip').mask('000-0000');

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
