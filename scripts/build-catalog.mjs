// words/*.tsv と ghosts/*.ghost.json を走査して catalog.json を生成する。
// カタログはコミットせず、GitHub Actions のデプロイ時に生成して Pages 成果物に含める。
//
//   node scripts/build-catalog.mjs [出力先ディレクトリ]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTsvMeta, parseTsvEntries, idFromFilename, listFiles } from './lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;

const words = [];
for (const file of listFiles(path.join(ROOT, 'words'), '.tsv')) {
  const text = fs.readFileSync(path.join(ROOT, 'words', file), 'utf8');
  const meta = parseTsvMeta(text);
  const { entries } = parseTsvEntries(text);
  words.push({
    id: meta.id || idFromFilename(file),
    title: meta.title || idFromFilename(file),
    file,
    entries: entries.length,
    order: meta.order != null ? Number(meta.order) : null,
  });
}
words.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.id.localeCompare(b.id));
for (const w of words) delete w.order;

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

const catalog = { version: 1, words, ghosts };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
console.log(`catalog.json: 単語リスト${words.length}件 / ゴースト${ghosts.length}件 → ${outDir}`);
