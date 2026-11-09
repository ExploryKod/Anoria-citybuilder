/**
 * The trade balance of the city (docs/gameplay/PLAN_TRADE_RELATIONS.md), READ from the journal's trade lines and written nowhere: the lines are already typed by what they are
 * and by the good they carry (`abroad_sale_<good>`, `import_<good>`…), and carry the partner city. Nothing here is a second counter: every figure is a sum of lines.
 *
 * What is counted:
 *   - exports: what our merchants sold abroad (`abroad_sale_`);
 *   - imports: what they bought abroad (`import_`);
 *   - freight: the transport of the imports (`freight_`), paid to the foreign side: part of the current balance;
 *   - customs: the duties the city collected (`customs_import_`, `export_`): a revenue of the city, shown apart, not an external flow.
 * The goods balance is exports less imports; the current balance (of the goods and their transport) takes the freight off. The coverage rate is exports over imports.
 *
 * The interest paid abroad is not here: it belongs to the economy (HamletEconomyPolicy.externalInterestOf), over twelve months, and the commentary quotes it.
 */

/** The kind of a trade line, by the prefix of its type. The most specific prefix first: `customs_import_` and `import_` do not overlap, but the order is stated. */
const TRADE_LINE_PREFIXES = Object.freeze([
  Object.freeze({ kind: 'customsImport', prefix: 'customs_import_' }),
  Object.freeze({ kind: 'exports', prefix: 'abroad_sale_' }),
  Object.freeze({ kind: 'imports', prefix: 'import_' }),
  Object.freeze({ kind: 'freight', prefix: 'freight_' }),
  Object.freeze({ kind: 'customsExport', prefix: 'export_' }),
]);

/**
 * @param {string} type the type of a journal line
 * @returns {{ kind: 'exports' | 'imports' | 'freight' | 'customsImport' | 'customsExport', good: string } | null} what the line is, or null when it is no trade line
 */
export function tradeKindOf(type) {
  if (typeof type !== 'string') return null;
  const found = TRADE_LINE_PREFIXES.find(({ prefix }) => type.startsWith(prefix));
  return found ? { kind: found.kind, good: type.slice(found.prefix.length) } : null;
}

const cents = (amount) => Math.round(amount * 100) / 100;

/** @returns {object} an empty bucket (a month, or a year being summed) */
function emptyBucket() {
  return { exports: 0, imports: 0, freight: 0, customs: 0, partners: new Map(), goods: new Map(), partnersKnown: true };
}

/** @param {Map<string, { exports: number, imports: number }>} map */
function touch(map, key) {
  if (!map.has(key)) map.set(key, { exports: 0, imports: 0 });
  return map.get(key);
}

/**
 * Puts a line in a bucket. A line whose partner is unknown (a year closed by a purge keeps the totals per type, not the partners) counts in the totals and marks the bucket
 * `partnersKnown: false`, so the screen says the detail by city is missing instead of showing a partial one as if it were whole.
 */
function add(bucket, { kind, good }, amount, partnerId) {
  if (kind === 'customsImport' || kind === 'customsExport') {
    bucket.customs += amount;
    return;
  }
  bucket[kind] += amount;
  if (kind === 'freight') return;
  touch(bucket.goods, good)[kind] += amount;
  if (!partnerId) {
    bucket.partnersKnown = false;
    return;
  }
  // A partner keeps its own detail by good: the sheet of a city shows what it exchanges, good by good.
  const partner = touch(bucket.partners, partnerId);
  partner[kind] += amount;
  touch((partner.goods ??= new Map()), good)[kind] += amount;
}

/**
 * @param {Array<{ turn: number, type: string, amount: number, partnerId?: string | null }>} entries the journal's lines (the closed years already expanded to their totals per type)
 * @param {(turn: number) => { year: number, monthIndex: number }} timeOf the game's calendar
 * @returns {Map<number, Map<number, object>>} year → month index → bucket
 */
function bucketsOf(entries, timeOf) {
  /** @type {Map<number, Map<number, object>>} */
  const years = new Map();
  for (const entry of entries) {
    const line = tradeKindOf(entry.type);
    if (!line) continue;
    if (!Number.isFinite(entry.amount)) throw new Error(`[trade-balance] the trade line ${entry.id ?? entry.type} has no amount`);
    const { year, monthIndex } = timeOf(entry.turn);
    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year);
    if (!months.has(monthIndex)) months.set(monthIndex, emptyBucket());
    add(months.get(monthIndex), line, entry.amount, entry.partnerId ?? null);
  }
  return years;
}

/** @param {object} bucket @returns {object} the figures of a month or a year, rounded to the cent, with the detail by city and by good, the biggest first */
function summarise(bucket) {
  const exports = cents(bucket.exports);
  const imports = cents(bucket.imports);
  const freight = cents(bucket.freight);
  const ranked = (map, key) => [...map.entries()]
    .map(([id, sums]) => ({
      [key]: id,
      exports: cents(sums.exports),
      imports: cents(sums.imports),
      balance: cents(sums.exports - sums.imports),
      // Only a partner has a detail by good.
      ...(sums.goods ? { goods: ranked(sums.goods, 'good') } : {}),
    }))
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  return {
    exports,
    imports,
    freight,
    customs: cents(bucket.customs),
    goodsBalance: cents(exports - imports),
    currentBalance: cents(exports - imports - freight),
    // Over the imports: null while nothing was bought (a coverage of nothing is not a rate).
    coverage: imports > 0 ? exports / imports : null,
    partners: ranked(bucket.partners, 'cityId'),
    goods: ranked(bucket.goods, 'good'),
    partnersKnown: bucket.partnersKnown,
  };
}

/** @param {Iterable<object>} buckets @returns {object} the sum of buckets */
function merged(buckets) {
  const total = emptyBucket();
  for (const bucket of buckets) {
    total.exports += bucket.exports;
    total.imports += bucket.imports;
    total.freight += bucket.freight;
    total.customs += bucket.customs;
    if (!bucket.partnersKnown) total.partnersKnown = false;
    for (const [id, sums] of bucket.partners) {
      const partner = touch(total.partners, id);
      partner.exports += sums.exports;
      partner.imports += sums.imports;
      for (const [good, goodSums] of sums.goods ?? []) {
        const into = touch((partner.goods ??= new Map()), good);
        into.exports += goodSums.exports;
        into.imports += goodSums.imports;
      }
    }
    for (const [good, sums] of bucket.goods) {
      touch(total.goods, good).exports += sums.exports;
      touch(total.goods, good).imports += sums.imports;
    }
  }
  return total;
}

/**
 * @param {object} params
 * @param {Array<{ turn: number, type: string, amount: number, partnerId?: string | null }>} params.entries
 * @param {(turn: number) => { year: number, monthIndex: number }} params.timeOf
 * @param {number} params.year the year to read
 * @returns {{ year: number, years: number[], months: object[], total: object }} `years`: the years that have a trade line, oldest first; `months`: the twelve months of `year`,
 *   each with the figures of `summarise`, and `monthIndex`; `total`: the year's
 */
export function tradeBalanceOf({ entries, timeOf, year }) {
  const years = bucketsOf(entries, timeOf);
  const months = years.get(year) ?? new Map();
  const empty = emptyBucket();
  const total = summarise(merged(months.values()));
  return {
    year,
    years: [...years.keys()].sort((a, b) => a - b),
    months: Array.from({ length: 12 }, (_, monthIndex) => ({ monthIndex, ...summarise(months.get(monthIndex) ?? empty) })),
    // The structure of the year: how much of a side rests on one partner or one good (null where the detail is not known, or the side is nil).
    total: {
      ...total,
      dependence: {
        exportPartner: total.partnersKnown ? biggestShareOf(total.partners, 'exports') : null,
        importPartner: total.partnersKnown ? biggestShareOf(total.partners, 'imports') : null,
        exportGood: biggestShareOf(total.goods, 'exports'),
      },
    },
  };
}

/**
 * How much of a side of the trade rests on one partner, or on one good: the biggest share and who holds it. Read over the exports or over the imports of a period.
 * @param {Array<{ exports: number, imports: number }>} rows the partners (or the goods) of a period
 * @param {'exports' | 'imports'} side
 * @returns {{ id: string, share: number } | null} null while that side is nil
 */
export function biggestShareOf(rows, side) {
  const total = rows.reduce((sum, row) => sum + row[side], 0);
  if (!(total > 0)) return null;
  const top = [...rows].sort((a, b) => b[side] - a[side])[0];
  return { id: top.cityId ?? top.good, share: top[side] / total };
}
