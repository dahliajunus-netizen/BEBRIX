"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ConfigNotice } from "./app-shell";
import { useAuth } from "./auth-provider";
import { Logo } from "./logo";
import { Button, Card, Field, Input, Notice, Select } from "./ui";
import { errorMessage, isConfigured, supabase } from "@/lib/supabase";

function AuthFrame({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-6"><Logo /></Link>
      <Card className="w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-navy-900">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
        {!isConfigured && <div className="mt-4"><ConfigNotice /></div>}
        <div className="mt-6">{children}</div>
      </Card>
      {footer && <p className="mt-5 text-sm text-muted">{footer}</p>}
    </div>
  );
}

const link = "font-semibold text-brand-700 hover:underline";

/** Only same-site paths are accepted as a post-login destination. */
function safeNext(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dasbor";
}

export function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("lanjut"));
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) router.replace(next);
  }, [session, next, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError(errorMessage(error));
    setBusy(false);
  };

  return (
    <AuthFrame title="Masuk" subtitle="Lanjutkan latihanmu di BEBRIX." footer={<>Belum punya akun? <Link href="/daftar" className={link}>Daftar gratis</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Kata sandi"><Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {error && <Notice tone="bad">{error}</Notice>}
        <Button type="submit" loading={busy} disabled={!isConfigured} className="w-full" size="lg">Masuk</Button>
        <p className="text-center text-sm"><Link href="/lupa-sandi" className={link}>Lupa kata sandi?</Link></p>
      </form>
    </AuthFrame>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const { session } = useAuth();
  const [form, setForm] = useState({ full_name: "", username: "", grade: "7", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const usernameOk = /^[a-zA-Z0-9_]{3,20}$/.test(form.username);

  useEffect(() => {
    if (session) router.replace("/dasbor");
  }, [session, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!usernameOk) return setError("Nama pengguna 3–20 karakter: huruf, angka, atau garis bawah.");
    if (form.password.length < 8) return setError("Kata sandi minimal 8 karakter.");
    setBusy(true);
    setError(null);
    const { data, error } = await supabase().auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { full_name: form.full_name.trim(), username: form.username, grade: form.grade },
        emailRedirectTo: `${window.location.origin}/dasbor`,
      },
    });
    if (error) setError(errorMessage(error));
    else if (!data.session) setSent(true); // email confirmation is switched on in Supabase
    setBusy(false);
  };

  if (sent)
    return (
      <AuthFrame title="Periksa emailmu" subtitle={`Kami mengirim tautan konfirmasi ke ${form.email}.`} footer={<Link href="/masuk" className={link}>Kembali ke halaman masuk</Link>}>
        <Notice tone="good" title="Pendaftaran berhasil">Buka tautan di email untuk mengaktifkan akun, lalu masuk.</Notice>
      </AuthFrame>
    );

  return (
    <AuthFrame title="Buat akun siswa" subtitle="Gratis. Kemajuan belajarmu tersimpan di akun ini." footer={<>Sudah punya akun? <Link href="/masuk" className={link}>Masuk</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nama lengkap"><Input required maxLength={80} autoComplete="name" value={form.full_name} onChange={set("full_name")} /></Field>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Nama pengguna" hint="Tampil di papan peringkat."><Input required maxLength={20} autoComplete="username" value={form.username} onChange={set("username")} /></Field>
          <Field label="Kelas">
            <Select value={form.grade} onChange={set("grade")} className="w-24">
              <option value="7">7</option><option value="8">8</option><option value="9">9</option>
            </Select>
          </Field>
        </div>
        <Field label="Email"><Input type="email" required autoComplete="email" value={form.email} onChange={set("email")} /></Field>
        <Field label="Kata sandi" hint="Minimal 8 karakter."><Input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set("password")} /></Field>
        {error && <Notice tone="bad">{error}</Notice>}
        <Button type="submit" loading={busy} disabled={!isConfigured} className="w-full" size="lg">Daftar</Button>
      </form>
    </AuthFrame>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/atur-ulang-sandi` });
    if (error) setError(errorMessage(error));
    else setSent(true);
    setBusy(false);
  };
  return (
    <AuthFrame title="Lupa kata sandi" subtitle="Masukkan email akunmu. Kami akan mengirim tautan untuk membuat kata sandi baru." footer={<Link href="/masuk" className={link}>Kembali ke halaman masuk</Link>}>
      {sent ? (
        <Notice tone="good" title="Tautan terkirim">Jika email tersebut terdaftar, tautan atur ulang sudah dikirim. Periksa juga folder spam.</Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email"><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          {error && <Notice tone="bad">{error}</Notice>}
          <Button type="submit" loading={busy} disabled={!isConfigured} className="w-full" size="lg">Kirim tautan</Button>
        </form>
      )}
    </AuthFrame>
  );
}

export function ResetForm() {
  const router = useRouter();
  const { session } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError("Kata sandi minimal 8 karakter.");
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.updateUser({ password });
    if (error) setError(errorMessage(error));
    else router.replace("/dasbor");
    setBusy(false);
  };
  return (
    <AuthFrame title="Kata sandi baru" subtitle="Buat kata sandi baru untuk akunmu.">
      {session === null ? (
        <Notice tone="warn" title="Tautan tidak berlaku">Tautan atur ulang sudah kedaluwarsa atau tidak valid. <Link href="/lupa-sandi" className={link}>Minta tautan baru</Link>.</Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Kata sandi baru" hint="Minimal 8 karakter."><Input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          {error && <Notice tone="bad">{error}</Notice>}
          <Button type="submit" loading={busy} disabled={!session} className="w-full" size="lg">Simpan kata sandi</Button>
        </form>
      )}
    </AuthFrame>
  );
}
