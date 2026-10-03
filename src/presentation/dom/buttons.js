import { initAppBoot } from './boot/initAppBoot.js';
import { redirectBareGameToHamlet } from './boot/redirectBareGame.js';

window.onload = async () => {
  if (await redirectBareGameToHamlet()) return;
  initAppBoot();
};
