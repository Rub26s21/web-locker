// popup.js - manages locks, master password (stores SHA-256 hashes) and CSV export/import
const currentUrlEl = document.getElementById('currentUrl');
const scopeInput = document.getElementById('scope');
const pwInput = document.getElementById('password');
const lockBtn = document.getElementById('lockBtn');
const unlockBtn = document.getElementById('unlockBtn');
const listEl = document.getElementById('list');
const statusEl = document.getElementById('status');

const masterPwInput = document.getElementById('masterPassword');
const setMasterBtn = document.getElementById('setMaster');
const clearMasterBtn = document.getElementById('clearMaster');

const exportBtn = document.getElementById('exportCsv');
const importFile = document.getElementById('importFile');

function showStatus(msg, err=false){
  statusEl.textContent = msg;
  statusEl.style.color = err ? 'red' : 'green';
  setTimeout(()=> statusEl.textContent = '', 4000);
}

async function getCurrentTab(){
  const tabs = await chrome.tabs.query({active:true, currentWindow:true});
  return tabs[0];
}

function normalizeScope(text){
  text = (text || '').trim();
  if(!text) return '';
  return text;
}

function loadLocksToList(locks){
  listEl.innerHTML = '';
  const keys = Object.keys(locks || {});
  if(keys.length === 0){
    listEl.textContent = 'No locks saved — எந்த பூட்டும் இல்லை.';
    return;
  }
  keys.forEach(k => {
    const div = document.createElement('div');
    div.className = 'lock-item';
    const left = document.createElement('div');
    left.className = 'lock-key';
    left.textContent = k;
    const right = document.createElement('div');
    const remove = document.createElement('button');
    remove.className = 'small-btn';
    remove.textContent = 'Remove / அகற்று';
    remove.addEventListener('click', async () => {
      const r = confirm('Remove lock for ' + k + ' ? / நீக்கு?');
      if(!r) return;
      chrome.storage.local.get(['locks'], res => {
        const locks = res.locks || {};
        delete locks[k];
        chrome.storage.local.set({locks}, ()=> {
          showStatus('Removed');
          loadAllLocks();
        });
      });
    });
    right.appendChild(remove);
    div.appendChild(left);
    div.appendChild(right);
    listEl.appendChild(div);
  });
}

function loadAllLocks(){
  chrome.storage.local.get(['locks'], res => {
    const locks = res.locks || {};
    loadLocksToList(locks);
  });
}

// text -> hex SHA-256
async function sha256Hex(text){
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(hash));
  return bytes.map(b => b.toString(16).padStart(2,'0')).join('');
}

lockBtn.addEventListener('click', async () => {
  const scope = normalizeScope(scopeInput.value) || scopeInput.placeholder;
  const pw = pwInput.value.trim();
  if(!scope || !pw){ showStatus('Enter scope & password', true); return; }
  const h = await sha256Hex(pw);
  chrome.storage.local.get(['locks'], res => {
    const locks = res.locks || {};
    locks[scope] = h; // store hash
    chrome.storage.local.set({locks}, ()=> {
      showStatus('Locked ✅');
      pwInput.value = '';
      loadAllLocks();
    });
  });
});

unlockBtn.addEventListener('click', async () => {
  const scope = normalizeScope(scopeInput.value);
  if(!scope){ showStatus('Enter scope to unlock', true); return; }
  chrome.storage.local.get(['locks'], res => {
    const locks = res.locks || {};
    if(locks[scope]){
      delete locks[scope];
      chrome.storage.local.set({locks}, ()=> {
        showStatus('Unlocked ✅');
        loadAllLocks();
      });
    } else {
      showStatus('No lock found for that scope', true);
    }
  });
});

// Master password handlers
setMasterBtn.addEventListener('click', async () => {
  const mpw = masterPwInput.value.trim();
  if(!mpw){ showStatus('Enter master password', true); return; }
  const mh = await sha256Hex(mpw);
  chrome.storage.local.set({masterHash: mh}, () => {
    masterPwInput.value = '';
    showStatus('Master password set ✅');
  });
});

clearMasterBtn.addEventListener('click', () => {
  const r = confirm('Clear master password? This will remove the master unlock. / நீக்கு?');
  if(!r) return;
  chrome.storage.local.remove(['masterHash'], ()=>{
    showStatus('Master password cleared');
  });
});

// CSV export: scope,hash (no header)
exportBtn.addEventListener('click', () => {
  chrome.storage.local.get(['locks'], res => {
    const locks = res.locks || {};
    const rows = Object.entries(locks).map(([k,v]) => `${escapeCsv(k)},${v}`);
    const csv = rows.join('\n');
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'weblocker-locks.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showStatus('Exported CSV');
  });
});

function escapeCsv(s){
  if(s.includes(',') || s.includes('"') || s.includes('\n')){
    return '"' + s.replace(/"/g,'""') + '"';
  }
  return s;
}

// CSV import: expects scope,hash per line; will add/overwrite locks
importFile.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const text = ev.target.result;
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const imported = {};
    for(const line of lines){
      // basic CSV split (no header): scope,hash
      const parts = parseCsvLine(line);
      if(parts.length >= 2){
        const scope = parts[0];
        const hash = parts[1];
        imported[scope] = hash;
      }
    }
    if(Object.keys(imported).length === 0){ showStatus('No valid rows found in CSV', true); return; }
    chrome.storage.local.get(['locks'], res => {
      const locks = res.locks || {};
      // merge (overwrite existing keys)
      Object.assign(locks, imported);
      chrome.storage.local.set({locks}, () => {
        showStatus('Imported ' + Object.keys(imported).length + ' locks');
        loadAllLocks();
      });
    });
  };
  reader.readAsText(f);
  importFile.value = '';
});

function parseCsvLine(line){
  // very simple CSV parser for two columns
  // handles quoted values
  const parts = [];
  let cur = '';
  let inQuotes = false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(ch === '"') {
      if(inQuotes && line[i+1] === '"') { cur += '"'; i++; continue; }
      inQuotes = !inQuotes;
      continue;
    }
    if(ch === ',' && !inQuotes){ parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  parts.push(cur);
  return parts.map(p => p.trim());
}

(async function init(){
  const tab = await getCurrentTab();
  const url = tab?.url || '';
  currentUrlEl.textContent = url || '—';
  try {
    const u = new URL(url);
    scopeInput.placeholder = u.hostname;
  } catch(e){}
  loadAllLocks();
})();
