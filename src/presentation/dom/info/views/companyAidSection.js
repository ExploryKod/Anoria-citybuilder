/**
 * The city's aid to a company, on the Finances tab of its sheet: what the city holds in it (its capital, its stake as a shareholder, the price of a share, the loans it still
 * owes) and the form to put money into it, as a shareholder, a loan or a participation. The same contribution as the admin panel's, made from the building itself.
 * Nothing is shown for a building that is not a company (the list of the companies says which are).
 */

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const percent = (share) => `${Math.round(share * 1000) / 10} %`;
const euros = (amount) => `${Math.round(amount).toLocaleString('fr-FR')} €`;

/**
 * @param {{ accounting: { describeAidCompanies: () => Promise<Array<object>>, injectCompanyAid: (params: object) => Promise<unknown> }, buildingId: string }} model
 * @returns {Promise<HTMLElement | null>} the section, null when the building is not a company
 */
export async function companyAidSection({ accounting, buildingId }) {
  const section = el('section', 'company-aid');
  const render = async () => {
    const company = (await accounting.describeAidCompanies()).find((candidate) => candidate.buildingId === buildingId);
    if (!company) return false;

    const held = el(
      'p',
      'building-finance-note',
      `Valeur : ${euros(company.equity)} · prix d'une part : ${Math.round(company.sharePrice * 100) / 100} € · part de l'État : ${percent(company.stake)}${company.loanOutstanding > 0 ? ` · prêt dû : ${euros(company.loanOutstanding)}` : ''}`,
    );

    const form = el('select', 'company-aid-field');
    form.setAttribute('aria-label', 'Forme du versement');
    for (const [value, label] of [['shareholder', "L'État actionnaire (capital et dividendes)"], ['loan', 'Prêt'], ['participation', 'Participation (capital sans contrepartie)']]) form.append(new Option(label, value));
    const amount = el('input', 'company-aid-field');
    amount.type = 'number';
    amount.min = '1';
    amount.step = '1';
    amount.value = '100';
    amount.inputMode = 'numeric';
    amount.setAttribute('aria-label', 'Montant, en euros');
    const preview = el('p', 'building-finance-note');
    const error = el('p', 'building-finance-note company-aid-error');
    error.hidden = true;
    const apply = el('button', 'company-aid-apply', 'Verser');
    apply.type = 'button';

    const showPreview = () => {
      const value = Number(amount.value);
      const bought = Number.isFinite(value) && value > 0 ? value / company.sharePrice : null;
      preview.textContent = form.value === 'shareholder' && bought !== null ? `Après ce versement, la part de l'État serait de ${percent((company.shareholderShares + bought) / (company.shares + bought))}.` : '';
    };
    form.addEventListener('input', showPreview);
    amount.addEventListener('input', showPreview);
    showPreview();

    apply.addEventListener('click', async () => {
      error.hidden = true;
      try {
        await accounting.injectCompanyAid({ buildingId, amount: Number(amount.value), form: form.value });
        await render();
      } catch (failure) {
        error.textContent = failure.message.replace(/^\[company-aid\]\s*/, '');
        error.hidden = false;
      }
    });

    section.replaceChildren(el('h4', 'company-aid-title', 'Aide de la ville'), held, form, amount, preview, error, apply);
    return true;
  };
  return (await render()) ? section : null;
}
