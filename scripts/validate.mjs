// words/*.tsv と ghosts/*.ghost.json の形式検証。PR CI と デプロイ前に実行する。
// 問題があれば内容を列挙して exit 1。
//
// 読み仮名は 文字集合(READING_RE)だけでなく、本体エンジンのベンダリング
// (romaji.mjs)で「最後まで打鍵できるか」も検証する。手直しや GitHub UI からの
// 直接編集で打鍵不能な読みが紛れ込むのを、マージ前にここで止める。
// romaji.mjs / READING_RE は本体 lib/engine/romaji.js と同期させること(README参照)。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTsvMeta, parseTsvEntries, wordId, listFiles, isValidCategory } from './lib.mjs';
import { parseKana, normalizeReading } from './romaji.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

// エンジンで読みを最後まで打鍵できるか(snstyping 本体の isTypeable と同じ判定)
function isTypeable(reading) {
  try {
    const chunks = parseKana(normalizeReading(reading));
    return chunks.length > 0 && chunks.every((c) => c.candidates.length > 0);
  } catch {
    return false;
  }
}

// ---- words/*.tsv ----
const seenIds = new Map();
for (const file of listFiles(path.join(ROOT, 'words'), '.tsv')) {
  const label = `words/${file}`;
  const text = fs.readFileSync(path.join(ROOT, 'words', file), 'utf8');
  const meta = parseTsvMeta(text);
  if (!meta.title) errors.push(`${label}: 先頭コメントに「# title: 表示名」がありません`);
  if (meta.category && !isValidCategory(meta.category)) {
    errors.push(`${label}: category は「一般」またはサーバー名(ドメイン)にしてください: ${meta.category}`);
  }
  if (!/^[A-Za-z0-9@._-]+\.tsv$/.test(file)) {
    errors.push(`${label}: ファイル名に使えない文字があります(半角英数・@・.・-・_のみ)`);
  }
  const id = wordId(file);
  // id はファイル名そのもの。通常は衝突しないが、大文字小文字違い等の取りこぼしを検出する
  if (seenIds.has(id)) errors.push(`${label}: id "${id}" が ${seenIds.get(id)} と重複しています`);
  seenIds.set(id, label);

  const { entries, errors: lineErrors } = parseTsvEntries(text);
  for (const e of lineErrors) errors.push(`${label}: ${e}`);
  if (entries.length === 0) errors.push(`${label}: エントリが1件もありません`);

  // 打鍵可能性(文字集合を通っても、エンジンで打てない読みは弾く)と display の重複
  const seenDisplays = new Map();
  for (const [i, e] of entries.entries()) {
    if (!isTypeable(e.reading)) {
      errors.push(`${label}: 「${e.display}」の読み「${e.reading}」は最後まで打鍵できません`);
    }
    if (seenDisplays.has(e.display)) {
      errors.push(`${label}: 表示テキスト「${e.display}」が重複しています(${seenDisplays.get(e.display)}行目とこの${i + 1}件目)`);
    } else {
      seenDisplays.set(e.display, i + 1);
    }
  }
}

// ---- ghosts/*.ghost.json ----
// snstyping 本体の lib/engine/ghost.js validateGhost と同等の構造チェック
for (const file of listFiles(path.join(ROOT, 'ghosts'), '.ghost.json')) {
  const label = `ghosts/${file}`;
  let g;
  try {
    g = JSON.parse(fs.readFileSync(path.join(ROOT, 'ghosts', file), 'utf8'));
  } catch (e) {
    errors.push(`${label}: JSONとして読めません: ${e.message}`);
    continue;
  }
  const bad = (msg) => errors.push(`${label}: ${msg}`);
  if (g.version !== 1) bad(`未対応のバージョンです(version: ${g.version})`);
  if (typeof g.player?.name !== 'string') bad('player.name がありません');
  if (!(g.rule?.durationSec > 0)) bad('rule.durationSec が不正です');
  if (!Array.isArray(g.words) || g.words.length === 0) bad('words がありません');
  else if (g.words.some((w) => typeof w?.display !== 'string' || typeof w?.reading !== 'string')) {
    bad('words に display/reading が文字列でないエントリがあります');
  }
  if (!Array.isArray(g.keys) || g.keys.length === 0) bad('keys がありません');
  else if (g.keys.some((k) => !Array.isArray(k) || typeof k[0] !== 'number' || typeof k[1] !== 'string')) {
    bad('keys に [ms, key] 形式でない要素があります');
  }
  if (typeof g.stats !== 'object' || g.stats === null) bad('stats がありません');
}

if (errors.length > 0) {
  console.error(`✗ 検証エラー ${errors.length}件:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('✓ 検証OK');
