# 家族の車カレンダーの公開計画

調査日：2026-10-13（日本時間）。この文書は公開の構成・作業手順です。
同日、利用者からVercel Hobbyと既存Supabase Freeを使う公開、およびGitHubへのコード反映の承認を受けています。
接続先と無料プランを確認してから公開します。有料プランへの変更、Proの無料体験、課金には別途利用者の承認が必要です。

## 推奨構成

**Vercel Hobby + 既存のSupabase Free** を第一候補にします。
家族4人の通常利用は無料枠で収まる見込みです。実際の料金は契約プランと使用量によるため、公開前に両方のDashboardでFree/Hobbyを確認します。
非商用・家族用の利用で始め、独自ドメインは購入せず、Vercelが割り当てるHTTPSの `*.vercel.app` URLを使います。

```text
家族のスマートフォン
        ↓ HTTPS
Vercel Hobby：Next.js の画面・認証確認・予定の操作
        ↓ Supabase API（Authセッション＋RLS）
既存Supabase：Authユーザー／家族情報／PostgreSQLの予定
```

公開後はWSLやWindowsのPCを起動しておく必要がありません。
データは現在もSupabaseに保存されているため、Vercelの再起動や再デプロイで予定は消えません。

## 今回の公開方法

2026-10-13、Vercelの `dembele17` チームがHobbyであることをAPIで確認し、既存SupabaseがFreeであることを利用者がDashboardで確認しました。
アプリのコードはGitHubの `dembele17/ndanda` の `main` に反映しています。

初回は **Vercel CLIから `frontend` を直接送信**します。Vercel側のプロジェクト名は `ndanda`、Node.jsは24.xです。
この方式では送信する `frontend` 自体がソースのルートなので、VercelのRoot Directoryは未指定（プロジェクトルート）にします。
後述するGitHub取り込み方式の `frontend` 指定とは異なります。CLI公開のままRoot Directoryを `frontend` に変更しないでください。

GitHubの自動デプロイは未設定です。**GitHubにpushするだけでは公開アプリは更新されません。**
更新後はWSLで以下を実行します。既存のCLIログイン・ `.vercel/project.json` を使用します。

```bash
cd /home/dembele/ndanda/frontend
npm run lint
npm run build
npm_config_cache="$PWD/.npm-cache" npm exec --yes --package=vercel@63.1.2 -- vercel deploy --prod --scope dembele17 --global-config "$PWD/.npm-cache/deployment-tools/vercel-config"
```

別のPCではCLIログインと `vercel link` が必要です。認証情報を他のPCへコピーしたりGitに登録したりしないでください。
`.npm-cache`、`.vercel`、環境ファイル、個人用SQLはGitとCLI送信の対象から除外しています。
本番にはSupabase公開環境変数2つを設定し、Previewには本番DBの値を設定していません。
PreviewのみVercel認証で保護し、本番はアプリのSupabase Auth・RLSで家族に限定します。

将来GitHubから自動更新したい場合は、VercelのAccount Settings > AuthenticationでGitHubのログイン接続を追加し、プロジェクトに `dembele17/ndanda` を接続します。
その際はGitHubリポジトリ全体を取り込むため、Root Directoryを **frontend** に変更してください。
GitHub連携の追加自体に有料プランは不要です。プラン変更・Pro体験は選びません。

## 調査したアプリ構成

| 場所 | 役割 |
| --- | --- |
| `app/` | メイン画面、ログイン、Server Actionsによる追加・編集・削除・設定変更 |
| `components/` | 月カレンダー、日別タイムライン、フォーム、詳細、家族設定 |
| `lib/supabase/` | Supabaseの接続設定、Cookieを使うサーバー用クライアント |
| `lib/data.ts` | ログインと家族所属を確認し、予定を取得 |
| `proxy.ts` | Supabaseの認証セッションを更新 |
| `supabase/migrations/` | テーブル、外部キー、RLS、重複警告後に保存するRPC |
| `tests/` | ロジック・RLS・ブラウザ操作の検証。公開アプリのデータ保存には使わない |

使用技術はNext.js 16.3.8 / App Router / React 19.2.8 / TypeScript / Tailwind CSS 4 / Supabase Auth / PostgreSQLです。
予定は `schedules`、家族プロフィールは `profiles`、共有範囲は `families` に保存します。
ローカルストレージやSQLiteによる本番データ保存は行いません。
既存の `backend/` とDocker内のPostgreSQLは、このカレンダーの実行には不要です。

Cookie、Proxy、Server Actionsを使っているため、現状は静的HTMLの出力だけでは公開できません。
Cloudflare PagesやFirebase Hostingの静的配信だけに載せる場合はアプリの構成変更が必要です。

## 公開先の比較

| 候補 | 無料運用 | 現在のアプリとの適合性・注意点 |
| --- | --- | --- |
| Vercel Hobby + Supabase Free | 無料枠内で月額0円 | 推奨。Next.jsをそのまま実行しやすい。個人・非商用利用向け |
| Cloudflare Workers Free + Supabase Free | 無料枠内で可能 | vinextやOpenNextなどの追加構成と互換性確認が必要。現状のPages静的配信への直接配置は不適合 |
| Render Free Web Service + Supabase Free | 無料枠内で可能 | Node.jsで動かせるが、15分無通信で休止。次回アクセス時の起動に約1分かかる場合がある |
| Firebase App Hosting + Supabase | 無料枠はある | Blaze従量課金プランが必要。請求先の登録が必要になる構成なので今回の第一候補にしない |
| Supabase単独 | DB・Authは無料枠あり | このNext.jsサーバーを動かす公開先は別途必要 |

Cloudflareの現行ガイドはWorkers向けにvinextを推奨し、OpenNextと静的Pagesも別経路として説明しています。
今回は既存のNext.jsアプリの変更を最小限にするVercelを優先します。
FirebaseのDB/Authへ移行する必要はありません。

## 無料枠と制限

公式情報の確認日：2026-10-13。無料プランの条件は将来変更される可能性があります。

### Vercel Hobby

- 個人・非商用利用向け。家族内の私的な車利用予定の共有はこの用途に合うと判断します。
- 月間の主な枠：データ転送100GB、Function呼び出し100万回、Active CPU 4時間。
- 上限到達時は多くの場合その機能が利用できなくなり、リセットまで待つ必要があります。
- Proの無料体験、従量課金の有料サービス、有料ドメイン・アドオンは選択しません。
- アプリを使う家族4人がVercelの有料開発者席を購入する必要はありません。家族はアプリのSupabaseアカウントでログインします。

### Supabase Free

- DB 500MB、月間アクティブユーザー50,000、通常の転送量5GB。
- 低利用状態が約7日続くとプロジェクトが一時停止されることがあります。停止時はDashboardから復元が必要です。
- Freeでは自動バックアップが含まれません。重要なデータは手動エクスポートで保管します。
- 現在の契約プランやDB使用量は公開キーからは確認できません。公開前にDashboardでFreeと使用量を確認します。

4人が毎日数回開いて予定を確認・登録する使い方なら十分な余裕があると見込みます。
アプリは表示中に60秒ごとに予定を読み直すため、画面を開きっぱなしにする時間が長いほど通信とサーバー処理が増えます。
無料運用は人数だけで保証できません。使用量を確認し、上限が近づけばまず更新頻度や取得量を調整する方針です。
有料プランへの変更は、必ずユーザーの確認を受けてから判断します。

## 公開用環境変数

Vercelのプロジェクト設定で、**Production** のビルド時・実行時に以下の2つを設定します。
値は現在の `.env.local` と同じものを使います。公開キーの値をこの文書に転載しません。

| 変数 | 設定する値 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 既存SupabaseプロジェクトのURL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 既存プロジェクトのPublishable key |

従来のanon keyを使う場合だけ、公開キーの代わりに `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定します。
`service_role` / secretキー、DBパスワード、管理用アクセストークンは公開アプリの環境変数に不要です。
`CALENDAR_E2E` やテスト専用のURL・キーを本番に設定しないでください。
環境変数を変更した場合は、新しい設定で再デプロイします。

初回はPreview/Developmentに本番Supabaseの値を設定せず、本番データと接続しない方針にします。
Previewで操作確認する必要が生じた場合は、専用テスト環境の無料枠・契約条件を確認して別途検討します。

## 安全性の確認

- 未ログインはメイン画面を表示できず、Server Actionsでも本人・家族の所属を確認しています。
- DBにもRLSがあり、同一家族の予定だけ閲覧できます。
- 予定の編集・削除は、登録時のAuthユーザー本人に限ります。
- 公開URLを知っていても、家族に登録されていない人はカレンダーを利用できません。
- Publishable keyは公開される前提のキーです。データ保護はAuth・テーブル権限・RLSで行います。
- 新規サインアップは禁止を維持します。公開調査時点でも禁止設定を確認済みです。
- `.env.local` と `supabase/*.local.sql` はGit除外され、Git管理されていないことを確認済みです。
- CLIからのアップロードでも個人SQL・環境ファイル・ブラウザデータを除外するため、`.vercelignore` を用意しています。
- この調査時の `npm audit --omit=dev` は既知の脆弱性0件でした。開発用ESLint関連の監査指摘についてはREADMEを参照してください。
- 公開後はHTTPSの本番URLで、Cookie・ログイン・権限を実機確認します。

## デプロイ手順（GitHub連携を推奨）

GitHubの `dembele17/ndanda` がoriginに設定されています。
変更内容と検証結果を確認してコミット・pushし、そのコミットをVercelへ反映します。
個人登録SQLや環境ファイルをコミットしません。ユーザーの既存の未追跡ファイルをまとめて `git add .` で取り込むこともしません。

1. VercelをHobbyで利用できるアカウント・接続を確認します。Pro、無料Pro体験、有料アドオンは選びません。
2. SupabaseがFreeプランであることをDashboardで確認します。
3. 公開対象のアプリコードをレビューし、GitHubに反映します。
4. VercelのAdd New ProjectでGitHubの `ndanda` を取り込みます。
5. Framework Presetを **Next.js**、Root Directoryを **frontend** にします。
6. Node.js Versionを **24.x** にします。Install Commandは `npm ci`、Build Commandは `npm run build`、Output DirectoryはNext.jsの既定に任せます。
7. Production用の2つの環境変数を登録します。
8. デプロイして、実際に割り当てられた本番の `https://...vercel.app` URLを確認します。具体的なURLは割り当て後に確定します。
9. SupabaseのAuthentication > URL Configurationで、Site URLをその本番URLに変更します。Redirect URLsは必要な本番のログイン先と、ローカル開発が必要なら `http://localhost:3001/login` を正確なURLで登録します。過剰なワイルドカードは使いません。
10. Authenticationの新規サインアップ禁止を維持し、現在のSupabaseテーブル・RLS・家族登録を再利用します。初期作成SQLを再実行しません。
11. 家族にはProductionのURLを共有します。Vercelの本番保護設定は、家族がVercelへのログインを要求されず、アプリのログイン画面まで到達できる状態を確認します。アプリ内のAuth・RLSは維持します。

メール・パスワードによる現在のログインは、OAuthコールバックの追加実装なしで利用できます。
メール確認・パスワード再設定の仕組みを将来追加する際は、対応するアプリ側ページと許可URLを合わせて設計します。

GitHub連携を使わない場合は、承認後にVercel CLIでこの `frontend` を公開する選択肢もあります。
どちらの方式でも、承認前に公開や外部へのコード送信は行いません。

## 公開後の確認

- 未ログインでURLを開くとログイン画面になる。
- 家族アカウントでログインし、現在の予定を閲覧できる。
- 予定の追加・更新・削除、画面更新後の保存、重複警告後の登録が動く。
- 家族を追加した後は、同じ `family_id` に所属させ、他の家族が登録した予定を勝手に変更できないことも確認する。
- ログアウト後にカレンダーへアクセスできない。
- スマートフォンとPCで表示し、WSLの起動状況に関係なく使える。
- Vercel/Supabaseの使用量を確認し、無料枠に収まっている。

家族アカウントは、SupabaseのAuthenticationで各自を作成し、既存の家族IDを指定してprofilesに追加します。
追加の家族ごとに新しいfamiliesを作成しないでください。登録の例はREADMEにあります。

## 公式情報

- [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Vercel Hobbyの無料枠・用途](https://vercel.com/docs/plans/hobby)
- [Vercelの無料URL](https://vercel.com/docs/deployments/generated-urls)
- [Node.jsの対応バージョン](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [.vercelignore](https://vercel.com/docs/deployments/vercel-ignore)
- [Supabase料金・無料枠・バックアップ](https://supabase.com/pricing)
- [Supabaseの一時停止](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Supabaseの認証URL設定](https://supabase.com/docs/guides/auth/redirect-urls)
- [CloudflareのNext.js公開](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Cloudflare Workersの料金](https://developers.cloudflare.com/workers/platform/pricing/)
- [Render Free](https://render.com/docs/free)
- [Firebase App Hostingの料金条件](https://firebase.google.com/docs/app-hosting/costs)
