"use client";
import { useState, useTransition } from "react";
import { Check, LogOut, Users } from "lucide-react";
import { updateProfile } from "@/app/actions";
import { AVATARS, COLORS } from "@/lib/calendar";
import type { Profile } from "@/lib/types";

export function FamilySettings({ profile, members, onSaved, onLogout, logoutPending }: { profile: Profile; members: Profile[]; onSaved: () => void; onLogout: () => void; logoutPending: boolean }) {
  const [avatar, setAvatar] = useState(profile.avatar);
  const [color, setColor] = useState(profile.color);
  const [name, setName] = useState(profile.name);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function submit(form: FormData) {
    setError("");
    startTransition(async () => {
      try {
        const result = await updateProfile(form);
        if (result.success) onSaved();
        else setError(result.error ?? "設定を保存できませんでした。");
      } catch { setError("通信に失敗しました。ネットワークを確認してください。"); }
    });
  }
  return <div className="settings-grid"><section className="panel settings-panel"><header className="panel-heading"><div><span className="eyebrow">MY PROFILE</span><h2>自分のプロフィール</h2><p>カレンダーに表示する名前・アイコン・カラー</p></div></header><div className="profile-preview"><span className="avatar large" style={{ background: `${color}15` }}>{avatar}</span><strong style={{ color }}>{name || "名前"}</strong></div><form action={submit} noValidate><fieldset disabled={pending}><label className="field"><span>名前</span><input name="name" value={name} onChange={e => setName(e.target.value)} maxLength={30} required /></label><input type="hidden" name="avatar" value={avatar} /><input type="hidden" name="color" value={color} /><div className="field"><span id="avatar-label">アイコン</span><div className="avatar-choices" role="group" aria-labelledby="avatar-label">{AVATARS.map(icon => <button type="button" key={icon} aria-label={`アイコン ${icon}`} aria-pressed={avatar === icon} className={avatar === icon ? "chosen" : ""} onClick={() => setAvatar(icon)}>{icon}</button>)}</div></div><div className="field"><span id="color-label">カラー</span><div className="color-choices" role="group" aria-labelledby="color-label">{COLORS.map((value, index) => <button type="button" key={value} style={{ background: value }} aria-label={`${["青", "オレンジ", "紫", "ピンク", "緑", "水色"][index]}を選択`} aria-pressed={color === value} onClick={() => setColor(value)}>{color === value && <Check size={21} />}</button>)}</div></div>{error && <p className="notice error" role="alert">{error}</p>}<button className="button primary full" type="submit"><Check size={18} />{pending ? "保存中…" : "設定を保存"}</button></fieldset></form></section><div className="settings-side"><section className="panel family-members"><header className="panel-heading"><div><span className="eyebrow">OUR FAMILY</span><h2><Users size={21} />家族メンバー</h2></div><span className="count-badge">{members.length}人</span></header>{members.map(member => <div key={member.id} className="family-member"><span className="avatar" style={{ background: `${member.color}15` }}>{member.avatar}</span><strong style={{ color: member.color }}>{member.name}</strong>{member.id === profile.id && <span className="me-tag">あなた</span>}<i style={{ background: member.color }} /></div>)}<p className="muted text-sm mt-4">各メンバーが、自分のアカウントから表示設定を変更できます。</p></section><section className="sharing-note"><span>🤝</span><h3>家族で、気持ちよくシェア</h3><p>予定が重なっても、どちらも登録できます。<br />調整は家族のいつもの連絡方法で。</p></section><button className="button secondary full" onClick={onLogout} disabled={logoutPending}><LogOut size={17} />{logoutPending ? "ログアウト中…" : "ログアウト"}</button></div></div>;
}
