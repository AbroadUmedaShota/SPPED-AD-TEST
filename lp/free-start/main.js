const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('[data-menu-button]');
const navigation = document.querySelector('[data-nav]');

const setMenuOpen = (isOpen) => {
  menuButton?.setAttribute('aria-expanded', String(isOpen));
  navigation?.classList.toggle('is-open', isOpen);
  document.body.classList.toggle('menu-open', isOpen);

  const label = menuButton?.querySelector('.visually-hidden');
  if (label) {
    label.textContent = isOpen ? 'メニューを閉じる' : 'メニューを開く';
  }
};

menuButton?.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') !== 'true';
  setMenuOpen(isOpen);
});

navigation?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => setMenuOpen(false));
});

window.addEventListener('scroll', () => {
  header?.classList.toggle('is-sticky', window.scrollY > 40);
}, { passive: true });

window.addEventListener('resize', () => {
  if (window.innerWidth > 860) {
    setMenuOpen(false);
  }
});
