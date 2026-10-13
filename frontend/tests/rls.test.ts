import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const me = "10000000-0000-0000-0000-000000000001";
const mother = "10000000-0000-0000-0000-000000000002";
const other = "10000000-0000-0000-0000-000000000003";
const stranger = "10000000-0000-0000-0000-000000000004";
const family = "20000000-0000-0000-0000-000000000001";
const otherFamily = "20000000-0000-0000-0000-000000000002";

test("PostgreSQLでマイグレーション・RLS・重複を確認して保存するRPCを検証", async t => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      insert into auth.users(id, email) values ('${me}', 'me@example.com'), ('${mother}', 'mother@example.com'), ('${other}', 'other@example.com'), ('${stranger}', 'stranger@example.com');
    `);
    await db.exec(await readFile(new URL("../supabase/migrations/202610130001_family_car_calendar.sql", import.meta.url), "utf8"));
    await db.exec(`
      insert into public.families(id, name) values ('${family}', 'うちの家族'), ('${otherFamily}', '別の家族');
      insert into public.profiles(id, family_id, name, avatar) values ('${me}', '${family}', '自分', '👦'), ('${mother}', '${family}', '母', '👩'), ('${other}', '${otherFamily}', '別の家族', '👨');
    `);
    async function asUser(id: string, callback: () => Promise<void>, role = "authenticated") {
      await db.exec(`set role ${role};`);
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
      try { await callback(); } finally { await db.exec("reset role"); }
    }
    async function save(user = me, start = "15:00", end = "18:00", acknowledged: string[] = [], id: string | null = null, expected: string | null = null) {
      const { rows } = await db.query<{ result: { success?: boolean; conflicts?: { id: string }[]; error?: string } }>(
        "select public.save_schedule($1::uuid,'2026-10-13',$2::time,$3::time,'🚗 ドライブ','',$4::uuid,$5::uuid[],$6::timestamptz) as result",
        [user, start, end, id, acknowledged, expected],
      );
      return rows[0].result;
    }
    let firstId = "", expected = "";
    await t.test("他の家族を使用者に指定して作成でき、作成時のログインIDが保持される", async () => {
      await asUser(me, async () => {
        assert.equal((await save(mother, "15:00", "17:00")).success, true);
        const result = await db.query<{ id: string; user_id: string; created_by: string; stamp: string }>("select id, user_id, created_by, updated_at::text as stamp from public.schedules");
        assert.equal(result.rows[0].user_id, mother);
        assert.equal(result.rows[0].created_by, me);
        firstId = result.rows[0].id; expected = result.rows[0].stamp;
      });
    });
    await t.test("同じ家族は閲覧できるが、使用者本人でも他のアカウントが登録した予定は変更できない", async () => {
      await asUser(mother, async () => {
        assert.equal((await db.query("select * from public.schedules")).rows.length, 1);
        assert.equal((await db.query("update public.schedules set memo='変更' returning id")).rows.length, 0);
        assert.equal((await db.query("delete from public.schedules returning id")).rows.length, 0);
        assert.ok((await save(mother, "15:00", "17:00", [], firstId, expected)).error);
      });
    });
    await t.test("境界が接する時間は警告せず保存できる", async () => {
      await asUser(me, async () => {
        assert.equal((await save(me, "17:00", "18:00")).success, true);
      });
    });
    await t.test("重複では保存せず警告を返し、確認後は両方の予定を保存する", async () => {
      await asUser(me, async () => {
        const conflict = await save();
        assert.equal(conflict.conflicts?.length, 2);
        assert.equal((await db.query("select * from public.schedules")).rows.length, 2);
        assert.equal((await save(me, "15:00", "18:00", conflict.conflicts!.map(s => s.id))).success, true);
        assert.equal((await db.query("select * from public.schedules")).rows.length, 3);
      });
    });
    await t.test("確認後に追加された別の重複予定も再度警告する", async () => {
      let acknowledged: string[] = [];
      await asUser(me, async () => { acknowledged = (await save(me, "16:00", "20:00")).conflicts!.map(s => s.id); });
      await asUser(mother, async () => { const result = await save(mother, "18:30", "19:30"); assert.equal(result.success, true); });
      await asUser(me, async () => { assert.equal((await save(me, "16:00", "20:00", acknowledged)).conflicts?.length, 4); });
    });
    await t.test("作成者本人は編集でき、自分自身の重複を除外し、古い版からの上書きを防ぐ", async () => {
      await asUser(me, async () => {
        const all = (await db.query<{ id: string }>("select id from public.schedules")).rows.map(s => s.id);
        assert.equal((await save(mother, "15:00", "17:00", all, firstId, expected)).success, true);
        assert.ok((await save(mother, "15:00", "17:00", all, firstId, expected)).error);
      });
    });
    await t.test("別の家族・家族登録のないAuthアカウントからの閲覧と登録を拒否", async () => {
      for (const account of [other, stranger]) await asUser(account, async () => {
        assert.equal((await db.query("select * from public.schedules")).rows.length, 0);
        assert.equal((await db.query("select * from public.profiles where family_id=$1", [family])).rows.length, 0);
        await assert.rejects(db.query("insert into public.schedules(family_id,user_id,date,start_time,end_time,purpose) values ($1,$2,'2026-10-13','09:00','10:00','🛒 買い物')", [family, me]));
      });
    });
    await t.test("未ログインはテーブルと保存RPCへアクセスできない", async () => {
      await asUser("", async () => {
        await assert.rejects(db.query("select * from public.schedules"));
        await assert.rejects(db.query("select * from public.profiles"));
        await assert.rejects(save());
      }, "anon");
    });
    await t.test("自分のプロフィールだけ変更でき、家族ID変更や自己登録はできない", async () => {
      await asUser(me, async () => {
        assert.equal((await db.query("update public.profiles set name='私', avatar='🌷', color='#047857' where id=$1 returning id", [me])).rows.length, 1);
        assert.equal((await db.query("update public.profiles set name='改変' where id=$1 returning id", [mother])).rows.length, 0);
        await assert.rejects(db.query("update public.profiles set family_id=$1 where id=$2", [otherFamily, me]));
        await assert.rejects(db.query("update public.schedules set created_by=$1", [mother]));
        await assert.rejects(db.query("update public.schedules set family_id=$1", [otherFamily]));
        await assert.rejects(db.query("insert into public.schedules(family_id,user_id,date,start_time,end_time,purpose,created_by) values ($1,$2,'2026-10-13','09:00','10:00','🛒 買い物',$3)", [family, me, mother]));
      });
      await asUser(stranger, async () => {
        await assert.rejects(db.query("insert into public.profiles(id,family_id,name) values ($1,$2,'外部ユーザー')", [stranger, family]));
      });
    });
    await t.test("別の家族を使用者にする・不正な時間・無効な用途をDBでも拒否", async () => {
      await asUser(me, async () => {
        assert.ok((await save(other)).error);
        for (const [start, end, purpose] of [["18:00", "17:00", "🛒 買い物"], ["17:00", "17:00", "🛒 買い物"], ["09:00:30", "10:00", "🛒 買い物"], ["09:00", "10:00", "📦 その他："]]) {
          await assert.rejects(db.query("insert into public.schedules(family_id,user_id,date,start_time,end_time,purpose) values ($1,$2,'2026-10-13',$3,$4,$5)", [family, me, start, end, purpose]));
        }
        assert.equal((await save(me, "23:00", "24:00")).success, true);
      });
    });
    await t.test("使用者が自分以外でも作成者は削除できる", async () => {
      await asUser(me, async () => {
        assert.equal((await db.query("delete from public.schedules where id=$1 returning id", [firstId])).rows.length, 1);
      });
    });
  } finally { await db.close(); }
});
