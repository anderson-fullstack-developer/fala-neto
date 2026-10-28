/**
 * Atividade de DEMONSTRAÇÃO para capturas de ecrã (portfólio), numa base de dados À PARTE.
 *
 * - Recusa-se a correr na base de dados de produção (compara com DATABASE_URL e DIRECT_URL).
 * - Não inventa palavras: usa só o vocabulário, as lições e os exercícios que já existem
 *   (por isso a base de dados de demonstração deve ser um "branch" do Neon, cópia da real).
 * - Todos os utilizadores criados têm email @portfolio.invalid; `--limpar` apaga tudo o que
 *   o script criou.
 * - Determinístico (mesmo resultado em cada corrida), para as capturas serem repetíveis.
 *
 *   PORTFOLIO_DATABASE_URL=postgres://… pnpm --filter @stp/api exec tsx scripts/seed-portfolio.ts --sim
 *   PORTFOLIO_DATABASE_URL=postgres://… pnpm --filter @stp/api exec tsx scripts/seed-portfolio.ts --limpar
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { levelForXp } from "../src/progress/rules/levels.js";

const DEMO_DOMAIN = "@portfolio.invalid";
const LANG = "kabuverdianu";
const DAY = 86_400_000;

/* ------------------------------- segurança ------------------------------- */

/** Pára com uma mensagem clara (sem stack trace). */
function stop(message: string): never {
  console.error(`✋ ${message}`);
  process.exit(1);
}

const target = process.env["PORTFOLIO_DATABASE_URL"];
const args = new Set(process.argv.slice(2));
if (!target) stop("Falta PORTFOLIO_DATABASE_URL (a base de dados de demonstração).");
const where = (url: string | undefined) => {
  if (!url) return null;
  const u = new URL(url);
  // O host com e sem "-pooler" é o mesmo servidor no Neon.
  return `${u.hostname.replace("-pooler", "")}/${u.pathname}`;
};
const prod = [where(process.env["DATABASE_URL"]), where(process.env["DIRECT_URL"])];
if (prod.includes(where(target))) {
  stop("PORTFOLIO_DATABASE_URL é a base de dados de PRODUÇÃO. Usa um branch à parte.");
}
if (!args.has("--sim") && !args.has("--limpar")) {
  stop(
    "Confirma com --sim (criar dados) ou --limpar (apagar os dados de demonstração).",
  );
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: target }) });

/* ---------------------------- aleatório fixo ---------------------------- */

let seed = 20261028;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
const shuffle = <T>(list: T[]) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};
const dayStart = (offset: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() - offset * DAY);
};
const at = (offset: number, hour = int(7, 22)) =>
  new Date(dayStart(offset).getTime() + hour * 3_600_000 + int(0, 59) * 60_000);

/* ------------------------------- nomes ------------------------------- */

const FIRST = [
  "Maria",
  "Ana",
  "Joana",
  "Sofia",
  "Beatriz",
  "Inês",
  "Carla",
  "Débora",
  "Telma",
  "Nilsa",
  "João",
  "Pedro",
  "Carlos",
  "Nuno",
  "Rui",
  "Hélder",
  "Edson",
  "Kevin",
  "Mário",
  "Djalma",
  "Rosa",
  "Lúcia",
  "Vanessa",
  "Elisa",
  "Fátima",
  "Jéssica",
  "Tânia",
  "Patrícia",
  "Sara",
  "Marta",
  "Paulo",
  "Tiago",
  "André",
  "Bruno",
  "Daniel",
  "Hugo",
  "Ivo",
  "Lino",
  "Samuel",
  "Vítor",
];
const LAST = [
  "Silva",
  "Santos",
  "Lopes",
  "Fernandes",
  "Gomes",
  "Tavares",
  "Monteiro",
  "Semedo",
  "Varela",
  "Mendes",
  "Rodrigues",
  "Pina",
  "Barbosa",
  "Fortes",
  "Andrade",
  "Cabral",
  "Spencer",
  "Delgado",
];
const COUNTRIES = ["PT", "PT", "PT", "CV", "CV", "CV", "ST", "FR", "US", "NL", "LU"];
const COLORS = ["ocean", "forest", "sun", "coral", "cocoa", "berry"];

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

/* ------------------------------- limpar ------------------------------- */

async function clean() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: DEMO_DOMAIN } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (!ids.length) return console.log("Não há dados de demonstração para apagar.");
  await prisma.voicePayout.deleteMany({ where: { userId: { in: ids } } });
  await prisma.recordingReview.deleteMany({ where: { listenerId: { in: ids } } });
  await prisma.recording.deleteMany({ where: { speakerId: { in: ids } } });
  await prisma.voiceTask.deleteMany({ where: { assigneeId: { in: ids } } });
  await prisma.voiceContributor.deleteMany({ where: { userId: { in: ids } } });
  await prisma.arenaMatch.deleteMany({ where: { players: { some: { userId: { in: ids } } } } });
  await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`Apagados ${ids.length} utilizadores de demonstração e toda a sua atividade.`);
}

/* ------------------------------- criar ------------------------------- */

async function create() {
  await clean();
  const lessons = await prisma.lesson.findMany({
    where: { unit: { course: { languageId: LANG } } },
    orderBy: [{ unit: { order: "asc" } }, { order: "asc" }],
    select: {
      id: true,
      exercises: { select: { id: true, vocabularyId: true }, orderBy: { order: "asc" } },
    },
  });
  const playable = lessons.filter((l) => l.exercises.length >= 3);
  if (!playable.length)
    throw new Error("A base de dados não tem lições de Kriolu (usa um branch da real).");
  const allExercises = playable.flatMap((l) => l.exercises);
  // Algumas palavras são mais difíceis (para a lista «palavras com mais erros»).
  const hard = new Set(shuffle(allExercises.map((e) => e.id)).slice(0, 25));

  /* ---- pessoas ---- */
  const people = Array.from({ length: 52 }, (_, i) => {
    const first = pick(FIRST);
    const last = pick(LAST);
    const joined = int(2, 45);
    return {
      id: randomUUID(),
      name: `${first} ${last}`,
      username: `${slug(first)}${slug(last).slice(0, 4)}${i + 10}`,
      email: `demo${i + 1}${DEMO_DOMAIN}`,
      avatarColor: pick(COLORS),
      countryCode: pick(COUNTRIES),
      uiLocale: rand() < 0.8 ? "pt" : "en",
      joined,
      // Quanto pratica (0,15 = pouco; 0,9 = todos os dias) e quanto sabe.
      engagement: rand() < 0.25 ? 0.85 + rand() * 0.1 : 0.15 + rand() * 0.55,
      skill: 0.6 + rand() * 0.35,
    };
  });
  await prisma.user.createMany({
    data: people.map((p) => ({
      id: p.id,
      name: p.name,
      username: p.username,
      email: p.email,
      avatarColor: p.avatarColor,
      countryCode: p.countryCode,
      spokenLanguages: p.countryCode === "CV" ? ["kea", "pt"] : ["pt"],
      uiLocale: p.uiLocale,
      learningLanguageId: LANG,
      createdAt: at(p.joined, 9),
      lastActiveAt: at(int(0, 3)),
    })),
  });
  await prisma.userRole.createMany({
    data: people.map((p) => ({ userId: p.id, role: "USER" as const })),
  });

  /* ---- lições, XP e dias ativos ---- */
  const attempts: object[] = [];
  const answers: object[] = [];
  const xp: object[] = [];
  const days: object[] = [];
  const progress = new Map<
    string,
    { completions: number; best: number; first: Date; last: Date }
  >();
  const stats = new Map<
    string,
    {
      xp: number;
      correct: number;
      lessons: number;
      streak: number;
      longest: number;
      lastDay: Date | null;
      days: Set<number>;
    }
  >();

  for (const p of people) {
    const s = {
      xp: 0,
      correct: 0,
      lessons: 0,
      streak: 0,
      longest: 0,
      lastDay: null as Date | null,
      days: new Set<number>(),
    };
    let next = 0;
    let run = 0;
    for (let offset = p.joined; offset >= 0; offset--) {
      const active = offset === p.joined || rand() < p.engagement;
      if (!active) {
        run = 0;
        continue;
      }
      run++;
      s.longest = Math.max(s.longest, run);
      s.days.add(offset);
      s.lastDay = dayStart(offset);
      days.push({ userId: p.id, localDate: dayStart(offset) });
      for (let k = 0; k < int(1, 3); k++) {
        const lesson = playable[Math.min(next, playable.length - 1)]!;
        next++;
        const id = randomUUID();
        const started = at(offset);
        let correct = 0;
        lesson.exercises.forEach((e, i) => {
          const ok = rand() < (hard.has(e.id) ? p.skill - 0.35 : p.skill);
          if (ok) correct++;
          answers.push({
            attemptId: id,
            exerciseId: e.id,
            round: 1,
            correct: ok,
            answeredAt: new Date(started.getTime() + (i + 1) * 6000),
          });
        });
        const total = lesson.exercises.length;
        const done = new Date(started.getTime() + total * 7000);
        attempts.push({
          id,
          userId: p.id,
          lessonId: lesson.id,
          status: "COMPLETED",
          locale: p.uiLocale,
          exerciseIds: lesson.exercises.map((e) => e.id),
          total,
          correctFirstTry: correct,
          startedAt: started,
          expiresAt: new Date(started.getTime() + 3_600_000),
          completedAt: done,
        });
        const gained = correct * 2 + 10 + (correct === total ? 5 : 0);
        xp.push({
          userId: p.id,
          amount: gained,
          reason: "LESSON_COMPLETE",
          sourceType: "lesson_attempt",
          sourceId: id,
          localDate: dayStart(offset),
          createdAt: done,
        });
        s.xp += gained;
        s.correct += correct;
        s.lessons++;
        const key = `${p.id}:${lesson.id}`;
        const prev = progress.get(key);
        const acc = correct / total;
        progress.set(
          key,
          prev
            ? {
                completions: prev.completions + 1,
                best: Math.max(prev.best, acc),
                first: prev.first,
                last: done,
              }
            : { completions: 1, best: acc, first: done, last: done },
        );
      }
    }
    s.streak = s.days.has(0) || s.days.has(1) ? run : 0;
    stats.set(p.id, s);
  }

  /* ---- desafio do dia ---- */
  const dailyAttempts: object[] = [];
  for (let offset = 29; offset >= 0; offset--) {
    const date = dayStart(offset);
    const challenge =
      (await prisma.dailyChallenge.findUnique({
        where: { languageId_date: { languageId: LANG, date } },
      })) ??
      (await prisma.dailyChallenge.create({
        data: {
          languageId: LANG,
          date,
          exerciseIds: shuffle(allExercises.map((e) => e.id)).slice(0, 5),
        },
      }));
    for (const p of people) {
      if (!stats.get(p.id)!.days.has(offset) || rand() > 0.55) continue;
      const correct = Math.min(5, Math.max(1, Math.round(5 * (p.skill + (rand() - 0.5) * 0.3))));
      const started = at(offset);
      const ms = int(25_000, 90_000);
      dailyAttempts.push({
        challengeId: challenge.id,
        userId: p.id,
        status: "COMPLETED",
        locale: p.uiLocale,
        questions: [],
        total: 5,
        correct,
        durationMs: ms,
        startedAt: started,
        completedAt: new Date(started.getTime() + ms),
      });
      xp.push({
        userId: p.id,
        amount: correct * 10,
        reason: "DAILY_CHALLENGE",
        sourceType: "daily_challenge",
        sourceId: challenge.id,
        localDate: date,
        createdAt: started,
      });
      stats.get(p.id)!.xp += correct * 10;
    }
  }

  /* ---- Arena ---- */
  const matches: object[] = [];
  const players: object[] = [];
  for (let offset = 29; offset >= 0; offset--) {
    const online = people.filter((p) => stats.get(p.id)!.days.has(offset));
    for (let k = 0; k < int(2, 8) && online.length >= 4; k++) {
      const mode = rand() < 0.45 ? "survival" : rand() < 0.64 ? "duel" : "teams";
      const size = mode === "duel" ? 2 : mode === "teams" ? 4 : int(4, 8);
      const group = shuffle(online).slice(0, size);
      const id = randomUUID();
      const started = at(offset);
      const cancelled = rand() < 0.06;
      const rounds = mode === "duel" ? 10 : mode === "teams" ? 8 : int(6, 18);
      matches.push({
        id,
        roomCode: rand() < 0.4 ? Math.random().toString(36).slice(2, 8).toUpperCase() : null,
        mode,
        languageId: LANG,
        locale: "pt",
        hostId: group[0]!.id,
        lives: mode === "survival" ? 3 : 1,
        seconds: 10,
        status: cancelled ? "CANCELLED" : "FINISHED",
        rounds: cancelled ? int(1, 3) : rounds,
        rewarded: !cancelled,
        startedAt: started,
        finishedAt: new Date(started.getTime() + rounds * int(14_000, 18_000)),
      });
      const ranked = [...group].sort((a, b) => b.skill + rand() * 0.3 - (a.skill + rand() * 0.3));
      ranked.forEach((p, i) => {
        const place = mode === "teams" ? (i < 2 ? 1 : 2) : i + 1;
        const left = !cancelled && i === ranked.length - 1 && rand() < 0.08;
        const won = place === 1;
        const gained =
          cancelled || left ? 0 : mode === "survival" ? ([250, 150, 100][i] ?? 40) : won ? 120 : 40;
        players.push({
          matchId: id,
          userId: p.id,
          place: cancelled ? null : place,
          correct: Math.round(rounds * p.skill * (0.7 + rand() * 0.3)),
          wrong: int(0, 4),
          timeouts: int(0, 2),
          left,
          xp: gained,
          coins: Math.round(gained / 5),
        });
        if (gained) {
          xp.push({
            userId: p.id,
            amount: gained,
            reason: mode === "duel" && won ? "DUEL_WIN" : "ARENA_PLACE",
            sourceType:
              mode === "duel" ? "arena_duel" : mode === "teams" ? "arena_teams" : "arena_match",
            sourceId: id,
            localDate: dayStart(offset),
            createdAt: started,
          });
          stats.get(p.id)!.xp += gained;
        }
      });
    }
  }

  /* ---- gravar tudo ---- */
  const batch = async <T>(rows: T[], fn: (chunk: T[]) => Promise<unknown>) => {
    for (let i = 0; i < rows.length; i += 2000) await fn(rows.slice(i, i + 2000));
  };
  await batch(attempts, (c) => prisma.lessonAttempt.createMany({ data: c as never }));
  await batch(answers, (c) => prisma.lessonAttemptAnswer.createMany({ data: c as never }));
  await batch(days, (c) =>
    prisma.activityDay.createMany({ data: c as never, skipDuplicates: true }),
  );
  await batch(dailyAttempts, (c) => prisma.dailyChallengeAttempt.createMany({ data: c as never }));
  await batch(matches, (c) => prisma.arenaMatch.createMany({ data: c as never }));
  await batch(players, (c) => prisma.arenaMatchPlayer.createMany({ data: c as never }));
  await batch(xp, (c) => prisma.xpEvent.createMany({ data: c as never, skipDuplicates: true }));
  await batch([...progress.entries()], (c) =>
    prisma.lessonProgress.createMany({
      data: c.map(([key, v]) => {
        const [userId, lessonId] = key.split(":") as [string, string];
        return {
          userId,
          lessonId,
          status: "COMPLETED" as const,
          completions: v.completions,
          bestAccuracy: v.best,
          firstCompletedAt: v.first,
          lastCompletedAt: v.last,
        };
      }),
    }),
  );
  await prisma.userStats.createMany({
    data: people.map((p) => {
      const s = stats.get(p.id)!;
      return {
        userId: p.id,
        xpTotal: s.xp,
        coins: Math.round(s.xp / 6),
        currentStreak: s.streak,
        longestStreak: s.longest,
        lastActiveDate: s.lastDay,
        correctAnswers: s.correct,
        lessonsCompleted: s.lessons,
      };
    }),
  });

  /* ---- conquistas ---- */
  const achievements = people.flatMap((p) => {
    const s = stats.get(p.id)!;
    const level = levelForXp(s.xp).level;
    const earned: string[] = [];
    if (s.lessons >= 1) earned.push("ACH_FIRST_LESSON");
    if (s.longest >= 7) earned.push("ACH_STREAK_7");
    if (s.longest >= 30) earned.push("ACH_STREAK_30");
    if (s.correct >= 100) earned.push("ACH_CORRECT_100");
    if (s.correct >= 1000) earned.push("ACH_CORRECT_1000");
    if (level >= 10) earned.push("ACH_LEVEL_10");
    if (level >= 25) earned.push("ACH_LEVEL_25");
    return earned.map((achievementKey) => ({
      userId: p.id,
      achievementKey,
      earnedAt: at(int(0, p.joined)),
    }));
  });
  await prisma.userAchievement.createMany({ data: achievements });

  /* ---- gravações (faladores e ouvintes pagos) ---- */
  const admin = await prisma.user.create({
    data: {
      email: `equipa${DEMO_DOMAIN}`,
      username: "equipa_demo",
      name: "Equipa Fala Neto",
      roles: { create: [{ role: "USER" }, { role: "ADMIN" }] },
    },
  });
  const [s1, s2, l1, l2] = people;
  const contributors = [
    {
      u: s1!,
      role: "VOICE_SPEAKER" as const,
      region: "Santiago",
      method: "SEPA",
      details: "PT50 0035 0000 0000 0000 0000 0",
    },
    {
      u: s2!,
      role: "VOICE_SPEAKER" as const,
      region: "São Vicente",
      method: "MBWAY",
      details: "+351 912 000 000",
    },
    {
      u: l1!,
      role: "VOICE_LISTENER" as const,
      region: "Santiago",
      method: "SEPA",
      details: "PT50 0010 0000 0000 0000 0000 0",
    },
    {
      u: l2!,
      role: "VOICE_LISTENER" as const,
      region: "Fogo",
      method: "MBWAY",
      details: "+351 936 000 000",
    },
  ];
  for (const c of contributors) {
    await prisma.userRole.create({
      data: { userId: c.u.id, role: c.role, languageId: LANG, grantedById: admin.id },
    });
    await prisma.voiceContributor.create({
      data: {
        userId: c.u.id,
        displayName: c.u.name,
        region: c.region,
        adultConfirmed: true,
        consentVersion: "2026-10-16",
        consentAt: at(20),
        payoutMethod: c.method,
        payoutDetails: c.details,
      },
    });
  }
  const words = shuffle(
    (
      await prisma.vocabulary.findMany({
        where: { languageId: LANG, exercises: { some: {} } },
        select: { id: true },
        take: 400,
      })
    ).map((w) => w.id),
  );
  const listeners = [l1!, l2!];
  let w = 0;
  for (const [speaker, amount, target, rate] of [
    [s1!, 140, 200, 10],
    [s2!, 90, 150, 10],
  ] as const) {
    const task = await prisma.voiceTask.create({
      data: {
        kind: "RECORD",
        assigneeId: speaker.id,
        languageId: LANG,
        title: `Gravar ${target} palavras — Kriolu`,
        target,
        rateCents: rate,
        createdById: admin.id,
        dueAt: at(-6, 23),
        createdAt: at(18),
      },
    });
    for (let i = 0; i < amount; i++) {
      const status = rand() < 0.72 ? "APPROVED" : rand() < 0.55 ? "PENDING" : "REJECTED";
      const created = at(int(1, 17));
      const rec = await prisma.recording.create({
        data: {
          vocabularyId: words[w++ % words.length]!,
          languageId: LANG,
          speakerId: speaker.id,
          taskId: task.id,
          region: speaker === s1 ? "Santiago" : "São Vicente",
          storageKey: `rec_${randomUUID()}.webm`,
          mimeType: "audio/webm",
          sizeBytes: int(9_000, 26_000),
          durationMs: int(700, 1900),
          status,
          approvals: status === "APPROVED" ? 2 : status === "PENDING" ? int(0, 1) : 0,
          rejections: status === "REJECTED" ? 2 : 0,
          createdAt: created,
          decidedAt: status === "PENDING" ? null : new Date(created.getTime() + DAY),
        },
      });
      if (status !== "PENDING") {
        for (const l of listeners) {
          await prisma.recordingReview.create({
            data: {
              recordingId: rec.id,
              listenerId: l.id,
              verdict: status === "APPROVED" ? "APPROVE" : "REJECT",
              reason:
                status === "REJECTED" ? pick(["NOISE", "PRONUNCIATION", "CUT_OFF"] as const) : null,
              createdAt: new Date(created.getTime() + DAY / 2),
            },
          });
        }
      }
    }
  }
  for (const l of listeners) {
    const task = await prisma.voiceTask.create({
      data: {
        kind: "REVIEW",
        assigneeId: l.id,
        languageId: LANG,
        title: "Ouvir 300 gravações — Kriolu",
        target: 300,
        rateCents: 2,
        createdById: admin.id,
        createdAt: at(18),
      },
    });
    await prisma.recordingReview.updateMany({
      where: { listenerId: l.id },
      data: { taskId: task.id },
    });
  }
  await prisma.voicePayout.create({
    data: {
      userId: s1!.id,
      amountCents: 800,
      method: "SEPA",
      reference: "TRF-2026-1021",
      paidAt: at(7),
      createdById: admin.id,
    },
  });
  await prisma.voicePayout.create({
    data: {
      userId: l1!.id,
      amountCents: 300,
      method: "SEPA",
      reference: "TRF-2026-1021",
      paidAt: at(7),
      createdById: admin.id,
    },
  });

  /* ---- auditoria ---- */
  await prisma.adminAuditLog.createMany({
    data: [
      ...contributors.map((c) => ({
        actorId: admin.id,
        action: "user.role_grant",
        entityType: "USER",
        entityId: c.u.id,
        metadata: { role: c.role, languageId: LANG },
        createdAt: at(20),
      })),
      {
        actorId: admin.id,
        action: "voice.task_create",
        entityType: "VOICE_TASK",
        metadata: {},
        createdAt: at(18),
      },
      {
        actorId: admin.id,
        action: "voice.payout",
        entityType: "USER",
        entityId: s1!.id,
        metadata: { amountCents: 800 },
        createdAt: at(7),
      },
      {
        actorId: admin.id,
        action: "voice.payout",
        entityType: "USER",
        entityId: l1!.id,
        metadata: { amountCents: 300 },
        createdAt: at(7),
      },
    ],
  });

  console.log(
    `Pronto: ${people.length} pessoas, ${attempts.length} lições, ${dailyAttempts.length} desafios, ` +
      `${matches.length} partidas, ${achievements.length} conquistas, ${w} gravações (demonstração).`,
  );
}

(args.has("--limpar") ? clean() : create())
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
