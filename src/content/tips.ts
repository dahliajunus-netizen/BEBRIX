/**
 * Study notes written for BEBRIX (not taken from the source books): typical slips per
 * computational thinking topic, shown under the book's explanation after an answer.
 */
export const TOPIC_TIPS: Record<string, string[]> = {
  dekomposisi: [
    "Mencoba menyelesaikan semuanya sekaligus, padahal soal bisa dipecah menjadi beberapa bagian kecil.",
    "Lupa menggabungkan kembali hasil tiap bagian, atau ada bagian yang terlewat.",
    "Tidak memperhatikan bagian mana yang harus selesai lebih dulu sebelum bagian lain bisa dikerjakan.",
  ],
  pola: [
    "Menyimpulkan pola dari satu atau dua contoh saja tanpa memeriksa contoh lainnya.",
    "Hanya melihat satu ciri (misalnya warna) padahal polanya melibatkan beberapa ciri sekaligus.",
    "Tidak memeriksa apakah pola tetap berlaku di ujung deret atau pada kasus khusus.",
  ],
  abstraksi: [
    "Terpaku pada detail cerita atau gambar yang tidak memengaruhi jawaban.",
    "Membuang informasi yang ternyata penting, seperti arah panah atau batas jumlah.",
    "Tidak mengubah soal menjadi model sederhana (titik dan garis, tabel) sehingga hubungan antarobjek sulit dilihat.",
  ],
  algoritma: [
    "Melompati langkah atau menjalankan instruksi tidak sesuai urutan.",
    "Lupa memperbarui keadaan (posisi, isi, hitungan) setelah setiap langkah.",
    "Berhenti pada solusi pertama yang ditemukan, padahal yang diminta adalah yang paling sedikit atau paling banyak.",
  ],
  "representasi-data": [
    "Salah membaca aturan pengodean, misalnya tertukar antara urutan dari kiri dan dari kanan.",
    "Tidak memeriksa apakah sebuah kode bisa dibaca dengan lebih dari satu arti.",
    "Mengabaikan urutan masuk dan keluar data pada tumpukan atau antrean.",
  ],
  "penalaran-logis": [
    "Menebak sebelum semua petunjuk dipakai.",
    "Mengabaikan kata kunci seperti \"tidak\", \"hanya\", \"semua\", atau \"paling sedikit\".",
    "Tidak menguji setiap pilihan jawaban terhadap semua aturan yang diberikan.",
  ],
};
