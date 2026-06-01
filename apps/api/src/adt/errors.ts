/**
 * A domain error from the ADT (admit/discharge/transfer) lifecycle.
 *
 * `code` is mapped to an HTTP status and a FHIR OperationOutcome issue code at
 * the API edge:
 *   - 'not-found'          -> 404
 *   - 'invalid-transition' -> 409 (the encounter is not in a state that allows this)
 *   - 'invalid'            -> 422 (the request itself is malformed)
 */
export type AdtErrorCode = 'not-found' | 'invalid-transition' | 'invalid';

export class AdtError extends Error {
  constructor(
    readonly code: AdtErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AdtError';
  }
}
