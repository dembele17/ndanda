"use client";
import { useState, useTransition } from "react";
import { AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { deleteSchedule } from "@/app/actions";
import { dateLabel, timeLabel } from "@/lib/calendar";
import type { Profile, Schedule } from "@/lib/types";
import { Modal } from "@/components/ui/modal";

export function ScheduleDetail({ schedule, member, canEdit, overlapping, onClose, onEdit, onDeleted }: { schedule: Schedule; member: Profile; canEdit: boolean; overlapping: boolean; onClose: () => void; onEdit: () => void; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function remove() {
    startTransition(async () => {
      try {
        const result = await deleteSchedule(schedule.id);
        if (result.success) onDeleted();
        else setError(result.error ?? "削除できませんでした。");
      } catch { setError("通信に失敗しました。ネットワークを確認してください。"); }
    });
  }
  return <Modal title="予定の詳細" onClose={onClose} busy={pending}><div className="detail-person" style={{ borderColor: member.color }}><span className="avatar large" style={{ background: `${member.color}15` }}>{member.avatar}</span><div><small>使用者</small><h3 style={{ color: member.color }}>{member.name}</h3></div></div><p className="detail-date">{dateLabel(schedule.date, { year: "numeric" })}</p><p className="detail-time">{timeLabel(schedule.start_time)}<span>〜</span>{timeLabel(schedule.end_time)}</p><dl className="detail-list"><div><dt>用途</dt><dd>{schedule.purpose}</dd></div><div><dt>メモ</dt><dd className="whitespace-pre-wrap">{schedule.memo || "メモはありません"}</dd></div></dl>{overlapping && <div className="notice warning"><AlertTriangle size={18} /><span>この時間帯には、ほかの予定もあります。家族同士で調整してください。</span></div>}{error && <p className="notice error" role="alert">{error}</p>}{canEdit ? confirm ? <div className="delete-confirm"><p>この予定を削除しますか？</p><div className="modal-actions"><button className="button secondary" disabled={pending} onClick={() => setConfirm(false)}>戻る</button><button className="button danger" disabled={pending} onClick={remove}>{pending ? "削除中…" : "削除する"}</button></div></div> : <div className="modal-actions"><button className="button danger-outline" onClick={() => setConfirm(true)}><Trash2 size={17} />削除</button><button className="button primary" onClick={onEdit}><Pencil size={17} />編集</button></div> : <p className="detail-note">この予定の編集・削除は、登録した家族が行えます。</p>}</Modal>;
}
