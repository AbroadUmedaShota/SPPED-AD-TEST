// --- Global Utility Functions for Scroll Lock ---
let scrollPosition = 0; // Stores scroll position for `lockScroll`/`unlockScroll`
let activeUIsCount = 0; // Tracks number of active UI overlays (modals, mobile sidebar)

export const DASHBOARD_DATA_ROOT = '/data/dashboard';

export function resolveDashboardDataPath(relativePath) {
    const sanitized = relativePath.replace(/^\/+/, '');
    return `${DASHBOARD_DATA_ROOT}/${sanitized}`;
}

/**
 * Prevents scrolling on the body element.
 * Captures current scroll position and applies fixed positioning.
 */
export function lockScroll() {
    if (activeUIsCount === 0) { // Lock scroll only when the first UI element opens
        scrollPosition = window.scrollY;
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollPosition}px`;
        document.body.style.width = '100%';
    }
    activeUIsCount++;
}

/**
 * Restores scrolling on the body element.
 * Reverts fixed positioning and restores scroll position.
 */
export function unlockScroll() {
    activeUIsCount--;
    if (activeUIsCount <= 0) { // Unlock scroll only when all UI elements are closed
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('position');
        document.body.style.removeProperty('top');
        document.body.style.removeProperty('width');
        window.scrollTo(0, scrollPosition);
        activeUIsCount = 0; // Reset to 0 to prevent negative values
    }
}

/**
 * Shows a non-blocking toast notification to the user.
 * @param {string} message The message to display.
 * @param {'success' | 'error' | 'info'} type The type of toast (for styling).
 * @param {number} duration How long the toast should be visible in milliseconds.
 */
export function showToast(message, type = 'info', duration = 3000) {
    let toast = document.getElementById('toastNotification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toastNotification';
        toast.className = 'toast-notification';
        document.body.appendChild(toast);
    }

    let iconClass = '';
    let bgColorClass = '';
    switch (type) {
        case 'success':
            iconClass = 'check_circle';
            bgColorClass = 'bg-green-500';
            break;
        case 'error':
            iconClass = 'error';
            bgColorClass = 'bg-red-500';
            break;
        case 'info':
        default:
            iconClass = 'info';
            bgColorClass = 'bg-blue-500';
            break;
    }

    toast.innerHTML = `${message}`;
    toast.className = `toast-notification show ${bgColorClass} text-white`;

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.className = 'toast-notification'; // Reset classes after transition
        }, 300); // Match CSS transition duration
    }, duration);
}

/**
 * Copies a given string to the clipboard.
 * @param {string} text The string to be copied.
 */
export async function copyTextToClipboard(text) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            showToast("URLがクリップボードにコピーされました！", "success");
        } catch (err) {
            console.error('URLコピーに失敗しました:', err);
            showToast("URLのコピーに失敗しました。", "error");
        }
    } else { // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.top = "-9999px";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showToast("URLがクリップボードにコピーされました！", "success");
        } catch (err) {
            console.error('URLコピーに失敗しました:', err);
            showToast("URLのコピーに失敗しました。", "error");
        }
        document.body.removeChild(textArea);
    }
}

/**
 * Downloads a file from a given URL.
 * @param {string} url The URL of the file to download.
 * @param {string} filename The desired filename for the downloaded file.
 */
export function downloadFile(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Loads HTML content from a specified file and inserts it into a placeholder element.
 * @param {string} placeholderId The ID of the HTML element to insert the content into.
 * @param {string} filePath The path to the HTML file to load.
 */
function resolveCommonBasePath() {
    if (Object.prototype.hasOwnProperty.call(window, '__COMMON_BASE_PATH')) {
        return typeof window.__COMMON_BASE_PATH === 'string' ? window.__COMMON_BASE_PATH : '';
    }

    const marker = '/02_dashboard/';
    const pathname = window.location.pathname;
    const markerIndex = pathname.lastIndexOf(marker);
    if (markerIndex === -1) {
        return '';
    }

    const subPath = pathname.slice(markerIndex + marker.length);
    const segments = subPath.split('/').filter(Boolean);
    if (segments.length <= 1) {
        return '';
    }

    const depth = segments.length - 1;
    return '../'.repeat(depth);
}
export async function loadCommonHtml(placeholderId, filePath, callback = null) {
    const basePath = resolveCommonBasePath();
    const resolvedPath = filePath.startsWith('/') ? filePath : `${basePath}${filePath}`;

    try {
        const response = await fetch(resolvedPath);
        if (!response.ok) {
            throw new Error(`Failed to load ${resolvedPath}: ${response.statusText}`);
        }
        const html = await response.text();
        const placeholder = document.getElementById(placeholderId);
        if (placeholder) {
            // Create a parser to manipulate the fetched HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Determine the correct base path for assets
            const isSamplePage = window.location.pathname.includes('/sample/');
            const assetBasePath = isSamplePage ? '../../02_dashboard/' : ''; // Use empty string for root pages

            // Select elements with src or href attributes that might need rewriting
            const elementsToFix = doc.querySelectorAll('img[src], link[href], a[href]');

            elementsToFix.forEach(el => {
                const attribute = el.hasAttribute('src') ? 'src' : 'href';
                const originalPath = el.getAttribute(attribute);

                // Check if it's a relative path that needs correction and not an anchor link
                if (originalPath && !originalPath.startsWith('http') && !originalPath.startsWith('/') && !originalPath.startsWith('#')) {
                    // Avoid rewriting the path if it already seems correct (for cases where logic might run twice)
                    if (!originalPath.startsWith(assetBasePath)) {
                         el.setAttribute(attribute, `${assetBasePath}${originalPath}`);
                    }
                }
            });

            // Use the modified HTML from the body of the parsed document
            placeholder.innerHTML = doc.body.innerHTML;

            if (callback && typeof callback === 'function') {
                callback();
            }
        }
    } catch (error) {
        console.error(`Error loading common HTML from ${filePath}:`, error);
    }
}

/**
 * Inserts text at the current cursor position in a textarea.
 * @param {HTMLTextAreaElement} textarea The target textarea element.
 * @param {string} text The text to insert.
 */
export function insertTextAtCursor(textarea, text) {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = textarea.value.substring(0, start) + text + textarea.value.substring(end);
    textarea.value = newText;
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
}

/**
 * Shows a loading overlay.
 * @param {string} overlayId The ID of the loading overlay element.
 */
export function showLoading(overlayId) {
    const overlay = document.getElementById(overlayId);
    if (overlay) {
        overlay.classList.remove('hidden');
    }
}

/**
 * Hides a loading overlay.
 * @param {string} overlayId The ID of the loading overlay element.
 */
export function hideLoading(overlayId) {
    const overlay = document.getElementById(overlayId);
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

/**
 * Shows a message in an overlay.
 * @param {string} overlayId The ID of the message overlay element.
 * @param {string} message The message to display.
 */
export function showMessage(overlayId, message) {
    const overlay = document.getElementById(overlayId);
    if (overlay) {
        const messageElement = overlay.querySelector('p');
        if (messageElement) {
            messageElement.textContent = message;
        }
        overlay.classList.remove('hidden');
    }
}


