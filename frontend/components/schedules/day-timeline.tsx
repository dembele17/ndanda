import { AlertTriangle, ChevronRight, Plus } from "lucide-react";
import { dateLabel, dayTimeline, findOverlaps, minuteLabel, timeLabel } from "@/lib/calendar";
import type { Profile, Schedule } from "@/lib/types";

export function DayTimeline({ date, today, schedules, members, onDetail, onAdd }: { date: string; today: string; schedules: Schedule[]; members: Profile[]; onDetail: (schedule: Schedule) => void; onAdd: () => void }) {
  const items = dayTimeline(schedules);
  return <section className="panel timeline-panel"><header className="panel-heading"><div><span className="eyebrow">{date === today ? "TODAY'S PLANS" : "DAY'S PLANS"}</span><h2>{date === today ? "今日の車の予定" : dateLabel(date)}</h2><p>{date === today ? dateLabel(date) : "この日の予定と空き時間"}</p></div><span className="count-badge">{schedules.length}件</span></header>{schedules.length === 0 && <div className="empty-day"><span>☀️</span><strong>この日の予定はまだありません</strong><p>車を使う予定が決まったら、共有しましょう。</p></div>}<div className="timeline">{items.map((item, i) => {
    if (item.kind === "free") return <div key={`free-${i}`} className="free-slot"><span className="timeline-marker free-marker" /><span className="free-dot" aria-hidden="true" /><strong>空き</strong><span>{minuteLabel(item.start)}〜{minuteLabel(item.end)}</span></div>;
    const s = item.schedule, member = members.find(m => m.id === s.user_id);
    if (!member) return null;
    const overlapping = findOverlaps(s, schedules, s.id).length > 0;
    return <div className="timeline-entry" key={s.id}><span className="timeline-marker" style={{ background: member.color }} /><button className="schedule-card" onClick={() => onDetail(s)} style={{ borderLeftColor: member.color }}><div className="schedule-top"><span className="schedule-time">{timeLabel(s.start_time)}<span>〜</span>{timeLabel(s.end_time)}</span>{overlapping && <span className="overlap-badge"><AlertTriangle size={13} />重複</span>}</div><div className="schedule-bottom"><span className="avatar" style={{ background: `${member.color}15` }}>{member.avatar}</span><span className="schedule-person" style={{ color: member.color }}>{member.name}</span><span className="schedule-purpose">{s.purpose}</span><ChevronRight size={16} className="muted shrink-0" /></div>{s.memo && <p className="schedule-memo">{s.memo}</p>}</button></div>;
  })}</div><button className="timeline-add" onClick={onAdd}><Plus size={18} />この日に予定を追加</button></section>;
}
