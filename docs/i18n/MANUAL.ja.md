# Sync Trakt — ユーザーマニュアル

> 🌐 [English](../MANUAL.md) · [简体中文](MANUAL.zh-CN.md) · [繁體中文](MANUAL.zh-TW.md) · **日本語**

## 1. これは何か

このプラグインは [Trakt.tv](https://trakt.tv) からデータを取得し、各映画
または TV 番組ごとに 1 つの Markdown ノートを vault 内に作成します。各
ノートには以下が含まれます：

- **フロントマター** — 構造化されたメタデータ（タイトル、年、ジャンル、評価、視聴ステータス、Trakt/IMDB/TMDB ID、ポスター URL、同期タイムスタンプ）
- **本文** — `{{variable}}` プレースホルダー付きのカスタマイズ可能なテンプレートからレンダリング
- **タグ** — タイプ、ジャンル、同期ソースから自動生成（任意）
- **Tag notes** — トピックファイルへの wikilink、グラフ構築用（任意）
- **視聴履歴** — Trakt の `/sync/history` エンドポイントからエピソード単位（または映画単位）の視聴タイムスタンプを表示するオプションセクション

映画と番組は同じフォルダに保存され、フロントマターの `trakt_type` フィールド（`movie` または `show`）で区別されます。Dataview クエリはどちらでもフィルタリングできます。

このプラグインは [sarimabbas/traktr](https://github.com/sarimabbas/traktr) からのフォークです；謝辞と追加内容については README を参照してください。

---

## 2. インストール

手動インストール：

1. [最新リリース](https://github.com/o1xhack/obsidian-sync-trakt/releases/latest) から `main.js`、`manifest.json`、`styles.css` をダウンロード
2. vault に `.obsidian/plugins/obsidian-sync-trakt/` フォルダを作成
3. 3 つのファイルをそのフォルダにコピー
4. Obsidian を開く → 設定 → コミュニティプラグイン → **Sync Trakt** を有効化

または [BRAT](https://github.com/TfTHacker/obsidian42-brat) 経由で：beta プラグイン `o1xhack/obsidian-sync-trakt` を追加。

---

## 3. 初期設定

### 3a. Trakt アプリケーションを作成

1. [trakt.tv](https://trakt.tv) にサインインし、**Settings → Your API Apps → New Application** へ
2. 任意の名前を付ける（例：「Sync Trakt」）
3. **Redirect URI** に `urn:ietf:wg:oauth:2.0:oob` を入力
4. 保存。**Client ID** と **Client Secret** をコピー

### 3b.（任意）TMDB API キーの取得

ポスター画像は [The Movie Database](https://themoviedb.org) から取得されます。無料 API キーで十分です。スキップした場合、ノートはポスター画像なしで作成されます。

1. themoviedb.org でアカウント作成
2. **Settings → API → Create → Developer**
3. **API Key (v3 auth)** をコピー

完全な申請フローは [SETUP.ja.md](SETUP.ja.md) を参照してください。

---

## 4. 認証フロー

1. **設定 → Traktr** を開く
2. **Trakt Client ID** と **Client Secret** を貼り付け
3. **Connect to Trakt** をクリック — モーダルが URL と短いデバイスコードを表示
4. ブラウザで URL を訪問、コードを入力、アクセスを承認
5. モーダルは Trakt をポーリングし、認証されると自動的に閉じる
6. Connection status フィールドに「Connected to Trakt」と表示される

アクセスを取り消すには、設定タブで **Disconnect** をクリックするか、コマンド **Traktr: Disconnect account** を実行します。

アクセストークンは各同期前に自動更新されます（手動の再認証は不要）。

---

## 5. 設定リファレンス

### Authentication

| 設定 | 説明 |
|---|---|
| Trakt Client ID | Trakt API アプリケーションから。 |
| Trakt Client Secret | 同じアプリケーションページから。 |
| Connection status | 現在の状態を表示；接続または切断ボタン。 |

### TMDB（ポスター画像）

| 設定 | デフォルト | 説明 |
|---|---|---|
| TMDB API key | _(空)_ | 任意。空のままにするとポスター画像をスキップ。 |
| Poster size | `w500` | TMDB から取得される画像幅のバリアント。選択肢：w92、w154、w185、w342、w500、w780、original。 |
| TMDB cache TTL | `90 日` | キャッシュされた TMDB メタデータが再検証されるまでの期間。**Never expire** にすると永続化（手動クリアのみ）。期限切れエントリは即座に古い値を返し、バックグラウンドで非同期更新するため、同期がブロックされることはありません。各エントリには ±5 日のジッターが付くので、1000 以上のエントリが同じ日に一斉に期限切れになりません。詳細は [spec 0001](../specs/0001-incremental-sync.md) §A 参照。 |
| Clear cache | _(ボタン)_ | キャッシュされた全エントリを削除します。次回の同期で TMDB から全件再取得します（大きなライブラリでは数分かかる場合あり）。設定の説明欄に現在のキャッシュエントリ数が表示されます。 |

### Localization

任意。同期されたノートの `title`、`overview`、`tagline`、`genres` を翻訳します。タグと tag-note wikilink は **常に英語のまま** なので、既存の Dataview クエリは引き続き動作します。

| 設定 | デフォルト | 説明 |
|---|---|---|
| Metadata language | `Default (English / Trakt original)` | 翻訳先のロケール。`Default` を選択するとローカライズが無効化され、既存のノートは i18n 以前の動作とバイト単位で同一のままです。プリセットには簡体字 / 繁体字中国語、日本語、韓国語、英語のバリアント、フランス語、ドイツ語、スペイン語（ES/MX）、ブラジルポルトガル語、イタリア語、ロシア語が含まれます；`Custom` を選択して任意の BCP 47 コード（例：`tr-TR`）を入力できます。 |
| Custom language code | `(空)` | 上で `Custom` を選択した場合のみ表示。 |

ローカライズが有効な場合、同期は次の順序で翻訳を解決します：

1. **TMDB**（優先）— アイテムごとに 1 回の結合呼び出しで、ローカライズされた `title` / `overview` / `tagline` / `genres` とポスター URL を返します。TMDB API キーが必要。
2. **Trakt `/translations/{lang}`**（フォールバック）— TMDB API キーが設定されていない場合に使用。`title` / `overview` / `tagline` のみカバーし、`genres` は英語のまま。
3. **英語の原文** — どちらの API も要求された言語の翻訳を持たない場合、フィールドごとにフォールバック。

### Notes

| 設定 | デフォルト | 説明 |
|---|---|---|
| Notes folder | `trakt` | すべてのノートが作成される vault フォルダ。存在しない場合は自動作成。 |
| Filename template | `{{title}} ({{year}})` | ノートファイル名のテンプレート。変数：`{{title}}`、`{{year}}`、`{{imdb_id}}`、`{{trakt_id}}`。 |
| Property prefix | `trakt_` | プラグインが書き込むすべてのフロントマタープロパティのプレフィックス（例：`trakt_title`、`trakt_watched`）。空のままにするとプレフィックスなし。 |

### Note templates

| 設定 | デフォルト | 説明 |
|---|---|---|
| Movie note template | _(下記参照)_ | 映画ノート本文の Markdown テンプレート。`{{variable}}` 構文を使用。 |
| TV show note template | _(下記参照)_ | TV 番組ノート本文の Markdown テンプレート。`{{variable}}` 構文を使用。 |

両方のテンプレートに **Reset to default** ボタンがあります。

**よくあるカスタマイズ：**

- **タイトル（Title）** — 独立した「Title テンプレート」項目はありません。タイトルはノートの**ファイル名**（**Filename template** 設定で制御）であり、本文テンプレートには `{{title}}` 変数として公開されます。各ノートの先頭にタイトルを見出しとして表示したい場合は、**Movie / TV show テンプレートの先頭に `# {{title}}` を追加**してください。
- **タグライン（Tagline）** — バンドルされた映画テンプレートはタグラインを引用ブロック（`> {{tagline}}`）としてレンダリングします。**テンプレートを直接編集すれば書式を変えられます** — 例：インラインラベルにしたい場合は `**Tagline:** *{{tagline}}*` に置き換えるか、行ごと削除。番組は Trakt のデータにタグラインがないため、番組テンプレートはこれを参照しません。
- **その他** — [§ 6.3 テンプレート変数](#テンプレート変数) のすべての変数が使用可能です；セクションを自由に並べ替え / 削除できます。やり直したい場合は **Reset to default** をクリック。

### Tags

| 設定 | デフォルト | 説明 |
|---|---|---|
| Add tags | on | 各同期でフロントマターに Obsidian タグを追加（例：`#trakt/genre/action`）。 |
| Tag prefix | `trakt` | 生成されるタグのプレフィックス（例：`trakt` → `#trakt/movie`、`#trakt/genre/action`）。 |

### Tag notes

Tag notes はノートからリンクするトピックファイルで、接続のグラフを作成します。**タグまたは tag notes のどちらか一方を使用** — 両方使うのは冗長です。

| 設定 | デフォルト | 説明 |
|---|---|---|
| Add tag notes to frontmatter | off | 各同期でフロントマターに wikilink リストプロパティを追加（例：`[[trakt/genre/action]]`）。または、これをオフのままにしてテンプレートで `{{tag_notes}}` を使用し、リンクを本文に配置。 |
| Create tag notes | off | 存在しない空の tag note ファイルを自動作成。 |
| Tag notes folder | `trakt` | tag note ファイル用の vault フォルダ。フロントマターリンク、ファイル作成、`{{tag_notes}}` テンプレート変数に使用。 |

### Sync sources

| 設定 | デフォルト | 説明 |
|---|---|---|
| Sync watchlist | on | Trakt watchlist のアイテム（観たいもの）。 |
| Sync favorites | on | お気に入りに登録したアイテム。 |
| Sync watch history | off | 視聴したアイテム。アイテムごとに再生回数と最終視聴日を追加。データ量が大きい可能性あり。 |
| Sync watch history (detailed) | off | 上のトグルの上に重ねて使用。Trakt の `/sync/history` エンドポイントを呼び出し、`{{watch_history}}` テンプレート変数経由でエピソード単位（または映画単位）の視聴タイムスタンプを表示。**0.2.0 以降は増分同期** — 以降の同期は前回以降の新しいイベントのみ取得し、削除検出のために下記の周期で定期的に全件再取得します。デフォルト OFF；「Sync watch history」が ON のときのみ表示。 |
| History full-refresh interval (days) | `7` | _(「Sync watch history (detailed)」が ON のときのみ表示)_ プラグインが Trakt 視聴履歴全体を再取得する間隔（新規イベントのみではなく）。Trakt 側での削除検出に使用。値が小さいほど削除検出が速いが、たまに重い同期が発生。 |
| Clear history state | _(ボタン)_ | _(詳細同期が ON のときのみ表示)_ ローカルに集約された視聴履歴を破棄。次回の同期で Trakt から再構築。説明欄に現在追跡中の映画 / 番組 / イベント数が表示されます。 |
| Sync ratings | off | 評価したアイテム（1-10）。 |

### Sync behavior

| 設定 | デフォルト | 説明 |
|---|---|---|
| Sync movies | on | 同期に映画を含める。 |
| Sync TV shows | on | 同期に TV 番組を含める。 |
| Sync on startup | off | Obsidian が読み込まれるときに自動同期（5 秒の遅延）。 |
| Auto-sync | off | バックグラウンドで定期同期。 |
| Auto-sync interval | 60 min | 自動同期の頻度（5-360 分）。自動同期が有効な場合のみ表示。 |
| Community rating/votes update policy | Smart | `trakt_rating` と `trakt_votes` をメディアノートへ書き込む頻度を制御する。`Every sync` は従来の動作を維持し、`Smart` は設定した間隔を超えた場合、または評価/投票数の変化がしきい値に達した場合のみ書き込む。 |
| Minimum update interval | 7 days | _（Smart モードのみ表示）_ 変化が小さくても、この日数を超えるとコミュニティ評価/投票数の書き込みを許可する。 |
| Rating change threshold | `0.1` | _（Smart モードのみ表示）_ Trakt コミュニティ評価の絶対変化量がこの値以上のときに書き込む。 |
| Votes change threshold | `5%` | _（Smart モードのみ表示）_ Trakt 投票数の絶対変化率がこの割合以上のときに書き込む。 |
| Overwrite existing note body | off | **OFF** の場合、フロントマターのみ更新され、ノート本文は保持される。**ON** の場合、各同期でテンプレートからノート全体が再生成される — 本文の編集は永久に失われる。 |
| Remove notes for deleted items | off | **ON** の場合、有効な同期ソースのいずれにも存在しなくなったアイテムのノートはゴミ箱に移動される。 |

### Daily Notes

| 設定 | デフォルト | 説明 |
|---|---|---|
| Enable Daily Notes | off | 既存の Daily Note ファイルに、視聴 / watchlist / お気に入り / 評価イベントを書き込めるようにします。存在しない Daily Note ファイルは作成しません。 |
| Daily Notes folder | _(空)_ | Daily Note ファイルがあるフォルダ。空欄の場合は vault ルート。 |
| Daily Notes filename format | `YYYY-MM-DD` | 指定日の Daily Note を探すための Moment.js ファイル名フォーマット。 |
| Start marker / End marker | `%% trakt:daily:start %%` / `%% trakt:daily:end %%` | プラグインはこの 2 つの marker の間だけを管理します。 |
| Auto-update Daily Notes without media-note sync | off | Daily Notes に必要な Trakt/TMDB データを定期的に更新し、既存の Daily Note ファイルだけを更新します。メディアノートの作成、リネーム、削除、再生成は行いません。完全な Auto-sync と同時に有効化でき、2 つのタイマーは同じロックを共有します。デフォルトではデバイスローカル設定です。 |
| Daily Notes auto-sync interval | `60 min` | Daily Notes-only タイマーを実行する頻度。デフォルトではデバイスローカル設定です。 |
| Manual backfill | _(ボタン)_ | 日付範囲ピッカーを開き、既存の過去 Daily Notes に add-only モードで書き込みます。 |
| Today write mode | Default | Default は最新スナップショットで今日の marker 区間を置き換えます。Incremental は新しいイベント行を追記し、marker 内の手書き内容を保持します。 |

### Reset

**Reset to defaults** はすべての設定をデフォルトに戻します。認証情報と TMDB API キーは保持されます。

---

## 6. ノート形式

### フロントマターフィールド

以下のすべてのフィールドには、設定された **Property prefix**（デフォルト `trakt_`）が付きます。

| フィールド | 型 | 説明 |
|---|---|---|
| `trakt_title` | string | 映画または番組のタイトル。 |
| `trakt_year` | number | リリース年。 |
| `trakt_type` | `movie` \| `show` | コンテンツタイプ。 |
| `trakt_id` | number | Trakt 数値 ID。 |
| `trakt_slug` | string | Trakt URL スラッグ。 |
| `trakt_imdb_id` | string | IMDB ID（例：`tt1234567`）。 |
| `trakt_tmdb_id` | number | TMDB 数値 ID。 |
| `trakt_tvdb_id` | number | TVDB ID（番組のみ）。 |
| `trakt_genres` | list | ジャンルリスト。 |
| `trakt_runtime` | number | 実行時間（分）（番組はエピソードあたり）。 |
| `trakt_certification` | string | 年齢認証（例：`PG-13`）。 |
| `trakt_rating` | number | Trakt コミュニティ評価（0-10）。 |
| `trakt_votes` | number | Trakt 投票数。 |
| `trakt_country` | string | 原産国コード。 |
| `trakt_language` | string | 主要言語コード。 |
| `trakt_status` | string | ステータス（例：`released`、`ended`、`returning series`）。 |
| `trakt_overview` | string | あらすじ。 |
| `trakt_released` | string | リリース日（映画のみ、YYYY-MM-DD）。 |
| `trakt_tagline` | string | タグライン（映画のみ）。 |
| `trakt_network` | string | 放送ネットワーク（番組のみ）。 |
| `trakt_aired_episodes` | number | 放映済みエピソード総数（番組のみ）。 |
| `trakt_first_aired` | string | 初回放送日（番組のみ、YYYY-MM-DD）。 |
| `trakt_watchlist` | boolean | watchlist から同期された場合に存在。 |
| `trakt_watchlist_added_at` | string | watchlist に追加された ISO タイムスタンプ。 |
| `trakt_watched` | boolean | 視聴履歴から同期された場合に存在。 |
| `trakt_plays` | number | 視聴 / 再生回数。 |
| `trakt_last_watched_at` | string | 最終視聴の ISO タイムスタンプ。 |
| `trakt_episodes_watched` | number | 視聴済みエピソード総数（番組のみ）。 |
| `trakt_favorite` | boolean | お気に入りから同期された場合に存在。 |
| `trakt_favorited_at` | string | お気に入り登録の ISO タイムスタンプ。 |
| `trakt_my_rating` | number | あなたの個人評価（1-10）。 |
| `trakt_rated_at` | string | 評価の ISO タイムスタンプ。 |
| `trakt_url` | string | Trakt ページ URL。 |
| `trakt_imdb_url` | string | IMDB ページ URL。 |
| `trakt_poster_url` | string | TMDB ポスター画像 URL。 |
| `trakt_synced_at` | string | このノートが**実際に sync によって変更された**最終時刻（ISO タイムスタンプ）。0.3.0 以降、ノート内容に実質的な変化があったときのみ更新され、毎回の sync では更新されません。Bases / Dataview の「最近変更されたノート」ビューのソートキーとして利用できます。 |
| `trakt_community_stats_synced_at` | string | Smart モードが最後に `trakt_rating` / `trakt_votes` を実際に書き込んだ ISO タイムスタンプ。既存ノートでは、コミュニティ統計の次回更新が許可されるまで存在しない場合がある。 |
| `trakt_tag_notes` | list | tag note ファイルへの wikilink（「Add tag notes to frontmatter」が ON の場合）。 |
| `tags` | list | 自動生成された Obsidian タグ（「Add tags」が ON の場合）。 |
| `trakt_original_title` | string | 英語 / 原語タイトル。**Metadata language** が設定されている場合のみ存在。 |
| `trakt_original_overview` | string | 英語 / 原語あらすじ。**Metadata language** が設定されている場合のみ存在。 |
| `trakt_original_tagline` | string | 英語 / 原語タグライン（映画のみ）。**Metadata language** が設定されている場合のみ存在。 |
| `trakt_original_genres` | list | 英語 / 原語ジャンルリスト。**Metadata language** が設定されている場合のみ存在。 |
| `trakt_metadata_language` | string | アクティブな言語コード（例：`ja-JP`）。**Metadata language** が設定されている場合のみ存在。 |

### 自動生成されたタグ

デフォルトのタグプレフィックス `trakt`：

- `#trakt/movie` または `#trakt/show`
- 各ジャンルに対して `#trakt/genre/<genre>`
- watchlist にある場合：`#trakt/watchlist`
- 視聴済み：`#trakt/watched`
- お気に入り：`#trakt/favorite`
- 評価済み：`#trakt/rated`

### テンプレート変数

ノート本文テンプレートは `{{variable}}` 構文を使用します。利用可能な変数：

| 変数 | 説明 |
|---|---|
| `{{title}}` | タイトル |
| `{{year}}` | リリース年 |
| `{{type}}` | `movie` または `show` |
| `{{overview}}` | あらすじ |
| `{{genres}}` | カンマ区切りのジャンルリスト |
| `{{runtime}}` | 実行時間（分） |
| `{{trakt_rating}}` | コミュニティ評価 |
| `{{trakt_votes}}` | 投票数 |
| `{{certification}}` | 年齢認証 |
| `{{country}}` | 国コード |
| `{{language}}` | 言語コード |
| `{{status}}` | リリース / 放送ステータス |
| `{{trakt_id}}` | Trakt 数値 ID |
| `{{trakt_slug}}` | Trakt スラッグ |
| `{{imdb_id}}` | IMDB ID |
| `{{tmdb_id}}` | TMDB ID |
| `{{tvdb_id}}` | TVDB ID |
| `{{trakt_url}}` | Trakt URL |
| `{{imdb_url}}` | IMDB URL |
| `{{poster_url}}` | ポスター画像 URL（TMDB キーがない場合は空；行は出力から省略される） |
| `{{tag_notes}}` | カンマ区切りの tag note への wikilink（tag notes 設定に関わらず常に利用可能） |
| `{{tagline}}` | タグライン（映画） |
| `{{released}}` | リリース日（映画） |
| `{{network}}` | ネットワーク（番組） |
| `{{aired_episodes}}` | 放映済みエピソード数（番組） |
| `{{first_aired}}` | 初回放送日（番組） |
| `{{watchlist}}` | watchlist にある場合 `true` |
| `{{watchlist_added_at}}` | watchlist 追加タイムスタンプ |
| `{{watched}}` | 視聴済みの場合 `true` |
| `{{plays}}` | 再生回数 |
| `{{last_watched_at}}` | 最終視聴日 |
| `{{episodes_watched}}` | 視聴済みエピソード数（番組） |
| `{{favorite}}` | お気に入りの場合 `true` |
| `{{favorited_at}}` | お気に入りタイムスタンプ |
| `{{my_rating}}` | あなたの評価（1-10） |
| `{{rated_at}}` | 評価タイムスタンプ |
| `{{original_title}}` | 英語 / 原語タイトル。ローカライズがオフでも常に利用可能（その場合は `{{title}}` と等しい）。 |
| `{{original_overview}}` | 英語 / 原語あらすじ。常に利用可能。 |
| `{{original_tagline}}` | 英語 / 原語タグライン（映画）。常に利用可能。 |
| `{{original_genres}}` | 英語 / 原語ジャンルリスト、カンマ区切り。常に利用可能。 |
| `{{metadata_language}}` | アクティブな言語コード、ローカライズがオフの場合は `""`。 |
| `{{watch_history}}` | **Sync watch history (detailed)** が ON の場合は完全な **Watch History** セクション（`## 見出し` + 箇条書き）；そうでない場合は空文字列。見出しテキストは **Note template language** 設定に従う（English / 简体中文 / 繁體中文）。 |
| `{{watch_history_list}}` | `{{watch_history}}` と同じ内容だが見出し行なし。カスタムテンプレートで独自の見出しをレンダリングしたい場合に使用。 |

### 視聴履歴のレンダリング

**Sync watch history (detailed)** が有効な場合、視聴済みノートの本文に各視聴イベントをリストする `## Watch History`（または 观看记录 / 觀看紀錄）セクションが追加されます：

番組の場合 — エピソードごとに 1 つの箇条書き、エピソードが再視聴された場合はすべての視聴タイムスタンプがカンマ区切り：

```markdown
## Watch History
- S1E1 — 2024-01-15 21:30, 2024-03-22 19:00
- S1E2 — 2024-01-16 22:00
- S1E3 — 2024-01-17 21:45
- S2E1 — 2024-04-02 20:00
```

映画の場合 — 視聴イベントごとに 1 つの箇条書き：

```markdown
## Watch History
- 2023-12-25 19:00
- 2024-06-10 22:30
- 2025-02-14 20:15
```

タイムスタンプはローカルタイムゾーンでフォーマットされます（Trakt は UTC で保存し、レンダラーは表示前にローカルに変換）。エピソードはシーズン → エピソード番号順にソートされ、エピソード内のタイムスタンプは時系列順にソートされます。

---

## 7. 同期動作

### 作成 vs 更新

- **新しいアイテム**（マッチする `trakt_type` + `trakt_id` を持つ既存ノートなし）：完全なテンプレートを使ってノートが作成される。
- **既存のアイテム**：動作は **Overwrite existing note body** 設定によって異なる：
  - **OFF**（デフォルト）：フロントマターブロックのみ更新；`---` の下のすべての内容はそのまま残るため、個人的なメモは保持される。
  - **ON**：ノート全体（フロントマター + 本文）がテンプレートから再生成される — 本文の編集は失われる。

### 削除

**Remove notes for deleted items** が有効な場合、複合 `type:id` が有効な同期ソースのいずれにも見つからなくなったノートは、各同期の終了時にシステムゴミ箱に移動されます。

### 言語の変更

**Metadata language** を切り替えて再度同期を実行すると：

- フロントマターは新しい言語で書き換えられる；`trakt_original_*` フィールドは英語の値を保持。
- **filename template** に `{{title}}` が含まれる場合、次回の同期ですべてのノートが新しい言語のタイトルにリネームされる。Obsidian のリンク更新機能が wikilink を自動修正しますが、**まず vault をバックアップしてください**。
- 言語切り替え間でファイル名を安定させるには、言語を変更する**前**にテンプレートを `{{original_title}} ({{year}})` に変更。
- タグ（`#trakt/genre/...`）と tag-note wikilink（`[[trakt/genre/...]]`）は常に元の英語ジャンルリストを使用するため、既存の Dataview クエリは変更なく機能し続けます。
- **Default (English / Trakt original)** に戻すとフロントマターは英語に書き換えられる；次の同期では `trakt_original_*` と `trakt_metadata_language` フィールドはもはや書き込まれないため、これらは手動で削除するかノートを再生成するまで既存ノートに残る（**Overwrite existing note body** を有効にして 1 回同期すれば完全に再生成）。

### 同期の実行

- **手動**：コマンド **Traktr: Sync**（コマンドパレットからアクセス可能）
- **起動時**：設定で **Sync on startup** を有効化（Obsidian の読み込み後 5 秒で実行）
- **スケジュール**：**Auto-sync** を有効化して間隔を設定
- **Daily Notes-only スケジュール**：**Daily Notes → Auto-update Daily Notes without media-note sync** を有効化すると、メディアノートを書かずに Daily Notes だけを更新できます
- **視聴履歴の強制全件刷新**：コマンド **Traktr: Force full watch-history refresh** — 周期間隔をスキップして Trakt 履歴全体を即座に再取得。Trakt で誤った scrobble を削除して、すぐにプラグインに反映させたいときに使用
- **TMDB キャッシュをクリア**：コマンド **Traktr: Clear TMDB metadata cache** — キャッシュ済み TMDB エントリを全て削除。次回の同期で TMDB から全メタデータを再取得。Settings → TMDB → **Clear cache** ボタンと同じ効果

### 同期が高速な理由（0.2.0+）

最初の同期でローカルキャッシュが満たされると、以降の同期は本当に変更があったデータの API 呼び出しのみで完了します：

- **TMDB メタデータキャッシュ**は同期間・デバイス間で永続。映画のタイトル / ポスター / あらすじは一度取得されれば、TTL 経過または手動 Clear まで再利用。**典型的な同期では ~1200 回ではなく ~5-10 回の TMDB 呼び出し**
- **Trakt 履歴の増分取得**は `?start_at=<前回同期時刻>` を使用。1 週間分の新規視聴は通常 1 ページに収まる（1 API 呼び出し）。`History full-refresh interval (days)` ごとに周期的全件再取得を実行して削除を検出

完全な設計の根拠は [`specs/0001-incremental-sync.md`](../specs/0001-incremental-sync.md) を参照。

### Dataview クエリ例

タイプでフィルタリング：
```dataview
TABLE trakt_year, trakt_rating, trakt_watched
FROM "trakt"
WHERE trakt_type = "movie"
SORT trakt_rating DESC
```

お気に入りのみ表示：
```dataview
TABLE trakt_year, trakt_my_rating
FROM "trakt"
WHERE trakt_favorite = true
SORT trakt_my_rating DESC
```

watchlist を表示：
```dataview
TABLE trakt_year, trakt_type, trakt_genres
FROM "trakt"
WHERE trakt_watchlist = true
SORT trakt_year DESC
```
