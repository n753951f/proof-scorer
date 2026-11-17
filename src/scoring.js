/*
 * 證明排序評分 — 核心計分邏輯
 *
 * 兩種序列格式：
 *   its (ID→步驟)：依 ID 1,2,3,… 的順序寫出各敘述在證明中的步驟編號，不用的寫 X
 *                  例：2→X→6→1→3→X→4→7→X→5
 *   sti (步驟→ID)：依證明步驟順序寫出各步驟使用的敘述 ID
 *                  例：4→1→5→7→A→3→8
 *
 * 計分：
 *   1. X 定位：正解為 X 的每個 ID，學生也判為 X（未使用）→ 各得 1 分
 *   2. 將學生答案轉為步驟→ID 序列
 *   3. 沿著學生序列走，找出「在正解中也是連續相接」的最長片段，其長度即序列分
 *   總分 = X 分 + 序列分，滿分 = ID 總數
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Scoring = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ITS = 'its';
  const STI = 'sti';
  // 分隔符：-> → => > - , ， 、 | / ; ； 空白
  const SEP = /(?:-+>|=+>|[→⇒➔➜>\-,、|\/;；\s])+/;
  const BLANK = new Set(['_', '?', '.', '·', '*']);

  // 全形英數與符號轉半形
  function normalize(text) {
    return String(text == null ? '' : text)
      .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      .replace(/　/g, ' ')
      .trim();
  }

  function tokenize(text) {
    const s = normalize(text);
    if (!s) return [];
    if (SEP.test(s)) return s.split(SEP).filter((t) => t !== '');
    return Array.from(s); // 沒有分隔符時逐字切開，例如 2X613X47X5
  }

  function parseToken(t) {
    const u = t.toUpperCase();
    if (u === 'X' || u === '×') return { kind: 'x' };
    if (BLANK.has(u)) return { kind: 'blank' };
    if (/^\d+$/.test(u)) {
      const n = parseInt(u, 10);
      return n > 0 ? { kind: 'num', n } : { kind: 'bad', t };
    }
    if (/^[A-Z]$/.test(u)) return { kind: 'num', n: u.charCodeAt(0) - 55 }; // A=10, B=11…
    return { kind: 'bad', t };
  }

  /** ID 顯示：10 以上用字母 A、B、C… */
  function idLabel(n) {
    return n >= 10 && n < 36 ? String.fromCharCode(55 + n) : String(n);
  }

  /**
   * 自動判斷格式：
   *   有 X 或空白項 → ID→步驟
   *   有字母 ID（A、B…）→ 步驟→ID
   *   已知 ID 總數 n 而長度不等於 n → 步驟→ID（ID→步驟 必須每個 ID 一項）
   *   其餘無法分辨 → 用預設格式（正確答案的格式）
   */
  function detectFormat(text, fallback, n) {
    const toks = tokenize(text).map(parseToken);
    if (toks.some((t) => t.kind === 'blank')) return ITS;
    // X 出現在中間（後面還有數字）→ 只可能是 ID→步驟；X 全在結尾則兩種都有可能
    const firstX = toks.findIndex((t) => t.kind === 'x');
    if (firstX >= 0 && toks.slice(firstX).some((t) => t.kind !== 'x')) return ITS;
    // ID→步驟 必須剛好每個 ID 一項
    if (n && toks.length !== n) return STI;
    // ID→步驟 的步驟編號不會超過使用的項目數（例如 1 4 5 7 A 3 8 X X X 有 A=10 但只用 7 項）
    const nums = toks.filter((t) => t.kind === 'num').map((t) => t.n);
    if (nums.length && Math.max(...nums) > nums.length) return STI;
    return fallback === ITS ? ITS : STI;
  }

  /**
   * 解析一個答案字串
   * 回傳 { fmt, seq: 步驟→ID 序列, marks?: (ITS) 每個 ID 的標記, warnings, dupSteps, dupIds }
   * 或 { error }
   */
  function parseAnswer(text, fmt) {
    const raw = tokenize(text);
    if (!raw.length) return { error: '尚未輸入' };
    const toks = raw.map(parseToken);
    const bad = toks.find((t) => t.kind === 'bad');
    if (bad) return { error: `無法辨識「${bad.t}」` };
    const warnings = [];

    if (fmt === ITS) {
      const marks = toks.map((t) => (t.kind === 'x' ? 'X' : t.kind === 'blank' ? null : t.n));
      const pairs = [];
      marks.forEach((m, i) => {
        if (typeof m === 'number') pairs.push({ id: i + 1, step: m });
      });
      pairs.sort((a, b) => a.step - b.step || a.id - b.id);
      const count = new Map();
      pairs.forEach((p) => count.set(p.step, (count.get(p.step) || 0) + 1));
      const dupSteps = [...count].filter(([, c]) => c > 1).map(([s]) => s);
      const maxStep = pairs.length ? pairs[pairs.length - 1].step : 0;
      const missing = [];
      for (let s = 1; s <= maxStep; s++) if (!count.has(s)) missing.push(s);
      if (dupSteps.length) warnings.push(`步驟 ${dupSteps.join('、')} 重複`);
      if (missing.length) warnings.push(`缺少步驟 ${missing.join('、')}`);
      if (marks.includes(null)) warnings.push('有空白未作答的項目');
      return { fmt, marks, seq: pairs.map((p) => p.id), warnings, dupSteps, missing };
    }

    // 步驟→ID：可在最後用 X 補滿到 ID 總數，例如 1→4→5→7→A→3→8→X→X→X
    const firstX = toks.findIndex((t) => t.kind === 'x');
    if (firstX >= 0 && toks.slice(firstX).some((t) => t.kind !== 'x'))
      return { error: '「步驟→ID」格式的 X 只能寫在最後' };
    const trailingX = firstX >= 0 ? toks.length - firstX : 0;
    const seq = toks.filter((t) => t.kind === 'num').map((t) => t.n);
    const seen = new Set();
    const dupIds = [];
    seq.forEach((id) => {
      if (seen.has(id) && !dupIds.includes(id)) dupIds.push(id);
      seen.add(id);
    });
    if (dupIds.length) warnings.push(`ID ${dupIds.map(idLabel).join('、')} 重複使用`);
    return { fmt, seq, warnings, dupIds, trailingX, length: toks.length };
  }

  /**
   * 解析正確答案
   * nOverride：手動指定 ID 總數（步驟→ID 格式時，最後幾個 ID 若是 X 會無法從序列推得）
   */
  function parseKey(text, fmt, nOverride) {
    const a = parseAnswer(text, fmt);
    if (a.error) return a;
    if (!a.seq.length) return { error: '正確答案至少需要一個步驟' };
    let autoN;
    if (fmt === ITS) {
      if (a.marks.includes(null)) return { error: '正確答案不可有空白項目' };
      if (a.dupSteps.length) return { error: `步驟 ${a.dupSteps.join('、')} 重複` };
      if (a.missing.length) return { error: `步驟編號不連續，缺少 ${a.missing.join('、')}` };
      autoN = a.marks.length;
    } else {
      if (a.dupIds.length) return { error: `ID ${a.dupIds.map(idLabel).join('、')} 重複` };
      autoN = Math.max(Math.max(...a.seq), a.length); // 結尾的 X 也算進 ID 總數
    }
    const n = Math.max(autoN, Number(nOverride) || 0);
    const seq = a.seq;
    const pos = new Map(seq.map((id, i) => [id, i]));
    const succ = new Map();
    for (let i = 0; i < seq.length - 1; i++) succ.set(seq[i], seq[i + 1]);
    const xIds = [];
    for (let id = 1; id <= n; id++) if (!pos.has(id)) xIds.push(id);
    return { fmt, n, autoN, seq, pos, succ, xIds, max: n, signature: `${n}|${seq.join(',')}` };
  }

  /** 評分：回傳每一步的狀態與「到該步為止」的最長序列快照，供動畫逐步顯示 */
  function evaluate(key, ans) {
    const used = new Set(ans.seq);
    const markOf = (id) => {
      if (ans.fmt === ITS) {
        const m = ans.marks[id - 1];
        return m === undefined ? null : m;
      }
      return used.has(id) ? ans.seq.indexOf(id) + 1 : 'X';
    };

    const xChecks = key.xIds.map((id) => {
      const mark = markOf(id);
      return { id, mark, ok: mark === 'X' };
    });
    const xScore = xChecks.filter((c) => c.ok).length;

    const steps = [];
    const snaps = [];
    let best = { len: 0, start: -1, end: -1 };
    let run = 0;
    ans.seq.forEach((id, i) => {
      const kp = key.pos.has(id) ? key.pos.get(id) : -1;
      const prev = i > 0 ? ans.seq[i - 1] : null;
      const prevInKey = prev != null && key.pos.has(prev);
      let status;
      if (kp < 0) {
        run = 0;
        status = 'notInKey'; // 正解中此 ID 應為 X
      } else if (prevInKey && key.succ.get(prev) === id) {
        run += 1;
        status = 'link'; // 與上一步的銜接正確
      } else {
        run = 1;
        status = i === 0 ? 'start' : prevInKey ? 'break' : 'restart';
      }
      let expected = null;
      if (status === 'break') expected = key.succ.has(prev) ? key.succ.get(prev) : 'END';
      if (run > best.len) best = { len: run, start: i - run + 1, end: i };
      steps.push({ i, id, keyStep: kp >= 0 ? kp + 1 : null, status, run, expected });
      snaps.push({ ...best });
    });

    return {
      xChecks,
      xScore,
      steps,
      snaps,
      best,
      seqScore: best.len,
      total: xScore + best.len,
      max: key.max,
      bestIds: best.len ? ans.seq.slice(best.start, best.end + 1) : [],
      warnings: ans.warnings,
      fmt: ans.fmt,
      seq: ans.seq,
    };
  }

  /** 步驟→ID；給 n 時在結尾用 X 補滿到 n 項 */
  function formatSti(seq, arrow = ' → ', n = 0) {
    const out = seq.map(idLabel);
    while (out.length < n) out.push('X');
    return out.join(arrow);
  }

  function formatIts(seq, n, arrow = ' → ') {
    const pos = new Map(seq.map((id, i) => [id, i + 1]));
    const out = [];
    for (let id = 1; id <= n; id++) out.push(pos.has(id) ? String(pos.get(id)) : 'X');
    return out.join(arrow);
  }

  /** 將答案字串依其格式正規化顯示（保留學生原本格式） */
  function formatAnswer(ans, arrow = ' → ') {
    if (ans.fmt === ITS) return ans.marks.map((m) => (m === null ? '_' : String(m))).join(arrow);
    return formatSti(ans.seq, arrow, ans.seq.length + (ans.trailingX || 0));
  }

  return {
    ITS,
    STI,
    normalize,
    tokenize,
    parseToken,
    idLabel,
    detectFormat,
    parseAnswer,
    parseKey,
    evaluate,
    formatSti,
    formatIts,
    formatAnswer,
  };
});
