import Link from "next/link";
import { CarFront, Check, ArrowUpRight } from "lucide-react";
import { Brand } from "./brand";
export function Setup() {
  return <main className="setup-page"><Brand /><section className="setup-card"><div className="setup-art"><CarFront size={68} strokeWidth={1.4} /></div><span className="eyebrow">はじめての設定</span><h1>家族の予定を、<br />ひとつのカレンダーに。</h1><p className="muted">アプリの準備ができました。<br />Supabase を接続すると、家族だけのカレンダーを使えます。</p><ol className="setup-steps"><li><span>1</span><div><strong>Supabase プロジェクトを作成</strong><p>家族専用の新しいプロジェクトを用意します。</p></div></li><li><span>2</span><div><strong>SQL を実行して家族を登録</strong><p>マイグレーションと家族登録用 SQL を実行します。</p></div></li><li><span>3</span><div><strong>環境変数を設定して再起動</strong><p><code>.env.local.example</code> をもとに接続情報を設定します。</p></div></li></ol><p className="setup-note"><Check size={17} /> 詳しい手順は frontend/README.md にあります。</p><a className="button primary full" href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">Supabase を開く <ArrowUpRight size={18} /></a><Link href="/login" className="quiet-link">ログイン画面へ</Link></section><p className="footer-note">家族で相談して、気持ちよくシェア。</p></main>;
}
