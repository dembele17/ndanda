"use client";
import { useRef, useState, useTransition } from "react";
import { AlertTriangle, Plus, Check } from "lucide-react";
import { saveSchedule } from "@/app/actions";
import { PURPOSES, timeLabel, validateSchedule } from "@/lib/calendar";
import type { FieldErrors, Profile, Schedule, ScheduleInput } from "@/lib/types";
import { Modal } from "@/components/ui/modal";

export function ScheduleForm({ members, profile, date, schedule, onClose, onSaved }: {
  members: Profile[]; profile: Profile; date: string; schedule?: Schedule; onClose: () => void; onSaved: (date: string) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [input, setInput] = useState<ScheduleInput>({ user_id: schedule?.user_id ?? profile.id, date: schedule?.date ?? date, start_time: schedule ? timeLabel(schedule.start_time) : "09:00", end_time: schedule ? timeLabel(schedule.end_time) : "10:00", purpose: schedule?.purpose ?? PURPOSES[0], memo: schedule?.memo ?? "" });
  const [purposeChoice, setPurposeChoice] = useState(schedule?.purpose.startsWith("📦 その他：") ? PURPOSES[7] : schedule?.purpose ?? PURPOSES[0]);
  const [otherPurpose, setOtherPurpose] = useState(schedule?.purpose.startsWith("📦 その他：") ? schedule.purpose.slice("📦 その他：".length) : "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [conflicts, setConflicts] = useState<Schedule[]>([]);
  const [pending, startTransition] = useTransition();
  function change<K extends keyof ScheduleInput>(field: K, value: ScheduleInput[K]) {
    setInput(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined }));
    setConflicts([]); setError("");
  }
  function submit(acknowledgedIds: string[] = []) {
    const fieldErrors = validateSchedule(input);
    setErrors(fieldErrors); setError("");
    if (Object.keys(fieldErrors).length) { setError("入力内容を確認してください。"); return; }
    const form = new FormData(formRef.current!);
    startTransition(async () => {
      try {
        const result = await saveSchedule(form, acknowledgedIds);
        if (result.success) onSaved(input.date);
        else if (result.conflicts) { setConflicts(result.conflicts); }
        else { setErrors(result.fieldErrors ?? {}); setError(result.error ?? "予定を保存できませんでした。"); }
      } catch { setError("通信に失敗しました。ネットワークを確認して、もう一度お試しください。"); }
    });
  }
  function fieldError(field: keyof ScheduleInput) { return errors[field] ? <span className="field-error" id={`${field}-error`}>{errors[field]}</span> : null; }
  function invalid(field: keyof ScheduleInput) { return { "aria-invalid": Boolean(errors[field]), "aria-describedby": errors[field] ? `${field}-error` : undefined }; }
  return <Modal title={schedule ? "予定を編集" : "車の予定を追加"} onClose={onClose} busy={pending}><p className="modal-description">誰が、いつ、何のために使うかを家族に共有します。</p><form ref={formRef} onSubmit={event => { event.preventDefault(); submit(); }} noValidate><fieldset disabled={pending}>
    {schedule && <><input type="hidden" name="id" value={schedule.id} /><input type="hidden" name="updated_at" value={schedule.updated_at} /></>}
    <label className="field"><span>使用者 <em>必須</em></span><select name="user_id" value={input.user_id} onChange={e => change("user_id", e.target.value)} {...invalid("user_id")} required><option value="">使用者を選択</option>{members.map(member => <option value={member.id} key={member.id}>{member.avatar} {member.name}</option>)}</select>{fieldError("user_id")}</label>
    <label className="field"><span>日付 <em>必須</em></span><input name="date" type="date" value={input.date} min="1900-01-01" max="9998-12-31" onChange={e => change("date", e.target.value)} {...invalid("date")} required />{fieldError("date")}</label>
    <div className="field-row"><label className="field"><span>開始時間 <em>必須</em></span><input name="start_time" type="time" step="60" value={input.start_time} onChange={e => change("start_time", e.target.value)} {...invalid("start_time")} required />{fieldError("start_time")}</label><label className="field"><span>終了時間 <em>必須</em></span><input type="time" step="60" value={input.end_time === "24:00" ? "" : input.end_time} disabled={input.end_time === "24:00" || pending} onChange={e => change("end_time", e.target.value)} {...invalid("end_time")} required={input.end_time !== "24:00"} />{fieldError("end_time")}</label></div>
    <input type="hidden" name="end_time" value={input.end_time} /><label className="checkbox-field"><input type="checkbox" checked={input.end_time === "24:00"} onChange={e => change("end_time", e.target.checked ? "24:00" : "23:00")} />終了時間を24:00（この日の終わり）にする</label>
    <label className="field"><span>用途 <em>必須</em></span><select value={purposeChoice} onChange={e => { setPurposeChoice(e.target.value); change("purpose", e.target.value === PURPOSES[7] ? `📦 その他：${otherPurpose.trim()}` : e.target.value); }} {...invalid("purpose")} required>{PURPOSES.map(purpose => <option key={purpose} value={purpose}>{purpose}</option>)}</select></label>
    {purposeChoice === PURPOSES[7] && <label className="field"><span>その他の用途 <em>必須</em></span><input value={otherPurpose} maxLength={93} onChange={e => { setOtherPurpose(e.target.value); change("purpose", `📦 その他：${e.target.value.trim()}`); }} placeholder="例：友達を駅まで送迎" {...invalid("purpose")} required /></label>}{fieldError("purpose")}<input type="hidden" name="purpose" value={input.purpose} />
    <label className="field"><span>メモ <small>任意</small></span><textarea name="memo" rows={3} maxLength={1000} value={input.memo} onChange={e => change("memo", e.target.value)} placeholder="行き先や家族に伝えたいこと" {...invalid("memo")} />{fieldError("memo")}</label>
    {conflicts.length > 0 && <div className="conflict-warning" role="alert"><h3><AlertTriangle size={20} />予定が重なっています</h3><p>{input.date.replaceAll("-", "/")} のこの時間帯に別の予定があります。</p><div className="conflict-list">{conflicts.map(conflict => { const member = members.find(m => m.id === conflict.user_id); return <div key={conflict.id}><strong>{member?.avatar} {member?.name}</strong><span>{timeLabel(conflict.start_time)}〜{timeLabel(conflict.end_time)}</span><span>{conflict.purpose}</span></div>; })}</div><p className="your-plan"><strong>今回の予定</strong><br />{members.find(m => m.id === input.user_id)?.avatar} {members.find(m => m.id === input.user_id)?.name} · {input.start_time}〜{input.end_time}<br />{input.purpose}</p><p>予定はそのまま登録できます。どちらの予定を優先するかは、家族同士で相談してください。</p></div>}
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="modal-actions">{conflicts.length > 0 ? <><button type="button" className="button secondary" onClick={onClose}>キャンセル</button><button type="button" className="button amber" onClick={() => submit(conflicts.map(s => s.id))}>{pending ? "保存中…" : "それでも登録する"}</button></> : <><button type="button" className="button secondary" onClick={onClose}>キャンセル</button><button className="button primary" type="submit">{schedule ? <Check size={18} /> : <Plus size={18} />}{pending ? "保存中…" : schedule ? "変更を保存" : "予定を追加"}</button></>}</div>
  </fieldset></form></Modal>;
}
