-- Reference data: computational thinking topics, achievements and the default competitions.
-- No student data and no statistics are seeded.

insert into public.topics (slug, name, description, sort) values
  ('dekomposisi', 'Dekomposisi', 'Memecah persoalan besar menjadi bagian-bagian kecil yang lebih mudah diselesaikan.', 1),
  ('pola', 'Pengenalan Pola', 'Menemukan keteraturan, urutan, dan hubungan untuk memprediksi dan menggeneralisasi.', 2),
  ('abstraksi', 'Abstraksi', 'Memilih informasi yang penting dan mengabaikan detail yang tidak diperlukan.', 3),
  ('algoritma', 'Algoritma', 'Menyusun dan menelusuri langkah-langkah logis yang berurutan.', 4),
  ('representasi-data', 'Representasi Data', 'Memahami cara informasi disusun, dikodekan, dan disimpan.', 5),
  ('penalaran-logis', 'Penalaran Logis', 'Menarik kesimpulan yang pasti dari fakta dan aturan secara sistematis.', 6)
on conflict (slug) do update set name = excluded.name, description = excluded.description, sort = excluded.sort;

insert into public.achievements (code, name, description, icon, metric, threshold, xp_reward, sort) values
  ('first_question', 'Soal Pertama', 'Menjawab soal pertamamu.', 'sparkles', 'questions', 1, 10, 1),
  ('ten_questions', '10 Soal Selesai', 'Mengerjakan 10 soal berbeda.', 'target', 'questions', 10, 25, 2),
  ('fifty_questions', '50 Soal Selesai', 'Mengerjakan 50 soal berbeda.', 'layers', 'questions', 50, 60, 3),
  ('all_questions', 'Penjelajah Bank Soal', 'Mengerjakan 90 soal berbeda dari bank soal historis.', 'library', 'questions', 90, 150, 4),
  ('logical_thinker', 'Pemikir Logis', 'Menjawab benar 15 soal penalaran logis.', 'brain', 'correct_logic', 15, 50, 5),
  ('algorithm_master', 'Ahli Algoritma', 'Menjawab benar 20 soal algoritma.', 'workflow', 'correct_algorithm', 20, 60, 6),
  ('pattern_hunter', 'Pemburu Pola', 'Menjawab benar 8 soal pengenalan pola.', 'shapes', 'correct_pattern', 8, 40, 7),
  ('streak_7', 'Runtun 7 Hari', 'Berlatih tujuh hari berturut-turut.', 'flame', 'streak', 7, 70, 8),
  ('daily_7', 'Rajin Harian', 'Menyelesaikan 7 tantangan harian.', 'calendar-check', 'daily', 7, 40, 9),
  ('competition_finisher', 'Penuntas Kompetisi', 'Menyelesaikan satu simulasi kompetisi.', 'flag', 'competitions', 1, 30, 10),
  ('bebras_challenger', 'Penantang BEBRAS', 'Menyelesaikan lima simulasi kompetisi.', 'trophy', 'competitions', 5, 100, 11),
  ('perfect_score', 'Nilai Sempurna', 'Menjawab benar semua soal dalam satu simulasi kompetisi.', 'medal', 'perfect', 1, 120, 12),
  ('module_graduate', 'Lulus Semua Modul', 'Menuntaskan keenam modul berpikir komputasional.', 'graduation-cap', 'modules', 6, 100, 13)
on conflict (code) do update set name = excluded.name, description = excluded.description, icon = excluded.icon,
  metric = excluded.metric, threshold = excluded.threshold, xp_reward = excluded.xp_reward, sort = excluded.sort;

-- Default formats. The real Penggalang round is 15 questions in 45 minutes (stated in the source
-- books); the scoring values are a platform default and can be changed by an admin per competition.
insert into public.competitions (title, description, mode, duration_minutes, question_count, difficulty_mix, score_correct, score_wrong, score_blank)
select * from (values
  ('Simulasi Latihan', 'Tanpa batas waktu. Cocok untuk mengenal format soal sebelum mencoba simulasi berwaktu.', 'latihan', null::integer, 10, '{}'::jsonb, 4::numeric, 0::numeric, 0::numeric),
  ('Tantangan Berwaktu', '8 soal dalam 20 menit untuk melatih kecepatan dan ketepatan.', 'berwaktu', 20, 8, '{}'::jsonb, 4, 0, 0),
  ('Simulasi Penuh Penggalang', '15 soal dalam 45 menit, seperti babak Penggalang (SMP) pada Tantangan Bebras Indonesia.', 'penuh', 45, 15, '{"mudah":3,"sedang":6,"sulit":5,"lanjutan":1}'::jsonb, 4, -1, 0)
) v
where not exists (select 1 from public.competitions);
