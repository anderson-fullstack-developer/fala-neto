# Língua STP — Plano de Engenharia

> Documento de referência para levar o projeto do protótipo (Lovable) até à publicação na Google Play.
> Complementa: `documentation.md` (requisitos de produto + Adendo A — Arena Online) e `docs/HANDOFF.md` (mapa do código do Lovable).
>
> **Estado à data (2026-10-06):** protótipo frontend completo e 100% mock. Sem backend, sem base de dados, sem auth real, sem controlo de versões.

---

## Índice

1. Resumo executivo
2. Diagnóstico do estado atual
3. Problemas encontrados (com prioridade)
4. Decisões de arquitetura (ADR)
5. Arquitetura alvo e estrutura do monorepo
6. Boas práticas e regras de engenharia
7. Plano de execução por fases (ordem revista)
8. Comparação com o plano de 15 passos
9. Caminho crítico: conteúdo linguístico
10. Checklist Google Play
11. Riscos e mitigação
12. Como trabalhar com o Claude Code
13. Decisões pendentes (precisam de resposta do dono do produto)

---

## 1. Resumo executivo

- **O que existe:** um protótipo web muito completo feito no Lovable (app + painel admin, ~60 rotas, mocks, regras de jogo puras, testes) e um protótipo Expo descartável em `apps/mobile`.
- **O ponto mais importante:** o código do Lovable é **web** (React DOM, Tailwind, Radix/shadcn). **Não corre em React Native.** Os ecrãs da app mobile têm de ser reescritos. O que se reaproveita diretamente é a "camada sem UI": tipos, configuração, contratos de serviço, motor de jogo, workflow de revisão, permissões e testes.
- **O painel admin do Lovable pode ser reaproveitado quase inteiro** como aplicação web separada (é web por natureza). Recomenda-se mantê-lo em vez de o reescrever em Next.js.
- **O caminho crítico não é técnico, é o conteúdo:** sem palavras/frases/áudios aprovados por falantes nativos, a app não tem o que ensinar. Por isso o **admin ligado à base de dados real** tem de existir cedo, para os linguistas começarem a trabalhar em paralelo com o desenvolvimento.
- **Primeiro passo obrigatório:** colocar o projeto em Git. Hoje não há controlo de versões na raiz.

---

## 2. Diagnóstico do estado atual

### 2.1 Inventário

| Peça | Local | Estado | Reaproveitamento |
|---|---|---|---|
| Requisitos de produto | `documentation.md` | Completo (secções 1–52 + Adendo A1–A46) | Fonte de verdade do produto |
| Protótipo Lovable (app + admin) | `src/`, `public/`, configs na raiz | Completo, mock, web | Ver 2.2 |
| Handoff Lovable | `README.md`, `docs/HANDOFF.md`, `AGENTS.md`, `CONTRIBUTING.md` | Bom, com pequenas incoerências | Manter, corrigir |
| Protótipo Expo | `apps/mobile` | Descartável (feito para visualizar) | Só o *scaffold* (Expo SDK 57 + Expo Router) |
| Backend | — | Não existe | — |
| Base de dados | — | Não existe | — |
| Git | — | **Não existe na raiz**; existe um `.git` aninhado em `apps/mobile` | Criar |

### 2.2 O que se reaproveita do Lovable

| Pasta / ficheiro | Destino no monorepo | Notas |
|---|---|---|
| `src/types/*` | `packages/types` | Domínio, multiplayer, `game-contract.ts`. Ajustar ids de opções (ver P-05). |
| `src/config/app.ts` | `packages/config` | Valores passam a *defaults*; a fonte de verdade final é a BD/servidor. |
| `src/config/api.ts`, `src/services/http.ts` | `packages/api-client` | Cliente HTTP partilhado por mobile e admin. |
| `src/lib/multiplayer/engine.ts` | `packages/game-engine` | Regras puras → usadas **pelo servidor**. O cliente nunca as usa em produção. |
| `src/admin/workflow.ts`, `permissions.ts` | `packages/domain` (ou dentro da API) | O servidor aplica as regras; o admin só as usa para esconder botões. |
| `src/test/*` (lógica) | junto de cada package | Testes de regras de jogo, workflow e permissões continuam válidos. |
| `src/admin/*`, `src/routes/admin.*` | `apps/admin` | Painel web completo. |
| `src/routes/*` (app), `src/components/*` | **Referência visual** para `apps/mobile` | Reescrever em React Native. |
| `src/mocks/*` | `apps/api/prisma/seed` (só dev) | Viram *seed* de desenvolvimento com placeholders rotulados. |
| `src/styles.css` (tokens) | `packages/config/theme` → NativeWind | Paleta e tipografia são reaproveitáveis. |

### 2.3 Pontos fortes do protótipo (manter)

- Camada única de dados (`src/services/*`); os ecrãs nunca importam mocks.
- Valores de produto centralizados e *feature flags* (`features`, `isEnabled`).
- Contrato multiplayer **server-authoritative** já definido (`RealtimeGameService`, `AnswerAck` sem revelar correção).
- Workflow de conteúdo com estados e IA sempre em `DRAFT`.
- Política de anúncios centralizada (`src/config/ads.ts`) que bloqueia anúncios em perguntas, contagens e multiplayer.
- TypeScript estrito (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).

---

## 3. Problemas encontrados (com prioridade)

Prioridade: **P0** bloqueia / risco alto · **P1** corrigir durante a migração · **P2** melhoria.

| Id | Prio | Problema | Onde | Ação |
|---|---|---|---|---|
| P-01 | P0 | Sem Git na raiz; `.git` aninhado em `apps/mobile` | raiz, `apps/mobile/.git` | Apagar `.git` aninhado, `git init` na raiz, primeiro commit, repositório privado no GitHub. |
| P-02 | P0 | O README diz que o projeto está ligado ao Lovable e sincroniza commits. Reestruturar em monorepo **parte essa sincronização**. | `README.md` (bloco LOVABLE) | Decidir "congelar" o Lovable (ver ADR-01). |
| P-03 | P0 | Revisor pode aprovar o próprio conteúdo (o workflow não compara autor e revisor). A especificação pede criador + revisor. | `src/admin/workflow.ts` (`canPerform`/`applyReview`) | No servidor: `reviewerId !== createdById` obrigatório para `APPROVE`. Adicionar teste. |
| P-04 | P0 | Login admin aceita qualquer credencial; sessão em `localStorage`. | `src/routes/admin_.login.tsx`, `src/admin/store.ts` | Substituir por Clerk + papéis verificados no servidor. Nunca publicar o admin antes disto. |
| P-05 | P1 | Multiplayer usa `correctIndex`/`optionIndex`. A especificação pede `selectedOptionId`. Índices dependem da ordem das opções e facilitam batota. | `src/types/multiplayer.ts`, `game-contract.ts` | Usar ids de opção (UUID) no contrato; o servidor baralha e guarda a ordem. |
| P-06 | P1 | XP, moedas, streak, loja e "semana" calculados no cliente (`localStorage`). | `src/hooks/use-game.ts` | Mover para a API (`GET /me`, `POST /progress/...`). Cliente só mostra. |
| P-07 | P1 | Recompensas definidas em 3 sítios diferentes e com valores divergentes (`MOCK_XP_REWARDS`, `MULTIPLAYER_CONFIG.survivalRewards/participationReward`, `RewardRules` do admin) e diferentes da especificação (4.º–5.º: 60 XP). | `src/config/app.ts`, `src/admin/types.ts` | Uma tabela `reward_rules` na BD, editável no admin, lida pelo servidor. |
| P-08 | P1 | Níveis lineares (`xpPerLevel: 800`); a especificação pede curva configurável (0/100/250/500/900…). | `src/config/app.ts`, `use-game.ts` | Tabela `level_thresholds` (ou fórmula parametrizada) no servidor. |
| P-09 | P1 | Documentação diz `IN_REVIEW`; código usa `UNDER_REVIEW`. | `README.md`, `docs/HANDOFF.md` | Padronizar em `UNDER_REVIEW` (igual à especificação). |
| P-10 | P1 | Streak sem fuso horário do utilizador (diáspora em PT/FR/UK). | `use-game.ts` | Guardar `timezone` no utilizador; o servidor calcula o "dia" nesse fuso. |
| P-11 | — | ~~Dois gestores de pacotes~~ **Resolvido no passo 0.3** (pnpm). Era: `bun.lock` na raiz, `package-lock.json` em `apps/mobile`. Bun não está instalado nesta máquina. | raiz, `apps/mobile` | Um só gestor para o monorepo (ADR-05). |
| P-12 | P1 | Autor/revisor guardados como **nomes** (strings), não ids. | `src/admin/types.ts` (`ContentBase`) | Na BD: `createdById`, `reviewedById` (FK `User`), `approvedAt`, `version`. |
| P-13 | P2 | `SURVIVAL_MAX_PLAYERS = 16` mas o modo público é 8. | `src/config/app.ts` | Configuração por modo (`game_mode_configs`) no servidor. |
| P-14 | — | ~~Testes não verificados.~~ **Verificado no passo 0.2 (2026-10-06):** 23/23 testes passam (6 ficheiros), typecheck sem erros, build OK. | `src/test/*` | Resolvido. |
| P-16 | — | ~~Lint falha~~ **Resolvido no passo 0.4 (2026-10-07):** formatação automática, 2 erros de hooks corrigidos, avisos a zero, lint com `--max-warnings 0`. Era: Lint falha: 2004 problemas. 1987 são só formatação (Prettier, corrigíveis com `--fix`); 2 erros reais `react-hooks/rules-of-hooks` (hooks chamados na função `component` da rota); 13 avisos (fast refresh, deps de hooks). | `src/routes/achievements.tsx:18`, `src/routes/notifications.tsx:18`, outros | Correr `eslint --fix` num commit só de formatação; corrigir os 2 erros extraindo o componente com nome em maiúscula. Lint passa a ser obrigatório no CI (passo 0.4). |
| P-17 | P2 | O README refere a rota `/play`, que não existe (404). Os modos estão em `/play/survival`, `/play/duel`, etc. | `README.md`, `src/routes/` | Corrigir a documentação ou criar o ecrã `/play` (hub da área Jogar) ao migrar para mobile. |
| P-18 | — | ~~Resolvido (2026-10-08): protótipo Expo removido; ecrãs reescritos sobre o design system~~. Era: Os dois ecrãs do protótipo Expo (`apps/mobile/src/app/arena/survival.tsx`, `lesson/[id].tsx`) têm 23 erros das regras do React Compiler (funções impuras e refs no render, setState em efeitos). | `apps/mobile/eslint.config.js` | Excluídos do lint até serem reescritos no passo 3.1; remover a exclusão nessa altura. |
| P-15 | P2 | Sistema de "vidas" nas lições (`maxLives: 5`) não está na especificação e pode bloquear a aprendizagem. | `src/config/app.ts` | Decisão de produto (ver secção 13). |

---

## 4. Decisões de arquitetura (ADR)

Cada decisão fica registada com o motivo. Alterar uma decisão = novo ADR, não apagar o antigo.

| ADR | Decisão | Estado | Motivo | Consequência |
|---|---|---|---|---|
| ADR-01 | **Congelar o Lovable.** O repositório Git passa a ser a única fonte de verdade; o Lovable fica como referência visual. **Toda a interface (app e admin) é terminada neste repositório.** | Aceite (2026-10-06) | Reestruturar em monorepo quebra a sincronização com o Lovable; ter duas fontes de verdade gera conflitos. | Alterações de design futuras: fazer no código, ou prototipar no Lovable num projeto à parte e portar à mão. |
| ADR-02 | **Mobile: React Native + Expo (SDK atual) + Expo Router + NativeWind.** Ecrãs reescritos a partir do Lovable. | Aceite (especificação) | Requisito do produto; acesso nativo a áudio, haptics, notificações, Play Billing, AdMob. | Reescrever ~35 ecrãs. Reaproveitar tokens visuais com NativeWind. |
| ADR-03 | **Admin: manter o painel do Lovable (TanStack Start + Tailwind + shadcn) em `apps/admin`**, em vez de Next.js. | Proposto (desvio da especificação) | O painel já existe e funciona; reescrever em Next.js não acrescenta valor ao utilizador. | Deploy em Vercel ou Cloudflare (o build atual já usa Nitro). |
| ADR-04 | **Auth: Clerk** (app + admin). O NestJS valida o JWT do Clerk; utilizadores sincronizados por webhook; papéis numa tabela própria `user_roles`. | Aceite (handoff) | Evita implementar hashing, refresh tokens, Google Sign-In, verificação de email e brute-force à mão. | Custo por utilizador ativo a partir de certo volume; confirmar conformidade RGPD (região dos dados). A especificação original (JWT próprio) fica substituída. |
| ADR-05 | **Monorepo com pnpm workspaces + Turborepo.** | Aceite (2026-10-06) | Combinação mais testada com Expo + NestJS + Prisma; cache de builds e tarefas por package. | Remover `bun.lock` e `package-lock.json`; um único `pnpm-lock.yaml`. (Alternativa aceitável: bun workspaces — decidir uma vez.) |
| ADR-06 | **Base de dados: Neon PostgreSQL + Prisma.** | Aceite (handoff) | PostgreSQL gerido, *branching* por ambiente/PR. | Usar URL com *pooling* para a app e URL direta para migrações. |
| ADR-07 | **API: NestJS em Railway** (processo de longa duração). | Aceite | Socket.IO precisa de ligações persistentes (não serve em funções *serverless*). | Uma instância no MVP; múltiplas instâncias só com Redis (ADR-08). |
| ADR-08 | **Redis (Upstash) só quando necessário.** MVP da Arena corre numa instância sem Redis; o estado de jogo fica em memória atrás de uma interface (`GameStateStore`). | Proposto | A especificação pede para começar sem Redis; evita infraestrutura prematura. | Ao escalar: trocar a implementação para Redis + Socket.IO Redis Adapter sem mudar a lógica. |
| ADR-09 | **Ficheiros: um único fornecedor no início — Cloudflare R2** (áudio e imagens), uploads por *signed URL* emitida pela API. Cloudinary só se forem precisas transformações de imagem. | Proposto (simplifica o handoff, que previa os dois) | Menos contas, chaves e código; R2 não cobra saída de dados. | `media.service.ts` mantém a separação `imageService`/`audioService`, por isso trocar depois é local. |
| ADR-10 | **Pagamentos: RevenueCat + Google Play Billing** na app. **Stripe adiado** para B2B/escolas (fase 3), só fora da app. | Proposto | Regras da Google Play: conteúdo digital vendido dentro da app tem de usar o Play Billing. | Remover `VITE_STRIPE_PUBLISHABLE_KEY` do MVP. |
| ADR-11 | **Servidor é a fonte de verdade** para XP, moedas, streak, níveis, recompensas, vidas, respostas, tempo e classificação. | Aceite (especificação) | Anti-batota e consistência. | O cliente envia **intenções** (`lessonAttemptId`, `selectedOptionId`); nunca valores. |
| ADR-13 | **Plataforma multilíngue e multipaís** (Adendo B): `Country → Language → Variant`; começa com São Tomé e Príncipe e Cabo Verde. | Aceite (2026-10-07) | Objetivo do produto é cobrir várias línguas e países. | Onboarding agrupa por país; conteúdo, rankings e cursos sempre filtrados por língua; nome da app tem de servir vários países (D-10); linguistas por língua. |
| ADR-14 | **Kriolu (Cabo Verde) disponível em BETA** antes da revisão por falantes nativos: curso por temas gerado a partir dos rascunhos do Wiktionary, significados em português (sugestão automática) ou inglês (fonte). | Aceite (2026-10-07) — **decisão do dono do produto**, exceção à regra "só APPROVED chega à app" | Ter Cabo Verde utilizável já e recolher feedback. | Selo "Beta" e aviso "conteúdo em revisão" sempre visíveis; botão "Reportar erro"; palavras duvidosas fora do quiz. **Recomendação:** rever pelo menos as lições mais usadas com falantes nativos antes do lançamento na Google Play; quando houver conteúdo aprovado, substitui o Beta. |
| ADR-15 | **Design system mobile com estilos nativos (StyleSheet) e tokens**, em vez de NativeWind. | Aceite (2026-10-07) | O NativeWind está acoplado a versões específicas de Tailwind/Reanimated; com o SDK 57 (RN 0.86, Reanimated 4) o risco de incompatibilidade é alto. | Tokens em `apps/mobile/src/design/tokens.ts` com as mesmas cores da web (OKLCH → hex); componentes em `src/design/` (texto, botões, cartões, gradientes, progresso, estados com o Neto, vibração); sombras com `boxShadow`. Ecrãs só usam o que sai de `@/design`. |
| ADR-12 | **Contratos partilhados com Zod** em `packages/contracts` (DTOs REST + eventos Socket.IO), usados pela API, mobile e admin. | Proposto | Uma definição → validação no servidor + tipos no cliente; elimina divergências. | NestJS valida com pipe Zod (ou class-validator gerado); OpenAPI gerado a partir dos schemas. |

---

## 5. Arquitetura alvo e estrutura do monorepo

### 5.1 Diagrama

```text
 ┌──────────────────────┐        ┌──────────────────────┐
 │  apps/mobile          │        │  apps/admin           │
 │  Expo / React Native  │        │  TanStack Start (web) │
 │  Clerk · RevenueCat   │        │  Clerk (papéis)       │
 │  AdMob · PostHog      │        │                       │
 └─────────┬────────────┘        └──────────┬───────────┘
           │ HTTPS REST /api/v1 + Socket.IO  │ HTTPS REST /api/v1/admin
           ▼                                  ▼
 ┌─────────────────────────────────────────────────────────┐
 │  apps/api — NestJS (Railway)                             │
 │  Auth guard (JWT Clerk) · RBAC · Rate limit · Helmet     │
 │  Módulos: users · content · progress · gamification ·    │
 │  social · leaderboards · daily · game (gateway) ·        │
 │  media · subscriptions · notifications · admin · audit   │
 └───────┬───────────────┬───────────────┬─────────────────┘
         │ Prisma        │ (fase 3)      │ signed URLs
         ▼               ▼               ▼
   Neon PostgreSQL   Upstash Redis   Cloudflare R2
         ▲
 Webhooks: Clerk (utilizadores) · RevenueCat (subscrições)
 Observabilidade: Sentry (app/admin/api) · PostHog (produto)
```

### 5.2 Estrutura de pastas

```text
stp_app/
├─ apps/
│  ├─ mobile/            # Expo + Expo Router + NativeWind
│  ├─ admin/             # painel web (código do Lovable movido para aqui)
│  └─ api/               # NestJS + Prisma
│     └─ prisma/         # schema.prisma, migrations/, seed (placeholders rotulados)
├─ packages/
│  ├─ contracts/         # schemas Zod: DTOs REST + eventos Socket.IO
│  ├─ types/             # tipos de domínio (derivados dos contracts quando possível)
│  ├─ config/            # defaults de produto, tokens de tema, feature flags
│  ├─ game-engine/       # regras puras da Arena (usadas pela API)
│  ├─ api-client/        # cliente HTTP + socket tipado (mobile e admin)
│  └─ tsconfig/ eslint-config/
├─ docs/
│  ├─ PLANO_DE_ENGENHARIA.md   # este documento
│  ├─ HANDOFF.md
│  └─ adr/                     # um ficheiro por ADR
├─ documentation.md            # requisitos de produto
├─ .github/workflows/          # CI
├─ turbo.json · pnpm-workspace.yaml · package.json
└─ .env.example (por app)
```

### 5.3 Ambientes

| Ambiente | API | BD | Mobile | Uso |
|---|---|---|---|---|
| `local` | localhost | Neon branch `dev` (ou Postgres em Docker) | Expo Go / dev build | Desenvolvimento |
| `staging` | Railway (serviço staging) | Neon branch `staging` | EAS build `preview` | Testes internos, linguistas |
| `production` | Railway (produção) | Neon `main` | EAS build `production` (.aab) | Utilizadores reais |

Segredos só nos painéis da Railway/Vercel/EAS. Nunca no repositório. Chaves distintas por ambiente.

---

## 6. Boas práticas e regras de engenharia

### 6.1 Regras de produto que viram regras de código

1. **Nunca inventar conteúdo em Forro/Angolar/Lung'Ie.** Seeds e testes usam placeholders rotulados ("Palavra em Forro 1").
2. **Só `APPROVED` (e ativo) chega à app.** Aplicado na query do servidor, não no cliente. Teste automático obrigatório.
3. **Quatro olhos:** quem cria não aprova. Aplicado no servidor (P-03).
4. **IA gera sempre `DRAFT`.**
5. **Servidor autoritativo** (ADR-11). O cliente nunca envia `xp`, `coins`, `score`, `isCorrect`, `lives`, `placement`, tempos oficiais.
6. **Moeda virtual nunca se compra nem se troca por dinheiro.** Sem apostas.
7. **Sem anúncios** em perguntas, contagens, matchmaking, multiplayer e lições.

### 6.2 Código

- TypeScript estrito em todos os packages (manter as opções atuais do Lovable).
- Validação de entrada em **todas** as fronteiras (REST, Socket.IO, webhooks) com os schemas de `packages/contracts`.
- NestJS: um módulo por domínio; controllers finos; regras em services; Prisma acedido só via services/repositórios do módulo.
- Erros tipados e respostas de erro consistentes (`{ code, message, details }`).
- Datas sempre em UTC na BD; fuso do utilizador só para cálculos de "dia" (streak, desafio diário).
- Idempotência em operações que dão recompensas (`attemptId` único → repetir o pedido não duplica XP).
- Sem lógica de negócio duplicada entre cliente e servidor: o cliente importa tipos e schemas, não regras.
- Feature flags: desligar nunca apaga código (regra do Lovable, manter). Mais tarde, flags vêm do servidor.

### 6.3 Git e fluxo de trabalho

- Ramo `main` protegido; trabalho em ramos `feat/…`, `fix/…`, `chore/…`.
- Commits pequenos e no imperativo, estilo *Conventional Commits* (`feat(api): adicionar módulo de progresso`).
- Um tema por Pull Request; PR com descrição, como testar e capturas de ecrã quando há UI.
- CI obrigatório antes de juntar: `lint` + `typecheck` + `test` + `build` de todos os packages afetados (Turborepo).
- Migrações Prisma sempre versionadas e revistas; nunca `db push` em staging/produção.

### 6.4 Testes (pirâmide, desde o primeiro módulo — não no fim)

| Nível | Ferramenta | O que cobre |
|---|---|---|
| Unitário | Vitest (packages) / Jest (NestJS) | Regras puras: motor de jogo, XP, níveis, streak, workflow, permissões |
| Integração | Jest + BD de teste (Neon branch ou Docker) | Services NestJS com Prisma real |
| API / E2E backend | Supertest | Endpoints com auth, papéis, validação |
| Realtime | cliente Socket.IO em testes | Partida completa, resposta duplicada, resposta atrasada, reconexão |
| E2E mobile | Maestro | Fluxos críticos: registo → 1.ª lição; matchmaking → fim de partida |

Prioridade dos testes (secção 47 da especificação): Auth, XP, Streak, Progresso, Subscrições, Pontuação de jogo, Salas, Permissões admin.

### 6.5 Interface (UI/UX)

A interface é terminada neste repositório (ADR-01). O Lovable é só referência visual.

**Princípios**
- Identidade própria inspirada em São Tomé e Príncipe (verde floresta, cacau, amarelo sol, azul oceano, coral). **Não copiar o Duolingo.**
- Mobile-first: desenhar para 360 px e testar em 360/390/412/430 px; tablets mais tarde.
- Moderna, simples, colorida, jovem e divertida: cartões arredondados, micro-animações, barras de progresso, feedback visual e háptico, animações de XP.
- Arena com tema próprio (escuro, tensão, velocidade) sem perder o foco educativo.
- PT europeu em toda a UI; textos preparados para tradução (EN/FR) — nada de texto fixo nos componentes.

**Quando se trata a interface**
1. **Passo 3.1** — design system primeiro (tokens, componentes, estados, animações). Nenhum ecrã antes disto.
2. **Cada ecrã (passos 3.2–4.3)** — feito já com o design final e testado em Android.
3. **Revisão de design no fim de cada fase** — percorrer todos os ecrãs da fase e corrigir inconsistências.
4. **Passo 6.1** — polimento final (detalhes de animação, desempenho, acessibilidade).

**Checklist por ecrã**
- [ ] Usa só componentes e tokens do design system (sem cores/tamanhos soltos).
- [ ] Estados: carregamento, erro, vazio, offline (e bloqueado quando aplicável).
- [ ] Funciona em 360 px sem cortes nem scroll horizontal; texto grande do sistema não parte o layout.
- [ ] Áreas de toque ≥ 44 px; contraste legível; leitor de ecrã com rótulos.
- [ ] Feedback em cada ação (animação, háptico, som quando fizer sentido).
- [ ] Sem anúncios em perguntas, contagens, matchmaking, multiplayer e lições.
- [ ] Testado num telemóvel Android real ou emulador.

### 6.6 Definition of Done (para cada passo)

- [ ] Código revisto e juntado em `main` via PR.
- [ ] Lint, typecheck, testes e build verdes no CI.
- [ ] Testes novos para as regras introduzidas.
- [ ] Variáveis de ambiente novas documentadas no `.env.example` da app.
- [ ] Documentação atualizada (README da app, ADR se houve decisão).
- [ ] Testado manualmente em Android (dispositivo ou emulador) quando há UI mobile.
- [ ] Sem segredos no código; sem conteúdo linguístico inventado.

---

## 7. Plano de execução por fases (ordem revista)

Dimensão do esforço: **S** (≤2 dias) · **M** (≤1 semana) · **L** (1–3 semanas) · **XL** (>3 semanas). Valores indicativos para 1 developer com o Claude Code.

### FASE 0 — Fundações (antes de qualquer funcionalidade)

**Passo 0.1 — Controlo de versões** · S
- Apagar `apps/mobile/.git`; `git init` na raiz; `.gitignore` unificado; primeiro commit do estado atual ("snapshot Lovable").
- Criar repositório **privado** no GitHub.
- *Feito quando:* `git log` mostra o snapshot; repositório remoto criado.

**Passo 0.2 — Verificar o protótipo Lovable** · S
- Instalar dependências, correr `typecheck`, `test`, `build`. Registar resultados (P-14).
- *Feito quando:* sabemos exatamente o que passa e o que falha.

**Passo 0.3 — Monorepo** · M · ✅ **Concluído (2026-10-06)**
- pnpm workspaces + Turborepo (ADR-05).
- Mover o Lovable para `apps/admin` (o painel e, temporariamente, as rotas da app como referência).
- Extrair `packages/types`, `packages/config`, `packages/game-engine` (com os testes respetivos).
- ~~Recriar `apps/mobile` limpo~~ → **adiado para o passo 3.1**: o protótipo Expo mantém-se como demo até o design system (NativeWind + TanStack Query + Zustand) ser criado; evita trabalho duplicado.
- *Feito quando:* `pnpm typecheck test build` passa na raiz. ✅ 5/5 typecheck, 23/23 testes (7 motor + 16 admin), build OK, as duas apps arrancam. O lint fica para o passo 0.4 (P-16).
- Notas: `pnpm` com `minimumReleaseAge` de 24h e `node-linker=hoisted`; React fixado em 19.2.3 em todo o monorepo (exigido pelo Expo); versões Expo do mobile em `~57.0.0` para respeitar a proteção de 24h.

**Passo 0.4 — Qualidade e CI** · S · ✅ **Concluído (2026-10-07)**
- ESLint + Prettier partilhados; GitHub Actions com lint/typecheck/test/build.
- Corrigir P-09 (nomes de estados) na documentação.
- *Feito quando:* um PR de teste corre o CI verde. ✅ Workflow `.github/workflows/ci.yml` verde no GitHub (execução 37605933325): lint com zero avisos, typecheck 5/5, 28 testes, build. P-09 e P-16 resolvidos; P-18 registado.

> **Fase 0 concluída.** Próximo: documento de regras de negócio (`docs/REGRAS_DE_NEGOCIO.md`) e depois o passo 1.1 (NestJS).

### FASE 1 — Backend base

**Passo 1.1 — NestJS esqueleto** · M
- Módulos base: config (validação de env com Zod), health check, logging estruturado, Helmet, CORS, rate limiting, filtro global de erros, versionamento `/api/v1`, Sentry.
- Deploy em Railway (staging).
- *Feito quando:* `GET /api/v1/health` responde em staging.

**Passo 1.2 — Base de dados (Neon + Prisma)** · L
- `schema.prisma` completo do MVP (secção 29 da especificação + correções P-05, P-07, P-08, P-10, P-12): `User`, `UserRole`, `Language`, `Course`, `Unit`, `Lesson`, `Exercise`, `ExerciseOption`, `Vocabulary`, `Phrase`, `AudioAsset`, `ContentReview`, `UserLessonProgress`, `UserExerciseAttempt`, `UserLanguageProgress`, `DailyActivity`, `RewardRule`, `LevelThreshold`, `XpTransaction`, `CoinTransaction`, `Friendship`, `Block`, `DailyChallenge`, `Achievement`, `UserAchievement`, `AdminAuditLog`, `Report`.
- Tabelas de jogo (`GameRoom`, `Game`, `GamePlayer`, `GameRound`, `GameAnswer`) já criadas, usadas na fase 4.
- UUIDs, `createdAt`/`updatedAt`, índices, *soft delete* onde fizer sentido.
- Seed de desenvolvimento com placeholders rotulados (a partir de `src/mocks`).
- *Feito quando:* migração aplicada em staging; seed corre; diagrama do modelo em `docs/`.

**Passo 1.3 — Auth com Clerk (ponta a ponta)** · M
- API: guard que valida o JWT do Clerk; webhook do Clerk → cria/atualiza `User`; papéis em `user_roles`; guard de papéis (RBAC) com a matriz de `permissions.ts`.
- Mobile: ecrãs de login/registo/recuperar palavra-passe + Google Sign-In.
- Admin: login real; acesso só com papel administrativo.
- **Eliminação de conta** (exigida pela Google Play) — endpoint + ecrã.
- *Feito quando:* um utilizador regista-se no telemóvel, aparece na BD e chama `GET /api/v1/me` autenticado; o admin recusa utilizadores sem papel.

### FASE 2 — Conteúdo (desbloqueia os linguistas)

**Passo 2.1 — API de conteúdo + workflow de revisão** · L
- CRUD de línguas, cursos, unidades, lições, exercícios, vocabulário, frases.
- Workflow `DRAFT → UNDER_REVIEW → APPROVED/REJECTED (→ ARCHIVED)` no servidor, com regra dos quatro olhos (P-03), versão, histórico e `AdminAuditLog`.
- Endpoints públicos da app devolvem **só** conteúdo `APPROVED` e ativo (teste obrigatório).

**Passo 2.2 — Média (R2)** · M
- Upload por *signed URL*; validação de tipo/tamanho; `AudioAsset` com falante, região, variante, notas.
- Leitura por URL público/CDN.

**Passo 2.3 — Ligar o admin à API real** · M
- Trocar os corpos de `src/services/admin.ts` por chamadas à API (assinaturas mantidas).
- *Feito quando:* um linguista cria uma palavra com áudio, outro revê e aprova, e a palavra fica disponível na API pública.
- **Marco:** a partir daqui os linguistas podem começar a introduzir conteúdo real em staging/produção.

### FASE 3 — App mobile MVP

**Passo 3.1 — Design system mobile** · M · ✅ 2026-10-07 (ADR-15)
- Tokens do Lovable → NativeWind; componentes base (botões, cartões, barras de progresso, estados loading/erro/vazio/offline), animações e haptics.

**Passo 3.2 — Onboarding + navegação** · M
- Splash, onboarding (6 ecrãs), tabs (Aprender, Desafios, Amigos, Ranking, Perfil).

**Passo 3.3 — Aprender: caminho, lição, exercícios, resultado** · L
- Caminho de aprendizagem a partir da API; exercícios do MVP (escolha múltipla, ouvir-escolher, ouvir-escrever, traduzir, ligar palavras, ordenar palavras, imagem). Pronúncia sem avaliação (só gravar) — avaliar se entra no MVP (ver secção 13).
- Áudio com pré-carregamento e cache.

**Passo 3.4 — Progresso e gamificação no servidor** · L
- `POST /progress/lessons/:id/attempts` (início) e `.../complete` (fim): o servidor valida respostas, calcula XP, moedas, nível, streak (com fuso do utilizador) e conquistas; transações idempotentes.
- Mobile mostra o resultado devolvido pelo servidor.
- Streak freeze: decidir se entra no MVP.

**Passo 3.5 — Perfil, amigos, rankings, desafio diário** · L
- Pedidos de amizade, bloquear, pesquisar; rankings diário/semanal/mensal/global/amigos/país (queries agregadas sobre `XpTransaction`); desafio diário gerado de conteúdo aprovado, com ranking próprio.
- ✅ **Amigos e rankings concluídos (2026-10-10, passo B8):** tabelas `friendships` e `user_blocks`; `GET /users/search`, `GET /friends`, pedidos (enviar, aceitar, recusar/cancelar), remover, bloquear/desbloquear; `GET /rankings?scope=weekly|global|friends|country` (top 50 + o meu lugar, a partir do livro-razão de XP). Web e app ligadas ao servidor; testes e2e contra a BD real. Falta: ranking mensal e ligas.

**Passo 3.6 — Analytics e erros** · S
- PostHog (eventos do funil: registo, 1.ª lição, retenção D1/D7) e Sentry no mobile.

**Marco MVP (= Fase 1 da especificação):** teste interno na Google Play (ver secção 10).

### FASE 4 — Arena Online e competição (= Fase 2 da especificação)

> **Estado da web (2026-10-12): concluída** — tudo o que a pessoa usa com sessão iniciada vem do servidor; o que ainda não existe está marcado "em breve" ou "dados de demonstração". Detalhe em "Fecho da web" abaixo. Próximo: passar para a app (Expo) os ecrãs feitos na web e depois as contas/chaves de produção.

**Passo 4.1 — Gateway Socket.IO + motor no servidor** · XL
- ✅ **Concluído (2026-10-11/12):** gateway `/arena` autenticado com o token do Clerk (`arena:ready` depois de validar); regras portadas do `@stp/game-engine` com teste de paridade; estado ao vivo em memória (ADR-08); perguntas do conteúdo visível (palavra e exercício visíveis), em cache 5 min; prazo oficial do servidor; validações anti-batota (na partida, vivo, ronda ativa, opção da pergunta, dentro do prazo, uma resposta); ronda fecha cedo quando todos respondem; reconexão com `room:resync`.
- Portar `engine.ts` para o servidor; `GameStateStore` em memória (ADR-08); temporizador por ronda com timestamps do servidor; perguntas só `APPROVED`, sem repetição, curva de dificuldade, morte súbita, `maxRounds`.
- Eventos do Adendo A28 tipados em `packages/contracts`.
- Validações anti-batota (A30): jogador pertence à partida, está vivo, ronda ativa, opção pertence à pergunta, dentro do tempo, primeira resposta.
- Reconexão com período de graça e *snapshot* de estado.

**Passo 4.2 — Matchmaking público + salas privadas** · L
- ✅ **Salas privadas concluídas:** código de 6 letras, anfitrião, pronto, começar, convites a amigos (tempo real + notificações, 10 min), modos Sobrevivência, **duelo 1 contra 1** (desafio direto a um amigo, começa sozinho) e **2 contra 2** (equipas A/B). Falta: matchmaking público (precisa de jogadores online) e torneios.
- Fila, salas `WAITING → STARTING → IN_PROGRESS → FINISHED/CANCELLED`, código de sala, host, configurações.

**Passo 4.3 — Ecrãs da Arena no mobile** · L
- Matchmaking, contagem, ronda, resultado, eliminação, espectador, final, resultados.

**Passo 4.4 — Recompensas e histórico** · M
- ✅ **Concluído:** prémios por lugar/vitória escritos no livro-razão (`arena_match`, `arena_duel`, `arena_teams`), idempotentes e com nova tentativa; regras em `docs/REGRAS_DE_NEGOCIO.md` §9 (4+ jogadores na Sobrevivência privada, 3 duelos premiados/dia, 10 partidas premiadas/dia, abandonar não paga); tabelas `arena_matches`/`arena_match_players`; `GET /arena/matches` e ecrã de histórico.

### Fecho da web (2026-10-12)

Ligado ao servidor (com sessão): aprender e lições Kriolu, desafio do dia, perfil, conquistas, amigos, perfil público, ranking, notificações, loja (proteção de streak), definições e eliminar conta, Arena (Sobrevivência, duelo, 2 contra 2, convites, histórico) e o painel (dashboard, revisão de palavras/frases/lições/exercícios, vocabulário, frases, cursos e unidades, lições, exercícios, utilizadores e papéis).

Correções de robustez feitas no fecho: transações com prazo de 20 s (a Neon fria passava os 5 s), `health` com duas tentativas, testes e2e um ficheiro de cada vez, e **regra de conteúdo reforçada** — um exercício nunca mostra uma palavra por aprovar (leituras públicas + revisão).

Fica para o fim, com chaves/contas (pedido do dono do produto): deploy (Railway), webhook do Clerk, armazenamento de áudios (R2), Play Store/EAS, pagamentos (Premium) e AdMob. Fica para depois: matchmaking público, torneios, ligas, ranking mensal, viagem, escolas.
- Recompensas por posição a partir de `RewardRule`; histórico de partidas; conquistas de vitórias.

### Preparação da publicação (2026-10-13)

Pronto sem contas: app Android (`com.falaneto.app`, 3 permissões, ícones, Arena em pt/en, botão voltar seguro), `apps/mobile/eas.json` (preview APK, produção AAB), imagem Docker da API + `railway.json` (guia em `docs/DEPLOY.md`), Política de Privacidade e Termos (web `/privacy` e `/terms`, app em Definições, aviso no registo), ícone 512 e imagens de destaque (`apps/mobile/store/`) e ficha da loja (`docs/PLAY_STORE.md`).

Falta (precisa do dono do produto): D-05 idade mínima, email de suporte, contas Railway / Expo / Google Play, chaves de produção do Clerk e webhook, capturas de ecrã num telemóvel real, teste fechado de 14 dias.

### Estado em 2026-11-08 (depois da preparação da publicação)

**Em produção (Railway, desde 2026-10-14):** API `stpapi-production.up.railway.app` e web `stpadmin-production.up.railway.app` (um Dockerfile por serviço, `RAILWAY_DOCKERFILE_PATH`; ver `docs/DEPLOY.md`). Clerk ainda em instância de desenvolvimento; webhook ligado.

**Feito desde então:**
- **Arena:** "Procurar partida" com desconhecidos (duelo e Sobrevivência pública que começa sozinha) — só na web; pronúncia real na revelação de cada ronda (web e app).
- **Som e voz:** som + aviso no topo do ecrã para notificações novas (web e app); "olá" do Neto nas boas-vindas; perguntas lidas em voz alta só na língua da interface (a palavra em Kriolu nunca é lida por voz automática).
- **Gravações de pronúncia (trabalho pago):** papéis Falador/Ouvinte por língua, consentimento 18+, tarefas com quantidade, preço em € e prazo; 2 votos iguais decidem, perguntas de controlo, quem grava nunca avalia; ganhos, dados de pagamento (SEPA, MB WAY, Stripe) e pagamentos registados; painel `/admin/voice`; guia `/voice/guide`. Armazenamento só local por agora.
- **Painel com dados reais em todas as páginas** (línguas, Arena, desafio do dia, rankings, conquistas, analytics de 30 dias, auditoria, regras, pesquisa); Premium, anúncios e denúncias dizem que ainda não há dados.
- **Portfólio:** `apps/api/scripts/seed-portfolio.ts` cria atividade de demonstração numa base de dados à parte (recusa a produção).
- **Commits:** sem coautoria (regra do dono, 2026-10-20); o histórico no GitHub foi reescrito para a retirar.

**Próximos passos:**

| # | Passo | Precisa do dono |
|---|---|---|
| 1 | APK de teste (EAS) apontado à API de produção | Conta Expo |
| 2 | Capturas do painel com dados de demonstração | Branch `portfolio` no Neon |
| 3 | Gravações online (Cloudflare R2, `PUBLIC_API_URL`) e contratar falantes em Portugal | Conta R2 |
| 4 | "Procurar partida" na app Android | — |
| 5 | Teste de microfone e avisos de tarefa nova / pagamento | — |
| 6 | Retirar a demonstração antiga da Arena (perguntas de exemplo sem sessão) | Confirmar |
| 7 | Domínio, Clerk em produção, D-05, email de suporte, Google Play (teste fechado de 14 dias) | Decisões e contas |
| 8 | Stripe Connect para pagar falantes (no fim) | Conta Stripe |

**Passo 4.5 — Notificações push** · M
- Expo Notifications / FCM; preferências por categoria.

### FASE 5 — Monetização

**Passo 5.1 — Premium (RevenueCat + Google Play Billing)** · L
- Produtos mensal/anual; webhook RevenueCat → `Subscription`; o servidor decide o acesso Premium (*entitlement*).
- Requer a app num *track* de teste da Play Console.

**Passo 5.2 — AdMob** · M
- Só nos *placements* permitidos; consentimento RGPD (UMP); Premium remove anúncios.

### FASE 6 — Publicação

**Passo 6.1 — Testes E2E e endurecimento** · M
- Maestro para os fluxos críticos; testes de carga básicos na Arena; revisão de segurança.

**Passo 6.2 — Google Play** · M (+ ≥14 dias de teste fechado)
- Ver checklist da secção 10.

### FASE 7 — Pós-lançamento (= Fase 3 da especificação)

Modo eliminatório avançado, torneios, ligas semanais, Redis + múltiplas instâncias, mais línguas (Angolar, Lung'Ie), avaliação de pronúncia, conteúdo cultural, escolas (Stripe B2B), iOS.

---

## 8. Comparação com o plano de 15 passos

O plano proposto é uma boa base. As alterações abaixo seguem boas práticas de engenharia:

| # | Plano original | Alteração | Motivo |
|---|---|---|---|
| — | (não existia) | **Passo 0.1 Git** antes de tudo | Hoje não há controlo de versões; qualquer erro na migração seria irreversível. |
| 1 | Analisar o Lovable | Mantido (feito neste documento) + verificar testes/build (0.2) | — |
| 4→5 | Clerk antes do NestJS | NestJS + BD **antes** do Clerk; Clerk feito ponta a ponta (mobile + API + webhook + admin) | A auth só está completa quando o servidor valida o token e cria o utilizador na BD. |
| — | (admin não aparecia) | **Fase 2 inteira para conteúdo + admin real** | O conteúdo aprovado é o caminho crítico; os linguistas precisam do admin cedo. |
| 11 | Cloudinary/R2 no passo 11 | Média no **passo 2.2** e só R2 no início | O áudio é núcleo do MVP e o admin precisa de uploads para introduzir conteúdo. |
| 10 | Socket.IO **+ Redis** | Socket.IO **sem Redis** no início | A especificação pede para começar simples; Redis só para várias instâncias. |
| 14 | Testes no fim | **Testes em todos os passos** (Definition of Done) | Testar no fim é caro e deixa regras críticas (XP, pontuação) sem proteção. |
| — | (não existiam) | CI, ambientes, Sentry, PostHog, eliminação de conta, notificações | Requisitos da especificação e da Google Play. |
| 15 | .aab no fim | Testes internos na Play Console **logo após o MVP** | Contas pessoais novas precisam de teste fechado com testadores durante ≥14 dias antes de produção; o RevenueCat precisa da app num *track* de teste. |

---

## 9. Caminho crítico: conteúdo linguístico

O desenvolvimento pode estar pronto e a app continuar vazia. Para evitar isso:

1. **Recrutar já** pelo menos 2 especialistas por língua (1 criador + 1 revisor), de preferência falantes nativos/professores.
2. **Definir o padrão de conteúdo** com eles: ortografia adotada, variantes regionais, como registar o falante e a região dos áudios, critérios de aprovação.
3. **Lote mínimo para o MVP (a definir com os linguistas):** por exemplo, 6 unidades × 3–4 lições × 8–10 exercícios, com áudio gravado por falantes reais. O suficiente também para a Arena não repetir perguntas.
4. **Ferramentas:** o admin deve estar em produção (com auth real) no fim da Fase 2.
5. **Gravações:** guia simples de gravação (sítio silencioso, formato, duração máxima) e consentimento escrito dos falantes para uso das vozes.
6. **Créditos:** reconhecer os autores/revisores na app (aumenta confiança e colaboração).

---

## 10. Checklist Google Play

- [ ] Conta de programador na Play Console (verificação de identidade).
- [ ] `applicationId` definitivo (ex.: `st.linguastp.app` — **não pode mudar depois de publicado**).
- [x] Ícone, *adaptive icon*, splash, descrição em PT e EN (`docs/PLAY_STORE.md`). Falta: capturas de ecrã.
- [x] Política de privacidade e termos escritos (web `/privacy`, `/terms`). Falta: web online.
- [ ] Formulário *Data safety* (dados recolhidos: email, nome, progresso, analytics, publicidade).
- [x] **Eliminação de conta** dentro da app (Definições) e na web (`/settings/account`).
- [ ] Classificação de conteúdo (questionário IARC) e público-alvo. Se crianças forem público-alvo → *Families Policy* (restrições a anúncios e analytics).
- [x] Permissões mínimas (microfone só se o exercício de pronúncia entrar; pedir no momento de uso).
- [ ] API level alvo exigido pela Google no momento (Expo SDK atual cumpre).
- [x] Configuração EAS (`.aab`, `versionCode` automático). Falta: conta Expo e a primeira build.
- [ ] Testes internos → **teste fechado com testadores durante pelo menos 14 dias** (regra para contas pessoais novas) → produção.
- [ ] Produtos de subscrição criados na Play Console e ligados ao RevenueCat.
- [ ] AdMob com consentimento RGPD (UMP) para utilizadores da UE/UK.

---

## 11. Riscos e mitigação

| Risco | Impacto | Probabilidade | Mitigação |
|---|---|---|---|
| Falta de conteúdo aprovado | Muito alto | Alta | Secção 9; admin real cedo; lote mínimo definido com linguistas. |
| Reescrita mobile maior do que o previsto | Alto | Média | Design system primeiro (3.1); reaproveitar tokens; MVP só com ecrãs essenciais. |
| Batota na Arena | Alto | Média | Servidor autoritativo, ids de opção, timestamps do servidor, rate limit, testes de fraude. |
| Arena vazia (poucos jogadores online) | Alto | Alta no início | Salas privadas com amigos primeiro; mínimo de jogadores configurável; mostrar horários com mais jogadores. Bots **só** se assinalados claramente como bots. |
| Dados de menores (RGPD/Families) | Alto | Média | Decidir público-alvo cedo (secção 13); idade mínima no registo; anúncios adequados. |
| Atraso na publicação (teste fechado obrigatório) | Médio | Alta | Iniciar o teste fechado logo após o MVP. |
| Custos de serviços (Clerk, Neon, Railway, R2, PostHog) | Médio | Média | Planos gratuitos no início; alertas de custo; revisão mensal. |
| Divergência entre especificação, handoff e código | Médio | Alta | Este documento + ADRs como referência única; atualizar no mesmo PR que muda o código. |
| Dependência do Lovable | Médio | Média | ADR-01 (congelar). |

---

## 12. Como trabalhar com o Claude Code

1. **Um passo deste plano por sessão/PR.** Nunca "faz o backend todo".
2. **Prompt-modelo para cada passo:**

   ```text
   Contexto: lê docs/PLANO_DE_ENGENHARIA.md (passo X.Y), documentation.md (secções N) e docs/HANDOFF.md.
   Objetivo: <objetivo do passo>.
   Restrições: regras da secção 6.1; não alterar o que está fora do âmbito; manter assinaturas dos services.
   Entregáveis: <lista do passo>.
   Antes de codificar: apresenta o plano e os ficheiros a criar/alterar e espera pela minha aprovação.
   No fim: corre lint, typecheck e testes; mostra os resultados; atualiza a documentação; propõe a mensagem de commit.
   ```

3. **Verificar sempre:** pedir a saída real dos testes/build e testar no telemóvel quando há UI.
4. **Registar decisões** em `docs/adr/` quando algo muda (stack, regras, modelo de dados).
5. **Não aceitar** conteúdo em Forro gerado por IA como correto, mesmo para "exemplos".

---

## 13. Decisões pendentes (precisam de resposta do dono do produto)

| # | Pergunta | Recomendação |
|---|---|---|
| D-01 | ~~Congelar o Lovable e passar a trabalhar só no repositório (ADR-01)?~~ | **Decidido (2026-10-06):** sim; a interface é terminada aqui. |
| D-02 | Manter o admin do Lovable em vez de Next.js (ADR-03)? | Sim. |
| D-03 | ~~pnpm ou bun para o monorepo (ADR-05)?~~ | **Decidido (2026-10-06):** pnpm. |
| D-04 | Só R2 no início, sem Cloudinary (ADR-09)? | Sim. |
| D-05 | Público-alvo inclui menores de 13/16 anos? | Definir já: muda regras de registo, anúncios e analytics. |
| D-06 | Vidas nas lições (P-15) existem no MVP? | Não; não bloquear a aprendizagem (secção 32 da especificação). |
| D-07 | Exercício de pronúncia (gravação) entra no MVP? | Não; evita pedir permissão de microfone no MVP. |
| D-08 | Arena entra no MVP ou fica na Fase 2 (como diz a especificação)? | Fase 2; MVP focado em aprender + social básico. |
| D-09 | Tabela de recompensas definitiva (lições, diário, Arena por posição)? | Definir uma vez em `RewardRule`; valores atuais são provisórios. |
| D-10 | ~~Nome final da app~~ e `applicationId`? | **Nome decidido (2026-10-07): "Fala Neto"** — junta a mascote Neto (tartaruga marinha de São Tomé e Príncipe e Cabo Verde) com "fala"; na loja com subtítulo, ex.: "Fala Neto: Forro, Kriolu e mais". Pendente: pesquisa de marca (INPI PT/BR — atenção à confusão com "Felipe Neto"/"Nova Fala"), domínio (falaneto.com já registado; .app/.st/.cv aparentemente livres) e `applicationId` (decidir antes da Fase 6, é permanente). O nome vive só em `@stp/config` (`APP_NAME`). |
| D-11 | Quem são os linguistas (criador + revisor) e quando começam? | Antes do fim da Fase 2. |
