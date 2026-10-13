"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, LockKeyhole, CarFront } from "lucide-react";
import { login } from "@/app/actions";
import { Brand } from "@/components/ui/brand";
export function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, startTransition] = useTransition();
  function submit(form: FormData) {
    setError("");
    startTransition(async () => {
      try {
        const result = await login(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
        if (result.success) { router.replace("/"); router.refresh(); }
        else setError(result.error ?? "ログインできませんでした。");
      } catch { setError("通信に失敗しました。ネットワークを確認してください。"); }
    });
  }
  return <main className="login-page"><div className="login-story"><Brand /><div><span className="eyebrow">OUR FAMILY, OUR CAR.</span><h1>次は、<br />だれのお出かけ？</h1><p>買い物も、通学も、週末のドライブも。<br />車を使う予定を、家族みんなで。</p><div className="login-illustration" aria-hidden="true"><span className="sun" /><CarFront size={145} strokeWidth={1.1} /><span className="road" /></div></div><span className="story-footer">予定が重なったら、家族で相談しよう。</span></div><section className="login-form-area"><div className="mobile-brand"><Brand /></div><div className="login-card"><span className="login-lock"><LockKeyhole size={23} /></span><h2>おかえりなさい</h2><p className="muted">家族のアカウントでログインしてください。</p>{!configured && <div className="notice warning">Supabase が未設定です。<Link href="/">初期設定の案内</Link>をご確認ください。</div>}<form action={submit} noValidate><fieldset disabled={pending || !configured}><label className="field"><span>メールアドレス</span><input name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} required /></label><label className="field"><span>パスワード</span><span className="password-input"><input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="パスワードを入力" required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}>{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button></span></label>{error && <p className="notice error" role="alert">{error}</p>}<button className="button primary full" type="submit">{pending ? "ログイン中…" : "ログイン"}<ArrowRight size={18} /></button></fieldset></form><p className="login-help">アカウントがない場合は、家族の管理者に<br />メールアドレスの登録をお願いしてください。</p></div><span className="footer-note"><LockKeyhole size={13} /> このカレンダーは家族だけが閲覧できます。</span></section></main>;
}
