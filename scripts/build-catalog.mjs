// words/*.tsv と ghosts/*.ghost.json を走査して words.json / ghosts.json を生成する。
// カタログはコミットせず、GitHub Actions のデプロイ時に生成して Pages 成果物に含める。
//
//   node scripts/build-catalog.mjs [出力先ディレクトリ]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTsvMeta, parseTsvEntries, wordId, contentVersion, listFiles, CATEGORIES, DEFAULT_CATEGORY } from './lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;

const words = [];
for (const file of listFiles(path.join(ROOT, 'words'), '.tsv')) {
  const text = fs.readFileSync(path.join(ROOT, 'words', file), 'utf8');
  const meta = parseTsvMeta(text);
  const { entries } = parseTsvEntries(text);
  const id = wordId(file);
  words.push({
    id,
    title: meta.title || id,
    category: meta.category || DEFAULT_CATEGORY,
    version: contentVersion(text),
    file,
    entries: entries.length,
  });
}
// カテゴリ順(CATEGORIES の並び、未知カテゴリは末尾)→ id順
const catIndex = (c) => (CATEGORIES.includes(c) ? CATEGORIES.indexOf(c) : CATEGORIES.length);
words.sort((a, b) => catIndex(a.category) - catIndex(b.category) || a.id.localeCompare(b.id));

const ghosts = [];
for (const file of listFiles(path.join(ROOT, 'ghosts'), '.ghost.json')) {
  const g = JSON.parse(fs.readFileSync(path.join(ROOT, 'ghosts', file), 'utf8'));
  ghosts.push({
    id: file.replace(/\.ghost\.json$/, ''),
    title: g.title || `${g.player?.name ?? '???'} (KPM ${g.stats?.kpm ?? '?'})`,
    file,
    durationSec: g.rule?.durationSec ?? null,
    order: typeof g.order === 'number' ? g.order : null,
  });
}
ghosts.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.id.localeCompare(b.id));
for (const g of ghosts) delete g.order;

// カタログは辞書(words.json)とゴースト(ghosts.json)の2ファイルに分けて配信する。
// version は各カタログのスキーマ版(辞書中身のバージョンとは別物)。
fs.mkdirSync(outDir, { recursive: true });
const write = (name, obj) => fs.writeFileSync(path.join(outDir, name), JSON.stringify(obj, null, 2) + '\n');
write('words.json', { version: 2, words });
write('ghosts.json', { version: 2, ghosts });
console.log(`words.json: 単語リスト${words.length}件 / ghosts.json: ゴースト${ghosts.length}件 → ${outDir}`);
