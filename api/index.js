'use strict';

// Vercel serverless entry point — just re-exports the Express app.
// Vercel calls this file as a handler for all /api/* requests.
module.exports = require('../server');
