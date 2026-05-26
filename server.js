/**
 * 本地 Node.js 后端服务器
 *
 * 提供与 Google Apps Script 相同的 REST 接口，数据存储为 SQLite 数据库。
 * 使用 better-sqlite3 实现并发安全的原子读写，解决多管理员同时操作时的数据覆盖问题。
 *
 * 使用步骤：
 * 1. 安装依赖：npm install
 * 2. 启动服务器：node server.js（或 npm start）
 * 3. 访问 http://localhost:3000/admin.html
 *
 * 数据存储在 ./data/schedule.db（单一 SQLite 文件），包含以下表：
 *   submissions    员工班表提交（按姓名+年+月+version 唯一）
 *   admin_state    管理员排班数据（单行 JSON blob）
 *   config         服务器配置（key-value）
 *   emp_accounts   员工账号（姓名 → 密码哈希）
 *   schedules      排班表（按地点+年+月唯一）
 *
 * 从旧 JSON 文件迁移：首次启动时若 data/*.json 存在，自动导入后不再读取。
 */

const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const Database = require('better-sqlite3');

const app      = express();
const PORT     = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH  = path.join(DATA_DIR, 'schedule.db');

// ── Middleware ──────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── SQLite 初始化 ────────────────────────────────────────────────
const db = new Database(DB_PATH);

// WAL 模式：提升并发读性能，写操作仍然串行但不阻塞读
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    year        INTEGER NOT NULL,
    month       INTEGER NOT NULL,
    version     TEXT    NOT NULL DEFAULT 'current',
    submitted_at TEXT,
    note        TEXT,
    schedule    TEXT    NOT NULL DEFAULT '[]'
  );
  CREATE INDEX IF NOT EXISTS idx_submissions_ym   ON submissions(year, month);
  CREATE INDEX IF NOT EXISTS idx_submissions_name ON submissions(name);

  CREATE TABLE IF NOT EXISTS admin_state (
    id    INTEGER PRIMARY KEY CHECK (id = 1),
    state TEXT    NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS emp_accounts (
    name          TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS schedules (
    loc        TEXT    NOT NULL,
    year       INTEGER NOT NULL,
    month      INTEGER NOT NULL,
    updated_at TEXT,
    schedule   TEXT    NOT NULL DEFAULT '{}',
    PRIMARY KEY (loc, year, month)
  );
`);

// ── 从旧 JSON 文件迁移（仅首次） ────────────────────────────────
function migrateFromJSON() {
  const migrated = db.prepare("SELECT value FROM config WHERE key = 'migrated'").get();
  if (migrated) return;

  console.log('🔄 检测到旧 JSON 数据文件，开始迁移到 SQLite...');

  const doMigrate = db.transaction(() => {
    // 迁移 config.json
    const cfgFile = path.join(DATA_DIR, 'config.json');
    if (fs.existsSync(cfgFile)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
        if (cfg.passwordHash) {
          db.prepare("INSERT OR REPLACE INTO config(key, value) VALUES('admin_password_hash', ?)").run(cfg.passwordHash);
        }
      } catch(e) { console.warn('迁移 config.json 失败:', e.message); }
    }

    // 迁移 emp_accounts.json
    const empFile = path.join(DATA_DIR, 'emp_accounts.json');
    if (fs.existsSync(empFile)) {
      try {
        const accounts = JSON.parse(fs.readFileSync(empFile, 'utf8'));
        const insert = db.prepare("INSERT OR REPLACE INTO emp_accounts(name, password_hash) VALUES(?, ?)");
        for (const [name, obj] of Object.entries(accounts)) {
          if (obj && obj.passwordHash) insert.run(name, obj.passwordHash);
        }
      } catch(e) { console.warn('迁移 emp_accounts.json 失败:', e.message); }
    }

    // 迁移 admin_state.json
    const stateFile = path.join(DATA_DIR, 'admin_state.json');
    if (fs.existsSync(stateFile)) {
      try {
        const state = fs.readFileSync(stateFile, 'utf8');
        db.prepare("INSERT OR REPLACE INTO admin_state(id, state) VALUES(1, ?)").run(state);
      } catch(e) { console.warn('迁移 admin_state.json 失败:', e.message); }
    }

    // 迁移 schedules.json
    const schedFile = path.join(DATA_DIR, 'schedules.json');
    if (fs.existsSync(schedFile)) {
      try {
        const rows = JSON.parse(fs.readFileSync(schedFile, 'utf8'));
        const insert = db.prepare("INSERT OR REPLACE INTO schedules(loc, year, month, updated_at, schedule) VALUES(?, ?, ?, ?, ?)");
        for (const r of rows) {
          insert.run(r.loc, r.year, r.month, r.updatedAt || null, JSON.stringify(r.schedule || {}));
        }
      } catch(e) { console.warn('迁移 schedules.json 失败:', e.message); }
    }

    // 迁移 submissions_*.json
    const subFiles = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('submissions_') && f.endsWith('.json'));
    const insert = db.prepare(`
      INSERT INTO submissions(name, year, month, version, submitted_at, note, schedule)
      VALUES(?, ?, ?, ?, ?, ?, ?)
    `);
    for (const file of subFiles) {
      try {
        const rows = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
        for (const s of rows) {
          insert.run(s.name, s.year, s.month, s.version || 'current', s.submittedAt || null, s.note || null, JSON.stringify(s.schedule || []));
        }
      } catch(e) { console.warn(`迁移 ${file} 失败:`, e.message); }
    }

    // 标记迁移完成
    db.prepare("INSERT OR REPLACE INTO config(key, value) VALUES('migrated', '1')").run();
  });

  doMigrate();
  console.log('✅ 数据迁移完成');
}

migrateFromJSON();

// ── Helpers ─────────────────────────────────────────────────────
function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

const DEFAULT_PW_HASH = hashPassword('123456');

function getAdminPasswordHash() {
  const row = db.prepare("SELECT value FROM config WHERE key = 'admin_password_hash'").get();
  return row ? row.value : DEFAULT_PW_HASH;
}

function setAdminPasswordHash(hash) {
  db.prepare("INSERT OR REPLACE INTO config(key, value) VALUES('admin_password_hash', ?)").run(hash);
}

function readEmpAccounts() {
  const rows = db.prepare("SELECT name, password_hash FROM emp_accounts").all();
  const result = {};
  for (const r of rows) result[r.name] = { passwordHash: r.password_hash };
  return result;
}

function saveEmpAccounts(accounts) {
  const upsert = db.prepare("INSERT OR REPLACE INTO emp_accounts(name, password_hash) VALUES(?, ?)");
  const deleteAll = db.prepare("DELETE FROM emp_accounts");
  const doSave = db.transaction(() => {
    deleteAll.run();
    for (const [name, obj] of Object.entries(accounts)) {
      if (obj && obj.passwordHash) upsert.run(name, obj.passwordHash);
    }
  });
  doSave();
}

// ── GET /api ─────────────────────────────────────────────────────
app.get('/api', (req, res) => {
  const { action, year, month } = req.query;

  // 获取员工班表提交
  if (action === 'getSubmissions') {
    const y = parseInt(year), m = parseInt(month);
    if (isNaN(y) || isNaN(m)) return res.status(400).json({ error: 'Invalid year or month' });

    const rows = db.prepare("SELECT * FROM submissions WHERE year = ? AND month = ?").all(y, m);
    const all = rows.map(r => ({
      name: r.name, year: r.year, month: r.month,
      version: r.version, submittedAt: r.submitted_at,
      note: r.note || undefined,
      schedule: JSON.parse(r.schedule || '[]'),
    }));

    const currents = all.filter(s => s.version !== 'prev');
    const prevMap  = {};
    all.filter(s => s.version === 'prev').forEach(s => {
      prevMap[s.name] = { schedule: s.schedule, submittedAt: s.submittedAt };
    });
    currents.forEach(s => { if (prevMap[s.name]) s.prev = prevMap[s.name]; });
    return res.json({ submissions: currents });
  }

  // 获取管理员排班数据
  if (action === 'getAdminState') {
    const row = db.prepare("SELECT state FROM admin_state WHERE id = 1").get();
    const state = row ? JSON.parse(row.state) : {};
    return res.json({ success: true, state });
  }

  // 验证管理员密码
  if (action === 'verifyPassword') {
    const { password } = req.query;
    const ok = hashPassword(password) === getAdminPasswordHash();
    return res.json({ success: ok });
  }

  // 获取员工账号列表
  if (action === 'getEmpAccounts') {
    const accounts = readEmpAccounts();
    return res.json({ success: true, accounts });
  }

  // 获取排班表（单个地点单月）
  if (action === 'getSchedule') {
    const loc = req.query.loc;
    const y = parseInt(req.query.year), m = parseInt(req.query.month);
    if (!loc || isNaN(y) || isNaN(m)) return res.status(400).json({ error: 'Invalid params' });
    const row = db.prepare("SELECT schedule FROM schedules WHERE loc = ? AND year = ? AND month = ?").get(loc, y, m);
    if (!row) return res.json({ success: true, schedule: null });
    return res.json({ success: true, schedule: JSON.parse(row.schedule) });
  }

  res.status(400).json({ error: 'Unknown action' });
});

// ── POST /api ─────────────────────────────────────────────────────
app.post('/api', (req, res) => {
  const { action } = req.body;

  // 提交员工班表
  if (action === 'submitSchedule' || !action) {
    try {
      const { name, year, month, submittedAt, schedule, note } = req.body;
      if (!name || !year || !month) return res.status(400).json({ success: false, error: 'Missing fields' });
      const y = parseInt(year), m = parseInt(month);
      const todayStr = new Date().toISOString().slice(0, 10);

      const doSubmit = db.transaction(() => {
        // 找到当前 current 行
        const currentRow = db.prepare(
          "SELECT * FROM submissions WHERE name = ? AND year = ? AND month = ? AND version != 'prev'"
        ).get(name, y, m);

        const currentSchedule = currentRow ? JSON.parse(currentRow.schedule) : null;

        // 删除该员工该月所有旧行
        db.prepare("DELETE FROM submissions WHERE name = ? AND year = ? AND month = ?").run(name, y, m);

        if (currentSchedule) {
          // 二次及以后提交：已过去的日期用旧数据，未来日期用新数据
          const mergedSchedule = (schedule || []).map(entry => {
            if (entry.date < todayStr) {
              const oldEntry = currentSchedule.find(e => e.date === entry.date);
              return oldEntry || entry;
            }
            return entry;
          });
          // 旧 current 降为 prev
          db.prepare(
            "INSERT INTO submissions(name, year, month, version, submitted_at, note, schedule) VALUES(?, ?, ?, 'prev', ?, ?, ?)"
          ).run(name, y, m, currentRow.submitted_at, currentRow.note || null, currentRow.schedule);
          // 写入新 current
          db.prepare(
            "INSERT INTO submissions(name, year, month, version, submitted_at, note, schedule) VALUES(?, ?, ?, 'current', ?, ?, ?)"
          ).run(name, y, m, submittedAt, note || null, JSON.stringify(mergedSchedule));
        } else {
          // 首次提交
          db.prepare(
            "INSERT INTO submissions(name, year, month, version, submitted_at, note, schedule) VALUES(?, ?, ?, 'current', ?, ?, ?)"
          ).run(name, y, m, submittedAt, note || null, JSON.stringify(schedule || []));
        }
      });

      doSubmit();
      return res.json({ success: true });
    } catch(err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 清除员工提交的 prev 记录
  if (action === 'clearPrevSubmission') {
    try {
      const { name, year, month } = req.body;
      const y = parseInt(year), m = parseInt(month);
      db.prepare("DELETE FROM submissions WHERE name = ? AND year = ? AND month = ? AND version = 'prev'").run(name, y, m);
      return res.json({ success: true });
    } catch(err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 保存管理员排班数据
  if (action === 'saveAdminState') {
    try {
      const { state } = req.body;
      if (!state) return res.status(400).json({ success: false, error: 'Missing state' });

      const doSave = db.transaction(() => {
        db.prepare("INSERT OR REPLACE INTO admin_state(id, state) VALUES(1, ?)").run(JSON.stringify(state));
        // 同步员工账号
        if (state.employeeAccounts) {
          saveEmpAccounts(state.employeeAccounts);
        }
      });
      doSave();
      return res.json({ success: true });
    } catch(err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 保存排班表（单个地点单月）
  if (action === 'saveSchedule') {
    try {
      const { loc, year, month, schedule } = req.body;
      if (!loc || !year || !month) return res.status(400).json({ success: false, error: 'Missing fields' });
      const y = parseInt(year), m = parseInt(month);
      const updatedAt = new Date().toISOString();
      db.prepare(
        "INSERT OR REPLACE INTO schedules(loc, year, month, updated_at, schedule) VALUES(?, ?, ?, ?, ?)"
      ).run(loc, y, m, updatedAt, JSON.stringify(schedule || {}));
      return res.json({ success: true, updatedAt });
    } catch(err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 删除某员工的所有提交记录
  if (action === 'deleteEmployeeSubmissions') {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ success: false, error: 'Missing name' });
      db.prepare("DELETE FROM submissions WHERE name = ?").run(name);
      return res.json({ success: true });
    } catch(err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 修改管理员密码
  if (action === 'changePassword') {
    try {
      const { oldPassword, newPassword } = req.body;
      if (hashPassword(oldPassword) !== getAdminPasswordHash()) {
        return res.json({ success: false, error: '当前密码错误' });
      }
      setAdminPasswordHash(hashPassword(newPassword));
      return res.json({ success: true });
    } catch(err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 员工修改自己的密码
  if (action === 'changeEmpPassword') {
    try {
      const { name, oldPasswordHash, newPasswordHash } = req.body;
      const row = db.prepare("SELECT password_hash FROM emp_accounts WHERE name = ?").get(name);
      if (!row) return res.json({ success: false, error: '账号不存在' });
      if (row.password_hash !== oldPasswordHash) return res.json({ success: false, error: '当前密码错误' });
      db.prepare("UPDATE emp_accounts SET password_hash = ? WHERE name = ?").run(newPasswordHash, name);
      return res.json({ success: true });
    } catch(err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 管理员重置员工密码
  if (action === 'resetEmpPassword') {
    try {
      const { name } = req.body;
      db.prepare("INSERT OR REPLACE INTO emp_accounts(name, password_hash) VALUES(?, ?)").run(name, DEFAULT_PW_HASH);
      return res.json({ success: true });
    } catch(err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 管理员删除员工账号
  if (action === 'deleteEmpAccount') {
    try {
      const { name } = req.body;
      db.prepare("DELETE FROM emp_accounts WHERE name = ?").run(name);
      return res.json({ success: true });
    } catch(err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 管理员创建员工账号
  if (action === 'createEmpAccount') {
    try {
      const { name } = req.body;
      db.prepare("INSERT OR IGNORE INTO emp_accounts(name, password_hash) VALUES(?, ?)").run(name, DEFAULT_PW_HASH);
      return res.json({ success: true });
    } catch(err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  res.status(400).json({ success: false, error: 'Unknown action' });
});

// ── Start ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ 排班系统本地服务器运行在 http://localhost:${PORT}`);
  console.log(`   数据库文件: ${DB_PATH}`);
  console.log(`   管理员界面: http://localhost:${PORT}/admin.html`);
  console.log(`   员工界面:   http://localhost:${PORT}/schedule_app.html`);
  console.log(`   初始密码: 123456`);
});
