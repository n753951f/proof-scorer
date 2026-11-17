(() => {
  'use strict';
  const S = window.Scoring;

  /* ================= 小工具 ================= */
  const ICONS = {
    swap: '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
    eraser: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    enter: '<path d="M20 4v7a4 4 0 0 1-4 4H4"/><path d="m9 10-5 5 5 5"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    unlink: '<path d="m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="m5.17 11.75-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71"/><path d="M8 2v3"/><path d="M2 8h3"/><path d="M16 22v-3"/><path d="M22 16h-3"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  };
  const svg = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  const $ = (id) => document.getElementById(id);
  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const L = S.idLabel;
  document.querySelectorAll('[data-icon]').forEach((e) => e.insertAdjacentHTML('afterbegin', svg(e.dataset.icon)));

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ================= 狀態 ================= */
  const FMT_LABEL = { its: 'ID→步驟', sti: '步驟→ID' };
  const FMT_SHORT = { its: 'ID→步', sti: '步→ID' };
  const SPEEDS = [
    ['slow', '慢', 650],
    ['mid', '中', 260],
    ['fast', '快', 70],
    ['instant', '即時', 0],
  ];
  const st = {
    keyFmt: S.ITS,
    nOverride: null,
    key: null,
    keyError: null,
    keySig: null,
    entries: [],
    uidSeq: 1,
    search: '',
    speed: 'mid',
    procUid: null,
    cursor: null,
    viewUid: null,
    follow: true,
    editUid: null,
    ansFmtManual: null,
    dirty: false,
  };
  let runToken = 0;
  const speedDelay = () => SPEEDS.find((s) => s[0] === st.speed)[2];

  function setDirty(v) {
    st.dirty = v;
    if (window.api && window.api.setDirty) window.api.setDirty(v && st.entries.length > 0);
  }

  /* ================= 正確答案 ================= */
  const keyInput = $('keyInput');
  const nInput = $('nInput');
  let keyTimer;

  keyInput.addEventListener('input', () => {
    clearTimeout(keyTimer);
    keyTimer = setTimeout(applyKey, 350);
  });
  keyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(keyTimer);
      applyKey();
      if (st.key) $('sidInput').focus();
    }
  });
  nInput.addEventListener('input', () => {
    const v = parseInt(nInput.value, 10);
    st.nOverride = v > 0 ? v : null;
    applyKey();
  });

  function applyKey() {
    clearTimeout(keyTimer);
    const text = keyInput.value;
    if (!text.trim()) {
      st.key = null;
      st.keyError = null;
      renderKey();
      renderAll();
      return;
    }
    const k = S.parseKey(text, st.keyFmt, st.nOverride);
    if (k.error) {
      st.key = null;
      st.keyError = k.error;
      renderKey();
      renderAll();
      return;
    }
    st.keyError = null;
    const changed = k.signature !== st.keySig;
    st.key = k;
    st.keySig = k.signature;
    renderKey();
    if (changed) requeueAll();
    else {
      renderAll();
      kick();
    }
  }

  $('btnKeyFmt').addEventListener('click', () => {
    applyKey();
    const other = st.keyFmt === S.ITS ? S.STI : S.ITS;
    const k = st.key;
    if (k) {
      // 步驟→ID 在結尾用 X 補滿到 ID 總數，所以 ID 數不需手動指定
      keyInput.value = other === S.ITS ? S.formatIts(k.seq, k.n) : S.formatSti(k.seq, ' → ', k.n);
      st.nOverride = null;
      nInput.value = '';
    }
    st.keyFmt = other;
    applyKey();
    updateAnsFmt();
    toast(`正確答案格式：${FMT_LABEL[other]}`);
  });

  $('btnKeyClear').addEventListener('click', () => {
    keyInput.value = '';
    nInput.value = '';
    st.nOverride = null;
    applyKey();
    keyInput.focus();
  });

  function renderKey() {
    $('keyFmtTag').textContent = FMT_LABEL[st.keyFmt];
    keyInput.placeholder =
      st.keyFmt === S.ITS
        ? '輸入正確答案（ID→步驟），例如 2→X→6→1→3→X→4→7→X→5'
        : '輸入正確答案（步驟→ID），例如 4→1→5→7→A→3→8→X→X→X';
    const field = $('keyField');
    const meta = $('keyMeta');
    field.classList.toggle('error', !!st.keyError);
    meta.title = '';
    if (st.keyError) meta.textContent = st.keyError;
    else if (st.key) {
      const k = st.key;
      meta.innerHTML = `<b>${k.seq.length}</b> 步 · <b>${k.xIds.length}</b> 個 X · 滿分 <b>${k.max}</b>`;
      meta.title = `步驟→ID：${S.formatSti(k.seq, " → ", k.n)}\nID→步驟：${S.formatIts(k.seq, k.n)}`;
    } else meta.textContent = '';
    nInput.placeholder = st.key ? st.key.autoN : '';
  }

  /* ================= 學生輸入 ================= */
  const sidInput = $('sidInput');
  const ansInput = $('ansInput');
  const ansFmt = $('ansFmt');

  const currentAnsFmt = () => st.ansFmtManual || S.detectFormat(ansInput.value, st.keyFmt, st.key && st.key.n);
  function updateAnsFmt() {
    ansFmt.textContent = FMT_LABEL[currentAnsFmt()];
    ansFmt.classList.toggle('manual', !!st.ansFmtManual);
    ansFmt.title = st.ansFmtManual ? '已手動指定格式（點擊切換）' : '自動判斷格式（點擊切換）';
  }
  ansFmt.addEventListener('click', () => {
    st.ansFmtManual = currentAnsFmt() === S.ITS ? S.STI : S.ITS;
    updateAnsFmt();
    ansInput.focus();
  });
  ansInput.addEventListener('input', updateAnsFmt);

  sidInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      ansInput.focus();
    } else if (e.key === 'Escape') cancelCompose();
  });
  ansInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') cancelCompose();
    else if (e.key === 'Backspace' && !ansInput.value) {
      e.preventDefault();
      sidInput.focus();
    }
  });
  sidInput.addEventListener('paste', onPaste);
  ansInput.addEventListener('paste', onPaste);

  function randomSid() {
    let s;
    do s = String(Math.floor(1e7 + Math.random() * 9e7));
    while (st.entries.some((e) => e.sid === s));
    return s;
  }

  function parseEntry(e) {
    e.ans = S.parseAnswer(e.raw, e.fmt);
  }

  function makeEntry(sid, raw, fmt) {
    const auto = !sid;
    const e = {
      uid: st.uidSeq++,
      sid: sid || randomSid(),
      sidAuto: auto,
      raw,
      fmt,
      status: 'pending',
      result: null,
    };
    parseEntry(e);
    return e;
  }

  function commit() {
    const raw = ansInput.value.trim();
    if (!raw) {
      if (!sidInput.value.trim() && !st.editUid) sidInput.focus();
      return;
    }
    const sid = sidInput.value.trim();
    const fmt = currentAnsFmt();
    if (st.editUid) {
      const e = st.entries.find((x) => x.uid === st.editUid);
      if (e) {
        if (sid !== e.sid) {
          e.sid = sid || randomSid();
          e.sidAuto = !sid;
        }
        e.raw = raw;
        e.fmt = fmt;
        e.status = 'pending';
        e.result = null;
        parseEntry(e);
        st.viewUid = e.uid;
      }
      st.editUid = null;
      $('composer').classList.remove('editing');
    } else {
      if (sid && st.entries.some((x) => x.sid === sid)) toast(`學號 ${sid} 已存在，仍新增一筆`);
      st.entries.push(makeEntry(sid, raw, fmt));
    }
    sidInput.value = '';
    ansInput.value = '';
    st.ansFmtManual = null;
    updateAnsFmt();
    sidInput.focus();
    st.follow = true;
    setDirty(true);
    renderList();
    renderRight();
    kick();
  }

  function cancelCompose() {
    if (st.editUid) {
      st.editUid = null;
      $('composer').classList.remove('editing');
      sidInput.value = '';
      ansInput.value = '';
      renderList();
    }
    st.ansFmtManual = null;
    updateAnsFmt();
    document.activeElement.blur();
  }

  function startEdit(e) {
    st.editUid = e.uid;
    sidInput.value = e.sid;
    ansInput.value = e.raw;
    st.ansFmtManual = e.fmt;
    updateAnsFmt();
    $('composer').classList.add('editing');
    ansInput.focus();
    ansInput.select();
    renderList();
  }

  // 一次貼上多行：每行「學號[Tab]答案」或「學號 答案」或只有答案
  function onPaste(ev) {
    const text = (ev.clipboardData || window.clipboardData).getData('text');
    if (!/\r?\n/.test(text.trim())) return;
    ev.preventDefault();
    let n = 0;
    for (const line of text.split(/\r?\n/)) {
      const l = line.trim();
      if (!l) continue;
      let sid = '';
      let ans = l;
      const cells = l.split('\t');
      if (cells.length >= 2) {
        sid = cells[0].trim();
        ans = cells.slice(1).join(' ').trim();
      } else {
        const m = l.match(/^([A-Za-z0-9_]{3,})[\s,，:：]+(.+)$/);
        if (m) {
          sid = m[1];
          ans = m[2].trim();
        }
      }
      if (!ans || /學號|答案/.test(sid + ans)) continue;
      st.entries.push(makeEntry(sid, ans, S.detectFormat(ans, st.keyFmt, st.key && st.key.n)));
      n++;
    }
    if (n) {
      st.follow = true;
      setDirty(true);
      renderList();
      kick();
      toast(`已加入 ${n} 筆學生答案`);
    }
  }

  /* ================= 左欄清單 ================= */
  const list = $('list');
  $('searchInput').addEventListener('input', (e) => {
    st.search = e.target.value;
    renderList();
  });

  list.addEventListener('click', (ev) => {
    const row = ev.target.closest('.row');
    if (!row) return;
    const e = st.entries.find((x) => x.uid === +row.dataset.uid);
    if (!e) return;
    const act = ev.target.closest('[data-act]');
    if (act && act.dataset.act === 'del') {
      removeEntry(e);
      return;
    }
    if (act && act.dataset.act === 'fmt') {
      e.fmt = e.fmt === S.ITS ? S.STI : S.ITS;
      e.status = 'pending';
      e.result = null;
      parseEntry(e);
      st.viewUid = e.uid;
      st.follow = false;
      setDirty(true);
      renderList();
      renderRight();
      kick();
      return;
    }
    select(e.uid);
  });
  list.addEventListener('dblclick', (ev) => {
    const row = ev.target.closest('.row');
    if (!row || ev.target.closest('[data-act]')) return;
    const e = st.entries.find((x) => x.uid === +row.dataset.uid);
    if (e) startEdit(e);
  });

  function select(uid) {
    st.viewUid = uid;
    st.follow = uid === st.procUid;
    renderList();
    renderRight();
  }

  function removeEntry(e) {
    st.entries = st.entries.filter((x) => x !== e);
    if (st.viewUid === e.uid) st.viewUid = null;
    if (st.editUid === e.uid) cancelCompose();
    setDirty(true);
    renderList();
    renderRight();
  }

  const visibleEntries = () => {
    const q = st.search.trim().toLowerCase();
    return q ? st.entries.filter((e) => e.sid.toLowerCase().includes(q)) : st.entries;
  };

  function displayAns(e) {
    return e.ans && !e.ans.error ? S.formatAnswer(e.ans, '→') : e.raw;
  }

  function renderList() {
    list.textContent = '';
    const vis = visibleEntries();
    if (!st.entries.length) {
      const em = h('div', 'empty');
      em.innerHTML =
        '<div class="empty-title">尚無學生答案</div>' +
        '<div>按 <kbd>Enter</kbd> 新增一筆：先輸入學號，再輸入答案</div>' +
        '<div>不填學號直接 <kbd>Enter</kbd> 會自動產生</div>' +
        '<div>也可從 Excel 一次貼上多行（學號、答案兩欄）</div>';
      list.append(em);
    } else if (!vis.length) {
      list.append(h('div', 'empty small', '找不到符合的學號'));
    }
    for (const e of vis) list.append(rowEl(e));
    renderFoot();
  }

  function rowEl(e) {
    const r = h('div', `row ${e.status}`);
    r.dataset.uid = e.uid;
    if (e.uid === st.viewUid) r.classList.add('selected');
    if (e.uid === st.editUid) r.classList.add('editing');
    r.title = '點擊查看 · 雙擊編輯';

    const sid = h('div', 'r-sid' + (e.sidAuto ? ' auto' : ''), e.sid);
    if (e.sidAuto) sid.title = '系統自動產生的學號';
    const ans = h('div', 'r-ans mono', displayAns(e));
    ans.title = e.raw;
    const fmt = h('button', 'r-fmt', FMT_SHORT[e.fmt]);
    fmt.dataset.act = 'fmt';
    fmt.title = `此筆以「${FMT_LABEL[e.fmt]}」解讀，點擊切換`;
    const sc = h('div', 'r-score');
    if (e.status === 'done') {
      sc.innerHTML = `<b>${e.result.total}</b><span>/${e.result.max}</span>`;
      if (e.result.total === e.result.max) sc.classList.add('full');
    } else if (e.status === 'running') sc.append(h('span', 'spin'));
    else if (e.status === 'error') {
      sc.textContent = '格式錯誤';
      sc.title = e.result && e.result.error;
    } else sc.textContent = st.key ? '等待' : '—';
    const del = h('button', 'r-del');
    del.innerHTML = svg('x');
    del.dataset.act = 'del';
    del.title = '刪除這筆';
    r.append(sid, ans, fmt, sc, del);
    return r;
  }

  function renderFoot() {
    const foot = $('listFoot');
    const done = st.entries.filter((e) => e.status === 'done');
    const avg = done.length ? done.reduce((s, e) => s + e.result.total, 0) / done.length : null;
    const max = st.key ? st.key.max : '';
    foot.innerHTML =
      `<span>共 <b>${st.entries.length}</b> 筆 · 已完成 <b>${done.length}</b></span>` +
      `<span>${avg == null ? '' : `平均 <b>${avg.toFixed(1)}</b> / ${max}`}</span>`;
  }

  function scrollRowIntoView(uid) {
    const row = list.querySelector(`.row[data-uid="${uid}"]`);
    if (row) row.scrollIntoView({ block: 'nearest' });
  }

  /* 清空（按兩次確認） */
  let clearArmed = null;
  $('btnClearAll').addEventListener('click', () => {
    const btn = $('btnClearAll');
    if (!st.entries.length) return toast('目前沒有資料');
    if (!clearArmed) {
      btn.classList.add('confirm');
      toast('再按一次清空所有學生資料（無法復原）');
      clearArmed = setTimeout(() => {
        btn.classList.remove('confirm');
        clearArmed = null;
      }, 2500);
      return;
    }
    clearTimeout(clearArmed);
    clearArmed = null;
    btn.classList.remove('confirm');
    runToken++;
    st.entries = [];
    st.viewUid = null;
    st.editUid = null;
    $('composer').classList.remove('editing');
    setDirty(false);
    renderAll();
    toast('已清空');
  });

  $('btnRecalc').addEventListener('click', () => {
    const btn = $('btnRecalc');
    btn.classList.remove('spinning');
    void btn.offsetWidth;
    btn.classList.add('spinning');
    if (!st.key) return toast(st.keyError ? `正確答案有誤：${st.keyError}` : '請先輸入正確答案');
    if (!st.entries.length) return toast('目前沒有學生答案');
    requeueAll();
  });

  /* ================= 匯出 CSV ================= */
  $('btnExport').addEventListener('click', exportCsv);

  function csvCell(v) {
    let s = v == null ? '' : String(v);
    if (/^0\d+$/.test(s)) s = `="${s}"`; // 保留學號前導 0
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  async function exportCsv() {
    if (!st.entries.length) return toast('沒有資料可匯出');
    if (!st.key) return toast('請先輸入正確答案');
    const k = st.key;
    const rows = [
      ['正確答案', S.formatSti(k.seq, '→', k.n), S.formatIts(k.seq, k.n, '→')],
      [],
      ['學號', '學生答案', '最長正確序列', '分數'],
    ];
    for (const e of st.entries) {
      let r = e.status === 'done' ? e.result : null;
      if (!r && e.ans && !e.ans.error) r = S.evaluate(k, e.ans); // 尚未播放完動畫的也直接計算
      if (r) rows.push([e.sid, displayAns(e), S.formatSti(r.bestIds, '→'), r.total]);
      else rows.push([e.sid, e.raw, '', `格式錯誤：${e.ans ? e.ans.error : ''}`]);
    }
    const content = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const name = `證明評分_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.csv`;
    try {
      if (window.api && window.api.saveCsv) {
        const res = await window.api.saveCsv(name, content);
        if (!res || !res.ok) return;
        toast(`已匯出：${res.filePath}`);
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        toast(`已匯出 ${name}`);
      }
      setDirty(false);
    } catch (err) {
      toast(`匯出失敗：${err.message || err}`);
    }
  }

  /* ================= 計算佇列（逐步動畫） ================= */
  let looping = false;
  function kick() {
    if (!looping) loop();
  }

  function requeueAll() {
    runToken++;
    st.entries.forEach((e) => {
      e.status = 'pending';
      e.result = null;
    });
    st.follow = true;
    renderAll();
    kick();
  }

  async function loop() {
    looping = true;
    let sinceYield = 0;
    try {
      for (;;) {
        if (!st.key) break;
        const e = st.entries.find((x) => x.status === 'pending');
        if (!e) break;
        const tok = runToken;
        const key = st.key;
        if (!e.ans || e.ans.error) {
          e.status = 'error';
          e.result = { error: e.ans ? e.ans.error : '無法解析' };
          continue;
        }
        const r = S.evaluate(key, e.ans);
        e.result = r;
        e.status = 'running';

        if (speedDelay() > 0) {
          st.procUid = e.uid;
          if (st.follow) st.viewUid = e.uid;
          renderList();
          scrollRowIntoView(e.uid);
          let aborted = false;
          for (let c = 0; c <= r.steps.length; c++) {
            st.cursor = c;
            renderRight();
            scrollCurrentStep();
            await sleep(speedDelay());
            if (tok !== runToken || !st.entries.includes(e) || st.key !== key) {
              aborted = true;
              break;
            }
            if (speedDelay() === 0) break; // 中途切到「即時」
          }
          st.procUid = null;
          st.cursor = null;
          if (aborted) {
            if (e.status === 'running') {
              e.status = 'pending';
              e.result = null;
            }
            continue;
          }
          e.status = 'done';
          renderList();
          renderRight();
        } else {
          e.status = 'done';
          if (st.follow) st.viewUid = e.uid;
          if (++sinceYield >= 25) {
            sinceYield = 0;
            renderList();
            await sleep(0);
          }
        }
      }
    } finally {
      looping = false;
      st.procUid = null;
      st.cursor = null;
      renderList();
      renderRight();
    }
  }

  /* ================= 右欄 ================= */
  const stepsEl = $('steps');
  let lastScore = null;
  let lastChips = null; // 只讓新增的 chip 播放動畫

  function renderSpeed() {
    const box = $('speed');
    box.textContent = '';
    for (const [id, label] of SPEEDS) {
      const b = h('button', id === st.speed ? 'on' : '', label);
      b.title = `動畫速度：${label}`;
      b.addEventListener('click', () => {
        st.speed = id;
        renderSpeed();
      });
      box.append(b);
    }
  }

  function renderRight() {
    const e = st.entries.find((x) => x.uid === st.viewUid) || null;
    const chips = $('bestChips');
    const score = $('scoreCell');
    const info = $('detailInfo');
    chips.textContent = '';
    score.textContent = '';
    info.textContent = '';
    stepsEl.textContent = '';

    if (!e) {
      chips.append(h('span', 'bb-empty', '—'));
      score.innerHTML = '<div class="score-main"><b>–</b></div>';
      lastScore = null;
      info.append(h('span', 'dh-muted', st.entries.length ? '點擊左側學生查看檢查過程' : '逐步檢查'));
      stepsEl.append(guideEl());
      return;
    }

    info.append(h('span', 'dh-sid' + (e.sidAuto ? ' auto' : ''), e.sid));
    info.append(h('span', 'fmt-tag', FMT_LABEL[e.fmt]));
    info.append(h('span', 'dh-ans mono', displayAns(e)));
    if (e.ans && e.ans.warnings) for (const w of e.ans.warnings) info.append(h('span', 'dh-warn', w));

    if (e.status === 'error' || (e.ans && e.ans.error)) {
      chips.append(h('span', 'bb-empty', '—'));
      score.innerHTML = '<div class="score-main"><b>–</b></div>';
      stepsEl.append(h('div', 'error-box', `無法解析學生答案：${e.ans ? e.ans.error : ''}`));
      return;
    }
    const r = e.result;
    if (!r) {
      chips.append(h('span', 'bb-empty', st.key ? '等待計算…' : '請先輸入正確答案'));
      score.innerHTML = '<div class="score-main"><b>–</b></div>';
      lastScore = null;
      return;
    }

    const animating = e.uid === st.procUid && st.cursor != null;
    const n = r.steps.length;
    const c = animating ? st.cursor : n + 1; // 0 = X 定位；k = 第 k 步；n+1 = 全部完成
    const best = c === 0 ? { len: 0, start: -1, end: -1 } : c <= n ? r.snaps[c - 1] : r.best;

    // 最長正確序列
    const prev = lastChips && lastChips.uid === e.uid && lastChips.start === best.start ? lastChips.len : 0;
    lastChips = { uid: e.uid, start: best.start, len: best.len };
    if (best.len) {
      r.seq.slice(best.start, best.end + 1).forEach((id, i) => {
        if (i) chips.append(h('span', 'arrow', '→'));
        chips.append(h('span', animating && i >= prev ? 'chip pop' : 'chip', L(id)));
      });
      chips.scrollLeft = chips.scrollWidth;
    } else chips.append(h('span', 'bb-empty', c === 0 ? '先定位 X…' : '尚無正確序列'));

    // 分數
    const total = r.xScore + best.len;
    const main = h('div', 'score-main');
    main.innerHTML = `<b>${total}</b><span>/${r.max}</span>`;
    if (!animating && total === r.max) main.classList.add('full');
    const scoreKey = `${e.uid}:${total}`;
    if (lastScore && lastScore !== scoreKey && lastScore.split(':')[0] === String(e.uid)) main.classList.add('bump');
    lastScore = scoreKey;
    score.append(main, h('div', 'score-sub', `X ${r.xScore} ＋ 序列 ${best.len}`));
    score.title = `X 定位 ${r.xScore} / ${r.xChecks.length}\n最長正確序列 ${best.len} / ${st.key ? st.key.seq.length : '?'}`;

    // X 定位列
    const xr = h('div', 'xrow ' + (c === 0 ? 'current' : 'done'));
    xr.append(h('div', 's-no', 'X 定位'));
    const xc = h('div', 'x-chips hscroll');
    if (!r.xChecks.length) xc.append(h('span', 'dh-muted', '此題沒有應為 X 的敘述'));
    for (const x of r.xChecks) {
      const chip = h('span', 'xchip ' + (x.ok ? 'ok' : 'bad'));
      chip.innerHTML = `${L(x.id)} ${svg(x.ok ? 'check' : 'x')}`;
      chip.title = x.ok
        ? `ID ${L(x.id)}：學生正確判定為 X`
        : x.mark == null
          ? `ID ${L(x.id)}：學生未作答`
          : `ID ${L(x.id)}：學生放在第 ${x.mark} 步，應為 X`;
      xc.append(chip);
    }
    const xs = h('div', 'x-score');
    xs.innerHTML = `＋<b>${r.xScore}</b>`;
    xr.append(xc, xs);
    stepsEl.append(xr);

    if (!n) {
      stepsEl.append(h('div', 'empty small', '學生沒有使用任何敘述'));
      return;
    }

    // 各步驟（最長正確序列包在黃框裡）
    let box = null;
    r.steps.forEach((s, i) => {
      if (s.xBefore) {
        box = null; // X 會中斷序列，黃框不會跨過它
        const div = h('div', 'xdivider' + (i <= c - 1 ? ' done' : ''));
        div.innerHTML = `<span>X</span><em>學生在此寫了 X，正確序列從這裡中斷</em>`;
        stepsEl.append(div);
      }
      const row = stepRow(s, i, c);
      const inBest = best.len && i >= best.start && i <= best.end;
      if (inBest) {
        if (!box) {
          box = h('div', 'bestbox');
          box.append(h('span', 'bestbox-tag', `最長正確序列 · ${best.len}`));
          stepsEl.append(box);
        }
        box.append(row);
      } else stepsEl.append(row);
    });
  }

  function stepRow(s, i, c) {
    const state = i < c - 1 ? 'done' : i === c - 1 ? 'current' : 'pending';
    const row = h('div', `step ${state}`);
    row.append(h('div', 's-no', `步驟 ${i + 1}`));
    row.append(h('div', 's-id', L(s.id)));
    const keyEl = h('div', 's-key');
    const pillWrap = h('div');
    const run = h('div', 's-run');
    if (state !== 'pending') {
      keyEl.innerHTML = s.keyStep ? `正解第 ${s.keyStep} 步` : '<em>正解中為 X</em>';
      let cls;
      let icon;
      let text;
      switch (s.status) {
        case 'link':
          [cls, icon, text] = ['ok', 'link', '銜接正確'];
          break;
        case 'start':
          [cls, icon, text] = ['start', 'flag', '序列起點'];
          break;
        case 'break':
          [cls, icon, text] = ['warn', 'unlink', s.expected === 'END' ? '上一步應為最後一步' : `上一步之後應接 ${L(s.expected)}`];
          break;
        case 'restart':
          [cls, icon, text] = ['warn', 'flag', '重新起算'];
          break;
        case 'xbreak':
          [cls, icon, text] = ['warn', 'unlink', '前面有 X，序列中斷'];
          break;
        default:
          [cls, icon, text] = ['bad', 'ban', '此敘述應為 X'];
      }
      const pill = h('span', `pill ${cls}`);
      pill.innerHTML = `${svg(icon)}${text}`;
      pillWrap.append(pill);
      run.innerHTML = `連續<b>${s.run}</b>`;
    }
    row.append(keyEl, pillWrap, run);
    return row;
  }

  function scrollCurrentStep() {
    const cur = stepsEl.querySelector('.current');
    if (cur) cur.scrollIntoView({ block: 'nearest', behavior: speedDelay() >= 200 ? 'smooth' : 'auto' });
  }

  function guideEl() {
    const g = h('div', 'empty');
    g.innerHTML = `
      <div class="empty-title">${st.key ? '正確答案已設定，開始輸入學生答案吧' : '先在上方輸入正確答案'}</div>
      <div class="guide">
        <div><i>1</i><span>正確答案可用 <b>ID→步驟</b>（如 2→X→6→1…）或 <b>步驟→ID</b>（如 4→1→5→7→A→3→8→X→X→X，X 寫在最後），右上角按鈕切換格式</span></div>
        <div><i>2</i><span>任何地方按 <kbd>Enter</kbd> 新增學生：輸入學號 <kbd>Enter</kbd> → 輸入答案 <kbd>Enter</kbd>；不填學號連按兩下 <kbd>Enter</kbd> 自動產生</span></div>
        <div><i>3</i><span>X 定位正確每個 1 分，再加上沿著學生答案找到的最長連續正確序列長度</span></div>
        <div><i>4</i><span>分隔符可用 → -> , 空白；10 以上的 ID 用 A、B、C…。資料不會儲存，請記得匯出 CSV</span></div>
      </div>`;
    return g;
  }

  function renderAll() {
    renderList();
    renderRight();
  }

  /* ================= 全域操作 ================= */
  // 按鈕不搶焦點，避免 Enter 重複觸發按鈕
  document.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) e.preventDefault();
  });

  document.addEventListener('keydown', (e) => {
    const a = document.activeElement;
    const inField = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      $('searchInput').focus();
      $('searchInput').select();
      return;
    }
    if (inField) {
      if (e.key === 'Escape' && a !== sidInput && a !== ansInput) a.blur();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      sidInput.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const vis = visibleEntries();
      if (!vis.length) return;
      e.preventDefault();
      let i = vis.findIndex((x) => x.uid === st.viewUid);
      i = i < 0 ? 0 : Math.max(0, Math.min(vis.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
      select(vis[i].uid);
      scrollRowIntoView(vis[i].uid);
    } else if (e.key === 'Delete' && st.viewUid != null) {
      const ent = st.entries.find((x) => x.uid === st.viewUid);
      if (ent) removeEntry(ent);
    }
  });

  // 隱形水平捲動：滑鼠滾輪在水平區塊上轉為左右捲動
  document.addEventListener(
    'wheel',
    (e) => {
      const hs = e.target.closest && e.target.closest('.hscroll');
      if (!hs || hs.scrollWidth <= hs.clientWidth + 1) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const before = hs.scrollLeft;
      hs.scrollLeft += e.deltaY;
      if (hs.scrollLeft !== before) e.preventDefault();
    },
    { passive: false },
  );

  // 拖曳也可水平捲動
  document.addEventListener('pointerdown', (e) => {
    const hs = e.target.closest && e.target.closest('.hscroll');
    if (!hs || hs.tagName === 'INPUT' || e.button !== 0) return;
    const x0 = e.clientX;
    const s0 = hs.scrollLeft;
    const move = (ev) => (hs.scrollLeft = s0 - (ev.clientX - x0));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  window.addEventListener('beforeunload', (e) => {
    if (!window.api && st.dirty && st.entries.length) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  /* ================= 啟動 ================= */
  renderKey();
  renderSpeed();
  updateAnsFmt();
  renderAll();
  keyInput.focus();
})();
