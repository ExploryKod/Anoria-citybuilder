import { registerAppFunction } from '../acl/appRuntime.js';
import { loadBudgetStates } from './budget/BudgetStatesManager.js';
import { initAppBoot } from './boot/initAppBoot.js';

window.onload = initAppBoot;

registerAppFunction('loadBudgetStates', (period = '3', showLoading = true) =>
  loadBudgetStates(period, showLoading)
);
