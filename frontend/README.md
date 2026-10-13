# うちのくるま

家族で1台の車の予定を共有する、スマートフォン優先のカレンダーです。
「使用者・日時・用途」を共有し、予定が重なったら警告を表示します。
「それでも登録する」を選ぶと重複したまま保存できます。優先順位・承認の機能はありません。

公開URL：**[https://ndanda-eight.vercel.app](https://ndanda-eight.vercel.app)**。家族アカウントでログインしてください。

## URLから使えるように公開する場合

公開構成と無料枠の制限、公開用環境変数、更新手順は [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) に整理しています。
2026-10-13にVercel Hobbyと既存Supabase Freeを使う公開の承認を受けています。初回はVercel CLIを使用し、GitHubへのpushだけでは公開アプリは更新されません。
有料プランへの変更・課金には別途確認が必要です。

## 1. WSLでの準備

既存の `ndanda/frontend` の Next.js App Router、TypeScript、Tailwind CSS を使用します。
Node.js 20.9以上とnpmが必要です。この環境のWSL用Node.js 24.18.0で検証しています。
Windows側のnpmを拾う場合は、WSLターミナルで `source /home/dembele/.nvm/nvm.sh`、`nvm use 24.18.0` を実行してから以下を実行してください。システム設定を書き換える操作ではありません。
既存の `backend/`、Docker、他のプロジェクト、3000番で動いているアプリの設定は変更していません。
このアプリから既存のバックエンドやDocker PostgreSQLへの接続は行いません。

```bash
cd /home/dembele/ndanda/frontend
npm ci
cp .env.local.example .env.local
```

既存の `.env.local` がある場合はコピーせず、以下の変数を追記してください。
Supabase未設定のときは初期設定の案内画面になります。家族データやカレンダーを公開するデモモードはありません。

## 2. Supabaseプロジェクトの作成

1. [Supabase Dashboard](https://supabase.com/dashboard) にログインし、New projectからこのアプリ専用のプロジェクトを作成します。
2. プロジェクト名・データベースパスワード・リージョン（日本からはTokyoなど）を設定します。DBパスワードはアプリの公開キーとは別です。
3. Connect（接続情報）からProject URLとPublishable keyを取得します。従来のanon keyでも接続できます。
4. Authenticationのメール認証を有効にします。**一般公開の新規サインアップは無効**にしてください。アプリにも自己登録画面はありません。
5. AuthenticationのURL設定でSite URLを `http://localhost:3001` にします。公開する場合は実際のHTTPS URLに変更します。

Authアカウントがあるだけでは家族データにアクセスできません。後述の `profiles` 登録が必要です。

## 3. 環境変数

`frontend/.env.local` に次を設定します。

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

従来のキーを使う場合は、2行目の代わりに次を設定します。

```dotenv
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

- URL・publishable/anonキー以外の秘密値はアプリに不要です。
- `service_role` / secretキーは設定しないでください。RLSを迂回するため、ブラウザに渡してはいけません。
- `.env.local` は `.gitignore` で除外し、`.env.local.example` のみを管理します。
- 値を変更したら開発サーバーを再起動します。

## 4. SQLマイグレーションと家族の登録

### テーブルとRLSの作成

SupabaseのSQL Editorで、以下のファイルの内容をすべて貼り付け、1回実行してください。

```text
supabase/migrations/202610130001_family_car_calendar.sql
```

SQLはトランザクションで実行されます。既存の同名テーブルがあるプロジェクトでは実行せず、このアプリ専用の新しいプロジェクトを使用してください。
ローカルの `npm run test` でも、このファイルそのものをPostgreSQLエンジン（PGlite）に適用して検証します。

### メール・パスワードのAuthユーザー作成

Authentication > Users > Add user > Create new userで家族のメールアドレス・パスワードを設定します。
**Auto Confirm User** を有効にし、メール確認済みの状態にします。
各家族に自分のアカウントでログインしてもらいます。共通アカウントにすると編集・削除の区別ができません。

### 家族への登録

`supabase/enroll-family.example.sql` のメールアドレスを実際に作成したAuthユーザーのメールに置き換え、SQL Editorで実行します。
名前・色・アイコン、メンバー数も家族に合わせて変更できます。
存在しないメールがある場合は全体がロールバックされるため、メールを直して再実行してください。
成功後は同じ登録SQLを再実行する必要はありません。

追加の家族メンバーはAuthユーザーを作成してから、既存のfamily_idを指定して登録します。
以下のSQLのUUIDとメールを置き換えて実行してください。

```sql
insert into public.profiles (id, family_id, name, color, avatar)
select id, 'YOUR_EXISTING_FAMILY_UUID'::uuid, '家族の名前', '#047857', '🧑'
from auth.users
where lower(email) = lower('new-member@example.com');
```

family_idはSQL Editorの `select id, name from public.families;` で確認できます。
メンバー登録・家族の所属変更はSQL Editorを利用する管理者のみ行います。アプリから他の家族に所属することはできません。

## 5. 開発サーバーの起動

既存アプリが3000番を使用しているため、3001番を指定します。

```bash
cd /home/dembele/ndanda/frontend
npm run dev -- --hostname 0.0.0.0 --port 3001
```

Windowsのブラウザから **http://localhost:3001** を開きます。
3000番が空いている環境では `npm run dev` だけでも起動できます。
終了は起動したターミナルで `Ctrl+C` です。他のアプリのプロセスを停止する必要はありません。

Windows側からHTTP接続を確認するにはPowerShellで実行します。

```powershell
(Invoke-WebRequest -UseBasicParsing http://localhost:3001).StatusCode
```

接続できない場合はWSLのlocalhost転送とWindowsのネットワーク設定を確認してください。
スマートフォンから実機利用する場合は、同じネットワークから到達できるホストにHTTPSで配置し、SupabaseのURL設定も合わせて変更してください。

## 使い方

- **ホーム**：現在の利用予定、今日の予定と空き時間、月のカレンダー。
- **カレンダー**：月移動、日付選択、その日の全予定と空き時間。各予定のタップで詳細を表示します。
- **追加**：使用者、日付、開始・終了時間、8種類の用途、任意のメモを入力。
- **その他**：用途を自由入力できます。
- **重複**：警告に既存予定と今回の予定を表示し、確認後の登録を許可します。時刻がちょうど接する予定は重複扱いにしません。
- **編集・削除**：登録時にログインしていた本人だけが実行できます。他の家族を使用者として登録しても、このルールは変わりません。
- **設定**：自分の表示名・アイコン・色を変更します。他のメンバーの表示設定は各本人が変更します。
- **更新**：更新ボタン、画面に戻ったとき、表示中の60秒ごとの読み直しで家族の変更を反映します。

予定は1日内の時間帯です。終了を24:00に設定できます。日をまたぐ予定は日ごとに分けて登録してください。
日付・時刻は日本時間（Asia/Tokyo）として扱い、作成・更新の内部記録はtimestamptzで保持します。
空き時間は重複した予定の区間を統合して計算するため、利用中の時間を誤って空きと表示しません。

## データ構造とアクセス制御

| テーブル | 内容 |
| --- | --- |
| families | 家族の共有範囲 |
| profiles | AuthのユーザーID、家族ID、名前、カラー、アイコン、作成日時 |
| schedules | 使用者のuser_id、家族ID、日付、開始・終了、用途、メモ、作成・更新日時 |

`schedules.user_id` は常に **車の使用者** です。
`created_by` は編集・削除権限を守るためにDBがAuth IDを自動記録する内部情報です。
画面には「予約者」を表示せず、予約者カラムや優先順位・承認システムは作りません。

- 未ログインはアプリ本体にアクセスできず、DBの読み書きも拒否します。
- 所属が確認できた同一家族のみ、予定とプロフィールを閲覧できます。
- 家族メンバーは、自分を含む同一家族の誰でも車の使用者として選択できます。
- 予定の編集・削除は `created_by = auth.uid()` のRLSで制御します。
- `user_id` と `family_id` の複合外部キーで、別の家族を使用者にする操作を拒否します。
- 家族ID・内部の作成者ID・作成日時にはアプリ利用者の変更権限を与えません。
- プロフィールは自分の名前・カラー・アイコンだけ変更できます。自己登録も拒否します。
- `save_schedule` はSECURITY INVOKERでRLSを維持し、家族内の同時保存を直列化します。警告中に別の重複予定が追加されても、もう一度警告を返します。
- 同じ予定が別画面で更新されていた場合、古い内容の上書きを拒否します。
- 重複を禁止するDB制約は設けていません。

## 検証

```bash
npm run lint
npm run test
npm run build
npm audit --omit=dev
```

`npm run test` は重複判定、境界時刻、日別空き時間、バリデーション、日本時間、SQL適用、家族の隔離、Auth未所属、変更権限、確認後の重複保存を検証します。
テスト用PostgreSQLはメモリ内で動き、実際のSupabaseや既存DBには接続しません。
Supabase設定後には2人のアカウントで、予定の共有・他人の編集不可・重複後の登録を確認してください。

ブラウザの操作テストも用意しています。テスト専用のローカルAuth/DB接続先を54329番、別のNext.jsサーバーを3002番で一時起動し、実際のマイグレーションとRLSを使って確認します。実際のSupabase接続を検証するものではありません。テストアカウントやテスト用署名キーはこのテスト専用サーバー内だけで使用します。

```bash
PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npx playwright install chromium
npm run test:e2e
```

このWSLで不足していたブラウザ用ライブラリはシステムにインストールせず、プロジェクト内に展開しています。新しい環境で `libnspr4.so` 等が見つからない場合も、次の方法でOSを変更せずに補えます（Ubuntuの例）。

```bash
mkdir -p .playwright-libs
cd .playwright-libs
apt download libnspr4 libnss3 libasound2t64
for calendar_library in ./*.deb; do dpkg-deb -x "$calendar_library" .; done
cd ..
npm run test:e2e
```

ログイン拒否、家族未所属、他人の編集不可、重複確認後の追加、編集、削除、日本語の入力エラー、その他用途、設定、月移動、ログアウトをスマートフォンサイズのChromiumで操作します。画面キャプチャ・失敗時のトレースはGit除外の `test-results/` に保存します。

本番起動の確認は `npm run build` の後で、次を実行します。

```bash
npm run start -- --hostname 0.0.0.0 --port 3001
```

## ファイル構成

```text
app/                  ページ、ログイン、Server Actions、エラー画面
components/auth/      ログインフォーム
components/calendar/  月カレンダー
components/schedules/ 予定フォーム、詳細、日別タイムライン
components/family/    メイン画面、プロフィール設定
components/ui/        共通UI
lib/                  日時・重複・空き時間・入力検証、型、データ取得
lib/supabase/         接続設定とサーバークライアント
proxy.ts              認証セッションの更新
supabase/migrations/  テーブル、制約、RLS、保存RPC
supabase/             家族登録SQLの例
tests/                ロジックとRLSのテスト
```

## トラブルシューティング

- **初期設定の案内のまま**：`.env.local` の場所・変数名・値を確認して再起動してください。
- **ログイン失敗**：Authユーザーのメール、パスワード、Auto Confirmを確認してください。
- **家族に登録されていない**：Auth IDが `profiles.id` に登録されているか確認してください。
- **DB読み込み・保存失敗**：SQLマイグレーション全体が成功したか、接続先プロジェクトが正しいか、通信環境を確認してください。
- **古い予定の編集エラー**：最新の画面に更新し、予定の詳細から編集し直してください。

依存関係の監査では、本番依存は脆弱性なしでした。既存のESLint関連には `braces` の開発依存の指摘が残っています。監査が提案するNext.js/ESLintの大幅な変更は、既存環境を維持するため適用していません。

参考：[SupabaseのSSR認証](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs)、[SupabaseのRLS](https://supabase.com/docs/guides/database/postgres/row-level-security)。
