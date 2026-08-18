/* ═══════════════════════════════════════════════════════════
   PeGP RACE CONTROL — Pembroke Grand Prix, Season One
   quali (solo, best lap) → heats (wheel-to-wheel) → season
   ═══════════════════════════════════════════════════════════ */

'use strict';
const $ = id => document.getElementById(id);
const PTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const POLE_BONUS = 3;
const SAVE_KEY = 'pegp_v1';

/* ── state ── */
function newRound() {
  return { name: '', quali: {}, heats: [], nextGrid: null };
}
let S = null;
try { S = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) {}
if (!S || !S.roster) {
  S = { roster: [], nextId: 1, round: newRound(), season: { rounds: [] }, muted: false,
        qualiLaps: 3, heatLaps: 4 };
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
function team(id) { return S.roster.find(t => t.id === id) || { name: '???', kart: '', crew: [] }; }

/* crew roles */
const ROLES = ['DRIVER', 'RIDER', 'PIT MANAGER', 'MECHANIC', 'STRATEGIST', 'TARP SECURITY'];
const ROLE_ICON = { 'DRIVER': '🏃', 'RIDER': '🪑', 'PIT MANAGER': '📋', 'MECHANIC': '🔧', 'STRATEGIST': '🧠', 'TARP SECURITY': '🛡️' };
/* migrate old two-driver teams */
S.roster.forEach(t => {
  if (!t.crew) {
    t.crew = [];
    if (t.d1) t.crew.push({ name: t.d1, role: 'DRIVER' });
    if (t.d2) t.crew.push({ name: t.d2, role: 'RIDER' });
  }
});

/* ═══════════ AUDIO + ANNOUNCER ═══════════ */
let AC = null, voice = null, speechOK = false;
function bootAudio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (AC && AC.state === 'suspended') AC.resume();
  if ('speechSynthesis' in window && !speechOK) {
    speechOK = true; pickVoice(); speechSynthesis.onvoiceschanged = pickVoice;
  }
}
document.addEventListener('pointerdown', bootAudio, { capture: true });

function pickVoice() {
  const vs = speechSynthesis.getVoices();
  if (!vs.length) return;
  voice = vs.find(v => /en[-_]US/i.test(v.lang) && /male|david|alex|daniel/i.test(v.name))
       || vs.find(v => /en[-_]US/i.test(v.lang))
       || vs.find(v => /^en/i.test(v.lang)) || vs[0];
}
function beep(freq = 1000, dur = .09, vol = .2, when = 0) {
  if (!AC || S.muted) return;
  const t = AC.currentTime + when;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'square'; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(AC.destination);
  o.start(t); o.stop(t + dur + .02);
}
function horn() { beep(440, .5, .3); beep(554, .5, .3); beep(659, .5, .3); }

/* PA announcement: two-tone chime, then the voice */
function say(text, opts = {}) {
  const { alert = false, chime = true } = opts;
  $('annText').textContent = text;
  const bar = $('announcer');
  bar.classList.remove('flash'); void bar.offsetWidth;
  if (alert) bar.classList.add('flash');
  if (S.muted) return;
  if (chime) { beep(880, .12, .18); beep(1175, .18, .18, .13); }
  if (!speechOK) return;
  setTimeout(() => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.rate = 1; u.pitch = 1; u.volume = 1;
      speechSynthesis.speak(u);
    } catch (e) {}
  }, chime ? 320 : 0);
}

$('muteBtn').onclick = () => {
  S.muted = !S.muted; save();
  $('muteBtn').textContent = S.muted ? '🔇' : '🔊';
  if (S.muted) { try { speechSynthesis.cancel(); } catch (e) {} }
  else say('Race control online.');
};
if (S.muted) $('muteBtn').textContent = '🔇';

/* ── time helpers ── */
function fmt(ms) {
  if (ms == null) return '—';
  const t = Math.max(0, Math.round(ms / 100) / 10);
  const m = Math.floor(t / 60), s = t - m * 60;
  return m ? `${m}:${s.toFixed(1).padStart(4, '0')}` : s.toFixed(1);
}
function speakTime(ms) {
  const t = Math.round(ms / 100) / 10;
  const m = Math.floor(t / 60), s = +(t - m * 60).toFixed(1);
  return m ? `${m} minute${m > 1 ? 's' : ''} ${s} seconds` : `${s} seconds`;
}

/* ── wake lock (screen stays on during runs) ── */
let wake = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wake) wake = await navigator.wakeLock.request('screen');
    if (!on && wake) { wake.release(); wake = null; }
  } catch (e) {}
}

/* ═══════════ SHARED CLOCK ═══════════ */
let T = null; // {startAt, pausedMs, pauseStart, iv, el}
function clockStart(el) {
  clockStop();
  T = { startAt: Date.now(), pausedMs: 0, pauseStart: null, el };
  T.iv = setInterval(() => { el.textContent = fmt(clockNow()); }, 100);
  el.classList.remove('paused');
}
function clockNow() {
  if (!T) return 0;
  const pause = T.pauseStart ? Date.now() - T.pauseStart : 0;
  return Date.now() - T.startAt - T.pausedMs - pause;
}
function clockPauseToggle() {
  if (!T) return false;
  if (T.pauseStart) {
    T.pausedMs += Date.now() - T.pauseStart; T.pauseStart = null;
    T.el.classList.remove('paused');
    return false;
  }
  T.pauseStart = Date.now();
  T.el.classList.add('paused');
  return true;
}
function clockStop() { if (T) { clearInterval(T.iv); T = null; } }

/* ═══════════ TABS ═══════════ */
document.querySelectorAll('#tabs button').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('#tabs button').forEach(x => x.classList.remove('on'));
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    $('tab-' + b.dataset.tab).classList.add('on');
    renderAll();
  };
});

/* ═══════════ PADDOCK ═══════════ */
$('roundName').value = S.round.name || '';
$('roundName').oninput = e => { S.round.name = e.target.value; save(); };
$('cfgQualiLaps').value = S.qualiLaps;
$('cfgHeatLaps').value = S.heatLaps;
$('cfgQualiLaps').onchange = e => { S.qualiLaps = Math.max(1, +e.target.value || 3); save(); };
$('cfgHeatLaps').onchange = e => { S.heatLaps = Math.max(1, +e.target.value || 4); save(); };

$('addTeamBtn').onclick = () => {
  const name = $('tName').value.trim().toUpperCase();
  if (!name) { say('Team needs a name.'); return; }
  if (S.roster.some(t => t.name === name)) { say('That team is already checked in.'); return; }
  S.roster.push({
    id: S.nextId++, name,
    kart: $('tKart').value.trim().toUpperCase(),
    crew: []
  });
  save();
  ['tName', 'tKart'].forEach(i => $(i).value = '');
  say(`Team ${name}. Checked in.`);
  renderAll();
};

function renderPaddock() {
  const box = $('teamCards');
  box.innerHTML = '';
  if (!S.roster.length) { box.innerHTML = '<div class="empty">no teams checked in yet — the paddock is empty</div>'; return; }
  S.roster.forEach(t => {
    const d = document.createElement('div');
    d.className = 'tcard tall';
    const crewHtml = t.crew.map((c, i) =>
      `<span class="crewchip">${ROLE_ICON[c.role] || '👤'} <b>${c.name}</b> <small>${c.role}</small><button class="cx" data-i="${i}">✕</button></span>`
    ).join('') || '<span class="empty">no crew yet — a team needs at least a driver and a rider</span>';
    d.innerHTML = `<div class="tinfo">
        <div class="tname">${t.name}</div>
        ${t.kart ? `<div class="tkart">🛠 ${t.kart}</div>` : ''}
        <div class="crewline">${crewHtml}</div>
        <div class="crewadd">
          <input class="cname" placeholder="crew name" maxlength="20">
          <select class="crole">${ROLES.map(r => `<option>${r}</option>`).join('')}</select>
          <button class="cadd">+</button>
        </div>
      </div><button class="x">✕</button>`;
    d.querySelector('.x').onclick = () => {
      if (confirm(`Withdraw team ${t.name}?`)) {
        S.roster = S.roster.filter(x => x.id !== t.id);
        delete S.round.quali[t.id];
        save(); renderAll();
      }
    };
    const addCrew = () => {
      const nm = d.querySelector('.cname').value.trim();
      const role = d.querySelector('.crole').value;
      if (!nm) return;
      t.crew.push({ name: nm, role });
      save();
      say(`${nm} joins team ${t.name}. ${role.toLowerCase()}.`, { chime: false });
      renderPaddock();
    };
    d.querySelector('.cadd').onclick = addCrew;
    d.querySelector('.cname').addEventListener('keydown', e => { if (e.key === 'Enter') addCrew(); });
    d.querySelectorAll('.cx').forEach(b => b.onclick = () => {
      t.crew.splice(+b.dataset.i, 1); save(); renderPaddock();
    });
    box.appendChild(d);
  });
}

/* ═══════════ QUALIFYING ═══════════ */
let QR = null; // live run: {teamId, curPen, curDeleted, undo:[]}

function qualiBest(id) {
  const q = S.round.quali[id];
  if (!q || !q.laps.length) return null;
  const ok = q.laps.filter(l => !l.deleted).map(l => l.raw + l.pen);
  return ok.length ? Math.min(...ok) : null;
}
function qualiOrder() {
  return S.roster
    .map(t => ({ id: t.id, best: qualiBest(t.id) }))
    .sort((a, b) => (a.best ?? Infinity) - (b.best ?? Infinity));
}

function renderQuali() {
  const list = $('qualiTeamList');
  list.innerHTML = '';
  if (!S.roster.length) { list.innerHTML = '<div class="empty">check teams in at the paddock first</div>'; }
  S.roster.forEach(t => {
    const best = qualiBest(t.id);
    const b = document.createElement('button');
    b.className = 'qrow' + (best != null ? ' done' : '');
    b.innerHTML = `<span class="qn">${t.name}</span><span class="qt">${best != null ? fmt(best) : 'NO TIME'} →</span>`;
    b.onclick = () => openRun(t.id);
    list.appendChild(b);
  });
  // provisional grid
  const rows = qualiOrder();
  const tbl = $('gridTable');
  tbl.innerHTML = '<tr><th>POS</th><th>TEAM</th><th>BEST LAP</th></tr>';
  rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (i === 0 && r.best != null) tr.className = 'p1';
    tr.innerHTML = `<td class="pos">P${i + 1}</td><td>${team(r.id).name}</td><td class="num">${fmt(r.best)}</td>`;
    tbl.appendChild(tr);
  });
}

function openRun(id) {
  QR = { teamId: id, curPen: 0, curDeleted: false, undo: [] };
  if (!S.round.quali[id]) S.round.quali[id] = { laps: [] };
  $('qualiPick').classList.add('hidden');
  $('qualiRun').classList.remove('hidden');
  $('qrTeam').textContent = team(id).name;
  $('qrStatus').textContent = 'IN THE PIT BOX';
  $('qrClock').textContent = '0:00.0';
  $('qrPre').classList.remove('hidden');
  $('qrLive').classList.add('hidden');
  updateLapline();
}
function updateLapline() {
  if (!QR) return;
  const q = S.round.quali[QR.teamId];
  const n = q.laps.length + (T ? 1 : 0);
  const flags = (QR.curDeleted ? ' · LAP DELETED' : '') + (QR.curPen ? ` · +${QR.curPen / 1000}s` : '');
  $('qrLapline').textContent = `LAP ${T ? n : '—'} OF ${S.qualiLaps} · BEST ${fmt(qualiBest(QR.teamId))}${flags}`;
}

$('qrBack').onclick = () => { QR = null; $('qualiRun').classList.add('hidden'); $('qualiPick').classList.remove('hidden'); renderQuali(); };
$('qrCall').onclick = () => say(`Team ${team(QR.teamId).name}, proceed to the start line.`, { alert: true });

$('qrStart').onclick = () => {
  const t = team(QR.teamId);
  $('qrPre').classList.add('hidden');
  $('qrStatus').textContent = 'COUNTDOWN';
  say(`Team ${t.name}. ${S.qualiLaps} laps. Best lap counts.`, { chime: false });
  let n = 3;
  const cd = setInterval(() => {
    if (n > 0) { beep(700, .15, .25); $('qrClock').textContent = n; n--; }
    else {
      clearInterval(cd);
      beep(1400, .5, .3);
      $('qrLive').classList.remove('hidden');
      $('qrStatus').textContent = 'ON TRACK';
      clockStart($('qrClock'));
      keepAwake(true);
      updateLapline();
    }
  }, 1000);
};

$('qrLap').onclick = () => {
  if (!T || T.pauseStart) return;
  const q = S.round.quali[QR.teamId];
  const total = clockNow();
  const prev = q.laps.reduce((a, l) => a + l.raw, 0);
  const lap = { raw: total - prev, pen: QR.curPen, deleted: QR.curDeleted };
  q.laps.push(lap);
  QR.undo.push('lap'); QR.curPen = 0; QR.curDeleted = false;
  save();
  const eff = lap.deleted ? null : lap.raw + lap.pen;
  if (lap.deleted) say(`Lap deleted. Track limits.`);
  else {
    const allBests = qualiOrder().filter(r => r.id !== QR.teamId && r.best != null).map(r => r.best);
    const pole = eff <= Math.min(...[...allBests, qualiBest(QR.teamId) ?? Infinity]);
    say(`Lap ${q.laps.length}. ${speakTime(eff)}.${pole ? ' Provisional pole!' : ''}`, { alert: pole, chime: false });
  }
  if (q.laps.length >= S.qualiLaps) endRun();
  else updateLapline();
};

$('qrCone').onclick = () => { if (!T) return; QR.curPen += 2000; QR.undo.push('cone'); updateLapline(); say('Penalty. Cone. Plus 2 seconds.'); };
$('qrLimits').onclick = () => { if (!T) return; QR.curDeleted = true; QR.undo.push('limits'); updateLapline(); say('Track limits. This lap will be deleted.'); };
$('qrRed').onclick = () => {
  if (!T) return;
  const paused = clockPauseToggle();
  say(paused ? 'Red flag. Red flag. The clock is stopped.' : 'Green flag. Go.', { alert: true });
  $('qrRed').textContent = paused ? '🟢 RESUME' : '🚩 RED FLAG';
};
$('qrUndo').onclick = () => {
  if (!QR || !QR.undo.length) return;
  const a = QR.undo.pop();
  const q = S.round.quali[QR.teamId];
  if (a === 'lap' && q.laps.length) q.laps.pop();
  if (a === 'cone') QR.curPen = Math.max(0, QR.curPen - 2000);
  if (a === 'limits') QR.curDeleted = false;
  save(); updateLapline(); say('Undone.', { chime: false });
};
$('qrEnd').onclick = endRun;

function endRun() {
  clockStop(); keepAwake(false);
  $('qrRed').textContent = '🚩 RED FLAG';
  const best = qualiBest(QR.teamId);
  say(`Run complete. Team ${team(QR.teamId).name}. Best lap ${best != null ? speakTime(best) : 'no time set'}.`);
  QR = null;
  $('qualiRun').classList.add('hidden');
  $('qualiPick').classList.remove('hidden');
  renderQuali();
}

/* ═══════════ RACE — HEATS ═══════════ */
let HR = null; // live heat: {grid, laps, toGo, pens:[{id,label}], undo:[], finish:[]}

function pendingGrid() {
  if (S.round.nextGrid) {
    // keep only teams still on the roster, append any new ones
    const g = S.round.nextGrid.filter(id => S.roster.some(t => t.id === id));
    S.roster.forEach(t => { if (!g.includes(t.id)) g.push(t.id); });
    return g;
  }
  return qualiOrder().map(r => r.id);
}

function renderRace() {
  $('heatTitle').textContent = `HEAT ${S.round.heats.length + 1} — GRID`;
  const grid = pendingGrid();
  S.round.nextGrid = grid; save();
  const box = $('gridEdit');
  box.innerHTML = '';
  if (!grid.length) { box.innerHTML = '<div class="empty">no teams — check in at the paddock</div>'; }
  grid.forEach((id, i) => {
    const d = document.createElement('div');
    d.className = 'orow' + (i === 0 ? ' p1' : '');
    d.innerHTML = `<span class="opos">P${i + 1}</span><span class="oname">${team(id).name}</span>
      <button class="mini">▲</button><button class="mini">▼</button>`;
    const [up, dn] = d.querySelectorAll('.mini');
    up.onclick = () => { if (i > 0) { [grid[i - 1], grid[i]] = [grid[i], grid[i - 1]]; save(); renderRace(); } };
    dn.onclick = () => { if (i < grid.length - 1) { [grid[i + 1], grid[i]] = [grid[i], grid[i + 1]]; save(); renderRace(); } };
    box.appendChild(d);
  });
  // heat history
  const hh = $('heatHistory');
  hh.innerHTML = S.round.heats.length ? '' : '<div class="empty">no heats run yet today</div>';
  S.round.heats.forEach(h => {
    const d = document.createElement('div');
    d.className = 'hitem';
    const podium = h.result.filter(r => !r.dsq).slice(0, 3).map((r, i) => `${['🥇', '🥈', '🥉'][i]} ${team(r.id).name}`).join('  ');
    d.innerHTML = `<b>HEAT ${h.n}</b> · ${h.laps} laps<br>${podium || '—'}`;
    hh.appendChild(d);
  });
}

$('gridFromQuali').onclick = () => { S.round.nextGrid = qualiOrder().map(r => r.id); save(); renderRace(); say('Grid set from qualifying.'); };
$('gridReverse').onclick = () => { S.round.nextGrid = pendingGrid().reverse(); save(); renderRace(); say('Reverse grid. Chaos mode.'); };

$('heatStart').onclick = () => {
  const grid = pendingGrid();
  if (grid.length < 2) { say('A race needs at least 2 karts on the grid.'); return; }
  HR = { grid, laps: S.heatLaps, toGo: S.heatLaps, pens: [], undo: [], finish: [], vsc: false };
  $('hlVSC').textContent = '🟡 VSC';
  $('heatSetup').classList.add('hidden');
  $('heatLive').classList.remove('hidden');
  $('hlTitle').textContent = `HEAT ${S.round.heats.length + 1}`;
  $('hlLaps').textContent = `${HR.toGo} TO GO`;
  $('hlClock').textContent = '—';
  renderPenChips();
  keepAwake(true);
  say(`Heat ${S.round.heats.length + 1}. ${HR.laps} laps. Karts to the grid.`, { alert: true });
  // F1 start: 5 lights on, random hold, lights out = GO
  let i = 0;
  const seq = setInterval(() => {
    i++;
    beep(600, .35, .28);
    $('hlClock').textContent = '●'.repeat(i);
    if (i === 5) {
      clearInterval(seq);
      const hold = 600 + Math.random() * 1900;
      setTimeout(() => {
        if (!HR) return; // aborted during lights
        horn();
        say("It's lights out and away we go!", { chime: false, alert: true });
        clockStart($('hlClock'));
      }, hold);
    }
  }, 1000);
};

function renderPenChips() {
  const box = $('hlPenTeams');
  box.innerHTML = '';
  HR.grid.forEach(id => {
    const n = HR.pens.filter(p => p.id === id).length;
    const c = document.createElement('button');
    c.className = 'chip';
    c.innerHTML = `${team(id).name}${n ? ` <span class="cpen">−${n}</span>` : ''}`;
    c.onclick = () => penMenu(id);
    box.appendChild(c);
  });
}

function penMenu(id) {
  const wrap = document.createElement('div');
  wrap.id = 'penMenu';
  wrap.innerHTML = `<div class="sheet">
    <h2>PENALTY — ${team(id).name}</h2>
    <button class="big pen" data-p="CONTACT">RAMMING / CONTACT</button>
    <button class="big pen" data-p="CORNER CUT">CORNER CUT (gained a spot)</button>
    <button class="big pen" data-p="JUMP START">JUMP START</button>
    <button class="big pen" data-p="ABANDONED KART">ABANDONED KART</button>
    <button class="big dim" data-p="">CANCEL</button>
  </div>`;
  wrap.onclick = e => {
    const p = e.target.dataset ? e.target.dataset.p : undefined;
    if (p) {
      HR.pens.push({ id, label: p });
      HR.undo.push('pen');
      say(`Penalty. Team ${team(id).name}. ${p.toLowerCase()}. One position at the flag.`, { alert: true });
      renderPenChips();
    }
    if (p !== undefined || e.target === wrap) wrap.remove();
  };
  document.body.appendChild(wrap);
}

$('hlLeaderLap').onclick = () => {
  if (!T || T.pauseStart) return;
  HR.toGo--;
  HR.undo.push('lap');
  if (HR.toGo <= 0) return checkered();
  $('hlLaps').textContent = `${HR.toGo} TO GO`;
  say(HR.toGo === 1 ? 'FINAL LAP!' : `${HR.toGo} laps to go.`, { alert: HR.toGo === 1, chime: false });
};
$('hlVSC').onclick = () => {
  if (!HR || !T) return;
  HR.vsc = !HR.vsc;
  if (HR.vsc) {
    $('hlVSC').textContent = '🟢 END VSC';
    say('Virtual safety kart deployed. Walking pace. Hold your gaps. No overtaking.', { alert: true });
  } else {
    $('hlVSC').textContent = '🟡 VSC';
    say('Virtual safety kart ending. Stand by.', { alert: true });
    setTimeout(() => { if (HR && !HR.vsc && T) { horn(); say('Green flag! Racing!', { chime: false, alert: true }); } }, 2500);
  }
};
$('hlRed').onclick = () => {
  if (!T) return;
  const paused = clockPauseToggle();
  say(paused ? 'Red flag. Red flag. All karts stop.' : 'Green flag. Racing resumes.', { alert: true });
  $('hlRed').textContent = paused ? '🟢 RESUME' : '🚩 RED FLAG';
};
$('hlUndo').onclick = () => {
  if (!HR || !HR.undo.length) return;
  const a = HR.undo.pop();
  if (a === 'lap') { HR.toGo++; $('hlLaps').textContent = `${HR.toGo} TO GO`; }
  if (a === 'pen') { HR.pens.pop(); renderPenChips(); }
  say('Undone.', { chime: false });
};
$('hlAbort').onclick = () => {
  if (confirm('Abort this heat? Nothing will be scored.')) {
    clockStop(); keepAwake(false); HR = null;
    $('hlRed').textContent = '🚩 RED FLAG';
    $('hlVSC').textContent = '🟡 VSC';
    $('heatLive').classList.add('hidden');
    $('heatSetup').classList.remove('hidden');
    say('Heat abandoned.');
    renderRace();
  }
};

function checkered() {
  clockStop(); keepAwake(false);
  $('hlRed').textContent = '🚩 RED FLAG';
  $('hlVSC').textContent = '🟡 VSC';
  if (HR) HR.vsc = false;
  say('CHECKERED FLAG!', { alert: true });
  $('heatLive').classList.add('hidden');
  $('heatFinish').classList.remove('hidden');
  renderFinishTaps();
}

function renderFinishTaps() {
  const box = $('hfChips');
  box.innerHTML = '';
  HR.grid.forEach(id => {
    const done = HR.finish.includes(id);
    const c = document.createElement('button');
    c.className = 'chip';
    c.disabled = done;
    c.textContent = team(id).name;
    c.onclick = () => {
      HR.finish.push(id);
      say(`P${HR.finish.length}. ${team(id).name}.`, { chime: false });
      renderFinishTaps();
      if (HR.finish.length === HR.grid.length) buildResult();
    };
    box.appendChild(c);
  });
  const ord = $('hfOrder');
  ord.innerHTML = HR.finish.map((id, i) => `<div class="orow"><span class="opos">P${i + 1}</span><span class="oname">${team(id).name}</span></div>`).join('');
}
$('hfUndo').onclick = () => { if (HR && HR.finish.length) { HR.finish.pop(); renderFinishTaps(); } };
$('hfDNF').onclick = () => { if (HR) buildResult(); };

function buildResult() {
  // apply penalty drops: score = finish index + drops; stable by finish order; DNF (untapped) last
  const drops = id => HR.pens.filter(p => p.id === id).length;
  const finished = HR.finish.map((id, i) => ({ id, score: i + drops(id), i }))
    .sort((a, b) => a.score - b.score || a.i - b.i);
  const dnf = HR.grid.filter(id => !HR.finish.includes(id));
  HR.result = [
    ...finished.map(f => ({ id: f.id, dsq: false, dnf: false, drops: drops(f.id) })),
    ...dnf.map(id => ({ id, dsq: false, dnf: true, drops: 0 }))
  ];
  $('heatFinish').classList.add('hidden');
  $('heatResult').classList.remove('hidden');
  renderResultEditor();
}

function renderResultEditor() {
  const box = $('hrList');
  box.innerHTML = '';
  HR.result.forEach((r, i) => {
    const d = document.createElement('div');
    d.className = 'orow' + (r.dsq ? ' dsq' : i === 0 ? ' p1' : '');
    const note = r.dsq ? 'DSQ — foul play' : r.dnf ? 'DNF' : r.drops ? `${r.drops} penalt${r.drops > 1 ? 'ies' : 'y'} applied` : '';
    d.innerHTML = `<span class="opos">${r.dsq ? '✕' : 'P' + (i + 1)}</span>
      <span class="oname">${team(r.id).name}</span><span class="onote">${note}</span>
      <button class="mini">▲</button><button class="mini">▼</button><button class="mini">DSQ</button>`;
    const [up, dn, dq] = d.querySelectorAll('.mini');
    up.onclick = () => { if (i > 0) { [HR.result[i - 1], HR.result[i]] = [HR.result[i], HR.result[i - 1]]; renderResultEditor(); } };
    dn.onclick = () => { if (i < HR.result.length - 1) { [HR.result[i + 1], HR.result[i]] = [HR.result[i], HR.result[i + 1]]; renderResultEditor(); } };
    dq.onclick = () => { r.dsq = !r.dsq; renderResultEditor(); };
    box.appendChild(d);
  });
}
$('hrBack').onclick = () => { $('heatResult').classList.add('hidden'); $('heatFinish').classList.remove('hidden'); };

$('hrConfirm').onclick = () => {
  // DSQs sink to the bottom, then points by position
  const clean = HR.result.filter(r => !r.dsq), dsq = HR.result.filter(r => r.dsq);
  HR.result = [...clean, ...dsq];
  const heat = {
    n: S.round.heats.length + 1, laps: HR.laps,
    pens: HR.pens,
    result: HR.result.map((r, i) => ({
      ...r,
      pts: (r.dsq || r.dnf) ? 0 : (PTS[i] || 0)
    }))
  };
  S.round.heats.push(heat);
  S.round.nextGrid = [...HR.result.map(r => r.id)].reverse(); // default next grid: reverse finish
  save();
  const w = heat.result[0];
  say(`Heat ${heat.n} result. Winner. Team ${team(w.id).name}!`, { alert: true });
  HR = null;
  $('heatResult').classList.add('hidden');
  $('heatSetup').classList.remove('hidden');
  renderAll();
};

/* ═══════════ STANDINGS ═══════════ */
function roundPoints() {
  // teamName -> pts for the current round (heats + pole bonus)
  const pts = {};
  S.roster.forEach(t => pts[t.name] = 0);
  S.round.heats.forEach(h => h.result.forEach(r => {
    const n = team(r.id).name;
    pts[n] = (pts[n] || 0) + r.pts;
  }));
  const q = qualiOrder();
  if (q.length && q[0].best != null) {
    const n = team(q[0].id).name;
    pts[n] = (pts[n] || 0) + POLE_BONUS;
  }
  return pts;
}

function renderStandings() {
  $('todayTitle').textContent = `TODAY — ${S.round.name || 'UNNAMED CIRCUIT'}`;
  const pts = roundPoints();
  const rows = Object.entries(pts).sort((a, b) => b[1] - a[1]);
  const q = qualiOrder();
  const poleName = q.length && q[0].best != null ? team(q[0].id).name : null;
  const tbl = $('todayTable');
  tbl.innerHTML = '<tr><th>POS</th><th>TEAM</th><th>PTS</th></tr>';
  if (!rows.length) tbl.innerHTML += '<tr><td colspan="3" class="empty">nothing scored yet</td></tr>';
  rows.forEach(([n, p], i) => {
    const tr = document.createElement('tr');
    if (i === 0 && p > 0) tr.className = 'p1';
    tr.innerHTML = `<td class="pos">${i + 1}</td><td>${n}${n === poleName ? ' <small>①POLE</small>' : ''}</td><td class="num">${p}</td>`;
    tbl.appendChild(tr);
  });

  // season championship
  const agg = {};
  S.season.rounds.forEach(r => Object.entries(r.points).forEach(([n, p]) => agg[n] = (agg[n] || 0) + p));
  const srows = Object.entries(agg).sort((a, b) => b[1] - a[1]);
  const st = $('seasonTable');
  st.innerHTML = '<tr><th>POS</th><th>TEAM</th><th>PTS</th></tr>';
  if (!srows.length) st.innerHTML += '<tr><td colspan="3" class="empty">no rounds in the books yet — season one awaits</td></tr>';
  srows.forEach(([n, p], i) => {
    const tr = document.createElement('tr');
    if (i === 0) tr.className = 'p1';
    tr.innerHTML = `<td class="pos">${i + 1}</td><td>${n}</td><td class="num">${p}</td>`;
    st.appendChild(tr);
  });

  const log = $('roundLog');
  log.innerHTML = '';
  [...S.season.rounds].reverse().forEach(r => {
    const win = Object.entries(r.points).sort((a, b) => b[1] - a[1])[0];
    const d = document.createElement('div');
    d.className = 'hitem';
    d.innerHTML = `<b>${r.name}</b> · ${r.date}${r.dbl ? ' · ×2 POINTS' : ''}<br>🏆 ${win ? win[0] : '—'} · ${r.heats} heat${r.heats === 1 ? '' : 's'}`;
    log.appendChild(d);
  });
}

$('closeRound').onclick = () => {
  if (!S.round.heats.length) { say('Run at least one heat before closing the round.'); return; }
  const name = S.round.name || `ROUND ${S.season.rounds.length + 1}`;
  if (!confirm(`Close ${name} and bank the points to Season One?`)) return;
  const dbl = $('dblPoints').checked;
  const pts = roundPoints();
  if (dbl) Object.keys(pts).forEach(k => pts[k] *= 2);
  S.season.rounds.push({
    name, date: new Date().toLocaleDateString(),
    dbl, points: pts, heats: S.round.heats.length
  });
  const win = Object.entries(pts).sort((a, b) => b[1] - a[1])[0];
  say(`Round complete. ${name}. Winner. Team ${win ? win[0] : 'nobody'}! The gold trophy goes home with them.`, { alert: true });
  S.round = newRound();
  $('roundName').value = '';
  $('dblPoints').checked = false;
  save();
  renderAll();
};

/* ── data ── */
$('exportBtn').onclick = () => { $('dataBox').value = JSON.stringify(S); say('Season exported. Copy it somewhere safe.', { chime: false }); };
$('importBtn').onclick = () => {
  try {
    const d = JSON.parse($('dataBox').value);
    if (!d.roster || !d.season) throw 0;
    S = d; save(); location.reload();
  } catch (e) { say('That is not a valid PeGP backup.'); }
};
$('wipeBtn').onclick = () => {
  if (confirm('RESET THE ENTIRE SEASON? Teams, rounds, championship — all of it.') && confirm('Seriously. Everything. Sure?')) {
    localStorage.removeItem(SAVE_KEY); location.reload();
  }
};

/* ═══════════ RENDER ═══════════ */
function renderAll() {
  renderPaddock();
  renderQuali();
  if (!HR) renderRace();
  renderStandings();
}
renderAll();
