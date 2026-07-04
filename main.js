// ─────────────────────────────────────────────────────────────
// Atarah Quiz — Live Scoreboard (Firebase Realtime Database edition)
// ─────────────────────────────────────────────────────────────

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const ROOM_PREFIX = 'rooms/'; // Firebase path: rooms/{code}
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I, avoids confusion
const MAX_TEAMS = 12;
const MAX_ROUNDS = 25;

let state = null;
let roomCode = null;
let saveTimer = null;
let dirty = false;
let latestRemoteState = null;
let roomRef = null;
let idleCheckTimer = null;

function roomPath(code){ return ROOM_PREFIX + code; }

function genRoomCode(){
  let s = '';
  for(let i=0;i<5;i++){ s += CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)]; }
  return s;
}

function defaultState(){
  const teams = [];
  for(let i=1;i<=6;i++){
    teams.push({name:'Team '+i, scores:[0,0,0,0,0]});
  }
  const roundNames = [1,2,3,4,5].map(r=>'Round '+r);
  return {numRounds:5, roundNames, teams};
}

function migrateState(s){
  if(!s.roundNames || !Array.isArray(s.roundNames)){
    s.roundNames = [];
    for(let r=0;r<s.numRounds;r++){ s.roundNames.push('Round '+(r+1)); }
  }
  while(s.roundNames.length < s.numRounds){ s.roundNames.push('Round '+(s.roundNames.length+1)); }
  return s;
}

async function roomExists(code){
  const snap = await db.ref(roomPath(code)).once('value');
  return snap.exists() ? migrateState(snap.val()) : null;
}

async function writeRoomState(){
  try{
    await db.ref(roomPath(roomCode)).set(state);
    setStatus('Saved ✓');
  }catch(e){
    setStatus('Could not save — check connection');
    console.error(e);
  }
}

function setStatus(msg){
  const el = document.getElementById('statusMsg');
  if(!el) return;
  el.textContent = msg;
  if(msg){ setTimeout(()=>{ if(el.textContent===msg) el.textContent=''; }, 1800); }
}

function queueSave(){
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async ()=>{
    await writeRoomState();
    dirty = false;
  }, 500);
}

function totalFor(team){
  return team.scores.reduce((a,b)=>a+(Number(b)||0),0);
}

function isEditingNow(){
  const activeEl = document.activeElement;
  return !!(activeEl && (activeEl.classList.contains('score') || activeEl.classList.contains('name-input') || activeEl.classList.contains('round-name-input')));
}

function render(){
  renderLeaderboard();
  renderTable();
}

function renderLeaderboard(){
  const lb = document.getElementById('leaderboard');
  const ranked = state.teams.map((t,i)=>({...t, idx:i, total:totalFor(t)}))
    .sort((a,b)=>b.total-a.total);
  lb.innerHTML = '';
  if(ranked.length===0){
    lb.innerHTML = '<div class="status-msg">No teams yet — add one below.</div>';
    return;
  }
  ranked.forEach((t,pos)=>{
    const row = document.createElement('div');
    row.className = 'lb-row' + (pos===0 && t.total>0 ? ' first':'');
    row.innerHTML = `<div class="lb-rank">${pos+1}</div><div class="lb-name">${escapeHtml(t.name||('Team '+(t.idx+1)))}</div><div class="lb-score">${t.total}</div>`;
    lb.appendChild(row);
  });
}

function escapeHtml(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
function escapeAttr(s){
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}

function renderTable(){
  const headRow = document.getElementById('headRow');
  const bodyRows = document.getElementById('bodyRows');
  headRow.innerHTML = '';
  bodyRows.innerHTML = '';

  let h = '<th>#</th><th style="text-align:left;">Team</th>';
  for(let r=0;r<state.numRounds;r++){
    const rn = state.roundNames[r] !== undefined ? state.roundNames[r] : ('Round '+(r+1));
    h += `<th><input type="text" class="round-name-input" data-round="${r}" value="${escapeAttr(rn)}"/></th>`;
  }
  h += '<th>Total</th><th></th>';
  headRow.innerHTML = h;

  headRow.querySelectorAll('.round-name-input').forEach(inp=>{
    inp.addEventListener('input', e=>{
      const rIdx = Number(e.target.dataset.round);
      state.roundNames[rIdx] = e.target.value;
      queueSave();
    });
  });

  const withTotals = state.teams.map((t,i)=>({...t, idx:i, total:totalFor(t)}));
  const sortedTotals = [...withTotals].sort((a,b)=>b.total-a.total).map(t=>t.total);

  state.teams.forEach((team, tIdx)=>{
    const total = totalFor(team);
    const rank = sortedTotals.indexOf(total) + 1;
    const tr = document.createElement('tr');
    if(rank===1 && total>0) tr.classList.add('leader');

    let rowHtml = `<td class="rank-cell">${rank}</td>`;
    rowHtml += `<td class="team-name-cell"><input type="text" value="${escapeAttr(team.name)}" data-team="${tIdx}" class="name-input"/></td>`;
    for(let r=0;r<state.numRounds;r++){
      const val = team.scores[r] !== undefined ? team.scores[r] : 0;
      rowHtml += `<td><input type="number" class="score" value="${val}" data-team="${tIdx}" data-round="${r}"/></td>`;
    }
    rowHtml += `<td class="total-cell">${total}</td>`;
    rowHtml += `<td><div class="rowctl"><button class="small danger remove-team" data-team="${tIdx}">✕</button></div></td>`;
    tr.innerHTML = rowHtml;
    bodyRows.appendChild(tr);
  });

  bodyRows.querySelectorAll('.name-input').forEach(inp=>{
    inp.addEventListener('input', e=>{
      const idx = Number(e.target.dataset.team);
      state.teams[idx].name = e.target.value;
      renderLeaderboard();
      queueSave();
    });
  });
  bodyRows.querySelectorAll('.score').forEach(inp=>{
    inp.addEventListener('input', e=>{
      const tIdx = Number(e.target.dataset.team);
      const rIdx = Number(e.target.dataset.round);
      state.teams[tIdx].scores[rIdx] = e.target.value === '' ? 0 : Number(e.target.value);
      render();
      queueSave();
    });
  });
  bodyRows.querySelectorAll('.remove-team').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const idx = Number(e.target.dataset.team);
      state.teams.splice(idx,1);
      render();
      queueSave();
    });
  });

  document.getElementById('addTeamBtn').disabled = state.teams.length >= MAX_TEAMS;
  document.getElementById('addRoundBtn').disabled = state.numRounds >= MAX_ROUNDS;
  document.getElementById('removeRoundBtn').disabled = state.numRounds <= 1;
}

document.getElementById('addTeamBtn').addEventListener('click', ()=>{
  if(state.teams.length >= MAX_TEAMS) return;
  state.teams.push({name:'Team '+(state.teams.length+1), scores:new Array(state.numRounds).fill(0)});
  render();
  queueSave();
});

document.getElementById('addRoundBtn').addEventListener('click', ()=>{
  if(state.numRounds >= MAX_ROUNDS) return;
  state.numRounds += 1;
  state.roundNames.push('Round '+state.numRounds);
  state.teams.forEach(t=>t.scores.push(0));
  render();
  queueSave();
});

document.getElementById('removeRoundBtn').addEventListener('click', ()=>{
  if(state.numRounds <= 1) return;
  state.numRounds -= 1;
  state.roundNames.pop();
  state.teams.forEach(t=>t.scores.pop());
  render();
  queueSave();
});

document.getElementById('resetBtn').addEventListener('click', ()=>{
  if(!confirm('Reset all scores to zero? Team names and rounds stay the same.')) return;
  state.teams.forEach(t=>{ t.scores = new Array(state.numRounds).fill(0); });
  render();
  queueSave();
});

function showScreen(id){
  ['gateChoice','gateHost','gateJoin','appMain'].forEach(s=>{
    document.getElementById(s).classList.toggle('hidden', s!==id);
  });
}

function attachRoomListener(code){
  if(roomRef){ roomRef.off(); }
  roomRef = db.ref(roomPath(code));
  roomRef.on('value', snap=>{
    if(!snap.exists()) return;
    const data = migrateState(snap.val());
    latestRemoteState = data;
    if(!isEditingNow()){
      const freshJSON = JSON.stringify(data);
      const curJSON = JSON.stringify(state);
      if(freshJSON !== curJSON){
        state = data;
        render();
      }
    }
  });

  clearInterval(idleCheckTimer);
  idleCheckTimer = setInterval(()=>{
    if(latestRemoteState && !isEditingNow() && !dirty){
      const freshJSON = JSON.stringify(latestRemoteState);
      const curJSON = JSON.stringify(state);
      if(freshJSON !== curJSON){
        state = latestRemoteState;
        render();
      }
    }
  }, 2000);
}

async function enterRoom(code, seedIfMissing){
  let existing = await roomExists(code);
  if(!existing){
    if(!seedIfMissing) return false;
    state = defaultState();
    roomCode = code;
    await writeRoomState();
  } else {
    state = existing;
    roomCode = code;
  }
  document.getElementById('currentRoomLabel').textContent = roomCode;
  render();
  showScreen('appMain');
  attachRoomListener(roomCode);
  return true;
}

document.getElementById('showHostBtn').addEventListener('click', async ()=>{
  let code = genRoomCode();
  let existing = await roomExists(code);
  let tries = 0;
  while(existing && tries < 5){ code = genRoomCode(); existing = await roomExists(code); tries++; }
  document.getElementById('hostCodeDisplay').textContent = code;
  document.getElementById('gateHost').dataset.pendingCode = code;
  showScreen('gateHost');
});

document.getElementById('enterHostedRoomBtn').addEventListener('click', async ()=>{
  const code = document.getElementById('gateHost').dataset.pendingCode;
  await enterRoom(code, true);
});

document.getElementById('copyCodeBtn').addEventListener('click', async ()=>{
  const code = document.getElementById('gateHost').dataset.pendingCode;
  try{
    await navigator.clipboard.writeText(code);
    setButtonFlash('copyCodeBtn','Copied ✓');
  }catch(e){
    setButtonFlash('copyCodeBtn','Code: '+code);
  }
});

function setButtonFlash(id, msg){
  const btn = document.getElementById(id);
  const original = btn.textContent;
  btn.textContent = msg;
  setTimeout(()=>{ btn.textContent = original; }, 1500);
}

document.getElementById('backFromHostBtn').addEventListener('click', ()=> showScreen('gateChoice'));
document.getElementById('backFromJoinBtn').addEventListener('click', ()=> showScreen('gateChoice'));

document.getElementById('showJoinBtn').addEventListener('click', ()=>{
  document.getElementById('joinCodeInput').value = '';
  document.getElementById('joinError').textContent = '';
  showScreen('gateJoin');
  setTimeout(()=>document.getElementById('joinCodeInput').focus(), 50);
});

document.getElementById('joinCodeInput').addEventListener('input', e=>{
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');
});
document.getElementById('joinCodeInput').addEventListener('keydown', e=>{
  if(e.key === 'Enter'){ document.getElementById('submitJoinBtn').click(); }
});

document.getElementById('submitJoinBtn').addEventListener('click', async ()=>{
  const code = document.getElementById('joinCodeInput').value.trim();
  const errEl = document.getElementById('joinError');
  if(!code){ errEl.textContent = 'Enter a room code.'; return; }
  errEl.textContent = 'Looking for room…';
  const ok = await enterRoom(code, false);
  if(!ok){ errEl.textContent = 'No room found with that code. Check with your host and try again.'; }
});

document.getElementById('leaveRoomBtn').addEventListener('click', ()=>{
  if(roomRef){ roomRef.off(); roomRef = null; }
  clearInterval(idleCheckTimer);
  roomCode = null;
  state = null;
  latestRemoteState = null;
  showScreen('gateChoice');
});

showScreen('gateChoice');
