# Expenses

Fast expense tracker with Cashew-style screens: type the amount, tap a category, done.

Open `index.html` in a browser, or host the folder over https so a phone can install it
(Chrome menu > Add to Home screen). Everything works offline; data stays on the device.

## Sync between phone and PC (optional, free)

1. Make a new Google Sheet, then **Extensions > Apps Script**.
2. Paste all of `expense_backend.gs`, save, run `setup` once and allow access.
   The execution log shows your **sync key**.
3. **Deploy > New deployment > Web app**, Execute as **Me**, Who has access **Anyone**. Copy the URL.
4. In the app: **More > Settings > Google Sheet sync**: paste the URL and key, then tap Connect.
   Do the same on every device.

The sheet gets one row per transaction, account, category and budget. Read it freely, but edit
in the app: the app only reads the `json` column.

## Backup

Settings > Download a backup (JSON, restorable) or Export to spreadsheet (CSV).
