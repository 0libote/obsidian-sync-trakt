# セットアップガイド

> 🌐 [English](../SETUP.md) · [简体中文](SETUP.zh-CN.md) · [繁體中文](SETUP.zh-TW.md) · **日本語**

Obsidian Sync Trakt をあなたのアカウントに接続するまでの完全なフロー：Trakt OAuth アプリケーションの作成、TMDB API キーの取得、プラグインの設定、最初の同期。

## 1. Trakt — OAuth アプリケーションを作成

プラグインがあなたの Trakt アカウントに対して認証できるようにするために必須。

1. [trakt.tv](https://trakt.tv) にサインイン（無料アカウントで OK）
2. <https://trakt.tv/oauth/applications> を開く → **New Application**
3. フォームに記入：
   - **Name** — 任意、例：`Obsidian Sync Trakt`
   - **Redirect URI** — **必ず正確に** `urn:ietf:wg:oauth:2.0:oob` ⚠️ — これはデバイス認証フローの固定文字列。1 文字でも違うと Connect が 401 で失敗します
   - **Description / Website / Permissions** — 任意 / デフォルトのまま
4. 保存。アプリページに **Client ID** と **Client Secret** が表示されます（Secret 横の目アイコンをクリックで表示）

両方の値はあとで <https://trakt.tv/oauth/applications> でアプリをクリックすればいつでも確認できます。

## 2. TMDB — v3 API キーを取得

**ポスター画像に必須**、**メタデータローカライズに強く推奨**。TMDB キーがなくてもプラグインは Trakt の翻訳エンドポイント経由でローカライズできますが、カバー範囲が狭くなります（ジャンル翻訳なし）。

1. <https://www.themoviedb.org/signup> でサインアップ（無料）
2. **メールを認証** — 認証しないと API キー申請ができません。受信箱 / 迷惑メールフォルダを確認
3. <https://www.themoviedb.org/settings/api> を開く → **Create** → **Developer** を選択
4. 規約に同意してフォームに記入：
   - **Application Name** — 例：`Obsidian personal`
   - **Application URL** — 任意の有効な URL、例：`https://github.com/your-username` や `https://obsidian.md`。**空白不可**
   - **Application Summary** — 一行、例：*"Personal use: enrich Obsidian notes with TMDB metadata and posters"*
   - 連絡先 — 実在のメールアドレス
5. 送信。ページに 2 つの値が表示されます：
   - **API Key (v3 auth)** — 16 進数 32 文字。**これがプラグインに必要なもの**
   - **API Read Access Token (v4 auth)** — JWT。本プラグインでは使用しないため無視

v3 キーは <https://www.themoviedb.org/settings/api> でいつでも確認できます。

## 3. プラグインを設定

プラグインをインストールしたら（[README → Install](README.ja.md#-インストール) 参照）、**設定 → Obsidian Sync Trakt** を開きます。

### Authentication

1. 手順 1 で取得した **Trakt client ID** と **Trakt client secret** を貼り付け
2. **Connect** をクリック — ポップアップに `trakt.tv/activate` の URL と 8 文字のユーザーコードが表示されます
3. 任意のブラウザで URL を開き、Trakt にログイン、コードを貼り付けて **Continue** をクリック
4. ポップアップは自動で閉じ、**Connection status** が **Traktr connected** に変わります

### TMDB

5. 手順 2 で取得した **API key (v3 auth)** を貼り付け
6. **Poster size** を選択 — `w500` がよいデフォルト値

### Localization（任意）

7. **Metadata language** — プリセットを選ぶ（例：`Japanese` で `ja-JP`）か、**Custom** で任意の BCP 47 コードを入力。`Default` のままならすべて英語
8. **Plugin UI language** — `English` または `简体中文`。設定タブ、コマンドパレット、通知ポップアップに影響
9. **Note template language** — バンドルされたデフォルトテンプレートの言語を選択。現在のテンプレートが未編集の場合、この設定を切り替えると自動で書き換えられます

### Sync sources — 同期するソースを選択

10. **Sync watchlist** — 観たいアイテム（デフォルト ON）
11. **Sync favorites** — お気に入りに登録したアイテム（デフォルト ON）
12. **Sync watch history** — 視聴済みアイテム、再生回数と最終視聴時刻付き（デフォルト OFF；データ量が大きい可能性あり）
13. **Sync watch history (detailed)** — `{{watch_history}}` 経由でノート本文にエピソード単位（または映画単位）の視聴タイムスタンプを追加。**Sync watch history が ON のときのみ表示**。（デフォルト OFF；大規模ライブラリでは大幅に遅くなります — Trakt の `/sync/history` エンドポイントは 1 ページ 100 視聴イベント）
14. **Sync ratings** — 1-10 で評価したアイテム（デフォルト OFF）

### 最初の同期を実行

15. コマンドパレット（Ctrl/Cmd+P）→ **Traktr: Sync**

最初のテストには **Sync watchlist のみ** をオンにすることをおすすめします — ほとんどのユーザーは watchlist が 100 件未満なので、すぐに終わります。

## トラブルシューティング

### Connect が 401 で失敗

ほぼ確実に Trakt OAuth アプリの Redirect URI が間違っています。**必ず正確に** `urn:ietf:wg:oauth:2.0:oob` でなければなりません。<https://trakt.tv/oauth/applications> でアプリをクリック、フィールドを修正、保存、再度 Connect を試してください。

### TMDB が API キー申請を拒否

よくある原因：

- メールが認証されていない — 受信箱 / 迷惑メールフォルダを確認
- Application URL が空白 — 個人用アプリでも TMDB は URL を要求します
- 拒否メールに通常は具体的な理由が記載されています — 確認してください

### 同期に時間がかかる

数千アイテムのアカウントの場合、初回同期に数分かかることがあります。以降の同期もすべてのデータを再取得します（API 側で増分取得はありません）。作業時間は API リクエストが支配的で、ファイル IO ではありません。

**Sync watch history (detailed)** がオンの場合はさらに遅くなります — Trakt の history エンドポイントは個々の視聴イベントを 1 件ずつ返し、1 ページ 100 件のページネーションです。

### 上流の `sarimabbas/traktr` プラグインとの共存

プラグイン ID が異なる（`obsidian-sync-trakt` vs `traktr`）ため、別々のフォルダにインストールされ OS レベルでは衝突しません。**しかし**両方とも `Notes folder`（`trakt`）と `Property prefix`（`trakt_`）のデフォルトが同じなので、両方稼働すると同じノートを取り合います。両方を安全に動かすには、いずれかの `Notes folder` を別の値に変更してください。

### あとからトークンを確認する場所

| トークン | URL |
|---|---|
| Trakt client ID + secret | <https://trakt.tv/oauth/applications> → アプリをクリック |
| TMDB API key (v3 auth) | <https://www.themoviedb.org/settings/api> |

Trakt のアクセストークンは自動更新されるので、何もする必要はありません。TMDB API キーは期限切れになりません。
