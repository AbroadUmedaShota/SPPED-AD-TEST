export function initEstimateSidebarDrawer({
  sidebarId = 'estimateSidebar',
  toggleId = 'estimateSidebarToggleBtn',
  overlayId = 'estimateSidebarOverlay'
} = {}) {
  const sidebar = document.getElementById(sidebarId);
  const toggleBtn = document.getElementById(toggleId);
  const overlay = document.getElementById(overlayId);
  const icon = toggleBtn?.querySelector('.material-icons');

  if (!sidebar || !toggleBtn || !overlay || !icon) return;
  if (sidebar.dataset.estimateDrawerBound === 'true') return;

  const drawerMedia = window.matchMedia('(max-width: 1279.98px)');

  const setOpen = isOpen => {
    const nextOpen = Boolean(isOpen && drawerMedia.matches);
    sidebar.classList.toggle('is-open', nextOpen);
    overlay.classList.toggle('is-visible', nextOpen);
    toggleBtn.setAttribute('aria-expanded', String(nextOpen));
    icon.textContent = nextOpen ? 'chevron_right' : 'chevron_left';
    document.body.classList.toggle('estimate-drawer-open', nextOpen);
  };

  const close = () => setOpen(false);

  sidebar.dataset.estimateDrawerBound = 'true';

  toggleBtn.addEventListener('click', () => {
    setOpen(!sidebar.classList.contains('is-open'));
  });
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });
  drawerMedia.addEventListener('change', event => {
    if (!event.matches) close();
  });

  close();
}
