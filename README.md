# snstyping-dict

[snstyping](https://github.com/highemerly) の単語リスト(辞書)とゴーストファイルの配信リポジトリ。
GitHub Pages で配信し、アプリは実行時にここから取得する。

- カタログ: `https://highemerly.github.io/snstyping-dict/catalog.json`
- 単語リスト: `https://highemerly.github.io/snstyping-dict/words/<file>`
- ゴースト: `https://highemerly.github.io/snstyping-dict/ghosts/<file>`

`catalog.json` はコミットしない。main への push で GitHub Actions が
`scripts/build-catalog.mjs` により自動生成し、Pages にデプロイする
(反映は CDN キャッシュ含め最大10分程度)。

## 辞書(words/*.tsv)の形式

```
# title: はん @highemerly   ← 必須。選択UIに表示される名前
# category: handon.club     ← 省略可。「一般」(既定) または「handon.club」
表示テキスト<TAB>ふりがな(ひらがな)
...
```

- **id はファイル名から導出**する(ヘッダには書かない)。`proverbs.tsv` → id `proverbs`。
- **バージョンはファイル名末尾の `@YYYYMMDDHHMM`**(数字12〜14桁)。
  `@highemerly@handon.club@202607172345.tsv` → id `@highemerly@handon.club`、
  version `202607172345`。バージョン無しのファイル(`proverbs.tsv` など)は version `null`。
  内容を更新したときはバージョン付きファイル名で置き、**同一idの旧ファイルは削除**する
  (共存は Validate がエラーにする)。ランキング等では id + version の組で辞書の版を区別する。
- 並び順は カタログ生成時に カテゴリ順(一般 → handon.club)→ id順 で決まる(`order` は廃止)。
- ファイル名に使えるのは 半角英数・`@`・`.`・`-`・`_`。
- `#` 始まりはコメント。メタデータはファイル先頭のコメントブロックに書く。
- ふりがなに使えるのは ひらがな(カタカナも可、ひらがなに正規化される)・ー・
  記号 、。！？・「」・空白・ASCII印字可能文字(英数字はそのキーを1打鍵)。
  漢字などキーボードで直接打てない文字は不可
  (snstyping 本体 `lib/engine/romaji.js` の挙動と対応。ローマ字表を拡張したら
  `scripts/lib.mjs` の `READING_RE` も同期させること)。

## ゴースト(ghosts/*.ghost.json)の形式

snstyping 本体の `.ghost.json` 形式(version 1)。トップレベルに `"title"` を
足すと選択UIの表示名になる(省略時は `プレイヤー名 (KPM xxx)` を自動生成)。
`"order"`(数値)で並び順も指定できる(無指定は末尾・id順)。
id はファイル名(`demo.ghost.json` → `demo`)。

## 追加・更新の手順

1. `words/` に TSV を追加(または置き換え)する PR を作る。**辞書ファイルだけでよい**。
   カタログの更新は不要(マージ後に Actions が自動生成)。
2. PR で `Validate` ワークフローが形式チェックする。
3. マージすると `Deploy Pages` が走り、数分でアプリに反映される。

### プログラムからの更新(別アプリ向け)

fine-grained PAT(このリポジトリの Contents: Read and write / Pull requests: Read and write)
を発行し、GitHub API でブランチ作成 → ファイル追加(PUT /repos/{owner}/{repo}/contents/{path})
→ PR 作成。auto-merge を有効にすれば Validate 通過後に自動でマージされる。

## ローカルでの検証

```
node scripts/validate.mjs        # 形式チェック
node scripts/build-catalog.mjs   # catalog.json をローカル生成(gitignore済み)
```
