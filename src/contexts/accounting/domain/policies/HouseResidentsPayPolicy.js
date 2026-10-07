const centimes = (amount) => Math.round(amount * 100) / 100;

/**
 * Splits a residents' group evenly across its members, the last one absorbing the leftover centime — the same
 * discipline as ProducerChargePolicy.wageSplitLines, so every resident's amount sums back to the group's booked line.
 * @param {Array<{ id: string }>} group
 * @param {number} amount
 * @returns {Map<string, number>}
 */
function splitAcrossResidents(group, amount) {
  const shares = new Map();
  let paid = 0;
  group.forEach((resident, index) => {
    const share = index === group.length - 1 ? centimes(amount - paid) : centimes(amount / group.length);
    paid = centimes(paid + share);
    shares.set(resident.id, share);
  });
  return shares;
}

/**
 * One household's residents' pay, split from the journal lines already booked for a settled month — never a second
 * computation: a resident's amount is his share of the line his group was paid. A group whose line is not in the
 * journal yet is reported unsettled (`amount: null`), never guessed at zero — unless the current rates make zero the
 * honest answer for that group (civil servants/unemployed only: their pay is an exact multiple of the reference
 * salary/benefit, so a nil rate is a legitimate zero, not a missing settlement). A worker's pay is never legitimately
 * zero while he is assigned to a workplace, so a missing household_wage line is always reported unsettled.
 *
 * @param {Array<{ id: string, status: 'worker' | 'civil_servant' | 'unemployed', workplaceId: string | null }>} residents from residentsOfHouse(), in their display order
 * @param {Array<{ type: string, amount: number, year: number, month: number, accountBuildingId: string | null, accountKind: string | null, counterpartyBuildingId: string | null }>} journalEntries the whole journal
 * @param {{ houseId: string, year: number, month: number }} period the settled month (1-based month, as stored on a journal entry)
 * @param {{ predictedPublicPay: number, predictedBenefit: number }} expected this house's public_wage/household_benefit computed from the current rates (HouseholdPublicPayPolicy.householdPublicPayOf) — used only to tell a legitimate zero from a pending settlement, never displayed as if it were the booked amount
 * @returns {Array<{ id: string, amount: number | null, settled: boolean }>} one entry per resident, same order as `residents`
 */
export function residentPayBreakdownOf(residents, journalEntries, { houseId, year, month }, expected) {
  const houseEntries = journalEntries.filter(
    (entry) => entry.accountBuildingId === houseId && entry.accountKind === 'particulier' && entry.year === year && entry.month === month,
  );

  const breakdown = new Map();

  const civilServants = residents.filter((resident) => resident.status === 'civil_servant');
  if (civilServants.length > 0) {
    const line = houseEntries.find((entry) => entry.type === 'public_wage');
    if (line) {
      for (const [id, amount] of splitAcrossResidents(civilServants, line.amount)) breakdown.set(id, { id, amount, settled: true });
    } else if (expected.predictedPublicPay === 0) {
      for (const resident of civilServants) breakdown.set(resident.id, { id: resident.id, amount: 0, settled: true });
    } else {
      for (const resident of civilServants) breakdown.set(resident.id, { id: resident.id, amount: null, settled: false });
    }
  }

  const unemployed = residents.filter((resident) => resident.status === 'unemployed');
  if (unemployed.length > 0) {
    const line = houseEntries.find((entry) => entry.type === 'household_benefit');
    if (line) {
      for (const [id, amount] of splitAcrossResidents(unemployed, line.amount)) breakdown.set(id, { id, amount, settled: true });
    } else if (expected.predictedBenefit === 0) {
      for (const resident of unemployed) breakdown.set(resident.id, { id: resident.id, amount: 0, settled: true });
    } else {
      for (const resident of unemployed) breakdown.set(resident.id, { id: resident.id, amount: null, settled: false });
    }
  }

  const workplaceIds = new Set(residents.filter((resident) => resident.status === 'worker').map((resident) => resident.workplaceId));
  for (const workplaceId of workplaceIds) {
    const group = residents.filter((resident) => resident.status === 'worker' && resident.workplaceId === workplaceId);
    const line = houseEntries.find((entry) => entry.type === 'household_wage' && entry.counterpartyBuildingId === workplaceId);
    if (line) {
      for (const [id, amount] of splitAcrossResidents(group, line.amount)) breakdown.set(id, { id, amount, settled: true });
    } else {
      for (const resident of group) breakdown.set(resident.id, { id: resident.id, amount: null, settled: false });
    }
  }

  return residents.map((resident) => breakdown.get(resident.id));
}
