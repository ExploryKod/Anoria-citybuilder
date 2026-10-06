/**
 * Which of a month's service bills a house pays. A house pays its bills in the order it received them, while its money
 * covers each one; the first bill it cannot pay cuts off the rest of its services for the month. A bill with no share to
 * pay (a fully subsidised service) is always paid: it costs the house nothing.
 *
 * @param {Array<{ houseId: string, amount: number }>} bills in the order they were received; amount is what the house pays (TTC)
 * @param {(houseId: string) => number} fundsOf what the house has to pay with before this month's services
 * @returns {boolean[]} whether each bill is paid
 */
export function payableServiceBills(bills, fundsOf) {
  const spent = new Map();
  const cutOff = new Set();
  return bills.map((bill) => {
    if (cutOff.has(bill.houseId)) return false;
    if (bill.amount <= 0) return true;
    const available = fundsOf(bill.houseId) - (spent.get(bill.houseId) ?? 0);
    if (bill.amount > available) {
      cutOff.add(bill.houseId);
      return false;
    }
    spent.set(bill.houseId, (spent.get(bill.houseId) ?? 0) + bill.amount);
    return true;
  });
}
