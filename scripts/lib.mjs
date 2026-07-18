// build-catalog.mjs / validate.mjs 共通のパース処理

import fs from 'node:fs';
import path from 'node:path';

// snstyping の判定エンジンが受理できる読み仮名の文字集合。
// - ひらがな(小書き・ゔゐゑ含む)・ー と、ローマ字表の記号 、。！？・「」
// - カタカナ(エンジンが normalizeReading でひらがなに変換)と全角スペース
// - ASCII印字可能文字(テーブル外文字は「その文字を1打鍵」として受理される)
// 漢字などキーボードで直接打てない文字は不可。
export const READING_RE = /^[ぁ-ゖァ-ヶー、。！？・「」　\x20-\x7e]+$/u;

// TSV先頭のコメントブロックから `# key: value` 形式のメタデータを読む
export function parseTsvMeta(text) {
  const meta = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('#')) break; // 先頭コメントブロックの終わり
    const m = line.match(/^#\s*(id|title|order)\s*:\s*(.+)$/);
    if (m) meta[m[1]] = m[2].trim();
  }
  return meta;
}

// エントリ行(コメント・空行以外)をパースする
export function parseTsvEntries(text) {
  const entries = [];
  const errors = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    const cols = line.split('\t');
    const display = cols[0]?.trim();
    const reading = cols[1]?.trim();
    if (cols.length !== 2 || !display || !reading) {
      errors.push(`${i + 1}行目: 「表示テキスト<TAB>ふりがな」の2カラムではありません`);
      continue;
    }
    if (!READING_RE.test(reading)) {
      const bad = [...reading].filter((c) => !READING_RE.test(c)).join('');
      errors.push(`${i + 1}行目: ふりがなに使えない文字が含まれます: ${bad}`);
      continue;
    }
    entries.push({ display, reading });
  }
  return { entries, errors };
}

// ファイル名からidを導出(idヘッダ省略時のフォールバック)
export function idFromFilename(file) {
  return path
    .basename(file)
    .replace(/\.tsv$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function listFiles(dir, suffix) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(suffix))
    .sort();
}
