#!/usr/bin/env node
/**
 * Importa as gravações de pronúncia em Kabuverdianu (crioulo cabo-verdiano) do projeto
 * Lingua Libre, alojadas no Wikimedia Commons. Gravadas por falantes nativas; licença CC0.
 *
 * Resultado: content/sources/lingua-libre-kea/recordings.json (metadados + URLs).
 * Os ficheiros de áudio ficam no Commons; em produção serão copiados para o Cloudflare R2.
 *
 * Uso: node scripts/import-lingua-libre-kea.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://commons.wikimedia.org/w/api.php";
const UA = "LinguaSTP-content-import/0.1 (https://github.com/anderson-fullstack-developer/fala-neto)";
const CATEGORY = "Category:Lingua_Libre_pronunciation-kea";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "content", "sources", "lingua-libre-kea");

const strip = (html = "") => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const recordings = [];
let cont;
do {
  const params = new URLSearchParams({
    action: "query",
    generator: "categorymembers",
    gcmtitle: CATEGORY,
    gcmtype: "file",
    gcmlimit: "50",
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    format: "json",
    formatversion: "2",
    ...(cont ?? {}),
  });
  const res = await fetch(`${API}?${params}`, { headers: { "User-Agent": UA } });
  const j = await res.json();
  for (const p of j.query?.pages ?? []) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    const meta = ii.extmetadata ?? {};
    // Título: "File:LL-Q35963 (kea)-<Falante> (<Gravador>)-<palavra>.wav"
    const word = p.title.replace(/^File:LL-Q\d+ \(kea\)-.*?\)-/, "").replace(/\.[a-z0-9]+$/i, "");
    const artist = strip(meta.Artist?.value);
    recordings.push({
      word,
      speaker: artist.match(/Speaker:\s*(.*?)(?:\s+Recorder:|$)/)?.[1]?.trim() ?? null,
      recorder: artist.match(/Recorder:\s*(.*)$/)?.[1]?.trim() ?? null,
      url: ii.url.split("?")[0],
      commonsPage: ii.descriptionurl,
      mimeType: ii.mime,
      bytes: ii.size,
      license: meta.LicenseShortName?.value ?? null,
    });
  }
  cont = j.continue;
} while (cont);

const entries = JSON.parse(await readFile(join(ROOT, "content/sources/wiktionary-kea/entries.json"), "utf8")).entries;
const known = new Set(entries.map((e) => e.word));
for (const r of recordings) r.matchesVocabulary = known.has(r.word);
recordings.sort((a, b) => a.word.localeCompare(b.word, "pt"));

if (recordings.some((r) => r.license !== "CC0")) throw new Error("Licença inesperada — rever antes de importar.");

await mkdir(OUT, { recursive: true });
await writeFile(
  join(OUT, "recordings.json"),
  JSON.stringify(
    {
      source: "Lingua Libre (Wikimedia Commons), categoria Lingua_Libre_pronunciation-kea",
      license: "CC0 1.0 (domínio público)",
      importedAt: new Date().toISOString(),
      count: recordings.length,
      matchesVocabulary: recordings.filter((r) => r.matchesVocabulary).length,
      recordings,
    },
    null,
    1,
  ) + "\n",
);
console.log(`${recordings.length} gravações (${recordings.filter((r) => r.matchesVocabulary).length} ligadas ao vocabulário)`);
