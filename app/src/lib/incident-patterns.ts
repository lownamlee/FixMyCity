/**
 * Deterministic detection of recurring public civic hazards from reviewed cases.
 *
 * This module is intentionally pure: it reads only the supplied snapshot, does
 * not retain state, and never dispatches or assigns response work.
 */

export type CivicIncidentCategory = string;

export interface ReviewedIncidentCase {
  /** Stable source identifier. */
  id: string;
  /** Must be true for the case to be considered. */
  reviewed: boolean;
  /** Closed duplicate records are ignored; canonical cases should be retained. */
  duplicateOf?: string | null;
  /** Normalized civic hazard category, for example "pothole" or "streetlight". */
  category: CivicIncidentCategory;
  /** ISO-8601 timestamp with an explicit timezone. */
  occurredAt: string;
  /** WGS84 coordinates in decimal degrees. */
  latitude: number;
  longitude: number;
}

export interface IncidentPatternOptions {
  /** Maximum great-circle distance between cases in a pattern, in metres. */
  radiusMetres?: number;
  /** Maximum age of an incident relative to `asOf`, in days. */
  lookbackDays?: number;
  /** Minimum number of distinct reviewed cases needed for an alert. */
  minimumCases?: number;
  /** Evaluation time. Defaults to the latest case timestamp, keeping snapshots deterministic. */
  asOf?: string;
}

export interface IncidentPattern {
  /** Stable identifier derived from category and sorted case identifiers. */
  id: string;
  category: CivicIncidentCategory;
  caseIds: string[];
  caseCount: number;
  firstOccurredAt: string;
  lastOccurredAt: string;
  /** Mean coordinate of the cases, with longitude wrap handled. */
  centroid: { latitude: number; longitude: number };
  /** Greatest pairwise distance in the pattern, in metres. */
  diameterMetres: number;
}

const EARTH_RADIUS_METRES = 6_371_008.8;
const DEFAULT_RADIUS_METRES = 250;
const DEFAULT_LOOKBACK_DAYS = 90;
const DEFAULT_MINIMUM_CASES = 3;
const MAX_LOOKBACK_DAYS = 3_650;
const MAX_RADIUS_METRES = 50_000;
const ISO_WITH_TIMEZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i;

interface ValidCase extends ReviewedIncidentCase {
  timestamp: number;
  normalizedCategory: string;
}

/**
 * Finds spatially compact, same-category clusters of reviewed incidents.
 *
 * Cases are first filtered to reviewed, non-duplicate records within the
 * lookback window. A deterministic complete-linkage merge then groups nearby
 * cases: every pair in an emitted pattern is within `radiusMetres`. This avoids
 * long chains of individually-near incidents producing a geographically broad
 * alert. Results and member IDs are sorted deterministically.
 *
 * Invalid options or malformed supplied cases throw `TypeError` or
 * `RangeError`; silently accepting bad coordinates or timestamps could create
 * misleading civic alerts.
 */
export function findRecurringIncidentPatterns(
  cases: readonly ReviewedIncidentCase[],
  options: IncidentPatternOptions = {},
): IncidentPattern[] {
  if (!Array.isArray(cases)) throw new TypeError('cases must be an array');

  const radiusMetres = options.radiusMetres ?? DEFAULT_RADIUS_METRES;
  const lookbackDays = options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const minimumCases = options.minimumCases ?? DEFAULT_MINIMUM_CASES;
  const asOfValue = options.asOf ?? (cases.length > 0
    ? cases.map((item, index) => parseTimestamp(item.occurredAt, `case ${index} occurredAt`)).reduce((latest, value) => Math.max(latest, value), Number.NEGATIVE_INFINITY)
    : '1970-01-01T00:00:00.000Z');

  if (!Number.isFinite(radiusMetres) || radiusMetres <= 0 || radiusMetres > MAX_RADIUS_METRES) {
    throw new RangeError(`radiusMetres must be greater than 0 and at most ${MAX_RADIUS_METRES}`);
  }
  if (!Number.isFinite(lookbackDays) || lookbackDays <= 0 || lookbackDays > MAX_LOOKBACK_DAYS) {
    throw new RangeError(`lookbackDays must be greater than 0 and at most ${MAX_LOOKBACK_DAYS}`);
  }
  if (!Number.isInteger(minimumCases) || minimumCases < 2) {
    throw new RangeError('minimumCases must be an integer of at least 2');
  }
  const asOf = parseTimestamp(asOfValue, 'asOf');
  const cutoff = asOf - lookbackDays * 24 * 60 * 60 * 1_000;

  const seenIds = new Set<string>();
  const valid: ValidCase[] = [];
  for (const item of cases) {
    if (!item || typeof item !== 'object') throw new TypeError('each case must be an object');
    if (typeof item.id !== 'string' || item.id.trim().length === 0) {
      throw new TypeError('each case id must be a non-empty string');
    }
    if (seenIds.has(item.id)) throw new RangeError(`duplicate case id: ${item.id}`);
    seenIds.add(item.id);
    if (typeof item.reviewed !== 'boolean') throw new TypeError(`case ${item.id}: reviewed must be boolean`);
    if (item.duplicateOf !== undefined && item.duplicateOf !== null && typeof item.duplicateOf !== 'string') {
      throw new TypeError(`case ${item.id}: duplicateOf must be a string, null, or undefined`);
    }
    if (typeof item.category !== 'string' || item.category.trim().length === 0) {
      throw new TypeError(`case ${item.id}: category must be a non-empty string`);
    }
    if (!Number.isFinite(item.latitude) || item.latitude < -90 || item.latitude > 90) {
      throw new RangeError(`case ${item.id}: latitude must be between -90 and 90`);
    }
    if (!Number.isFinite(item.longitude) || item.longitude < -180 || item.longitude > 180) {
      throw new RangeError(`case ${item.id}: longitude must be between -180 and 180`);
    }
    const timestamp = parseTimestamp(item.occurredAt, `case ${item.id} occurredAt`);
    if (!item.reviewed || item.duplicateOf || timestamp < cutoff || timestamp > asOf) continue;
    valid.push({ ...item, timestamp, normalizedCategory: item.category.trim().toLocaleLowerCase('en-US') });
  }

  const byCategory = new Map<string, ValidCase[]>();
  for (const item of valid) {
    const group = byCategory.get(item.normalizedCategory) ?? [];
    group.push(item);
    byCategory.set(item.normalizedCategory, group);
  }

  const patterns: IncidentPattern[] = [];
  for (const categoryCases of byCategory.values()) {
    categoryCases.sort(compareCases);
    let clusters: ValidCase[][] = categoryCases.map((item) => [item]);

    // Complete-linkage agglomeration. Pick the closest eligible pair each pass;
    // tie-break using sorted IDs so source ordering cannot affect the result.
    while (true) {
      let best: { left: number; right: number; distance: number; key: string } | undefined;
      for (let left = 0; left < clusters.length; left += 1) {
        for (let right = left + 1; right < clusters.length; right += 1) {
          const distance = completeLinkDistance(clusters[left], clusters[right]);
          if (distance > radiusMetres) continue;
          const key = `${clusterKey(clusters[left])}\u0000${clusterKey(clusters[right])}`;
          if (!best || distance < best.distance || (distance === best.distance && key < best.key)) {
            best = { left, right, distance, key };
          }
        }
      }
      if (!best) break;
      const merged = [...clusters[best.left], ...clusters[best.right]].sort(compareCases);
      clusters = clusters.filter((_, index) => index !== best!.left && index !== best!.right);
      clusters.push(merged);
      clusters.sort((a, b) => clusterKey(a).localeCompare(clusterKey(b)));
    }

    for (const cluster of clusters) {
      if (cluster.length < minimumCases) continue;
      const orderedIds = cluster.map((item) => item.id).sort((a, b) => a.localeCompare(b));
      const dates = [...cluster].sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
      patterns.push({
        id: `${cluster[0].normalizedCategory}:${orderedIds.map(encodeURIComponent).join(',')}`,
        category: cluster[0].category.trim(),
        caseIds: orderedIds,
        caseCount: orderedIds.length,
        firstOccurredAt: new Date(dates[0].timestamp).toISOString(),
        lastOccurredAt: new Date(dates[dates.length - 1].timestamp).toISOString(),
        centroid: centroid(cluster),
        diameterMetres: clusterDiameter(cluster),
      });
    }
  }

  return patterns.sort((a, b) => a.category.localeCompare(b.category) || a.caseIds.join('\u0000').localeCompare(b.caseIds.join('\u0000')));
}

function parseTimestamp(value: string, label: string): number {
  if (typeof value !== 'string' || !ISO_WITH_TIMEZONE.test(value)) {
    throw new TypeError(`${label} must be an ISO-8601 timestamp with timezone`);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new TypeError(`${label} is not a valid timestamp`);
  return timestamp;
}

function compareCases(a: ValidCase, b: ValidCase): number {
  return a.timestamp - b.timestamp || a.id.localeCompare(b.id);
}

function clusterKey(cluster: readonly ValidCase[]): string {
  return cluster.map((item) => item.id).sort((a, b) => a.localeCompare(b)).join('\u0000');
}

function completeLinkDistance(a: readonly ValidCase[], b: readonly ValidCase[]): number {
  let maximum = 0;
  for (const first of a) {
    for (const second of b) maximum = Math.max(maximum, distanceMetres(first, second));
  }
  return maximum;
}

function clusterDiameter(cluster: readonly ValidCase[]): number {
  let maximum = 0;
  for (let left = 0; left < cluster.length; left += 1) {
    for (let right = left + 1; right < cluster.length; right += 1) {
      maximum = Math.max(maximum, distanceMetres(cluster[left], cluster[right]));
    }
  }
  return maximum;
}

function distanceMetres(a: Pick<ValidCase, 'latitude' | 'longitude'>, b: Pick<ValidCase, 'latitude' | 'longitude'>): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = lat2 - lat1;
  const deltaLon = toRadians(((b.longitude - a.longitude + 540) % 360) - 180);
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

function centroid(cluster: readonly ValidCase[]): { latitude: number; longitude: number } {
  const latitude = cluster.reduce((sum, item) => sum + item.latitude, 0) / cluster.length;
  const longitudeSin = cluster.reduce((sum, item) => sum + Math.sin((item.longitude * Math.PI) / 180), 0);
  const longitudeCos = cluster.reduce((sum, item) => sum + Math.cos((item.longitude * Math.PI) / 180), 0);
  const longitude = Math.atan2(longitudeSin, longitudeCos) * (180 / Math.PI);
  return { latitude: roundCoordinate(latitude), longitude: roundCoordinate(longitude) };
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}


