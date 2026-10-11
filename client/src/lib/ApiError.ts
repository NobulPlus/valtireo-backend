export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]> | null;

  constructor(message: string, status: number, errors: Record<string, string[]> | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }

  /** First validation message for a given field, if any. */
  fieldError(field: string): string | undefined {
    return this.errors?.[field]?.[0];
  }
}
