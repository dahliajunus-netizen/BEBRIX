import { Boxes, Braces, Database, Layers, Network, Shapes, type LucideIcon } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { AbstractionDemo, AlgorithmDemo, DataDemo, DecompositionDemo, LogicDemo, PatternDemo } from "./demos";

/**
 * Learning modules. All text, examples and guided exercises here are original BEBRIX
 * material (they are not Bebras questions and are never labelled as such). The assessment
 * step of every module uses authentic questions from the bank instead.
 */
export interface Exercise {
  prompt: string;
  options: string[];
  answer: number;
  hint: string;
  explain: string;
}

export interface LearningModule {
  slug: string;
  icon: LucideIcon;
  tagline: string;
  intro: string[];
  ideas: { title: string; text: string }[];
  illustration: ReactNode;
  example: { title: string; situation: string; steps: string[]; takeaway: string };
  Demo: ComponentType;
  demoTitle: string;
  exercises: Exercise[];
}

export const MODULE_ORDER = ["dekomposisi", "pola", "abstraksi", "algoritma", "representasi-data", "penalaran-logis"];

const box = (x: number, y: number, w: number, label: string, fill = "#ffffff", color = "#0b1f3a") => (
  <g key={`${x}-${y}`}>
    <rect x={x} y={y} width={w} height="34" rx="8" fill={fill} stroke="#c7d2e3" />
    <text x={x + w / 2} y={y + 22} textAnchor="middle" fontSize="12" fontWeight="600" fill={color}>{label}</text>
  </g>
);
const Svg = ({ label, children, h = 170 }: { label: string; children: ReactNode; h?: number }) => (
  <svg viewBox={`0 0 420 ${h}`} role="img" aria-label={label} className="w-full max-w-lg">{children}</svg>
);

export const MODULES: Record<string, LearningModule> = {
  dekomposisi: {
    slug: "dekomposisi",
    icon: Boxes,
    tagline: "Persoalan besar jarang diselesaikan sekaligus. Ia diselesaikan bagian demi bagian.",
    intro: [
      "Dekomposisi adalah kebiasaan memecah persoalan besar menjadi bagian-bagian kecil yang masing-masing cukup mudah untuk diselesaikan. Setelah semua bagian selesai, hasilnya digabungkan kembali menjadi jawaban utuh.",
      "Pada soal Bebras, dekomposisi muncul ketika sebuah soal tampak rumit: banyak aturan, banyak objek, atau banyak langkah. Pertanyaan pertama yang perlu kamu ajukan bukan “apa jawabannya?”, melainkan “bagian apa saja yang membentuk soal ini?”.",
    ],
    ideas: [
      { title: "Pecah", text: "Tuliskan bagian-bagian soal. Satu bagian sebaiknya hanya menjawab satu pertanyaan kecil." },
      { title: "Urutkan", text: "Tentukan bagian mana yang harus selesai lebih dulu dan mana yang bisa dikerjakan bersamaan." },
      { title: "Gabungkan", text: "Satukan hasil tiap bagian, lalu periksa apakah gabungannya menjawab pertanyaan awal." },
    ],
    illustration: (
      <Svg label="Satu persoalan besar dipecah menjadi tiga bagian, lalu digabung menjadi solusi">
        {box(140, 8, 140, "Persoalan besar", "#0b1f3a", "#ffffff")}
        {[30, 160, 290].map((x) => <line key={x} x1="210" y1="42" x2={x + 50} y2="72" stroke="#8492a8" strokeWidth="2" />)}
        {box(30, 72, 100, "Bagian 1")}{box(160, 72, 100, "Bagian 2")}{box(290, 72, 100, "Bagian 3")}
        {[30, 160, 290].map((x) => <line key={x} x1={x + 50} y1="106" x2="210" y2="132" stroke="#06b6d4" strokeWidth="2" />)}
        {box(150, 130, 120, "Solusi utuh", "#ecfbfe", "#0891b2")}
      </Svg>
    ),
    example: {
      title: "Menghitung biaya tamasya kelas",
      situation: "32 siswa akan bertamasya naik bus. Satu bus memuat 20 orang dan sewanya Rp600.000. Tiket masuk Rp15.000 per siswa. Berapa iuran tiap siswa?",
      steps: [
        "Bagian 1 — berapa bus? 32 siswa membutuhkan 2 bus, karena 1 bus hanya memuat 20.",
        "Bagian 2 — biaya bus: 2 × Rp600.000 = Rp1.200.000.",
        "Bagian 3 — biaya tiket: 32 × Rp15.000 = Rp480.000.",
        "Gabungkan: Rp1.200.000 + Rp480.000 = Rp1.680.000, dibagi 32 siswa = Rp52.500 per siswa.",
      ],
      takeaway: "Tidak ada satu langkah pun yang sulit. Yang membuat soal terasa sulit adalah mencoba menghitung semuanya sekaligus.",
    },
    Demo: DecompositionDemo,
    demoTitle: "Membagi kerja pentas seni",
    exercises: [
      {
        prompt: "Kamu diminta membuat jadwal piket kelas untuk satu bulan. Langkah mana yang paling tepat dilakukan pertama kali?",
        options: ["Langsung menulis nama untuk tanggal 1", "Mendaftar apa saja yang perlu diketahui: jumlah siswa, jumlah hari sekolah, dan tugas piket", "Menghias tabel jadwal agar menarik", "Meminta teman sebangku mengerjakannya"],
        answer: 1,
        hint: "Sebelum mengisi jadwal, bagian-bagian apa yang membentuk persoalan ini?",
        explain: "Dengan mendaftar bagian-bagiannya lebih dulu, kamu tahu berapa orang per hari dan berapa kali tiap siswa mendapat giliran. Mengisi tanggal demi tanggal tanpa itu mudah berakhir tidak adil.",
      },
      {
        prompt: "Sebuah robot harus mengecat pagar: mengampelas, mengecat dasar, lalu mengecat warna. Ada 3 ruas pagar dan dua robot. Pembagian mana yang membuat pekerjaan selesai paling cepat tanpa melanggar urutan?",
        options: ["Kedua robot mengampelas ruas yang sama", "Robot A mengerjakan ketiga langkah di ruas 1 sementara robot B diam", "Tiap robot mengerjakan ruas yang berbeda, masing-masing mengikuti urutan ampelas → dasar → warna", "Robot B mengecat warna lebih dulu selagi robot A mengampelas ruas yang sama"],
        answer: 2,
        hint: "Bagian mana yang saling bergantung, dan bagian mana yang bebas dikerjakan bersamaan?",
        explain: "Urutan hanya mengikat langkah dalam satu ruas. Antar-ruas tidak saling bergantung, jadi bisa dikerjakan bersamaan oleh robot yang berbeda.",
      },
      {
        prompt: "Untuk menghitung jumlah ubin sebuah lantai berbentuk huruf L, cara mana yang memakai dekomposisi?",
        options: ["Menghitung ubin satu per satu dari pojok", "Memecah bentuk L menjadi dua persegi panjang, menghitung masing-masing, lalu menjumlahkan", "Menebak dari ukuran ruangan lain", "Mengukur keliling lantai"],
        answer: 1,
        hint: "Bentuk L sulit dihitung langsung. Bentuk apa yang mudah dihitung?",
        explain: "Dua persegi panjang masing-masing dihitung dengan panjang × lebar, lalu dijumlahkan. Bentuk yang rumit menjadi dua bentuk yang sudah kamu kuasai.",
      },
    ],
  },

  pola: {
    slug: "pola",
    icon: Shapes,
    tagline: "Menemukan keteraturan berarti tidak perlu memeriksa semuanya satu per satu.",
    intro: [
      "Pengenalan pola adalah kemampuan melihat apa yang berulang, apa yang berubah secara teratur, dan apa yang sama di antara hal-hal yang tampak berbeda. Begitu polanya ditemukan, kamu bisa memprediksi kelanjutannya atau memakai cara yang sama untuk soal lain.",
      "Di soal Bebras, pola bisa berupa deretan gambar, aturan sandi, susunan manik-manik, atau cara sebuah mesin mengubah masukan menjadi keluaran. Kuncinya: jangan berhenti pada satu ciri. Periksa bentuk, warna, jumlah, dan posisi.",
    ],
    ideas: [
      { title: "Amati", text: "Catat ciri setiap unsur: bentuk, warna, ukuran, arah, jumlah." },
      { title: "Bandingkan", text: "Cari apa yang berulang dan apa yang berubah dari satu unsur ke unsur berikutnya." },
      { title: "Uji", text: "Rumuskan aturannya, lalu periksa apakah aturan itu cocok untuk semua unsur, bukan hanya dua yang pertama." },
    ],
    illustration: (
      <Svg label="Deretan bentuk dengan pola berulang setiap tiga" h={110}>
        {["●", "■", "▲", "●", "■", "▲", "●"].map((s, i) => (
          <g key={i}>
            <rect x={14 + i * 50} y="20" width="40" height="40" rx="8" fill={i % 3 === 0 ? "#f0f5ff" : "#ffffff"} stroke="#c7d2e3" />
            <text x={34 + i * 50} y="48" textAnchor="middle" fontSize="20" fill={["#2360e0", "#06b6d4", "#12305a"][i % 3]}>{s}</text>
          </g>
        ))}
        <rect x="364" y="20" width="40" height="40" rx="8" fill="none" stroke="#2360e0" strokeDasharray="5 4" strokeWidth="2" />
        <text x="384" y="47" textAnchor="middle" fontSize="18" fontWeight="700" fill="#2360e0">?</text>
        <path d="M14 76 h140 M164 76 h140" stroke="#06b6d4" strokeWidth="3" />
        <text x="84" y="96" textAnchor="middle" fontSize="11" fill="#586780">satu putaran</text>
        <text x="234" y="96" textAnchor="middle" fontSize="11" fill="#586780">berulang</text>
      </Svg>
    ),
    example: {
      title: "Membaca sandi geser",
      situation: "Sebuah pesan rahasia berbunyi CFCSBT. Diketahui kata BUKU ditulis sebagai CVLV dengan sandi yang sama.",
      steps: [
        "Bandingkan pasangan huruf: B→C, U→V, K→L, U→V.",
        "Polanya sama pada setiap pasangan: tiap huruf diganti huruf sesudahnya dalam alfabet.",
        "Uji pada huruf yang muncul dua kali: U selalu menjadi V. Aturan konsisten.",
        "Balikkan aturan untuk membaca pesan: C→B, F→E, C→B, S→R, B→A, T→S. Pesannya: BEBRAS.",
      ],
      takeaway: "Satu contoh cukup untuk menduga pola, tetapi pola baru boleh dipercaya setelah diuji pada semua data yang ada.",
    },
    Demo: PatternDemo,
    demoTitle: "Melanjutkan pola",
    exercises: [
      {
        prompt: "Deret bilangan: 2, 5, 10, 17, 26, … Bilangan berikutnya adalah?",
        options: ["33", "35", "37", "52"],
        answer: 2,
        hint: "Hitung selisih antarbilangan yang berurutan. Apakah selisihnya juga berpola?",
        explain: "Selisihnya 3, 5, 7, 9: selalu bertambah 2. Selisih berikutnya 11, sehingga 26 + 11 = 37.",
      },
      {
        prompt: "Sebuah mesin mengubah kata: KAKI → KKAI, BUKU → BKUU, MEJA → MJEA. Apa hasil untuk kata TOPI?",
        options: ["TPOI", "TOIP", "IPOT", "TIPO"],
        answer: 0,
        hint: "Perhatikan huruf mana yang tetap di tempatnya dan huruf mana yang bertukar.",
        explain: "Huruf pertama dan terakhir tetap; huruf kedua dan ketiga bertukar tempat. TOPI menjadi TPOI.",
      },
      {
        prompt: "Lampu hias menyala dengan urutan warna: merah, merah, biru, merah, merah, biru, … Apa warna lampu ke-20?",
        options: ["Merah", "Biru", "Bergantian, tidak bisa ditentukan", "Hijau"],
        answer: 0,
        hint: "Polanya berulang setiap berapa lampu? Lampu ke-20 jatuh pada posisi ke berapa dalam satu putaran?",
        explain: "Pola berulang setiap 3 lampu. 20 dibagi 3 bersisa 2, jadi lampu ke-20 sama dengan lampu ke-2 dalam putaran: merah.",
      },
    ],
  },

  abstraksi: {
    slug: "abstraksi",
    icon: Layers,
    tagline: "Cerita dalam soal bisa panjang. Informasi yang menentukan jawaban biasanya sedikit.",
    intro: [
      "Abstraksi adalah memilih informasi yang penting untuk menjawab sebuah pertanyaan dan mengabaikan sisanya. Hasilnya adalah model: gambaran sederhana dari persoalan, misalnya titik dan garis, tabel, atau daftar.",
      "Peta jalur kereta adalah contoh abstraksi sehari-hari. Peta itu tidak menunjukkan gedung, pohon, atau belokan rel yang sebenarnya, hanya stasiun dan sambungannya, karena hanya itu yang kamu perlukan untuk menentukan rute.",
    ],
    ideas: [
      { title: "Tanyakan tujuannya", text: "Informasi penting atau tidak bergantung pada pertanyaannya. Pertanyaan berbeda, model berbeda." },
      { title: "Buang detail", text: "Uji setiap informasi: jika dihapus, apakah jawabannya berubah? Jika tidak, abaikan." },
      { title: "Buat model", text: "Gambar ulang yang tersisa dalam bentuk paling sederhana: graf, tabel, atau urutan." },
    ],
    illustration: (
      <Svg label="Peta kota yang rumit disederhanakan menjadi graf titik dan garis" h={150}>
        <rect x="10" y="12" width="170" height="124" rx="12" fill="#f5f7fb" stroke="#c7d2e3" />
        <path d="M24 100 C60 40 90 120 160 46" fill="none" stroke="#8492a8" strokeWidth="5" />
        <path d="M40 34 C80 80 110 60 150 112" fill="none" stroke="#8492a8" strokeWidth="5" />
        {[[30, 96], [96, 76], [158, 48], [44, 36], [148, 110]].map(([x, y], i) => <rect key={i} x={x - 7} y={y - 7} width="14" height="14" rx="3" fill={["#f59e0b", "#ef4444", "#22c55e", "#8b5cf6", "#0ea5e9"][i]} />)}
        <text x="95" y="150" textAnchor="middle" fontSize="11" fill="#586780">Kenyataan: banyak detail</text>
        <path d="M190 74 h36 m-8 -7 l8 7 l-8 7" stroke="#2360e0" strokeWidth="2.5" fill="none" />
        <rect x="240" y="12" width="170" height="124" rx="12" fill="#ffffff" stroke="#c7d2e3" />
        {[[260, 96, 326, 76], [326, 76, 388, 48], [274, 36, 326, 76], [326, 76, 378, 110]].map(([a, b, c, d], i) => <line key={i} x1={a} y1={b} x2={c} y2={d} stroke="#12305a" strokeWidth="2" />)}
        {[[260, 96], [326, 76], [388, 48], [274, 36], [378, 110]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="7" fill="#12305a" />)}
        <text x="325" y="150" textAnchor="middle" fontSize="11" fill="#586780">Model: titik dan garis</text>
      </Svg>
    ),
    example: {
      title: "Siapa bisa mengirim pesan ke siapa",
      situation: "Lima sahabat tinggal di rumah berwarna-warni di bukit yang berbeda. Ali bisa berteriak ke Bima dan Cici. Bima bisa ke Dedi. Cici bisa ke Dedi dan Eka. Pesan dari Ali ke Eka paling sedikit melewati berapa orang perantara?",
      steps: [
        "Tujuannya: jumlah perantara paling sedikit. Warna rumah dan bentuk bukit tidak memengaruhi itu.",
        "Yang penting hanya: siapa terhubung ke siapa. Gambar lima titik (A, B, C, D, E) dan garis A–B, A–C, B–D, C–D, C–E.",
        "Pada gambar itu terlihat langsung jalurnya: A → C → E.",
        "Perantaranya hanya satu orang, yaitu Cici.",
      ],
      takeaway: "Setelah detail cerita dibuang, soal yang panjang menjadi gambar kecil yang jawabannya hampir terlihat sendiri.",
    },
    Demo: AbstractionDemo,
    demoTitle: "Memilih informasi yang perlu",
    exercises: [
      {
        prompt: "Kamu ingin tahu apakah semua buku pinjaman muat di satu rak. Informasi mana yang benar-benar diperlukan?",
        options: ["Judul dan pengarang setiap buku", "Tebal setiap buku dan panjang rak", "Warna sampul buku", "Tanggal buku dipinjam"],
        answer: 1,
        hint: "Informasi mana yang, jika berubah, mengubah jawaban “muat atau tidak”?",
        explain: "Muat atau tidaknya ditentukan oleh jumlah tebal buku dibanding panjang rak. Judul, warna, dan tanggal tidak mengubah jawaban.",
      },
      {
        prompt: "Peta rute bus kota biasanya menggambar jalur sebagai garis lurus berwarna dan halte sebagai titik. Mengapa belokan jalan yang sebenarnya tidak digambar?",
        options: ["Karena pembuat peta tidak tahu bentuk jalannya", "Karena penumpang hanya perlu tahu urutan halte dan tempat berpindah jalur", "Karena menggambar belokan itu dilarang", "Supaya peta terlihat lebih mahal"],
        answer: 1,
        hint: "Pertanyaan apa yang ingin dijawab penumpang dengan peta itu?",
        explain: "Penumpang ingin tahu naik jalur apa, turun di mana, dan pindah di mana. Bentuk belokan tidak membantu menjawabnya, jadi dihilangkan.",
      },
      {
        prompt: "Dalam sebuah turnamen, tiap tim bertanding satu kali dengan setiap tim lain. Model mana yang paling pas untuk menghitung jumlah pertandingan?",
        options: ["Foto semua pemain", "Titik untuk setiap tim dan satu garis untuk setiap pasangan tim", "Daftar warna kaus tim", "Peta lokasi lapangan"],
        answer: 1,
        hint: "Apa yang dihitung: tim, atau pasangan tim?",
        explain: "Satu pertandingan adalah satu pasangan tim, yaitu satu garis antara dua titik. Menghitung garis berarti menghitung pertandingan.",
      },
    ],
  },

  algoritma: {
    slug: "algoritma",
    icon: Braces,
    tagline: "Langkah yang jelas dan berurutan bisa dijalankan siapa saja, termasuk mesin.",
    intro: [
      "Algoritma adalah urutan langkah yang jelas untuk menyelesaikan sebuah tugas. Jelas artinya tidak ada langkah yang bisa ditafsirkan dua cara, dan berurutan artinya hasilnya bisa berbeda jika urutannya diubah.",
      "Banyak soal Bebras meminta kamu menjadi “komputer”: menjalankan perintah satu per satu dan mencatat apa yang terjadi. Soal lain meminta kamu menyusun langkahnya sendiri, sering kali dengan syarat tambahan seperti langkah paling sedikit.",
    ],
    ideas: [
      { title: "Telusuri", text: "Jalankan perintah satu per satu. Catat keadaan (posisi, isi, hitungan) setelah setiap langkah." },
      { title: "Perhatikan cabang dan ulang", text: "Kata “jika” memilih jalan; kata “ulangi” menjalankan langkah yang sama beberapa kali." },
      { title: "Bandingkan cara", text: "Dua algoritma bisa sama-sama benar. Yang lebih baik biasanya yang langkahnya lebih sedikit." },
    ],
    illustration: (
      <Svg label="Diagram alir sederhana: mulai, periksa syarat, ulangi, selesai" h={180}>
        {box(150, 6, 120, "Mulai", "#0b1f3a", "#ffffff")}
        <line x1="210" y1="40" x2="210" y2="58" stroke="#8492a8" strokeWidth="2" />
        <path d="M210 58 l70 28 l-70 28 l-70 -28 z" fill="#f0f5ff" stroke="#2360e0" />
        <text x="210" y="90" textAnchor="middle" fontSize="12" fontWeight="600" fill="#1a4fc4">Sudah sampai?</text>
        <text x="296" y="80" fontSize="11" fill="#586780">belum</text>
        <path d="M280 86 h50 v-52 h-60" fill="none" stroke="#8492a8" strokeWidth="2" />
        {box(300, 16, 104, "Maju satu langkah")}
        <text x="218" y="130" fontSize="11" fill="#586780">ya</text>
        <line x1="210" y1="114" x2="210" y2="138" stroke="#8492a8" strokeWidth="2" />
        {box(150, 138, 120, "Selesai", "#ecfbfe", "#0891b2")}
      </Svg>
    ),
    example: {
      title: "Menjalankan perintah mesin minuman",
      situation: "Sebuah mesin mengikuti aturan: (1) mulai dengan gelas kosong, (2) tuang 3 sendok sirup, (3) ulangi dua kali: tuang 100 ml air lalu aduk, (4) jika isi gelas lebih dari 150 ml, tambahkan es. Apa isi gelas di akhir?",
      steps: [
        "Setelah langkah 2: sirup 3 sendok, air 0 ml.",
        "Putaran pertama langkah 3: air 100 ml, diaduk.",
        "Putaran kedua langkah 3: air 200 ml, diaduk.",
        "Langkah 4: 200 ml lebih dari 150 ml, jadi es ditambahkan. Hasil: sirup, 200 ml air, dan es.",
      ],
      takeaway: "Kesalahan paling umum adalah lupa bahwa langkah yang diulang dijalankan seluruhnya pada setiap putaran. Mencatat keadaan setelah tiap langkah mencegahnya.",
    },
    Demo: AlgorithmDemo,
    demoTitle: "Memprogram robot",
    exercises: [
      {
        prompt: "Sebuah bilangan awalnya 4. Perintah: “Ulangi 3 kali: kalikan dengan 2, lalu kurangi 3.” Berapa hasil akhirnya?",
        options: ["5", "11", "23", "29"],
        answer: 1,
        hint: "Tulis nilai bilangan setelah setiap putaran: putaran 1, putaran 2, putaran 3.",
        explain: "Putaran 1: 4 × 2 − 3 = 5. Putaran 2: 5 × 2 − 3 = 7. Putaran 3: 7 × 2 − 3 = 11.",
      },
      {
        prompt: "Tumpukan piring dari atas ke bawah: Merah, Biru, Hijau. Perintah: ambil piring teratas dan letakkan di paling bawah, lakukan dua kali. Urutan dari atas ke bawah sekarang?",
        options: ["Merah, Biru, Hijau", "Biru, Hijau, Merah", "Hijau, Merah, Biru", "Hijau, Biru, Merah"],
        answer: 2,
        hint: "Kerjakan satu perpindahan dulu, tulis urutannya, baru lakukan perpindahan kedua.",
        explain: "Setelah perpindahan pertama: Biru, Hijau, Merah. Setelah perpindahan kedua: Hijau, Merah, Biru.",
      },
      {
        prompt: "Kamu mencari kata “kucing” dalam kamus 1.000 halaman yang tersusun menurut abjad. Cara mana yang membutuhkan paling sedikit langkah?",
        options: ["Membaca dari halaman 1 sampai ketemu", "Membuka tepat di tengah, lalu memilih separuh yang mungkin memuat katanya, dan mengulanginya", "Membuka halaman secara acak", "Membaca dari halaman terakhir ke depan"],
        answer: 1,
        hint: "Cara mana yang membuang paling banyak halaman pada setiap langkah?",
        explain: "Membagi dua berulang kali membuang separuh halaman setiap langkah, sehingga 1.000 halaman selesai dalam sekitar 10 langkah. Cara ini hanya bisa dipakai karena kamus terurut.",
      },
    ],
  },

  "representasi-data": {
    slug: "representasi-data",
    icon: Database,
    tagline: "Informasi yang sama bisa ditulis dengan banyak cara. Cara yang tepat membuat soal jadi mudah.",
    intro: [
      "Representasi data adalah cara informasi dituliskan dan disusun: sebagai kode, tabel, daftar, gambar, atau deretan 0 dan 1. Komputer hanya mengenal dua keadaan, jadi semua hal, dari angka sampai gambar, pada akhirnya diwakili oleh deretan bit.",
      "Soal Bebras tentang representasi data sering berupa sandi, kode bendera, kode kartu, tumpukan dan antrean, atau tabel. Yang diuji adalah apakah kamu bisa membaca aturan pengodean dengan teliti dan memilih susunan data yang membantu.",
    ],
    ideas: [
      { title: "Baca aturannya", text: "Setiap kode punya aturan. Pastikan kamu tahu arah bacanya dan arti tiap simbol." },
      { title: "Kode harus tidak ambigu", text: "Kode yang baik hanya bisa dibaca dengan satu arti. Periksa apakah ada dua pesan berbeda yang menghasilkan kode yang sama." },
      { title: "Susunan menentukan cara pakai", text: "Tumpukan mengeluarkan yang terakhir masuk; antrean mengeluarkan yang pertama masuk." },
    ],
    illustration: (
      <Svg label="Bilangan 13 ditulis sebagai kode biner 1101" h={130}>
        {[8, 4, 2, 1].map((w, i) => {
          const on = [1, 1, 0, 1][i];
          return (
            <g key={w}>
              <text x={84 + i * 70} y="18" textAnchor="middle" fontSize="12" fill="#586780">{w}</text>
              <rect x={56 + i * 70} y="26" width="56" height="56" rx="12" fill={on ? "#ecfbfe" : "#ffffff"} stroke={on ? "#06b6d4" : "#c7d2e3"} strokeWidth="2" />
              <circle cx={84 + i * 70} cy="54" r="12" fill={on ? "#06b6d4" : "#e2e8f1"} />
              <text x={84 + i * 70} y="104" textAnchor="middle" fontSize="18" fontWeight="700" fontFamily="monospace" fill="#0b1f3a">{on}</text>
            </g>
          );
        })}
        <text x="352" y="60" fontSize="14" fontWeight="700" fill="#0b1f3a">= 13</text>
        <text x="210" y="124" textAnchor="middle" fontSize="11" fill="#586780">8 + 4 + 1 = 13</text>
      </Svg>
    ),
    example: {
      title: "Kode yang bisa dibaca dua cara",
      situation: "Sebuah kode memakai: A = 0, B = 1, C = 01. Pesan terkirim: 0101. Apakah pesannya pasti satu kata?",
      steps: [
        "Coba baca per simbol: 0,1,0,1 menjadi A B A B.",
        "Coba cara lain: 01,01 menjadi C C. Ada juga 0,1,01 menjadi A B C.",
        "Satu deretan menghasilkan beberapa pesan berbeda, jadi kode ini ambigu.",
        "Penyebabnya: kode A (0) adalah awalan dari kode C (01). Kode yang aman tidak boleh punya kode yang menjadi awalan kode lain.",
      ],
      takeaway: "Saat menilai sebuah kode, jangan hanya memeriksa apakah pesan bisa dibaca. Periksa apakah pesan hanya bisa dibaca dengan satu cara.",
    },
    Demo: DataDemo,
    demoTitle: "Lampu biner",
    exercises: [
      {
        prompt: "Dengan 4 lampu yang masing-masing bisa menyala atau padam, berapa banyak pola berbeda yang bisa dibuat?",
        options: ["4", "8", "16", "32"],
        answer: 2,
        hint: "Satu lampu memberi 2 pola. Setiap lampu tambahan melipatgandakan jumlah pola.",
        explain: "Setiap lampu punya 2 keadaan, sehingga 2 × 2 × 2 × 2 = 16 pola berbeda.",
      },
      {
        prompt: "Buku ditumpuk satu per satu: Matematika, lalu IPA, lalu Bahasa, lalu Seni. Buku hanya bisa diambil dari atas. Buku mana yang terambil ketiga?",
        options: ["Matematika", "IPA", "Bahasa", "Seni"],
        answer: 1,
        hint: "Yang terakhir ditaruh berada paling atas. Urutkan pengambilan dari atas ke bawah.",
        explain: "Urutan pengambilan dari atas: Seni, Bahasa, IPA, Matematika. Yang ketiga adalah IPA.",
      },
      {
        prompt: "Gambar hitam-putih disimpan per baris sebagai banyaknya petak putih dan hitam bergantian, dimulai dari putih. Baris “2, 3, 1” berarti?",
        options: ["2 hitam, 3 putih, 1 hitam", "2 putih, 3 hitam, 1 putih", "6 petak putih", "3 putih, 2 hitam, 1 putih"],
        answer: 1,
        hint: "Aturannya dimulai dari putih, lalu bergantian.",
        explain: "Dimulai dari putih: 2 putih, kemudian 3 hitam, kemudian 1 putih. Cara ini meringkas baris 6 petak menjadi tiga angka.",
      },
    ],
  },

  "penalaran-logis": {
    slug: "penalaran-logis",
    icon: Network,
    tagline: "Jawaban yang pasti datang dari petunjuk, bukan dari tebakan.",
    intro: [
      "Penalaran logis adalah menarik kesimpulan yang pasti benar dari fakta dan aturan yang diberikan. Jika faktanya benar dan cara menalarnya benar, kesimpulannya tidak mungkin salah.",
      "Di soal Bebras, penalaran logis muncul sebagai teka-teki dengan syarat: siapa duduk di mana, benda mana yang paling berat, aturan mana yang dilanggar. Cara kerjanya selalu sama: pakai setiap petunjuk untuk mencoret kemungkinan, sampai hanya satu yang tersisa.",
    ],
    ideas: [
      { title: "Mulai dari yang pasti", text: "Cari petunjuk yang langsung menetapkan atau mencoret sesuatu. Itu pijakan pertamamu." },
      { title: "Coret kemungkinan", text: "Setiap petunjuk mengurangi pilihan. Catat dalam tabel agar tidak ada yang terlupa." },
      { title: "Perhatikan kata kunci", text: "“Semua”, “hanya”, “tidak”, “jika … maka”, dan “paling sedikit” mengubah arti sebuah aturan." },
    ],
    illustration: (
      <Svg label="Tabel logika: tanda silang mencoret kemungkinan sampai tersisa satu centang per baris" h={150}>
        {["Kucing", "Ikan", "Kelinci"].map((p, i) => <text key={p} x={170 + i * 70} y="22" textAnchor="middle" fontSize="12" fill="#586780">{p}</text>)}
        {["Ani", "Budi", "Citra"].map((k, r) => (
          <g key={k}>
            <text x="110" y={58 + r * 38} textAnchor="end" fontSize="12" fontWeight="600" fill="#0f1b2d">{k}</text>
            {[0, 1, 2].map((c) => {
              const yes = [1, 2, 0][r] === c;
              return (
                <g key={c}>
                  <rect x={144 + c * 70} y={36 + r * 38} width="52" height="32" rx="8" fill={yes ? "#e9f8f1" : "#f5f7fb"} stroke={yes ? "#0f8a5f" : "#c7d2e3"} />
                  <text x={170 + c * 70} y={58 + r * 38} textAnchor="middle" fontSize="15" fontWeight="700" fill={yes ? "#0f8a5f" : "#8492a8"}>{yes ? "✓" : "✕"}</text>
                </g>
              );
            })}
          </g>
        ))}
      </Svg>
    ),
    example: {
      title: "Mengurutkan dari perbandingan",
      situation: "Empat kotak A, B, C, D ditimbang berpasangan. Hasilnya: A lebih berat dari B. C lebih berat dari A. D lebih ringan dari B. Kotak mana yang paling berat?",
      steps: [
        "Tulis tiap fakta sebagai urutan: A > B, C > A, B > D.",
        "Sambungkan fakta yang memuat kotak yang sama: C > A dan A > B menjadi C > A > B.",
        "Tambahkan fakta terakhir: B > D, sehingga C > A > B > D.",
        "Kesimpulan pasti: C paling berat. Tidak ada fakta yang perlu ditebak.",
      ],
      takeaway: "Menyambung fakta-fakta kecil menjadi satu rantai memberi kesimpulan yang tidak tertulis di soal, tetapi pasti benar.",
    },
    Demo: LogicDemo,
    demoTitle: "Teka-teki tabel logika",
    exercises: [
      {
        prompt: "Aturan kelas: “Jika hujan, upacara diadakan di aula.” Hari ini upacara diadakan di lapangan. Apa yang pasti benar?",
        options: ["Hari ini hujan", "Hari ini tidak hujan", "Aula sedang diperbaiki", "Tidak ada yang bisa disimpulkan"],
        answer: 1,
        hint: "Andaikan hari ini hujan. Menurut aturan, di mana upacara seharusnya diadakan?",
        explain: "Jika hujan, upacara pasti di aula. Upacara tidak di aula, jadi tidak mungkin hujan. Kesimpulan ini pasti, bukan dugaan.",
      },
      {
        prompt: "Tiga anak berbaris. Dita tidak di depan. Eko tepat di belakang Fani. Siapa yang paling depan?",
        options: ["Dita", "Eko", "Fani", "Tidak bisa ditentukan"],
        answer: 2,
        hint: "Eko berada di belakang seseorang, jadi Eko juga tidak mungkin di depan.",
        explain: "Dita tidak di depan (petunjuk 1). Eko di belakang Fani, jadi Eko juga tidak di depan. Tersisa Fani.",
      },
      {
        prompt: "Semua kartu bergambar bintang berwarna biru. Kartu Rani berwarna merah. Apa yang pasti benar tentang kartu Rani?",
        options: ["Kartu Rani bergambar bintang", "Kartu Rani tidak bergambar bintang", "Kartu Rani bergambar bulan", "Semua kartu merah bergambar bulan"],
        answer: 1,
        hint: "Kalau kartu Rani bergambar bintang, warnanya harus apa?",
        explain: "Semua kartu bintang berwarna biru. Kartu Rani merah, jadi tidak mungkin bergambar bintang. Soal tidak memberi tahu gambar apa yang ada di kartu itu.",
      },
    ],
  },
};
