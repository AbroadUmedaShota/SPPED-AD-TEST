import { getTooltipText } from '../services/tooltipContent.js';

let activeTrigger = null;
let popoverElement = null;
let listenersBound = false;
let tutorialObserver = null;

const tutorialSelectors = [
  '#custom-tutorial-popover',
  '#custom-tutorial-highlight-box',
  '#custom-tutorial-overlay',
  '.tutorial-tooltip',
  '.tutorial-overlay',
  '#tutorial-complete-overlay'
];

function getCurrentLocale() {
  if (typeof window.getCurrentLanguage === 'function') {
    return window.getCurrentLanguage() || 'ja';
  }
  return document.documentElement.lang || 'ja';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildTooltipMarkup(text) {
  const normalized = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (normalized.length === 0) {
    return '<p>---</p>';
  }

  const html = [];
  let listItems = [];

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }
    html.push(`<ul class="help-popover__list">${listItems.join('')}</ul>`);
    listItems = [];
  };

  normalized.forEach((line, index) => {
    if (index === 0) {
      flushList();
      html.push(`<p class="help-popover__title">${escapeHtml(line)}</p>`);
      return;
    }

    if (line.startsWith('・')) {
      listItems.push(`<li>${escapeHtml(line.replace(/^・\s*/, ''))}</li>`);
      return;
    }

    flushList();
    const isSectionHeading = !/[。.!?：:、]/.test(line) && line.length <= 20;
    const className = isSectionHeading ? 'help-popover__section-title' : '';
    html.push(`<p${className ? ` class="${className}"` : ''}>${escapeHtml(line)}</p>`);
  });

  flushList();
  return html.join('');
}

function ensurePopoverElement() {
  if (popoverElement && document.body.contains(popoverElement)) {
    return popoverElement;
  }

  popoverElement = document.createElement('div');
  popoverElement.id = 'global-help-popover';
  popoverElement.className = 'help-popover hidden';
  popoverElement.setAttribute('role', 'tooltip');
  popoverElement.setAttribute('aria-hidden', 'true');
  document.body.appendChild(popoverElement);
  return popoverElement;
}

function isElementVisible(element) {
  if (!element || !element.isConnected) {
    return false;
  }

  if (element.classList.contains('hidden') || element.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function isTutorialActive() {
  return tutorialSelectors.some((selector) =>
    Array.from(document.querySelectorAll(selector)).some(isElementVisible)
  );
}

function getHelpPopoverZIndexContext() {
  return isTutorialActive() ? null : 'var(--z-help-popover)';
}

function renderPopover(trigger) {
  const helpKey = trigger?.dataset?.helpKey;
  const text = getTooltipText(helpKey, getCurrentLocale());
  const popover = ensurePopoverElement();
  const zIndex = getHelpPopoverZIndexContext();
  popover.style.zIndex = zIndex || '';
  popover.innerHTML = buildTooltipMarkup(text);
  return popover;
}

function positionPopover(trigger) {
  if (!trigger || !popoverElement) {
    return;
  }

  const margin = 12;
  const rect = trigger.getBoundingClientRect();
  const popoverWidth = Math.min(340, window.innerWidth - (margin * 2));
  popoverElement.style.maxWidth = `${popoverWidth}px`;
  popoverElement.style.left = '0px';
  popoverElement.style.top = '0px';

  const popoverRect = popoverElement.getBoundingClientRect();
  let top = rect.bottom + 10;
  let left = rect.left + (rect.width / 2) - (popoverRect.width / 2);

  if (left < margin) {
    left = margin;
  }
  if ((left + popoverRect.width) > window.innerWidth - margin) {
    left = window.innerWidth - popoverRect.width - margin;
  }
  if ((top + popoverRect.height) > window.innerHeight - margin) {
    top = rect.top - popoverRect.height - 10;
  }
  if (top < margin) {
    top = margin;
  }

  popoverElement.style.left = `${left}px`;
  popoverElement.style.top = `${top}px`;
}

export function closeActiveHelpPopover() {
  if (!activeTrigger || !popoverElement) {
    return;
  }

  activeTrigger.setAttribute('aria-expanded', 'false');
  popoverElement.classList.add('hidden');
  popoverElement.setAttribute('aria-hidden', 'true');
  activeTrigger = null;
}

function openHelpPopover(trigger) {
  if (!trigger) {
    return;
  }

  if (isTutorialActive()) {
    closeActiveHelpPopover();
    return;
  }

  if (activeTrigger === trigger) {
    closeActiveHelpPopover();
    return;
  }

  closeActiveHelpPopover();
  renderPopover(trigger);
  popoverElement.classList.remove('hidden');
  popoverElement.setAttribute('aria-hidden', 'false');
  trigger.setAttribute('aria-expanded', 'true');
  activeTrigger = trigger;
  positionPopover(trigger);
}

function bindGlobalListeners() {
  if (listenersBound) {
    return;
  }
  listenersBound = true;

  document.addEventListener('click', (event) => {
    if (!activeTrigger || !popoverElement) {
      return;
    }
    if (activeTrigger.contains(event.target) || popoverElement.contains(event.target)) {
      return;
    }
    closeActiveHelpPopover();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeActiveHelpPopover();
    }
  });

  document.addEventListener('languagechange', () => {
    if (!activeTrigger) {
      return;
    }
    if (isTutorialActive()) {
      closeActiveHelpPopover();
      return;
    }
    renderPopover(activeTrigger);
    positionPopover(activeTrigger);
  });

  window.addEventListener('resize', () => {
    if (activeTrigger) {
      positionPopover(activeTrigger);
    }
  });

  document.addEventListener('scroll', () => {
    if (activeTrigger) {
      positionPopover(activeTrigger);
    }
  }, true);

  if (!tutorialObserver) {
    tutorialObserver = new MutationObserver(() => {
      if (activeTrigger && isTutorialActive()) {
        closeActiveHelpPopover();
      }
    });
    tutorialObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'aria-hidden']
    });
  }
}

function bindTrigger(trigger) {
  if (!trigger || trigger.dataset.helpPopoverBound === 'true') {
    return;
  }

  const isButton = trigger.tagName === 'BUTTON';
  if (!isButton) {
    trigger.setAttribute('role', trigger.getAttribute('role') || 'button');
    trigger.setAttribute('tabindex', trigger.getAttribute('tabindex') || '0');
  }

  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');

  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openHelpPopover(trigger);
  });

  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      openHelpPopover(trigger);
    }
  });

  trigger.dataset.helpPopoverBound = 'true';
}

export function initHelpPopovers(root = document) {
  bindGlobalListeners();
  root.querySelectorAll('[data-help-key]').forEach(bindTrigger);
}
