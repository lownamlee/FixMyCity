import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';

const EVENT = 'tracking-location';
const MAX_TOKEN_LIFETIME_SECONDS = 15 * 60;

export type TrackingCoordinate = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  recordedAt?: string;
};

export type TrackingUpdate = TrackingCoordinate & {
  caseId: string;
  recordedAt: string;
};

export type TrackingStatus =
  | 'connecting'
  | 'subscribed'
  | 'reconnecting'
  | 'closed'
  | 'error';

export interface PrivateTrackingOptions {
  supabaseUrl: string;
  publishableKey: string;
  /** Short-lived user JWT minted by a trusted server after case authorization. */
  accessToken: string;
  caseId: string;
  onUpdate: (update: TrackingUpdate) => void;
  onStatus?: (status: TrackingStatus, error?: Error) => void;
}

/**
 * Opens a private, case-scoped broadcast channel. The JWT is supplied by the
 * caller and must be issued by a trusted server that authorizes this case.
 * Private channel mode alone does not grant or enforce case membership; the
 * project's Realtime RLS policies must authorize this exact topic.
 */
export function openPrivateTracking(options: PrivateTrackingOptions): {
  publish: (coordinate: TrackingCoordinate) => Promise<void>;
  close: () => Promise<void>;
} {
  const { caseId, accessToken } = options;
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(caseId)) {
    throw new Error('Invalid case ID for a tracking channel.');
  }
  if (!options.supabaseUrl || !options.publishableKey.startsWith('sb_publishable_')) {
    throw new Error('A Supabase URL and publishable key are required.');
  }
  const expiresAt = getValidatedExpiry(accessToken);
  const topic = `case:${caseId}:tracking`;
  const client: SupabaseClient = createClient(options.supabaseUrl, options.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 2 } },
  });
  client.realtime.setAuth(accessToken);

  let closed = false;
  let subscribed = false;
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;
  const channel: RealtimeChannel = client.channel(topic, {
    config: { private: true, broadcast: { self: false, ack: true } },
  });

  channel.on('broadcast', { event: EVENT }, ({ payload }) => {
    const update = parseUpdate(payload, caseId);
    if (update) options.onUpdate(update);
  });

  options.onStatus?.('connecting');
  channel.subscribe((status, error) => {
    if (closed) return;
    if (status === 'SUBSCRIBED') {
      subscribed = true;
      options.onStatus?.('subscribed');
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      subscribed = false;
      options.onStatus?.('error', error instanceof Error ? error : new Error(status));
    } else if (status === 'CLOSED') {
      subscribed = false;
      options.onStatus?.('reconnecting');
    }
  });

  const expireInMs = Math.max(0, expiresAt * 1000 - Date.now());
  expiryTimer = setTimeout(() => {
    void close();
    options.onStatus?.('error', new Error('Tracking authorization expired.'));
  }, expireInMs);

  async function close(): Promise<void> {
    if (closed) return;
    closed = true;
    subscribed = false;
    if (expiryTimer) clearTimeout(expiryTimer);
    await client.removeChannel(channel);
    await client.auth.signOut({ scope: 'local' });
    options.onStatus?.('closed');
  }

  return {
    async publish(coordinate) {
      if (closed || !subscribed) throw new Error('Tracking channel is not connected.');
      const valid = validateCoordinate(coordinate);
      const update: TrackingUpdate = {
        ...valid,
        caseId,
        recordedAt: valid.recordedAt ?? new Date().toISOString(),
      };
      const result = await channel.send({ type: 'broadcast', event: EVENT, payload: update });
      if (result !== 'ok') throw new Error(`Tracking broadcast failed: ${result}`);
    },
    close,
  };
}

function validateCoordinate(value: TrackingCoordinate): TrackingCoordinate {
  if (!Number.isFinite(value.latitude) || value.latitude < -90 || value.latitude > 90) {
    throw new Error('Latitude must be a finite number between -90 and 90.');
  }
  if (!Number.isFinite(value.longitude) || value.longitude < -180 || value.longitude > 180) {
    throw new Error('Longitude must be a finite number between -180 and 180.');
  }
  if (value.accuracy !== undefined && (!Number.isFinite(value.accuracy) || value.accuracy < 0)) {
    throw new Error('Accuracy must be a finite non-negative number.');
  }
  const recordedAt = value.recordedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(recordedAt))) throw new Error('recordedAt must be a valid date.');
  return { latitude: value.latitude, longitude: value.longitude, accuracy: value.accuracy, recordedAt };
}

function parseUpdate(payload: unknown, caseId: string): TrackingUpdate | null {
  if (!payload || typeof payload !== 'object') return null;
  const candidate = payload as Partial<TrackingUpdate>;
  if (candidate.caseId !== caseId || typeof candidate.recordedAt !== 'string') return null;
  try {
    const coordinate = validateCoordinate(candidate as TrackingCoordinate);
    return { ...coordinate, caseId, recordedAt: coordinate.recordedAt! };
  } catch {
    return null;
  }
}

function getValidatedExpiry(jwt: string): number {
  const parts = jwt.split('.');
  if (parts.length !== 3) throw new Error('A valid short-lived user JWT is required.');
  try {
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='))) as { exp?: unknown };
    const exp = claims.exp;
    const now = Math.floor(Date.now() / 1000);
    if (typeof exp !== 'number' || !Number.isFinite(exp) || exp <= now || exp - now > MAX_TOKEN_LIFETIME_SECONDS) {
      throw new Error('Tracking JWT must be valid and expire within 15 minutes.');
    }
    return exp;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Tracking JWT')) throw error;
    throw new Error('Could not read the tracking JWT expiry.');
  }
}
