import {describe, expect, it} from 'vitest';
import {calendarDateDiagnostic, repairTransferDates, transferDateBounds, transferDateIssue, transferDateIssueText} from '../src/transfer/date-window';
import {createTransferPlan, validateTransferPlan} from '../src/transfer/planning';
import {EPHEMERIS_END_JD_TDB, EPHEMERIS_START_JD_TDB, tdbCalendarToJd} from '../src/transfer/ephemeris';

describe('M03 supported dates and explicit recovery', () => {
  it('identifies the reported 80-day route before submitting an impossible retry', () => {
    const plan = createTransferPlan();
    const shift = (80 - 260) * 86400;
    plan.arrivalPeriapsisJdTdb = tdbCalendarToJd('2027-02-03');
    plan.operations = plan.operations.map(op => ({...op, start: op.start + shift, end: op.end + shift}));
    const before = structuredClone(plan);
    const issue = transferDateIssue(plan)!;
    expect(issue.kind).toBe('arrival');
    expect(transferDateIssueText(issue, 'ko')).toContain('2027-03-15~2028-02-08');
    expect(transferDateIssueText(issue, 'en')).not.toMatch(/246\d{4}/);
    const repair = repairTransferDates(plan)!;
    expect(repair.arrivalPeriapsisJdTdb).toBe(tdbCalendarToJd('2027-03-15'));
    expect(repair.departurePeriapsisJdTdb).toBe(plan.departurePeriapsisJdTdb);
    expect(() => validateTransferPlan(repair)).not.toThrow();
    expect(plan).toEqual(before);
    const oldPeri = 80 * 86400, newPeri = 120 * 86400;
    for (let i = 0; i < plan.operations.length; i++) {
      expect(repair.operations[i]).toEqual({...plan.operations[i], start: plan.operations[i].start + newPeri - oldPeri, end: plan.operations[i].end + newPeri - oldPeri});
      expect(repair.operations[i].start - newPeri).toBe(plan.operations[i].start - oldPeri);
    }
    expect({...repair, arrivalPeriapsisJdTdb: plan.arrivalPeriapsisJdTdb, operations: plan.operations}).toEqual(plan);
  });

  it('never changes a valid existing route, fractional date or custom schedule', () => {
    const plan = createTransferPlan('science');
    plan.departurePeriapsisJdTdb += 0.25;
    plan.arrivalPeriapsisJdTdb += 0.25;
    plan.operations[0].start += 120;
    const before = structuredClone(plan);
    expect(transferDateIssue(plan)).toBeNull();
    expect(repairTransferDates(plan)).toBeNull();
    expect(plan).toEqual(before);
  });

  it('supports exactly the same endpoint limits as the existing strict validator', () => {
    for (const departure of [EPHEMERIS_START_JD_TDB, tdbCalendarToJd('2026-11-15'), EPHEMERIS_END_JD_TDB - 125]) {
      const bounds = transferDateBounds(departure);
      for (const arrival of [bounds.arrival.min, bounds.arrival.max]) {
        const plan = {...createTransferPlan(), departurePeriapsisJdTdb: departure, arrivalPeriapsisJdTdb: arrival, operations: []};
        expect(transferDateIssue(plan)).toBeNull();
        expect(() => validateTransferPlan(plan)).not.toThrow();
        const invalid = {...plan, arrivalPeriapsisJdTdb: arrival === bounds.arrival.min ? arrival - 0.001 : arrival + 0.001};
        expect(transferDateIssue(invalid)?.kind).toBe('arrival');
        expect(() => validateTransferPlan(invalid)).toThrow();
      }
    }
  });

  it('proposes an in-range departure and intact encounter-relative timing for old drafts', () => {
    const plan = createTransferPlan();
    plan.departurePeriapsisJdTdb = EPHEMERIS_START_JD_TDB - 20;
    plan.arrivalPeriapsisJdTdb = plan.departurePeriapsisJdTdb + 260;
    const repair = repairTransferDates(plan)!;
    expect(repair.departurePeriapsisJdTdb).toBe(EPHEMERIS_START_JD_TDB);
    expect(repair.arrivalPeriapsisJdTdb - repair.departurePeriapsisJdTdb).toBe(260);
    expect(repair.operations).toEqual(plan.operations);
    expect(() => validateTransferPlan(repair)).not.toThrow();
  });

  it('does not destroy a custom early operation when moving an overlong mission earlier', () => {
    const plan = createTransferPlan();
    plan.arrivalPeriapsisJdTdb = plan.departurePeriapsisJdTdb + 480;
    plan.operations = [{id: 'early', kind: 'charge', start: 10, end: 30}];
    const before = structuredClone(plan);
    expect(transferDateIssue(plan)?.kind).toBe('arrival');
    expect(repairTransferDates(plan)).toBeNull();
    expect(plan).toEqual(before);
  });

  it('rejects corrupt timestamps without manufacturing an arbitrary replacement', () => {
    for (const invalid of [NaN, Infinity, -Infinity]) {
      const plan = {...createTransferPlan(), departurePeriapsisJdTdb: invalid};
      expect(transferDateIssue(plan)?.kind).toBe('departure');
      expect(repairTransferDates(plan)).toBeNull();
    }
  });

  it('presents rejected save-parser dates as calendar dates while retaining other diagnostics', () => {
    const raw = '전이 저장 오류: 도착 TDB 범위는 2461479.5~2461809.5입니다.';
    expect(calendarDateDiagnostic(raw, 'ko')).toBe('전이 저장 오류: 화성 도착 날짜는 2027-03-15~2028-02-08 사이여야 합니다 (TDB).');
    expect(calendarDateDiagnostic(raw, 'en')).toContain('Mars arrival must be between 2027-03-15 and 2028-02-08 (TDB).');
    expect(calendarDateDiagnostic('작업 시간이 겹칩니다.', 'ko')).toBe('작업 시간이 겹칩니다.');
  });
});
