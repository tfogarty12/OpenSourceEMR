/** Authentication failed or was absent (-> HTTP 401). */
export class AuthnError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthnError';
  }
}

/** Authenticated but not permitted (-> HTTP 403). */
export class AuthzError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'AuthzError';
  }
}
