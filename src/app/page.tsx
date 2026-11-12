import { ArrowRight, BarChart3, BookOpenCheck, Boxes, Braces, Database, Flag, Layers, Library, Network, Shapes, Timer } from "lucide-react";
import Link from "next/link";
import { LandingStats, LandingCta } from "@/components/landing-client";
import { Logo } from "@/components/logo";
import { ButtonLink, Card } from "@/components/ui";

const MODULES = [
  { icon: Boxes, name: "Dekomposisi", text: "Memecah persoalan besar menjadi bagian kecil yang bisa diselesaikan satu per satu." },
  { icon: Shapes, name: "Pengenalan Pola", text: "Menemukan keteraturan dan hubungan untuk memprediksi langkah berikutnya." },
  { icon: Layers, name: "Abstraksi", text: "Memilih informasi yang penting dan mengabaikan detail yang mengganggu." },
  { icon: Braces, name: "Algoritma", text: "Menyusun dan menelusuri langkah-langkah yang runtut dan tepat." },
  { icon: Database, name: "Representasi Data", text: "Memahami cara informasi dikodekan, disusun, dan disimpan." },
  { icon: Network, name: "Penalaran Logis", text: "Menarik kesimpulan pasti dari fakta dan aturan yang diberikan." },
];

const FEATURES = [
  { icon: Library, title: "Bank soal historis", text: "Soal asli Tantangan Bebras Indonesia kategori Penggalang, lengkap dengan gambar, kunci, dan pembahasan dari buku resminya. Setiap soal mencantumkan tahun dan sumbernya." },
  { icon: BookOpenCheck, title: "Mesin latihan interaktif", text: "Latihan per topik, per tahun, per tingkat kesulitan, acak, atau fokus pada kelemahanmu. Jawaban diperiksa di server dan langsung dibahas." },
  { icon: Timer, title: "Simulasi kompetisi", text: "15 soal dalam 45 menit seperti babak Penggalang, dengan penghitung waktu, navigasi soal, tandai ragu-ragu, dan pengumpulan otomatis." },
  { icon: BarChart3, title: "Analitik kemajuan", text: "Akurasi per topik dan tingkat kesulitan, aktivitas harian, riwayat simulasi, serta rekomendasi yang dihitung dari jawabanmu sendiri." },
];

export default function Landing() {
  return (
    <div className="bg-surface">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/"><Logo /></Link>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-muted md:flex">
            <a href="#fitur" className="hover:text-navy-900">Fitur</a>
            <a href="#modul" className="hover:text-navy-900">Modul belajar</a>
            <a href="#bank-soal" className="hover:text-navy-900">Bank soal</a>
          </nav>
          <LandingCta compact />
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pb-24 lg:pt-20">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-cyan-600">Persiapan Tantangan Bebras · SMP kelas 7–9</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.1] text-navy-900 sm:text-5xl">
              Berlatih berpikir komputasional dengan soal Bebras yang sesungguhnya.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              BEBRIX mengumpulkan soal asli Tantangan Bebras Indonesia dari tahun-tahun sebelumnya, modul belajar enam keterampilan berpikir komputasional, dan simulasi kompetisi berwaktu dalam satu tempat latihan.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3"><LandingCta /></div>
            <LandingStats />
          </div>

          <Card className="p-5 sm:p-6" >
            <p className="text-xs font-bold uppercase tracking-wide text-faint">Contoh alur satu soal</p>
            <ol className="mt-4 space-y-4">
              {[
                ["Baca soal asli", "Teks, gambar, dan pilihan jawaban ditampilkan seperti di buku Bebras."],
                ["Jawab dan periksa", "Pilihan ganda, pilih beberapa, isian singkat, mengurutkan, hingga petak interaktif."],
                ["Pelajari pembahasan", "Kunci, pembahasan dari buku, dan konsep informatika di baliknya."],
                ["Lihat kemajuanmu", "XP, runtun harian, dan akurasi per topik diperbarui dari jawabanmu."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy-900 text-sm font-bold text-white">{i + 1}</span>
                  <span><span className="block font-semibold text-navy-900">{t}</span><span className="block text-sm text-muted">{d}</span></span>
                </li>
              ))}
            </ol>
          </Card>
        </section>

        <section id="fitur" className="border-y border-line bg-canvas py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl font-bold text-navy-900 sm:text-3xl">Semua yang dibutuhkan untuk bersiap</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <Card key={title} className="p-6">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon className="size-5" /></span>
                  <h3 className="mt-4 text-lg font-bold text-navy-900">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="modul" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold text-navy-900 sm:text-3xl">Enam modul berpikir komputasional</h2>
          <p className="mt-2 max-w-2xl text-muted">Setiap modul berisi penjelasan, ilustrasi, demonstrasi interaktif, latihan terbimbing, dan asesmen dari soal Bebras asli. Tujuannya melatih cara berpikir, bukan menghafal definisi.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map(({ icon: Icon, name, text }, i) => (
              <div key={name} className="rounded-2xl border border-line p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-navy-900 text-white"><Icon className="size-[18px]" /></span>
                  <span className="text-xs font-bold text-faint">MODUL {i + 1}</span>
                </div>
                <h3 className="mt-3 font-bold text-navy-900">{name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="bank-soal" className="bg-navy-900 py-16 text-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">Soal asli, sumber jelas</h2>
              <p className="mt-3 leading-relaxed text-white/75">
                Bank soal BEBRIX diambil dari buku resmi Tantangan Bebras Indonesia kategori Penggalang (SMP) tahun 2016 sampai 2020. Kunci jawaban dan pembahasan berasal dari buku yang sama. Soal yang belum terverifikasi tidak ditampilkan kepada siswa.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-white/60">
                Soal Bebras berlisensi Creative Commons (CC BY-SA / CC BY-NC-SA). BEBRIX menggunakannya untuk belajar, tanpa tujuan komersial, dengan mencantumkan sumber pada setiap soal.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [Flag, "Simulasi penuh", "15 soal · 45 menit · penilaian bisa diatur admin"],
                [Library, "Filter lengkap", "Tahun, topik, kesulitan, format, status pengerjaan"],
                [BookOpenCheck, "Pembahasan", "Ditampilkan setelah jawaban dikumpulkan"],
                [BarChart3, "Rekomendasi", "Dihitung dari data jawabanmu sendiri"],
              ].map(([Icon, t, d]) => {
                const I = Icon as typeof Flag;
                return (
                  <div key={t as string} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <I className="size-5 text-cyan-500" />
                    <p className="mt-2 font-semibold">{t as string}</p>
                    <p className="text-sm text-white/60">{d as string}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-navy-900 sm:text-3xl">Mulai dari satu soal hari ini</h2>
          <p className="mx-auto mt-2 max-w-lg text-muted">Buat akun gratis, pilih kelasmu, dan kerjakan tantangan harian pertamamu.</p>
          <ButtonLink href="/daftar" size="lg" className="mt-6">Mulai Berlatih <ArrowRight className="size-4" /></ButtonLink>
        </section>
      </main>

      <footer className="border-t border-line py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo />
          <p className="max-w-xl text-xs leading-relaxed text-faint">
            BEBRIX adalah platform latihan independen dan tidak berafiliasi dengan Bebras Indonesia. Soal historis © Bebras – International Challenge on Informatics and Computational Thinking, diterjemahkan oleh Bebras Indonesia (bebras.or.id).
          </p>
        </div>
      </footer>
    </div>
  );
}
