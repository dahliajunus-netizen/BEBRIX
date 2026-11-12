# BEBRIX

Platform latihan berpikir komputasional untuk siswa SMP (kelas 7–9) yang bersiap mengikuti Tantangan Bebras. Berisi bank soal asli Tantangan Bebras Indonesia kategori Penggalang 2016–2020, enam modul belajar, mesin latihan interaktif, simulasi kompetisi berwaktu, analitik, XP dan pencapaian, papan peringkat, serta dasbor admin.

Dibangun dengan Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase (Postgres, Auth, Storage), dan Recharts.

## Menjalankan

```bash
npm install
cp .env.example .env.local   # isi URL dan publishable key Supabase
npm run dev
```

Buka http://localhost:3000.

## Menyiapkan Supabase

1. Buat proyek Supabase, lalu jalankan berkas di `supabase/migrations/` secara berurutan (SQL Editor atau `supabase db push`).
2. Isi `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (aman untuk peramban).
   - `SUPABASE_SERVICE_ROLE_KEY` hanya untuk `npm run seed`. Jangan diberi awalan `NEXT_PUBLIC_` dan jangan di-commit.
3. Muat bank soal: `npm run seed`.
4. Daftar lewat `/daftar`, lalu jadikan akunmu admin di SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where username = 'nama_penggunamu';
   ```
5. Di Supabase → Authentication → URL Configuration, tambahkan alamat situs dan `/atur-ulang-sandi` sebagai redirect URL (dipakai pemulihan kata sandi).

## Bank soal dan keasliannya

Sumber: lima buku resmi Tantangan Bebras Indonesia kategori Penggalang (2016–2020). Buku-buku itu berlisensi CC BY-NC-SA 4.0 dan soal-soalnya CC BY-SA; BEBRIX memakainya secara non-komersial dan menampilkan sumber, tahun, kode soal, serta lisensi pada setiap soal.

- `npm run extract -- "buku.pdf" 2020` membaca satu buku: teks, pilihan, pembahasan, dan diagram (dipotong dari halaman PDF ke `public/soal/<tahun>/`). Hasil mentah ada di `data/extracted/`.
- `data/overrides.json` berisi koreksi manual. Setiap kunci jawaban di sana dibaca dari buku sumber.
- `npm run bank` menggabungkan keduanya menjadi `data/bank.json`.

Dari 94 soal, 91 memiliki kunci terverifikasi dan berstatus terbit. Tiga soal berstatus "perlu ditinjau" dan tidak terlihat oleh siswa:

| Soal | Alasan |
| --- | --- |
| 2017-05 Pedang dan Perisai | Soal menjodohkan; kunci hanya berupa gambar. |
| 2017-07 Pesta Ulang Tahun | Buku tidak menuliskan kunci secara eksplisit (usulan: D dan F). |
| 2018-15 Berbagi Kamar | Soal seret-lepas; kunci hanya berupa gambar. |

Aturan yang dijaga basis data: soal tidak bisa diterbitkan tanpa kunci terverifikasi, dan impor lewat dasbor admin selalu masuk sebagai "perlu ditinjau".

Topik dan tingkat kesulitan tiap soal adalah klasifikasi editorial BEBRIX, bukan dari buku. Materi modul belajar dan latihan terbimbing adalah konten orisinal BEBRIX dan selalu diberi label demikian.

Ekstraksi PDF berjalan lewat baris perintah, bukan di peramban. Dasbor admin menerima `bank.json` hasilnya, lalu admin meninjau, memperbaiki, dan menerbitkan soal satu per satu.

## Keamanan

- Kunci jawaban ada di tabel `question_keys` yang tidak bisa dibaca siswa. Jawaban diperiksa oleh fungsi `submit_answer` di basis data, yang baru mengembalikan kunci dan pembahasan setelah jawaban tersimpan.
- Semua tabel memakai Row Level Security: siswa hanya membaca datanya sendiri. Siswa lain hanya terlihat lewat `leaderboard()` (nama pengguna, foto, kelas, XP) dan bisa menyembunyikan diri.
- XP dicatat di `xp_events` dengan kunci unik per (siswa, alasan, rujukan), sehingga setiap hadiah hanya bisa diklaim sekali. XP penuh hanya untuk jawaban benar pada percobaan pertama.
- Siswa tidak bisa mengubah `role`, `xp`, runtun, atau status aksesnya sendiri.
- Simulasi kompetisi: soal dipilih di server, tenggat memakai jam server, penyimpanan ditolak setelah waktu habis, dan pengumpulan bersifat idempoten.

## Struktur

```
src/app/            halaman (landing, auth, dan area siswa di (app)/)
src/components/     UI, mesin soal (question/), admin
src/content/        modul belajar, demo interaktif, catatan belajar
src/lib/            klien Supabase, tipe, utilitas
supabase/migrations skema, RLS, fungsi, data rujukan
scripts/extract/    ekstraksi PDF dan penyusun bank soal
data/               hasil ekstraksi, koreksi manual, bank soal
public/soal/        diagram soal
```

BEBRIX adalah platform latihan independen dan tidak berafiliasi dengan Bebras Indonesia. Soal historis © Bebras – International Challenge on Informatics and Computational Thinking, diterjemahkan oleh Bebras Indonesia (bebras.or.id).
