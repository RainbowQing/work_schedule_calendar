/**
 * 本地 Node.js 后端服务器
 *
 * 提供与 Google Apps Script 相同的 REST 接口，数据存储为 SQLite 数据库。
 * 使用 better-sqlite3 实现并发安全的原子读写。
 * 支持多管理员账号（1/2/3），各管理员独立分区存储，共享排班数据。
 *
 * 使用步骤：
 * 1. 安装依赖：npm install
 * 2. 启动服务器：node server.js（或 npm start）
 * 3. 访问 http://localhost:3000/admin.html
 *
 * 数据存储在 ./data/schedule.db，包含以下表：
 *   submissions          员工班表提交（按姓名+年+月+version 唯一）
 *   admin_state_shared   共享管理数据（locationMap、员工状态、地点配置等）
 *   admin_state_partition 各管理员独立数据（managedLocations、empOrder 等），按 admin_id 分区
 *   config               服务器配置（key-value），含 admin_accounts JSON
 *   emp_accounts         员工账号（姓名 → 密码哈希）
 *   schedules            排班表（按地点+年+月唯一）
 *
 * 管理员账号存储在 config 表 key='admin_accounts'，值为：
 *   { "1": { "passwordHash": "..." }, "2": {...}, "3": {...} }
 * 忘记密码重置方法（以管理员2为例，重置为 123456）：
 *   node -e "
 *     const D=require('better-sqlite3')('./data/schedule.db');
 *     const c=require('crypto');
 *     const h=c.createHash('sha256').update('123456').digest('hex');
 *     const row=D.prepare(\"SELECT value FROM config WHERE key='admin_accounts'\").get();
 *     const accounts=row?JSON.parse(row.value):{};
 *     accounts['2']={passwordHash:h};
 *     D.prepare(\"INSERT OR REPLACE INTO config(key,value) VALUES('admin_accounts',?)\").run(JSON.stringify(accounts));
 *     console.log('管理员2密码已重置为 123456');
 *   "
 */

const express  = require('express');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');
const crypto   = require('crypto');
const Database = require('better-sqlite3');

const app      = express();
const PORT     = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH  = path.join(DATA_DIR, 'schedule.db');

// ── Middleware ──────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── SQLite 初始化 ────────────────────────────────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    year         INTEGER NOT NULL,
    month        INTEGER NOT NULL,
    version      TEXT    NOT NULL DEFAULT 'current',
    submitted_at TEXT,
    note         TEXT,
    schedule     TEXT    NOT NULL DEFAULT '[]'
  );
  CREATE INDEX IF NOT EXISTS idx_submissions_ym   ON submissions(year, month);
  CREATE INDEX IF NOT EXISTS idx_submissions_name ON submissions(name);

  CREATE TABLE IF NOT EXISTS admin_state_shared (
    id    INTEGER PRIMARY KEY CHECK (id = 1),
    state TEXT    NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS admin_state_partition (
    admin_id   TEXT PRIMARY KEY,
    updated_at TEXT,
    state      TEXT NOT NULL DEFAULT '{}'
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

// ── 从旧数据迁移（仅首次） ───────────────────────────────────────
function migrateFromJSON() {
  const migrated = db.prepare("SELECT value FROM config WHERE key = 'migrated_v2'").get();
  if (migrated) return;

  console.log('🔄 开始数据迁移到多管理员结构...');

  const doMigrate = db.transaction(() => {
    // 迁移旧单密码 → admin_accounts（归为管理员1）
    const oldPwRow = db.prepare("SELECT value FROM config WHERE key = 'admin_password_hash'").get();
    const oldPwHash = oldPwRow ? oldPwRow.value : hashPassword('123456');
    const adminAccounts = {
      '1': { passwordHash: oldPwHash },
      '2': { passwordHash: hashPassword('123456') },
      '3': { passwordHash: hashPassword('123456') },
    };
    db.prepare("INSERT OR REPLACE INTO config(key, value) VALUES('admin_accounts', ?)").run(JSON.stringify(adminAccounts));

    // 迁移旧 admin_state 表 → admin_state_shared（共享数据）
    // 旧分区数据（empOrder/empOverrides/submissionSnapshots 等）迁移给管理员1
    // 全新安装时旧表不存在，跳过迁移
    const oldTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_state'").get();
    const oldState = oldTableExists ? db.prepare("SELECT state FROM admin_state WHERE id = 1").get() : null;
    if (oldState) {
      try {
        const s = JSON.parse(oldState.state);
        // 提取共享字段
        const shared = {
          locationMap:        s.locationMap        || {},
          allEmployees:       s.allEmployees        || {},
          resignedEmployees:  s.resignedEmployees   || {},
          permanentlyDeleted: s.permanentlyDeleted  || {},
          employeeAccounts:   s.employeeAccounts    || {},
          locations:          s.locations           || [],
          confirmedWeeks:     s.confirmedWeeks      || {},
          slotLimits:         s.slotLimits          || {},
          locSettings:        s.locSettings         || {},
          submissions:        s.submissions         || {},
        };
        // locationMap 旧结构是 { 姓名: ['A','B'] }，迁移为 { 姓名: { A: '1', B: '1' } }（全归管理员1）
        for (const [name, val] of Object.entries(shared.locationMap)) {
          if (Array.isArray(val)) {
            const newVal = {};
            val.forEach(loc => { newVal[loc] = '1'; });
            shared.locationMap[name] = newVal;
          }
        }
        db.prepare("INSERT OR REPLACE INTO admin_state_shared(id, state) VALUES(1, ?)").run(JSON.stringify(shared));

        // 提取管理员1的独立分区字段
        const partition1 = {
          managedLocations:        s.locations           || [],
          managedEmployees:        Object.keys(s.allEmployees || {}),
          empOrder:                s.empOrder             || {},
          empOverrides:            s.empOverrides         || {},
          submissionSnapshots:     s.submissionSnapshots  || {},
          submissionPrevSnapshots: s.submissionPrevSnapshots || {},
          submissionUpdated:       s.submissionUpdated    || {},
          stateVersion:            s.stateVersion         || 0,
        };
        db.prepare("INSERT OR REPLACE INTO admin_state_partition(admin_id, updated_at, state) VALUES('1', ?, ?)").run(new Date().toISOString(), JSON.stringify(partition1));
      } catch(e) { console.warn('迁移 admin_state 失败:', e.message); }
    }

    // 迁移旧 JSON 文件（如果存在）
    const cfgFile = path.join(DATA_DIR, 'config.json');
    if (fs.existsSync(cfgFile)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
        if (cfg.passwordHash) {
          const accounts = getAdminAccounts();
          accounts['1'] = { passwordHash: cfg.passwordHash };
          db.prepare("INSERT OR REPLACE INTO config(key, value) VALUES('admin_accounts', ?)").run(JSON.stringify(accounts));
        }
      } catch(e) { console.warn('迁移 config.json 失败:', e.message); }
    }

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

    const subFiles = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('submissions_') && f.endsWith('.json'));
    const insertSub = db.prepare(`INSERT OR IGNORE INTO submissions(name, year, month, version, submitted_at, note, schedule) VALUES(?, ?, ?, ?, ?, ?, ?)`);
    for (const file of subFiles) {
      try {
        const rows = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
        for (const s of rows) {
          insertSub.run(s.name, s.year, s.month, s.version || 'current', s.submittedAt || null, s.note || null, JSON.stringify(s.schedule || []));
        }
      } catch(e) { console.warn(`迁移 ${file} 失败:`, e.message); }
    }

    db.prepare("INSERT OR REPLACE INTO config(key, value) VALUES('migrated_v2', '1')").run();
  });

  doMigrate();
  console.log('✅ 数据迁移完成');
}

// ── Helpers ─────────────────────────────────────────────────────
function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}
const DEFAULT_PW_HASH = hashPassword('123456');

// 管理员账号：{ "1": { passwordHash }, "2": {...}, "3": {...} }
function getAdminAccounts() {
  const row = db.prepare("SELECT value FROM config WHERE key = 'admin_accounts'").get();
  if (row) {
    try { return JSON.parse(row.value); } catch(e) {}
  }
  return {
    '1': { passwordHash: DEFAULT_PW_HASH },
    '2': { passwordHash: DEFAULT_PW_HASH },
    '3': { passwordHash: DEFAULT_PW_HASH },
  };
}

function setAdminAccountHash(adminId, hash) {
  const accounts = getAdminAccounts();
  if (!accounts[adminId]) accounts[adminId] = {};
  accounts[adminId].passwordHash = hash;
  db.prepare("INSERT OR REPLACE INTO config(key, value) VALUES('admin_accounts', ?)").run(JSON.stringify(accounts));
}

function verifyAdminPassword(adminId, password) {
  const accounts = getAdminAccounts();
  const account = accounts[adminId];
  if (!account) return false;
  return hashPassword(password) === account.passwordHash;
}

// 共享数据读写
function readSharedState() {
  const row = db.prepare("SELECT state FROM admin_state_shared WHERE id = 1").get();
  return row ? JSON.parse(row.state) : {};
}

function writeSharedState(shared) {
  db.prepare("INSERT OR REPLACE INTO admin_state_shared(id, state) VALUES(1, ?)").run(JSON.stringify(shared));
}

// 分区数据读写
function readPartitionState(adminId) {
  const row = db.prepare("SELECT state FROM admin_state_partition WHERE admin_id = ?").get(adminId);
  return row ? JSON.parse(row.state) : {};
}

function writePartitionState(adminId, partition) {
  db.prepare("INSERT OR REPLACE INTO admin_state_partition(admin_id, updated_at, state) VALUES(?, ?, ?)").run(adminId, new Date().toISOString(), JSON.stringify(partition));
}

function readEmpAccounts() {
  const rows = db.prepare("SELECT name, password_hash FROM emp_accounts").all();
  const result = {};
  for (const r of rows) result[r.name] = { passwordHash: r.password_hash };
  return result;
}

function saveEmpAccounts(accounts) {
  const upsert  = db.prepare("INSERT OR REPLACE INTO emp_accounts(name, password_hash) VALUES(?, ?)");
  const delAll  = db.prepare("DELETE FROM emp_accounts");
  const doSave  = db.transaction(() => {
    delAll.run();
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
    const all  = rows.map(r => ({
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

  // 获取管理员状态（共享 + 指定管理员分区）
  if (action === 'getAdminState') {
    const adminId = req.query.adminId;
    const shared    = readSharedState();
    const partition = adminId ? readPartitionState(adminId) : {};
    return res.json({ success: true, shared, partition });
  }

  // 验证管理员密码（需传 adminId）
  if (action === 'verifyPassword') {
    const { adminId, password } = req.query;
    if (!adminId || !password) return res.json({ success: false });
    const ok = verifyAdminPassword(adminId, password);
    return res.json({ success: ok, adminId });
  }

  // 获取员工账号列表
  if (action === 'getEmpAccounts') {
    const accounts = readEmpAccounts();
    return res.json({ success: true, accounts });
  }

  // 获取所有管理员的 managedLocations（用于地点唯一归属检测）
  if (action === 'getAllPartitions') {
    const rows = db.prepare("SELECT admin_id, state FROM admin_state_partition").all();
    const result = {};
    for (const r of rows) {
      try {
        const s = JSON.parse(r.state);
        result[r.admin_id] = { managedLocations: s.managedLocations || [], managedEmployees: s.managedEmployees || [] };
      } catch(e) {}
    }
    return res.json({ success: true, partitions: result });
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
        const currentRow = db.prepare(
          "SELECT * FROM submissions WHERE name = ? AND year = ? AND month = ? AND version != 'prev'"
        ).get(name, y, m);
        const currentSchedule = currentRow ? JSON.parse(currentRow.schedule) : null;
        db.prepare("DELETE FROM submissions WHERE name = ? AND year = ? AND month = ?").run(name, y, m);

        if (currentSchedule) {
          const mergedSchedule = (schedule || []).map(entry => {
            if (entry.date < todayStr) {
              const oldEntry = currentSchedule.find(e => e.date === entry.date);
              return oldEntry || entry;
            }
            return entry;
          });
          db.prepare("INSERT INTO submissions(name, year, month, version, submitted_at, note, schedule) VALUES(?, ?, ?, 'prev', ?, ?, ?)").run(name, y, m, currentRow.submitted_at, currentRow.note || null, currentRow.schedule);
          db.prepare("INSERT INTO submissions(name, year, month, version, submitted_at, note, schedule) VALUES(?, ?, ?, 'current', ?, ?, ?)").run(name, y, m, submittedAt, note || null, JSON.stringify(mergedSchedule));
        } else {
          db.prepare("INSERT INTO submissions(name, year, month, version, submitted_at, note, schedule) VALUES(?, ?, ?, 'current', ?, ?, ?)").run(name, y, m, submittedAt, note || null, JSON.stringify(schedule || []));
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

  // 保存管理员状态（共享 + 分区分别存储）
  if (action === 'saveAdminState') {
    try {
      const { adminId, shared, partition } = req.body;
      if (!adminId) return res.status(400).json({ success: false, error: 'Missing adminId' });

      const doSave = db.transaction(() => {
        let mergedLocs = null; // 在 shared 块里赋值，partition 块里使用
        // ── shared 字段全量 merge：以 existing 为基础，incoming 只补充/更新 ──
        if (shared) {
          const existing = readSharedState();
          const mergedAllEmp      = Object.assign({}, existing.allEmployees || {}, shared.allEmployees || {});
          const mergedResigned    = Object.assign({}, existing.resignedEmployees || {}, shared.resignedEmployees || {});
          const mergedDeleted     = Object.assign({}, existing.permanentlyDeleted || {}, shared.permanentlyDeleted || {});
          const mergedEmpAccounts = Object.assign({}, existing.employeeAccounts || {}, shared.employeeAccounts || {});
          // locations：按管理员分区 merge
          // 规则：保留 existing 里不属于当前管理员的地点；当前管理员的地点以 incoming 为准（支持新增和删除）
          const myManagedLocs = new Set((partition && partition.managedLocations) || []);
          // incoming.locations 里当前管理员新建的地点（不在 managedLocations 里但在 incoming 里）也要保留
          const incomingLocsSet = new Set(shared.locations || []);
          const existingLocs = existing.locations || [];
          // 判断某地点是否属于当前管理员：在 incoming managedLocations 里，或在 incoming locations 但不在其他管理员的 managedLocations 里
          const otherAdminLocs = new Set();
          try {
            const partRows = db.prepare("SELECT admin_id, state FROM admin_state_partition").all();
            for (const pr of partRows) {
              if (pr.admin_id === adminId) continue;
              const ps = JSON.parse(pr.state || '{}');
              (ps.managedLocations || []).forEach(l => otherAdminLocs.add(l));
            }
          } catch(e) {}
          mergedLocs = [
            // 保留 existing 里属于其他管理员的地点
            ...existingLocs.filter(l => otherAdminLocs.has(l)),
            // 加入 incoming 里的所有地点（当前管理员视角的完整列表，含新增，去掉的视为已删）
            ...(shared.locations || []),
          ].filter((l, i, arr) => arr.indexOf(l) === i); // 去重
          // confirmedWeeks 已迁移到 partition，shared 里不再存储（兼容旧数据保留，但不主动写入）
          const mergedSlotLimits  = Object.assign({}, existing.slotLimits || {}, shared.slotLimits || {});
          const mergedLocSettings = Object.assign({}, existing.locSettings || {}, shared.locSettings || {});
          const mergedSubmissions = Object.assign({}, existing.submissions || {}, shared.submissions || {});

          // locationMap：只覆盖当前管理员管理的地点列
          const myLocs = new Set((partition && partition.managedLocations) || []);
          const mergedLocMap = Object.assign({}, existing.locationMap || {});
          const incomingLocMap = shared.locationMap || {};
          for (const name of Object.keys(incomingLocMap)) {
            if (!mergedLocMap[name]) mergedLocMap[name] = {};
            const incomingEntry = incomingLocMap[name] || {};
            for (const loc of myLocs) {
              mergedLocMap[name][loc] = incomingEntry[loc] !== undefined ? incomingEntry[loc] : 0;
            }
          }

          const mergedShared = {
            allEmployees:       mergedAllEmp,
            resignedEmployees:  mergedResigned,
            permanentlyDeleted: mergedDeleted,
            employeeAccounts:   mergedEmpAccounts,
            locations:          mergedLocs,
            slotLimits:         mergedSlotLimits,
            locSettings:        mergedLocSettings,
            submissions:        mergedSubmissions,
            locationMap:        mergedLocMap,
          };
          writeSharedState(mergedShared);
          saveEmpAccounts(mergedEmpAccounts);
        }
        // 写该管理员的分区数据（过滤掉已不在 locations 里的地点）
        if (partition) {
          const validLocs = new Set(mergedLocs || []);
          if (partition.managedLocations) {
            partition.managedLocations = partition.managedLocations.filter(l => validLocs.has(l));
          }
          writePartitionState(adminId, partition);
        }
      });
      doSave();
      return res.json({ success: true });
    } catch(err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 删除某地点的所有排班数据（删除地点时调用）
  if (action === 'deleteLocationSchedules') {
    try {
      const { loc } = req.body;
      if (!loc) return res.status(400).json({ success: false, error: 'Missing loc' });
      db.prepare("DELETE FROM schedules WHERE loc = ?").run(loc);
      return res.json({ success: true });
    } catch(err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 保存排班表（单个地点单月），含排班冲突优先级判断
  if (action === 'saveSchedule') {
    try {
      const { loc, year, month, schedule, adminId } = req.body;
      if (!loc || !year || !month) return res.status(400).json({ success: false, error: 'Missing fields' });
      const y = parseInt(year), m = parseInt(month);
      const updatedAt = new Date().toISOString();

      // 先到先得冲突检测：同一员工同一天在多个地点有排班时，已保存的数据优先；
      // 仅当两个管理员在同一请求中同时出现同员工同天冲突（即其他地点也没有已保存数据）时，
      // 才按管理员编号 1>2>3 决定优先级。
      let finalSchedule = schedule || {};
      const conflicts = []; // 记录被移除的冲突排班

      // 先检查本地点是否已有历史排班（用于判断"当前保存"是否覆盖已有数据）
      const existingRow = db.prepare("SELECT schedule FROM schedules WHERE loc = ? AND year = ? AND month = ?").get(loc, y, m);
      const existingSchedule = existingRow ? JSON.parse(existingRow.schedule || '{}') : {};

      if (adminId && finalSchedule.days) {
        // 获取所有地点同月排班，用于冲突检测
        const allSchedules = db.prepare("SELECT loc, schedule FROM schedules WHERE year = ? AND month = ?").all(y, m);
        const otherSchedules = allSchedules.filter(r => r.loc !== loc);

        // 获取所有管理员分区，确定各管理员负责的地点
        const partitionRows = db.prepare("SELECT admin_id, state FROM admin_state_partition").all();
        const locOwnerMap = {}; // { loc: adminId }
        for (const pr of partitionRows) {
          try {
            const ps = JSON.parse(pr.state);
            (ps.managedLocations || []).forEach(l => { locOwnerMap[l] = pr.admin_id; });
          } catch(e) {}
        }

        // 对新排班里的每个员工+日期，检查其他地点是否已有排班
        for (const [daySlotKey, names] of Object.entries(finalSchedule.days)) {
          if (!daySlotKey.endsWith('||start')) continue; // 只检查 start slot
          const dateKey = daySlotKey.replace('||start', '');

          for (const name of [...names]) {
            for (const other of otherSchedules) {
              try {
                const otherSched = JSON.parse(other.schedule);
                const otherStart = (otherSched.days || {})[`${dateKey}||start`] || [];
                if (!otherStart.includes(name)) continue;

                // 该员工当天在其他地点已有排班记录（先到先得：已有数据优先）
                const otherAdminId = locOwnerMap[other.loc] || '1';

                // 判断"其他地点的排班"是否来自已保存的历史数据，还是同一请求中的冲突
                // 策略：只要 DB 中其他地点已有该员工该天的排班，本次保存就被拒绝
                // （如果其他地点也是刚刚保存、尚未写入 DB，则按管理员编号 1>2>3 决定）
                const otherIsAlreadySaved = true; // otherSchedules 均来自 DB 查询，代表已有数据
                if (otherIsAlreadySaved) {
                  // 已有数据优先：移除本次排班中该员工
                  finalSchedule.days[daySlotKey] = finalSchedule.days[daySlotKey].filter(n => n !== name);
                  const endKey = `${dateKey}||end`;
                  if (finalSchedule.days[endKey]) {
                    finalSchedule.days[endKey] = finalSchedule.days[endKey].filter(n => n !== name);
                  }
                  conflicts.push({ name, date: dateKey, otherLoc: other.loc, otherAdminId });
                }
              } catch(e) {}
            }
          }
        }
      }

      // 如果有冲突且本地点之前没有任何已保存排班，则整体拒绝保存，通知客户端刷新重排
      // 如果本地点已有历史排班（部分员工冲突），则保存去除冲突后的版本并告知
      const hasExistingData = Object.keys(existingSchedule.days || {}).length > 0;
      if (conflicts.length > 0 && !hasExistingData) {
        // 本地点是第一次保存但发现冲突：拒绝保存，要求客户端刷新
        return res.json({ success: false, conflicts });
      }

      db.prepare("INSERT OR REPLACE INTO schedules(loc, year, month, updated_at, schedule) VALUES(?, ?, ?, ?, ?)").run(loc, y, m, updatedAt, JSON.stringify(finalSchedule));
      return res.json({ success: true, updatedAt, conflicts, savedSchedule: finalSchedule });
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

  // 修改管理员密码（需传 adminId）
  if (action === 'changePassword') {
    try {
      const { adminId, oldPassword, newPassword } = req.body;
      if (!adminId) return res.json({ success: false, error: '缺少管理员ID' });
      if (!verifyAdminPassword(adminId, oldPassword)) {
        return res.json({ success: false, error: '当前密码错误' });
      }
      setAdminAccountHash(adminId, hashPassword(newPassword));
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

  // ── 重置管理员密码（仅本地 localhost 可访问）──
  if (action === 'resetAdminPassword') {
    // 安全限制：只允许从本机发起
    const clientIp = req.ip || req.connection.remoteAddress || '';
    const isLocal = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';
    if (!isLocal) return res.status(403).json({ success: false, error: 'Only accessible from localhost' });
    try {
      const { adminId, newPassword } = req.body;
      if (!['1','2','3'].includes(String(adminId))) {
        return res.json({ success: false, error: '无效的管理员ID（1/2/3）' });
      }
      if (!newPassword || newPassword.length < 6) {
        return res.json({ success: false, error: '新密码至少6位' });
      }
      setAdminAccountHash(String(adminId), hashPassword(newPassword));
      console.log(`[reset] 管理员 ${adminId} 密码已重置`);
      return res.json({ success: true, message: `管理员 ${adminId} 密码已重置` });
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

// ── 启动前执行迁移 ───────────────────────────────────────────────
migrateFromJSON();

// ── Start ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ 排班系统本地服务器运行在 http://localhost:${PORT}`);
  console.log(`   数据库文件: ${DB_PATH}`);
  console.log(`   管理员界面: http://localhost:${PORT}/admin.html`);
  console.log(`   员工界面:   http://localhost:${PORT}/schedule_app.html`);
  console.log(`   初始密码: 123456（管理员1/2/3 均为此密码，建议登录后修改）`);
});
