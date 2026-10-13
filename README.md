# うちのくるま — 家族の車共有カレンダー

Next.js App Router / TypeScript / Tailwind CSS / Supabase Auth / PostgreSQL のアプリです。
実装は `frontend/` にあります。既存の `backend/` と `docker-compose.yml` はそのまま維持しています。

起動・Supabase作成・家族登録・環境変数・SQL・検証の手順は [frontend/README.md](frontend/README.md) を参照してください。

```bash
cd /home/dembele/ndanda/frontend
npm ci
cp .env.local.example .env.local
# READMEに従いSupabaseを作成し、SQLと環境変数を設定します。
npm run dev -- --hostname 0.0.0.0 --port 3001
```

Windows側では `http://localhost:3001` を開きます。
この環境では3000番が既存アプリで使用されているため、3001番を使用します。
