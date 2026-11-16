import {EPHEMERIS_END_JD_TDB, EPHEMERIS_START_JD_TDB, jdToTdbCalendar} from './ephemeris';
import type {FullTransferPlan} from './types';

export const TRANSFER_MIN_FLIGHT_DAYS = 120;
export const TRANSFER_MAX_FLIGHT_DAYS = 450;
export type TransferDateKind = 'departure' | 'arrival';
export interface TransferDateIssue {kind: TransferDateKind; min: number; max: number; actual: number}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** The solver's existing window, exposed to date controls; tests enforce validator parity.
 * Passing this check says only that dates are supported, not that a route is feasible. */
export function transferDateBounds(departure: number) {
  const min = EPHEMERIS_START_JD_TDB, max = EPHEMERIS_END_JD_TDB - 125;
  const safeDeparture = Number.isFinite(departure) ? clamp(departure, min, max) : min;
  return {
    departure: {min, max},
    arrival: {
      min: safeDeparture + TRANSFER_MIN_FLIGHT_DAYS,
      max: Math.min(safeDeparture + TRANSFER_MAX_FLIGHT_DAYS, EPHEMERIS_END_JD_TDB - 5),
    },
  };
}

export function transferDateIssue(plan: FullTransferPlan): TransferDateIssue | null {
  const bounds = transferDateBounds(plan.departurePeriapsisJdTdb);
  for (const kind of ['departure', 'arrival'] as const) {
    const actual = kind === 'departure' ? plan.departurePeriapsisJdTdb : plan.arrivalPeriapsisJdTdb;
    const {min, max} = bounds[kind];
    if (!Number.isFinite(actual) || actual < min || actual > max) return {kind, min, max, actual};
  }
  return null;
}

/** Explicit repair proposal; never applied on load or during validation.
 * Spacecraft, hardware, encounter geometry and operation IDs/durations are retained.
 * A schedule that cannot move intact is left for manual editing. */
export function repairTransferDates(plan: FullTransferPlan): FullTransferPlan | null {
  if (!transferDateIssue(plan)) return null;
  const oldDays = plan.arrivalPeriapsisJdTdb - plan.departurePeriapsisJdTdb;
  if (!Number.isFinite(oldDays)) return null;
  const result = structuredClone(plan);
  const departureBounds = transferDateBounds(plan.departurePeriapsisJdTdb).departure;
  result.departurePeriapsisJdTdb = clamp(plan.departurePeriapsisJdTdb, departureBounds.min, departureBounds.max);
  const arrivalBounds = transferDateBounds(result.departurePeriapsisJdTdb).arrival;
  // Moving an unsupported departure retains the requested duration where possible.
  const requestedArrival = result.departurePeriapsisJdTdb + oldDays;
  result.arrivalPeriapsisJdTdb = clamp(requestedArrival, arrivalBounds.min, arrivalBounds.max);
  const shift = ((result.arrivalPeriapsisJdTdb - result.departurePeriapsisJdTdb) - oldDays) * 86400;
  result.operations = result.operations.map(op => ({...op, start: op.start + shift, end: op.end + shift}));
  if (result.operations.some(op => op.start < 0 || op.end > 455 * 86400)) return null;
  return result;
}

export function transferDateIssueText(issue: TransferDateIssue, language: 'ko' | 'en'): string {
  const from = jdToTdbCalendar(issue.min), to = jdToTdbCalendar(issue.max);
  if (language === 'en') return `${issue.kind === 'departure' ? 'Departure' : 'Mars arrival'} must be between ${from} and ${to} (TDB).`;
  return `${issue.kind === 'departure' ? '출발' : '화성 도착'} 날짜는 ${from}~${to} 사이여야 합니다 (TDB).`;
}

/** Also formats strict save-parser diagnostics without relaxing or rewriting a save. */
export function calendarDateDiagnostic(message: string, language: 'ko' | 'en'): string {
  return message.replace(/(출발|도착) TDB 범위는 ([\d.]+)~([\d.]+)입니다\./g, (_whole, kind, min, max) =>
    transferDateIssueText({kind: kind === '출발' ? 'departure' : 'arrival', min: Number(min), max: Number(max), actual: NaN}, language));
}
