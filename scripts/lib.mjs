// build-catalog.mjs / validate.mjs 共通のパース処理

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// snstyping の判定エンジンが受理できる読み仮名の文字集合。
// - ひらがな(小書き・ゔゐゑ含む)・ー と、ローマ字表の記号 、。！？・「」
// - カタカナ(エンジンが normalizeReading でひらがなに変換)と全角スペース
// - ASCII印字可能文字(テーブル外文字は「その文字を1打鍵」として受理される)
// 漢字などキーボードで直接打てない文字は不可。
export const READING_RE = /^[ぁ-ゖァ-ヶー、。！？・「」　\x20-\x7e]+$/u;

// 辞書カテゴリ。「一般」(既定・運営の単語リスト)または SNS のサーバー名(ドメイン)。
// サーバーは列挙しない: ドメイン形式なら自動で許可する(新しいサーバーの追加にコード変更は不要)。
export const DEFAULT_CATEGORY = '一般';

export function isValidCategory(category) {
  return category === DEFAULT_CATEGORY || /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(category);
}

// カタログ・UIの表示順: 「一般」を先頭に、その後はサーバー名の辞書順。
export function categoryRank(category) {
  return category === DEFAULT_CATEGORY ? 0 : 1;
}

// TSV先頭のコメントブロックから `# key: value` 形式のメタデータを読む
export function parseTsvMeta(text) {
  const meta = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('#')) break; // 先頭コメントブロックの終わり
    const m = line.match(/^#\s*(title|category)\s*:\s*(.+)$/);
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

// ファイル名から id を導出する(ファイル名 = id + .tsv)。
// バージョンはファイル名ではなく中身のハッシュ(contentVersion)で管理する。
//   proverbs.tsv                → 'proverbs'
//   @user@handon.club.tsv       → '@user@handon.club'
export function wordId(file) {
  return path.basename(file).replace(/\.tsv$/, '');
}

// 辞書の版(バージョン)。中身が変わったときだけ変わる内容ハッシュ。
// git 履歴に依存せず、revert すれば版も元に戻る(＝過去のランキングが再び有効になる)。
// sha256 の先頭10桁。ランキングは id + version の組で辞書の版を区別する。
export function contentVersion(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 10);
}

export function listFiles(dir, suffix) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(suffix))
    .sort();
}
