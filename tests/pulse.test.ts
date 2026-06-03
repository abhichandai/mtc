/**
 * MTC Frontend Unit Tests
 *
 * Tests the critical lib/ utilities that power caching and data integrity.
 * briefHash is especially important — if it produces different hashes for
 * the same input, the relevance cache breaks silently.
 *
 * Run: cd mtc-fresh && npx vitest run
 */

import { describe, it, expect } from 'vitest';
import { briefHash } from '@/lib/pulse';

// ═══════════════════════════════════════════════════════════════════════════════
// briefHash — cache key for Pulse relevance scoring
// ═══════════════════════════════════════════════════════════════════════════════

describe('briefHash', () => {
  // ── Determinism ──────────────────────────────────────────────────────────
  it('produces the same hash for identical inputs', () => {
    const a = briefHash('fitness creators aged 20-35', ['youtube', 'tiktok'], 'long_form', ['educational', 'hot_takes']);
    const b = briefHash('fitness creators aged 20-35', ['youtube', 'tiktok'], 'long_form', ['educational', 'hot_takes']);
    expect(a).toBe(b);
  });

  it('is a 16-character hex string', () => {
    const hash = briefHash('test', ['youtube'], 'short_form', ['storytelling']);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  // ── Order independence (the key property) ────────────────────────────────
  it('produces the same hash regardless of platform order', () => {
    const a = briefHash('test', ['youtube', 'tiktok', 'instagram'], 'long_form', ['educational']);
    const b = briefHash('test', ['instagram', 'youtube', 'tiktok'], 'long_form', ['educational']);
    expect(a).toBe(b);
  });

  it('produces the same hash regardless of style order', () => {
    const a = briefHash('test', ['youtube'], 'long_form', ['hot_takes', 'educational', 'storytelling']);
    const b = briefHash('test', ['youtube'], 'long_form', ['storytelling', 'hot_takes', 'educational']);
    expect(a).toBe(b);
  });

  it('produces the same hash when both platforms and styles are reordered', () => {
    const a = briefHash('test', ['tiktok', 'youtube'], 'short_form', ['reaction', 'educational']);
    const b = briefHash('test', ['youtube', 'tiktok'], 'short_form', ['educational', 'reaction']);
    expect(a).toBe(b);
  });

  // ── Different inputs produce different hashes ────────────────────────────
  it('produces different hashes for different briefs', () => {
    const a = briefHash('fitness creators', ['youtube'], 'long_form', ['educational']);
    const b = briefHash('cooking enthusiasts', ['youtube'], 'long_form', ['educational']);
    expect(a).not.toBe(b);
  });

  it('produces different hashes for different platforms', () => {
    const a = briefHash('test', ['youtube'], 'long_form', ['educational']);
    const b = briefHash('test', ['tiktok'], 'long_form', ['educational']);
    expect(a).not.toBe(b);
  });

  it('produces different hashes for different formats', () => {
    const a = briefHash('test', ['youtube'], 'long_form', ['educational']);
    const b = briefHash('test', ['youtube'], 'short_form', ['educational']);
    expect(a).not.toBe(b);
  });

  it('produces different hashes for different styles', () => {
    const a = briefHash('test', ['youtube'], 'long_form', ['educational']);
    const b = briefHash('test', ['youtube'], 'long_form', ['hot_takes']);
    expect(a).not.toBe(b);
  });

  // ── Whitespace trimming ──────────────────────────────────────────────────
  it('trims whitespace from the brief', () => {
    const a = briefHash('test brief', ['youtube'], 'long_form', ['educational']);
    const b = briefHash('  test brief  ', ['youtube'], 'long_form', ['educational']);
    expect(a).toBe(b);
  });

  // ── Edge cases / defensive handling ──────────────────────────────────────
  it('handles empty brief', () => {
    const hash = briefHash('', ['youtube'], 'long_form', ['educational']);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('handles empty arrays', () => {
    const hash = briefHash('test', [], '', []);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('handles null-like inputs gracefully', () => {
    // These mimic what happens when profile data is missing
    const hash = briefHash('', [], '', []);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('empty brief differs from a real brief', () => {
    const empty = briefHash('', ['youtube'], 'long_form', ['educational']);
    const real = briefHash('fitness creators', ['youtube'], 'long_form', ['educational']);
    expect(empty).not.toBe(real);
  });

  // ── Consistency with known behavior ──────────────────────────────────────
  it('adding a platform changes the hash', () => {
    const without = briefHash('test', ['youtube'], 'long_form', ['educational']);
    const withExtra = briefHash('test', ['youtube', 'tiktok'], 'long_form', ['educational']);
    expect(without).not.toBe(withExtra);
  });

  it('adding a style changes the hash', () => {
    const without = briefHash('test', ['youtube'], 'long_form', ['educational']);
    const withExtra = briefHash('test', ['youtube'], 'long_form', ['educational', 'hot_takes']);
    expect(without).not.toBe(withExtra);
  });
});
