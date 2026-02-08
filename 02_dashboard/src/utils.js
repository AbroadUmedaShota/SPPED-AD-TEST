// --- Global Utility Functions for Scroll Lock ---
let scrollPosition = 0; // Stores scroll position for `lockScroll`/`unlockScroll`
let activeUIsCount = 0; // Tracks number of active UI overlays (modals, mobile sidebar)

const DEFAULT_DASHBOARD_ROOT = './';
const DEFAULT_DATA_ROOT = './data';
const DEFAULT_DEMO_ROOT = './docs/examples';

function joinRelativePath(base, relativePath) {
  const cleanedBase = base ? base.replace(/\/+$/, '') : '';
  const cleanedRelative = relativePath ? relativePath.replace(/^\/+/, '') : '';

  if (!cleanedBase && !cleanedRelative) {
    return './';
  }

  if (!cleanedBase) {
    return `./${cleanedRelative}`;
  }

  if (!cleanedRelative) {
    return cleanedBase === '.' ? './' : cleanedBase;
  }

  return `${cleanedBase}/${cleanedRelative}`;
}

function resolveDashboardBasePathFromUrl(url) {
  try {
    const targetUrl = url.hostname === 'htmlpreview.github.io' && url.search
      ? new URL(url.search.slice(1))
      : url;

    const pathname = targetUrl.pathname || '';
    const marker = '/02_dashboard/';
    const markerIndex = pathname.lastIndexOf(marker);
    const basePath = markerIndex === -1 ? '' : pathname.slice(0, markerIndex);
    const normalized = basePath.replace(/\/+$/, '');

    if (!normalized && !pathname) {
      return null;
    }

    return normalized;
  } catch (error) {
    return null;
  }
}

function resolveDashboardBasePath() {
  if (typeof window !== 'undefined' && window.location) {
    const basePath = resolveDashboardBasePathFromUrl(window.location);
    if (basePath !== null) {
      return basePath;
    }
  }

  if (typeof import.meta !== 'undefined' && import.meta.url) {
    try {
      const moduleUrl = new URL(import.meta.url);
      const basePath = resolveDashboardBasePathFromUrl(moduleUrl);
      if (basePath !== null) {
        return basePath;
      }
    } catch (error) {
      return null;
    }
  }

  return null;
}

const DASHBOARD_BASE_PATH = resolveDashboardBasePath();
const DASHBOARD_DATA_ROOT = DASHBOARD_BASE_PATH !== null ? `${DASHBOARD_BASE_PATH}/data` : null;

function getDashboardRoot() {
  if (typeof window === 'undefined' || !window.location) {
    return DEFAULT_DASHBOARD_ROOT;
  }
  const basePath = resolveCommonBasePath();
  return basePath || './';
}

function getDashboardDataRoot() {
  if (DASHBOARD_DATA_ROOT !== null) {
    return DASHBOARD_DATA_ROOT;
  }
  return DEFAULT_DATA_ROOT;
}

function getDemoDataRoot() {
  if (DASHBOARD_BASE_PATH !== null) {
    return `${DASHBOARD_BASE_PATH}/docs/examples`;
  }
  return DEFAULT_DEMO_ROOT;
}

function sanitizeRelativePath(relativePath) {
  if (!relativePath) {
    return '';
  }
  return relativePath.replace(/^\/+/, '');
}

export function resolveDashboardDataPath(relativePath) {
  const sanitized = sanitizeRelativePath(relativePath);
  const root = getDashboardDataRoot();
  return joinRelativePath(root, sanitized);
}

export function resolveDashboardAssetPath(relativePath) {
  const sanitized = sanitizeRelativePath(relativePath);
  const root = getDashboardRoot();
  return joinRelativePath(root, sanitized);
}

export function resolveDemoDataPath(relativePath) {
  const sanitized = sanitizeRelativePath(relativePath);
  const root = getDemoDataRoot();
  if (!sanitized) {
    return root;
  }

  const parts = sanitized.split('/');
  if (parts.length > 0 && parts[0]) {
    parts[0] = `demo_${parts[0]}`;
  }
  const newPath = parts.join('/');
  return joinRelativePath(root, newPath);
}

/**
 * Prevents scrolling on the body element.
 * Captures current scroll position and applies fixed positioning.
 */
export function lockScroll() {
    if (activeUIsCount === 0) { // Lock scroll only when the first UI element opens
        document.body.style.overflow = 'hidden';
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
            const assetBasePath = resolveCommonBasePath();

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
                await callback();
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
export function showMessage(overlayId, message, show = true) {
    const overlay = document.getElementById(overlayId);
    if (overlay) {
        const messageElement = overlay.querySelector('p');
        if (messageElement) {
            messageElement.textContent = message;
        }
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }
}

/**
 * Creates a debounced function that delays invoking `func` until after `wait` milliseconds have elapsed
 * since the last time the debounced function was invoked.
 * @param {Function} func The function to debounce.
 * @param {number} wait The number of milliseconds to delay.
 * @returns {Function} Returns the new debounced function.
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

