import "server-only";
import { createClient } from "./supabase/server";
import { monthBounds } from "./calendar";
import type { Profile, Schedule } from "./types";

type CalendarData = { error: string } | { unauthenticated: true } | { profile: Profile; members: Profile[]; schedules: Schedule[]; familyName: string };

export async function loadCalendar(selectedDate: string, today: string): Promise<CalendarData> {
  try {
    const supabase = await createClient();
    const auth = await supabase.auth.getUser();
    if (auth.error && (!auth.error.status || auth.error.status >= 500)) return { error: "認証サービスに接続できません。通信環境を確認してください。" };
    const user = auth.data.user;
    if (!user) return { unauthenticated: true };
    const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) return { error: "家族情報を取得できません。接続とSQLマイグレーションの実行状況を確認してください。" };
    if (!profile) return { error: "このアカウントは家族に登録されていません。管理する家族に登録をお願いしてください。" };
    const [membersResult, familyResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("family_id", profile.family_id).order("created_at").order("id"),
      supabase.from("families").select("name").eq("id", profile.family_id).single(),
    ]);
    if (membersResult.error || familyResult.error) return { error: "家族情報を読み込めませんでした。通信環境とSupabaseの設定を確認してください。" };
    const bounds = monthBounds(selectedDate);
    const schedules: Schedule[] = [];
    // Page through rows instead of silently truncating at the API's default limit.
    for (let offset = 0; ; offset += 500) {
      const result = await supabase.from("schedules").select("*").eq("family_id", profile.family_id)
        .or(`and(date.gte.${bounds.start},date.lte.${bounds.end}),date.eq.${today}`)
        .order("date").order("start_time").order("id").range(offset, offset + 499);
      if (result.error) return { error: "車の予定を読み込めませんでした。通信環境を確認して再試行してください。" };
      schedules.push(...result.data as Schedule[]);
      if (result.data.length < 500) break;
    }
    return { profile: profile as Profile, members: membersResult.data as Profile[], schedules, familyName: familyResult.data.name };
  } catch { return { error: "通信に失敗しました。ネットワークを確認し、もう一度読み込んでください。" }; }
}
