'use strict';

const fs = require('fs');
const path = require('path');

class StructuredLogger {
  constructor(directory, maxBytes = 5 * 1024 * 1024) {
    this.directory = directory;
    this.maxBytes = maxBytes;
    fs.mkdirSync(directory, { recursive: true });
  }

  write(category, level, message, details = {}) {
    const file = path.join(this.directory, `${category}.jsonl`);
    if (fs.existsSync(file) && fs.statSync(file).size >= this.maxBytes) {
      const archived = path.join(this.directory, `${category}.1.jsonl`);
      if (fs.existsSync(archived)) fs.unlinkSync(archived);
      fs.renameSync(file, archived);
    }
    fs.appendFileSync(file, JSON.stringify({ timestamp: new Date().toISOString(), category, level, message, details }) + '\n');
  }
}

module.exports = { StructuredLogger };
