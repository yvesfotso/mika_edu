export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** The request never reached the server (offline, timeout, DNS…). Safe to retry later. */
export class NetworkError extends Error {
  constructor() {
    super("No connection");
  }
}
