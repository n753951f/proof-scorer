const assert = require('assert');
const S = require('../src/scoring.js');

const keyIts = S.parseKey('2->X->6->1->3->X->4->7->X->5', S.ITS);
const keySti = S.parseKey('4->1->5->7->A->3->8', S.STI);
assert.ifError(keyIts.error);
assert.deepStrictEqual(keyIts.seq, [4, 1, 5, 7, 10, 3, 8]);
assert.deepStrictEqual(keyIts.xIds, [2, 6, 9]);
assert.strictEqual(keyIts.signature, keySti.signature, '兩種格式的正解應相同');

function score(key, text, fmt) {
  const a = S.parseAnswer(text, fmt || S.detectFormat(text, key.fmt, key.n));
  if (a.error) throw new Error(a.error);
  return S.evaluate(key, a);
}

// 全對（兩種寫法、緊湊寫法、全形箭頭）
for (const [t, f] of [
  ['4→1→5→7→A→3→8', S.STI],
  ['2X613X47X5', S.ITS],
  ['２，Ｘ，６，１，３，Ｘ，４，７，Ｘ，５', S.ITS],
  ['4 1 5 7 a 3 8', S.STI],
]) {
  const r = score(keyIts, t, f);
  assert.strictEqual(r.total, 10, t);
}

// 漏掉 5：X 全對 3 分，最長 7→A→3→8 = 4
let r = score(keyIts, '4 1 7 A 3 8', S.STI);
assert.strictEqual(r.xScore, 3);
assert.strictEqual(r.seqScore, 4);
assert.deepStrictEqual(r.bestIds, [7, 10, 3, 8]);

// 多用了 6（應為 X）並放在中間：X 得 2 分，序列 4→1→5 = 3（6 打斷），7→A→3→8 = 4
r = score(keyIts, '4 1 5 6 7 A 3 8', S.STI);
assert.strictEqual(r.xScore, 2);
assert.strictEqual(r.seqScore, 4);
assert.strictEqual(r.steps[3].status, 'notInKey');
assert.strictEqual(r.steps[4].status, 'restart');

// ID→步驟 寫法、順序對調
r = score(keyIts, '1 X 6 2 3 X 4 7 X 5', S.ITS); // 1 和 4 對調 → 1→4→5→7→A→3→8
assert.deepStrictEqual(r.seq, [1, 4, 5, 7, 10, 3, 8]);
assert.strictEqual(r.seqScore, 5); // 5→7→A→3→8
assert.strictEqual(r.total, 8);

// 錯誤
assert.ok(S.parseAnswer('4 1 # 5', S.STI).error);
assert.ok(S.parseKey('1 2 2', S.ITS).error);

// ID 數覆寫（步驟→ID 正解最後一個是 X）
const k2 = S.parseKey('3 1 2', S.STI, 4);
assert.deepStrictEqual(k2.xIds, [4]);
assert.strictEqual(S.formatIts(k2.seq, k2.n, '→'), '2→3→1→X');



// ---- 步驟→ID 結尾補 X、字母 ID（考卷 P1 / P2 的寫法）----
const p1 = S.parseKey('4 1 5 7 A 3 8 X X X', S.STI);
assert.ifError(p1.error);
assert.strictEqual(p1.n, 10);
assert.deepStrictEqual(p1.xIds, [2, 6, 9]);
assert.strictEqual(S.formatSti(p1.seq, '→', p1.n), '4→1→5→7→A→3→8→X→X→X');
// 結尾為 X 的 ID 也能從補 X 推得總數
const k3 = S.parseKey('3 1 2 X', S.STI);
assert.deepStrictEqual(k3.xIds, [4]);
// 學生（考卷 P1）：1 4 5 7 A 3 8 X X X → 自動判斷為 步驟→ID
const stu = '1 4 5 7 A 3 8 X X X';
assert.strictEqual(S.detectFormat(stu, S.ITS, 10), S.STI);
r = score(p1, stu, S.STI);
assert.strictEqual(r.xScore, 3); // 2、6、9 都沒用到
assert.strictEqual(r.seqScore, 5); // 5→7→A→3→8
assert.strictEqual(S.formatAnswer(S.parseAnswer(stu, S.STI), '→'), '1→4→5→7→A→3→8→X→X→X');
// 考卷 P2：13 個 ID（1-9, A-D）
const p2 = S.parseAnswer('9 C 2 3 7 D 5 1 8 A 4 X X', S.STI);
assert.ifError(p2.error);
assert.deepStrictEqual(p2.seq, [9, 12, 2, 3, 7, 13, 5, 1, 8, 10, 4]);
assert.strictEqual(S.detectFormat('9 C 2 3 7 D 5 1 8 A 4 X X', S.ITS, 13), S.STI);
// X 寫在中間仍是 ID→步驟；步驟→ID 中間出現 X 為錯誤
assert.strictEqual(S.detectFormat('2X613X47X5', S.STI, 10), S.ITS);

// 步驟→ID 省略結尾的 X 也算正確
r = score(p1, '1 4 5 7 A 3 8', S.STI);
assert.strictEqual(r.total, 8);
assert.strictEqual(score(p1, '4 1 5 7 A 3 8', S.STI).total, 10);
assert.strictEqual(S.detectFormat('1 4 5 7 A 3 8', S.ITS, 10), S.STI);

// 步驟→ID 中間的 X 會中斷正確序列：4→1→5 | X | 7→A→3→8
r = score(p1, '4 1 5 X 7 A 3 8 X X', S.STI);
assert.strictEqual(r.xScore, 3);
assert.strictEqual(r.seqScore, 4);
assert.strictEqual(r.steps[3].status, 'xbreak');
assert.strictEqual(S.formatAnswer(S.parseAnswer('4 1 5 X 7 A 3 8 X X', S.STI), '→'), '4→1→5→X→7→A→3→8→X→X');
assert.strictEqual(S.detectFormat('4 1 5 X 7 A 3 8 X X', S.ITS, 10), S.STI);
// ID→步驟 的 X 只是定位，不會中斷（先定位 X 再轉成步驟→ID）
assert.strictEqual(score(p1, '2 X 6 1 3 X 4 7 X 5', S.ITS).total, 10);
// 正確答案的 X 只能在最後
assert.ok(S.parseKey('4 1 X 5', S.STI).error);

console.log('all scoring tests passed');
