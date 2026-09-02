# Rules for all projects



## Prisma 7 Configuration Rules
- **NEVER add `url = env(...)` inside `datasource db` in `apps/api/src/prisma/schema.prisma`.**
- This project uses **Prisma 7+**, where the `url` property inside `schema.prisma` is deprecated/unsupported and triggers Error `P1012`.
- Connection URLs in Prisma 7 are managed via `prisma.config.ts` or passed at runtime via environment variables/adapters.

## Language and Communication
- **ALWAYS communicate and respond in ENGLISH.**
- **NEVER** write or respond in Farsi (Persian) or any other language, even if the user prompts in that language.
- **Answer Before Acting**: If the user asks a question (e.g., "can we do X?"), ALWAYS answer the question and ask for confirmation before taking any action or modifying files. Do not silently implement a feature if the user only asked if it is possible.

## Database Migration Rules
- **Migration Plan Required**: Every time a database schema change is made (e.g., modifying `schema.prisma`), a proper migration plan must be formulated and executed to generate migration files.
- Avoid using `prisma db push` in isolation, as it bypasses migration file generation and causes the local database to drift from the migration history.
- Always use `prisma migrate dev --name <migration_name>` (or `prisma migrate diff`) to generate proper migration files so they can be safely checked into version control and applied to the production database during deployment.
- **Destructive Operations**: NEVER use `--force`, `--accept-data-loss`, or run `prisma migrate reset` automatically without pausing to request explicit permission from the user. Any operation that causes data loss must be thoroughly explained and approved by the user first.

## UI Components
- **Confirm Dialogs**: NEVER use the native browser `window.confirm`. ALWAYS use the custom `notify.confirm` dialog powered by the `Toaster` component (e.g., `import { notify } from '@/lib/notify'`).

## Large File Downloads (> 30MB)
- Whenever a dependency, SDK component, engine binary, 3D asset, or archive is larger than **30 MB**, **DO NOT** let tools or background tasks silently attempt slow downloads that may stall or timeout.
- **ALWAYS** provide the direct download URL(s) to the user so they can download it directly using a browser or download manager (e.g. IDM), specify the filename, and provide instructions on where to place it.

## RTL Text & Number/Symbol Formatting Rules
- **Special Care for Signs & Symbols in RTL**: In Right-to-Left (RTL) contexts (Persian/Arabic), numbers with adjacent symbols like `+`, `-`, `%`, `$`, or equations (`+2`, `-1`, `50%`, `14 + 2 = 16 vs 12`) can suffer from Unicode BiDi reordering bugs (e.g., `+2` displaying as `2+` or equations reversing order).
- **Enforce LTR Containers / LRM for Math & Metrics**: Always wrap numbers, signed modifiers, equations, and stat breakdowns in an explicit `Directionality(textDirection: TextDirection.ltr, child: ...)` widget or prepend the Unicode Left-to-Right Mark (`\u200E`) so that symbols and signs stay in their proper, readable positions.

## Choice Options UI Rule
- **NO Difficulty / Risk Badges on Choices**: NEVER display difficulty levels, risk indicators (e.g., `'خطرناک'`, `'متوسط'`, `'ایمن'`, `'high'`, `'medium'`, `'low'`, `'safe'`), or DC target badges (e.g., `'DC 12'`) on choice buttons or cards in the UI. Choices must ONLY display the clean literary narrative text of the action.

## Database Integrity & No In-Code Fallbacks
- **No Hardcoded/Fallback Data for Database Entities**: If an entity, field, or collection exists in the database or is designed to exist in the database (e.g., stories, archetypes, backgrounds, stats, lore, items, factions, locations), **NEVER** write fallback or hardcoded mock/dummy data for it inside application code or repository layers.
- If data is missing or empty in the database, return empty collections or let the UI handle empty states cleanly. Data must always originate from the database/API, never from in-code fallbacks.



