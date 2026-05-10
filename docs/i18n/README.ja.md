# Obsidian Sync Trakt

[![Latest release](https://img.shields.io/github/v/release/o1xhack/obsidian-sync-trakt?include_prereleases&label=release&color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![Total downloads](https://img.shields.io/github/downloads/o1xhack/obsidian-sync-trakt/total?color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![License](https://img.shields.io/github/license/o1xhack/obsidian-sync-trakt?color=7c3aed)](../../LICENSE)
[![Min Obsidian version](https://img.shields.io/badge/obsidian-1.4.0%2B-7c3aed)](https://obsidian.md)

**[Trakt.tv](https://trakt.tv) の視聴履歴を、エピソード単位のタイムスタンプ・15 以上の言語に対応したメタデータ・vault をかき乱さない静かなインクリメンタル同期付きで、リッチにローカライズされた Markdown ライブラリに変換します。**

> 🌐 [English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · **日本語** · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Italiano](README.it.md)

<!-- screenshot: hero -->

## ✨ 主な特徴

- **詳細な視聴履歴** — 各エピソードをいつ視聴したか（再視聴も含めて）正確に記録され、新しいエピソードを見るたびに同期されます
- **15 以上の言語に対応したメタデータ** — TMDB 経由でタイトル / あらすじ / タグライン / ジャンルを翻訳。中国語（簡体/繁体/香港）、日本語、韓国語、フランス語、ドイツ語、スペイン語（スペイン/メキシコ）、ポルトガル語（ブラジル）、イタリア語、ロシア語のプリセットに加え、TMDB がサポートする任意の BCP-47 ロケールコードを指定できるカスタムモードも搭載。英語の原文は `*_original_*` フロントマター項目に常に保持されます
- **増分同期** _(0.2.0)_ — 初回同期でローカルの TMDB キャッシュと Trakt 履歴状態を構築し、以降は変更分のみを取得。定常状態の同期時間は数分から数秒に短縮。詳細は [spec 0001](../specs/0001-incremental-sync.md) を参照
- **静かな書き込み** _(0.3.0)_ — 同期は**実際に内容が変わった**ノートだけを書き換えます。1 つの新しいエピソードを観た後、1200 件のライブラリでは 1200 件すべてではなく 1 件だけが書き換えられ、Obsidian Sync / iCloud / Syncthing などのデバイス間同期層がライブラリ全体を再アップロードするのを防ぎます。詳細は [spec 0002](../specs/0002-diff-based-write.md) を参照

## 🎬 詳細な視聴履歴

**視聴履歴を同期（詳細）** を有効にすると、Trakt の `/sync/history` エンドポイントから取得したエピソード単位（または映画ごと）のタイムスタンプを、ノート本文に直接埋め込みます。新しいエピソードを視聴するたびに自動更新されます：

```markdown
## Watch History
- S1E1 — 2024-01-15 21:30, 2024-03-22 19:00
- S1E2 — 2024-01-16 22:00
- S1E3 — 2024-01-17 21:45
- S2E1 — 2024-04-02 20:00
```

再視聴はカンマ区切りで列挙され、シーズン → エピソード番号順にソートされます。このブロックは `%% trakt:watch-history %%` マーカーで囲まれており、プラグインはマーカー内のみを更新します。**ノート本文の他の場所に書いた手書きの内容は一切触れません**。

<!-- screenshot: watch-history -->

## 🌐 メタデータのローカライズ

**メタデータ言語** を希望の言語に設定すると、同期されたノートのタイトル / あらすじ / タグライン / ジャンルが TMDB 経由で翻訳されます（TMDB キーが未設定の場合は Trakt の翻訳エンドポイントにフォールバック）。英語の原文は `trakt_original_*` フロントマター項目に保持されます：

```yaml
trakt_title: ダークナイト
trakt_original_title: The Dark Knight
trakt_genres:
  - アクション
  - クライム
  - ドラマ
trakt_original_genres:
  - Action
  - Crime
  - Drama
trakt_metadata_language: ja-JP
```

タグと tag-note のパスは**常に英語のまま**なので、既存の Dataview クエリは言語を切り替えても引き続き動作します。

<!-- screenshot: metadata-localization -->

## 🌍 プラグイン UI とノートテンプレート

上記のメタデータローカライズは多数の言語をカバーしていますが、**プラグイン自体の UI** はそれとは別の、規模の小さい軸です。**設定タブ、コマンドパレット、通知ポップアップ**は現在 **English** と **简体中文** に対応しています。**バンドルされたノートテンプレート**は英語、簡体字中国語 (`zh-CN`)、繁体字中国語 (`zh-TW` / `zh-HK`) で提供。それ以外のテンプレート言語コードは英語テンプレートにフォールバックします — 当面は手動でカスタマイズするか、[issue を立てて](https://github.com/o1xhack/obsidian-sync-trakt/issues) 同梱翻訳の追加をリクエストしてください。UI 言語は要望に応じて追加していきます。

<!-- screenshot: bilingual-ui -->

## 🔄 デバイス間同期

認証情報（Trakt トークン、TMDB キー、すべての設定）は vault の `.obsidian/plugins/obsidian-sync-trakt/data.json` に保存され、vault の同期レイヤーに従います。Mac で一度設定すれば、Obsidian Sync（`Plugin data` を有効化）、Syncthing、iCloud + Advanced Data Protection、または Cryptomator 経由で iPhone と共有できます。**プラグインはサーバーにデータを保存しません**。

## 📊 Obsidian Bases でライブラリを表示

`trakt_poster_url` フロントマター項目は [Obsidian Bases](https://help.obsidian.md/bases)（Obsidian 1.9.3+）で**そのまま使えます** —— 同期フォルダ上にデータベースビューを作成すれば、ポスターがサムネイルとして表示されます：

- **カードビュー**：Display 設定を開く → **Image property** を `trakt_poster_url` に設定
- **テーブルビュー**（1.9.4+）：`image(note.trakt_poster_url)` の formula カラムを追加

`trakt_type = "movie"` / `"show"` でフィルタ、`trakt_year` / `trakt_rating` / `trakt_my_rating` でソート、`trakt_genres` でグループ化、すべて可能です。Dataview クエリで使用するフロントマター項目はそのまま Bases ビューでも使えます —— 追加設定は不要。

## 🚀 クイックスタート

1. [BRAT](https://github.com/TfTHacker/obsidian42-brat) でインストール → **Add a beta plugin for testing** → `o1xhack/obsidian-sync-trakt`
2. 設定 → **Obsidian Sync Trakt** → Trakt + TMDB API キーを入力（[セットアップガイド](SETUP.ja.md)）
3. コマンドパレット → **Traktr: Sync**

## 📦 インストール

<details>
<summary><b>BRAT（推奨）</b></summary>

[BRAT](https://github.com/TfTHacker/obsidian42-brat) は任意の GitHub リポジトリからプラグインをインストールし、自動更新を行います。

1. コミュニティプラグインから **Obsidian42 - BRAT** をインストールして有効化
2. 設定 → BRAT → **Add a beta plugin for testing**
3. 以下を貼り付け：
   ```
   o1xhack/obsidian-sync-trakt
   ```
4. **Add Plugin** をクリック → 設定 → コミュニティプラグインで有効化

その後 Obsidian を起動するたびに BRAT が更新を確認し、新しい release を自動取得します。

</details>

<details>
<summary><b>手動インストール</b></summary>

1. [最新の release](https://github.com/o1xhack/obsidian-sync-trakt/releases/latest) から `main.js`、`manifest.json`、`styles.css` をダウンロード
2. 3 つのファイルを `<your-vault>/.obsidian/plugins/obsidian-sync-trakt/` に配置
3. 設定 → コミュニティプラグイン → **Obsidian Sync Trakt** を有効化

</details>

<details>
<summary><b>Obsidian コミュニティプラグイン（提出予定）</b></summary>

> ⚠️ Obsidian の公式コミュニティプラグインディレクトリにはまだ登録されていません。承認され次第、これが推奨パスになります。それまでは上記の BRAT を使用してください。

</details>

<details>
<summary><b>ソースからビルド</b></summary>

```bash
git clone https://github.com/o1xhack/obsidian-sync-trakt.git
cd obsidian-sync-trakt
npm install
npm run build      # main.js を生成
npm run lint
npm run test:i18n  # スモークテスト
```

その後 `main.js`、`manifest.json`、`styles.css` を `<vault>/.obsidian/plugins/obsidian-sync-trakt/` にコピーします。

</details>

## 📚 ドキュメント

| ドキュメント | 内容 |
|---|---|
| [SETUP](SETUP.ja.md) | Trakt + TMDB API キーの作成、初回設定、トラブルシューティング |
| [MANUAL](MANUAL.ja.md) | 設定の完全リファレンス、フロントマター項目、テンプレート変数、同期動作 |
| [DEVELOPER](../DEVELOPER.md) | アーキテクチャ概要、データフロー、拡張方法（英語のみ） |
| [docs/i18n/](.) | README / SETUP / MANUAL の 8 言語翻訳 |

## 🗺️ ロードマップ

- [x] エピソード単位の詳細な視聴履歴同期
- [x] 15 以上のプリセット言語に対応したメタデータローカライズ + 任意の TMDB 対応ロケールコードを使えるカスタムモード
- [x] バイリンガル プラグイン UI（en + zh-CN）；他の言語は要望に応じて
- [x] 翻訳済みデフォルトノートテンプレート（en + zh-CN + zh-TW）
- [x] TMDB メタデータキャッシュ（0.2.0）— 言語切り替え時の API 再リクエストをスキップ、定常状態の同期は数秒
- [x] Trakt 履歴の増分取得（0.2.0）— 前回同期以降の新しい視聴イベントだけを取得
- [x] Diff ベースの書き込み（0.3.0）— 実際に変わったノートだけを書き換え、デバイス間同期のストームを防ぐ
- [ ] Obsidian コミュニティプラグインディレクトリへの提出
- [ ] さらなる UI 翻訳（ja / ko / fr / ...）需要に応じて

## 🤝 謝辞

このプラグインは当初、[sarimabbas/traktr](https://github.com/sarimabbas/traktr)（MIT ライセンス）から着想を得て、Trakt OAuth 接続の初期足場を引き継ぎました。その後の大幅な作業 — 詳細な視聴履歴の集約、翻訳フォールバックチェーン付きメタデータローカライズ、バイリンガル UI、ライブ進捗レポート付き並列度制限フェッチ、機械管理ボディセクション、翻訳対応テンプレートレンダラー、多言語ドキュメント体系 — により、コードベースの大部分が根本的に異なるアーキテクチャに作り直されました。

最初の出発点を提供してくれた [Sarim Abbas](https://github.com/sarimabbas) に感謝します。原作品の MIT 著作権表示は本プロジェクト独自の表示と並んで [LICENSE](../../LICENSE) に逐語的に保持されています。

## 📄 ライセンス

MIT — [LICENSE](../../LICENSE) を参照。

---

作者：[o1xhack](https://github.com/o1xhack)
