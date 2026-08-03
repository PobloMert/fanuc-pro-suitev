'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

class DataStore {
  constructor(dbPath, jsonDir) {
    this.dbPath = dbPath;
    this.jsonDir = jsonDir;
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS documents(
        name TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS records(
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(collection,id)
      );
      CREATE TABLE IF NOT EXISTS telemetry_samples(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine TEXT NOT NULL,
        sampled_at TEXT NOT NULL,
        execution TEXT,
        program TEXT,
        part_count INTEGER,
        spindle_load REAL,
        data_age_ms INTEGER NOT NULL DEFAULT 0,
        quality TEXT NOT NULL DEFAULT 'good',
        simulated INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_telemetry_machine_time ON telemetry_samples(machine,sampled_at);
      CREATE TABLE IF NOT EXISTS alarm_events(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine TEXT NOT NULL,
        alarm_code TEXT NOT NULL,
        message TEXT,
        occurred_at TEXT NOT NULL,
        cleared_at TEXT,
        simulated INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  migrateJsonDirectory() {
    const files = fs.readdirSync(this.jsonDir).filter(name => name.endsWith('.json'));
    const insert = this.db.prepare(`INSERT OR IGNORE INTO documents(name,payload,version,updated_at) VALUES(?,?,1,?)`);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const name of files) {
        const payload = fs.readFileSync(path.join(this.jsonDir, name), 'utf8');
        JSON.parse(payload);
        insert.run(name, payload, new Date().toISOString());
        const parsed = JSON.parse(payload);
        const values = Array.isArray(parsed) ? parsed : Object.values(parsed).find(Array.isArray);
        if (Array.isArray(values)) {
          const collection = path.basename(name, '.json');
          const recordInsert = this.db.prepare('INSERT OR IGNORE INTO records(collection,id,payload,created_at,updated_at) VALUES(?,?,?,?,?)');
          values.forEach((record, index) => {
            const id = String(record.id ?? record.no ?? record.number ?? index);
            const now = new Date().toISOString();
            recordInsert.run(collection, id, JSON.stringify(record), now, now);
          });
        }
      }
      this.db.prepare('INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(1,?)').run(new Date().toISOString());
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  readDocument(name) {
    const row = this.db.prepare('SELECT payload FROM documents WHERE name=?').get(name);
    return row ? row.payload : null;
  }

  writeDocument(name, payload) {
    JSON.parse(payload);
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO documents(name,payload,version,updated_at) VALUES(?,?,1,?)
      ON CONFLICT(name) DO UPDATE SET payload=excluded.payload, version=documents.version+1, updated_at=excluded.updated_at
    `).run(name, payload, now);
    const target = path.join(this.jsonDir, name);
    const temp = `${target}.tmp`;
    fs.writeFileSync(temp, payload, 'utf8');
    fs.renameSync(temp, target);
  }

  status() {
    const row = this.db.prepare('SELECT COUNT(*) AS count, MAX(updated_at) AS latest FROM documents').get();
    return { engine: 'sqlite', path: this.dbPath, documents: Number(row.count), latestUpdate: row.latest };
  }

  listRecords(collection) {
    return this.db.prepare('SELECT payload FROM records WHERE collection=? ORDER BY updated_at DESC').all(collection).map(row => JSON.parse(row.payload));
  }

  upsertRecord(collection, id, record) {
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO records(collection,id,payload,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at`).run(collection, String(id), JSON.stringify(record), now, now);
  }

  deleteRecord(collection, id) { return this.db.prepare('DELETE FROM records WHERE collection=? AND id=?').run(collection, String(id)).changes > 0; }

  insertTelemetry(sample) {
    this.db.prepare(`INSERT INTO telemetry_samples(machine,sampled_at,execution,program,part_count,spindle_load,data_age_ms,quality,simulated) VALUES(?,?,?,?,?,?,?,?,?)`).run(
      String(sample.machine), sample.sampledAt || new Date().toISOString(), String(sample.execution || ''), String(sample.program || ''), Number(sample.partCount || 0), Number(sample.spindleLoad || 0), Number(sample.dataAgeMs || 0), String(sample.quality || 'good'), sample.simulated ? 1 : 0
    );
  }

  queryTelemetry(machine, since, limit = 2000) {
    return this.db.prepare('SELECT * FROM telemetry_samples WHERE machine=? AND sampled_at>=? ORDER BY sampled_at DESC LIMIT ?').all(String(machine), String(since), Math.min(Number(limit)||2000,10000));
  }

  telemetrySummary(since) {
    return this.db.prepare(`SELECT machine,COUNT(*) samples,AVG(spindle_load) avg_load,MAX(spindle_load) max_load,MAX(sampled_at) last_sample,SUM(CASE WHEN quality!='good' THEN 1 ELSE 0 END) quality_issues FROM telemetry_samples WHERE sampled_at>=? GROUP BY machine`).all(String(since));
  }

  purgeTelemetry(rawDays = 30) {
    const cutoff = new Date(Date.now() - Math.max(1, Number(rawDays)) * 86400000).toISOString();
    return this.db.prepare('DELETE FROM telemetry_samples WHERE sampled_at<?').run(cutoff).changes;
  }

  recordAlarm(alarm) {
    this.db.prepare('INSERT INTO alarm_events(machine,alarm_code,message,occurred_at,simulated) VALUES(?,?,?,?,?)').run(String(alarm.machine),String(alarm.code),String(alarm.message||''),alarm.occurredAt||new Date().toISOString(),alarm.simulated?1:0);
  }

  alarmAnalytics(since) { return this.db.prepare('SELECT machine,alarm_code,COUNT(*) count,MAX(occurred_at) last_seen FROM alarm_events WHERE occurred_at>=? GROUP BY machine,alarm_code ORDER BY count DESC LIMIT 100').all(String(since)); }

  close() { this.db.close(); }
}

module.exports = { DataStore };
