import { formatEuro } from '../../../../contexts/accounting/presentation/formatMoney.js';

/**
 * The grand livre and the balance of an account (the accounting context derives them from the journal): the balance is one table of the accounts with
 * their totals and balances; the grand livre is one fold per account, closed until the player opens it. The accounting words are written here on purpose.
 */

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** An amount as the books read it: nothing for a nil figure. */
const figure = (amount) => (amount === 0 ? '' : formatEuro(amount));

function headRow(labels) {
  const head = document.createElement('thead');
  const row = document.createElement('tr');
  for (const label of labels) {
    const th = el('th', null, label);
    th.scope = 'col';
    row.append(th);
  }
  head.append(row);
  return head;
}

/**
 * @param {ReturnType<import('../../../../contexts/accounting/domain/policies/AccountLedgerPolicy.js').trialBalanceOf>} balance
 * @returns {HTMLElement}
 */
export function trialBalanceView(balance) {
  const wrapper = el('div', 'building-finance-statement account-ledger');
  const table = el('table', 'building-finance-table account-ledger-table');
  table.append(headRow(['Compte', 'Libellé', 'Débit', 'Crédit', 'Solde débiteur', 'Solde créditeur']));
  const body = document.createElement('tbody');
  for (const account of balance.accounts) {
    const row = el('tr', 'account-ledger-row');
    row.append(
      el('td', null, account.account),
      el('td', null, account.label),
      el('td', 'account-ledger-amount', figure(account.debit)),
      el('td', 'account-ledger-amount', figure(account.credit)),
      el('td', 'account-ledger-amount', figure(account.debitBalance)),
      el('td', 'account-ledger-amount', figure(account.creditBalance)),
    );
    body.append(row);
  }
  const total = el('tr', 'account-ledger-row account-ledger-row--total');
  total.append(
    el('td', null, ''),
    el('td', null, 'Totaux'),
    el('td', 'account-ledger-amount', formatEuro(balance.totals.debit)),
    el('td', 'account-ledger-amount', formatEuro(balance.totals.credit)),
    el('td', 'account-ledger-amount', formatEuro(balance.totals.debitBalance)),
    el('td', 'account-ledger-amount', formatEuro(balance.totals.creditBalance)),
  );
  body.append(total);
  table.append(body);
  wrapper.append(
    table,
    el('p', 'building-finance-note', 'Chaque ligne du journal est écrite deux fois : au compte qu’elle concerne et à la banque (512). Les totaux débit et crédit sont donc égaux.'),
  );
  return wrapper;
}

/**
 * @param {ReturnType<import('../../../../contexts/accounting/domain/policies/AccountLedgerPolicy.js').accountLedgerOf>} ledger
 * @returns {HTMLElement}
 */
export function accountLedgerView(ledger) {
  const wrapper = el('div', 'building-finance-statement account-ledger');
  for (const account of ledger) {
    const details = el('details', 'account-ledger-account');
    const summary = el('summary', null, `${account.account} — ${account.label}`);
    summary.append(el('span', 'account-ledger-balance', `solde ${formatEuro(account.balance)}`));
    const table = el('table', 'building-finance-table account-ledger-table');
    table.append(headRow(['Mois', 'Libellé', 'Débit', 'Crédit', 'Solde']));
    const body = document.createElement('tbody');
    for (const line of account.lines) {
      const row = el('tr', 'account-ledger-row');
      row.append(
        el('td', null, line.year === null ? '' : `${line.month}/${line.year}`),
        el('td', null, line.description),
        el('td', 'account-ledger-amount', figure(line.debit)),
        el('td', 'account-ledger-amount', figure(line.credit)),
        el('td', 'account-ledger-amount', formatEuro(line.balance)),
      );
      body.append(row);
    }
    table.append(body);
    details.append(summary, table);
    wrapper.append(details);
  }
  if (ledger.length === 0) wrapper.append(el('p', 'building-finance-note', 'Aucune écriture pour ce compte.'));
  return wrapper;
}
