import { test, expect, type Page } from "@playwright/test";
import { japanDate } from "../../lib/calendar";

async function login(page: Page, email = "me@example.com") {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
}

test("未ログインと未登録のアカウントを拒否する", async ({ page }) => {
  await page.goto("/?view=calendar");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("メールアドレス").fill("me@example.com");
  await page.getByLabel("パスワード", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(page.locator(".login-card").getByRole("alert")).toContainText("ログインできませんでした");
  await login(page, "stranger@example.com");
  await expect(page.locator(".login-card").getByRole("alert")).toContainText("家族に登録されていません");
  await expect(page.getByRole("heading", { name: "今日の車の予定" })).toHaveCount(0);
});

test("スマートフォンで重複警告、登録、編集、削除、設定、月移動を操作できる", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await login(page);
  await expect(page.getByRole("heading", { name: "家族のお出かけ、ここで共有。" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/home-mobile.png", fullPage: true });
  // Mother is the car user and the author of this seeded plan: another account has no edit controls.
  await page.locator(".schedule-card").first().click();
  await expect(page.getByRole("dialog")).toContainText("母");
  await expect(page.getByRole("button", { name: "編集", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await page.locator(".bottom-nav").getByRole("button", { name: "追加", exact: true }).click();
  const form = page.getByRole("dialog");
  await form.locator('[name="start_time"]').fill("15:00");
  await form.locator('input[type="time"]').nth(1).fill("18:00");
  await form.getByRole("combobox", { name: /^用途/ }).selectOption("🚗 ドライブ");
  await form.getByRole("textbox", { name: /^メモ/ }).fill("友達と秩父");
  await form.getByRole("button", { name: "予定を追加", exact: true }).click();
  await expect(form.getByRole("alert")).toContainText("予定が重なっています");
  await expect(form.getByRole("alert")).toContainText("母");
  await page.screenshot({ path: "test-results/overlap-mobile.png", fullPage: true });
  await form.getByRole("button", { name: "それでも登録する", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".schedule-card")).toHaveCount(2);
  await expect(page.locator(".overlap-badge")).toHaveCount(2);
  await expect(page.locator(".free-slot").last()).toContainText("18:00〜24:00");
  await page.locator(".schedule-card").filter({ hasText: "ドライブ" }).click();
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await page.getByRole("dialog").locator('[name="start_time"]').fill("17:00");
  await page.getByRole("button", { name: "変更を保存", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".overlap-badge")).toHaveCount(0);
  // Japanese validation and Other purpose.
  await page.locator(".bottom-nav").getByRole("button", { name: "追加", exact: true }).click();
  await page.getByRole("dialog").locator('input[type="time"]').nth(1).fill("08:00");
  await page.getByRole("button", { name: "予定を追加", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("終了時間は開始時間より後に");
  await page.getByRole("dialog").locator('input[type="time"]').nth(1).fill("10:00");
  await page.getByRole("dialog").getByRole("combobox", { name: /^用途/ }).selectOption("📦 その他");
  await page.getByRole("dialog").getByRole("textbox", { name: /^その他の用途/ }).fill("駅まで送迎");
  await page.getByRole("button", { name: "予定を追加", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".schedule-card")).toHaveCount(3);
  await page.locator(".schedule-card").filter({ hasText: "ドライブ" }).click();
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await page.getByRole("button", { name: "削除する", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".schedule-card")).toHaveCount(2);
  await page.locator(".bottom-nav").getByRole("button", { name: "設定", exact: true }).click();
  await page.getByLabel("名前", { exact: true }).fill("わたし");
  await page.getByRole("button", { name: "アイコン 🌷", exact: true }).click();
  await page.getByRole("button", { name: "緑を選択", exact: true }).click();
  await page.getByRole("button", { name: "設定を保存", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("設定を保存しました");
  await page.locator(".bottom-nav").getByRole("button", { name: "カレンダー", exact: true }).click();
  await page.getByRole("button", { name: "次の月", exact: true }).click();
  await expect(page.locator(".calendar-plan")).toHaveCount(0);
  await page.getByRole("button", { name: "今日", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(japanDate()));
  await expect(page.locator(".calendar-plan")).toHaveCount(2);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/calendar-desktop.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator(".desktop-nav").getByRole("button", { name: "設定", exact: true }).click();
  await page.getByRole("button", { name: "ログアウト", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});
