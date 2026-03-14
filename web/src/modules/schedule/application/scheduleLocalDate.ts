/**
 * Schedule dates are calendar keys (`yyyy-MM-dd`), not UTC instants.
 * Parsing a bare ISO date with `new Date('2026-03-09')` applies UTC semantics
 * and can shift the rendered day on devices west of UTC. We intentionally parse
 * schedule dates as local midnight to preserve the calendar day the user picked.
 */
export function parseScheduleLocalDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}
