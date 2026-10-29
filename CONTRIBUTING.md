# Contribuir — Fala Neto

Guia curto para quem continua o projeto. Detalhes em `docs/PLANO_DE_ENGENHARIA.md` e `docs/HANDOFF.md`.

## Regras absolutas
- **Nunca inventar** palavras, traduções ou pronúncias em Forro/Angolar/Lung'Ie. Usar placeholders rotulados até existir conteúdo aprovado no Admin.
- Só conteúdo `APPROVED` chega à app; sugestões de IA são sempre `DRAFT`; quem cria não aprova.
- Sem segredos no repositório (é público): apenas variáveis públicas nos `.env.example`.
- Anúncios nunca durante perguntas, countdowns, matchmaking, multiplayer ou lições (`apps/admin/src/config/ads.ts`).
- Multiplayer é server-authoritative (`@stp/types/game-contract`).
- Modos de jogo aprovados (Sobrevivência, 1v1, 2v2, Sala Privada, Espectador): não redesenhar sem necessidade técnica.

## Onde mexer
| Precisa de… | Ficheiro |
|---|---|
| Valores de produto / flags | `packages/config/src/index.ts` (`@stp/config`) |
| Tipos de domínio | `packages/types/src/` (`@stp/types`) |
| Regras da Arena | `packages/game-engine/src/index.ts` (`@stp/game-engine`) |
| URLs da API (web) | `apps/admin/src/config/api.ts` |
| Dados (web) | `apps/admin/src/services/*` (nunca importar `src/mocks/` em ecrãs) |
| Permissões admin | `apps/admin/src/admin/permissions.ts` |
| Workflow de conteúdo | `apps/admin/src/admin/workflow.ts` |

## Comandos
```bash
pnpm install
pnpm dev:admin     # http://localhost:8080
pnpm dev:mobile    # Expo
pnpm typecheck && pnpm test && pnpm build
```

## Dependências
- `pnpm` com `minimumReleaseAge` de 24h (proteção contra pacotes comprometidos). Se uma versão for recusada por ser recente, usar a versão anterior em vez de desligar a proteção.
- Uma única versão de React no monorepo (`overrides` em `pnpm-workspace.yaml`), alinhada com o Expo.

## Commits
Mensagens curtas no imperativo, estilo Conventional Commits (ex.: `feat(api): adicionar módulo de progresso`). Um tema por commit.
