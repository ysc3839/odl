exports.FileNotFoundError = class FileNotFoundError extends Error {
  constructor(...args) {
    super(...args);
    this.name = 'FileNotFoundError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FileNotFoundError);
    }
  }
};
