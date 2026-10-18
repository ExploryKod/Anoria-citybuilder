/**
 * Why inhabitants leave a house. Data only: the engine (RunMonthlyDepartures.js) knows no cause by name, it reads each one from here, so a new cause
 * is one entry here and one reader of its signal in the composition.
 *
 * - `signal`: the name of what is measured for a house, in whole months of distress (0 = fine). The composition provides the reader of each signal.
 * - `warnFromMonths`: from this many months of distress the house voices a warning (no one has left yet).
 * - `thresholdMonths`: from this many months of distress inhabitants leave, every month it lasts.
 * - `leavePerMonth`: how many inhabitants leave each month.
 * - `repopulationDelayMonths`: once the distress is over, a house that lost inhabitants to it cannot be repopulated for this many months (a penalty).
 * - Words, as the Messages tab shows them: `icon` and `label` (the warning, short), `warning` (its tooltip; `{months}` = months left before the first
 *   departure), `reason` (the tooltip of the departures: "<left> of the <of> inhabitants left: <reason>"). The visible text of the departures is
 *   "<icon> x/y" (inhabitants left / inhabitants when the distress began). `penalty` and `penaltyDetail` (`{months}` = months left) word the
 *   `repopulationDelayMonths` the house is serving, in the same way ("<icon> <penalty>", the detail in its tooltip).
 */
export const DEPARTURE_CAUSES = Object.freeze({
  rentUnpaid: Object.freeze({
    signal: 'rentUnpaid',
    warnFromMonths: 1,
    thresholdMonths: 2,
    leavePerMonth: 1,
    repopulationDelayMonths: 2,
    icon: '🏚️',
    label: 'Loyer impayé',
    warning: "Nous ne pouvons plus payer le loyer : sans paiement, des habitants partiront dans {months} mois",
    reason: 'la maison ne peut plus payer le loyer de la SCI',
    penalty: 'Repeuplement bloqué',
    penaltyDetail: "Personne ne veut s'installer ici avant {months} mois : les anciens habitants sont partis sans payer le loyer",
  }),
});

/** @returns {ReadonlyArray<[string, typeof DEPARTURE_CAUSES[keyof typeof DEPARTURE_CAUSES]]>} every cause with its id */
export function departureCauses() {
  return Object.entries(DEPARTURE_CAUSES);
}
