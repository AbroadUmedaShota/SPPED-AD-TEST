import { lockScroll, unlockScroll, showToast } from './utils.js';
import { fetchGroups } from './groupService.js';
import { setGroupFilter } from './tableManager.js';
import { showConfirmationModal } from './confirmationModal.js';

// --- Configuration ---

const NAV_ITEMS = [
    { id: 'survey-list', href: 'index.html', icon: 'list_alt', label: 'アンケート一覧' },
    { id: 'invoice-list', href: 'invoiceList.html', icon: 'receipt_long', label: 'ご請求内容一覧' },
    { id: 'group-management', href: 'group-edit.html', icon: 'groups', label: 'グループ管理' },
    { isDivider: true },
    { id: 'account-info', href: '#', icon: 'account_circle', label: 'アカウント情報', onClick: () => window.openAccountInfoModal(window.dummyUserData) },
    { id: 'logout', href: '#', icon: 'logout', label: 'ログアウト' }
];

const MEDIA_QUERY = window.matchMedia('(min-width: 1024px)');

// --- DOM Elements ---

let sidebar, mobileSidebarOverlay, sidebarToggleMobile, userSelect, navContainer;

/**
 * Cache all necessary DOM elements for the sidebar.
 */
function cacheDOMElements() {
    sidebar = document.getElementById('sidebar');
    mobileSidebarOverlay = document.getElementById('mobileSidebarOverlay');
    sidebarToggleMobile = document.getElementById('sidebarToggleMobile');
    userSelect = document.getElementById('user_select');
    navContainer = document.getElementById('sidebar-nav');
}

// --- UI Logic ---

/**
 * Toggles the mobile sidebar open and closed.
 */
export function toggleMobileSidebar() {
    if (!sidebar || !mobileSidebarOverlay) return;

    const isOpen = sidebar.classList.contains('is-open-mobile');
    if (isOpen) {
        sidebar.classList.remove('is-open-mobile');
        mobileSidebarOverlay.classList.remove('is-visible');
        unlockScroll();
    } else {
        sidebar.classList.add('is-open-mobile');
        mobileSidebarOverlay.classList.add('is-visible');
        lockScroll();
    }
}

/**
 * Adjusts sidebar behavior for PC (hover-to-expand).
 * @param {boolean} isPcScreen - True if the screen matches the PC media query.
 */
function handlePcSidebarBehavior(isPcScreen) {
    if (isPcScreen) {
        sidebar.onmouseenter = () => document.body.classList.add('sidebar-hovered');
        sidebar.onmouseleave = () => document.body.classList.remove('sidebar-hovered');
    } else {
        sidebar.onmouseenter = null;
        sidebar.onmouseleave = null;
        document.body.classList.remove('sidebar-hovered');
    }
}

/**
 * Handles layout adjustments based on screen size changes.
 * @param {MediaQueryListEvent} e - The media query list event.
 */
function handleScreenChange(e) {
    const isPcScreen = e.matches;
    handlePcSidebarBehavior(isPcScreen);

    if (isPcScreen && sidebar.classList.contains('is-open-mobile')) {
        toggleMobileSidebar(); // Close mobile sidebar if switching to PC view
    }
    
    const isModalOpen = document.querySelector('.modal-overlay[data-state="open"]');
    if (!isModalOpen) {
        unlockScroll();
    }
}

// --- Data & Content Population ---

/**
 * Populates the navigation links in the sidebar.
 */
function populateNav() {
    if (!navContainer) return;
    navContainer.innerHTML = ''; // Clear existing links

    const currentPageId = document.body.dataset.pageId;

    NAV_ITEMS.forEach(item => {
        if (item.isDivider) {
            navContainer.innerHTML += '<div class="border-t border-outline-variant my-2"></div>';
            return;
        }

        const link = document.createElement('a');
        link.href = item.href;
        link.className = 'flex items-center gap-3 rounded-md px-3 py-2 text-on-surface hover:bg-surface-variant hover:text-primary text-sm font-medium transition-colors';
        link.setAttribute('aria-label', item.label);
        if (item.id) {
            link.id = `${item.id}Button`; // e.g., logoutButton
        }

        if (item.id === currentPageId) {
            link.classList.add('active');
        }

        link.innerHTML = `
            <span class="material-icons text-xl">${item.icon}</span>
            <span class="sidebar-nav-label whitespace-nowrap">${item.label}</span>
        `;

        if (item.onClick) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                item.onClick();
            });
        }
        
        navContainer.appendChild(link);
    });
}

/**
 * Populates the group selection dropdown.
 */
async function populateGroupSelect() {
    if (!userSelect) return;
    userSelect.innerHTML = ''; // Clear existing options

    const defaultOption = document.createElement('option');
    defaultOption.value = 'current';
    defaultOption.textContent = 'Current Group';
    userSelect.appendChild(defaultOption);

    try {
        const groups = await fetchGroups();
        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            userSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to fetch groups for sidebar:', error);
        showToast('グループの読み込みに失敗しました。', 'error');
    }
}

// --- Event Listener Setup ---

/**
 * Attaches all necessary event listeners for sidebar functionality.
 */
function attachEventListeners() {
    if (sidebarToggleMobile) sidebarToggleMobile.addEventListener('click', toggleMobileSidebar);
    if (mobileSidebarOverlay) mobileSidebarOverlay.addEventListener('click', toggleMobileSidebar);

    // Group selection change
    if (userSelect) {
        userSelect.addEventListener('change', () => {
            const selectedGroupId = userSelect.value;
            setGroupFilter(selectedGroupId === 'current' ? null : selectedGroupId);
            showToast(`グループを切り替えました。`, 'info');
        });
    }

    // Logout button
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            showConfirmationModal(
                'ログアウトしますか？',
                () => {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = '/index.html';
                },
                'ログアウト'
            );
        });
    }
    
    // Close mobile sidebar on nav item click
    navContainer.addEventListener('click', (event) => {
        if (!MEDIA_QUERY.matches && event.target.closest('a')) {
            // Don't close for modals triggered from sidebar
            const link = event.target.closest('a');
            if (!link.onclick) {
                 toggleMobileSidebar();
            }
        }
    });

    // Listen for screen size changes
    MEDIA_QUERY.addEventListener('change', handleScreenChange);
}


// --- Initialization ---

/**
 * Initializes the entire sidebar component.
 */
export function initSidebarHandler() {
    cacheDOMElements();
    if (!sidebar) {
        console.error("Sidebar element not found. Initialization aborted.");
        return;
    }

    populateNav();
    populateGroupSelect();
    attachEventListeners();
    
    // Initial layout setup
    handleScreenChange(MEDIA_QUERY);

    // Attach any page-specific guards
    if (typeof window.attachPasswordChangeNavGuard === 'function') {
        window.attachPasswordChange_changeNavGuard();
    }
}
