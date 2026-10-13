"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CarFront, Check, Home, Plus, RefreshCw, Settings, ShieldCheck, WifiOff } from "lucide-react";
import { logout } from "@/app/actions";
import { dateLabel, dayTimeline, findOverlaps, japanDate, minutes } from "@/lib/calendar";
import type { Profile, Schedule } from "@/lib/types";
import { Brand } from "@/components/ui/brand";
import { MonthCalendar } from "@/components/calendar/month-calendar";
import { DayTimeline } from "@/components/schedules/day-timeline";
import { ScheduleForm } from "@/components/schedules/schedule-form";
import { ScheduleDetail } from "@/components/schedules/schedule-detail";
import { FamilySettings } from "./settings";

type View = "home" | "calendar" | "settings";
type Dialog = { type: "add"; date: string } | { type: "detail"; schedule: Schedule } | { type: "edit"; schedule: Schedule } | null;

export function FamilyCalendar({ profile, members, schedules, familyName, today, selectedDate, view, now }: { profile: Profile; members: Profile[]; schedules: Schedule[]; familyName: string; today: string; selectedDate: string; view: View; now: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [logoutPending, startLogout] = useTransition();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [clock, setClock] = useState(now);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) router.refresh(); };
    const handleOffline = () => setOffline(true);
    const handleOnline = () => { setOffline(false); refresh(); };
    const timer = window.setInterval(() => { setClock(new Date().toISOString()); refresh(); }, 60000);
    window.addEventListener("focus", refresh);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("offline", handleOffline); window.removeEventListener("online", handleOnline); };
  }, [router]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  const todaySchedules = schedules.filter(s => s.date === today);
  const selectedSchedules = schedules.filter(s => s.date === selectedDate);
  const current = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(clock));
  const active = japanDate(new Date(clock)) === today ? todaySchedules.filter(s => minutes(s.start_time) <= minutes(current) && minutes(s.end_time) > minutes(current)) : [];
  const freeMinutes = dayTimeline(todaySchedules).reduce((total, item) => total + (item.kind === "free" ? item.end - item.start : 0), 0);
  function navigate(nextView: View, nextDate = selectedDate) {
    startTransition(() => router.push(`/?view=${nextView}&date=${nextDate}`, { scroll: false }));
  }
  function saved(date: string) {
    const editing = dialog?.type === "edit";
    setDialog(null); setToast(editing ? "予定を更新しました" : "予定を追加しました");
    navigate(view === "settings" ? "home" : view, date);
    router.refresh();
  }
  function signOut() {
    setError("");
    startLogout(async () => {
      try {
        const result = await logout();
        if (result.success) { router.replace("/login"); router.refresh(); }
        else setError(result.error ?? "ログアウトできませんでした。");
      } catch { setError("通信に失敗しました。ネットワークを確認してください。"); }
    });
  }
  const nav = [{ key: "home", label: "ホーム", icon: Home }, { key: "calendar", label: "カレンダー", icon: CalendarDays }, { key: "add", label: "追加", icon: Plus }, { key: "settings", label: "設定", icon: Settings }] as const;
  const todayTimeline = <DayTimeline date={today} today={today} schedules={todaySchedules} members={members} onDetail={schedule => setDialog({ type: "detail", schedule })} onAdd={() => setDialog({ type: "add", date: today })} />;
  const selectedTimeline = <div id="selected-day"><DayTimeline date={selectedDate} today={today} schedules={selectedSchedules} members={members} onDetail={schedule => setDialog({ type: "detail", schedule })} onAdd={() => setDialog({ type: "add", date: selectedDate })} /></div>;
  const calendar = <MonthCalendar date={selectedDate} today={today} schedules={schedules} members={members} pending={pending} onDate={date => navigate(view, date)} onDetail={schedule => setDialog({ type: "detail", schedule })} />;
  return <div className="app-shell"><header className="app-header"><div className="header-inner"><Brand /><nav className="desktop-nav" aria-label="メインナビゲーション">{nav.filter(item => item.key !== "add").map(item => <button key={item.key} className={view === item.key ? "active" : ""} aria-current={view === item.key ? "page" : undefined} onClick={() => navigate(item.key, item.key === "home" ? today : selectedDate)}><item.icon size={18} />{item.label}</button>)}</nav><div className="header-family"><span><ShieldCheck size={14} />{familyName}</span><button className="avatar" style={{ background: `${profile.color}15` }} onClick={() => navigate("settings")} aria-label="自分の設定を開く">{profile.avatar}</button></div></div></header><main className="app-main" aria-busy={pending}><div className="page-heading"><div><span className="eyebrow">{view === "home" ? "MAKE ROOM FOR EVERYONE." : view === "calendar" ? "PLAN TOGETHER." : "A LITTLE MORE YOU."}</span><h1>{view === "home" ? "家族のお出かけ、ここで共有。" : view === "calendar" ? "家族のカレンダー" : "家族の設定"}</h1><p>{view === "home" ? "車を使う予定が、ひと目でわかる。" : view === "calendar" ? "日付を選んで、予定と空き時間を確認。" : "自分のプロフィールと家族のメンバーを確認。"}</p></div><div className="heading-actions"><button className="icon-button refresh-button" disabled={pending} onClick={() => startTransition(() => router.refresh())} aria-label="最新の予定を読み込む"><RefreshCw size={19} /></button>{view !== "settings" && <button className="button primary add-button" onClick={() => setDialog({ type: "add", date: selectedDate })}><Plus size={20} />予定追加</button>}</div></div>
    {offline && <div className="notice warning" role="status"><WifiOff size={18} />オフラインです。接続が戻ってから保存してください。</div>}{error && <p className="notice error" role="alert">{error}</p>}
    {view === "home" && <div className="home-grid"><div className="today-column"><section className={`car-status ${active.length ? "in-use" : "available"}`}><div><span className="status-caption"><span className="status-dot" />{active.length ? "いまの利用予定" : "いま、車は空いています"}</span><h2>{active.length ? active.map(s => members.find(m => m.id === s.user_id)?.name).join("・") + "が使用予定" : "次のお出かけ、どうぞ。"}</h2><p>{current} 時点 · {dateLabel(today, { weekday: undefined })}</p></div><CarFront className="status-car" size={62} strokeWidth={1.4} /><div className="status-stats"><span><strong>{todaySchedules.length}</strong> 今日の予定</span><span><strong>{Math.floor(freeMinutes / 60)}<small>時間{freeMinutes % 60 ? `${freeMinutes % 60}分` : ""}</small></strong> 今日の空き時間</span></div></section>{todayTimeline}<p className="sharing-hint">🤝 重なった予定は、家族で相談しましょう。</p></div><div className="calendar-column">{calendar}{selectedDate !== today && selectedTimeline}<section className="calendar-tip"><CalendarDays size={20} /><div><strong>日付をタップして、その日の予定をチェック</strong><p>使用者ごとのカラーで表示。重複する予定には注意マークが付きます。</p></div></section></div></div>}
    {view === "calendar" && <div className="month-layout"><div>{calendar}</div>{selectedTimeline}</div>}
    {view === "settings" && <FamilySettings profile={profile} members={members} onSaved={() => { setToast("設定を保存しました"); router.refresh(); }} onLogout={signOut} logoutPending={logoutPending} />}
    <footer className="app-footer"><CarFront size={16} /><span>うちのくるま</span><span>家族で相談して、気持ちよくシェア。</span></footer></main>
    <nav className="bottom-nav" aria-label="スマートフォン用ナビゲーション">{nav.map(item => <button key={item.key} className={`${item.key === "add" ? "nav-add" : ""} ${view === item.key ? "active" : ""}`} aria-current={view === item.key ? "page" : undefined} onClick={() => item.key === "add" ? setDialog({ type: "add", date: selectedDate }) : navigate(item.key, item.key === "home" ? today : selectedDate)}><span><item.icon size={22} /></span>{item.label}</button>)}</nav>
    {toast && <div className="toast" role="status"><Check size={18} />{toast}</div>}
    {dialog?.type === "add" && <ScheduleForm members={members} profile={profile} date={dialog.date} onClose={() => setDialog(null)} onSaved={saved} />}
    {dialog?.type === "edit" && <ScheduleForm members={members} profile={profile} date={dialog.schedule.date} schedule={dialog.schedule} onClose={() => setDialog(null)} onSaved={saved} />}
    {dialog?.type === "detail" && (() => { const s = schedules.find(s => s.id === dialog.schedule.id) ?? dialog.schedule; const member = members.find(m => m.id === s.user_id); return member ? <ScheduleDetail schedule={s} member={member} canEdit={s.created_by === profile.id} overlapping={findOverlaps(s, schedules, s.id).length > 0} onClose={() => setDialog(null)} onEdit={() => setDialog({ type: "edit", schedule: s })} onDeleted={() => { setDialog(null); setToast("予定を削除しました"); router.refresh(); }} /> : null; })()}
  </div>;
}
