// src/middleware/errorHandler.js

export const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // Handle known error shape
  if (err.status) {
    return res.status(err.status).json({
      error: {
        code: err.code || 'SERVER_ERROR',
        message: err.message || 'Something went wrong',
        field: err.field || null,
      },
    });
  }

  // Default error response
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Unexpected error occurred',
    },
  });
};
