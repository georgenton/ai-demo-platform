// Tests del helper formatRelative.
//
// Mockeamos `Date.now` con vi.useFakeTimers para hacer asserts deterministicos.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatRelative } from './format';

const NOW = new Date('2026-05-27T10:00:00Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('formatRelative', () => {
  it('< 60 s → "hace unos segundos" / "a few seconds ago"', () => {
    const date = new Date(NOW - 30 * 1000); // 30 s atrás
    expect(formatRelative(date, 'es')).toBe('hace unos segundos');
    expect(formatRelative(date, 'en')).toBe('a few seconds ago');
  });

  it('< 1 h → "hace N min" / "N min ago"', () => {
    const date = new Date(NOW - 5 * 60 * 1000);
    expect(formatRelative(date, 'es')).toBe('hace 5 min');
    expect(formatRelative(date, 'en')).toBe('5 min ago');
  });

  it('< 1 día → "hace N h" / "Nh ago"', () => {
    const date = new Date(NOW - 3 * 3600 * 1000);
    expect(formatRelative(date, 'es')).toBe('hace 3 h');
    expect(formatRelative(date, 'en')).toBe('3h ago');
  });

  it('≥ 1 día → "hace N días" / "N days ago"', () => {
    const date = new Date(NOW - 2 * 86400 * 1000);
    expect(formatRelative(date, 'es')).toBe('hace 2 días');
    expect(formatRelative(date, 'en')).toBe('2 days ago');
  });

  it('acepta ISO string y number también', () => {
    const iso = new Date(NOW - 60 * 1000).toISOString();
    expect(formatRelative(iso, 'es')).toBe('hace 1 min');
    expect(formatRelative(NOW - 120 * 1000, 'es')).toBe('hace 2 min');
  });
});
