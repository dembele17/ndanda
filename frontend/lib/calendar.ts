import type { FieldErrors, Schedule, ScheduleInput } from "./types";

export const PURPOSES = ["🛒 買い物", "🏫 通学", "💼 通勤", "🏔️ 旅行", "🚗 ドライブ", "🍽️ 外食", "🏥 病院", "📦 その他"];
export const AVATARS = ["👦", "👩", "👨", "👧", "🧑", "👵", "👴", "🐱", "🐶", "🌷"];
export const COLORS = ["#2563eb", "#b45309", "#7c3aed", "#be185d", "#047857", "#0369a1"];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function japanDate(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01" || value > "9998-12-31") return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function dateLabel(date: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "long", timeZone: "Asia/Tokyo", ...options }).format(new Date(`${date}T00:00:00+09:00`));
}

export function monthBounds(date: string) {
  const [year, month] = date.split("-").map(Number);
  const end = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${date.slice(0, 7)}-01`, end: `${date.slice(0, 7)}-${end}`, days: end, offset: new Date(`${date.slice(0, 7)}-01T00:00:00Z`).getUTCDay() };
}

export function shiftMonth(date: string, delta: number) {
  const [year, month] = date.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return d.toISOString().slice(0, 10);
}

export function timeLabel(time: string) { return time.slice(0, 5); }
export function minutes(time: string) { const [h, m] = time.split(":").map(Number); return h * 60 + m; }
export function minuteLabel(value: number) { return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; }

export function findOverlaps(input: Pick<ScheduleInput, "date" | "start_time" | "end_time">, schedules: Schedule[], excludeId?: string) {
  return schedules.filter(s => s.id !== excludeId && s.date === input.date && minutes(s.start_time) < minutes(input.end_time) && minutes(s.end_time) > minutes(input.start_time));
}

export type TimelineItem = { kind: "schedule"; schedule: Schedule } | { kind: "free"; start: number; end: number };
export function dayTimeline(schedules: Schedule[]): TimelineItem[] {
  const result: TimelineItem[] = [];
  let cursor = 0;
  for (const schedule of [...schedules].sort((a, b) => a.start_time.localeCompare(b.start_time) || a.end_time.localeCompare(b.end_time))) {
    const start = minutes(schedule.start_time), end = minutes(schedule.end_time);
    if (start > cursor) result.push({ kind: "free", start: cursor, end: start });
    result.push({ kind: "schedule", schedule });
    cursor = Math.max(cursor, end);
  }
  if (cursor < 1440) result.push({ kind: "free", start: cursor, end: 1440 });
  return result;
}

export function validateSchedule(input: ScheduleInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!UUID.test(input.user_id)) errors.user_id = "使用者を選択してください。";
  if (!isValidDate(input.date)) errors.date = "有効な日付を入力してください。";
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timePattern.test(input.start_time)) errors.start_time = "開始時間を入力してください。";
  if (!timePattern.test(input.end_time) && input.end_time !== "24:00") errors.end_time = "終了時間を入力してください。";
  if (!errors.start_time && !errors.end_time && minutes(input.start_time) >= minutes(input.end_time)) errors.end_time = "終了時間は開始時間より後にしてください。日をまたぐ場合は日別に登録してください。";
  if (!PURPOSES.slice(0, -1).includes(input.purpose) && !/^📦 その他：\S/.test(input.purpose)) errors.purpose = "用途を選択し、その他の場合は内容を入力してください。";
  if (input.purpose.length > 100) errors.purpose = "用途は100文字以内で入力してください。";
  if (input.memo.length > 1000) errors.memo = "メモは1,000文字以内で入力してください。";
  return errors;
}
