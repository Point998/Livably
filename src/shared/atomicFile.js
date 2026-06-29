const fs = require('fs');
const crypto = require('crypto');

// Write to a temp sibling then rename over the target. rename(2) is atomic on the same
// filesystem, so a reader never sees a torn file and a crash mid-write leaves the
// previous version intact. Sync sibling of services/reportStore.js atomicWrite(), for
// the best-effort synchronous error-memory writes.
function atomicWriteFileSync(filePath, data) {
  const tmp = `${filePath}.tmp.${crypto.randomBytes(4).toString('hex')}`;
  try {
    fs.writeFileSync(tmp, data, 'utf8');
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* temp may not exist; surface the original error */ }
    throw err;
  }
}

module.exports = { atomicWriteFileSync };
