const fs = require('node:fs'), path = require('node:path');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.cjs': 'text/javascript', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };

module.exports = function staticFiles(root) {
  root = fs.realpathSync(root);
  const outside = file => {
    const relative = path.relative(root, file);
    return relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative);
  };
  return (req, res) => {
    let requested;
    try {
      requested = decodeURIComponent(req.url.split('?')[0]).replace(/\\/g, '/');
      if (requested.includes('\0')) throw new URIError('invalid path');
    }
    catch { res.writeHead(400); return res.end('invalid URL'); }
    if (requested.endsWith('/')) requested += 'index.html';
    const file = path.resolve(path.join(root, requested));
    if (outside(file)) { res.writeHead(403); return res.end(); }
    fs.realpath(file, (error, canonical) => {
      if (error) { res.writeHead(404); return res.end('not found'); }
      if (outside(canonical)) { res.writeHead(403); return res.end(); }
      fs.readFile(canonical, (error, data) => {
        if (error) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'content-type': MIME[path.extname(canonical).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' });
        res.end(data);
      });
    });
  };
};
