export type AuthErrorCode =
  | "VALIDATION_FAILED"
  | "DUPLICATE_EMAIL"
  | "DUPLICATE_USERNAME"
  | "INVALID_CREDENTIALS"
  | "UNAUTHORIZED";

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function isAuthError(value: unknown): value is AuthError {
  return value instanceof AuthError;
}
