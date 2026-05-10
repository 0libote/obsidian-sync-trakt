# Obsidian Sync Trakt

[![Latest release](https://img.shields.io/github/v/release/o1xhack/obsidian-sync-trakt?include_prereleases&label=release&color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![Total downloads](https://img.shields.io/github/downloads/o1xhack/obsidian-sync-trakt/total?color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![License](https://img.shields.io/github/license/o1xhack/obsidian-sync-trakt?color=7c3aed)](../../LICENSE)
[![Min Obsidian version](https://img.shields.io/badge/obsidian-1.4.0%2B-7c3aed)](https://obsidian.md)

**[Trakt.tv](https://trakt.tv) の視聴履歴を、母国語のメタデータとエピソード単位のタイムスタンプ付きで、リッチにローカライズされた Markdown ライブラリに変換します。**

> 🌐 [English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · **日本語** · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Italiano](README.it.md)

<!-- screenshot: hero -->

## ✨ 主な特徴

- **詳細な視聴履歴** — 各エピソードをいつ視聴したか（再視聴も含めて）正確に記録され、新しいエピソードを見るたびに同期されます
- **メタデータのローカライズ** — TMDB 経由でタイトル / あらすじ / タグライン / ジャンルを翻訳。英語の原文は `*_original_*` フロントマター項目に常に保持されます
- **バイリンガル UI** — 設定タブ、コマンド、通知を English または 简体中文 で表示。デフォルトのノートテンプレートは en / zh-CN / zh-TW に対応

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

## 🌍 バイリンガル UI と翻訳済みテンプレート

設定タブ、コマンドパレット、通知ポップアップは **English** と **简体中文** に対応しています。バンドルされたノートテンプレートは英語、簡体字中国語 (`zh-CN`)、繁体字中国語 (`zh-TW` / `zh-HK`) で提供。それ以外の言語コードは英語テンプレートにフォールバックします — 別の言語が必要な場合は手動でカスタマイズしてください。

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
- [x] メタデータのローカライズ（TMDB + Trakt 翻訳フォールバック）
- [x] バイリンガル プラグイン UI（en + zh-CN）
- [x] 翻訳済みデフォルトノートテンプレート（en + zh-CN + zh-TW）
- [ ] TMDB メタデータキャッシュ — 言語切り替え時の API 再リクエストをスキップ
- [ ] Obsidian コミュニティプラグインディレクトリへの提出
- [ ] さらなる UI 翻訳（ja / ko / fr / ...）需要に応じて

## 🤝 謝辞

このプラグインは当初、[sarimabbas/traktr](https://github.com/sarimabbas/traktr)（MIT ライセンス）から着想を得て、Trakt OAuth 接続の初期足場を引き継ぎました。その後の大幅な作業 — 詳細な視聴履歴の集約、翻訳フォールバックチェーン付きメタデータローカライズ、バイリンガル UI、ライブ進捗レポート付き並列度制限フェッチ、機械管理ボディセクション、翻訳対応テンプレートレンダラー、多言語ドキュメント体系 — により、コードベースの大部分が根本的に異なるアーキテクチャに作り直されました。

最初の出発点を提供してくれた [Sarim Abbas](https://github.com/sarimabbas) に感謝します。原作品の MIT 著作権表示は本プロジェクト独自の表示と並んで [LICENSE](../../LICENSE) に逐語的に保持されています。

## 📄 ライセンス

MIT — [LICENSE](../../LICENSE) を参照。

---

作者：[o1xhack](https://github.com/o1xhack)
