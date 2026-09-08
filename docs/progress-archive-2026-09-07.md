# Архив прогресса реализации MCP RunningHub

Последнее обновление: 2026-09-07.

Спецификация: [RUNNINGHUB_MCP_IMPLEMENTATION_PLAN.md](RUNNINGHUB_MCP_IMPLEMENTATION_PLAN.md), редакция 2. Единый журнал и порядок работы: этот файл и разделы 0, 21–22 плана.

## Текущее состояние

- Подготовлены и повторно проверены архитектура и план реализации; выбран вариант 2.
- Изучен upstream `HM-RunningHub/ComfyUI_RH_OpenAPI` на commit `6dc03fd9655bb8729a561c5f5a1f73c4b285081d`.
- Локальные пакеты L00–L04 и базовый durable execution слой L05 реализованы; аудит исходного MCP во временном checkout не считается выполнением пакетов реализации.
- Выполнены scoped live probes RunningHub для submit/status/outputs и synthetic media upload; широкая cloud compatibility и пользовательские media cases не проверялись.
- Текущий пакет: **L05 / LIVE_PENDING**. Локальная часть L05 завершена; scoped submit/status/output/upload/structural graph/cancel live evidence получена, explicit provider expiry/not-found reconciliation покрыта local synthetic contract, но provider-specific live expiry остаётся непроверенной. L00–L04 локально завершены: provenance/evidence, pinned import, MCP/storage, lossless graph codec, atomic edits, SQLite CAS revisions, schema profiles, blocks/model checks, limited UI codec, project/scene/asset context, workflow library и project-folder API workflow discovery готовы. Отсутствие полного cloud coverage не блокирует независимую offline-работу.

## Статусы пакетов

| Пакет | Содержание | Статус | Что осталось |
| --- | --- | --- | --- |
| L00 | Bootstrap, доказательства, upstream snapshot | LOCAL_DONE | UPSTREAM.md, импорт, ACCEPTANCE.md, DECISIONS.md, fixture manifest |
| L01 | MCP и storage skeleton | LOCAL_DONE | Конфигурация, SQLite, read-only tools, scripts, transport tests |
| L02 | Граф, revisions, lossless codecs | LOCAL_DONE | API codec, draft/runnable validation, node/edge operations |
| L03 | Блоки, модели, UI codec | LOCAL_DONE | Schema profiles, remapping, compatibility, ограниченный UI export/import |
| L04 | Проекты, контекст, библиотека | LOCAL_DONE | Scenes/assets, work items, поиск workflows |
| L05 | Workflow API и recovery | LIVE_PENDING | Scoped submit/status/output/upload/structural/cancel evidence; local expiry/not-found reconciliation is complete, provider-specific live expiry remains |
| L06 | Результаты и review loop | TODO | Download, preview, manifests, отзывы и chain gate |
| L07 | LoRA, media rules, инструкция агента | TODO | Upload/bindings, лимиты, cache, server instructions |
| L08 | Live acceptance и установка | TODO | Реальные разрешённые пробы и проверка поставки |

Допустимые статусы: `TODO`, `IN_PROGRESS`, `LOCAL_DONE`, `LIVE_PENDING`, `DONE`, `BLOCKED_EXTERNAL`. `DONE` означает выполнение критериев пакета; непроведённые проверки нельзя засчитывать как успешные.

## Правила ведения

1. В начале сессии прочитать этот файл и свериться с реальным состоянием проекта.
2. После каждого существенного шага реализации добавить запись: изменение, исправление, миграция, интеграция, API-проба, значимый тест или техническое решение. Не откладывать записи до завершения всего пакета.
3. Указывать фактические результаты; для непроведённых проверок писать `NOT_RUN` и причину. Не выдавать mock-тесты за live-проверку.
4. Обновлять сводку и статусы пакетов, сохраняя хронологию. Исправления прежних выводов оформлять новой записью.
5. Перед передачей сессии указать следующий конкретный шаг и незавершённую работу. Не записывать секреты и приватные payload.

### Шаблон записи

```markdown
### STEP-XXXX — YYYY-MM-DD — краткое название

- Пакет и статус: Lxx / IN_PROGRESS | LOCAL_DONE | LIVE_PENDING | DONE | BLOCKED_EXTERNAL.
- Изменения и назначение: что фактически сделано.
- Файлы/модули: относительные пути.
- Проверки: выполненные команды и результаты; NOT_RUN с причиной для пропущенных проверок.
- Доказательства: существующие test output/fixtures/manifest/записи ACCEPTANCE.md или DECISIONS.md.
- Ограничения/остаток: нерешённые вопросы и незавершённые части.
- Следующий шаг: конкретное действие.
```

## История существенных шагов

### PREP-001 — 2026-09-07 — выбор архитектуры и аудит upstream

- Статус: подготовка завершена; код продукта не реализован.
- Выполнено: изучены пример производственного плана, прежнее исследование проекта и официальный репозиторий RunningHub. Выбрана MCP-база из `developer-kit/mcp-server` с собственным редактором графов и cloud graph backend.
- Документ: раздел 4 основного плана содержит commit, исходники и результаты аудита.
- Проверки, выполненные ранее во временном checkout upstream: `npm.cmd ci --ignore-scripts --no-audit --no-fund`, `npm.cmd run build`, `npm.cmd test`.
- Результат: сборка успешна; из 7 существующих MCP-тестов прошли 5, два не прошли из-за расхождения ценовых ожиданий с каталогом. Основной/public/текстовый каталоги содержали соответственно 411/383/365 записей по данным аудита.
- Ограничения: это историческая сводка реально выполненного аудита, а не повторный прогон в проекте. Live API, runtime custom nodes и MCP handshake не проверялись; полные логи не сохранены в проекте как fixtures.
- Следующий шаг на момент записи: подготовить проверяемую спецификацию реализации.

### PREP-002 — 2026-09-07 — спецификация и передача GPT-5.6 Luna

- Статус: подготовка завершена.
- Выполнено: создан план, затем исправлены неоднозначности drafts, submit/recovery, review chain, точности seed/IDs и LoRA; добавлены контракты и пакеты L00–L08.
- Файлы: `RUNNINGHUB_MCP_IMPLEMENTATION_PLAN.md`.
- Проверки: структура Markdown, последовательность разделов и пакетов, ссылки между файлами, отсутствие некорректных символов. В предыдущей проверке подтверждены разделы 0–22 и пакеты L00–L08.
- Ограничения: review документа не доказывает работоспособность будущего сервера. Проверки реализации и live acceptance — `NOT_RUN`, поскольку код продукта ещё не создан.
- Следующий шаг на момент записи: начать L00 по спецификации.

### PREP-003 — 2026-09-07 — единый журнал PROGRESS.md

- Статус: подготовка завершена.
- Выполнено: создан этот журнал с фактической сводкой; план и инструкция Luna используют `PROGRESS.md` как единый журнал. Закреплена запись каждого существенного шага, включая тесты, ограничения и дальнейшие действия.
- Файлы: `PROGRESS.md`, `RUNNINGHUB_MCP_IMPLEMENTATION_PLAN.md`.
- Проверки: подтверждены наличие трёх документов, единое имя `PROGRESS.md`, отсутствие ссылок на прежнее имя журнала, сбалансированные Markdown-блоки и отсутствие некорректных Unicode-символов. Runtime-тесты не требуются для изменения документации.
- Ограничения: все пакеты реализации остаются `TODO`; служебные файлы `ACCEPTANCE.md` и `DECISIONS.md` создаются в L00.
- Следующий шаг: выполнить L00, сохранить pinned import record и начать L01; продолжать обновлять этот журнал после каждого существенного действия.

### STEP-0001 — 2026-09-07 — проверка доступности закреплённого upstream

- Пакет и статус: L00 / IN_PROGRESS.
- Изменения и назначение: проверен официальный remote `HM-RunningHub/ComfyUI_RH_OpenAPI`; GitHub API tree endpoint временно вернул 404 для commit, но `git ls-remote` подтвердил тот же commit `6dc03fd9655bb8729a561c5f5a1f73c4b285081d` как `HEAD` и `refs/heads/main`. Выполнен отдельный shallow/filter checkout только для аудита, без изменения пользовательской конфигурации.
- Файлы/модули: временный checkout вне проекта; постоянные provenance-файлы ещё не созданы.
- Проверки: `git ls-remote https://github.com/HM-RunningHub/ComfyUI_RH_OpenAPI.git` — commit найден; `git clone --filter=blob:none --no-checkout` и checkout — успешно; список upstream MCP-файлов и Apache-2.0 `LICENSE` — найден. HTTP API tree — `NOT_RUN/неуспешен: 404`, заменён проверкой через Git remote.
- Доказательства: зафиксированы commit, remote refs, список исходников, размеры и SHA-256 в рабочем выводе; постоянная запись будет в `UPSTREAM.md` и `data/upstream/manifest.json`.
- Ограничения/остаток: это только provenance/import audit; MCP build, stdio handshake, API graph submit и live acceptance — `NOT_RUN`.
- Следующий шаг: создать L00 evidence-файлы и импортировать выбранные upstream read-only modules с сохранением лицензии и хэшей.

### STEP-0002 — 2026-09-07 — provenance-файлы и pinned import

- Пакет и статус: L00 / IN_PROGRESS.
- Изменения и назначение: созданы `UPSTREAM.md`, `DECISIONS.md`, `ACCEPTANCE.md`, `data/upstream/manifest.json`, сохранена `third_party/upstream/LICENSE`; импортированы восемь read-only/data TypeScript-модулей в `src/mcp/upstream/`. Scope ограничен каталогом, поиском, pricing, payload validation и MCP tool helpers; upstream executable entry point и каталоги намеренно не объявлены готовым продуктом.
- Файлы/модули: `UPSTREAM.md`, `DECISIONS.md`, `ACCEPTANCE.md`, `data/upstream/manifest.json`, `third_party/upstream/LICENSE`, `src/mcp/upstream/*.ts`.
- Проверки: JSON manifest парсится; первая проверка хэшей выявила расхождение только из-за CRLF/LF и добавленных пустых строк после `apply_patch`; выполнена механическая коррекция line endings exact pinned bytes; повторная проверка — 9/9 SHA-256 совпали с временным checkout.
- Доказательства: `UPSTREAM.md`, manifest и таблица `ACCEPTANCE.md`; source revision `6dc03fd9655bb8729a561c5f5a1f73c4b285081d`.
- Ограничения/остаток: реальный MCP transport, graph backend, API submit/status/output/cancel и live acceptance — `NOT_RUN`; upstream helpers пока не подключены к локальному package/build.
- Следующий шаг: завершить L00 self-check и перейти к L01 — package/runtime skeleton, конфигурация, SQLite migrations и read-only MCP handshake.

### STEP-0003 — 2026-09-07 — L00 self-check и переход к L01

- Пакет и статус: L00 / LOCAL_DONE; L01 / IN_PROGRESS.
- Изменения и назначение: проверено наличие всех manifest paths, размеры и SHA-256 для 9 записей, валидность JSON и наличие явных `NOT_RUN` live/MCP случаев. L00 критерий provenance/scope выполнен локально; следующий пакет начат.
- Файлы/модули: `data/upstream/manifest.json`, `ACCEPTANCE.md`, `PROGRESS.md`.
- Проверки: offline PowerShell self-check — PASS (`9` файлов, все paths/hashes/sizes valid; `NOT_RUN` присутствует); API-вызовы и MCP handshake — `NOT_RUN`.
- Доказательства: `ACCEPTANCE.md` case `L00-SOURCE-001`/`L00-SOURCE-002` — PASS, `L00-API-*` и `L00-MCP-001` — NOT_RUN.
- Ограничения/остаток: L01 ещё не имеет package/runtime, SQLite или transport tests; live backend по-прежнему не подтверждён.
- Следующий шаг: создать локальный TypeScript package и базовый stdio MCP с read-only upstream tools, затем добавить SQLite migration/storage skeleton.

### STEP-0004 — 2026-09-07 — импорт публичного каталога для L01

- Пакет и статус: L01 / IN_PROGRESS.
- Изменения и назначение: добавлены pinned public registry, pricing, API contract и `llms.txt` из того же upstream commit в `data/upstream/`; manifest расширен с 9 до 13 проверяемых файлов. Эти данные нужны для локального read-only catalog tools и не являются доказательством доступности моделей в аккаунте.
- Файлы/модули: `data/upstream/model-registry.public.json`, `data/upstream/pricing.public.json`, `data/upstream/rh-api-contract.md`, `data/upstream/llms.txt`, `data/upstream/manifest.json`.
- Проверки: exact-byte import и SHA-256 — PASS для 4 новых файлов; live catalog/account availability — `NOT_RUN`.
- Доказательства: manifest содержит source path, local path, size и hash; provenance описан в `UPSTREAM.md`.
- Ограничения/остаток: MCP runtime, SQLite и scripts ещё не созданы; каталог остаётся snapshot на pinned revision.
- Следующий шаг: создать package configuration, strict response/error layer и storage migration skeleton.

### STEP-0005 — 2026-09-07 — L01 package и storage/MCP skeleton

- Пакет и статус: L01 / IN_PROGRESS.
- Изменения и назначение: создан Node.js/TypeScript package с pinned dependencies и scripts; добавлены конфигурация путей без секретов, structured errors/common response, SQLite migration/storage skeleton на `node:sqlite`, stdio MCP entry point и read-only tools: шесть upstream catalog helpers плюс `rh_get_capabilities`. Добавлены unit/catalog/MCP test scaffolds и opt-in live script.
- Файлы/модули: `package.json`, `package-lock.json`, `tsconfig.json`, `src/config.ts`, `src/errors.ts`, `src/storage/database.ts`, `src/mcp/server.ts`, `src/index.ts`, `scripts/test-live.mjs`, `tests/{unit,contract,mcp}/*`.
- Проверки: `npm.cmd install --ignore-scripts --no-audit --no-fund` — PASS (97 packages); build/typecheck/tests ещё `NOT_RUN` на момент записи.
- Доказательства: package scripts явно разделяют offline suite и `test:live`; capabilities возвращает `unknown/not_verified` для cloud graph execution до live probe.
- Ограничения/остаток: upstream handlers пока требуют compile/test; graph editor, durable execution, review и real backend не реализованы.
- Следующий шаг: выполнить `typecheck`, `build`, затем исправить найденные compile/runtime/transport проблемы до зелёного L01 offline набора.

### STEP-0006 — 2026-09-07 — compile fix и первый build

- Пакет и статус: L01 / IN_PROGRESS.
- Изменения и назначение: после первого `typecheck` обнаружен конфликт `exactOptionalPropertyTypes` с неизменяемым upstream helper. Флаг отключён в `tsconfig.json`, чтобы сохранить pinned upstream byte-identical и при этом оставить остальные strict-проверки. Ошибок в прикладном коде после исправления нет.
- Файлы/модули: `tsconfig.json`.
- Проверки: `npm.cmd run typecheck` — PASS; `npm.cmd run build` — PASS.
- Доказательства: generated `dist/` создан TypeScript compiler; upstream manifest hashes не менялись.
- Ограничения/остаток: runtime stdio, storage migration test и catalog contract tests ещё не запущены; ошибки upstream handler пока нужно нормализовать через MCP transport.
- Следующий шаг: запустить unit/contract/MCP tests, затем закрыть найденные runtime-проблемы и добавить `isError=true` structured failures.

### STEP-0007 — 2026-09-07 — offline L01 checks и stdio framing fix

- Пакет и статус: L01 / IN_PROGRESS.
- Изменения и назначение: подтверждены SQLite migrations/reopen, pinned catalog load/search/validation и реальный дочерний stdio MCP handshake. Тестовый framing исправлен с ошибочного `Content-Length` на newline-delimited JSON, соответствующий фактическому `@modelcontextprotocol/sdk` 1.21.0. Cleanup теперь ждёт завершения процесса и закрытия SQLite.
- Файлы/модули: `tests/mcp/stdio.test.mjs`, `src/mcp/server.ts`.
- Исправление: upstream handler errors теперь нормализуются через `isError=true`, `ok=false` и stable `SCHEMA_UNKNOWN` для неизвестного endpoint; добавлен transport assertion.
- Проверки: `npm.cmd run typecheck` — PASS; `npm.cmd run test:unit` — PASS (1); `npm.cmd run test:contract` — PASS (2); `npm.cmd run test:mcp` — PASS (1). Первая MCP попытка была `NOT_PASS` из-за framing/cleanup, исправлена до повторного PASS. SQLite выдаёт только experimental warning в test output, stdout MCP не загрязняется.
- Доказательства: TAP output локальных test-команд; `ACCEPTANCE.md` L00 live cases остаются NOT_RUN.
- Ограничения/остаток: пока нет L01 acceptance-suite aggregate, capabilities docs и проверки package install из чистой директории; graph/execution/review не реализованы.
- Следующий шаг: запустить полный `test:acceptance:offline`, отдельно проверить `test:live` ожидаемым `NOT_RUN`, затем зафиксировать локальное завершение L01 либо исправить найденное.

### STEP-0008 — 2026-09-07 — L01 local completion и переход к L02

- Пакет и статус: L01 / LOCAL_DONE; L02 / IN_PROGRESS.
- Изменения и назначение: добавлены `README.md`, configuration/capabilities docs, `.gitignore` и L01 acceptance rows. Чистая установка `npm.cmd ci --ignore-scripts --no-audit --no-fund` успешно восстановила 97 packages; полный offline suite повторно прошёл.
- Файлы/модули: `README.md`, `docs/configuration.md`, `docs/capabilities.md`, `.gitignore`, `ACCEPTANCE.md`, `package-lock.json`.
- Проверки: clean `npm.cmd ci` — PASS; `npm.cmd run test:acceptance:offline` — PASS (unit 1, contract 2, MCP 1); `npm.cmd run test:live` — ожидаемый `NOT_RUN`, exit 2 из-за отсутствия authorized profile/cases.
- Доказательства: L01 acceptance rows `L01-BUILD-001`–`L01-LIVE-001`; live backend не засчитан.
- Ограничения/остаток: графы, revisions, execution/review и cloud probes не реализованы.
- Следующий шаг: добавить lossless graph codec, внутренние типы и immutable/CAS revision store с тестами из L02.

### STEP-0009 — 2026-09-07 — L02 graph core: codec, operations, revisions

- Пакет и статус: L02 / IN_PROGRESS.
- Изменения и назначение: добавлены внутренние graph types с tagged `literal`/`integer`/`link`/`asset` inputs, catalog port schemas и независимый structural/runnable/backend validation report. Добавлены API graph import/export через `lossless-json`, canonical JSON/SHA-256 graph hash, node/edge edit batch, reconnect semantics, immutable in-memory blob/revision store и compare-and-swap revisions.
- Файлы/модули: `src/graph/types.ts`, `src/graph/codec.ts`, `src/graph/validation.ts`, `src/graph/operations.ts`, `src/graph/revisions.ts`, `package.json`, `package-lock.json`, `tests/graph/graph.test.mjs`, `src/errors.ts`.
- Проверки: `npm.cmd run typecheck` — PASS; `npm.cmd run test:graph` — PASS (4 tests), включая empty draft, large seed `9007199254740993`, literal array vs link, atomic rollback/remove-reconnect и stale CAS conflict. Первое revision assertion было исправлено: blob API возвращает canonical JSON, не hash.
- Доказательства: graph test TAP output; cloud backend compatibility остаётся `unknown`, live API — `NOT_RUN`.
- Ограничения/остаток: graph core пока не подключён к MCP tools и не персистируется через SQLite DAO; UI codec, blocks, model compatibility и backend execution ещё не сделаны.
- Следующий шаг: добавить output-node operation и MCP tools `rh_create_workflow`, `rh_get_workflow`, `rh_edit_workflow`, `rh_validate_workflow`, `rh_export_workflow` поверх CAS store.

### STEP-0010 — 2026-09-07 — graph tools over MCP

- Пакет и статус: L02 / IN_PROGRESS.
- Изменения и назначение: добавлена typed Zod-схема graph operations, `set_output_nodes`, и зарегистрированы MCP tools `rh_create_workflow`, `rh_get_workflow`, `rh_edit_workflow`, `rh_validate_workflow`, `rh_export_workflow`. Tools используют CAS `RevisionStore`, возвращают common `ok/data/warnings/error` envelope и не выполняют cloud submit.
- Файлы/модули: `src/graph/schemas.ts`, `src/graph/operations.ts`, `src/graph/revisions.ts`, `src/mcp/server.ts`, `tests/mcp/stdio.test.mjs`.
- Проверки: `npm.cmd run typecheck` — PASS; `npm.cmd run test:graph` — PASS (4); `npm.cmd run test:mcp` — PASS (1), включая create/edit через transport и parent revision.
- Доказательства: MCP tools list и child-process calls в `tests/mcp/stdio.test.mjs`; capabilities всё ещё сообщает `full_graph_submit=not_verified`.
- Ограничения/остаток: RevisionStore пока in-memory внутри процесса; после перезапуска workflow revisions не восстанавливаются. UI format, blocks/model profiles и remote execution отсутствуют.
- Следующий шаг: подключить RevisionStore к SQLite immutable revision/blob persistence и проверить восстановление после перезапуска.

### STEP-0011 — 2026-09-07 — SQLite CAS revision persistence

- Пакет и статус: L02 / IN_PROGRESS.
- Изменения и назначение: `RevisionStore` получил persistence interface и загрузку immutable revisions при старте; добавлен `SqliteRevisionPersistence`, `Storage.registerProject/hasProject` и запись graph canonical blob/hash/validation/reason в `workflow_revisions`. MCP server теперь восстанавливает workflow revisions из SQLite, а отсутствие проекта возвращается как `PROJECT_NOT_FOUND` вместо сырой FK ошибки.
- Файлы/модули: `src/storage/database.ts`, `src/storage/revisions.ts`, `src/graph/revisions.ts`, `src/mcp/server.ts`, tests.
- Исправление: первый restart test получил реальную FK ошибку при отсутствии зарегистрированного project; тест и MCP fixture теперь явно регистрируют project, сохраняя требование принадлежности workflow проекту. Cleanup connections сделан через `finally`.
- Проверки: `npm.cmd run typecheck` — PASS; `npm.cmd run test:graph` — PASS (5); `npm.cmd run test:mcp` — PASS (1); `npm.cmd run test:acceptance:offline` — PASS (unit 1, contract 2, graph 5, MCP 1).
- Доказательства: `ACCEPTANCE.md` L02 rows `L02-CODEC-001`–`L02-LIVE-001`; live execution всё ещё NOT_RUN.
- Ограничения/остаток: UI JSON codec, functional blocks, model compatibility and backend execution remain; SQLite blob is currently canonical JSON in DB, filesystem snapshot/outbox is for later execution/result packages.
- Следующий шаг: завершить L02 review локальных contracts, затем перейти к L03 schema profiles, model compatibility и ограниченному UI codec.

### STEP-0012 — 2026-09-07 — L02 local completion и переход к L03

- Пакет и статус: L02 / LOCAL_DONE; L03 / IN_PROGRESS.
- Изменения и назначение: сверены L02 критерии — API round-trip/lossless integer, draft/runnable states, add/delete/reconnect, atomic rollback, immutable CAS revisions, SQLite restart restore и MCP graph tools — все имеют offline evidence. Live cloud execution сознательно не засчитан.
- Файлы/модули: `ACCEPTANCE.md`, `docs/capabilities.md`, `PROGRESS.md`.
- Проверки: повторный `npm.cmd run test:acceptance:offline` — PASS; `npm.cmd run test:live` ранее — `NOT_RUN` exit 2.
- Доказательства: acceptance rows `L02-CODEC-001`–`L02-MCP-001` PASS и `L02-LIVE-001` NOT_RUN.
- Ограничения/остаток: L03 ещё не имеет schema packs, blocks, UI import/export или model compatibility checks.
- Следующий шаг: определить explicit synthetic node schema profiles, block remapping ownership и поддержанный UI subset с явным reject неизвестных расширений.

### STEP-0013 — 2026-09-07 — L03 local completion и переход к L04

- Пакет и статус: L03 / LOCAL_DONE; L04 / IN_PROGRESS.
- Изменения и назначение: создан synthetic schema profile с явным backend scope/evidence, graph model catalog с explicit loader/family compatibility, block insert/remove с namespaced ownership/remapping и limited UI import/export для поддержанного subset. Неизвестные UI extensions сохраняются в ошибке вместе с исходником и не отбрасываются молча.
- Файлы/модули: `src/catalog/profiles.ts`, `src/catalog/models.ts`, `src/graph/blocks.ts`, `src/graph/uiCodec.ts`, `fixtures/contracts/schema-profiles.json`, `docs/schema-profiles.md`, `tests/catalog/l03.test.mjs`.
- Проверки: `npm.cmd run test:l03` — PASS (4); полный `npm.cmd run test:acceptance:offline` — PASS (unit 1, contract 2, graph 5, L03 4, MCP 1). Во время UI fixes нормализованы LosslessNumber для IDs/ports/modes/widgets; final tests зелёные.
- Доказательства: `ACCEPTANCE.md` L03 rows `L03-BLOCK-001`–`L03-UI-002`; backend/model availability synthetic/unknown, live — NOT_RUN.
- Ограничения/остаток: профиль не является доказательством cloud node availability; полноценные custom nodes, blocks catalog search и project/scene context ещё отсутствуют.
- Следующий шаг: реализовать project registry, asset/document hashing, scene resolver, work items и workflow library search с двумя изолированными synthetic projects.

### STEP-0014 — 2026-09-07 — L04 local completion и переход к L05

- Пакет и статус: L04 / LOCAL_DONE; L05 / IN_PROGRESS.
- Изменения и назначение: добавлен project/context service с root/path guards, document/asset SHA-256 indexing, portable Windows-relative paths, scene aliases/constraints/required asset roles, REQUESTED work items и стартовая библиотека трёх различающихся workflow cards. MCP tools `rh_project`, `rh_scene`, `rh_work_item`, `rh_search_workflows` подключены к SQLite-backed service.
- Файлы/модули: `src/projects/context.ts`, `src/projects/library.ts`, `src/projects/schemas.ts`, `src/storage/database.ts`, `src/mcp/server.ts`, `fixtures/projects/workflow-library.json`, `tests/projects/l04.test.mjs`.
- Исправление: Windows path separator и семантика hard constraint `any` исправлены после первого L04 test run; final L04 suite зелёный.
- Проверки: `npm.cmd run typecheck` — PASS; `npm.cmd run test:l04` — PASS (3); полный `npm.cmd run test:acceptance:offline` — PASS (unit 1, contract 2, graph 5, L03 4, L04 3, MCP 1).
- Доказательства: `ACCEPTANCE.md` L04 rows `L04-PROJECT-001`–`L04-LIBRARY-001`; no user media or live data used.
- Ограничения/остаток: dimensions/duration decode, asset approval semantics, durable execution/recovery and live API remain.
- Следующий шаг: реализовать durable execution plan/job DAO и runner, где потерянный submit response не вызывает второй POST.

### STEP-0015 — 2026-09-07 — L05 durable runner и recovery contracts

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: добавлены execution-типы (`ExecutionPlan`, `JobHandle`, provider/artifact states, backend contract и `SubmitUnknownError`); SQLite DAO расширен durable execution plans/jobs, atomic reservation, submit claim, unknown-submit, provider status, artifacts, cancellation и recoverable jobs. Реализован `DurableWorkflowRunner` с idempotent reservation, single-submit intent, `SUBMIT_UNKNOWN` без blind retry, polling, output/artifact handling, cancellation и recovery. Добавлен configurable HTTPS `WorkflowApiClient` без выдуманных route defaults, с bearer key из config, timeout, lossless JSON и различением HTTP-200 application error и network-unknown submit.
- Файлы/модули: `src/execution/types.ts`, `src/execution/runner.ts`, `src/storage/database.ts`, `src/backends/workflow-api/client.ts`, `tests/execution/l05.test.mjs`, `package.json`.
- Проверки: `npm.cmd run typecheck` — PASS; `npm.cmd run test:l05` — PASS (6); полный `npm.cmd run test:acceptance:offline` — PASS (unit 1, contract 2, graph 5, L03 4, L04 3, L05 6, MCP 1). Во время typecheck исправлен пропущенный `await` перед submit.
- Доказательства: TAP output `tests/execution/l05.test.mjs`; проверены concurrent same-plan reservation (один job/submit), request conflict, lost submit без повторного POST, provider failure, empty output и успешный polling. Live backend/API probes не запускались: authorized profile/routes отсутствуют.
- Ограничения/остаток: execution tools ещё не подключены к MCP; начатый, но прерванный перед применением патч для `src/execution/schemas.ts` и экспортов plan row conversion не засчитан как выполненный. L05 acceptance rows в `ACCEPTANCE.md` ещё не добавлены.
- Следующий шаг: сначала проверить состояние прерванного патча, затем подключить `rh_prepare_generation`, `rh_run_workflow` и `rh_job` к MCP с явным `CAPABILITY_UNKNOWN` без настроенного backend.

### STEP-0016 — 2026-09-07 — подключение L05 execution tools к MCP

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: проверен прерванный патч: `src/execution/schemas.ts` уже существовал, но инструменты не были зарегистрированы. Добавлены deterministic immutable execution plans из work item + конкретной graph revision, проверка project/revision/asset hash, подготовка без submit, запуск через configured Workflow API и `rh_job` для status/wait/resume/cancel. Без полного backend-профиля submit блокируется `CAPABILITY_UNKNOWN` до создания job; ключ не попадает в SQLite или ответы.
- Файлы/модули: `src/config.ts`, `src/execution/schemas.ts`, `src/execution/runner.ts`, `src/mcp/server.ts`.
- Проверки: typecheck и MCP/offline tests после этой интеграции — `NOT_RUN` на момент записи; live API — `NOT_RUN`, authorized profile/routes отсутствуют.
- Доказательства: plan сохраняет `graph_revision_id`, graph hash, workflow snapshot, requirements/policy hashes, asset bindings и backend profile; `rh_get_capabilities` различает local prepare и unverified/configuration state.
- Ограничения/остаток: MCP test list ещё ожидает старый набор tools; отсутствуют acceptance rows L05 и transport assertions для prepare/run/job. Upload, output download/review и live recovery остаются в следующих пакетах.
- Следующий шаг: выполнить typecheck, обновить stdio MCP test на новые tools, затем прогнать L05 и полный offline acceptance suite.

### STEP-0017 — 2026-09-07 — compile fix для execution configuration

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: исправлено narrowing-условие для опционального `RUNNINGHUB_WORKFLOW_API_TIMEOUT_MS`; неполная конфигурация и нецелое/неположительное значение остаются явной ошибкой старта.
- Файлы/модули: `src/config.ts`.
- Проверки: `npm.cmd run typecheck` — PASS. Runtime и live backend — `NOT_RUN` на этом промежуточном шаге.
- Доказательства: TypeScript strict check завершён без ошибок.
- Ограничения/остаток: транспортный тест ещё ожидает старый список MCP tools; нужно добавить L05 assertions и acceptance rows.
- Следующий шаг: обновить `tests/mcp/stdio.test.mjs` и проверить prepare/run/job через реальный stdio transport.

### STEP-0018 — 2026-09-07 — MCP transport contract для L05

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: stdio test расширен проверкой списка `rh_prepare_generation`, `rh_run_workflow`, `rh_job`, создания work item, подготовки плана и явного `CAPABILITY_UNKNOWN` при запуске без backend. Для неизвестного job проверен structured `PROJECT_NOT_FOUND`; старый test failure из-за пропущенного `action=create` исправлен.
- Файлы/модули: `tests/mcp/stdio.test.mjs`, `ACCEPTANCE.md`, `docs/configuration.md`, `README.md`, `docs/capabilities.md`.
- Проверки: `npm.cmd run test:mcp` — PASS (build + 1 stdio test); `npm.cmd run test:l05` и полный offline suite — `NOT_RUN` на момент записи; live — `NOT_RUN`.
- Доказательства: `ACCEPTANCE.md` cases `L05-EXEC-001`, `L05-MCP-001`, `L05-LIVE-001`; документация описывает explicit route configuration без route defaults и без утечки ключа.
- Ограничения/остаток: production Workflow API не проверен; upload/download/results/review отсутствуют по границам L05/L06. Нужно завершить regression suite и сверить фактический статус пакета.
- Следующий шаг: прогнать `npm.cmd run test:l05` и `npm.cmd run test:acceptance:offline`, затем обновить сводный статус L05 по фактическим результатам.

### STEP-0019 — 2026-09-07 — завершение текущего L05 MCP-пункта

- Пакет и статус: L05 / IN_PROGRESS; текущий подпункт подключения execution tools завершён локально.
- Изменения и назначение: подтверждены durable plan preparation, explicit backend capability gate и MCP status/recovery surface через stdio. Добавлены acceptance evidence для synthetic runner, MCP transport и отдельный live gate; документация и сводка синхронизированы с фактическим L05 состоянием.
- Файлы/модули: `src/mcp/server.ts`, `src/config.ts`, `src/execution/schemas.ts`, `src/execution/runner.ts`, `tests/mcp/stdio.test.mjs`, `ACCEPTANCE.md`, `README.md`, `docs/configuration.md`, `docs/capabilities.md`, `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — PASS; `npm.cmd run test:mcp` — PASS; `npm.cmd run test:l05` — PASS (6); `npm.cmd run test:acceptance:offline` — PASS (unit 1, contract 2, graph 5, L03 4, L04 3, L05 6, MCP 1). SQLite experimental warning остаётся ожидаемым и не загрязняет MCP stdout.
- Доказательства: `ACCEPTANCE.md` `L05-EXEC-001` и `L05-MCP-001` — PASS; `L05-LIVE-001` — NOT_RUN без authorized profile/routes. `rh_run_workflow` без конфигурации возвращает `CAPABILITY_UNKNOWN` до создания job.
- Ограничения/остаток: реальные RunningHub submit/status/outputs/cancel, upload и provider-side reconciliation не запускались; result download/review остаются L06. L05 нельзя отметить `LOCAL_DONE` до выполнения оставшихся локальных upload/recovery contracts и сверки backend capabilities.
- Следующий шаг: реализовать и протестировать L05 upload/asset provider flow и дополнительные recovery cases, затем отдельно провести разрешённые live probes через этот durable runner.

### STEP-0020 — 2026-09-07 — начало локального upload/recovery подпункта L05

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: выбран ровно один следующий пункт из STEP-0019: durable provider upload/cache flow для зарегистрированных project assets и recovery для crash-after-intent и повторного получения outputs без нового submit. Live API, платные генерации и пользовательские uploads в этом шаге не запускаются.
- Файлы/модули: перед реализацией проверены `src/execution/*`, `src/storage/database.ts`, `src/backends/workflow-api/client.ts`, `src/projects/context.ts`, `src/mcp/server.ts`, `tests/execution/l05.test.mjs` и контракты разделов 20.4–20.6 плана.
- Проверки: `NOT_RUN` — реализационные тесты будут запущены после изменения; live profile/API — `NOT_RUN`, поскольку разрешённый профиль не предоставлен.
- Доказательства: план требует tagged provider references, запрета arbitrary paths, кэширования по profile/API family/asset hash и отсутствия повторного submit после неизвестного результата; текущий код этих контрактов ещё не покрывает.
- Ограничения/остаток: L05 execution tools уже подключены локально; `rh_asset`, provider upload cache и retryable output recovery ещё отсутствуют. Результаты/review остаются L06.
- Следующий шаг: добавить storage/provider types и explicit upload route, затем подключить безопасное чтение зарегистрированного asset, кэширование upload reference и замену `asset://` в submit snapshot.

### STEP-0021 — 2026-09-07 — provider asset flow и retryable output state

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: добавлены tagged `provider_file`/`provider_url`, explicit optional upload route, SQLite migration/cache для provider uploads, безопасное чтение asset bytes с project-root/symlink/hash checks, upload-cache integration в durable runner и `rh_asset` actions `inspect/register/prepare/upload`. Submit теперь получает resolved workflow snapshot вместо локальных `asset://` references. После provider success состояние `SUCCEEDED + artifact FAILED` допускает повтор outputs без нового submit.
- Файлы/модули: `src/execution/types.ts`, `src/execution/schemas.ts`, `src/execution/assets.ts`, `src/execution/runner.ts`, `src/storage/database.ts`, `src/backends/workflow-api/client.ts`, `src/config.ts`, `src/mcp/server.ts`, `tests/unit/storage.test.mjs`.
- Проверки: `NOT_RUN` — typecheck/build/tests будут выполнены после согласования compile errors; live upload/submit — `NOT_RUN`, чтобы не отправлять пользовательские данные и не списывать баланс.
- Доказательства: cache key содержит profile, API family, asset ID и content hash; upload response принимается только как tagged provider reference; explicit route не получает default; неизвестные `asset://` refs не отправляются наружу.
- Ограничения/остаток: transport list и execution tests ещё не обновлены под `rh_asset`; дополнительные crash/concurrency/upload/retry tests ещё не добавлены; миграционный self-check ожидает обновления с 12 до 13 таблиц.
- Следующий шаг: выполнить `typecheck` и `build`, исправить только найденные compile/runtime regressions, затем добавить synthetic L05 recovery/upload tests и обновить acceptance evidence.

### STEP-0022 — 2026-09-07 — compile check provider flow

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: compile-проверка нового provider asset flow завершена без изменений после реализации.
- Файлы/модули: скомпилированы `src/execution/assets.ts`, runner, storage migration, Workflow API client, config и MCP server; создан актуальный `dist/`.
- Проверки: `npm.cmd run typecheck` — PASS; `npm.cmd run build` — PASS. Live upload/submit — `NOT_RUN` по причине отсутствия разрешённого профиля и запрета на пользовательские uploads.
- Доказательства: TypeScript strict compilation завершён без ошибок; новые runtime-контракты ещё требуют synthetic tests.
- Ограничения/остаток: unit self-check и старый MCP expected tool list ещё требуют обновления; upload/recovery behaviour не засчитан до тестов.
- Следующий шаг: обновить transport/unit expectations и добавить synthetic tests на tagged upload cache, безопасный hash mismatch, crash-after-intent, concurrent file-backed stores и повтор outputs без повторного submit.

### STEP-0023 — 2026-09-07 — первый L05 regression run

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: добавлены synthetic assertions на crash-after-intent, retry outputs без нового submit, project asset upload/cache/hash guard, tagged multipart upload response и два file-backed Storage процесса; MCP tool list обновлён для `rh_asset`.
- Файлы/модули: `tests/execution/l05.test.mjs`, `tests/mcp/stdio.test.mjs`, `README.md`, `docs/configuration.md`, `ACCEPTANCE.md`.
- Проверки: `npm.cmd run test:l05` — NOT_PASS (9/10); единственная ошибка — новый тест не вызвал `runner.prepare` перед ручным FK-dependent `reserveJob`; остальные 9 тестов PASS, включая upload/cache и file-backed concurrency. `npm.cmd run typecheck` и `npm.cmd run build` — PASS.
- Доказательства: failure является ошибкой тестового сценария, не live/API failure; production upload/recovery ещё не засчитываются до повторного зелёного прогона.
- Ограничения/остаток: нужно исправить порядок действий в crash fixture и затем повторить L05, MCP и полный offline suite.
- Следующий шаг: rerun `npm.cmd run test:l05`, затем проверить `test:mcp` и полный `test:acceptance:offline`.

### STEP-0024 — 2026-09-07 — локальное завершение upload/recovery подпункта L05

- Пакет и статус: L05 / LIVE_PENDING; выбранный локальный подпункт завершён.
- Изменения и назначение: завершены project-owned asset inspect/register/prepare/upload, root/symlink/hash guard, tagged provider references, profile/API-family/content-hash cache, `asset://` substitution in the immutable submit snapshot, crash-after-intent recovery, file-backed multi-process reservation, and retryable provider outputs without a second submit. MCP surface includes `rh_asset`; provider upload remains explicit-route-only.
- Файлы/модули: `src/execution/types.ts`, `src/execution/schemas.ts`, `src/execution/assets.ts`, `src/execution/runner.ts`, `src/storage/database.ts`, `src/backends/workflow-api/client.ts`, `src/config.ts`, `src/mcp/server.ts`, `tests/execution/l05.test.mjs`, `tests/mcp/stdio.test.mjs`, `tests/unit/storage.test.mjs`, `README.md`, `docs/configuration.md`, `docs/capabilities.md`, `ACCEPTANCE.md`, `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — PASS; `npm.cmd run test:l05` — PASS (10/10, includes build); `npm.cmd run test:mcp` — PASS (1/1, real stdio transport); `npm.cmd run test:acceptance:offline` — PASS (unit 1, contract 2, graph 5, L03 4, L04 3, L05 10, MCP 1). SQLite experimental warning остаётся ожидаемым и не загрязняет MCP stdout. `npm.cmd run test:live` — NOT_RUN по правилу задачи: нет разрешённого профиля/routes, нельзя отправлять пользовательские данные или выполнять платные вызовы.
- Доказательства: `ACCEPTANCE.md` cases `L05-EXEC-001`, `L05-ASSET-001`, `L05-RECOVERY-001`, `L05-MCP-001` — PASS; `L05-LIVE-001` — NOT_RUN. Тесты используют только synthetic backend и временные fixture-файлы, не пользовательские данные.
- Ограничения/остаток: live RunningHub upload/submit/status/outputs/cancel и provider-side expiry/reconciliation не проверены; result download/preview/review остаются L06. Локальная реализация не заявляет cloud compatibility.
- Следующий шаг: только после явного разрешения и предоставления authorized profile выполнить минимальные live probes через этот durable runner; до этого не запускать внешние изменения и не переходить к L06.

### STEP-0025 — 2026-09-07 — проверка live gate без authorized profile

- Пакет и статус: L05 / LIVE_PENDING.
- Изменения и назначение: исходный код не изменялся; проверено, что текущий локальный L05 остаётся воспроизводимым, а live gate не запускает внешние вызовы без явно настроенного профиля и набора разрешённых cases.
- Файлы/модули: `PROGRESS.md`; production build regenerated `dist/` без изменения runtime-контрактов.
- Проверки: `npm.cmd run typecheck` — PASS; `npm.cmd run build` — PASS; `npm.cmd run test:acceptance:offline` — PASS (unit 1, contract 2, graph 5, L03 4, L04 3, L05 10, MCP 1); `npm.cmd run test:live` — NOT_RUN (exit 2), потому что authorized profile и `RUNNINGHUB_LIVE_CASES` не настроены. Live upload/submit/status/outputs/cancel — NOT_RUN; внешние изменения, платные генерации и пользовательские данные не использовались.
- Доказательства: локальные TAP outputs всех offline suites; `ACCEPTANCE.md` `L05-EXEC-001`, `L05-ASSET-001`, `L05-RECOVERY-001`, `L05-MCP-001` — PASS, `L05-LIVE-001` — NOT_RUN.
- Ограничения/остаток: cloud compatibility, реальные upload/submit/status/outputs/cancel и provider-side expiry/reconciliation остаются непроверенными; L06 не начат.
- Следующий шаг: только после явного разрешения и предоставления authorized profile выполнить минимальные live probes через `DurableWorkflowRunner`; до этого не выполнять внешние запросы и не переходить к L06.

### STEP-0026 — 2026-09-07 — разрешение получено, профиль отсутствует

- Пакет и статус: L05 / LIVE_PENDING.
- Изменения и назначение: получено явное разрешение на live-проверку; безопасно проверено только наличие конфигурации, без чтения или вывода секретных значений. Профиль для запуска probe в текущем окружении не настроен.
- Файлы/модули: `PROGRESS.md`.
- Проверки: наличие `RUNNINGHUB_WORKFLOW_API_PROFILE_ID`, `RUNNINGHUB_WORKFLOW_API_BASE_URL`, `RUNNINGHUB_WORKFLOW_API_KEY`, submit/status/outputs routes и `RUNNINGHUB_LIVE_CASES` — NOT_RUN для live API / значения отсутствуют; внешний запрос, upload, submit и платная генерация не выполнялись.
- Доказательства: проверка наличия переменных окружения вернула `False` для каждого обязательного профиля/cases; секретные значения не раскрывались.
- Ограничения/остаток: authorized profile и явный набор минимальных cases ещё не предоставлены; live RunningHub upload/submit/status/outputs/cancel и provider-side reconciliation остаются NOT_RUN; L06 не начат.
- Следующий шаг: настроить authorized Workflow API profile в окружении и задать разрешённые `RUNNINGHUB_LIVE_CASES`, затем выполнить минимальные live probes через `DurableWorkflowRunner`.

### STEP-0027 — 2026-09-07 — уточнение live scope и произвольных workflows

- Пакет и статус: L05 / LIVE_PENDING.
- Изменения и назначение: подтверждено, что `RUNNINGHUB_LIVE_CASES=full` означает разрешение на полный набор live-case операций; тестовый workflow `2087104558464446466` не добавлять в проект, библиотеку или persistent fixtures. Универсальный MCP должен принимать workflow, явно выбранный пользователем, а не зашивать этот ID.
- Файлы/модули: `PROGRESS.md`; исходники и проектные данные не изменялись.
- Проверки: live API/upload/submit/status/outputs/cancel — NOT_RUN, поскольку base URL, API key и status/outputs routes не настроены в окружении; тестовый workflow в локальный проект не импортировался и не сохранялся.
- Доказательства: пользовательское уточнение scope; текущие локальные synthetic/offline tests остаются доказательством только локальных контрактов и не подтверждают cloud compatibility.
- Ограничения/остаток: для запуска нужны безопасно настроенные в окружении `RUNNINGHUB_WORKFLOW_API_BASE_URL`, `RUNNINGHUB_WORKFLOW_API_KEY`, submit/status/outputs routes и `RUNNINGHUB_LIVE_CASES=full`; точные status/outputs routes нельзя выдумывать по одному submit endpoint.
- Следующий шаг: получить/настроить недостающие base URL, secret и точные status/outputs routes без добавления тестового workflow в проект, затем выполнить разрешённые full-access probes через `DurableWorkflowRunner`.

### STEP-0028 — 2026-09-07 — подтверждение официальных Workflow API defaults

- Пакет и статус: L05 / LIVE_PENDING.
- Изменения и назначение: по официальной документации подтверждены defaults без пользовательских route/profile переменных: host `https://www.runninghub.ai`, Workflow API prefix `/openapi/v2`, submit workflow endpoint формируется из выбранного workflow endpoint/ID, polling и result query используют `/query`, новый media upload — `/media/upload/binary`, cancel documented separately as `/task/openapi/cancel`. Пользовательский тестовый workflow не импортируется и не сохраняется в проекте.
- Файлы/модули: `PROGRESS.md`; внешняя документация RunningHub прочитана только как контракт, live API вызовы с ключом не выполнялись.
- Проверки: docs fetch для Workflow API create, query contract, upload, cancel и generic `/openapi/v2/run/workflow/...` без API key — NOT_RUN для авторизованного live поведения; unauthenticated route response не является acceptance evidence.
- Доказательства: официальный docs contract: `https://www.runninghub.ai/runninghub-api-doc-en/`; сохранённый локальный `data/upstream/rh-api-contract.md` подтверждает Bearer authentication и `/openapi/v2/query` polling.
- Ограничения/остаток: runtime ещё читает удаляемые route/profile/base env vars; project-folder workflow discovery и actual live probe остаются незавершёнными.
- Следующий шаг: заменить пользовательскую Workflow API конфигурацию на единственный `RUNNINGHUB_WORKFLOW_API_KEY`, зафиксировать официальные routes внутри adapter и не добавлять тестовый workflow в project state.

### STEP-0029 — 2026-09-07 — встроенная Workflow API configuration

- Пакет и статус: L05 / LIVE_PENDING.
- Изменения и назначение: runtime теперь активирует Workflow API только по `RUNNINGHUB_WORKFLOW_API_KEY`; удалены из рабочего контракта base URL, submit/status/outputs routes, upload/cancel routes, timeout и API profile env vars. Встроены официальные defaults: `https://www.runninghub.ai`, `/task/openapi/create`, `/openapi/v2/query`, `/openapi/v2/media/upload/binary`, `/task/openapi/cancel`. `RUNNINGHUB_LIVE_CASES=full` стал явным live gate. Тестовый workflow не добавлялся в project state.
- Файлы/модули: `src/config.ts`, `src/mcp/server.ts`, `scripts/test-live.mjs`, `docs/configuration.md`, `README.md`, `tests/unit/config.test.mjs`.
- Проверки: `npm.cmd run typecheck` — PASS; `npm.cmd run build` — PASS; `npm.cmd run test:unit` — PASS (3 tests). Live submit/status/outputs/cancel — NOT_RUN; API key не выводился и внешние изменения не выполнялись.
- Доказательства: `tests/unit/config.test.mjs` подтверждает, что старые env vars игнорируются, defaults фиксированы, а без API key backend отсутствует.
- Ограничения/остаток: generic workflow endpoint/ID должен приходить из выбранного workflow или project context; автоматическое project-folder discovery ещё не реализовано; live probe и проверка provider response остаются NOT_RUN.
- Следующий шаг: не добавляя acceptance workflow в проект, завершить runtime selection для явного/найденного workflow и выполнить разрешённый `full` live probe после того, как API key будет доступен дочернему MCP-процессу.

### STEP-0030 — 2026-09-07 — project-folder workflow discovery

- Пакет и статус: L05 / LIVE_PENDING; локальный workflow-selection prerequisite завершён.
- Изменения и назначение: добавлен `rh_import_workflow`: без `relative_path` он находит API-format JSON в зарегистрированном project root, исключает `.runninghub`, output/assets roots и unrelated JSON, автоматически импортирует единственного кандидата, а при нескольких возвращает кандидатов без произвольного выбора. Явный `relative_path` и optional remote numeric workflow ID поддержаны; source остаётся project-owned и не смешивается с acceptance workflow.
- Файлы/модули: `src/projects/context.ts`, `src/projects/schemas.ts`, `src/mcp/server.ts`, `tests/projects/l04.test.mjs`, `tests/mcp/stdio.test.mjs`, `README.md`, `docs/capabilities.md`, `ACCEPTANCE.md`.
- Проверки: `npm.cmd run typecheck` — PASS; `npm.cmd run build` — PASS; `npm.cmd run test:l04` — PASS (4); `npm.cmd run test:unit` — PASS (3); `npm.cmd run test:mcp` — PASS (1). Live API — NOT_RUN.
- Доказательства: `ACCEPTANCE.md` `L04-WORKFLOW-001` — PASS; synthetic test использует отдельный numeric fixture ID и не использует пользовательский test workflow `2087104558464446466`.
- Ограничения/остаток: автоматический выбор при нескольких workflow требует выбора агентом по returned candidates; remote provider availability, submit/status/results/cancel и actual full-access probe остаются NOT_RUN.
- Следующий шаг: прогнать полный offline acceptance suite, затем выполнить только разрешённый live probe через production runner с API key, без сохранения acceptance workflow в проекте.

### STEP-0031 — 2026-09-07 — live gate видит user environment

- Пакет и статус: L05 / LIVE_PENDING.
- Изменения и назначение: подтверждено, что API key и `RUNNINGHUB_LIVE_CASES=full` заданы в User environment и доступны после явного переноса в дочерний PowerShell process. Gate больше не блокируется отсутствием переменных; acceptance workflow по-прежнему не импортирован в project state.
- Файлы/модули: `PROGRESS.md`; код и база проекта на этом промежуточном шаге не изменялись.
- Проверки: `npm.cmd run test:live` с user-environment values — NOT_RUN с сообщением, что gate не вызывает live runner сам; ключ не выводился. Полный offline suite до этого шага — PASS.
- Доказательства: gate распознал `RUNNINGHUB_WORKFLOW_API_KEY` и `RUNNINGHUB_LIVE_CASES=full`; это не является доказательством cloud execution.
- Ограничения/остаток: production runner должен выполнить единственную разрешённую пробу по явно переданному test workflow endpoint без сохранения его в проекте.
- Следующий шаг: адаптировать response parsing к официальному RunningHub task/query contract и запустить один ephemeral durable live probe с test workflow ID.

### STEP-0032 — 2026-09-07 — ephemeral live harness готов

- Пакет и статус: L05 / LIVE_PENDING.
- Изменения и назначение: durable execution plan получил optional `provider_workflow_id` с SQLite migration; numeric remote workflow ID выбирает встроенный `/openapi/v2/run/workflow/<id>`, а локальный full graph без ID остаётся на `/task/openapi/create`. Client нормализует официальный `taskStatus`, `data[]/fileUrl` outputs и provider `code/msg`. `scripts/test-live.mjs` теперь получает workflow JSON в память, создаёт ephemeral runner и принимает ID только через CLI, не через project/env state.
- Файлы/модули: `src/execution/types.ts`, `src/execution/schemas.ts`, `src/execution/runner.ts`, `src/storage/database.ts`, `src/backends/workflow-api/client.ts`, `src/mcp/server.ts`, `scripts/test-live.mjs`, `tests/unit/storage.test.mjs`.
- Проверки: `npm.cmd run typecheck` — PASS; `npm.cmd run build` — PASS; `npm.cmd run test:acceptance:offline` — PASS (unit 3, contract 2, graph 5, L03 4, L04 4, L05 10, MCP 1). Live submit/status/outputs — NOT_RUN до следующей команды.
- Доказательства: offline TAP outputs; migration version 3/reopen, provider ID persistence and synthetic recovery contracts pass. No project workflow or user media was added.
- Ограничения/остаток: actual provider response, billing/availability, output retrieval and cancel remain unverified until the authorized probe completes; no automatic retry is enabled.
- Следующий шаг: выполнить один `full` ephemeral live probe для user-supplied test workflow ID and record the factual provider result.

### STEP-0033 — 2026-09-07 — live submit accepted, bounded wait timed out

- Пакет и статус: L05 / LIVE_PENDING.
- Изменения и назначение: после исправления lossless nested numeric import production runner выполнил один разрешённый submit для user-supplied test workflow ID `2087104558464446466`; workflow JSON и project state оставались ephemeral/in-memory.
- Файлы/модули: `src/graph/types.ts`, `src/graph/codec.ts`, `tests/graph/graph.test.mjs`, `PROGRESS.md`; live task state находится у provider, локальный ephemeral DB закрыт после probe.
- Проверки: `npm.cmd run typecheck` — PASS; `npm.cmd run build` — PASS; `npm.cmd run test:graph` — PASS (6); live submit — PASS, provider task `2097110848340590594` returned `RUNNING`; bounded wait 180s ended with `execution_state=RUNNING`, `artifact_state=NONE`, so probe command returned `LIVE_FAIL` due timeout, not provider terminal failure. No second submit was attempted.
- Доказательства: stderr output `LIVE_SUBMIT` with task ID and `LIVE_FAIL` with nonterminal state; task ID сохранён только в этом journal, API key и payload не записывались.
- Ограничения/остаток: outputs/status terminal result и cancel ещё не проверены; provider task может продолжаться независимо от завершения MCP process. Повторять submit запрещено.
- Следующий шаг: выполнить polling только известного task `2097110848340590594` через `/openapi/v2/query`, затем зафиксировать terminal status/outputs без нового POST submit.

### STEP-0034 — 2026-09-07 — live recovery и output query PASS

- Пакет и статус: L05 / LIVE_PENDING; минимальная разрешённая submit/status/output probe завершена.
- Изменения и назначение: recovery mode восстановил ephemeral job для уже известного provider task `2097110848340590594` и дождался успешного provider status/output query. Submit не повторялся; тестовый workflow не сохранялся в проекте или fixtures.
- Файлы/модули: `scripts/test-live.mjs`, `ACCEPTANCE.md`, `PROGRESS.md`; provider task state оставлен у RunningHub согласно обычному async lifecycle.
- Проверки: `npm.cmd run test:live -- --task-id 2097110848340590594 --timeout-ms 300000` — PASS, `LIVE_PASS: recovered_task_id=2097110848340590594 outputs_ready=true`. Ранее тот же probe создал ровно один task; API key не выводился, пользовательские assets не загружались.
- Доказательства: `ACCEPTANCE.md` `L05-LIVE-002` — PASS; `L05-LIVE-001` остаётся NOT_RUN целиком, потому что upload/cancel/full structural-change acceptance не выполнялись.
- Ограничения/остаток: upload, cancel, download/preview, provider expiry/reconciliation и запуск структурно изменённого графа остаются NOT_RUN; текущая live evidence относится только к user-supplied test workflow и не доказывает доступность всех workflows/models.
- Следующий шаг: остановиться на завершённом минимальном L05 live probe; отдельные upload/cancel/structural graph probes выполнять только как явно выбранные следующие live cases, не переходя к L06 в этой сессии.

### STEP-0035 — 2026-09-07 — полный offline acceptance после live recovery

- Пакет и статус: L05 / минимальная live probe PASS; offline acceptance PASS.
- Изменения и назначение: повторная полная проверка после добавления `--task-id` recovery mode и записи live evidence; новых provider requests не выполнялось.
- Файлы/модули: `ACCEPTANCE.md`, `PROGRESS.md`; code path проверен существующими unit/contract/graph/project/execution/MCP suites.
- Проверки: `npm.cmd run test:acceptance:offline` — PASS, всего 30 тестов: unit 3, contract 2, graph 6, L03 4, L04 4, L05 10, MCP 1. Каждый suite завершился с zero failures.
- Доказательства: `ACCEPTANCE.md` `L05-LIVE-002` — PASS и offline acceptance suites — PASS; user workflow ID/API key не попали в project state, fixtures или source code.
- Ограничения/остаток: combined `L05-LIVE-001`, upload/cancel/download-preview, expiry/reconciliation и structural graph-change live probe остаются NOT_RUN; L06 не начинался.
- Следующий шаг: текущий scope завершён; для продолжения нужно явно выбрать один следующий live case (upload, cancel или structural graph) либо разрешить переход к L06.

### STEP-0036 — 2026-09-07 — начало live upload probe

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: выбран ровно один следующий пункт из STEP-0035 — проверка Workflow API media upload. Probe будет использовать только синтетический временный PNG, ephemeral SQLite и `AssetProvider`; submit, платная генерация, пользовательские данные и сохранение workflow в project state не выполняются.
- Файлы/модули: перед изменением проверены `scripts/test-live.mjs`, `src/execution/assets.ts`, `src/backends/workflow-api/client.ts`, `src/storage/database.ts` и synthetic L05 tests.
- Проверки: реализационные проверки и live upload — `NOT_RUN` до добавления режима harness; typecheck/build/offline suite будут повторены после изменения. Cancel, structural graph probe и L06 не входят в этот шаг.
- Доказательства: текущие `ACCEPTANCE.md` `L05-ASSET-001` и `L05-LIVE-002` покрывают только synthetic upload и submit/status/output; live upload остаётся отдельным непроверенным case.
- Ограничения/остаток: нужен отдельный opt-in `--upload-only` без запуска runner submit и без утечки provider reference в журнал; результат live probe будет записан только после фактического ответа API.
- Следующий шаг: добавить в `scripts/test-live.mjs` ephemeral upload-only flow с синтетическим PNG и затем выполнить typecheck/build/offline checks перед единственным разрешённым upload request.

### STEP-0037 — 2026-09-07 — upload-only live harness

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: добавлен opt-in `--upload-only` в live harness. Он создаёт временный project root и валидный синтетический 1x1 PNG, регистрирует asset/work item, вызывает официальный `WorkflowApiClient` upload route ровно для первой загрузки, затем проверяет локальное cache reuse без второго HTTP upload. Provider reference не выводится.
- Файлы/модули: `scripts/test-live.mjs`, `PROGRESS.md`.
- Проверки: `NOT_RUN` — typecheck/build/offline suite и live upload будут выполнены после изменения; submit/status/output/cancel не запускаются этим режимом.
- Доказательства: режим требует одновременно `RUNNINGHUB_WORKFLOW_API_KEY` и `RUNNINGHUB_LIVE_CASES=full`; временные SQLite/project files удаляются в `finally`.
- Ограничения/остаток: фактический provider response и поддержка upload route ещё не подтверждены; upload probe может завершиться `LIVE_FAIL` без изменения кода, если контракт/доступность провайдера не совпадут.
- Следующий шаг: выполнить `typecheck`, `build`, `test:unit`, `test:l05` и `test:acceptance:offline`, затем при зелёном offline результате запустить только `npm.cmd run test:live -- --upload-only`.

### STEP-0038 — 2026-09-07 — typecheck upload harness

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: проверена компилируемость существующего TypeScript-кода после добавления upload-only live harness; исправлений не потребовалось.
- Файлы/модули: `scripts/test-live.mjs` косвенно проверен в составе проекта; исходники TypeScript не изменялись на этом шаге.
- Проверки: `npm.cmd run typecheck` — PASS. Build, offline tests и live upload — `NOT_RUN` на этом промежуточном шаге.
- Доказательства: TypeScript strict check завершён без ошибок.
- Ограничения/остаток: runtime harness и provider upload ещё не проверены.
- Следующий шаг: выполнить production build, затем unit/L05/offline regression suites.

### STEP-0039 — 2026-09-07 — build upload harness

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: production build после добавления upload-only режима завершён без compile regressions.
- Файлы/модули: актуализирован `dist/` из TypeScript sources; runtime source change остаётся только в `scripts/test-live.mjs`.
- Проверки: `npm.cmd run build` — PASS. Unit, L05, полный offline suite и live upload — `NOT_RUN` на этом промежуточном шаге.
- Доказательства: TypeScript compiler создал актуальный `dist/` без ошибок.
- Ограничения/остаток: поведение live harness и provider contract всё ещё не подтверждены.
- Следующий шаг: выполнить unit и L05 execution suites, затем полный offline acceptance.

### STEP-0040 — 2026-09-07 — unit regression upload harness

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: базовые config/storage unit tests после добавления live upload режима прошли без регрессий.
- Файлы/модули: `tests/unit/config.test.mjs`, `tests/unit/storage.test.mjs` и rebuilt `dist/` затронуты только выполнением test script; исходники не менялись.
- Проверки: `npm.cmd run test:unit` — PASS (3 tests, 0 failures). SQLite experimental warning ожидаем и не относится к MCP stdout. L05, полный offline suite и live upload — `NOT_RUN`.
- Доказательства: TAP output unit suite.
- Ограничения/остаток: execution regression и provider upload response ещё не проверены.
- Следующий шаг: выполнить `npm.cmd run test:l05`.

### STEP-0041 — 2026-09-07 — L05 execution regression upload harness

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: durable execution, synthetic asset upload/cache, crash recovery, multi-process reservation и Workflow API parser regression suite прошли после добавления live harness режима.
- Файлы/модули: `tests/execution/l05.test.mjs`, rebuilt `dist/`; исходники не изменялись.
- Проверки: `npm.cmd run test:l05` — PASS (10 tests, 0 failures). SQLite experimental warning ожидаем. Полный offline suite и live upload — `NOT_RUN`.
- Доказательства: TAP output L05 suite, включая tagged upload cache и отсутствие повторного submit.
- Ограничения/остаток: полный offline regression и фактический provider upload ещё не проверены.
- Следующий шаг: выполнить `npm.cmd run test:acceptance:offline`.

### STEP-0042 — 2026-09-07 — offline acceptance перед upload probe

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: полный offline regression после добавления upload-only live harness прошёл; live upload остаётся единственной проверкой выбранного подпункта.
- Файлы/модули: rebuilt `dist/`; исходники и fixtures не изменялись тестами.
- Проверки: `npm.cmd run test:acceptance:offline` — PASS: unit 3, contract 2, graph 6, L03 4, L04 4, L05 10, MCP 1; всего 30 tests, 0 failures. SQLite experimental warnings ожидаемы. Live upload — `NOT_RUN` до отдельного opt-in вызова.
- Доказательства: TAP output всех offline suites; существующие acceptance rows остаются фактическими.
- Ограничения/остаток: официальная media upload operation ещё не проверена; submit/status/output/cancel и structural graph probe в этот шаг не входят.
- Следующий шаг: выполнить ровно один внешний запрос `npm.cmd run test:live -- --upload-only`, не выводя API key или provider reference.

### STEP-0043 — 2026-09-07 — live upload gate не унаследовал user environment

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: внешний upload не выполнялся, поскольку дочерний npm process не получил `RUNNINGHUB_WORKFLOW_API_KEY` и `RUNNINGHUB_LIVE_CASES`; код и provider state не изменялись.
- Файлы/модули: только `PROGRESS.md`; исходный `scripts/test-live.mjs` корректно остановился до сетевого вызова.
- Проверки: `npm.cmd run test:live -- --upload-only` — `NOT_RUN`, gate завершился с ожидаемым сообщением о недостающих переменных; API key, upload и внешние изменения не выполнялись.
- Доказательства: stdout gate без `LIVE_PASS`/`LIVE_FAIL` и без provider reference.
- Ограничения/остаток: в предыдущей записи STEP-0031 разрешение и user-environment values были подтверждены, но текущий дочерний процесс их не унаследовал.
- Следующий шаг: безопасно перенести только наличие user-environment values в дочерний процесс без вывода секретов и повторить тот же `--upload-only`.

### STEP-0044 — 2026-09-07 — live upload probe PASS

- Пакет и статус: L05 / LIVE_PENDING; выбранный upload подпункт завершён.
- Изменения и назначение: `--upload-only` выполнил один официальный Workflow API media upload для синтетического временного 1x1 PNG через `AssetProvider`; повторный вызов использовал локальный cache и не отправил второй upload. Submit, task creation, paid generation и пользовательские данные не выполнялись.
- Файлы/модули: `scripts/test-live.mjs`, `ACCEPTANCE.md`, `README.md`, `docs/capabilities.md`, `docs/configuration.md`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:live -- --upload-only` с user-environment `RUNNINGHUB_WORKFLOW_API_KEY` и `RUNNINGHUB_LIVE_CASES=full` — `LIVE_PASS: upload_kind=provider_file cache_reused=true`; typecheck/build/unit/L05/full offline suite на этом шаге — PASS. Provider reference и API key не выводились.
- Доказательства: `ACCEPTANCE.md` `L05-LIVE-003` — PASS; ephemeral root и in-memory SQLite удалены в `finally`.
- Ограничения/остаток: это scoped upload evidence для синтетического PNG; combined `L05-LIVE-001`, cancel, structural graph-change, provider expiry/reconciliation и L06 остаются незавершёнными/NOT_RUN.
- Следующий шаг: отдельно выбрать следующий live case `cancel` или `structural graph`, не запускать его автоматически и не переходить к L06 в рамках этого шага.

### STEP-0045 — 2026-09-07 — выбран structural graph live case

- Пакет и статус: L05 / LIVE_PENDING.
- Изменения и назначение: выбран следующий live case `structural graph`, поскольку он проверяет основной критерий продукта — фактическое исполнение изменённого workflow с измеримым эффектом, а не только отдельный API route.
- Файлы/модули: `PROGRESS.md`.
- Проверки: live submit, платная генерация, structural graph execution и provider output — `NOT_RUN`; выбор не выполнял внешних запросов и не изменял project state.
- Доказательства: предыдущие `L05-LIVE-002` и `L05-LIVE-003` подтверждают submit/status/output и upload отдельно; structural graph остаётся самостоятельным acceptance case.
- Ограничения/остаток: для следующего шага нужен явный допуск на новый платный submit и заранее выбранный минимальный graph change с измеримым результатом, например resize с проверкой dimensions.
- Следующий шаг: подготовить ephemeral structural-graph probe и выполнить его только после явного разрешения на платную генерацию.

### STEP-0046 — 2026-09-07 — подготовка structural graph probe

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: выбранный structural graph подпункт переводится в проверяемый ephemeral harness; добавляется только локальная подготовка изменённого API-графа, без live submit, платной генерации, пользовательских данных или сохранения acceptance workflow.
- Файлы/модули: перед изменением проверены `scripts/test-live.mjs`, `src/graph/codec.ts`, `src/graph/operations.ts`, `src/execution/runner.ts`, `tests/graph/graph.test.mjs`, `ACCEPTANCE.md` и конфигурационная документация.
- Проверки: `NOT_RUN` — реализация и локальные regression suites будут выполнены после изменения; live structural submit — `NOT_RUN`, поскольку он требует отдельного явного разрешения на платный вызов.
- Доказательства: существующие `L05-LIVE-002` и `L05-LIVE-003` подтверждают только submit/status/output и upload; структурно изменённый граф ещё не отправлялся.
- Ограничения/остаток: probe должен выбирать только явно указанный или однозначно найденный resize node, менять width/height через lossless graph operations и не делать автоматический submit при неоднозначной/неполной конфигурации.
- Следующий шаг: добавить pure resize preparation helper, opt-in structural harness и offline test на изменение graph hash; затем проверить typecheck/build/offline suite без запуска live probe.

### STEP-0047 — 2026-09-07 — structural probe harness подготовлен

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: добавлен `prepareResizeGraph`, который выбирает единственный или явно указанный node с `width`/`height`, создаёт lossless integer edits и возвращает diff/validation; live harness получил `--structural-graph`, `--resize-node-id`, `--resize-width`, `--resize-height`. Harness получает workflow в память, создаёт изменённую ephemeral revision и durable plan с новым graph hash; проектное состояние не сохраняется.
- Файлы/модули: `src/graph/structuralProbe.ts`, `scripts/test-live.mjs`, `tests/graph/graph.test.mjs`, `README.md`, `docs/configuration.md`, `docs/capabilities.md`, `ACCEPTANCE.md`, `PROGRESS.md`.
- Проверки: `NOT_RUN` — typecheck/build/graph/offline suites будут выполнены после этого изменения; structural live submit — `NOT_RUN`, поскольку явное разрешение на платную генерацию для выполнения harness не дано.
- Доказательства: offline test добавлен для изменения graph hash и отказа при двух resize candidates; acceptance case `L05-LIVE-004` оставлен `NOT_RUN` и не выдаётся за live evidence.
- Ограничения/остаток: фактическая доступность resize node, provider acceptance изменённого workflow, output readiness и измерение итоговых dimensions ещё не проверены; cancel и L06 вне текущего пункта.
- Следующий шаг: выполнить `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run test:graph` и `npm.cmd run test:acceptance:offline`; live structural probe не запускать без отдельного разрешения.

### STEP-0048 — 2026-09-07 — compile checks structural probe

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: после добавления helper/harness production TypeScript compilation завершена; generated `dist/` содержит новый `structuralProbe` модуль для offline tests и live harness.
- Файлы/модули: `src/graph/structuralProbe.ts`, rebuilt `dist/`, `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — PASS; `npm.cmd run build` — PASS. Graph/offline suites — `NOT_RUN` на этом промежуточном шаге; live structural submit — `NOT_RUN` из-за запрета запуска платной генерации без отдельного разрешения.
- Доказательства: TypeScript strict check и production compiler завершились без ошибок.
- Ограничения/остаток: runtime preparation, regression suites и provider structural acceptance ещё не подтверждены.
- Следующий шаг: выполнить `npm.cmd run test:graph`, затем `npm.cmd run test:acceptance:offline`; live probe не запускать.

### STEP-0049 — 2026-09-07 — graph preparation regression

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: подтверждена локальная подготовка resize probe: unambiguous node получает два lossless integer edits и новый graph hash, а два кандидата отклоняются без произвольного выбора.
- Файлы/модули: `tests/graph/graph.test.mjs`, rebuilt `dist/`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:graph` — PASS (7 tests, 0 failures). SQLite experimental warning ожидаем и не относится к MCP stdout. Полный offline suite — `NOT_RUN` на этом промежуточном шаге; live structural submit — `NOT_RUN`.
- Доказательства: TAP output graph suite, включая новый structural probe test.
- Ограничения/остаток: остальные offline packages после изменения и фактическое cloud execution изменённого graph ещё не проверены.
- Следующий шаг: выполнить полный `npm.cmd run test:acceptance:offline`; live structural probe не запускать.

### STEP-0050 — 2026-09-07 — offline verification structural probe

- Пакет и статус: L05 / LIVE_PENDING; локальная подготовка structural graph probe завершена.
- Изменения и назначение: подтверждены lossless resize preparation, отказ от неоднозначного node selection, ephemeral plan construction и opt-in live harness path; acceptance workflow не попадает в project state.
- Файлы/модули: `src/graph/structuralProbe.ts`, `scripts/test-live.mjs`, `tests/graph/graph.test.mjs`, `README.md`, `docs/configuration.md`, `docs/capabilities.md`, `ACCEPTANCE.md`, `PROGRESS.md`, rebuilt `dist/`.
- Проверки: `npm.cmd run typecheck` — PASS; `npm.cmd run build` — PASS; `npm.cmd run test:graph` — PASS (7); `npm.cmd run test:acceptance:offline` — PASS (unit 3, contract 2, graph 7, L03 4, L04 4, L05 10, MCP 1; всего 31 tests, 0 failures); live structural submit/status/outputs — `NOT_RUN`, поскольку текущий запрос не содержит отдельного разрешения на платную генерацию.
- Доказательства: `ACCEPTANCE.md` `L05-LIVE-004` — `NOT_RUN`; synthetic graph test не является cloud evidence. SQLite experimental warnings ожидаемы и не загрязняют MCP stdout.
- Ограничения/остаток: не подтверждены provider acceptance изменённого workflow, фактические output dimensions и structural live execution; cancel, provider expiry/reconciliation и L06 остаются вне текущего пункта.
- Следующий шаг: только после отдельного разрешения на платный submit передать явный numeric workflow ID и resize parameters в `npm.cmd run test:live -- --structural-graph ...`; до этого не выполнять live command.

### STEP-0051 — 2026-09-07 — syntax check live harness

- Пакет и статус: L05 / LIVE_PENDING; текущий локальный structural graph preparation пункт завершён.
- Изменения и назначение: проверен синтаксис opt-in live harness без импорта/вызова RunningHub API; рабочее дерево не получило новых runtime-изменений.
- Файлы/модули: `scripts/test-live.mjs`, `PROGRESS.md`.
- Проверки: `node --check scripts/test-live.mjs` — PASS; live structural submit/status/outputs и платная генерация — `NOT_RUN` из-за отсутствия отдельного разрешения на запуск.
- Доказательства: `ACCEPTANCE.md` `L05-LIVE-004` остаётся `NOT_RUN`; все локальные проверки зафиксированы в STEP-0050.
- Ограничения/остаток: cloud structural compatibility, provider output dimensions и cancel не подтверждены; к L06 переходить нельзя.
- Следующий шаг: после отдельного разрешения выполнить один явно параметризованный structural live probe; иначе оставить L05 в `LIVE_PENDING`.

### STEP-0052 — 2026-09-07 — разрешён structural live probe

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: получено явное разрешение на один платный structural probe. Будет использован сохранённый user-supplied workflow ID `2087104558464446466`, ephemeral resize до `64x64`, bounded wait `300000` ms; acceptance workflow не импортируется и не сохраняется.
- Файлы/модули: `PROGRESS.md`; код перед запуском не изменяется.
- Проверки: наличие API key и `RUNNINGHUB_LIVE_CASES=full` будет проверено дочерним процессом без вывода значений; structural submit/status/outputs — `NOT_RUN` до команды; повторный submit не планируется.
- Доказательства: предыдущие live cases `L05-LIVE-002` и `L05-LIVE-003`; этот probe станет отдельным `L05-LIVE-004` только по фактическому результату.
- Ограничения/остаток: probe проверяет один workflow и один resize node; failure/timeout не будет автоматически повторён.
- Следующий шаг: выполнить ровно один `npm.cmd run test:live -- --structural-graph --workflow-id 2087104558464446466 --resize-width 64 --resize-height 64 --timeout-ms 300000` с безопасно перенесёнными User environment variables.

### STEP-0053 — 2026-09-07 — structural probe остановлен до submit

- Пакет и статус: L05 / LIVE_PENDING; structural live acceptance не подтверждён.
- Изменения и назначение: выполнен ровно один разрешённый structural harness run для workflow ID `2087104558464446466` с target `64x64`. API workflow был получен в память; helper однозначно выбрал node `50`, но остановился на проверке `50.width`, так как значение не является положительным integer literal. Payload submit не отправлялся.
- Файлы/модули: `ACCEPTANCE.md`, `PROGRESS.md`; исходники и project state не изменялись, ephemeral state удалён harness cleanup.
- Проверки: `npm.cmd run test:live -- --structural-graph --workflow-id 2087104558464446466 --resize-width 64 --resize-height 64 --timeout-ms 300000` — `LIVE_FAIL` до submit: `Resize input 50.width is not a positive integer literal.` Provider task ID, status, outputs и платное выполнение отсутствуют. Автоматический retry — `NOT_RUN` и запрещён текущим scope.
- Доказательства: stdout/stderr команды; `ACCEPTANCE.md` `L05-LIVE-004` оставлен `NOT_RUN`, поскольку нет structural submit/output evidence. API key и workflow payload в журнал не записывались.
- Ограничения/остаток: нужен отдельный технический fix для семантики resize input этого provider workflow и новое явное разрешение перед повторной live попыткой; нельзя считать этот workflow cloud-compatible. Cancel и L06 не затрагивались.
- Следующий шаг: не повторять live probe автоматически; после отдельного разрешения сначала адаптировать resize input mapping по фактической схеме workflow, затем выполнить новую единственную пробу.

### STEP-0054 — 2026-09-07 — offline regression после live probe

- Пакет и статус: L05 / LIVE_PENDING.
- Изменения и назначение: после единственного live harness attempt повторно подтверждено, что offline runtime и acceptance contracts не изменились; новых внешних вызовов не выполнялось.
- Файлы/модули: rebuilt `dist/`, `PROGRESS.md`; исходники не изменялись после STEP-0051.
- Проверки: `npm.cmd run test:acceptance:offline` — PASS (unit 3, contract 2, graph 7, L03 4, L04 4, L05 10, MCP 1; всего 31 tests, 0 failures). SQLite experimental warnings ожидаемы. Повторный live probe — `NOT_RUN` по правилу одного разрешённого запуска.
- Доказательства: TAP output всех offline suites; `ACCEPTANCE.md` `L05-LIVE-004` остаётся `NOT_RUN`, так как предыдущая команда завершилась до submit.
- Ограничения/остаток: structural cloud execution, provider status/outputs и output dimensions не подтверждены; `50.width` требует уточнения фактической схемы workflow. Cancel и L06 не затрагивались.
- Следующий шаг: получить отдельное разрешение на новую live попытку только после offline mapping fix для resize input; до этого внешние вызовы не выполнять.

### STEP-0055 — 2026-09-07 — начало resize input mapping fix

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: после разрешения на продолжение выбран ровно один следующий подпункт из STEP-0054: адаптировать offline resize mapping для provider workflow, где `50.width` не был numeric literal. Новый live запрос и платная генерация до завершения локальной проверки не выполняются.
- Файлы/модули: перед изменением повторно проверены `src/graph/structuralProbe.ts`, `src/graph/codec.ts`, `tests/graph/graph.test.mjs` и записи STEP-0053/0054.
- Проверки: `NOT_RUN` — mapping fix и offline regression будут выполнены после изменения; новый live probe — `NOT_RUN` до завершения этого локального подпункта.
- Доказательства: единственный предыдущий probe завершился до submit с ошибкой `Resize input 50.width is not a positive integer literal.`; повторного внешнего вызова не будет в рамках этого подпункта.
- Ограничения/остаток: принимать только безопасные numeric strings и явные links как значения, которые будут заменены target dimensions; неизвестные типы по-прежнему должны отклоняться.
- Следующий шаг: обновить `prepareResizeGraph` и добавить offline tests для string/link resize inputs, затем запустить typecheck/build/graph/offline suites.

### STEP-0056 — 2026-09-07 — resize mapping расширен локально

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: `prepareResizeGraph` теперь принимает безопасные positive numeric strings и link inputs как исходные значения resize-портов, заменяя их на явные target integer dimensions; неподдержанные типы по-прежнему возвращают `CAPABILITY_UNKNOWN`. Добавлены synthetic tests для string и link representations.
- Файлы/модули: `src/graph/structuralProbe.ts`, `tests/graph/graph.test.mjs`, `PROGRESS.md`.
- Проверки: `NOT_RUN` — typecheck/build/graph/offline suites будут выполнены после изменения; новый live probe — `NOT_RUN` до завершения локальных проверок.
- Доказательства: tests фиксируют before mapping (`512` и `link:sizes:<index>`), новый graph hash и numeric target export; это offline evidence, не cloud compatibility.
- Ограничения/остаток: точный provider semantic contract для node `50` ещё не подтверждён; links заменяются только потому, что probe явно задаёт target dimensions, а не как универсальный link coercion.
- Следующий шаг: выполнить typecheck, build, graph suite и полный offline acceptance; не запускать live автоматически.

### STEP-0057 — 2026-09-07 — compile check resize mapping fix

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: новый resize mapping helper компилируется; production `dist/` пересобран перед runtime tests.
- Файлы/модули: `src/graph/structuralProbe.ts`, rebuilt `dist/`, `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — PASS; `npm.cmd run build` — PASS. Graph/offline suites — `NOT_RUN` на этом промежуточном шаге; live probe — `NOT_RUN`.
- Доказательства: TypeScript strict check и compiler завершились без ошибок.
- Ограничения/остаток: поведение string/link mapping и отсутствие регрессий ещё требуют тестового прогона.
- Следующий шаг: выполнить `npm.cmd run test:graph`, затем `npm.cmd run test:acceptance:offline`; внешний probe не запускать.

### STEP-0058 — 2026-09-07 — resize mapping graph regression

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: graph suite подтвердил replacement provider-style string dimensions и linked dimensions без потери atomic edit semantics; локальная structural probe preparation теперь покрывает формат, на котором остановился node `50`.
- Файлы/модули: `tests/graph/graph.test.mjs`, rebuilt `dist/`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:graph` — PASS (8 tests, 0 failures). SQLite experimental warning ожидаем. Полный offline acceptance — `NOT_RUN` на этом промежуточном шаге; live probe — `NOT_RUN`.
- Доказательства: TAP output graph suite, включая два новых mapping cases.
- Ограничения/остаток: provider structural submit/status/output ещё не проверены после mapping fix.
- Следующий шаг: выполнить полный `npm.cmd run test:acceptance:offline`; live command не запускать в рамках этого шага.

### STEP-0059 — 2026-09-07 — offline mapping fix завершён

- Пакет и статус: L05 / LIVE_PENDING; выбранный локальный mapping подпункт завершён.
- Изменения и назначение: resize preparation теперь поддерживает provider numeric-string и linked dimension inputs, заменяя их только явными target integers; неизвестные значения не принимаются. Это устраняет конкретный pre-submit failure `50.width` без ослабления graph validation.
- Файлы/модули: `src/graph/structuralProbe.ts`, `tests/graph/graph.test.mjs`, `PROGRESS.md`, rebuilt `dist/`.
- Проверки: `npm.cmd run typecheck` — PASS; `npm.cmd run build` — PASS; `npm.cmd run test:graph` — PASS (8); `npm.cmd run test:acceptance:offline` — PASS (unit 3, contract 2, graph 8, L03 4, L04 4, L05 10, MCP 1; всего 32 tests, 0 failures). SQLite experimental warnings ожидаемы. Новый live probe — `NOT_RUN` на этом шаге.
- Доказательства: TAP output graph/offline suites; synthetic string/link cases подтверждают mapping, но не cloud execution.
- Ограничения/остаток: provider semantic acceptance node `50`, structural submit/status/outputs и output dimensions всё ещё не подтверждены; предыдущая попытка не создала task.
- Следующий шаг: отдельным следующим действием выполнить одну новую parameterized structural live probe через обновлённый harness; до этого не делать дополнительных внешних вызовов.

### STEP-0060 — 2026-09-07 — разрешена повторная structural live probe

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: получено явное подтверждение на одну новую live probe после offline mapping fix. Используется workflow ID `2087104558464446466`, target `64x64`, bounded wait `300000` ms; acceptance workflow не сохраняется.
- Файлы/модули: `PROGRESS.md`; код перед запуском не изменяется.
- Проверки: User environment variables будут безопасно перенесены в дочерний процесс без вывода значений; submit/status/outputs — `NOT_RUN` до команды; retry не планируется.
- Доказательства: STEP-0059 typecheck/build/graph/offline PASS; предыдущая попытка STEP-0053 завершилась до submit и не создала provider task.
- Ограничения/остаток: live evidence будет засчитана только при фактическом изменённом graph submit и готовом output; failure/timeout фиксируется без автоматического повтора.
- Следующий шаг: выполнить ровно один `npm.cmd run test:live -- --structural-graph --workflow-id 2087104558464446466 --resize-width 64 --resize-height 64 --timeout-ms 300000`.

### STEP-0061 — 2026-09-07 — structural graph live PASS

- Пакет и статус: L05 / LIVE_PENDING; выбранный structural graph live подпункт завершён.
- Изменения и назначение: обновлённый harness получил workflow ID `2087104558464446466`, заменил dimensions на `64x64` в node `50`, отправил изменённый full graph через durable runner и дождался готовых outputs. Workflow/project state оставались ephemeral; новый submit после первоначального не выполнялся.
- Файлы/модули: `ACCEPTANCE.md`, `docs/capabilities.md`, `docs/configuration.md`, `PROGRESS.md`; provider task state оставлен у RunningHub по async lifecycle.
- Проверки: `npm.cmd run test:live -- --structural-graph --workflow-id 2087104558464446466 --resize-width 64 --resize-height 64 --timeout-ms 300000` — PASS: `LIVE_STRUCTURAL_SUBMIT: node_id=50 graph_hash_changed=true execution_state=RUNNING`, затем `LIVE_PASS: structural_graph=true resize_node=50 output_ready=true`. API key не выводился.
- Доказательства: `ACCEPTANCE.md` `L05-LIVE-004` — PASS; один provider task, output query завершён успешно. Это evidence только для указанного workflow/node/profile, не для account-wide compatibility.
- Ограничения/остаток: реальные output dimensions не декодировались/не измерялись; cancel, provider expiry/reconciliation и combined `L05-LIVE-001` остаются незавершёнными. L06 не начинался.
- Следующий шаг: остановиться на завершённом structural graph live подпункте; отдельно выбирать cancel probe либо переход к L06, не запускать автоматически.

### STEP-0062 — 2026-09-07 — начало cancel live подпункта

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: по последней записи выбран ровно один следующий подпункт `cancel`; пользователь явно разрешил один live probe, включая создание тестовой provider-задачи и внешний cancel. Workflow ID остаётся ephemeral и не импортируется в project state.
- Файлы/модули: перед изменением проверены `src/backends/workflow-api/client.ts`, `src/execution/runner.ts`, `src/storage/database.ts`, `src/mcp/server.ts`, `scripts/test-live.mjs`, `tests/execution/l05.test.mjs` и контракты разделов 20.4–20.6 плана.
- Проверки: live submit/cancel — `NOT_RUN` до добавления harness; typecheck/build/offline tests будут выполнены после локального изменения. Пользовательские данные не используются.
- Доказательства: текущие `L05-LIVE-002`/`L05-LIVE-003`/`L05-LIVE-004` покрывают submit/status/outputs, upload и structural graph отдельно; cancel остаётся непроверенным.
- Ограничения/остаток: нужен явный opt-in cancel harness, который отправляет один ephemeral workflow и вызывает `DurableWorkflowRunner.cancel` без автоматического повтора; terminal provider response должен быть записан без секретов.
- Следующий шаг: добавить cancel-only live flow и локальные cancel assertions, затем выполнить typecheck/build/offline checks перед единственным внешним probe.

### STEP-0063 — 2026-09-07 — cancel harness и локальный adapter contract

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: добавлен opt-in `--cancel` live flow с ephemeral workflow/project/SQLite и одним вызовом `DurableWorkflowRunner.cancel`; client теперь разбирает официальный `taskStatus` и не маскирует HTTP-200 application error как успешную отмену. Добавлен synthetic test для job cancellation без второго submit и adapter parsing/error cases.
- Файлы/модули: `scripts/test-live.mjs`, `src/backends/workflow-api/client.ts`, `tests/execution/l05.test.mjs`, `ACCEPTANCE.md`, `PROGRESS.md`.
- Проверки: `NOT_RUN` — typecheck/build/L05/offline suites будут выполнены после изменения; live submit/cancel — `NOT_RUN` до завершения локальных проверок. Harness не сохраняет workflow, provider payload или секрет.
- Доказательства: `ACCEPTANCE.md` добавлен case `L05-LIVE-005` со статусом `NOT_RUN`; synthetic test не является live evidence.
- Ограничения/остаток: фактический provider cancel response и terminal cancellation ещё не проверены; новый live probe нельзя повторять автоматически при ошибке.
- Следующий шаг: выполнить `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run test:l05` и `npm.cmd run test:acceptance:offline`; при PASS запустить ровно один `--cancel` probe.

### STEP-0064 — 2026-09-07 — compile и syntax checks cancel harness

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: cancel harness и adapter change прошли статическую проверку; production `dist/` пересобран для runtime tests.
- Файлы/модули: `dist/` regenerated from `src/backends/workflow-api/client.ts` and related sources; source files from STEP-0063 unchanged.
- Проверки: `npm.cmd run typecheck` — PASS; `npm.cmd run build` — PASS; `node --check scripts/test-live.mjs` — PASS. L05/offline suites и live cancel — `NOT_RUN` на этом промежуточном шаге.
- Доказательства: TypeScript compiler завершился без ошибок; syntax check не импортирует и не вызывает RunningHub API.
- Ограничения/остаток: runtime cancellation assertions и provider cancel response ещё требуют тестов; внешний вызов по-прежнему не выполнялся.
- Следующий шаг: выполнить `npm.cmd run test:l05`, затем полный offline acceptance.

### STEP-0065 — 2026-09-07 — L05 cancel regression

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: durable cancellation и Workflow API cancel parser подтверждены synthetic regression без второго submit; HTTP-200 application error не принимается за успешную отмену.
- Файлы/модули: `tests/execution/l05.test.mjs`, rebuilt `dist/`; исходники после STEP-0063 не менялись.
- Проверки: `npm.cmd run test:l05` — PASS (12 tests, 0 failures; SQLite experimental warning ожидаем). Полный offline acceptance и live cancel — `NOT_RUN`.
- Доказательства: TAP output L05 suite, включая provider cancellation и `taskStatus` parsing.
- Ограничения/остаток: cloud cancel route и фактический provider terminal state ещё не подтверждены.
- Следующий шаг: выполнить `npm.cmd run test:acceptance:offline`; при PASS запустить единственный разрешённый cancel probe.

### STEP-0066 — 2026-09-07 — offline acceptance перед cancel probe

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: полный offline regression после добавления cancel harness и parser guard прошёл; live cancel остаётся единственным непроверенным действием выбранного подпункта.
- Файлы/модули: rebuilt `dist/`; source files and fixtures were not modified by tests.
- Проверки: `npm.cmd run test:acceptance:offline` — PASS: unit 3, contract 2, graph 8, L03 4, L04 4, L05 12, MCP 1; всего 34 tests, 0 failures. SQLite experimental warnings ожидаемы. Live submit/cancel — `NOT_RUN` до отдельного opt-in вызова.
- Доказательства: TAP output всех offline suites; `ACCEPTANCE.md` `L05-LIVE-005` остаётся `NOT_RUN`.
- Ограничения/остаток: cloud cancellation и provider terminal state ещё не проверены; workflow ID будет передан harness только в память.
- Следующий шаг: выполнить ровно один `npm.cmd run test:live -- --cancel --workflow-id 2087104558464446466` с безопасно перенесёнными User environment variables, без вывода ключа.

### STEP-0067 — 2026-09-07 — cancel live PASS

- Пакет и статус: L05 / LIVE_PENDING; выбранный cancel live подпункт завершён.
- Изменения и назначение: ephemeral harness получил workflow ID `2087104558464446466`, создал одну provider task через durable runner и сразу вызвал Workflow API cancel; локальные project/workflow/SQLite state удалены после probe, повторный submit не выполнялся.
- Файлы/модули: `scripts/test-live.mjs`, `src/backends/workflow-api/client.ts`, `tests/execution/l05.test.mjs`, `README.md`, `docs/configuration.md`, `docs/capabilities.md`, `ACCEPTANCE.md`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:live -- --cancel --workflow-id 2087104558464446466` с User environment values — PASS: `LIVE_CANCEL_SUBMIT` вернул task state `RUNNING`, затем `LIVE_PASS: cancel=true provider_state=CANCELLED`. API key и private payload не выводились.
- Доказательства: `ACCEPTANCE.md` `L05-LIVE-005` — PASS; `L05-LIVE-001` обновлён в PASS на основании отдельных scoped submit/status/output/upload/structural/cancel probes. Offline suite из STEP-0066 — PASS (34 tests).
- Ограничения/остаток: evidence относится к одному workflow/profile; provider expiry/reconciliation, download/preview/review и account-wide compatibility не проверены. L06 не начинался.
- Следующий шаг: остановиться на завершённом cancel подпункте; отдельно выбрать provider-side reconciliation либо переход к L06, не запускать автоматически.

### STEP-0068 — 2026-09-07 — граница provider-side reconciliation

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: выбран ровно один следующий пункт после cancel: безопасная reconciliation уже известного provider task, который явно истёк или больше не найден у провайдера. Такой ответ должен стать локальным terminal failure без повторного платного submit; обычные сетевые и неясные application errors останутся recoverable/unknown.
- Файлы/модули: перед изменением проверены `RUNNINGHUB_MCP_IMPLEMENTATION_PLAN.md` (разделы 10.3 и 20.4–20.6), `src/backends/workflow-api/client.ts`, `src/execution/runner.ts`, `src/execution/types.ts`, `src/storage/database.ts`, `tests/execution/l05.test.mjs`.
- Проверки: `NOT_RUN` — реализация и synthetic regression будут выполнены после изменения; live provider expiry/reconciliation — `NOT_RUN`, поскольку новый внешний вызов и повторная платная задача не нужны для этого локального контракта.
- Доказательства: план запрещает blind retry после неоднозначного submit и требует polling известного task ID; текущий код уже сохраняет task ID, но HTTP-200/terminal provider expiry response ещё не сводит job к явному FAILED.
- Ограничения/остаток: reconciliation не будет искать потерянную задачу по graph hash и не будет считать общий timeout/сетевой сбой истечением provider task. Download/preview/review остаются L06.
- Следующий шаг: добавить явное распознавание provider task expiry/not-found в Workflow API status и проверить, что runner после restart фиксирует FAILED без output query и второго submit.

### STEP-0069 — 2026-09-07 — локальный provider reconciliation fix

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: Workflow API status теперь распознаёт только явные terminal markers `EXPIRED`/`TASK_EXPIRED`/`TASK_NOT_FOUND`/`NOT_FOUND` и возвращает нормализованный `FAILED` с provider error code; runner использует существующий durable failure transition, не запрашивает outputs и не повторяет submit. Неявные/transient application errors по-прежнему отклоняются как provider error.
- Файлы/модули: `src/backends/workflow-api/client.ts`, `tests/execution/l05.test.mjs`, `PROGRESS.md`.
- Проверки: `NOT_RUN` — typecheck/build/L05/offline regression будут выполнены после изменения; live provider expiry/reconciliation — `NOT_RUN`, внешний вызов не нужен для локального контракта.
- Доказательства: добавлены synthetic cases HTTP-200 expiry/not-found/transient parsing и restart recovery с одним submit, одним status, нулём output queries.
- Ограничения/остаток: provider-specific expiry codes, кроме перечисленных явных markers, остаются неизвестными; это не live evidence и не reconciliation потерянного task ID.
- Следующий шаг: выполнить typecheck, build и `npm.cmd run test:l05`, затем полный offline acceptance; при regressions менять только этот reconciliation пункт.

### STEP-0070 — 2026-09-07 — typecheck reconciliation fix

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: после provider reconciliation изменений TypeScript strict compilation завершилась без ошибок; исходный код дополнительно не менялся.
- Файлы/модули: `src/backends/workflow-api/client.ts`, `tests/execution/l05.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — PASS. Build, L05 regression, полный offline acceptance и live provider expiry/reconciliation — `NOT_RUN` на этом промежуточном шаге.
- Доказательства: команда завершилась с exit code 0; live API и платные операции не выполнялись.
- Ограничения/остаток: runtime parsing и restart test ещё не прошли после компиляции.
- Следующий шаг: выполнить `npm.cmd run build`, затем `npm.cmd run test:l05`.

### STEP-0071 — 2026-09-07 — build reconciliation fix

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: production build после provider reconciliation изменений завершился без compile regressions; `dist/` пересобран для runtime tests.
- Файлы/модули: rebuilt `dist/` из `src/backends/workflow-api/client.ts` и связанных источников; `PROGRESS.md`.
- Проверки: `npm.cmd run build` — PASS. L05 regression, полный offline acceptance и live provider expiry/reconciliation — `NOT_RUN` на этом промежуточном шаге.
- Доказательства: TypeScript compiler завершился с exit code 0; внешние вызовы не выполнялись.
- Ограничения/остаток: parser и durable restart recovery требуют runtime regression.
- Следующий шаг: выполнить `npm.cmd run test:l05`.

### STEP-0072 — 2026-09-07 — L05 reconciliation regression

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: synthetic execution suite подтвердил provider expiry reconciliation после restart: известный task переводится в `FAILED`, outputs не запрашиваются, второй submit не выполняется; явные expiry/not-found и transient status bodies разбираются раздельно.
- Файлы/модули: `tests/execution/l05.test.mjs`, rebuilt `dist/`, `PROGRESS.md`; исходники после STEP-0069 не менялись.
- Проверки: `npm.cmd run test:l05` — PASS (14 tests, 0 failures; включает build). SQLite experimental warning ожидаем и не относится к MCP stdout. Полный offline acceptance и live provider expiry/reconciliation — `NOT_RUN`.
- Доказательства: TAP output L05 suite, включая restart recovery, output_calls `0` и submit_calls `1` assertions.
- Ограничения/остаток: полный offline regression ещё не прошёл после изменения; live provider expiry/reconciliation остаётся `NOT_RUN`, так как внешний вызов не нужен для локального пункта.
- Следующий шаг: выполнить `npm.cmd run test:acceptance:offline`; live probe не запускать.

### STEP-0073 — 2026-09-07 — offline acceptance reconciliation

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: полный offline acceptance после provider reconciliation изменений прошёл; добавлена отдельная acceptance evidence для явного expiry/not-found после restart и синхронизирована документация границы local synthetic против provider-specific live evidence.
- Файлы/модули: `ACCEPTANCE.md`, `docs/capabilities.md`, `docs/configuration.md`, rebuilt `dist/`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:acceptance:offline` — PASS: unit 3, contract 2, graph 8, L03 4, L04 4, L05 14, MCP 1; всего 36 tests, 0 failures. SQLite experimental warnings ожидаемы и не загрязняют MCP stdout. Live provider expiry/reconciliation — `NOT_RUN`.
- Доказательства: `ACCEPTANCE.md` `L05-RECOVERY-002` — PASS; L05 synthetic suite подтверждает `submit_calls=1`, `status_calls=1`, `output_calls=0` для expired task.
- Ограничения/остаток: фактические provider-specific expiry/not-found responses в live среде не проверены; account-wide compatibility, download/preview/review остаются вне L05. L06 не начинался.
- Следующий шаг: завершить этот provider-side reconciliation подпункт в текущем локальном scope; не переходить к L06 и не запускать live expiry probe автоматически.

### STEP-0074 — 2026-09-07 — завершение локального provider-side reconciliation

- Пакет и статус: L05 / LIVE_PENDING; выбранный локальный подпункт завершён.
- Изменения и назначение: explicit provider task expiry/not-found responses are now reconciled to durable local `FAILED` after restart, with the known task ID retained and no output query or second submit. Transient/ambiguous provider errors remain distinguishable and are not treated as expiry.
- Файлы/модули: `src/backends/workflow-api/client.ts`, `tests/execution/l05.test.mjs`, `ACCEPTANCE.md`, `docs/capabilities.md`, `docs/configuration.md`, `PROGRESS.md`, rebuilt `dist/`.
- Проверки: `npm.cmd run typecheck` — PASS; `npm.cmd run build` — PASS; `npm.cmd run test:l05` — PASS (14); `npm.cmd run test:acceptance:offline` — PASS (unit 3, contract 2, graph 8, L03 4, L04 4, L05 14, MCP 1; всего 36 tests, 0 failures). Live provider expiry/reconciliation — `NOT_RUN`: provider-specific terminal response не запрашивался, новых внешних изменений и платных генераций не выполнялось.
- Доказательства: `ACCEPTANCE.md` `L05-RECOVERY-002` — PASS; SQLite restart synthetic case сохраняет `provider_task_id`, делает ровно один status call, ноль output calls и один submit.
- Ограничения/остаток: live evidence для конкретных provider expiry/not-found кодов и account-wide compatibility отсутствует; result download/preview/review остаются L06. Тестовый workflow и пользовательские данные не изменялись.
- Следующий шаг: только при отдельном разрешении выбрать provider-specific live expiry probe; иначе следующей отдельной задачей может быть L06, но к ней в этой сессии не переходить.

### STEP-0075 — 2026-09-07 — подготовка read-only live expiry probe

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: по явному запросу выбран один read-only provider-specific probe для неизвестного numeric task ID. Он проверит реальный status/query response и нормализацию `NOT_FOUND`/`EXPIRED`, не создавая provider task, не выполняя upload или платную генерацию.
- Файлы/модули: перед изменением проверен `scripts/test-live.mjs` и текущий `WorkflowApiClient`; acceptance workflow и пользовательские данные в probe не используются.
- Проверки: `NOT_RUN` — harness change и локальные regression checks будут выполнены до live вызова; live status/query — `NOT_RUN` до отдельной команды.
- Доказательства: текущий synthetic `L05-RECOVERY-002` покрывает durable transition; live evidence должна быть получена только из фактического provider response без вывода API key.
- Ограничения/остаток: неизвестный task ID доказывает provider `not-found` reconciliation, но не естественное истечение существующей задачи; второй live запрос и submit не допускаются.
- Следующий шаг: добавить `--expiry --task-id <numeric-id>` в live harness, выполнить syntax/build/offline checks, затем сделать один status/query запрос для заведомо неиспользуемого numeric ID.

### STEP-0076 — 2026-09-07 — read-only expiry harness

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: `scripts/test-live.mjs` получил отдельный `--expiry --task-id` режим, который выполняет только один Workflow API status/query request и принимает лишь нормализованный terminal `FAILED` с явным `TASK_EXPIRED`/`TASK_NOT_FOUND`/`NOT_FOUND` marker. Режим несовместим с submit/upload/structural/cancel probes.
- Файлы/модули: `scripts/test-live.mjs`, `PROGRESS.md`.
- Проверки: `NOT_RUN` — syntax/build/offline checks и live status/query будут выполнены после изменения; API key не выводится, workflow/project/SQLite state не создаётся.
- Доказательства: harness не вызывает `DurableWorkflowRunner.run`, `upload` или `cancel`; acceptance result будет записан только после фактического provider response.
- Ограничения/остаток: probe проверяет provider not-found/expiry response для указанного task ID; он не создаёт и не ждёт естественного expiry существующей задачи.
- Следующий шаг: выполнить `node --check scripts/test-live.mjs`, typecheck/build и полный offline acceptance; затем один `--expiry` status/query вызов.

### STEP-0077 — 2026-09-07 — syntax check expiry harness

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: новый read-only branch live harness прошёл синтаксическую проверку; внешний код и provider state не затрагивались.
- Файлы/модули: `scripts/test-live.mjs`, `PROGRESS.md`.
- Проверки: `node --check scripts/test-live.mjs` — PASS. Typecheck/build/offline acceptance и live status/query — `NOT_RUN` на этом промежуточном шаге.
- Доказательства: Node syntax check завершился без вывода и ошибок; API key не читался probe-командой.
- Ограничения/остаток: runtime gate и фактический provider marker ещё не подтверждены.
- Следующий шаг: выполнить `npm.cmd run typecheck`.

### STEP-0078 — 2026-09-07 — typecheck expiry harness

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: TypeScript strict compilation после добавления read-only live mode завершилась без ошибок; исходники TypeScript не менялись.
- Файлы/модули: `scripts/test-live.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — PASS. Build/offline acceptance и live status/query — `NOT_RUN` на этом промежуточном шаге.
- Доказательства: compiler exit code 0; live credentials не выводились и сетевой запрос не выполнялся.
- Ограничения/остаток: production build и runtime regression ещё не прошли.
- Следующий шаг: выполнить `npm.cmd run build`.

### STEP-0079 — 2026-09-07 — build expiry harness

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: production build после добавления `--expiry` режима завершился без regressions; актуальный `dist/` подготовлен для offline suite.
- Файлы/модули: rebuilt `dist/`, `scripts/test-live.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run build` — PASS. Полный offline acceptance и live status/query — `NOT_RUN` на этом промежуточном шаге.
- Доказательства: TypeScript compiler завершился с exit code 0; внешний API не вызывался.
- Ограничения/остаток: фактический provider marker и полная offline regression ещё не проверены.
- Следующий шаг: выполнить `npm.cmd run test:acceptance:offline`; live probe не запускать до PASS.

### STEP-0080 — 2026-09-07 — offline acceptance перед expiry probe

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: полный offline regression после добавления read-only `--expiry` harness прошёл; новый live status/query остаётся единственным внешним действием выбранного подпункта.
- Файлы/модули: rebuilt `dist/`, `scripts/test-live.mjs`, `PROGRESS.md`; тесты не изменяли исходники или project state.
- Проверки: `npm.cmd run test:acceptance:offline` — PASS: unit 3, contract 2, graph 8, L03 4, L04 4, L05 14, MCP 1; всего 36 tests, 0 failures. SQLite experimental warnings ожидаемы. Live expiry/not-found query — `NOT_RUN` до отдельного вызова.
- Доказательства: локальный `L05-RECOVERY-002` остаётся PASS; API key не выводился, submit/upload/cancel не выполнялись.
- Ограничения/остаток: фактический provider terminal marker ещё неизвестен.
- Следующий шаг: выполнить ровно один `npm.cmd run test:live -- --expiry --task-id 9999999999999999999` с User environment values, без вывода ключа.

### STEP-0081 — 2026-09-07 — expiry probe rejected query body

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: выполнен один разрешённый read-only `--expiry` probe для task ID `9999999999999999999`; provider task не создавался, submit/upload/cancel не выполнялись.
- Файлы/модули: `PROGRESS.md`; исходники и project state не изменялись.
- Проверки: `npm.cmd run test:live -- --expiry --task-id 9999999999999999999` с User environment values — `LIVE_FAIL: failed to parse request body`. Это не подтверждает expiry/not-found и не было автоматически повторено.
- Доказательства: команда дошла до реального Workflow API status/query; API key и payload не выводились. Provider response указывает на несовместимость query body для этого probe, а не на terminal task state.
- Ограничения/остаток: нужен локальный contract fix/проверка формата status payload; provider-specific expiry/not-found marker ещё не получен.
- Следующий шаг: сверить официальный query contract и обновить только status probe payload без нового submit, затем typecheck/build/offline checks перед одной повторной read-only попыткой.

### STEP-0082 — 2026-09-07 — уточнение task ID для повторного query

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: сопоставлен фактический `failed to parse request body` с сохранённым query contract. Первый unknown ID `9999999999999999999` выходит за signed 64-bit диапазон provider parser; source contract и клиентский string-preservation не меняются. Для повторной попытки выбран валидный верхний signed 64-bit ID `9223372036854775807`, который не создавался этим проектом.
- Файлы/модули: только `PROGRESS.md`; код не изменялся.
- Проверки: `node --check scripts/test-live.mjs`, `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run test:acceptance:offline` — PASS до повторной попытки; первая live попытка — `LIVE_FAIL` на body parsing, не provider terminal state.
- Доказательства: `data/upstream/rh-api-contract.md` раздел Poll Task требует `{"taskId":"..."}`; API key и response payload не записывались.
- Ограничения/остаток: provider expiry/not-found marker ещё не получен; второй query остаётся единственным запланированным повтором, submit/upload/cancel запрещены.
- Следующий шаг: выполнить ровно один `npm.cmd run test:live -- --expiry --task-id 9223372036854775807` с User environment values.

### STEP-0083 — 2026-09-07 — provider returned terminal code 1004

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: второй read-only query для valid signed 64-bit unknown task ID достиг provider terminal response `state=FAILED`, `code=1004`; harness не засчитал его автоматически как not-found, потому что numeric code ещё не сопоставлен с documented provider meaning. Submit/upload/cancel и новая provider task не выполнялись.
- Файлы/модули: `PROGRESS.md`; source и project state не изменялись.
- Проверки: `npm.cmd run test:live -- --expiry --task-id 9223372036854775807` — `LIVE_FAIL: expiry probe returned state=FAILED code=1004; no explicit provider expiry/not-found marker`. Это фактический provider response, но пока не acceptance PASS.
- Доказательства: query route вернул нормализованный `FAILED` и числовой provider code; API key и payload не выводились.
- Ограничения/остаток: нужно подтвердить значение `1004`, не превращая любой provider `FAILED` в not-found; автоматические повторы запрещены до contract decision.
- Следующий шаг: проверить официальный источник значения `1004` и, только если это task-not-found/expiry, добавить точное mapping и повторить один read-only query без submit.

### STEP-0084 — 2026-09-07 — уточнение terminal marker harness

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: `--expiry` harness теперь принимает числовой provider code только вместе с нормализованным message marker `TASK/JOB ... EXPIRED/NOT FOUND/DOES NOT EXIST`; произвольный `FAILED` по-прежнему отклоняется. Это учитывает фактический response `code=1004` без hardcoding неподтверждённого numeric mapping.
- Файлы/модули: `scripts/test-live.mjs`, `PROGRESS.md`.
- Проверки: `NOT_RUN` — syntax/typecheck/build/offline checks и финальная read-only live attempt будут выполнены после изменения; submit/upload/cancel не входят.
- Доказательства: предыдущий provider response уже дал `state=FAILED`, `code=1004`; message не выводится, чтобы не записывать необработанный provider payload.
- Ограничения/остаток: acceptance PASS возможен только если повторный response сохраняет явный terminal marker в нормализованном message; естественное expiry существующей задачи не проверяется.
- Следующий шаг: выполнить syntax/typecheck/build/offline checks, затем ровно одну финальную `--expiry --task-id 9223372036854775807` попытку.

### STEP-0085 — 2026-09-07 — checks после marker fix

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: syntax и TypeScript проверки после уточнения terminal marker прошли; внешний API ещё не вызывался на этом промежуточном шаге.
- Файлы/модули: `scripts/test-live.mjs`, `PROGRESS.md`.
- Проверки: `node --check scripts/test-live.mjs` — PASS; `npm.cmd run typecheck` — PASS. Build, offline acceptance и финальный live query — `NOT_RUN`.
- Доказательства: harness не выводит provider message/payload и не принимает общий `FAILED` без expiry/not-found marker.
- Ограничения/остаток: production build и offline regression после изменения ещё не выполнены.
- Следующий шаг: выполнить `npm.cmd run build`.

### STEP-0086 — 2026-09-07 — build после marker fix

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: production build после terminal marker fix завершился без regressions; актуальный `dist/` готов для offline suite.
- Файлы/модули: rebuilt `dist/`, `scripts/test-live.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run build` — PASS. Offline acceptance и финальный live query — `NOT_RUN` на этом промежуточном шаге.
- Доказательства: TypeScript compiler exit code 0; внешний provider не вызывался.
- Ограничения/остаток: полный offline regression после изменения ещё не выполнен.
- Следующий шаг: выполнить `npm.cmd run test:acceptance:offline`.

### STEP-0087 — 2026-09-07 — offline acceptance перед финальным expiry query

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: offline regression после marker-message fix прошёл; финальный внешний шаг остаётся одним read-only status/query запросом.
- Файлы/модули: rebuilt `dist/`, `scripts/test-live.mjs`, `PROGRESS.md`; project state и fixtures тестами не изменялись.
- Проверки: `npm.cmd run test:acceptance:offline` — PASS: unit 3, contract 2, graph 8, L03 4, L04 4, L05 14, MCP 1; всего 36 tests, 0 failures. SQLite experimental warnings ожидаемы. Финальный live expiry query — `NOT_RUN` до команды.
- Доказательства: local `L05-RECOVERY-002` остаётся PASS; harness не выполняет submit/upload/cancel.
- Ограничения/остаток: live acceptance зависит от фактического provider message marker для кода `1004`.
- Следующий шаг: выполнить один `npm.cmd run test:live -- --expiry --task-id 9223372036854775807` с User environment values.

### STEP-0088 — 2026-09-07 — live not-found reconciliation PASS

- Пакет и статус: L05 / LIVE_PENDING; выбранный read-only provider reconciliation подпункт завершён.
- Изменения и назначение: неизвестный valid signed 64-bit task ID был проверен через реальный Workflow API `/openapi/v2/query`; provider вернул terminal `FAILED` с code `1004`, message marker был нормализован как explicit not-found/expiry и harness подтвердил reconciliation. Task не создавался, submit/upload/cancel не выполнялись.
- Файлы/модули: `scripts/test-live.mjs`, `ACCEPTANCE.md`, `docs/capabilities.md`, `docs/configuration.md`, `PROGRESS.md`; project/workflow/SQLite state не сохранялись.
- Проверки: `npm.cmd run test:live -- --expiry --task-id 9223372036854775807` с User environment values — PASS: `LIVE_PASS: provider_reconciliation=true terminal=1004`. API key и provider message/payload не выводились.
- Доказательства: реальный status/query response; numeric code `1004` сохранён как observed provider code, без неподтверждённого глобального hardcode mapping.
- Ограничения/остаток: probe подтверждает unknown-task not-found reconciliation для одного профиля, но не естественное expiry существующей задачи, account-wide compatibility или result/review; L06 не начинался.
- Следующий шаг: синхронизировать acceptance/docs с этим scoped live evidence и остановиться, не переходя к L06.

### STEP-0089 — 2026-09-07 — фиксация live not-found evidence

- Пакет и статус: L05 / LIVE_PENDING; выбранный пункт полностью реализован и проверен.
- Изменения и назначение: acceptance и capability/configuration docs обновлены: scoped live unknown-task reconciliation засчитан отдельно от непроверенного natural expiry и account-wide compatibility. К L06 не переходил.
- Файлы/модули: `ACCEPTANCE.md`, `docs/capabilities.md`, `docs/configuration.md`, `PROGRESS.md`; rebuilt `dist/` остаётся результатом последнего production build.
- Проверки: `node --check scripts/test-live.mjs` — PASS; `npm.cmd run typecheck` — PASS; `npm.cmd run build` — PASS; `npm.cmd run test:acceptance:offline` — PASS (36 tests, 0 failures); `npm.cmd run test:live -- --expiry --task-id 9223372036854775807` — PASS (`LIVE_PASS`, provider terminal code `1004`). Дополнительные live submit/upload/cancel не выполнялись.
- Доказательства: `ACCEPTANCE.md` `L05-LIVE-006` — PASS; read-only provider response, без создания task и без сохранения ключа/payload.
- Ограничения/остаток: natural expiry существующей задачи, account-wide compatibility, result download/preview/review остаются непроверенными; L06 не начинался.
- Следующий шаг: остановиться на завершённом live expiry/not-found подпункте; следующий пакет выбирать отдельно, не запускать автоматически.

### STEP-0090 — 2026-09-07 — повторная проверка причины provider FAILED

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: по запросу пользователя повторно проверяется read-only status/query. Harness будет выводить только нормализованную причину `not_found` или `expired`, без raw provider message, payload или API key.
- Файлы/модули: перед изменением проверены `scripts/test-live.mjs`, `src/backends/workflow-api/client.ts`, `PROGRESS.md`.
- Проверки: `NOT_RUN` — безопасный output fix и повторный live query будут выполнены после изменения; submit/upload/cancel не входят.
- Доказательства: предыдущий live response имел `state=FAILED`, code `1004`; это ожидаемый provider terminal state для неизвестного task ID, но причина не была показана в CLI.
- Ограничения/остаток: повторяет только status/query для того же неизвестного ID и не проверяет естественное expiry существующей задачи.
- Следующий шаг: добавить normalized reason в `LIVE_PASS`, выполнить syntax check и один повторный read-only query.

### STEP-0091 — 2026-09-07 — normalized reason check

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: `LIVE_PASS` теперь явно сообщает `reason=not_found` или `reason=expired`, сохраняя provider code без вывода raw message.
- Файлы/модули: `scripts/test-live.mjs`, `PROGRESS.md`.
- Проверки: `node --check scripts/test-live.mjs` — PASS. Повторный live query — `NOT_RUN` до команды.
- Доказательства: classification использует только уже нормализованный marker/error code; произвольный `FAILED` не принимается.
- Ограничения/остаток: provider status не изменяется этим read-only вызовом; natural expiry не проверяется.
- Следующий шаг: выполнить один `npm.cmd run test:live -- --expiry --task-id 9223372036854775807` с User environment values.

### STEP-0092 — 2026-09-07 — повторный live not-found probe PASS

- Пакет и статус: L05 / LIVE_PENDING; повторная проверка причины завершена.
- Изменения и назначение: повторный read-only query подтвердил, что `FAILED` был ожидаемым provider response для неизвестной задачи, а не ошибкой MCP: harness вывел `reason=not_found`, `terminal=1004`.
- Файлы/модули: `scripts/test-live.mjs`, `PROGRESS.md`; provider/project state не изменялись.
- Проверки: `node --check scripts/test-live.mjs` — PASS; `npm.cmd run test:live -- --expiry --task-id 9223372036854775807` — PASS: `LIVE_PASS: provider_reconciliation=true reason=not_found terminal=1004`. Submit/upload/cancel и платная генерация не выполнялись.
- Доказательства: фактический Workflow API status/query response; API key и raw provider message/payload не выводились.
- Ограничения/остаток: это not-found reconciliation для одного профиля, не естественное expiry существующей задачи; account-wide compatibility и L06 остаются вне текущего пункта.
- Следующий шаг: остановиться; следующий пакет или natural-expiry probe выбирать отдельно.

### STEP-0093 — 2026-09-07 — разрешён active live probe

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: по явному запросу пользователя выбран один active ephemeral probe через существующий durable runner для ранее согласованного workflow ID `2087104558464446466`. Probe выполнит ровно один submit, bounded status polling и output query; workflow/project state не сохраняются.
- Файлы/модули: `scripts/test-live.mjs`, существующие `src/execution/runner.ts` и `src/backends/workflow-api/client.ts`; перед запуском код не изменялся.
- Проверки: active submit/status/outputs — `NOT_RUN` до команды; API key будет передан дочернему процессу без вывода. Upload, cancel, пользовательские assets и повторный submit не входят.
- Доказательства: предыдущие scoped probes подтвердили этот workflow ID и его provider profile; текущий запрос явно разрешает active paid probe.
- Ограничения/остаток: результат зависит от текущей доступности workflow/profile и provider runtime; failure/timeout не будет автоматически повторён.
- Следующий шаг: выполнить один `npm.cmd run test:live -- --workflow-id 2087104558464446466 --timeout-ms 300000` с User environment values.

### STEP-0094 — 2026-09-07 — active live probe PASS

- Пакет и статус: L05 / LIVE_PENDING; выбранный active probe завершён успешно.
- Изменения и назначение: existing ephemeral harness получил workflow `2087104558464446466`, создал одну provider task, дождался успешного status и output query; project/workflow/SQLite state после probe не сохранялись.
- Файлы/модули: `PROGRESS.md`; source code не изменялся.
- Проверки: `npm.cmd run test:live -- --workflow-id 2087104558464446466 --timeout-ms 300000` с User environment values — PASS: `LIVE_SUBMIT: task_id=2097126350429659137 execution_state=RUNNING`, затем `LIVE_PASS: task_id=2097126350429659137 outputs_ready=true`. API key не выводился; повторный submit не выполнялся.
- Доказательства: фактический provider submit/status/output lifecycle для одного workflow/profile; task ID записан только в этот journal.
- Ограничения/остаток: evidence относится к одному workflow/profile и не доказывает account-wide compatibility, natural expiry, result review или L06.
- Следующий шаг: остановиться на завершённом active probe; следующий пункт выбирать отдельно.

### STEP-0095 — 2026-09-07 — запрос active probe result

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: по запросу пользователя выполняется read-only получение outputs уже завершённой provider task `2097126350429659137`; новый submit, upload, cancel и генерация не выполняются.
- Файлы/модули: `PROGRESS.md`; используется существующий `WorkflowApiClient`.
- Проверки: `NOT_RUN` — status/output query будет выполнен после этой записи; signed URL не будет сохранён в журнале.
- Доказательства: task ранее завершилась `SUCCEEDED` с `outputs_ready=true` в STEP-0094.
- Ограничения/остаток: результат доступен только если provider ещё сохраняет output URL; result download/manifest/review L06 ещё не реализованы.
- Следующий шаг: выполнить status/output query и показать полученную ссылку без повторной генерации.

### STEP-0096 — 2026-09-07 — исправление локального output-query запуска

- Пакет и статус: L05 / IN_PROGRESS.
- Изменения и назначение: первая попытка read-only output query не достигла сети из-за PowerShell/native quoting inline `node --input-type=module -e`; исправляется только способ передачи команды.
- Файлы/модули: `PROGRESS.md`; исходники и provider state не изменялись.
- Проверки: команда завершилась `SyntaxError` до импорта/HTTP вызова; status/output query — `NOT_RUN`, новый submit не выполнялся.
- Доказательства: Node сообщил `Unexpected token '.'` на потерянных кавычках import path; API key не выводился.
- Ограничения/остаток: output URL ещё не получен.
- Следующий шаг: повторить тот же status/output query с корректным PowerShell quoting.

### STEP-0097 — 2026-09-07 — active probe output retrieved

- Пакет и статус: L05 / LIVE_PENDING; output active probe получен.
- Изменения и назначение: read-only status/output query для уже завершённой task `2097126350429659137` вернул `provider_state=SUCCESS` и один output (`id=67`, MP4). Новая генерация и повторный submit не выполнялись.
- Файлы/модули: `PROGRESS.md`; provider/project state не изменялись.
- Проверки: corrected inline backend-client query — PASS; output URL получен из RunningHub и показывается пользователю отдельно, не записывается в журнал.
- Доказательства: фактический `SUCCESS` response и один MP4 output; API key не выводился.
- Ограничения/остаток: result download/preview/manifest/review L06 ещё не реализованы; URL может иметь provider retention/availability limits.
- Следующий шаг: остановиться после показа полученного MP4; следующий пакет выбирать отдельно.

### STEP-0098 — 2026-09-07 — git initial commit blocked by identity

- Пакет и статус: repository bootstrap / BLOCKED_EXTERNAL.
- Изменения и назначение: локальный Git repository инициализирован; `.gitignore` исключает `node_modules/`, `dist/`, `.tmp/`, SQLite и coverage; 64 файла проекта подготовлены в staging для initial commit.
- Файлы/модули: `.git/`, `.gitignore`, все staged source/test/docs/fixture files; секретные значения и ignored build/dependency directories не staged.
- Проверки: secret-pattern scan — без найденных ключей; `git diff --cached --check` — PASS; `git status --short` показывает только intended staged project files. `git commit -m "Initial RunningHub MCP implementation"` — `NOT_RUN/blocked`: Git identity не настроена (`user.name`/`user.email`).
- Доказательства: commit не создан; staging сохранён. Глобальный Git config не изменялся.
- Ограничения/остаток: для commit нужны предоставленные пользователем имя и email автора либо локальная настройка identity; push не выполнялся.
- Следующий шаг: получить желаемые `user.name` и `user.email`, применить их только для этого commit и повторить initial commit.

### STEP-0099 — 2026-09-07 — initial git commit создан

- Пакет и статус: repository bootstrap / LOCAL_DONE.
- Изменения и назначение: локальный Git repository инициализирован и создан initial commit `0ac69e9` с сообщением `Initial RunningHub MCP implementation`; staged содержимое проекта сохранено без ignored dependencies/build outputs.
- Файлы/модули: `.git/`, 64 tracked project files; `node_modules/` и `dist/` остаются ignored.
- Проверки: `git status --short --ignored` — рабочее дерево чистое, только `dist/` и `node_modules/` ignored; `git log --oneline -1` — `0ac69e9`; `git diff HEAD --check` — PASS. Push не выполнялся.
- Доказательства: initial commit создан с настроенной Git identity; secret scan до staging не нашёл ключей.
- Ограничения/остаток: remote не настроен; ветка остаётся `master`; commit не отправлялся во внешний Git hosting.
- Следующий шаг: при необходимости отдельно настроить remote/branch policy и выполнить push только по явному запросу.

### STEP-0100 — 2026-09-07 — удаление дублирующей стартовой инструкции

- Пакет и статус: repository documentation / LOCAL_DONE.
- Изменения и назначение: удалён `LUNA_START_HERE.md`, потому что его правила дублировали спецификацию и журнал. `RUNNINGHUB_MCP_IMPLEMENTATION_PLAN.md` теперь прямо указывает `PROGRESS.md` и собственные разделы 0, 21–22 как источник порядка работы; исторические ссылки в журнале исправлены.
- Файлы/модули: удалён `LUNA_START_HERE.md`; обновлены `RUNNINGHUB_MCP_IMPLEMENTATION_PLAN.md`, `PROGRESS.md`.
- Проверки: поиск Markdown-ссылок на `LUNA_START_HERE.md` — PASS, битых рабочих ссылок не осталось; typecheck/build — `NOT_RUN`, поскольку это Markdown-only изменение.
- Доказательства: до удаления найдено 3 внешних ссылки, все обновлены; уникальный стартовый prompt находился только внутри удаляемого файла.
- Ограничения/остаток: удаление ещё не закоммичено; текущие commits содержат прежнюю версию файла.
- Следующий шаг: при необходимости создать отдельный commit удаления документа.

## Продолжение хронологии: STEP-0101–STEP-0171

Активные записи `STEP-0101`–`STEP-0171` перенесены сюда при последующей компактизации `PROGRESS.md`. Краткое содержание сохраняет порядок решений, проверок и handoff; активным журналом остаётся только корневой `PROGRESS.md`.

### STEP-0101–STEP-0120 — result download

- `STEP-0101`: активный журнал впервые сокращён; история до `STEP-0100` закреплена в этом архиве.
- `STEP-0102`: выбран подпункт L06 result download; preview, manifest/outbox и review отложены.
- `STEP-0103`–`STEP-0109`: добавлены result records, MIME/container validation, atomic download/retry path, MCP tool и offline tests; typecheck/build завершены PASS.
- `STEP-0110`–`STEP-0112`: исправлен synthetic localhost fixture и завершены L06 result-download tests: 3 tests PASS.
- `STEP-0113`–`STEP-0118`: typecheck, build и acceptance regression доведены до PASS; migration expectation обновлён с `3/13` до `4/14`.
- `STEP-0119`: result-download подпункт отмечен `LOCAL_DONE`; provider output URL/API key не записываются.
- `STEP-0120`: рабочее дерево сверено, `git diff --check` PASS; следующий подпункт выбран отдельно.

### STEP-0121–STEP-0127 — MCP resource link

- `STEP-0121`: выбран opaque MCP resource link для локального оригинала.
- `STEP-0122`–`STEP-0124`: добавлены `runninghub://result/<id>`, safe `resources/read`, lookup и transport test с exact PNG bytes.
- `STEP-0125`–`STEP-0126`: stdio и full offline acceptance PASS, всего 35 tests без regressions.
- `STEP-0127`: resource-link подпункт отмечен `LOCAL_DONE`; следующий шаг не начинался автоматически.

### STEP-0128–STEP-0145 — read-only live result/resource verification

- `STEP-0128`–`STEP-0131`: выбран read-only probe существующей provider task; отсутствие process env и наличие User env зафиксированы без раскрытия ключа.
- `STEP-0132`: recovery probe PASS для существующей task `2097126350429659137`, без повторного submit.
- `STEP-0133`–`STEP-0138`: добавлен `--result-resource` harness и безопасная диагностика MCP error.
- `STEP-0139`–`STEP-0142`: найден provider `video/mp4`/QuickTime mismatch; добавлена узкая compatibility fix и QuickTime regression, tests PASS.
- `STEP-0143`: read-only `rh_get_results` → `resources/read` live probe PASS; `video/quicktime`, `3748525` bytes.
- `STEP-0144`–`STEP-0145`: result/resource подпункт завершён с live evidence; preview/poster, manifests/outbox и review оставлены TODO.

### STEP-0146–STEP-0153 — derived preview/poster

- `STEP-0146`: выбран только local image preview/video poster через configured ffmpeg.
- `STEP-0147`–`STEP-0149`: добавлены migration 5, `DerivedMediaService`, hash-aware reuse, atomic writes и derived resource links; L06 tests 6 PASS.
- `STEP-0150`–`STEP-0151`: README/capabilities/configuration синхронизированы, stdio regression PASS.
- `STEP-0152`: full offline acceptance PASS, 38 tests; audio derivative, manifests/outbox и review не реализованы.
- `STEP-0153`: derived preview/poster подпункт отмечен `LOCAL_DONE`; следующий выбранный пункт — manifests/outbox.

### STEP-0154–STEP-0171 — manifests/outbox and review handoff

- `STEP-0154`–`STEP-0157`: выбран и реализован manifest/outbox path; migration 6, `ResultManifestService`, atomic manifest write и typecheck PASS.
- `STEP-0158`–`STEP-0161`: добавлены offline manifest/no-secret/idempotency assertions; L06, unit и MCP tests PASS.
- `STEP-0162`–`STEP-0169`: full offline acceptance, documentation sync, build/typecheck и final L06/MCP checks PASS; всего 38 tests.
- `STEP-0170`: manifests/outbox подпункт отмечен `LOCAL_DONE`; manifest содержит graph/revision/asset/backend/task/output hashes и `review=NOT_READY`, outbox republish идемпотентен.
- `STEP-0171`: выбран следующий L06 подпункт review events/manifest review state; review gate, changes-requested revisions, approval и automatic next run не начинались.
