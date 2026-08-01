import { registerAppFunction } from '../js/acl/appRuntime.js';
import { loadBudgetStates } from './compta/compte-de-resultat/CompteDeResultatPanel.js';
import { initAppBoot } from './boot/initAppBoot.js';

window.onload = initAppBoot;

registerAppFunction('loadBudgetStates', (period = '3', showLoading = true) =>
  loadBudgetStates(period, showLoading)
);
