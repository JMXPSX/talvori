/**
 * Minimal logging abstraction.
 *
 * Phase 1 goal (see 09_PHASE_1_CLAUDE_BUILD_PROMPT.md §K): a single seam that a
 * crash/observability provider (Sentry, Datadog, etc.) can be wired into later
 * WITHOUT touching call sites.
 *
 * HARD RULE: never log secrets, passwords, OTPs, tokens, or raw financial data.
 * Callers pass a short message plus an optional context object; `redact()`
 * strips well-known sensitive keys as a defensive backstop.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Record<string, unknown>;

/** Keys whose values are scrubbed before anything is emitted. */
const SENSITIVE_KEYS = [
  'password',
  'pass',
  'otp',
  'code',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'anon_key',
  'service_role',
  'pin',
  'cvv',
];

const REDACTED = '[redacted]';

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_KEYS.some((s) => k.includes(s));
}

/** Recursively replace sensitive values. Shallow-safe against cycles. */
function redact(value: unknown, seen = new Set<unknown>()): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) return value.map((v) => redact(v, seen));

  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isSensitiveKey(key) ? REDACTED : redact(v, seen);
  }
  return out;
}

/** A sink receives already-redacted records. Swap/extend for production. */
export interface LogSink {
  (level: LogLevel, message: string, context?: LogContext): void;
}

const consoleSink: LogSink = (level, message, context) => {
  // eslint-disable-next-line no-console
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (context) fn(`[${level}] ${message}`, context);
  else fn(`[${level}] ${message}`);
};

let sink: LogSink = consoleSink;

/** Replace the sink (e.g. forward to Sentry) at app bootstrap. */
export function setLogSink(next: LogSink): void {
  sink = next;
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  const safe = context ? (redact(context) as LogContext) : undefined;
  sink(level, message, safe);
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit('debug', message, context),
  info: (message: string, context?: LogContext) => emit('info', message, context),
  warn: (message: string, context?: LogContext) => emit('warn', message, context),
  error: (message: string, context?: LogContext) => emit('error', message, context),
};
