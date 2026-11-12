"use client";

import { Camera, Trash2 } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { Avatar, Button, Card, Field, Input, Notice, PageHeader, Select } from "@/components/ui";
import { errorMessage, supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";

export default function ProfilePage() {
  const { profile, session, refreshProfile, signOut } = useAuth();
  const p = profile!;
  const [form, setForm] = useState({ full_name: p.full_name, username: p.username, grade: p.grade ? String(p.grade) : "", leaderboard_visible: p.leaderboard_visible });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [password, setPassword] = useState("");
  const [pwMsg, setPwMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(form.username)) return setMsg({ tone: "bad", text: "Nama pengguna 3–20 karakter: huruf, angka, atau garis bawah." });
    setBusy(true);
    setMsg(null);
    const { error } = await supabase().from("profiles").update({
      full_name: form.full_name.trim(), username: form.username, grade: form.grade ? Number(form.grade) : null, leaderboard_visible: form.leaderboard_visible,
    }).eq("id", p.id);
    setBusy(false);
    if (error) return setMsg({ tone: "bad", text: errorMessage(error) });
    await refreshProfile();
    setMsg({ tone: "good", text: "Profil tersimpan." });
  };

  const upload = async (f: File | undefined) => {
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) return setMsg({ tone: "bad", text: "Gunakan gambar PNG, JPG, atau WebP." });
    if (f.size > 1024 * 1024) return setMsg({ tone: "bad", text: "Ukuran foto maksimal 1 MB." });
    setUploading(true);
    setMsg(null);
    const path = `${p.id}/avatar-${Date.now()}.${f.type.split("/")[1]}`;
    const { error } = await supabase().storage.from("avatars").upload(path, f, { upsert: true, contentType: f.type });
    if (!error) {
      const url = supabase().storage.from("avatars").getPublicUrl(path).data.publicUrl;
      await supabase().from("profiles").update({ avatar_url: url }).eq("id", p.id);
      await refreshProfile();
    } else setMsg({ tone: "bad", text: errorMessage(error) });
    setUploading(false);
  };

  const removePhoto = async () => {
    await supabase().from("profiles").update({ avatar_url: null }).eq("id", p.id);
    await refreshProfile();
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setPwMsg({ tone: "bad", text: "Kata sandi minimal 8 karakter." });
    setPwBusy(true);
    const { error } = await supabase().auth.updateUser({ password });
    setPwBusy(false);
    setPwMsg(error ? { tone: "bad", text: errorMessage(error) } : { tone: "good", text: "Kata sandi diperbarui." });
    if (!error) setPassword("");
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profil" description={`Bergabung ${formatDate(p.created_at)} · ${session?.user.email ?? ""}`} />
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <Avatar url={p.avatar_url} name={p.username} size={72} />
          <div className="flex flex-wrap gap-2">
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            <Button variant="secondary" size="sm" loading={uploading} onClick={() => file.current?.click()}><Camera className="size-4" />Ganti foto</Button>
            {p.avatar_url && <Button variant="ghost" size="sm" onClick={removePhoto}><Trash2 className="size-4" />Hapus</Button>}
          </div>
        </div>
        <form onSubmit={save} className="mt-6 space-y-4">
          <Field label="Nama lengkap"><Input value={form.full_name} maxLength={80} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama pengguna" hint="Nama ini yang tampil di papan peringkat."><Input value={form.username} maxLength={20} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
            <Field label="Kelas">
              <Select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                <option value="">Belum dipilih</option><option value="7">Kelas 7</option><option value="8">Kelas 8</option><option value="9">Kelas 9</option>
              </Select>
            </Field>
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-line p-3.5">
            <input type="checkbox" checked={form.leaderboard_visible} onChange={(e) => setForm({ ...form, leaderboard_visible: e.target.checked })} className="mt-0.5 size-4 accent-brand-600" />
            <span><span className="block text-sm font-semibold text-ink">Tampilkan saya di papan peringkat</span><span className="block text-xs text-muted">Jika dimatikan, siswa lain tidak melihat nama pengguna, foto, maupun XP-mu.</span></span>
          </label>
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          <Button type="submit" loading={busy}>Simpan perubahan</Button>
        </form>
      </Card>

      <Card className="mt-4 p-5 sm:p-6">
        <h2 className="font-bold text-navy-900">Ganti kata sandi</h2>
        <form onSubmit={changePassword} className="mt-4 space-y-4">
          <Field label="Kata sandi baru" hint="Minimal 8 karakter."><Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          {pwMsg && <Notice tone={pwMsg.tone}>{pwMsg.text}</Notice>}
          <Button type="submit" variant="secondary" loading={pwBusy} disabled={!password}>Perbarui kata sandi</Button>
        </form>
      </Card>

      <Button variant="ghost" className="mt-4" onClick={signOut}>Keluar dari akun</Button>
    </div>
  );
}
