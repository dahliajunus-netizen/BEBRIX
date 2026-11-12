"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, BookOpen, Flag, GraduationCap, LayoutDashboard, Library, LogOut, Medal, Menu, ShieldCheck, Trophy, UserRound, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./auth-provider";
import { Logo } from "./logo";
import { Avatar, Button, Notice, Spinner } from "./ui";
import { isConfigured } from "@/lib/supabase";
import { cn, levelInfo } from "@/lib/utils";

const NAV = [
  { href: "/dasbor", label: "Dasbor", icon: LayoutDashboard },
  { href: "/latihan", label: "Latihan", icon: BookOpen },
  { href: "/belajar", label: "Belajar", icon: GraduationCap },
  { href: "/kompetisi", label: "Simulasi Kompetisi", icon: Flag },
  { href: "/bank-soal", label: "Bank Soal", icon: Library },
  { href: "/analitik", label: "Analitik", icon: BarChart3 },
  { href: "/papan-peringkat", label: "Papan Peringkat", icon: Trophy },
  { href: "/pencapaian", label: "Pencapaian", icon: Medal },
];

export function ConfigNotice() {
  return (
    <Notice tone="warn" title="Supabase belum dikonfigurasi">
      Salin <code className="font-mono">.env.example</code> menjadi <code className="font-mono">.env.local</code>, isi URL dan publishable key proyek Supabase, lalu jalankan ulang server. Langkah lengkap ada di README.
    </Notice>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { session, profile, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Competition attempts run full-screen without navigation, like the real contest.
  const focusMode = pathname.startsWith("/kompetisi/sesi");

  useEffect(() => {
    if (session === null && isConfigured) router.replace(`/masuk?lanjut=${encodeURIComponent(pathname)}`);
  }, [session, pathname, router]);
  useEffect(() => setOpen(false), [pathname]);

  if (!isConfigured) return <div className="mx-auto max-w-xl p-6"><ConfigNotice /></div>;
  if (!session || !profile) return <Spinner />;
  if (!profile.is_active)
    return (
      <div className="mx-auto max-w-md p-6">
        <Notice tone="bad" title="Akun dinonaktifkan">Akses akun ini sedang ditutup oleh admin.</Notice>
        <Button variant="secondary" className="mt-4" onClick={signOut}>Keluar</Button>
      </div>
    );
  if (focusMode) return <>{children}</>;

  const lv = levelInfo(profile.xp);
  const items = profile.role === "admin" ? [...NAV, { href: "/admin", label: "Admin", icon: ShieldCheck }] : NAV;
  const nav = (
    <nav className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold", active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white")}>
            <Icon className={cn("size-[18px]", active && "text-cyan-500")} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
  const account = (
    <div className="mt-auto border-t border-white/10 pt-4">
      <Link href="/profil" className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/5">
        <Avatar url={profile.avatar_url} name={profile.username} size={36} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-white">{profile.full_name || profile.username}</span>
          <span className="block text-xs text-white/60">Level {lv.level} · {profile.xp} XP</span>
        </span>
      </Link>
      <div className="mt-2 flex gap-1">
        <Link href="/profil" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-white/65 hover:bg-white/5 hover:text-white"><UserRound className="size-4" />Profil</Link>
        <button onClick={signOut} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-white/65 hover:bg-white/5 hover:text-white"><LogOut className="size-4" />Keluar</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy-900 p-4 lg:flex">
        <Link href="/dasbor" className="mb-6 px-2 pt-1"><Logo light /></Link>
        {nav}
        {account}
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
        <Link href="/dasbor"><Logo /></Link>
        <button onClick={() => setOpen(true)} aria-label="Buka menu" className="rounded-lg p-2 text-navy-900 hover:bg-canvas"><Menu className="size-5" /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-navy-900 p-4">
            <div className="mb-6 flex items-center justify-between px-2 pt-1">
              <Logo light />
              <button onClick={() => setOpen(false)} aria-label="Tutup menu" className="rounded-lg p-1.5 text-white/70 hover:bg-white/10"><X className="size-5" /></button>
            </div>
            {nav}
            {account}
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
