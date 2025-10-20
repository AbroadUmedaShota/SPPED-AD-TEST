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
    {
        id: 'account-info',
        href: '#',
        icon: 'account_circle',
        label: 'アカウント情報',
        onClick: () => window.openAccountInfoModal(window.dummyUserData),
        preventAutoClose: true
    },
    { id: 'logout', href: '#', icon: 'logout', label: 'ログアウト', preventAutoClose: true }
];

const MEDIA_QUERY = window.matchMedia('(min-width: 1024px)');
const SELECTED_GROUP_STORAGE_KEY = 'dashboard.selectedGroupId';

// --- DOM Elements ---

let sidebar, mobileSidebarOverlay, sidebarToggleMobile, userSelect, navContainer, currentGroupLabel;

// --- State ---

let groupsCache = [];
let activeGroupId = null;
let isMediaQueryBound = false;
let isMobileToggleBound = false;
let isOverlayBound = false;
let isNavClickBound = false;
let isUserSelectBound = false;
let isLogoutBound = false;

/**
 * Cache all necessary DOM elements for the sidebar.
 */
function cacheDOMElements() {
    sidebar = document.getElementById('sidebar');
    mobileSidebarOverlay = document.getElementById('mobileSidebarOverlay');
    sidebarToggleMobile = document.getElementById('sidebarToggleMobile');
    userSelect = document.getElementById('user_select');
    navContainer = document.getElementById('sidebar-nav');
    currentGroupLabel = document.getElementById('currentGroupLabel');
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
 * Now exported and callable without an event.
 */
export function adjustLayout() {
    const isPcScreen = MEDIA_QUERY.matches;
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

        if (item.preventAutoClose) {
            link.dataset.preventAutoClose = 'true';
        }

        if (item.onClick) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                item.onClick();
            });
        }

        navContainer.appendChild(link);
    });
}

function handleGroupChange(selectedId) {
    const newGroupButton = document.getElementById('newGroupButton');
    const groupManagementNav = document.getElementById('group-managementButton');

    activeGroupId = selectedId || null;
    persistSelectedGroup(activeGroupId);
    setGroupFilter(activeGroupId === 'personal' ? 'personal' : activeGroupId);

    if (selectedId === 'personal') {
        if (newGroupButton) newGroupButton.style.display = 'none';
        if (groupManagementNav) groupManagementNav.style.display = 'none';
        if (currentGroupLabel) currentGroupLabel.style.display = 'none';
    } else {
        if (newGroupButton) newGroupButton.style.display = '';
        if (groupManagementNav) groupManagementNav.style.display = '';
        if (currentGroupLabel) currentGroupLabel.style.display = '';
        const selectedGroup = groupsCache.find(g => g.id === selectedId);
        if (selectedGroup) {
            updateCurrentGroupLabel(selectedGroup.name);
        } else {
            // This might happen if cache is out of sync. Fallback.
            updateCurrentGroupLabel('グループ未設定');
        }
    }
}

/**
 * Populates the group selection dropdown.
 */
async function populateGroupSelect() {
    if (!userSelect) return;
    userSelect.innerHTML = ''; // Clear existing options

    try {
        // Add Personal Account option first
        const personalOption = document.createElement('option');
        personalOption.value = 'personal';
        personalOption.textContent = '個人アカウント';
        userSelect.appendChild(personalOption);

        groupsCache = await fetchGroups();

        if (Array.isArray(groupsCache) && groupsCache.length > 0) {
            groupsCache.forEach(group => {
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = group.name;
                userSelect.appendChild(option);
            });
        }

        const storedGroupId = getStoredGroupId();
        const initialGroupId = storedGroupId || 'personal';
        userSelect.value = initialGroupId;
        
        // Run initial UI update based on the selected group
        handleGroupChange(initialGroupId);

    } catch (error) {
        console.error('Failed to fetch groups for sidebar:', error);
        showToast('グループの読み込みに失敗しました。', 'error');
        groupsCache = []; // Ensure cache is empty on error
        // Still show personal account even if group fetch fails
        handleGroupChange('personal');
    }
}

function updateCurrentGroupLabel(label) {
    if (!currentGroupLabel) return;
    currentGroupLabel.textContent = label && label.trim() ? label : 'グループ未設定';
}

function persistSelectedGroup(groupId) {
    try {
        if (!groupId) {
            localStorage.removeItem(SELECTED_GROUP_STORAGE_KEY);
            return;
        }
        localStorage.setItem(SELECTED_GROUP_STORAGE_KEY, groupId);
    } catch (storageError) {
        console.warn('Failed to persist selected group.', storageError);
    }
}

function getStoredGroupId() {
    try {
        return localStorage.getItem(SELECTED_GROUP_STORAGE_KEY);
    } catch (storageError) {
        console.warn('Failed to read stored group id.', storageError);
        return null;
    }
}

function shouldPreventMobileAutoClose(link) {
    if (!link) return false;

    if (link.dataset.preventAutoClose) {
        return link.dataset.preventAutoClose === 'true';
    }

    if (link.hasAttribute('data-prevent-auto-close')) {
        return link.getAttribute('data-prevent-auto-close') !== 'false';
    }

    return false;
}

// --- Event Listener Setup ---

/**
 * Attaches all necessary event listeners for sidebar functionality.
 */
function attachEventListeners() {
    if (sidebarToggleMobile && !isMobileToggleBound) {
        sidebarToggleMobile.addEventListener('click', toggleMobileSidebar);
        isMobileToggleBound = true;
    }
    if (mobileSidebarOverlay && !isOverlayBound) {
        mobileSidebarOverlay.addEventListener('click', toggleMobileSidebar);
        isOverlayBound = true;
    }

    // Group selection change
    if (userSelect && !isUserSelectBound) {
        userSelect.addEventListener('change', () => {
            const selectedGroupId = userSelect.value;
            handleGroupChange(selectedGroupId);
            showToast('グループを切り替えました。', 'info');
        });
        isUserSelectBound = true;
    }

    // Logout button
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton && !isLogoutBound) {
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
        isLogoutBound = true;
    }

    // Close mobile sidebar on nav item click
    if (navContainer && !isNavClickBound) {
        navContainer.addEventListener('click', (event) => {
            if (MEDIA_QUERY.matches) return;

            const link = event.target.closest('a');
            if (!link || shouldPreventMobileAutoClose(link)) return;
            if (!sidebar || !sidebar.classList.contains('is-open-mobile')) return;

            toggleMobileSidebar();
        });
        isNavClickBound = true;
    }

    // Listen for screen size changes
    if (!isMediaQueryBound) {
        MEDIA_QUERY.addEventListener('change', adjustLayout);
        isMediaQueryBound = true;
    }
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
    adjustLayout();

    // Attach any page-specific guards
    if (typeof window.attachPasswordChangeNavGuard === 'function') {
        window.attachPasswordChangeNavGuard();
    }
}
