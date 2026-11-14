#!/usr/bin/env node
/* Zero-dependency static server for local play.  Usage: node tools/serve.cjs [port]   (default 8765) */
const http = require('http'), path = require('path');
const staticFiles = require('./static-files.cjs');
const root = path.resolve(__dirname, '..'), PORT = +(process.argv[2] || process.env.PORT || 8765);
http.createServer(staticFiles(root))
  .on('error', error => { console.error(error.message); process.exitCode = 1; })
  .listen(PORT, '127.0.0.1', () => console.log(`火星前哨 running at http://127.0.0.1:${PORT}/   (Ctrl+C to stop)`));
