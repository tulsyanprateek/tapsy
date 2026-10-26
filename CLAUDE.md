# Expenses (expense_tracker)

Personal expense tracker, working name "Expenses". Started 26 Oct 2026.
The owner uses Cashew (Android) and likes its features and reports, but entry takes too many taps.
Goal: Cashew's look and reports, with much faster entry. A Play Store release may come later.

**UX = Cashew's (Material You).** The owner asked for this explicitly; no other house style or branding here.

This repo is PUBLIC (served by GitHub Pages). Only app code goes in it: never transaction data, Cashew backups,
sync URLs or keys. Data lives on each device (IndexedDB) and in the user's own Google Sheet.

## Files

| File | What |
|---|---|
| `index.html` | The whole app: one HTML file, no build step. CSS + markup + JS. |
| `expense_backend.gs` | Google Apps Script sync backend, bound to the user's own Google Sheet. |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installable PWA + offline (only when served over https/localhost). |
| `fonts/` | Outfit (headings, amounts) + Hanken Grotesk (body), self-hosted. |
| `vendor/sqljs.js` | sql.js 1.10.3 (MIT) + its wasm as base64. Only the Cashew importer loads it, on demand. |

Run locally: any static server in this folder, e.g. `py -m http.server 3470` (service worker needs http(s), not file://).

## Fast entry (the point of the app)

New transaction = type the amount on the built-in keypad, tap a category, and it's saved (2 taps).
- Account and date carry over from last time (`P.lastAcc`), most-used categories first (`scoreUsage`, 45-day decay).
- "Again" chips repeat a recent transaction in one tap. A note typed before brings back its category and account.
- Keypad does + and − (`key()`, `amtValue()`). Edit mode never auto-saves on category tap; ✓ saves.
- `#add` opens the add screen (manifest shortcut "Add expense"), both on load and while already open.

## Data + sync

- Local first: IndexedDB `xp` (stores `rec`, `meta`); localStorage fallback if IDB is blocked.
- Every record `{id, kind, upd, del, ...}`; kinds `acc`, `cat` (has `color`), `bud`, `txn`. Deletes are soft (`del:1`) so they sync.
- Defaults (accounts, categories) have FIXED ids and `upd:0`, so new devices merge instead of duplicating.
  Budgets use fixed ids too (`b_all`, `b_<catId>`).
- Sync = POST `{action:'sync', key, since, changes}` to the Apps Script web app (text/plain body, no preflight).
  Server keeps the newest `upd` per id, stamps its own `srv` counter, and returns rows with `srv > since`.
  `dirty` ids + `cursor` live in IDB meta. One retry on failure (Google's redirect hop flakes).
- The sheet's readable columns (date, type, amount, category, account, note) are for humans; the app reads only `json`.
- Tested 26 Oct 2026 by running the real `.gs` in the page against an in-memory sheet stand-in: wrong key refused,
  first connect pushed everything, a second device's add / edit / delete arrived, a stale write did not win.
  **Not yet tried against a real Google Sheet.**

## Switching from Cashew (importer, 26 Oct 2026)

Settings > Import from Cashew. Reads Cashew's backup (`.sql` = its SQLite DB, via `vendor/sqljs.js` =
sql.js 1.10.3 MIT with the wasm inlined as base64 so it loads from file://) or its CSV export. Preview first, then apply.
- Cashew facts (from its source, `budget/lib/database/tables.dart`): amounts signed (expense < 0); `date_created` in
  seconds; `type` 3 = credit (lent), 4 = debt (borrowed); category `"0"` = Balance Correction; sub-categories have
  `main_category_pk`; `delete_logs.type` 4 = transaction. Balance = sum of all paid amounts; loans and corrections are
  NOT income/expense. Here they're `xt:'debt'|'credit'|'adj'`: in balances, out of every total (`is()`, `sumType`).
- Imported records carry `cw` (Cashew id) + `cwAt` (= upd when written). `upd > cwAt` means changed here: re-imports
  never touch it. Re-import: new = add, changed in Cashew = update, in delete log = delete (only if no longer in the table:
  Cashew logs some restored ones). Undo last import restores the snapshot in meta `lastImport`.
- Cashew saves several entries in the SAME SECOND on one account (seen in real data). Cross-file matching
  (CSV vs backup) uses second + account + type + amount, each used once; second + account alone only when exactly one
  is left on both sides. CSV ids = second + account + amount + title + repeat count.
- A Cashew entry with the same date, type and amount as one typed here is offered as "already typed here" (skipped by default).
- After saving, `cwVerify` reads back and checks each Cashew account's total against the file, and that nothing is stored twice.
- Tested with a real Cashew backup against independent Python totals: balances,
  income, spending, per category, per year all exact; repeat imports, CSV after backup, backup after CSV = 0 changes;
  a modified backup (edit, delete, new, plus an entry edited here) and Undo all behaved.
- Sub-categories: `sub` on the txn, cat records with `parent` (one level), shown as "Main › Sub", rolled up into the
  main category in reports, budgets and the category filter.

## Sub-categories on the add screen (26 Oct 2026)

A category without sub-categories still saves on tap (2 taps). One with sub-categories (marked "›" in the grid) swaps
the grid for its sub-categories (`A.subFor`, `midHTML()`): "Just <category>" first, then subs by usage, then New.
Tapping one saves (3 taps). "Again" chips and the note memory bring the sub-category back too.
Categories page lists subs under their main; ＋ with "Inside" makes a sub. Moving a category in or out of another moves
its transactions with it (`editCategory` onSave). Deleting a main deletes its subs; transactions keep the names.

## Look

- All colours come from one accent hue `--h` (Settings > Accent colour, `xp_hue`), light + dark (`xp_theme`, or follow the phone).
- Phone: bottom nav (Home, Transactions, Budgets, More) + FAB. ≥960px: sidebar with "Add transaction".
- Charts are hand-made (no libraries): home cumulative line this month vs last month (dashed), category donut
  (top 7 + Other) with ranked list, bars by day/month with an average line, income vs expense by month.
- Budget bars show a "today" mark; past it = spending ahead of pace.

## Not built yet (Cashew has these)

Recurring transactions / subscriptions, goals, sub-categories, multiple currencies, home-screen widget,
reading bank SMS. For Play Store: host over https (e.g. GitHub Pages), then wrap as a TWA (Bubblewrap / PWABuilder).
A public release would need real accounts instead of one sheet per user (Supabase or Firebase); the sync
protocol (records with id/upd/del) carries over.
