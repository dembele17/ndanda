"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Brand } from "./brand";
export function DataError({ message }: { message: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <main className="setup-page"><Brand /><section className="setup-card"><AlertCircle className="text-amber-600" size={36} /><h1>情報を読み込めませんでした</h1><p className="muted" role="alert">{message}</p><button className="button primary full" disabled={pending} onClick={() => startTransition(() => router.refresh())}><RefreshCw size={18} />{pending ? "確認中…" : "もう一度読み込む"}</button><Link className="quiet-link" href="/login">ログイン画面へ</Link></section></main>;
}
