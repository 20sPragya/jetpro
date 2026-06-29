'use strict';

// Local development entry point — Vercel uses api/index.js directly.
const app  = require('./api/index');
const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, () => {
  console.log(`\n  JetPro Media server → http://localhost:${PORT}\n`);
});
