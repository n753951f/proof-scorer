// docs/使用說明.md 中「極端情況範例」的每一列都在這裡驗證，文件與程式行為保持一致
const assert = require('assert');
const S = require('../src/scoring.js');

// 正確答案（範例題 Q1）：步驟→ID 4→1→5→7→A→3→8，ID 2、6、9 為 X，共 10 個 ID
const key = S.parseKey('4 1 5 7 A 3 8 X X X', S.STI);
assert.ifError(key.error);

// [編號, 學生答案, 預期判斷格式, X 分, 序列分, 總分, 最長正確序列]
const cases = [
  ['A1', '4 1 5 7 A 3 8 X X X', S.STI, 3, 7, 10, '4→1→5→7→A→3→8'],
  ['A2', '4 1 5 7 A 3 8', S.STI, 3, 7, 10, '4→1→5→7→A→3→8'],
  ['A3', '2 X 6 1 3 X 4 7 X 5', S.ITS, 3, 7, 10, '4→1→5→7→A→3→8'],
  ['A4', '2X613X47X5', S.ITS, 3, 7, 10, '4→1→5→7→A→3→8'],
  ['A5', '4157A38', S.STI, 3, 7, 10, '4→1→5→7→A→3→8'],
  ['A6', '４，１，５，７，ａ，３，８', S.STI, 3, 7, 10, '4→1→5→7→A→3→8'],
  ['A7', '4->1->5->7->10->3->8', S.STI, 3, 7, 10, '4→1→5→7→A→3→8'],
  ['B1', '1 4 5 7 A 3 8 X X X', S.STI, 3, 5, 8, '5→7→A→3→8'],
  ['B2', '4 1 5 X 7 A 3 8', S.STI, 3, 4, 7, '7→A→3→8'],
  ['B3', '4 1 X X 5 7 A 3 8', S.STI, 3, 5, 8, '5→7→A→3→8'],
  ['B4', 'X 4 1 5 7 A 3 8', S.STI, 3, 7, 10, '4→1→5→7→A→3→8'],
  ['B5', '4 1 5 6 7 A 3 8', S.STI, 2, 4, 6, '7→A→3→8'],
  ['B6', '4 1 7 A 3 8', S.STI, 3, 4, 7, '7→A→3→8'],
  ['B7', '8 3 A 7 5 1 4', S.STI, 3, 1, 4, '8'],
  ['B8', '4 1 3 8 5 7', S.STI, 3, 2, 5, '4→1'],
  ['C1', 'X X X X X X X X X X', S.STI, 3, 0, 3, ''],
  ['C2', '2 6 9', S.STI, 0, 0, 0, ''],
  ['C3', '4 1 5 7 A 3 8 4', S.STI, 3, 7, 10, '4→1→5→7→A→3→8'],
  ['C4', '4 1 5 7 A 3 8 B', S.STI, 3, 7, 10, '4→1→5→7→A→3→8'],
  ['D1', '2 _ 6 1 3 X 4 7 X 5', S.ITS, 2, 7, 9, '4→1→5→7→A→3→8'],
  // 跳號的 ID→步驟 會被自動判成 步驟→ID，需手動切換格式
  ['D2', '2 X 7 1 3 X 4 8 X 5', S.STI, 3, 7, 10, '4→1→5→7→A→3→8', S.ITS],
  ['D3', '2 X 6 1 3 X 4 4 X 5', S.ITS, 3, 4, 7, '4→1→5→7'],
  // 漏寫最後一項的 ID→步驟（只有 9 項）會被判成 步驟→ID，需手動切換格式
  ['D4', '2 X 6 1 3 X 4 7 X', S.STI, 3, 4, 7, '4→1→5→7', S.ITS],
];

// D4 若不切換、直接用自動判斷的 步驟→ID 計算，只會得 2 分
{
  const r = S.evaluate(key, S.parseAnswer('2 X 6 1 3 X 4 7 X', S.STI));
  assert.strictEqual(r.total, 2, 'D4 未切換格式');
}

for (const [id, text, fmt, x, seq, total, best, force] of cases) {
  const f = S.detectFormat(text, key.fmt, key.n);
  assert.strictEqual(f, fmt, `${id} 格式判斷`);
  const a = S.parseAnswer(text, force || f);
  assert.ifError(a.error);
  const r = S.evaluate(key, a);
  assert.deepStrictEqual(
    [r.xScore, r.seqScore, r.total, S.formatSti(r.bestIds, '→')],
    [x, seq, total, best],
    `${id}「${text}」`,
  );
}

// 格式錯誤
assert.ok(S.parseAnswer('4 1 # 5', S.STI).error, 'E1 無法辨識的字元');
assert.ok(S.parseKey('4 1 X 5 7', S.STI).error, 'E2 正確答案中間有 X');
assert.ok(S.parseKey('4 1 5 4', S.STI).error, 'E3 正確答案 ID 重複');
assert.ok(S.parseKey('2 X 7 1 3 X 4 8 X 5', S.ITS).error, 'E4 正確答案步驟跳號');
assert.ok(S.parseKey('2 _ 6 1', S.ITS).error, 'E5 正確答案有空白');

// 同長度的最長序列：取第一段
const tie = S.evaluate(key, S.parseAnswer('4 1 X 7 A', S.STI));
assert.strictEqual(S.formatSti(tie.bestIds, '→'), '4→1');

// 13 個 ID 的題目（考卷 P2 的寫法）：A–D 為 10–13
const p2 = S.parseAnswer('9 C 2 3 7 D 5 1 8 A 4 X X', S.STI);
assert.deepStrictEqual(p2.seq, [9, 12, 2, 3, 7, 13, 5, 1, 8, 10, 4]);

console.log(`all ${cases.length} edge cases passed`);
