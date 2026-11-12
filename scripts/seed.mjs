// Loads data/bank.json (the verified question bank) into Supabase.
//
//   npm run seed
//
// Needs SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) in .env.local next to
// NEXT_PUBLIC_SUPABASE_URL. The key is only read here, on your machine: it must never be
// given a NEXT_PUBLIC_ name or committed. Questions marked "published" in the bank carry a
// key that was checked against the source books; everything else stays "needs_review".
import fs from "node:fs";

const env = Object.fromEntries(
  (fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "")
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Isi NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env.local terlebih dahulu (lihat README).");
  process.exit(1);
}

const bank = JSON.parse(fs.readFileSync("data/bank.json", "utf8"));
let total = 0;
for (let i = 0; i < bank.questions.length; i += 10) {
  const res = await fetch(`${url}/rest/v1/rpc/_import_questions`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_payload: { sources: bank.sources, questions: bank.questions.slice(i, i + 10) }, p_trust: true }),
  });
  if (!res.ok) {
    console.error(`Gagal pada soal ${i + 1}–${i + 10}: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  total += Number(await res.text());
  console.log(`${total} / ${bank.questions.length} soal`);
}
const published = bank.questions.filter((q) => q.status === "published").length;
console.log(`Selesai: ${published} soal terbit, ${bank.questions.length - published} menunggu tinjauan admin.`);
