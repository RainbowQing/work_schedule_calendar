/**
 * Google Apps Script 后端代码
 *
 * 支持多管理员账号（1/2/3），各管理员独立分区存储，共享排班数据。
 *
 * 使用步骤：
 * 1. 打开 Google Sheets，创建一个新表格
 * 2. 点击菜单：扩展程序 → Apps Script
 * 3. 将此文件的全部内容粘贴进去，替换原有代码
 * 4. 点击部署 → 新建部署 → 类型选"网络应用"
 *    - 执行身份：我
 *    - 具有访问权限的用户：所有人
 * 5. 复制生成的 Web App URL，填入本地 config.js 的 APPS_SCRIPT_URL
 *
 * Sheet 结构：
 *   Submissions         — 员工班表提交（每行一条）
 *   AdminStateShared    — 共享管理数据（locationMap、员工状态等），单行 JSON
 *   AdminStatePartition — 各管理员独立数据，每行一个管理员（adminId + JSON）
 *   Schedules           — 排班表数据（每行一个地点+月份）
 *   Config              — 系统配置（admin_accounts JSON 等）
 *   EmpAccounts         — 员工账号（每行一个员工：姓名 + 密码哈希）
 *
 * 管理员忘记密码重置方法（以管理员2为例，重置为 123456）：
 *   在 Config Sheet 找到 key='admin_accounts' 的行，编辑其 Value 列的 JSON，
 *   将 "2" 的 passwordHash 改为 sha256('123456') 的值：
 *   8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92
 */

const SHEET_SUBMISSIONS         = 'Submissions';
const SHEET_ADMIN_STATE_SHARED  = 'AdminStateShared';
const SHEET_ADMIN_STATE_PART    = 'AdminStatePartition';
const SHEET_SCHEDULES           = 'Schedules';
const SHEET_CONFIG              = 'Config';
const SHEET_EMP_ACCOUNTS        = 'EmpAccounts';
// 向下兼容旧 Sheet 名
const SHEET_ADMIN_STATE_LEGACY  = 'AdminState';

// SHA-256 哈希（GAS 内置 Utilities）
function sha256(str) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str);
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

const DEFAULT_PW_HASH = sha256('123456');

// ── Sheet helpers ─────────────────────────────────────────────────
function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers) sheet.appendRow(headers);
  }
  return sheet;
}

// ── Config / 管理员账号 ──────────────────────────────────────────

function getConfigRaw() {
  const sheet = getOrCreateSheet(SHEET_CONFIG, ['Key', 'Value']);
  const rows = sheet.getDataRange().getValues();
  const cfg = {};
  for (let i = 1; i < rows.length; i++) {
    cfg[rows[i][0]] = rows[i][1];
  }
  return cfg;
}

function setConfigKey(key, value) {
  const sheet = getOrCreateSheet(SHEET_CONFIG, ['Key', 'Value']);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

// 获取所有管理员账号：{ "1": { passwordHash }, "2": {...}, "3": {...} }
function getAdminAccounts() {
  const cfg = getConfigRaw();
  if (cfg['admin_accounts']) {
    try { return JSON.parse(cfg['admin_accounts']); } catch(e) {}
  }
  // 向下兼容：旧版只有单密码，迁移给管理员1
  const oldHash = cfg['passwordHash'] || DEFAULT_PW_HASH;
  return {
    '1': { passwordHash: oldHash },
    '2': { passwordHash: DEFAULT_PW_HASH },
    '3': { passwordHash: DEFAULT_PW_HASH },
  };
}

function setAdminAccountHash(adminId, hash) {
  const accounts = getAdminAccounts();
  if (!accounts[adminId]) accounts[adminId] = {};
  accounts[adminId].passwordHash = hash;
  setConfigKey('admin_accounts', JSON.stringify(accounts));
}

function verifyAdminPassword(adminId, password) {
  const accounts = getAdminAccounts();
  const account = accounts[adminId];
  if (!account) return false;
  return sha256(password) === account.passwordHash;
}

// ── AdminStateShared helpers ─────────────────────────────────────

function readSharedState() {
  // 优先读新 Sheet
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_ADMIN_STATE_SHARED);
  if (sheet && sheet.getLastRow() >= 2) {
    try { return JSON.parse(sheet.getRange(2, 2).getValue() || '{}'); } catch(e) {}
  }
  // 向下兼容：读旧 AdminState Sheet
  const legacy = ss.getSheetByName(SHEET_ADMIN_STATE_LEGACY);
  if (legacy && legacy.getLastRow() >= 2) {
    try { return JSON.parse(legacy.getRange(2, 2).getValue() || '{}'); } catch(e) {}
  }
  return {};
}

function writeSharedState(shared) {
  const sheet = getOrCreateSheet(SHEET_ADMIN_STATE_SHARED, ['UpdatedAt', 'StateJSON']);
  const json = JSON.stringify(shared);
  if (sheet.getLastRow() < 2) {
    sheet.appendRow([new Date().toISOString(), json]);
  } else {
    sheet.getRange(2, 1, 1, 2).setValues([[new Date().toISOString(), json]]);
  }
  if (sheet.getLastRow() > 2) sheet.deleteRows(3, sheet.getLastRow() - 2);
}

// ── AdminStatePartition helpers ──────────────────────────────────

function readPartitionState(adminId) {
  const sheet = getOrCreateSheet(SHEET_ADMIN_STATE_PART, ['AdminId', 'UpdatedAt', 'StateJSON']);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(adminId)) {
      try { return JSON.parse(rows[i][2] || '{}'); } catch(e) { return {}; }
    }
  }
  return {};
}

function writePartitionState(adminId, partition) {
  const sheet = getOrCreateSheet(SHEET_ADMIN_STATE_PART, ['AdminId', 'UpdatedAt', 'StateJSON']);
  const rows = sheet.getDataRange().getValues();
  const json = JSON.stringify(partition);
  const now  = new Date().toISOString();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(adminId)) {
      sheet.getRange(i + 1, 2, 1, 2).setValues([[now, json]]);
      return;
    }
  }
  sheet.appendRow([adminId, now, json]);
}

function readAllPartitions() {
  const sheet = getOrCreateSheet(SHEET_ADMIN_STATE_PART, ['AdminId', 'UpdatedAt', 'StateJSON']);
  const rows = sheet.getDataRange().getValues();
  const result = {};
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    try {
      const s = JSON.parse(rows[i][2] || '{}');
      result[String(rows[i][0])] = {
        managedLocations: s.managedLocations || [],
        managedEmployees: s.managedEmployees || [],
      };
    } catch(e) {}
  }
  return result;
}

// ── EmpAccounts helpers ───────────────────────────────────────────
function readEmpAccounts() {
  const sheet = getOrCreateSheet(SHEET_EMP_ACCOUNTS, ['Name', 'PasswordHash']);
  const rows = sheet.getDataRange().getValues();
  const accounts = {};
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0]) accounts[rows[i][0]] = { passwordHash: rows[i][1] };
  }
  return accounts;
}

function writeEmpAccounts(accounts) {
  const sheet = getOrCreateSheet(SHEET_EMP_ACCOUNTS, ['Name', 'PasswordHash']);
  const rows = [['Name', 'PasswordHash']];
  for (const [name, acct] of Object.entries(accounts)) {
    rows.push([name, acct.passwordHash || '']);
  }
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  if (sheet.getLastRow() > rows.length) {
    sheet.deleteRows(rows.length + 1, sheet.getLastRow() - rows.length);
  }
}

function upsertEmpAccount(name, passwordHash) {
  const sheet = getOrCreateSheet(SHEET_EMP_ACCOUNTS, ['Name', 'PasswordHash']);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === name) { sheet.getRange(i + 1, 2).setValue(passwordHash); return; }
  }
  sheet.appendRow([name, passwordHash]);
}

function deleteEmpAccountSheet(name) {
  const sheet = getOrCreateSheet(SHEET_EMP_ACCOUNTS, ['Name', 'PasswordHash']);
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] === name) sheet.deleteRow(i + 1);
  }
}

// 同步员工密码到 SharedState
function syncEmpPasswordToShared(name, newPasswordHash) {
  try {
    const shared = readSharedState();
    if (!shared.employeeAccounts) shared.employeeAccounts = {};
    shared.employeeAccounts[name] = { passwordHash: newPasswordHash };
    writeSharedState(shared);
  } catch(e) {}
}

// ── doPost ────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const data   = JSON.parse(e.postData.contents);
    const action = data.action;

    // ── 提交员工班表 ──
    if (!action || action === 'submitSchedule') {
      const sheet = getOrCreateSheet(SHEET_SUBMISSIONS, ['Name','Year','Month','Version','SubmittedAt','ScheduleJSON','Note']);
      const rows = sheet.getDataRange().getValues();
      const todayStr = new Date().toISOString().slice(0, 10);

      let currentRowIdx = -1, prevRowIdx = -1, currentSchedule = null;
      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i][0] === data.name && rows[i][1] === data.year && rows[i][2] === data.month) {
          const ver = rows[i][3];
          if (ver === 'prev' && prevRowIdx === -1) prevRowIdx = i + 1;
          else if (ver !== 'prev' && currentRowIdx === -1) {
            currentRowIdx = i + 1;
            try { currentSchedule = JSON.parse(rows[i][5] || '[]'); } catch(e) { currentSchedule = []; }
          }
        }
      }

      if (currentRowIdx === -1) {
        sheet.appendRow([data.name, data.year, data.month, 'current', data.submittedAt, JSON.stringify(data.schedule), data.note || '']);
      } else {
        const mergedSchedule = (data.schedule || []).map(entry => {
          if (entry.date < todayStr) {
            const oldEntry = (currentSchedule || []).find(e => e.date === entry.date);
            return oldEntry || entry;
          }
          return entry;
        });
        if (prevRowIdx !== -1) {
          const delFirst = Math.max(prevRowIdx, currentRowIdx);
          const delSecond = Math.min(prevRowIdx, currentRowIdx);
          sheet.deleteRow(delFirst);
          sheet.deleteRow(delSecond);
        } else {
          sheet.deleteRow(currentRowIdx);
        }
        const oldNote = rows[currentRowIdx - 1][6] || '';
        const oldSubmittedAt = rows[currentRowIdx - 1][4] || '';
        sheet.appendRow([data.name, data.year, data.month, 'prev', oldSubmittedAt, JSON.stringify(currentSchedule), oldNote]);
        sheet.appendRow([data.name, data.year, data.month, 'current', data.submittedAt, JSON.stringify(mergedSchedule), data.note || '']);
      }
      return jsonResponse({ success: true });
    }

    // ── 清除员工提交的 prev 记录 ──
    if (action === 'clearPrevSubmission') {
      const { name, year, month } = data;
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SUBMISSIONS);
      if (!sheet) return jsonResponse({ success: true });
      const rows = sheet.getDataRange().getValues();
      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i][0] === name && rows[i][1] === year && rows[i][2] === month && rows[i][3] === 'prev') {
          sheet.deleteRow(i + 1);
        }
      }
      return jsonResponse({ success: true });
    }

    // ── 保存管理员状态（共享 + 分区）──
    if (action === 'saveAdminState') {
      const { adminId, shared, partition } = data;
      if (!adminId) return jsonResponse({ success: false, error: 'Missing adminId' });
      if (shared) {
        const existing = readSharedState();
        // ── shared 字段全量 merge：以 existing 为基础，incoming 只补充/更新，不删除 ──
        // allEmployees：合并（existing + incoming，取并集）
        const mergedAllEmp = Object.assign({}, existing.allEmployees || {}, shared.allEmployees || {});
        // resignedEmployees：合并
        const mergedResigned = Object.assign({}, existing.resignedEmployees || {}, shared.resignedEmployees || {});
        // permanentlyDeleted：合并
        const mergedDeleted = Object.assign({}, existing.permanentlyDeleted || {}, shared.permanentlyDeleted || {});
        // employeeAccounts：合并（incoming 优先，保留 existing 里 incoming 没有的）
        const mergedEmpAccounts = Object.assign({}, existing.employeeAccounts || {}, shared.employeeAccounts || {});
        // locations：取并集（保留所有地点）
        const existingLocs = existing.locations || [];
        const incomingLocs = shared.locations || [];
        const mergedLocs = [...new Set([...existingLocs, ...incomingLocs])];
        // confirmedWeeks：合并
        const mergedConfirmed = Object.assign({}, existing.confirmedWeeks || {}, shared.confirmedWeeks || {});
        // slotLimits：合并
        const mergedSlotLimits = Object.assign({}, existing.slotLimits || {}, shared.slotLimits || {});
        // locSettings：合并
        const mergedLocSettings = Object.assign({}, existing.locSettings || {}, shared.locSettings || {});
        // submissions：合并（按 year||month key）
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
          confirmedWeeks:     mergedConfirmed,
          slotLimits:         mergedSlotLimits,
          locSettings:        mergedLocSettings,
          submissions:        mergedSubmissions,
          locationMap:        mergedLocMap,
        };
        writeSharedState(mergedShared);
        writeEmpAccounts(mergedEmpAccounts);
      }
      if (partition) {
        writePartitionState(adminId, partition);
      }
      return jsonResponse({ success: true });
    }

    // ── 保存排班表（单个地点单月），含冲突优先级判断 ──
    if (action === 'saveSchedule') {
      const { loc, year, month, schedule, adminId } = data;
      const sheet = getOrCreateSheet(SHEET_SCHEDULES, ['Loc','Year','Month','UpdatedAt','ScheduleJSON']);
      let finalSchedule = schedule || {};
      const conflicts = [];

      // 冲突优先级判断
      if (adminId && finalSchedule.days) {
        const rows = sheet.getDataRange().getValues();
        const partitions = readAllPartitions();
        const locOwnerMap = {};
        for (const [aid, pd] of Object.entries(partitions)) {
          (pd.managedLocations || []).forEach(l => { locOwnerMap[l] = aid; });
        }

        for (const [daySlotKey, names] of Object.entries(finalSchedule.days)) {
          if (!daySlotKey.endsWith('||start')) continue;
          const dateKey = daySlotKey.replace('||start', '');
          for (const name of [...names]) {
            for (let i = 1; i < rows.length; i++) {
              if (rows[i][0] === loc || rows[i][1] !== year || rows[i][2] !== month) continue;
              const otherLoc = rows[i][0];
              try {
                const otherSched = JSON.parse(rows[i][4] || '{}');
                const otherStart = (otherSched.days || {})[`${dateKey}||start`] || [];
                if (!otherStart.includes(name)) continue;
                const otherAdminId = locOwnerMap[otherLoc] || '1';
                if (parseInt(adminId) > parseInt(otherAdminId)) {
                  finalSchedule.days[daySlotKey] = finalSchedule.days[daySlotKey].filter(n => n !== name);
                  const endKey = `${dateKey}||end`;
                  if (finalSchedule.days[endKey]) finalSchedule.days[endKey] = finalSchedule.days[endKey].filter(n => n !== name);
                  conflicts.push({ name, date: dateKey, otherLoc, otherAdminId });
                }
              } catch(err) {}
            }
          }
        }
      }

      const schedJson = JSON.stringify(finalSchedule);
      const updatedAt = new Date().toISOString();
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === loc && rows[i][1] === year && rows[i][2] === month) {
          sheet.getRange(i + 1, 4, 1, 2).setValues([[updatedAt, schedJson]]);
          return jsonResponse({ success: true, updatedAt, conflicts });
        }
      }
      sheet.appendRow([loc, year, month, updatedAt, schedJson]);
      return jsonResponse({ success: true, updatedAt, conflicts });
    }

    // ── 删除某员工的所有提交记录 ──
    if (action === 'deleteEmployeeSubmissions') {
      const sheet = getOrCreateSheet(SHEET_SUBMISSIONS, ['Name','Year','Month','Version','SubmittedAt','ScheduleJSON','Note']);
      const rows = sheet.getDataRange().getValues();
      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i][0] === data.name) sheet.deleteRow(i + 1);
      }
      return jsonResponse({ success: true });
    }

    // ── 修改管理员密码 ──
    if (action === 'changePassword') {
      const { adminId, oldPassword, newPassword } = data;
      if (!adminId) return jsonResponse({ success: false, error: '缺少管理员ID' });
      if (!verifyAdminPassword(adminId, oldPassword)) {
        return jsonResponse({ success: false, error: '当前密码错误' });
      }
      setAdminAccountHash(adminId, sha256(newPassword));
      return jsonResponse({ success: true });
    }

    // ── 员工修改自己的密码 ──
    if (action === 'changeEmpPassword') {
      const { name, oldPasswordHash, newPasswordHash } = data;
      const accounts = readEmpAccounts();
      if (!accounts[name]) return jsonResponse({ success: false, error: '账号不存在' });
      if (accounts[name].passwordHash !== oldPasswordHash) {
        return jsonResponse({ success: false, error: '当前密码错误' });
      }
      upsertEmpAccount(name, newPasswordHash);
      syncEmpPasswordToShared(name, newPasswordHash);
      return jsonResponse({ success: true });
    }

    // ── 管理员重置员工密码 ──
    if (action === 'resetEmpPassword') {
      upsertEmpAccount(data.name, DEFAULT_PW_HASH);
      syncEmpPasswordToShared(data.name, DEFAULT_PW_HASH);
      return jsonResponse({ success: true });
    }

    // ── 管理员删除员工账号 ──
    if (action === 'deleteEmpAccount') {
      deleteEmpAccountSheet(data.name);
      return jsonResponse({ success: true });
    }

    // ── 管理员创建员工账号 ──
    if (action === 'createEmpAccount') {
      upsertEmpAccount(data.name, DEFAULT_PW_HASH);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ success: false, error: 'Unknown action' });

  } catch(err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ── doGet ─────────────────────────────────────────────────────────
function doGet(e) {
  const action = e.parameter.action;

  // ── 获取员工班表提交 ──
  if (action === 'getSubmissions') {
    const year  = parseInt(e.parameter.year);
    const month = parseInt(e.parameter.month);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SUBMISSIONS);
    if (!sheet) return jsonResponse({ submissions: [] });
    const rows = sheet.getDataRange().getValues();
    const submissions = [], prevMap = {};
    function safeParseSchedule(raw) {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch(e) { return []; }
    }
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[1] === year && row[2] === month) {
        if (row[3] === 'prev') {
          prevMap[row[0]] = { schedule: safeParseSchedule(row[5]), submittedAt: row[4] };
        } else {
          const entry = { name: row[0], year: row[1], month: row[2], submittedAt: row[4], schedule: safeParseSchedule(row[5]) };
          if (row[6]) entry.note = row[6];
          submissions.push(entry);
        }
      }
    }
    submissions.forEach(s => { if (prevMap[s.name]) s.prev = prevMap[s.name]; });
    return jsonResponse({ submissions });
  }

  // ── 获取管理员状态（共享 + 指定管理员分区）──
  if (action === 'getAdminState') {
    const adminId   = e.parameter.adminId;
    const shared    = readSharedState();
    const partition = adminId ? readPartitionState(adminId) : {};
    return jsonResponse({ success: true, shared, partition });
  }

  // ── 验证管理员密码 ──
  if (action === 'verifyPassword') {
    const adminId  = e.parameter.adminId;
    const password = e.parameter.password;
    if (!adminId || !password) return jsonResponse({ success: false });
    const ok = verifyAdminPassword(adminId, password);
    return jsonResponse({ success: ok, adminId });
  }

  // ── 获取所有管理员分区摘要（managedLocations/managedEmployees）──
  if (action === 'getAllPartitions') {
    const partitions = readAllPartitions();
    return jsonResponse({ success: true, partitions });
  }

  // ── 获取员工账号列表 ──
  if (action === 'getEmpAccounts') {
    const shared = readSharedState();
    if (shared.employeeAccounts && Object.keys(shared.employeeAccounts).length > 0) {
      writeEmpAccounts(shared.employeeAccounts);
      return jsonResponse({ success: true, accounts: shared.employeeAccounts });
    }
    const accounts = readEmpAccounts();
    return jsonResponse({ success: true, accounts });
  }

  // ── 获取排班表（单个地点单月）──
  if (action === 'getSchedule') {
    const loc   = e.parameter.loc;
    const year  = parseInt(e.parameter.year);
    const month = parseInt(e.parameter.month);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SCHEDULES);
    if (!sheet || sheet.getLastRow() < 2) return jsonResponse({ success: true, schedule: null });
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === loc && rows[i][1] === year && rows[i][2] === month) {
        try { return jsonResponse({ success: true, schedule: JSON.parse(rows[i][4] || '{}') }); }
        catch(err) { return jsonResponse({ success: true, schedule: null }); }
      }
    }
    return jsonResponse({ success: true, schedule: null });
  }

  return jsonResponse({ error: 'Unknown action' });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
