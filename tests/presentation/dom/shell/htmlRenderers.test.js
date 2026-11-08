/**
 * @jest-environment jsdom
 */
import { html } from '../../../../src/presentation/dom/shell/safeHtml.js';
import { renderActiveLoansHtml } from '../../../../src/presentation/dom/compta/prets/PretsPresenter.js';
import { renderCityMapGridHtml } from '../../../../src/presentation/dom/carte-ville/CarteVillePresenter.js';
import { renderCityCommerceTab } from '../../../../src/presentation/dom/maps/renderCityExchangeModal.js';

// The panels build their markup with html``: every value is escaped, and what a renderer returns is markup that sits inside another html`` as it is. The risk of that
// conversion is the opposite of an XSS: markup escaped twice, which the player would read as text ("&lt;div&gt;"). These renderers stand for the rest.
describe('panels built with html``', () => {
  const show = (markup) => {
    const container = document.createElement('div');
    container.innerHTML = html`${markup}`;
    return container;
  };

  test('the loans list shows its structure, not its tags', () => {
    const loan = { id: 'loan_1', type: 'bank', amount: 500, total: 520, interest: 20, interestRate: 0.05, duration: 2, remainingTurns: 2 };
    const container = show(renderActiveLoansHtml([loan], () => ({ payment: 260, interest: 10, principal: 250 })));
    expect(container.querySelectorAll('.loan-item')).toHaveLength(1);
    expect(container.querySelectorAll('.schedule-row')).toHaveLength(2);
    expect(container.textContent).not.toMatch(/[<>]|&lt;|&gt;/);
  });

  test('the city map draws one cell per tile, nested tables included', () => {
    const container = show(renderCityMapGridHtml({ citySize: 3, buildingMap: new Map(), hasRoadAccessFromCount: () => true }));
    expect(container.querySelectorAll('td.grid-cell')).toHaveLength(9);
    expect(container.querySelectorAll('th.y-header')).toHaveLength(3);
    expect(container.textContent).not.toMatch(/[<>]|&lt;|&gt;/);
  });

  test('the exchange table shows a sale as a row of cells', () => {
    const container = show(renderCityCommerceTab([{ turn: 0, good: 'wheat', quantity: 2, price: 3, grossRevenue: 6, customsCollected: 0, customsRate: 0, netRevenue: 6 }]));
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(container.querySelectorAll('tbody td')).toHaveLength(7);
    expect(container.textContent).not.toMatch(/&lt;|&gt;/);
  });
});
