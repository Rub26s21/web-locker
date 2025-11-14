// locker.js - runs on all pages at document_start
(function(){
  try {
    const run = async () => {
      const url = location.href;
      let hostname = '';
      try { hostname = location.hostname; } catch(e){}

      chrome.storage.local.get(['locks','masterHash'], async res => {
        const locks = res.locks || {};
        const masterHash = res.masterHash || null;
        const exactKey = url;
        const domainKey = hostname;
        const key = (locks[exactKey]) ? exactKey : ((locks[domainKey]) ? domainKey : null);
        if(!key) return; // no lock
        try {
          if(sessionStorage && sessionStorage.getItem('weblocker_unlocked_' + key) === '1') return;
        } catch(e){}
        insertOverlay(key, locks[key], masterHash);
      });
    };

    async function sha256Hex(text){
      const enc = new TextEncoder();
      const data = enc.encode(text);
      const hash = await crypto.subtle.digest('SHA-256', data);
      const bytes = Array.from(new Uint8Array(hash));
      return bytes.map(b => b.toString(16).padStart(2,'0')).join('');
    }

    function insertOverlay(key, storedHash, masterHash){
      if(document.getElementById('__weblocker_overlay')) return;
      const overlay = document.createElement('div');
      overlay.id = '__weblocker_overlay';
      overlay.innerHTML = `
        <div id="__weblocker_box" role="dialog" aria-modal="true">
          <h2>Site Locked — தளம் பூட்டப்பட்டுள்ளது</h2>
          <p>Enter password to continue / தொடர பாஸ்வேர்ட்டை உள்ளிடவும்</p>
          <input id="__weblocker_pw" type="password" placeholder="Password — பாஸ்வேர்ட்"/>
          <div id="__weblocker_btns">
            <button id="__weblocker_ok" class="__weblocker_btn">Unlock / திற</button>
            <button id="__weblocker_reload" class="__weblocker_btn">Reload</button>
          </div>
          <div id="__weblocker_msg"></div>
        </div>
      `;
      document.documentElement.appendChild(overlay);

      const pw = document.getElementById('__weblocker_pw');
      const ok = document.getElementById('__weblocker_ok');
      const msg = document.getElementById('__weblocker_msg');
      const reload = document.getElementById('__weblocker_reload');
      pw.focus();

      ok.addEventListener('click', async () => {
        const entered = pw.value || '';
        const h = await sha256Hex(entered);
        if(h === storedHash || (masterHash && h === masterHash)){
          try { sessionStorage.setItem('weblocker_unlocked_' + key, '1'); } catch(e){}
          overlay.remove();
        } else {
          msg.textContent = 'Incorrect password — தவறான பாஸ்வேர்ட்';
        }
      });

      pw.addEventListener('keydown', (e) => { if(e.key === 'Enter') ok.click(); });
      reload.addEventListener('click', ()=> location.reload());

      const stop = (ev) => { ev.stopPropagation(); ev.preventDefault && ev.preventDefault(); };
      ['click','mousedown','mouseup','keydown','keyup','keypress','touchstart'].forEach(evt=>{
        overlay.addEventListener(evt, stop, true);
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
      setTimeout(run, 500);
    } else {
      run();
    }
  } catch(err){
    console.error('WEB LOCKER content script error', err);
  }
})();
