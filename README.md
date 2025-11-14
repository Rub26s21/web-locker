# WEB LOCKER

Client-side Chrome extension to lock websites with passwords. This version supports a **master password** and stores passwords as **SHA-256 hex hashes** in `chrome.storage.local`.

**Important:** hashing helps avoid storing plain text, but this is still client-side protection. A user with devtools or file access can bypass or remove the overlay. Suitable for student/dev use and MVP.

## Files
- `manifest.json` — extension manifest
- `popup.html`, `popup.js`, `style.css` — popup UI and logic
- `locker.js`, `locker.css` — content script overlay and styles
- `icons/` — add `icon16.png`, `icon48.png`, `icon128.png`

## Install (local testing)
1. Save folder `web-locker/` with files and `icons/` inside.
2. Open Chrome → `chrome://extensions/`.
3. Enable **Developer mode** and click **Load unpacked** → select `web-locker/`.

## Usage
- Open a tab, click the WEB LOCKER icon.
- Set a scope (domain or full URL) and a password, click **Lock**.
- Optionally set **Master password** to unlock any locked site.
- When a locked page loads an overlay will block interaction until correct password is entered.

## CSV Export/Import
- You can export locks to CSV (`scope,hash`) and import a CSV to add/overwrite locks.

## Notes / Next
- Add password salt + PBKDF2 for stronger client-side hashing if desired.
- Add translations for Tamil strings if you want fully localized UI.
