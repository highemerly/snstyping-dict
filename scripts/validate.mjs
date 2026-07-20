// words/*.tsv と ghosts/*.ghost.json の形式検証。PR CI と デプロイ前に実行する。
// 問題があれば内容を列挙して exit 1。
//
// 注: ローマ字打鍵可能性の完全検証は snstyping 本体のエンジン依存のため、
// ここでは文字集合の正規表現チェックに留める(READING_RE は本体の
// lib/engine/romaji.js のローマ字表と同期させること)。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTsvMeta, parseTsvEntries, wordId, listFiles, CATEGORIES } from './lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

// ---- words/*.tsv ----
const seenIds = new Map();
for (const file of listFiles(path.join(ROOT, 'words'), '.tsv')) {
  const label = `words/${file}`;
  const text = fs.readFileSync(path.join(ROOT, 'words', file), 'utf8');
  const meta = parseTsvMeta(text);
  if (!meta.title) errors.push(`${label}: 先頭コメントに「# title: 表示名」がありません`);
  if (meta.category && !CATEGORIES.includes(meta.category)) {
    errors.push(`${label}: category が不正です(${CATEGORIES.join(' / ')} のみ): ${meta.category}`);
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
