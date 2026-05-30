import crypto from 'crypto';

/**
 * Stable hash of the creator context that drives Pulse relevance scoring.
 * Both /api/pulse-feed (read cache) and /api/pulse-relevance (write cache)
 * compute this identically — equal hashes mean the cache row is still valid
 * for the current brief, sorted arrays normalize platform/style ordering so
 * reordering doesn't invalidate the cache.
 */
export function briefHash(
  brief: string,
  platforms: string[],
  format: string,
  styles: string[]
): string {
  const normalized = JSON.stringify({
    brief: (brief || '').trim(),
    platforms: [...(platforms || [])].sort(),
    format: format || '',
    styles: [...(styles || [])].sort(),
  });
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}
