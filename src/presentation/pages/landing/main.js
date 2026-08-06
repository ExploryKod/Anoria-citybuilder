import { setBootMode } from '../site/bootSession.js';
import { mountSiteLegalFooter } from '../site/mountSiteLegalFooter.js';

mountSiteLegalFooter();

document.querySelectorAll('[data-boot-mode]').forEach((el) => {
  el.addEventListener('click', () => {
    const mode = el.dataset.bootMode;
    if (mode) {
      setBootMode(mode);
    }
  });
});

document.querySelectorAll('.site-btn--beta').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
  });
});
