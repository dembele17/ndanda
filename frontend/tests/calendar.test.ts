import assert from "node:assert/strict";
import { test } from "node:test";
import { dayTimeline, findOverlaps, isValidDate, japanDate, monthBounds, shiftMonth, validateSchedule } from "../lib/calendar";
import type { Schedule, ScheduleInput } from "../lib/types";

const input: ScheduleInput = { user_id: "10000000-0000-0000-0000-000000000001", date: "2026-10-13", start_time: "15:00", end_time: "17:00", purpose: "🛒 買い物", memo: "" };
function schedule(start: string, end: string, id = start): Schedule {
  return { ...input, start_time: start, end_time: end, id, family_id: "family", created_by: input.user_id, created_at: "", updated_at: "" };
}

test("重複は警告対象になるが、隣接する予定・別の日・編集対象自身は重複しない", () => {
  const mother = schedule("15:00:00", "17:00:00", "mother");
  assert.equal(findOverlaps({ ...input, end_time: "18:00" }, [mother]).length, 1);
  assert.equal(findOverlaps({ ...input, start_time: "17:00", end_time: "20:00" }, [mother]).length, 0);
  assert.equal(findOverlaps({ ...input, end_time: "15:00", start_time: "13:00" }, [mother]).length, 0);
  assert.equal(findOverlaps({ ...input, date: "2026-10-14" }, [mother]).length, 0);
  assert.equal(findOverlaps(input, [mother], "mother").length, 0);
});

test("重複・内包する予定をまとめて、本当に空いている時間だけを表示する", () => {
  const timeline = dayTimeline([schedule("10:00", "11:00"), schedule("09:00", "12:00"), schedule("11:30", "13:00"), schedule("15:00", "18:00")]);
  assert.deepEqual(timeline.filter(item => item.kind === "free"), [
    { kind: "free", start: 0, end: 540 }, { kind: "free", start: 780, end: 900 }, { kind: "free", start: 1080, end: 1440 },
  ]);
  assert.equal(timeline.filter(item => item.kind === "schedule").length, 4);
  assert.deepEqual(dayTimeline([]), [{ kind: "free", start: 0, end: 1440 }]);
  assert.deepEqual(dayTimeline([schedule("00:00", "24:00")]).filter(item => item.kind === "free"), []);
});

test("必須項目、無効な日付、逆転・同時刻、その他の自由入力を日本語で検証", () => {
  assert.deepEqual(validateSchedule(input), {});
  assert.deepEqual(validateSchedule({ ...input, end_time: "24:00" }), {});
  for (const field of ["user_id", "date", "start_time", "end_time", "purpose"] as const) assert.ok(validateSchedule({ ...input, [field]: "" })[field]);
  for (const end of ["14:59", "15:00", "25:00", "17:60", "17:00:30"]) assert.ok(validateSchedule({ ...input, end_time: end }).end_time);
  assert.ok(validateSchedule({ ...input, date: "2026-02-30" }).date);
  assert.ok(validateSchedule({ ...input, purpose: "📦 その他：" }).purpose);
  assert.ok(validateSchedule({ ...input, purpose: "自由な未定義用途" }).purpose);
  assert.deepEqual(validateSchedule({ ...input, purpose: "📦 その他：駅まで送迎" }), {});
  assert.ok(validateSchedule({ ...input, memo: "あ".repeat(1001) }).memo);
});

test("月末・うるう年・年の切替と日本時間での日付を扱う", () => {
  assert.equal(isValidDate("2024-02-29"), true);
  assert.equal(isValidDate("2026-02-29"), false);
  assert.equal(isValidDate("0001-01-01"), false);
  assert.equal(monthBounds("2024-02-14").days, 29);
  assert.equal(monthBounds("2026-10-13").offset, 4);
  assert.equal(shiftMonth("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftMonth("2026-01-31", -1), "2025-12-01");
  assert.equal(japanDate(new Date("2026-10-12T15:00:00Z")), "2026-10-13");
});
