"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { AVATARS, UUID, validateSchedule } from "@/lib/calendar";
import { revalidatePath } from "next/cache";
import type { ActionResult, Profile, ScheduleInput } from "@/lib/types";

async function familySession() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("ログインの有効期限が切れました。再度ログインしてください。");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (profileError) throw new Error("家族情報を取得できませんでした。接続とSupabaseの設定を確認してください。");
  if (!profile) throw new Error("家族メンバーの登録がありません。管理する家族に確認してください。");
  return { supabase, user, profile: profile as Profile };
}

function failure(error: unknown, fallback: string): ActionResult {
  return { error: error instanceof Error && !/fetch|network|timeout/i.test(error.message) ? error.message : fallback };
}

export async function login(email: string, password: string): Promise<ActionResult> {
  if (!supabaseConfig()) return { error: "Supabaseの接続設定がありません。READMEに沿って設定してください。" };
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password !== "string" || !password) return { error: "メールアドレスとパスワードを入力してください。" };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: error.status && error.status >= 500 ? "認証サービスに接続できません。時間をおいてお試しください。" : "ログインできませんでした。メールアドレスとパスワードを確認してください。" };
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile, error: profileError } = await supabase.from("profiles").select("id").eq("id", user?.id ?? "").maybeSingle();
    if (profileError || !profile) {
      await supabase.auth.signOut();
      return { error: profileError ? "家族情報を確認できませんでした。Supabaseの設定を確認してください。" : "このアカウントは家族に登録されていません。管理する家族に確認してください。" };
    }
    revalidatePath("/", "layout");
    return { success: true };
  } catch { return { error: "ネットワークに接続できません。通信環境を確認して、もう一度お試しください。" }; }
}

export async function logout(): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) return { error: "ログアウトできませんでした。通信環境を確認してください。" };
    revalidatePath("/", "layout");
    return { success: true };
  } catch { return { error: "ログアウトできませんでした。通信環境を確認してください。" }; }
}

export async function saveSchedule(form: FormData, acknowledgedIds: string[] = []): Promise<ActionResult> {
  const read = (key: string) => String(form.get(key) ?? "").trim();
  const input: ScheduleInput = { user_id: read("user_id"), date: read("date"), start_time: read("start_time"), end_time: read("end_time"), purpose: read("purpose"), memo: read("memo") };
  const fieldErrors = validateSchedule(input);
  if (Object.keys(fieldErrors).length) return { fieldErrors, error: "入力内容を確認してください。" };
  const id = read("id");
  if ((id && !UUID.test(id)) || !Array.isArray(acknowledgedIds) || acknowledgedIds.some(id => typeof id !== "string" || !UUID.test(id))) return { error: "予定の情報が正しくありません。画面を更新してください。" };
  try {
    const { supabase } = await familySession();
    const { data, error } = await supabase.rpc("save_schedule", {
      p_user_id: input.user_id, p_date: input.date, p_start_time: input.start_time, p_end_time: input.end_time,
      p_purpose: input.purpose, p_memo: input.memo, p_id: id || null,
      p_acknowledged_ids: acknowledgedIds, p_expected_updated_at: read("updated_at") || null,
    });
    if (error) return { error: id ? "予定を編集できませんでした。通信環境と入力内容を確認し、もう一度お試しください。" : "予定を登録できませんでした。通信環境と入力内容を確認し、もう一度お試しください。" };
    const result = data as ActionResult;
    if (result.success) revalidatePath("/");
    return result;
  } catch (error) { return failure(error, "通信に失敗しました。ネットワークを確認してください。"); }
}

export async function deleteSchedule(id: string): Promise<ActionResult> {
  if (typeof id !== "string" || !UUID.test(id)) return { error: "予定が見つかりません。" };
  try {
    const { supabase, user } = await familySession();
    const { data, error } = await supabase.from("schedules").delete().eq("id", id).eq("created_by", user.id).select("id");
    if (error) return { error: "予定を削除できませんでした。通信環境を確認し、もう一度お試しください。" };
    if (!data?.length) return { error: "この予定は削除済みか、削除する権限がありません。" };
    revalidatePath("/");
    return { success: true };
  } catch (error) { return failure(error, "通信に失敗しました。ネットワークを確認してください。"); }
}

export async function updateProfile(form: FormData): Promise<ActionResult> {
  const name = String(form.get("name") ?? "").trim();
  const avatar = String(form.get("avatar") ?? "");
  const color = String(form.get("color") ?? "");
  if (!name || name.length > 30) return { error: "名前は1〜30文字で入力してください。" };
  if (!AVATARS.includes(avatar) || !/^#[0-9a-f]{6}$/i.test(color)) return { error: "アイコンとカラーを選択してください。" };
  try {
    const { supabase, user } = await familySession();
    const { data, error } = await supabase.from("profiles").update({ name, avatar, color }).eq("id", user.id).select("id");
    if (error || !data?.length) return { error: "設定を保存できませんでした。通信環境を確認してお試しください。" };
    revalidatePath("/");
    return { success: true };
  } catch (error) { return failure(error, "通信に失敗しました。ネットワークを確認してください。"); }
}
