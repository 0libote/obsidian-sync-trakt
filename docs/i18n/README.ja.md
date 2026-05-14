# Sync Trakt

[![Latest release](https://img.shields.io/github/v/release/o1xhack/obsidian-sync-trakt?include_prereleases&label=release&color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![Total downloads](https://img.shields.io/github/downloads/o1xhack/obsidian-sync-trakt/total?color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![License](https://img.shields.io/github/license/o1xhack/obsidian-sync-trakt?color=7c3aed)](../../LICENSE)
[![Min Obsidian version](https://img.shields.io/badge/obsidian-1.8.7%2B-7c3aed)](https://obsidian.md)

**[Trakt.tv](https://trakt.tv) の視聴履歴を、エピソード単位のタイムスタンプ・15 以上の言語に対応したメタデータ・vault をかき乱さない静かなインクリメンタル同期付きで、リッチにローカライズされた Markdown ライブラリに変換します。**

> 🌐 [English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · **日本語** · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Italiano](README.it.md)

<!-- screenshot: hero -->

## ✨ 主な特徴

- **詳細な視聴履歴** — 各エピソードをいつ視聴したか（再視聴も含めて）正確に記録され、新しいエピソードを見るたびに同期されます
- **15 以上の言語に対応したメタデータ** — TMDB 経由でタイトル / あらすじ / タグライン / ジャンルを翻訳。中国語（簡体/繁体/香港）、日本語、韓国語、フランス語、ドイツ語、スペイン語（スペイン/メキシコ）、ポルトガル語（ブラジル）、イタリア語、ロシア語のプリセットに加え、TMDB がサポートする任意の locale を指定できるカスタムモードも搭載。**厳密な主言語 + ユーザー定義のフォールバック**（例: zh-CN のフォールバックを英語に設定）により、主言語の翻訳が無いときに zh-TW で密かに代用されることを防ぎます。英語の原文は `*_original_*` フロントマター項目に常に保持されます
- **ファイル名は言語に追従** — メタデータ言語を切り替えると、既存のノートは次回の同期時に新しいタイトルに合わせて自動的にリネームされます。Obsidian の内部リンクも自動更新。設定にはワンショットの「今すぐリネーム」ボタンもあり、手動でも実行できます
- **11 言語のノートテンプレート** — 内蔵の手作業翻訳テンプレートが en + zh-CN + zh-TW + ja + ko + fr + de + it + es + pt-BR + ru をカバー。テンプレート言語ドロップダウンから選択でき、いつでも切り替え可能（カスタマイズした内容は失われません）
- **タブ式設定 UI** — 一般 / ノート / 同期 / Daily Notes の 4 タブ。最後に表示したタブはデバイスごとに記憶
- **Daily Notes 連携** — 同期ごとに各イベント（視聴・ウォッチリスト追加・お気に入り・評価）を時系列順で Daily Note に自動挿入。テンプレート言語に追従。マーカー区間内の内容はプラグインが管理し、**区間外の内容は決して変更されません**。**インクリメンタルモード**（オプション）を使うと、マーカー区間内に手書きした注釈も同期のたびに保持されます。手動バックフィルは日付範囲ピッカー + クイックプリセット（過去 7 日 / 今月 など）。詳細は [spec 0006](../specs/0006-daily-notes-integration.md) を参照
- **増分同期** — 初回同期でローカルの TMDB キャッシュと Trakt 履歴状態を構築し、以降は変更分のみを取得。定常状態の同期時間は数分から数秒に短縮。詳細は [spec 0001](../specs/0001-incremental-sync.md) を参照
- **静かな書き込み** — 同期は**実際に内容が変わった**ノートだけを書き換えます。1 つの新しいエピソードを観た後、1200 件のライブラリでは 1200 件すべてではなく 1 件だけが書き換えられ、Obsidian Sync / iCloud / Syncthing などのデバイス間同期層がライブラリ全体を再アップロードするのを防ぎます。詳細は [spec 0002](../specs/0002-diff-based-write.md) を参照
- **設定ごとのクラウド切り替え** — 各設定項目について、デバイス間で同期するかローカルにとどめるかを個別に選択可能。例えば「Mac では 30 分ごとに自動同期、iPhone では完全にオフ」のような構成が可能。詳細は [spec 0003](../specs/0003-device-local-settings.md) を参照

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

メタデータのローカライズが一つの軸、プラグイン自体の表面は別々の軸です：

- **設定タブ、コマンドパレット、通知ポップアップ** は現在 **English** と **简体中文** に対応。他の UI 言語は要望次第 — 貢献したい方は [issue を立てて](https://github.com/o1xhack/obsidian-sync-trakt/issues) ください
- **バンドルされたノートテンプレート** 11 言語 — 英語、簡体字中国語 (zh-CN)、繁体字中国語 (zh-TW / zh-HK)、日本語、韓国語、フランス語、ドイツ語、イタリア語、スペイン語、ポルトガル語 (BR)、ロシア語。機械翻訳ではなく手作業で翻訳しており、見出し・リスト項目・記号は各言語の慣習に従っています（日本語は全角コロン、フランス語は空白付きコロンなど）。テンプレート言語ドロップダウンはこの 11 言語のみを表示し、リストにない locale は英語にフォールバックします（似た方言を静かに代用することはありません）

<!-- screenshot: bilingual-ui -->

## 📅 Daily Notes 連携

同期ごとに各イベントを時系列順で Daily Note に自動挿入します。視聴したエピソード、ウォッチリスト追加、お気に入り、評価のすべてをカバー：

```markdown
%% trakt:daily:start %%
10:00 — 視聴 低智商犯罪 (2026) S1E16, S1E17
14:30 — ウォッチリストに追加 黑暗骑士 (2008)
21:30 — 9/10 で評価 重生 (2020)
%% trakt:daily:end %%
```

各イベントタイプは対応する「同期ソース」トグルで制御されます — 例えば「お気に入りを同期」をオフにすると、お気に入りイベントは Daily Notes にも表示されません。動詞（`視聴` / `시청` / `a regardé`…）は**テンプレート言語**設定に追従し、バンドルされた 11 言語すべてに対応します。

**安全性の約束**: マーカー区間内の内容はプラグインが管理し、**区間外の内容は決して変更されません**。過去の日付はデフォルトで追加のみ（既存のマーカーは保持）。今日の内容は同期ごとに上書きされ、新しいイベントが後続の同期で正しく反映されます。**インクリメンタルモード**をオプトインすると、今日の動作も追記のみに変わり、マーカー区間内に手書きした注釈はすべての同期を生き残ります。

**手動バックフィル**は日付範囲ピッカーとクイックプリセット（過去 7 日 / 過去 30 日 / 今月 / 先月）を採用。確定する前に、選んだ範囲に実際に存在する Daily Note の件数がリアルタイムで表示されます。フォルダとファイル名フォーマット（`YYYY-MM-DD` や `YYYY/YYYY.MM.DD` のような Moment.js 構文）は **設定 → Daily Notes** で構成。詳細は [spec 0006](../specs/0006-daily-notes-integration.md) を参照。

## 🔄 デバイス間同期

認証情報（Trakt トークン、TMDB キー、すべての設定）は vault の `.obsidian/plugins/sync-trakt/data.json` に保存され、vault の同期レイヤーに従います。Mac で一度設定すれば、Obsidian Sync（`Plugin data` を有効化）、Syncthing、iCloud + Advanced Data Protection、または Cryptomator 経由で iPhone と共有できます。**プラグインはサーバーにデータを保存しません**。

**任意の個別設定はデバイス間同期から除外可能** — 設定項目の横にある小さなクラウドアイコンで切り替えます（現在は「起動時に同期」、「自動同期」、「自動同期間隔」、「プラグイン UI 言語」の 4 項目に対応）。「Mac では 30 分ごとに自動同期、iPhone ではオフ」のような構成に便利です。

## 📊 Obsidian Bases でライブラリを表示

`trakt_poster_url` フロントマター項目は [Obsidian Bases](https://help.obsidian.md/bases)（Obsidian 1.9.3+）で**そのまま使えます** —— 同期フォルダ上にデータベースビューを作成すれば、ポスターがサムネイルとして表示されます：

- **カードビュー**：Display 設定を開く → **Image property** を `trakt_poster_url` に設定
- **テーブルビュー**（1.9.4+）：`image(note.trakt_poster_url)` の formula カラムを追加

`trakt_type = "movie"` / `"show"` でフィルタ、`trakt_year` / `trakt_rating` / `trakt_my_rating` でソート、`trakt_genres` でグループ化、すべて可能です。Dataview クエリで使用するフロントマター項目はそのまま Bases ビューでも使えます —— 追加設定は不要。

## 🚀 クイックスタート

1. 設定 → コミュニティプラグイン → **ブラウズ** → **Sync Trakt** を検索 → **インストール** → **有効化**
2. 設定 → **Sync Trakt** → Trakt + TMDB API キーを入力（[セットアップガイド](SETUP.ja.md)）
3. コマンドパレット → **Sync Trakt: Sync**

## 🔑 API キーで何ができるか

プラグインは 2 つの API を使います。**Trakt は必須** — これがないと何も同期できません。**TMDB は任意** ですが、ほとんどのユーザーがこのプラグインを使う本来の目的（多言語メタデータ・ポスター）はこちらで解放されます。詳細：

| 機能 | Trakt API<br/>_（必須）_ | TMDB API<br/>_（推奨）_ |
|---|:---:|:---:|
| Trakt ライブラリの同期（watchlist、watched、favorites、ratings） | ✅ | — |
| エピソード単位の視聴タイムスタンプ | ✅ | — |
| title / overview / tagline をあなたの言語に翻訳 | ✅ 基本 | ✅ より高品質 |
| **genres をあなたの言語に翻訳** | ❌ | ✅ |
| **ノートに埋め込まれるポスター画像** | ❌ | ✅ |

英語のままで構わず、ポスターも不要なら TMDB は空欄で構いません — Trakt だけで十分です。非英語の完全なローカライズ（genres とポスターを含む）が欲しい場合は **TMDB キーを入力してください**（[無料登録](https://www.themoviedb.org/settings/api)）。キーを貼り付けたら、入力欄の横にある **Test** ボタンで動作確認してから初回同期を実行してください。

→ [両方のキーの完全な設定手順](SETUP.ja.md)

## 📦 インストール

<details open>
<summary><b>Obsidian コミュニティプラグイン（推奨）</b></summary>

1. 設定 → コミュニティプラグイン → **ブラウズ**
2. **Sync Trakt** を検索
3. **インストール** → **有効化** をクリック

プラグインディレクトリページ：https://community.obsidian.md/plugins/sync-trakt

</details>

<details>
<summary><b>開発（ソースからビルド）</b></summary>

```bash
git clone https://github.com/o1xhack/obsidian-sync-trakt.git
cd obsidian-sync-trakt
npm install
npm run build      # main.js を生成
npm run lint
npm run test:i18n  # スモークテスト
```

その後 `main.js`、`manifest.json`、`styles.css` を `<vault>/.obsidian/plugins/sync-trakt/` にコピーします。

</details>

<details>
<summary><b>ローカルテスト（手動インストール）</b></summary>

1. [最新の release](https://github.com/o1xhack/obsidian-sync-trakt/releases/latest) から `main.js`、`manifest.json`、`styles.css` をダウンロード
2. 3 つのファイルを `<your-vault>/.obsidian/plugins/sync-trakt/` に配置
3. 設定 → コミュニティプラグイン → **Sync Trakt** を有効化

</details>

## 📚 ドキュメント

| ドキュメント | 内容 |
|---|---|
| [SETUP](SETUP.ja.md) | Trakt + TMDB API キーの作成、初回設定、トラブルシューティング |
| [MANUAL](MANUAL.ja.md) | 設定の完全リファレンス、フロントマター項目、テンプレート変数、同期動作 |
| [DEVELOPER](../DEVELOPER.md) | アーキテクチャ概要、データフロー、拡張方法（英語のみ） |
| [docs/i18n/](.) | README / SETUP / MANUAL の 8 言語翻訳 |

## 🗺️ ロードマップ

フォーク以降の主要バージョン（時系列）：

- [x] **0.1** — 初期フォーク。エピソード単位の詳細視聴履歴、TMDB + Trakt フォールバック連鎖によるメタデータローカライズ、バイリンガル UI（en + zh-CN）、翻訳済みノートテンプレート（en + zh-CN + zh-TW）、上流の traktr と共存できる独立した plugin id
- [x] **0.2** — 増分同期。永続的な TMDB キャッシュ（stale-while-revalidate、90 日 TTL + ジッター）+ Trakt 履歴状態カーソル。定常状態の同期が数分から数秒に短縮。→ [spec 0001](../specs/0001-incremental-sync.md)
- [x] **0.3** — Diff ベースの書き込み。フロントマターや管理対象本文セクションが実際に変わったノートだけを書き換え、デバイス間同期層が同期ごとに 1200 件のファイルをばら撒くのを防止。0.3.x ではさらに：TMDB API キーのテストボタン + メタデータ言語が設定されているがキーがない場合の警告バナー、ローカライズされたタイトルの衝突に対応する 2 段階のファイル名 disambiguation（「重生」という同名の 5 つの番組が同じファイル名を奪い合っていた問題）も追加。→ [spec 0002](../specs/0002-diff-based-write.md)
- [x] **0.4** — ディレクトリ提出準備。Plugin id を `obsidian-sync-trakt` → `sync-trakt` にリネーム（Obsidian 公式ディレクトリのボットは `obsidian` を含む id を拒否）、`minAppVersion` を 1.6.6 に引き上げ、初回起動時に旧フォルダから自動でデータ移行。→ [spec 0004](../specs/0004-obsidian-directory-submission.md)
- [x] **0.5** — デバイス本地設定 + 自動クリーンアップ。各設定項目の横のクラウドアイコンでデバイス間同期するかを個別に制御；移行後に旧フォルダのバイナリファイルを自動クリーンアップ（data.json はセーフティネットとして保持）、ユーザーが 2 つの重複したプラグインエントリを見ることがなくなった。→ [spec 0003](../specs/0003-device-local-settings.md)
- [x] **0.6** — タブ式設定 UI + 11 言語のノートテンプレート。設定ページを 4 つのタブ（一般 / ノート / 同期 / Daily Notes）に再構成；ノートテンプレートを 3 言語から 11 言語に拡張（新規追加：ja、ko、fr、de、it、es、pt-BR、ru、すべて手作業翻訳）；テンプレート言語ドロップダウンはバンドル済み言語のみを表示。→ [spec 0005](../specs/0005-settings-ui-tabs.md) + [spec 0007](../specs/0007-template-language-expansion.md)
- [x] **0.7** — Daily Notes 連携。同期ごとにイベント（視聴 / ウォッチリスト追加 / お気に入り / 評価）を時系列順で Daily Note に自動挿入、テンプレート言語に追従。過去の日付は追加のみ、今日の内容は随時更新。→ [spec 0006](../specs/0006-daily-notes-integration.md)
- [x] **0.8** — Daily Notes の**インクリメンタル同期モード**。今日のマーカー区間を「全置換」から「追記のみ」に切り替えるオプトインモード。これにより区間内に手書きした注釈がすべての同期を生き残ります。
- [x] **0.9** — **メタデータ言語のフォールバック**。「メタデータ言語」の下に「フォールバック言語」のドロップダウンを追加。設定すると主言語は厳密マッチに変わり（zh-CN を求めて zh-TW で密かに代用されることがなくなる）、ヒットしなければユーザーが選んだフォールバックを経由し、それでも無ければ英語原文へ。→ [spec 0008](../specs/0008-metadata-language-fallback.md)
- [x] **1.0** — **ファイル名の自動リネーム + 永続的な「更新情報」モーダル + 日付範囲バックフィル**。メタデータ言語を変更すると、既存ノートが次回の同期時に自動リネームされます（Obsidian の内部リンクも自動追従）。新バージョン初回起動時には「更新情報」モーダルが一度だけ表示され、前回からのバージョン履歴を確認できます。手動バックフィルは日付範囲ピッカー（開始 / 終了 + クイックプリセット）に置き換えられました。→ [spec 0009](../specs/0009-filename-rename.md)
- [ ] **今後** — UI 翻訳の追加（現在 en + zh-CN）を要望に応じて；バンドル済みテンプレート言語の追加もリクエスト次第

## 🤝 謝辞

このプラグインは当初、[sarimabbas/traktr](https://github.com/sarimabbas/traktr)（MIT ライセンス）から着想を得て、Trakt OAuth 接続の初期足場を引き継ぎました。その後の大幅な作業 — 詳細な視聴履歴の集約、翻訳フォールバックチェーン付きメタデータローカライズ、バイリンガル UI、ライブ進捗レポート付き並列度制限フェッチ、機械管理ボディセクション、翻訳対応テンプレートレンダラー、多言語ドキュメント体系 — により、コードベースの大部分が根本的に異なるアーキテクチャに作り直されました。

最初の出発点を提供してくれた [Sarim Abbas](https://github.com/sarimabbas) に感謝します。原作品の MIT 著作権表示は本プロジェクト独自の表示と並んで [LICENSE](../../LICENSE) に逐語的に保持されています。

## 📄 ライセンス

MIT — [LICENSE](../../LICENSE) を参照。

---

作者：[o1xhack](https://github.com/o1xhack)
