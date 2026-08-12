/**
 * Central error model (see 09_PHASE_1_CLAUDE_BUILD_PROMPT.md §J).
 *
 * Goal: one consistent shape for errors so the UI can present a safe,
 * localizable message while engineering keeps the technical detail. Never
 * surface raw provider/database errors directly to the user.
 */

import { logger } from '@/lib/logger';

/** Stable, machine-readable error codes the UI can map to localized copy. */
export type AppErrorCode =
  | 'unknown'
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'rate_limited'
  | 'config';

export interface AppErrorOptions {
  /** i18n key used to render a user-facing message, e.g. 'errors.network'. */
  messageKey?: string;
  /** The underlying error, preserved for logging (never shown to the user). */
  cause?: unknown;
  /** Non-sensitive structured context for logging. */
  context?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly messageKey: string;
  readonly context?: Record<string, unknown>;

  constructor(code: AppErrorCode, options: AppErrorOptions = {}) {
    super(options.messageKey ?? code, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.messageKey = options.messageKey ?? `errors.${code}`;
    this.context = options.context;
  }
}

/** Coerce any thrown value into an AppError without leaking internals. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  return new AppError('unknown', { cause: err });
}

/**
 * Log an error safely and return the AppError. Use at boundaries (screens,
 * service calls) so presentation code only deals with AppError + messageKey.
 */
export function handleError(err: unknown, message = 'Unhandled error'): AppError {
  const appError = toAppError(err);
  logger.error(message, {
    code: appError.code,
    messageKey: appError.messageKey,
    context: appError.context,
  });
  return appError;
}
