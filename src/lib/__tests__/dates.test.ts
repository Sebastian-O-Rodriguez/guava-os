import { describe, it, expect } from "vitest";
import { normalizeDate, getWeekStart, getWeekEnd } from "../dates";

// Helper: build a local-time date (matches how normalizeDate reads dates via getFullYear/getMonth/getDate)
function local(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

// Helper: expected UTC midnight ISO string for a given calendar date
function utcMidnight(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

describe("normalizeDate", () => {
  it("strips time and returns midnight UTC for the calendar date", () => {
    const input = new Date(2025, 2, 15, 14, 30, 59, 999);
    const result = normalizeDate(input);
    expect(result.toISOString()).toBe(utcMidnight(2025, 3, 15));
  });

  it("handles the last day of a month", () => {
    const result = normalizeDate(local(2025, 1, 31));
    expect(result.toISOString()).toBe(utcMidnight(2025, 1, 31));
  });

  it("handles a year boundary (Dec 31)", () => {
    const result = normalizeDate(local(2024, 12, 31));
    expect(result.toISOString()).toBe(utcMidnight(2024, 12, 31));
  });

  it("handles a year boundary (Jan 1)", () => {
    const result = normalizeDate(local(2025, 1, 1));
    expect(result.toISOString()).toBe(utcMidnight(2025, 1, 1));
  });
});

describe("getWeekStart", () => {
  it("returns Monday for a Wednesday input", () => {
    // 2025-03-12 is Wednesday
    const result = getWeekStart(local(2025, 3, 12));
    expect(result.toISOString()).toBe(utcMidnight(2025, 3, 10));
  });

  it("returns the same day for a Monday input", () => {
    // 2025-03-10 is Monday
    const result = getWeekStart(local(2025, 3, 10));
    expect(result.toISOString()).toBe(utcMidnight(2025, 3, 10));
  });

  it("returns the previous Monday for a Sunday input", () => {
    // 2025-03-16 is Sunday
    const result = getWeekStart(local(2025, 3, 16));
    expect(result.toISOString()).toBe(utcMidnight(2025, 3, 10));
  });

  it("crosses a month boundary correctly", () => {
    // 2025-03-01 is Saturday — Monday should be 2025-02-24
    const result = getWeekStart(local(2025, 3, 1));
    expect(result.toISOString()).toBe(utcMidnight(2025, 2, 24));
  });

  it("crosses a year boundary correctly", () => {
    // 2025-01-01 is Wednesday — Monday should be 2024-12-30
    const result = getWeekStart(local(2025, 1, 1));
    expect(result.toISOString()).toBe(utcMidnight(2024, 12, 30));
  });
});

describe("getWeekEnd", () => {
  it("returns Sunday for a Wednesday input", () => {
    // 2025-03-12 is Wednesday — Sunday is 2025-03-16
    const result = getWeekEnd(local(2025, 3, 12));
    expect(result.toISOString()).toBe(utcMidnight(2025, 3, 16));
  });

  it("returns the same day for a Sunday input", () => {
    // 2025-03-16 is Sunday
    const result = getWeekEnd(local(2025, 3, 16));
    expect(result.toISOString()).toBe(utcMidnight(2025, 3, 16));
  });

  it("returns Sunday 6 days after Monday", () => {
    // 2025-03-10 is Monday — Sunday should be 2025-03-16
    const result = getWeekEnd(local(2025, 3, 10));
    expect(result.toISOString()).toBe(utcMidnight(2025, 3, 16));
  });

  it("week start and end span exactly 6 days", () => {
    const start = getWeekStart(local(2025, 3, 12));
    const end = getWeekEnd(local(2025, 3, 12));
    const diffDays = (end.getTime() - start.getTime()) / 86_400_000;
    expect(diffDays).toBe(6);
  });

  it("crosses a year boundary correctly", () => {
    // 2024-12-30 is Monday — end of week is 2025-01-05
    const result = getWeekEnd(local(2024, 12, 30));
    expect(result.toISOString()).toBe(utcMidnight(2025, 1, 5));
  });
});
