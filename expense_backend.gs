/**
 * Expenses: sync backend (Google Apps Script, bound to your own Google Sheet).
 *
 * Setup (once):
 *   1. New Google Sheet -> Extensions -> Apps Script -> paste this whole file -> Save.
 *   2. Run `setup` once and allow access. View -> Logs (or Execution log) shows your SYNC KEY.
 *   3. Deploy -> New deployment -> Web app -> Execute as: Me, Who has access: Anyone -> Deploy.
 *   4. In the app: Settings -> paste the Web app URL and the sync key -> Connect.
 *      Use the same URL and key on every phone and PC.
 *
 * Every record (entry, account, category, budget) is one row of the `records` tab. The app pushes
 * changed rows and pulls rows changed since its last sync; the newest edit (upd) of a row wins.
 * `srv` is this script's own counter, so a device's "since" cursor never misses a row.
 * The readable columns (date ... note) are for you to look at in the sheet; the app reads only `json`.
 * Deleted things stay as rows with del = 1, so the delete reaches every device.
 */

const SHEET = 'records';
const HEAD = ['id', 'kind', 'date', 'type', 'amount', 'category', 'account', 'note', 'upd', 'srv', 'del', 'json'];
const C = Object.fromEntries(HEAD.map((h, i) => [h, i]));

function doGet(e) { return handle_((e && e.parameter) || {}); }
function doPost(e) {
  let p = {};
  try { p = JSON.parse(e.postData.contents); } catch (err) {}
  return handle_(p);
}

function handle_(p) {
  try {
    const key = PropertiesService.getScriptProperties().getProperty('KEY');
    if (!key) return out_({ ok: false, app: 'expenses', error: 'Run setup in Apps Script first.' });
    if (p.key !== key) return out_({ ok: false, app: 'expenses', error: 'Wrong sync key.' });
    if (p.action === 'ping') return out_({ ok: true, app: 'expenses', rows: Math.max(0, sheet_().getLastRow() - 1) });
    if (p.action === 'sync') return out_(sync_(p));
    return out_({ ok: false, app: 'expenses', error: 'Unknown action.' });
  } catch (err) {
    return out_({ ok: false, app: 'expenses', error: String(err && err.message || err) });
  }
}

function sync_(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const props = PropertiesService.getScriptProperties();
    const sh = sheet_();
    const n = sh.getLastRow() - 1;
    const rows = n > 0 ? sh.getRange(2, 1, n, HEAD.length).getValues() : [];
    const idx = {};
    rows.forEach((r, i) => { idx[r[C.id]] = i; });

    let srv = Math.max(Number(props.getProperty('SRV') || 0), Date.now());
    const since = Number(p.since || 0);
    const changes = Array.isArray(p.changes) ? p.changes : [];
    const changed = {};
    const added = [];

    changes.forEach(c => {
      if (!c || !c.id) return;
      const upd = Number(c.upd) || 0;
      const i = idx[c.id];
      if (i != null && Number(rows[i][C.upd]) >= upd) return;     // the sheet already has this edit or a newer one
      const v = c.view || {};
      srv++;
      const row = [
        String(c.id), safe_(c.kind), safe_(v.date), safe_(v.type),
        v.amount === undefined || v.amount === '' ? '' : Number(v.amount) || 0,
        safe_(v.category), safe_(v.account), safe_(v.note),
        upd, srv, c.del ? 1 : 0,
        typeof c.data === 'string' ? c.data : JSON.stringify(c.data || {})
      ];
      if (i != null) { rows[i] = row; changed[i] = true; }
      else { idx[c.id] = rows.length; rows.push(row); added.push(row); }
    });

    Object.keys(changed).forEach(i => sh.getRange(Number(i) + 2, 1, 1, HEAD.length).setValues([rows[i]]));
    if (added.length) sh.getRange(n + 2, 1, added.length, HEAD.length).setValues(added);
    if (added.length || Object.keys(changed).length) props.setProperty('SRV', String(srv));

    const send = rows.filter(r => Number(r[C.srv]) > since)
      .map(r => ({ id: r[C.id], kind: r[C.kind], upd: Number(r[C.upd]) || 0, del: Number(r[C.del]) ? 1 : 0, data: String(r[C.json]) }));
    return { ok: true, app: 'expenses', now: srv, changes: send };
  } finally {
    lock.releaseLock();
  }
}

// text that starts with = + - @ would be read as a formula
function safe_(s) {
  s = s == null ? '' : String(s);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A:D').setNumberFormat('@');     // keep ids and dates as plain text
    sh.getRange('F:H').setNumberFormat('@');
    sh.getRange('L:L').setNumberFormat('@');
  }
  return sh;
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Run once. Creates the records tab and your sync key (kept in Script Properties, not in code). */
function setup() {
  sheet_();
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '').slice(0, 20);
    props.setProperty('KEY', key);
  }
  Logger.log('Your sync key: ' + key);
  Logger.log('Now: Deploy -> New deployment -> Web app -> Execute as Me, access Anyone. Paste the URL and this key in the app.');
}

/** Run if the key ever leaks. Every device then needs the new key in Settings. */
function newKey() {
  PropertiesService.getScriptProperties().deleteProperty('KEY');
  setup();
}
