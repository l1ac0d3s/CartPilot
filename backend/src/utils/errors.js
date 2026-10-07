class AppError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code || defaultCode(status);
    this.details = details;
  }
}

function defaultCode(status) {
  return (
    {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE',
      503: 'SERVICE_UNAVAILABLE',
    }[status] || 'ERROR'
  );
}

const badRequest = (message, opts) => new AppError(400, message, opts);
const unauthorized = (message = 'Authentication required', opts) => new AppError(401, message, opts);
const forbidden = (message = 'You do not have access to this resource', opts) => new AppError(403, message, opts);
const notFound = (message = 'Resource not found', opts) => new AppError(404, message, opts);
const conflict = (message, opts) => new AppError(409, message, opts);
const serviceUnavailable = (message, opts) => new AppError(503, message, opts);

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict, serviceUnavailable };
