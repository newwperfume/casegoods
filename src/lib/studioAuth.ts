import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { studioSecurity } from '../db/schema.ts';

const PASSCODE_ROW_KEY = 'owner_passcode';
const STUDIO_TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 5;

// Session HMAC signing key: reads process.env.STUDIO_SESSION_SECRET with
// a cryptographically strong ephemeral random fallback in memory.
const SESSION_SIGNING_KEY =
  process.env.STUDIO_SESSION_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

// In-memory fallback hash cache ONLY used if Cloud SQL is temporarily unreachable
let memoryClaimedHash: string | null = null;

// Track revoked token IDs (jti -> exp timestamp) so explicit lock/signout immediately invalidates tokens
const revokedTokens = new Map<string, number>();

// Sliding-window failed attempt tracker keyed by owner UID
const failedAttempts = new Map<string, number[]>();

export type StudioPasscodeMode = 'env' | 'claimed' | 'unclaimed';

export interface StudioTokenPayload {
  uid: string;
  email: string;
  jti: string;
  iat: number;
  exp: number;
}

function getEnvStudioPasscode(): string | null {
  const raw = process.env.STUDIO_PASSCODE?.trim();
  return raw && raw.length > 0 ? raw : null;
}

function hashPasscodeScrypt(passcode: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passcode, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyScryptHash(candidate: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const derived = crypto.scryptSync(candidate, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function verifyConstantTimeString(candidate: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(candidate, 'utf8').digest();
  const b = crypto.createHash('sha256').update(expected, 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
}

async function readClaimedPasscodeHash(): Promise<string | null> {
  try {
    const rows = await db
      .select({ passcodeHash: studioSecurity.passcodeHash })
      .from(studioSecurity)
      .where(eq(studioSecurity.key, PASSCODE_ROW_KEY))
      .limit(1);
    if (rows[0]?.passcodeHash) {
      memoryClaimedHash = rows[0].passcodeHash;
      return rows[0].passcodeHash;
    }
    return memoryClaimedHash;
  } catch (err) {
    console.warn('Unable to query studio_security table, checking memory cache:', err);
    return memoryClaimedHash;
  }
}

export async function getStudioPasscodeMode(): Promise<StudioPasscodeMode> {
  if (getEnvStudioPasscode()) {
    return 'env';
  }
  const claimedHash = await readClaimedPasscodeHash();
  return claimedHash ? 'claimed' : 'unclaimed';
}

export function validateNewPasscodeInput(passcode: unknown): string | null {
  if (typeof passcode !== 'string') {
    return 'Passcode must be a text string.';
  }
  const trimmed = passcode.trim();
  if (trimmed.length < 6) {
    return 'Passcode must be at least 6 characters long.';
  }
  if (trimmed.length > 128) {
    return 'Passcode must be 128 characters or fewer.';
  }
  return null;
}

/**
 * Atomic one-time first-run passcode setup.
 * Fails with conflict if STUDIO_PASSCODE is configured in env or if a passcode was already claimed.
 */
export async function claimFirstRunStudioPasscode(
  passcode: string,
  ownerEmail: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (getEnvStudioPasscode()) {
    return {
      ok: false,
      status: 409,
      error: 'Studio passcode is already configured via server environment secrets.',
    };
  }

  const validationError = validateNewPasscodeInput(passcode);
  if (validationError) {
    return { ok: false, status: 400, error: validationError };
  }

  const existing = await readClaimedPasscodeHash();
  if (existing) {
    return {
      ok: false,
      status: 409,
      error: 'A studio passcode has already been claimed. Enter your passcode to unlock.',
    };
  }

  const hashed = hashPasscodeScrypt(passcode.trim());

  try {
    const inserted = await db
      .insert(studioSecurity)
      .values({
        key: PASSCODE_ROW_KEY,
        passcodeHash: hashed,
        updatedBy: ownerEmail.toLowerCase(),
      })
      .onConflictDoNothing({ target: studioSecurity.key })
      .returning({ id: studioSecurity.id });

    if (!inserted.length) {
      return {
        ok: false,
        status: 409,
        error: 'A studio passcode has already been claimed. Enter your passcode to unlock.',
      };
    }

    memoryClaimedHash = hashed;
    return { ok: true };
  } catch (err) {
    console.warn('Cloud SQL unavailable while saving studio passcode hash, storing in memory:', err);
    if (memoryClaimedHash) {
      return {
        ok: false,
        status: 409,
        error: 'A studio passcode has already been claimed.',
      };
    }
    memoryClaimedHash = hashed;
    return { ok: true };
  }
}

export function checkStudioRateLimit(uid: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const recent = (failedAttempts.get(uid) || []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );
  if (recent.length === 0) {
    failedAttempts.delete(uid);
  } else {
    failedAttempts.set(uid, recent);
  }

  if (recent.length >= RATE_LIMIT_MAX_ATTEMPTS) {
    const oldest = recent[0];
    const retryAfterMs = Math.max(1000, RATE_LIMIT_WINDOW_MS - (now - oldest));
    return { allowed: false, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailedStudioAttempt(uid: string): void {
  const now = Date.now();
  const recent = (failedAttempts.get(uid) || []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );
  recent.push(now);
  failedAttempts.set(uid, recent);
}

export function clearStudioRateLimit(uid: string): void {
  failedAttempts.delete(uid);
}

export async function verifySubmittedStudioPasscode(
  candidate: string
): Promise<{ ok: boolean; mode: StudioPasscodeMode }> {
  const trimmed = typeof candidate === 'string' ? candidate.trim() : '';
  if (!trimmed) {
    const mode = await getStudioPasscodeMode();
    return { ok: false, mode };
  }

  // Configured process.env.STUDIO_PASSCODE always takes precedence
  const envPasscode = getEnvStudioPasscode();
  if (envPasscode) {
    return { ok: verifyConstantTimeString(trimmed, envPasscode), mode: 'env' };
  }

  const claimedHash = await readClaimedPasscodeHash();
  if (!claimedHash) {
    return { ok: false, mode: 'unclaimed' };
  }

  return { ok: verifyScryptHash(trimmed, claimedHash), mode: 'claimed' };
}

function signPayloadB64(payloadB64: string): string {
  return crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(payloadB64, 'utf8')
    .digest('base64url');
}

function pruneRevokedTokens() {
  const now = Date.now();
  for (const [jti, exp] of revokedTokens.entries()) {
    if (exp <= now) {
      revokedTokens.delete(jti);
    }
  }
}

export function issueStudioUnlockToken(uid: string, email: string): {
  token: string;
  expiresAt: number;
} {
  pruneRevokedTokens();
  const now = Date.now();
  const exp = now + STUDIO_TOKEN_TTL_MS;
  const payload: StudioTokenPayload = {
    uid,
    email: email.toLowerCase(),
    jti: crypto.randomBytes(16).toString('hex'),
    iat: now,
    exp,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = signPayloadB64(payloadB64);
  return {
    token: `${payloadB64}.${signature}`,
    expiresAt: exp,
  };
}

export function verifyStudioUnlockToken(
  token: string | undefined,
  expectedUid: string,
  expectedEmail: string
): StudioTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;

  const expectedSig = signPayloadB64(payloadB64);
  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as StudioTokenPayload;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.exp !== 'number' || parsed.exp <= Date.now()) return null;
    if (parsed.uid !== expectedUid) return null;
    if (parsed.email !== expectedEmail.toLowerCase()) return null;
    if (!parsed.jti || revokedTokens.has(parsed.jti)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function revokeStudioUnlockToken(
  token: string | undefined,
  expectedUid: string,
  expectedEmail: string
): void {
  const payload = verifyStudioUnlockToken(token, expectedUid, expectedEmail);
  if (payload) {
    revokedTokens.set(payload.jti, payload.exp);
    pruneRevokedTokens();
  }
}
