#!/usr/bin/env node
/**
 * Importa os lemas em Kabuverdianu (crioulo cabo-verdiano) do Wiktionary em inglês.
 *
 * Resultado: content/sources/wiktionary-kea/entries.json — material de PARTIDA para os
 * linguistas. Tudo entra no painel admin como DRAFT; nada chega à app sem revisão e
 * aprovação de um falante nativo (regras do projeto). Não é conteúdo aprovado.
 *
 * Licença dos textos importados: CC BY-SA 4.0 (Wiktionary). Ver ATTRIBUTION.md.
 *
 * Uso: node scripts/import-wiktionary-kea.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://en.wiktionary.org/w/api.php";
const UA = "LinguaSTP-content-import/0.1 (https://github.com/anderson-fullstack-developer/fala-neto)";
const CATEGORY = "Category:Kabuverdianu_lemmas";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "content", "sources", "wiktionary-kea");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) return res.json();
    await sleep(1000 * (attempt + 1));
  }
  throw new Error(`Falhou: ${url}`);
}

async function listTitles() {
  const titles = [];
  let cont;
  do {
    const j = await api({ action: "query", list: "categorymembers", cmtitle: CATEGORY, cmnamespace: "0", cmlimit: "500", ...(cont ? { cmcontinue: cont } : {}) });
    titles.push(...j.query.categorymembers.map((m) => m.title));
    cont = j.continue?.cmcontinue;
    await sleep(300);
  } while (cont);
  return titles;
}

async function fetchWikitext(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const j = await api({ action: "query", prop: "revisions", rvprop: "content", rvslots: "main", titles: batch.join("|") });
    for (const p of j.query.pages) {
      const text = p.revisions?.[0]?.slots?.main?.content;
      if (text) out.set(p.title, text);
    }
    process.stdout.write(`\r${Math.min(i + 50, titles.length)}/${titles.length} páginas`);
    await sleep(400);
  }
  process.stdout.write("\n");
  return out;
}

const POS = {
  Noun: "substantivo", "Proper noun": "nome próprio", Verb: "verbo", Adjective: "adjetivo",
  Adverb: "advérbio", Pronoun: "pronome", Preposition: "preposição", Conjunction: "conjunção",
  Interjection: "interjeição", Numeral: "numeral", Determiner: "determinante", Particle: "partícula",
  Article: "artigo", Phrase: "expressão", Proverb: "provérbio", Contraction: "contração",
};

/** Remove marcação wiki e devolve texto simples; recolhe rótulos (ex.: Santiago, Barlavento). */
function clean(line, labels) {
  let s = line;
  s = s.replace(/\{\{(?:lb|lbl|label)\|kea\|([^}]*)\}\}/g, (_, l) => {
    l.split("|").filter((x) => x && x !== "_" && !x.includes("=")).forEach((x) => labels.add(x.trim()));
    return "";
  });
  s = s.replace(/\{\{(?:gloss|gl)\|([^}]*)\}\}/g, "($1)");
  s = s.replace(/\{\{(?:l|m|w|ll|q|qualifier|i)\|(?:[a-z-]+\|)?([^}|]*)[^}]*\}\}/g, "$1");
  s = s.replace(/\{\{[^{}]*\}\}/g, "");
  s = s.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1");
  s = s.replace(/'''?/g, "").replace(/<[^>]+>/g, "");
  return s.replace(/\s+/g, " ").replace(/\s([,.;:])/g, "$1").trim();
}

function parseEntry(title, wikitext) {
  const start = wikitext.indexOf("==Kabuverdianu==");
  if (start < 0) return null;
  const rest = wikitext.slice(start + 16);
  const next = rest.search(/\n==[^=]/);
  const section = next < 0 ? rest : rest.slice(0, next);

  const senses = [];
  const labels = new Set();
  let pos = null;
  for (const raw of section.split("\n")) {
    const h = raw.match(/^={3,5}\s*([^=]+?)\s*={3,5}$/);
    if (h) { pos = POS[h[1]] ?? null; continue; }
    if (pos && /^#\s/.test(raw)) {
      const gloss = clean(raw.replace(/^#\s*/, ""), labels);
      if (gloss) senses.push({ partOfSpeech: pos, glossEn: gloss });
    }
  }
  if (!senses.length) return null;
  return {
    word: title,
    senses,
    variantLabels: [...labels],
    sourceUrl: `https://en.wiktionary.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}#Kabuverdianu`,
  };
}

const titles = await listTitles();
console.log(`${titles.length} lemas na categoria`);
const texts = await fetchWikitext(titles);
const entries = [...texts].map(([t, w]) => parseEntry(t, w)).filter(Boolean).sort((a, b) => a.word.localeCompare(b.word, "pt"));

await mkdir(OUT, { recursive: true });
await writeFile(
  join(OUT, "entries.json"),
  JSON.stringify(
    {
      source: "Wiktionary (en.wiktionary.org), categoria Kabuverdianu lemmas",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      importedAt: new Date().toISOString(),
      status: "DRAFT — requer revisão e aprovação por falante nativo antes de qualquer uso na app",
      count: entries.length,
      entries,
    },
    null,
    1,
  ) + "\n",
);
console.log(`${entries.length} entradas escritas em ${join(OUT, "entries.json")}`);
