# Текущий прогресс реализации MCP RunningHub

Последнее обновление: 2026-09-07.

Спецификация: [RUNNINGHUB_MCP_IMPLEMENTATION_PLAN.md](RUNNINGHUB_MCP_IMPLEMENTATION_PLAN.md), редакция 2.
Полная хронология: [docs/progress-archive-2026-09-07.md](docs/progress-archive-2026-09-07.md). Архив read-only; активным журналом является только этот файл.

## Текущее состояние

- L00–L04: `LOCAL_DONE`.
- L05: `LIVE_PENDING`. Durable execution, recovery, upload/cache, status/output/cancel и structural graph flow реализованы; scoped live evidence получена для submit/status/output/upload/structural graph/cancel, active workflow и unknown-task not-found reconciliation.
- L06: `LOCAL_DONE` для локального review loop. Result download, MCP resource links, local derived image preview/video poster, manifests/outbox, review events/manifest review state, changes-requested revision/work item, chain gate и явно запрошенный approval continuation — `LOCAL_DONE`; read-only live result/resource verification — `PASS`. Независимое automatic approval не реализуется.
- L07: `TODO` — LoRA upload/bindings, media rules, cache expiry и server instructions.
- L08: `TODO` — финальная live acceptance и проверка поставки.

## Что Проверено

- `npm.cmd run typecheck` — `PASS`.
- `npm.cmd run build` — `PASS`.
- `npm.cmd run test:acceptance:offline` — `PASS`, 40 тестов.
- Review path `npm.cmd run typecheck` — `PASS`; `npm.cmd run test:l06` — `PASS`, 7 тестов.
- Read-only live recovery/result/resource probes — `PASS`; один явно разрешённый short 2-second submit/status/output probe — `PASS`; пользовательские assets не загружались.
- Не проверены: natural expiry существующей задачи, account-wide compatibility, live preview/poster/manifest/review compatibility и live chain-gate compatibility.

## Правила Сессии

1. В начале сессии читать этот файл; архив открывать только для исторического контекста.
2. После существенного шага обновлять этот файл: изменения, файлы, проверки, ограничения и следующий шаг.
3. Live API, платные генерации, пользовательские assets и внешние изменения выполнять только при явном разрешении.
4. Не выдавать synthetic/mock/offline evidence за live evidence.

## Handoff

- Текущий пакет: L06 / `LOCAL_DONE` для explicit approval continuation; automatic approval остаётся намеренно неподдержанным.
- Следующий шаг: в новой отдельной задаче выбрать следующий пункт по handoff; автоматически не начинать L07/L08.
- Последний commit реализации: `ed648c2` (`Add L06 manifests and outbox`).

### STEP-0172 — 2026-09-07 — compact active progress journal

- Пакет и статус: repository documentation / `LOCAL_DONE`.
- Изменения и назначение: записи `STEP-0101`–`STEP-0171` перенесены в `docs/progress-archive-2026-09-07.md`; активный журнал сокращён до текущего состояния, проверок, правил и handoff по образцу `STEP-0101`.
- Файлы/модули: `PROGRESS.md`, `docs/progress-archive-2026-09-07.md`.
- Проверки: archive link, наличие `STEP-0171` в архиве, отсутствие рабочих Markdown-ссылок на `LUNA_START_HERE.md` и `git diff --check` — `PASS`; активный журнал сокращён до 44 строк, архив содержит 1130 строк. Typecheck/build — `NOT_RUN`, поскольку изменение документационное.
- Ограничения/остаток: архив не является вторым активным журналом; review events/manifest review state остаются следующим незавершённым пунктом.
- Следующий шаг: синхронизировать только review documentation, затем выполнить `npm.cmd run test:mcp` и полный `npm.cmd run test:acceptance:offline`.

### STEP-0174 — 2026-09-07 — синхронизирована review documentation

- Пакет и статус: L06 / `IN_PROGRESS`; local review event contract документирован, финальные regression checks ещё не выполнены.
- Изменения и назначение: README, capability matrix и configuration теперь отражают `rh_review_result`, initial `PENDING_REVIEW`, idempotent event replay и явное отсутствие chain gate/automatic continuation.
- Файлы/модули: `README.md`, `docs/capabilities.md`, `docs/configuration.md`, `PROGRESS.md`.
- Проверки: после documentation changes `npm.cmd run test:mcp`, full offline acceptance и `git diff --check` — `NOT_RUN`; runtime code не менялся, live API и внешние изменения не выполняются.
- Ограничения/остаток: review state derived from SQLite events, immutable manifest is not rewritten; changes-requested revisions, approval automation и chain gate остаются TODO.
- Следующий шаг: выполнить `npm.cmd run test:mcp`.

### STEP-0184 — 2026-09-07 — MCP stdio regression PASS

- Пакет и статус: L06 / `IN_PROGRESS`; stdio transport остаётся рабочим после расширения review tool schema.
- Изменения и назначение: initialize/tools-list/local graph and execution-plan flow проходят без регрессии; новый optional revision request не меняет список инструментов и не вызывает provider backend в offline сценарии.
- Файлы/модули: rebuilt `dist/`; `src/mcp/server.ts`, `src/execution/reviews.ts`, `src/storage/database.ts`, `tests/mcp/stdio.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:mcp` — `PASS`, 1 тест, 0 failures; build `PASS`; SQLite experimental warning ожидаем. Full offline acceptance и финальный `git diff --check` — `NOT_RUN`; live API и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: chain gate и approval automation остаются отдельными TODO; revision request только создаёт local artifacts и не submit-ит их.
- Следующий шаг: выполнить `npm.cmd run test:acceptance:offline`.

### STEP-0185 — 2026-09-07 — full offline acceptance PASS

- Пакет и статус: L06 / `IN_PROGRESS`; все локальные regression suites проходят, остаются финальные explicit commands и handoff.
- Изменения и назначение: migration 7, typed revision request, same-chain work item и idempotent review linkage не вызвали regressions в L00–L05, L06 или stdio MCP.
- Файлы/модули: `src/storage/database.ts`, `src/execution/schemas.ts`, `src/execution/reviews.ts`, `src/mcp/server.ts`, `tests/unit/storage.test.mjs`, `tests/results/l06.test.mjs`, `README.md`, `docs/capabilities.md`, `docs/configuration.md`, `PROGRESS.md`; `dist/` пересобран.
- Проверки: `npm.cmd run test:acceptance:offline` — `PASS`: unit 3, contract 2, graph 8, L03 4, L04 4, L05 14, L06 6, MCP 1; всего 42 теста, 0 failures. Каждый внутренний build — `PASS`; SQLite experimental warnings ожидаемы. Явные typecheck/build/diff check — `NOT_RUN`; live API, платные генерации и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: review chain gate и approval automation не реализованы; новая revision не подготавливается и не отправляется автоматически. Live compatibility этого local-only flow не требуется и не проверялась.
- Следующий шаг: выполнить явные `npm.cmd run typecheck`, `npm.cmd run build` и `git diff --check`, затем завершить выбранный подпункт и остановиться.

### STEP-0186 — 2026-09-07 — changes-requested revision подпункт завершён

- Пакет и статус: L06 / `LOCAL_DONE` для explicit changes-requested revision/work item; chain gate и approval automation не начинались.
- Изменения и назначение: `rh_review_result` теперь принимает typed `revision_request` только для `CHANGES_REQUESTED`, сохраняет idempotent linkage в migration 7, создаёт дочернюю immutable revision и новый work item в том же `project_id + chain_id`. Повтор возвращает те же объекты; старый job/result/manifest остаются неизменными, provider submit не выполняется.
- Файлы/модули: `src/storage/database.ts`, `src/execution/schemas.ts`, `src/execution/reviews.ts`, `src/mcp/server.ts`, `tests/unit/storage.test.mjs`, `tests/results/l06.test.mjs`, `README.md`, `docs/capabilities.md`, `docs/configuration.md`, `PROGRESS.md`; `dist/` пересобран.
- Проверки: `npm.cmd run typecheck` — `PASS`; `npm.cmd run build` — `PASS`; `npm.cmd run test:unit` — `PASS` (3); `npm.cmd run test:l06` — `PASS` (6); `npm.cmd run test:mcp` — `PASS` (1); `npm.cmd run test:acceptance:offline` — `PASS` (42 всего: unit 3, contract 2, graph 8, L03 4, L04 4, L05 14, L06 6, MCP 1); `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings. SQLite experimental warnings ожидаемы.
- Ограничения/остаток: live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN` по правилу сессии; live compatibility нового local-only review flow отдельно не проверялась. Chain gate и approval automation остаются TODO.
- Следующий шаг: в новой отдельной задаче выбрать и реализовать chain gate; текущий выбранный подпункт завершён, дальнейшая работа в этой сессии не выполняется.

### STEP-0175 — 2026-09-07 — MCP stdio review regression PASS

- Пакет и статус: L06 / `IN_PROGRESS`; stdio regression после регистрации `rh_review_result` пройдена.
- Изменения и назначение: initialize/tools-list/local execution flow остаётся рабочим и содержит новый review tool.
- Файлы/модули: rebuilt `dist/`; `src/mcp/server.ts`, `src/execution/reviews.ts`, `tests/mcp/stdio.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:mcp` — `PASS`: build `PASS`, 1 test, 0 failures. SQLite experimental warning ожидаем. Full offline acceptance и `git diff --check` — `NOT_RUN`; live API и внешние изменения не выполняются.
- Ограничения/остаток: chain gate, changes-requested revision creation и approval continuation не реализуются в этом пункте.
- Следующий шаг: выполнить `npm.cmd run test:acceptance:offline`.

### STEP-0176 — 2026-09-07 — review offline acceptance PASS

- Пакет и статус: L06 / `IN_PROGRESS`; выбранный review events/manifest review state подпункт готов локально, остаётся финальный diff check и handoff.
- Изменения и назначение: full offline regression подтвердила storage review event path, `rh_review_result`, idempotent replay/conflict handling, manifest `PENDING_REVIEW` и обновлённый summary без regressions в предыдущих пакетах.
- Файлы/модули: `src/execution/reviews.ts`, `src/storage/database.ts`, `src/execution/manifests.ts`, `src/execution/schemas.ts`, `src/mcp/server.ts`, `tests/results/l06.test.mjs`, `tests/mcp/stdio.test.mjs`, `README.md`, `docs/capabilities.md`, `docs/configuration.md`, `PROGRESS.md`; rebuilt `dist/`.
- Проверки: `npm.cmd run test:acceptance:offline` — `PASS`: unit 3, contract 2, graph 8, L03 4, L04 4, L05 14, L06 6, MCP 1; всего 38 tests, 0 failures. Внутренние build шаги — `PASS`; SQLite experimental warnings ожидаемы. `git diff --check` — `NOT_RUN`; live API и внешние изменения не выполняются.
- Ограничения/остаток: changes-requested revisions, approval automation и chain gate остаются TODO; synthetic/offline evidence не является live review compatibility.
- Следующий шаг: выполнить `git diff --check`, затем завершить выбранный подпункт и остановиться.

### STEP-0177 — 2026-09-07 — review events подпункт завершён

- Пакет и статус: L06 / `LOCAL_DONE` для review events/manifest review state; весь L06 остаётся `IN_PROGRESS`, работа остановлена по правилу сессии.
- Изменения и назначение: transaction-safe review event persistence, deterministic fallback event ID, decisions `APPROVED`/`CHANGES_REQUESTED`/`REJECTED`, MCP tool `rh_review_result` и review summary в `rh_get_results` завершены. Новый manifest snapshot имеет `PENDING_REVIEW`; immutable `manifest.json` не переписывается, повтор event ID не создаёт второе событие.
- Файлы/модули: новый `src/execution/reviews.ts`; `src/storage/database.ts`, `src/execution/manifests.ts`, `src/execution/schemas.ts`, `src/mcp/server.ts`, `tests/results/l06.test.mjs`, `tests/mcp/stdio.test.mjs`, `PROGRESS.md`; rebuilt `dist/`.
- Проверки: `npm.cmd run typecheck` — `PASS`; `npm.cmd run build` — `PASS` через L06/MCP/acceptance scripts; `npm.cmd run test:l06` — `PASS` (6 tests); `npm.cmd run test:mcp` — `PASS` (1 test); `npm.cmd run test:acceptance:offline` — `PASS` (38 tests, 0 failures); `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings. SQLite experimental warnings ожидаемы. Live API, платные генерации, upload/cancel и пользовательские assets — `NOT_RUN`.
- Ограничения/остаток: changes-requested revisions, approval automation и chain gate не реализованы; live review compatibility отдельно не проверялась и offline evidence не выдаётся за live.
- Следующий шаг: в новой отдельной задаче выбрать changes-requested revision или chain gate; автоматически не начинать.

### STEP-0178 — 2026-09-07 — выбран changes-requested revision подпункт

- Пакет и статус: L06 / `IN_PROGRESS`; выбран только подпункт явного исправления после `CHANGES_REQUESTED`, chain gate и approval automation не входят в текущий шаг.
- Решение и граница: review без revision request сохраняет прежнее поведение; только явно переданный пакет graph operations создаёт дочернюю immutable revision и новый work item в том же `project_id + chain_id`. Старый job/result/manifest не изменяются, provider submit не вызывается.
- Файлы/модули: на этапе выбора изменён только `PROGRESS.md`; код и тесты ещё не изменялись.
- Проверки: typecheck, build, offline tests и `git diff --check` — `NOT_RUN`, поскольку реализация ещё не начата; live API, платные генерации и внешние изменения — `NOT_RUN` по правилу сессии.
- Ограничения/остаток: требуется определить и покрыть локальный MCP-контракт revision request и его idempotent replay; chain gate остаётся отдельным незавершённым подпунктом.
- Следующий шаг: реализовать storage linkage и explicit revision request в `rh_review_result`, затем добавить offline transport regression.

### STEP-0179 — 2026-09-07 — explicit revision request implementation

- Пакет и статус: L06 / `IN_PROGRESS`; storage linkage и explicit changes-requested revision flow реализованы, regression ещё не выполнена.
- Изменения и назначение: добавлена migration 7 с idempotent связью `review_event_id -> source_revision_id/revision_id/work_item_id`; `rh_review_result` принимает только при `CHANGES_REQUESTED` явный `revision_request` с typed graph operations. Сервис создаёт дочернюю CAS revision и новый work item в той же цепочке, повтор возвращает сохранённую связь; старый job/result/manifest не переписываются и submit не вызывается.
- Файлы/модули: `src/storage/database.ts`, `src/execution/schemas.ts`, `src/execution/reviews.ts`, `src/mcp/server.ts`, `PROGRESS.md`.
- Проверки: typecheck, build, L06 tests, MCP transport tests, full offline acceptance и `git diff --check` — `NOT_RUN`, код изменён непосредственно перед записью; live API, платные генерации и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: revision request не запускает подготовку/submit автоматически; chain gate и approval automation остаются отдельными TODO. Нужен MCP regression на создание и idempotent replay новой revision/work item.
- Следующий шаг: добавить offline transport assertions для explicit changes-requested revision и запрета revision request для других решений.

### STEP-0180 — 2026-09-07 — revision request typecheck PASS

- Пакет и статус: L06 / `IN_PROGRESS`; implementation компилируется, regression ещё не выполнена.
- Изменения и назначение: на MCP boundary добавлено явное приведение typed graph operations после Zod `unknown`, без изменения runtime-контракта; это устранило typecheck failure для `revision_request`.
- Файлы/модули: `src/mcp/server.ts`, `PROGRESS.md`.
- Проверки: первый `npm.cmd run typecheck` — `FAIL` на несовместимости `z.unknown()` с `InputValue`; после минимального исправления повторный `npm.cmd run typecheck` — `PASS`. Build, L06/MCP/full offline tests и `git diff --check` — `NOT_RUN`; live API и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: runtime idempotency и MCP response shape ещё нужно проверить; chain gate/approval automation не затрагивались.
- Следующий шаг: запустить `npm.cmd run test:l06`.

### STEP-0181 — 2026-09-07 — L06 regression expectation corrected

- Пакет и статус: L06 / `IN_PROGRESS`; точечный прогон выявил и локализовал только конфликт ожиданий в новом regression.
- Изменения и назначение: сохранены два независимых сценария: `APPROVED + revision_request` должен вернуть `INVALID_CONFIGURATION`, а конфликт существующего review event проверяется без `revision_request` и по-прежнему ожидает `REQUEST_CONFLICT`.
- Файлы/модули: `tests/results/l06.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:l06` — `FAIL` на 1 из 6: 5 passed, 1 failed из-за тестового ожидания `REQUEST_CONFLICT` вместо фактического корректного `INVALID_CONFIGURATION`; исправление внесено, повторный прогон — `NOT_RUN`.
- Ограничения/остаток: нужно подтвердить создание дочерней revision/work item, idempotent replay и отсутствие submit после исправления теста; live проверки не выполняются.
- Следующий шаг: повторить `npm.cmd run test:l06`.

### STEP-0182 — 2026-09-07 — L06 revision request regression PASS

- Пакет и статус: L06 / `IN_PROGRESS`; explicit changes-requested revision/work item flow проходит точечную offline проверку.
- Изменения и назначение: MCP transport regression подтверждает child revision с правильным parent, same-chain work item, сохранение старого job и повторный вызов без второй revision/event; `APPROVED + revision_request` отклоняется до записи review.
- Файлы/модули: `tests/results/l06.test.mjs`, `tests/unit/storage.test.mjs`, `PROGRESS.md`; `dist/` пересобран командой теста.
- Проверки: `npm.cmd run test:l06` — `PASS`, build `PASS`, 6 тестов, 0 failures; SQLite experimental warning ожидаем. `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings. Full offline и MCP stdio regression — `NOT_RUN`; live API/платные генерации/внешние изменения — `NOT_RUN`.
- Ограничения/остаток: revision request не готовит и не отправляет следующий plan; chain gate и approval automation остаются TODO.
- Следующий шаг: выполнить `npm.cmd run test:unit` для migration 7, затем `npm.cmd run test:mcp`.

### STEP-0183 — 2026-09-07 — migration 7 unit regression PASS

- Пакет и статус: L06 / `IN_PROGRESS`; storage migration contract обновлён и подтверждён, остаётся MCP stdio и полный offline acceptance.
- Изменения и назначение: unit snapshot ожидает migration version 7 и 16 operational tables после добавления `review_revisions`; reopen остаётся idempotent.
- Файлы/модули: `tests/unit/storage.test.mjs`, `PROGRESS.md`; `dist/` пересобран командой теста.
- Проверки: `npm.cmd run test:unit` — `PASS`, 3 теста, 0 failures; SQLite experimental warning ожидаем. MCP stdio, full offline и финальный diff check — `NOT_RUN`; live API и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: функциональная граница остаётся local-only; chain gate и approval automation не реализуются.
- Следующий шаг: выполнить `npm.cmd run test:mcp`.

### STEP-0187 — 2026-09-07 — выбран chain gate

- Пакет и статус: L06 / `IN_PROGRESS`; выбран только общий review/chain gate для всех submit paths, approval automation не входит в этот шаг.
- Основание: активный handoff и записи `STEP-0184`–`STEP-0186` имеют более новые номера, чем физически последняя устаревшая запись `STEP-0183`; продолжение определяется по максимальному номеру и разделам плана L06.
- Граница реализации: транзакционно резервировать job только если в той же `project_id + chain_id` нет другого выполняющегося/неопределённого job, незавершённого download либо результата без review; существующий job текущего plan возвращать до проверки gate. Approval не запускает новую работу автоматически.
- Файлы/модули: планируются `src/storage/database.ts`, `src/execution/runner.ts`, `src/execution/results.ts`, `src/errors.ts`, offline regression tests и этот журнал.
- Проверки: typecheck, build, L05/L06/MCP/full offline acceptance и `git diff --check` — `NOT_RUN`, реализация ещё не начата; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN` по правилу сессии.
- Ограничения/остаток: после реализации нужно отдельно подтвердить блокировку активной цепочки, pending review, idempotent повтор и явное продолжение после review; approval automation, LoRA/media rules и live compatibility не начинать.
- Следующий шаг: добавить storage-level chain gate и связать его с durable runner/download state.

### STEP-0188 — 2026-09-07 — добавлен storage chain gate

- Пакет и статус: L06 / `IN_PROGRESS`; runtime gate реализован, regression tests ещё не добавлены.
- Изменения и назначение: `Storage.reserveJob` теперь под `BEGIN IMMEDIATE` проверяет jobs всей `project_id + chain_id` до создания нового job. Блокируются активное/неопределённое выполнение, незавершённый download, отсутствие сохранённых outputs и outputs без review; повтор уже существующего plan/job возвращается до gate. Добавлен структурированный код `REVIEW_PENDING`.
- Состояние download: `ResultDownloadService` переводит artifact в `PENDING`, затем в `READY` после всех валидированных файлов либо в `FAILED` при любой ошибке, чтобы авария/незавершённая загрузка не освобождала chain.
- Файлы/модули: `src/storage/database.ts`, `src/execution/results.ts`, `src/errors.ts`, `PROGRESS.md`.
- Проверки: typecheck, build и tests — `NOT_RUN`, изменения внесены непосредственно перед записью; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: нужна проверка gate для active execution, pending review, idempotent retry и explicit run после review; approval automation не добавлена.
- Следующий шаг: добавить offline regression через durable runner и MCP transport.

### STEP-0189 — 2026-09-07 — chain gate typecheck PASS

- Пакет и статус: L06 / `IN_PROGRESS`; runtime gate type-checks, regression tests ещё не добавлены.
- Изменения и назначение: проверена компиляция storage-level gate и download-state transitions без изменения scope задачи.
- Файлы/модули: `src/storage/database.ts`, `src/execution/results.ts`, `src/errors.ts`, `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — `PASS`; build, tests и `git diff --check` — `NOT_RUN`; live API и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: требуется проверить поведение на active execution, pending review, idempotent retry и explicit continuation после review.
- Следующий шаг: добавить direct runner regression для транзакционного chain gate.

### STEP-0190 — 2026-09-07 — добавлены chain gate regressions

- Пакет и статус: L06 / `IN_PROGRESS`; tests добавлены, прогон ещё не выполнен.
- Изменения и назначение: direct durable-runner сценарий проверяет active-chain block, idempotent повтор текущего plan, pending review block и освобождение после явного `APPROVED`. MCP transport сценарий проверяет, что `rh_run_workflow` не submit-ит до review, а после review требует отдельного явного вызова; approval сам не запускает работу.
- Файлы/модули: `tests/execution/l05.test.mjs`, `tests/results/l06.test.mjs`, `PROGRESS.md`.
- Проверки: typecheck — `PASS` (STEP-0189); L05, L06, build, MCP, full offline acceptance и `git diff --check` — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: нужно проверить download state transitions и отсутствие regressions в предыдущих пакетах.
- Следующий шаг: запустить `npm.cmd run test:l05`.

### STEP-0191 — 2026-09-07 — исправлен конфликт старого L05 fixture

- Пакет и статус: L06 / `IN_PROGRESS`; первый L05 прогон выявил только устаревшее ожидание независимого work item в default chain.
- Изменения и назначение: upload-cache regression теперь явно использует отдельный `chain_id`, потому что это независимая проверка повторной загрузки, а не продолжение review-цепочки. Код gate не ослаблялся.
- Файлы/модули: `tests/execution/l05.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:l05` — `FAIL`: 14 passed, 1 failed; failure был `REVIEW_PENDING` в старом upload-cache сценарии и устранён сменой fixture. Повторный L05, L06, build, MCP, full offline acceptance и `git diff --check` — `NOT_RUN`; live API и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: нужно подтвердить повторный L05 и MCP review gate.
- Следующий шаг: повторить `npm.cmd run test:l05`.

### STEP-0192 — 2026-09-07 — durable runner chain gate PASS

- Пакет и статус: L06 / `IN_PROGRESS`; direct runner gate regression пройдена, остаётся MCP transport и общий regression.
- Изменения и назначение: `npm.cmd run test:l05` — `PASS`, 15 тестов, 0 failures. Подтверждены active execution block, idempotent повтор текущего plan, pending review block, explicit release после `APPROVED`, upload cache и прежняя recovery-конкурентность. SQLite experimental warning ожидаем.
- Файлы/модули: rebuilt `dist/`, `tests/execution/l05.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:l05` — `PASS`; typecheck — `PASS` (STEP-0189); L06, MCP, full offline acceptance и `git diff --check` — `NOT_RUN`; live API, платные генерации и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: MCP boundary должен подтвердить отсутствие submit до review и explicit continuation после review.
- Следующий шаг: запустить `npm.cmd run test:l06`.

### STEP-0193 — 2026-09-07 — MCP review gate regression PASS

- Пакет и статус: L06 / `IN_PROGRESS`; chain gate проходит direct runner и MCP transport, остаётся stdio/full regression.
- Изменения и назначение: `rh_get_results` сохраняет результат в `PENDING_REVIEW`; `rh_run_workflow` в той же chain возвращает `REVIEW_PENDING` без provider submit. После явного `rh_review_result(APPROVED)` submit всё ещё не происходит сам, а отдельный `rh_run_workflow` создаёт следующий job.
- Файлы/модули: rebuilt `dist/`, `tests/results/l06.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:l06` — `PASS`, 7 тестов, 0 failures; `npm.cmd run test:l05` — `PASS`, 15 тестов. SQLite experimental warning ожидаем. MCP stdio, full offline acceptance, explicit typecheck/build и `git diff --check` — `NOT_RUN`; live API и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: нужно проверить MCP stdio schema/handshake и общий offline regression; approval automation не реализуется.
- Следующий шаг: запустить `npm.cmd run test:mcp`.

### STEP-0194 — 2026-09-07 — MCP stdio regression PASS

- Пакет и статус: L06 / `IN_PROGRESS`; stdio transport не регрессировал после добавления `REVIEW_PENDING` и chain reservation.
- Изменения и назначение: initialize/tools-list, local graph and execution-plan flow прошли без изменений списка MCP tools и без provider backend в offline-сценарии.
- Файлы/модули: rebuilt `dist/`, `src/errors.ts`, `src/storage/database.ts`, `src/execution/results.ts`, `tests/mcp/stdio.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:mcp` — `PASS`, 1 тест, 0 failures; build — `PASS`; SQLite experimental warning ожидаем. Full offline acceptance, explicit typecheck/build и `git diff --check` — `NOT_RUN`; live API и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: остаётся общий offline regression и финальные explicit checks; approval automation не начинать.
- Следующий шаг: запустить `npm.cmd run test:acceptance:offline`.

### STEP-0195 — 2026-09-07 — full offline acceptance PASS

- Пакет и статус: L06 / `IN_PROGRESS`; все локальные suites проходят, остаются explicit typecheck/build/diff checks и handoff.
- Изменения и назначение: chain gate и download-state changes не вызвали regressions в L00–L05, L06 или stdio MCP; offline MCP сценарий подтверждает блокировку pending review и explicit continuation без approval automation.
- Файлы/модули: `src/errors.ts`, `src/storage/database.ts`, `src/execution/results.ts`, `tests/execution/l05.test.mjs`, `tests/results/l06.test.mjs`, `PROGRESS.md`; active summary/handoff синхронизированы; `dist/` пересобран.
- Проверки: `npm.cmd run test:acceptance:offline` — `PASS`: unit 3, contract 2, graph 8, L03 4, L04 4, L05 15, L06 7, MCP 1; всего 40 тестов, 0 failures. Внутренние build — `PASS`; SQLite experimental warnings ожидаемы. Explicit typecheck/build и `git diff --check` — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: chain gate пока имеет только offline evidence; live compatibility и approval automation не проверяются/не реализуются в этом пункте.
- Следующий шаг: выполнить явные `npm.cmd run typecheck`, `npm.cmd run build` и `git diff --check`.

### STEP-0196 — 2026-09-07 — chain gate explicit checks PASS

- Пакет и статус: L06 / `LOCAL_DONE` для chain gate; approval automation и следующий L07/L08 пункт не начинались.
- Изменения и назначение: транзакционный gate в `reserveJob` охраняет весь execution path, download state не освобождает chain до полного сохранения outputs, а MCP-контракт возвращает `REVIEW_PENDING` без внешнего submit. Existing plan/job retry и explicit continuation после review сохранены.
- Файлы/модули: `src/errors.ts`, `src/storage/database.ts`, `src/execution/results.ts`, `tests/execution/l05.test.mjs`, `tests/results/l06.test.mjs`, `PROGRESS.md`; `dist/` пересобран.
- Проверки: `npm.cmd run typecheck` — `PASS`; `npm.cmd run build` — `PASS`; `npm.cmd run test:l05` — `PASS` (15); `npm.cmd run test:l06` — `PASS` (7); `npm.cmd run test:mcp` — `PASS` (1); `npm.cmd run test:acceptance:offline` — `PASS` (40 всего); `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings. SQLite experimental warnings ожидаемы.
- Ограничения/остаток: live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN` по правилу сессии; live chain compatibility и approval automation остаются TODO. Следующий пакет L07 не начинать.
- Следующий шаг: в новой отдельной задаче продолжить оставшийся L06 подпункт approval automation или явно выбрать следующий пункт по обновлённому handoff; автоматически не начинать.

### STEP-0197 — 2026-09-07 — выбран контракт approval continuation

- Пакет и статус: L06 / `IN_PROGRESS`; выбран только оставшийся подпункт approval automation, L07/L08 и live acceptance не начинаются.
- Решение и граница: реализовать явно заданное `continuation { plan_id, request_id }` для `APPROVED`; голый approval не запускает следующую генерацию, а повтор review/continuation должен оставаться идемпотентным.
- Файлы/модули: пока изменён только `PROGRESS.md`; продуктовый код и тесты ещё не изменены.
- Проверки: typecheck, build, L06/L05/MCP/full offline и `git diff --check` — `NOT_RUN` до реализации; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: нужен durable запуск уже подготовленного следующего plan только после успешной записи approval; ошибка continuation не должна создавать второй review event или второй submit.
- Следующий шаг: добавить строгую схему и серверный запуск same-chain continuation, затем покрыть MCP idempotency/regression тестом.

### STEP-0198 — 2026-09-07 — реализован explicit approval continuation

- Пакет и статус: L06 / `IN_PROGRESS`; approval automation реализуется как opt-in continuation, автоматическое approval и L07/L08 не начинаются.
- Изменения и назначение: добавлена строгая `continuation`-схема для `rh_review_result`; same-project/same-chain следующий work item валидируется до review, intent сохраняется в outbox, а уже подготовленный plan запускается через `DurableWorkflowRunner`. Повтор того же review event и continuation возвращает тот же job без второго provider submit; обычный `APPROVED` ничего не запускает.
- Файлы/модули: `src/execution/schemas.ts`, `src/mcp/server.ts`, `tests/results/l06.test.mjs`, `README.md`, `docs/capabilities.md`, `docs/configuration.md`, `PROGRESS.md`.
- Проверки: после реализации typecheck, build, L06/L05/MCP/full offline и `git diff --check` — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: нужно подтвердить компиляцию и MCP idempotency; provider/live compatibility и автоматическое approval остаются вне этого пункта.
- Следующий шаг: запустить `npm.cmd run typecheck`, затем build и релевантный `npm.cmd run test:l06`.

### STEP-0199 — 2026-09-07 — typecheck approval continuation PASS

- Пакет и статус: L06 / `IN_PROGRESS`; source-level continuation implementation compiles.
- Изменения и назначение: проверен новый schema/server path без emitted artifacts; approval continuation остаётся opt-in и same-chain.
- Файлы/модули: проверены `src/execution/schemas.ts`, `src/mcp/server.ts` и связанные типы.
- Проверки: `npm.cmd run typecheck` — `PASS`; build, L06/L05/MCP/full offline и `git diff --check` — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: тесты запускаются только после пересборки `dist/`; нужно проверить outbox intent, bare approval и повтор continuation через MCP transport.
- Следующий шаг: запустить `npm.cmd run build`.

### STEP-0200 — 2026-09-07 — build approval continuation PASS

- Пакет и статус: L06 / `IN_PROGRESS`; emitted `dist/` соответствует новому server/schema path.
- Изменения и назначение: TypeScript build прошёл, можно выполнять transport regression с обновлёнными артефактами.
- Файлы/модули: rebuilt `dist/`; source changes remain in `src/execution/schemas.ts`, `src/mcp/server.ts`.
- Проверки: `npm.cmd run build` — `PASS`; L06/L05/MCP/full offline и `git diff --check` — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: нужно проверить локальный MCP flow и отсутствие второго submit при повторе.
- Следующий шаг: запустить `npm.cmd run test:l06`.

### STEP-0201 — 2026-09-07 — исправлен L06 continuation fixture

- Пакет и статус: L06 / `IN_PROGRESS`; первая проверка нового MCP regression выявила ошибку сценария теста.
- Изменения и назначение: тест пытался создать второй continuation в той же chain при активном первом target job; это корректно давало `REVIEW_PENDING`. Fixture перестроен на один target plan: explicit continuation запускает его, повтор review и обычный `rh_run_workflow` возвращают тот же job.
- Файлы/модули: `tests/results/l06.test.mjs`, `PROGRESS.md`.
- Проверки: первый `npm.cmd run test:l06` — `FAIL`: 6 passed, 1 failed на старом тестовом сценарии, runtime block сработал ожидаемо; после fixture fix повторный L06 и остальные проверки — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: нужно повторно подтвердить opt-in continuation и отсутствие второго submit.
- Следующий шаг: повторить `npm.cmd run test:l06`.

### STEP-0202 — 2026-09-07 — L06 approval continuation regression PASS

- Пакет и статус: L06 / `IN_PROGRESS`; explicit approval continuation проходить через MCP transport.
- Изменения и назначение: подтверждены bare approval без submit, explicit same-chain continuation через `rh_review_result`, idempotent повтор review/continuation и последующий `rh_run_workflow` без второго submit.
- Файлы/модули: rebuilt `dist/`, `tests/results/l06.test.mjs`, `src/execution/schemas.ts`, `src/mcp/server.ts`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:l06` — `PASS`, 7 тестов, 0 failures; build внутри команды — `PASS`; SQLite experimental warning ожидаем. L05, MCP, full offline, explicit typecheck/build и `git diff --check` — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: нужен regression по durable runner/L05 и stdio, затем полный offline acceptance; provider/live continuation compatibility не проверяется без явного разрешения.
- Следующий шаг: запустить `npm.cmd run test:l05`.

### STEP-0203 — 2026-09-07 — durable runner regression PASS

- Пакет и статус: L06 / `IN_PROGRESS`; continuation использует существующий durable runner без L05 regressions.
- Изменения и назначение: подтверждены chain gate, concurrent single-submit, submit-unknown protection, recovery, output retry, provider errors, cancellation и upload cache после source/server changes.
- Файлы/модули: rebuilt `dist/`, `src/mcp/server.ts`, `src/execution/schemas.ts`, `tests/execution/l05.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:l05` — `PASS`, 15 тестов, 0 failures; build внутри команды — `PASS`; SQLite experimental warning ожидаем. MCP, full offline, explicit typecheck/build и `git diff --check` — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: нужен stdio schema/handshake regression и общий offline acceptance.
- Следующий шаг: запустить `npm.cmd run test:mcp`.

### STEP-0204 — 2026-09-07 — MCP stdio regression PASS

- Пакет и статус: L06 / `IN_PROGRESS`; stdio transport and tool registration remain compatible.
- Изменения и назначение: initialize/tools-list, catalog, graph and local execution flows passed after adding `continuation` to the review schema; no live provider operation was invoked.
- Файлы/модули: rebuilt `dist/`, `src/execution/schemas.ts`, `src/mcp/server.ts`, `tests/mcp/stdio.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:mcp` — `PASS`, 1 тест, 0 failures; build внутри команды — `PASS`; SQLite experimental warning ожидаем. Full offline, explicit typecheck/build и `git diff --check` — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: остаётся общий offline regression и финальные explicit checks для этого L06 пункта.
- Следующий шаг: запустить `npm.cmd run test:acceptance:offline`.

### STEP-0205 — 2026-09-07 — full offline approval continuation regression PASS

- Пакет и статус: L06 / `IN_PROGRESS`; full local regression passes, остаются explicit final checks and handoff.
- Изменения и назначение: new continuation schema, outbox intent and server execution did not regress L00–L05, L06 result/review flows, or stdio MCP; no live/provider call was made.
- Файлы/модули: `src/execution/schemas.ts`, `src/mcp/server.ts`, `tests/results/l06.test.mjs`, `README.md`, `docs/capabilities.md`, `docs/configuration.md`, `PROGRESS.md`; `dist/` rebuilt by test scripts.
- Проверки: `npm.cmd run test:acceptance:offline` — `PASS`: unit 3, contract 2, graph 8, L03 4, L04 4, L05 15, L06 7, MCP 1; всего 40 тестов, 0 failures. SQLite experimental warnings ожидаемы. Explicit typecheck/build и `git diff --check` — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: нужно выполнить explicit typecheck/build и diff check; live approval/provider compatibility остаётся `NOT_RUN` по правилам сессии.
- Следующий шаг: выполнить `npm.cmd run typecheck`, `npm.cmd run build` и `git diff --check`.

### STEP-0206 — 2026-09-07 — approval continuation explicit checks PASS

- Пакет и статус: L06 / `LOCAL_DONE` для explicit approval continuation; следующий L07/L08 пункт не начинался.
- Изменения и назначение: финально подтверждены типы, emitted build и отсутствие whitespace errors; continuation остаётся только явно запрошенным, same-chain и идемпотентным.
- Файлы/модули: `src/execution/schemas.ts`, `src/mcp/server.ts`, `tests/results/l06.test.mjs`, `README.md`, `docs/capabilities.md`, `docs/configuration.md`, `PROGRESS.md`; `dist/` пересобран.
- Проверки: `npm.cmd run typecheck` — `PASS`; `npm.cmd run build` — `PASS`; `npm.cmd run test:l05` — `PASS` (15); `npm.cmd run test:l06` — `PASS` (7); `npm.cmd run test:mcp` — `PASS` (1); `npm.cmd run test:acceptance:offline` — `PASS` (40 всего); `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings. SQLite experimental warnings ожидаемы.
- Ограничения/остаток: live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN` по правилу сессии; live provider compatibility и automatic approval не реализуются в этом пункте. L06 теперь остаётся `IN_PROGRESS` только из-за других явно не выбранных/не подтверждённых live границ, следующий пакет не начинать.
- Следующий шаг: в новой отдельной задаче выбрать следующий пункт по handoff; автоматически не начинать L07/L08.

### STEP-0207 — 2026-09-07 — синхронизирован L06 handoff

- Пакет и статус: L06 / `LOCAL_DONE` для explicit approval continuation; L07/L08 не начинались.
- Изменения и назначение: верхняя сводка и handoff теперь отражают фактический статус; automatic approval не добавляется, потому что approval без явного continuation не должен запускать генерацию.
- Файлы/модули: `PROGRESS.md`.
- Проверки: ранее выполненные typecheck/build/L05/L06/MCP/full offline checks остаются `PASS`; повторный `git diff --check` после этой записи — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: live provider compatibility explicit continuation не проверялась и не запускается без явного разрешения.
- Следующий шаг: повторить `git diff --check`, затем остановиться на завершённом пункте.

### STEP-0208 — 2026-09-07 — финальный diff check PASS

- Пакет и статус: L06 / `LOCAL_DONE` для explicit approval continuation; работа остановлена на выбранном пункте.
- Изменения и назначение: handoff подтверждает завершение local approval continuation; новые пакеты и live actions не запускались.
- Файлы/модули: `PROGRESS.md`.
- Проверки: `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings; ранее зафиксированные typecheck/build/L05/L06/MCP/full offline — `PASS`. Live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: automatic approval намеренно не реализуется; live provider compatibility explicit continuation остаётся `NOT_RUN`.
- Следующий шаг: в новой отдельной задаче выбрать следующий пункт по handoff; автоматически не начинать.

### STEP-0209 — 2026-09-07 — разрешён L05 live probe

- Пакет и статус: L05 / `LIVE_PENDING`; пользователь явно разрешил платную тестовую генерацию с коротким параметром 2 секунды для проверки natural expiry/account compatibility.
- Область и ограничение: harness поддерживает submit/status/output/cancel и read-only expiry, но не имеет отдельного account-wide discovery; известный ephemeral workflow `2087104558464446466` будет использоваться только после проверки его реальной схемы. Natural expiry нельзя гарантировать короткой генерацией и потребует фактического terminal provider marker.
- Файлы/модули: пока source code не изменён; проверяются `scripts/test-live.mjs`, `src/backends/workflow-api/client.ts`, `ACCEPTANCE.md`, `PROGRESS.md`.
- Проверки: пользовательские env найдены как `User: API_KEY=set`, `LIVE_CASES=full`, но process env отсутствует; live request и новая генерация ещё `NOT_RUN`. API key не выводится.
- Ограничения/остаток: не запускать blind retry; после одного разрешённого submit сохранить только обезличенный task ID/результат и не выполнять пользовательские uploads.
- Следующий шаг: выполнить один read-only запрос JSON workflow `2087104558464446466` без submit, чтобы определить безопасное поле длительности и профиль проверки.

### STEP-0210 — 2026-09-07 — live workflow schema inspected

- Пакет и статус: L05 / `LIVE_PENDING`; read-only preparation passed, no new task was submitted.
- Изменения и назначение: provider returned workflow `2087104558464446466` with 18 nodes; the video graph has `MiniMaxH3ImageToVideo` and a `PrimitiveFloat` value `8` feeding its frame-length expression, so a one-off 2-second variant is structurally identifiable without user assets.
- Файлы/модули: source code не изменён; read-only API response проверен через existing Workflow API contract.
- Проверки: two read-only `getJsonApiFormat` requests — `PASS` (`code=0`, prompt parsed, duration candidate identified); paid submit, status polling and expiry query — `NOT_RUN` at this step. API key не выводился.
- Ограничения/остаток: the current harness does not expose a duration override or account-wide discovery; one workflow/profile cannot prove account-wide compatibility. Natural expiry needs a previously submitted real task to return an explicit terminal expiry/not-found marker.
- Следующий шаг: query one previously recorded provider task ID read-only for expiry evidence, then decide whether one authorized 2-second submit is useful and safe.

### STEP-0211 — 2026-09-07 — prior live task did not expire

- Пакет и статус: L05 / `LIVE_PENDING`; natural expiry remains unproven.
- Изменения и назначение: read-only expiry query targeted the previously recorded real task `2097126350429659137`; provider still returned `SUCCESS`, so this was not treated as expiry evidence and no submit/retry followed.
- Файлы/модули: source code не изменён; `PROGRESS.md`.
- Проверки: `npm.cmd run test:live -- --expiry --task-id 2097126350429659137` — `LIVE_FAIL`: `state=SUCCESS`, `code=unknown`, no expiry/not-found marker. API key не выводился.
- Ограничения/остаток: a completed retained task cannot demonstrate natural expiry; the next authorized submit will be only for the requested short 2-second compatibility probe, not mislabeled as expiry evidence.
- Следующий шаг: add a narrowly scoped `--duration-seconds` override to the ephemeral harness, then run one 2-second workflow submit.

### STEP-0212 — 2026-09-07 — добавлен duration override для live probe

- Пакет и статус: L05 / `LIVE_PENDING`; harness готов к одному разрешённому короткому submit.
- Изменения и назначение: `scripts/test-live.mjs` получил только для обычного ephemeral generation probe параметр `--duration-seconds`; он проходит по реальному graph link от video `length/duration` к числовому источнику и меняет snapshot перед durable submit. Upload/cancel/expiry modes этим параметром блокируются.
- Файлы/модули: `scripts/test-live.mjs`, `PROGRESS.md`.
- Проверки: `node --check scripts/test-live.mjs` — `PASS`; live submit ещё `NOT_RUN`, source typecheck/build и offline regression после harness change — `NOT_RUN`. API key не выводится.
- Ограничения/остаток: override сокращает генерацию до 2 секунд, но не может гарантировать natural expiry; один workflow/profile не доказывает account-wide compatibility.
- Следующий шаг: выполнить ровно один `npm.cmd run test:live -- --workflow-id 2087104558464446466 --duration-seconds 2 --timeout-ms 300000` с User env.

### STEP-0213 — 2026-09-07 — исправлен pre-submit duration token handling

- Пакет и статус: L05 / `LIVE_PENDING`; платный submit ещё не выполнен.
- Изменения и назначение: первая попытка duration override завершилась до submit, потому что `lossless-json` numeric token не был распознан как обычный JavaScript number. Override теперь принимает только явно числовые `PrimitiveFloat`/`PrimitiveInt` source nodes.
- Файлы/модули: `scripts/test-live.mjs`, `PROGRESS.md`.
- Проверки: предыдущий `--duration-seconds 2` probe — `LIVE_FAIL` до submit: `could not find a linked numeric duration/length input`; API key не выводился, provider task не создавался. После fix syntax/live retry — `NOT_RUN`.
- Ограничения/остаток: сохраняется scope одного известного workflow/profile и одного разрешённого 2-second submit; natural expiry не будет объявлен PASS по успешному short task.
- Следующий шаг: повторить `node --check scripts/test-live.mjs`, затем один разрешённый live submit.

### STEP-0214 — 2026-09-07 — duration override syntax PASS

- Пакет и статус: L05 / `LIVE_PENDING`; harness syntax validated, ready for the single authorized submit.
- Изменения и назначение: `--duration-seconds` path parses after the numeric-token fix and remains limited to the regular ephemeral generation mode.
- Файлы/модули: `scripts/test-live.mjs`, `PROGRESS.md`.
- Проверки: `node --check scripts/test-live.mjs` — `PASS`; live submit, typecheck/build/offline regression after harness change — `NOT_RUN`; API key не выводится.
- Ограничения/остаток: this test can provide scoped workflow/profile evidence only; it cannot establish natural expiry or account-wide coverage by itself.
- Следующий шаг: execute exactly one `--workflow-id 2087104558464446466 --duration-seconds 2` live probe.

### STEP-0215 — 2026-09-07 — short live generation PASS

- Пакет и статус: L05 / `LIVE_PENDING`; one authorized short live generation completed, but natural expiry and account-wide compatibility remain unproven.
- Изменения и назначение: ephemeral workflow `2087104558464446466` was submitted through the durable runner with the linked video length source overridden to 2 seconds; provider returned outputs successfully. No project/workflow state or user assets were persisted.
- Файлы/модули: `scripts/test-live.mjs`, `PROGRESS.md`; provider task ID `2097170708909039617` recorded only as sanitized evidence.
- Проверки: `npm.cmd run test:live -- --workflow-id 2087104558464446466 --duration-seconds 2 --timeout-ms 300000` — `PASS`: `LIVE_DURATION_OVERRIDE: seconds=2`, one `LIVE_SUBMIT`, `LIVE_PASS ... outputs_ready=true`; API key не выводился. Natural-expiry query remains `NOT_RUN` after the prior retained task returned `SUCCESS`; account-wide discovery/compatibility — `NOT_RUN`.
- Ограничения/остаток: this proves one current workflow/profile submit/status/output path with a short video parameter, not all account workflows/models. Natural expiry cannot be inferred from a successful short task and requires a real task to reach provider expiry.
- Следующий шаг: update L05 acceptance/capability documentation with this scoped evidence, then run syntax/typecheck/build/offline regression without another live submit.

### STEP-0216 — 2026-09-07 — L05 short probe evidence documented

- Пакет и статус: L05 / `LIVE_PENDING`; scoped live submit/status/output evidence обновлена, natural expiry и account-wide compatibility остаются `NOT_RUN`/unknown.
- Изменения и назначение: acceptance, capabilities, configuration и README теперь фиксируют 2-second duration override и явно не расширяют его до account-wide или expiry evidence.
- Файлы/модули: `ACCEPTANCE.md`, `docs/capabilities.md`, `docs/configuration.md`, `README.md`, `PROGRESS.md`.
- Проверки: live short probe из STEP-0215 — `PASS`; syntax/typecheck/build/offline regression после документации — `NOT_RUN`; новых live submits не планируется.
- Ограничения/остаток: natural expiry реальной задачи требует provider terminal expiry после ожидания; account-wide compatibility требует дополнительных подтверждённых workflows/models, которых текущий harness/account discovery не предоставляет.
- Следующий шаг: выполнить `node --check scripts/test-live.mjs`, `npm.cmd run typecheck`, `npm.cmd run build`, затем `npm.cmd run test:acceptance:offline`.

### STEP-0217 — 2026-09-07 — L05 harness checks PASS

- Пакет и статус: L05 / `LIVE_PENDING`; live evidence remains scoped to one workflow/profile.
- Изменения и назначение: duration override harness and documentation compile/parse cleanly; no further provider request was made.
- Файлы/модули: `scripts/test-live.mjs`, `ACCEPTANCE.md`, `docs/capabilities.md`, `docs/configuration.md`, `README.md`, `PROGRESS.md`; `dist/` rebuilt.
- Проверки: `node --check scripts/test-live.mjs` — `PASS`; `npm.cmd run typecheck` — `PASS`; `npm.cmd run build` — `PASS`; full offline acceptance — `NOT_RUN`; natural expiry and account-wide compatibility — `NOT_RUN`.
- Ограничения/остаток: local regression remains to be run; no automatic live retry or extra paid submit.
- Следующий шаг: запустить `npm.cmd run test:acceptance:offline`.

### STEP-0218 — 2026-09-07 — offline regression после L05 live harness PASS

- Пакет и статус: L05 / `LIVE_PENDING`; short live submit/status/output evidence PASS, natural expiry и account-wide compatibility остаются вне доказанного scope.
- Изменения и назначение: duration-aware ephemeral harness и обновлённая live documentation не вызвали regressions в локальном execution/recovery/graph/review коде.
- Файлы/модули: `scripts/test-live.mjs`, `ACCEPTANCE.md`, `docs/capabilities.md`, `docs/configuration.md`, `README.md`, `PROGRESS.md`; `dist/` rebuilt.
- Проверки: `npm.cmd run test:acceptance:offline` — `PASS`: unit 3, contract 2, graph 8, L03 4, L04 4, L05 15, L06 7, MCP 1; всего 40 тестов, 0 failures. SQLite experimental warnings ожидаемы. Natural expiry и account-wide compatibility — `NOT_RUN`; новых live submits после STEP-0215 не выполнялось.
- Ограничения/остаток: natural expiry требует provider task, который реально перейдёт в expiry; account-wide compatibility требует account/workflow discovery или нескольких явно разрешённых workflows. Текущий один workflow не расширяет evidence.
- Следующий шаг: выполнить `git diff --check`, затем остановиться и не запускать дополнительные live generation без отдельного scope.

### STEP-0219 — 2026-09-07 — L05 live probe handoff PASS

- Пакет и статус: L05 / `LIVE_PENDING`; один короткий 2-second live generation probe завершён, natural expiry и account-wide compatibility не подтверждены.
- Изменения и назначение: финальный diff clean; live harness/documentation готовы для следующего явно выбранного scope, дополнительные платные вызовы не выполнялись.
- Файлы/модули: `scripts/test-live.mjs`, `ACCEPTANCE.md`, `docs/capabilities.md`, `docs/configuration.md`, `README.md`, `PROGRESS.md`; `dist/` пересобран.
- Проверки: `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings; typecheck/build/syntax/full offline и live short probe — `PASS`; natural expiry и account-wide compatibility — `NOT_RUN`.
- Ограничения/остаток: natural expiry требует фактического provider expiry существующей задачи, а account-wide compatibility нельзя доказать одним workflow/profile без discovery или дополнительных разрешённых workflows.
- Следующий шаг: отдельным решением выбрать, нужен ли отдельный длительный expiry scope или дополнительные workflow IDs; автоматически не запускать.

### STEP-0220 — 2026-09-07 — синхронизирована L05 live summary

- Пакет и статус: L05 / `LIVE_PENDING`; summary теперь отражает выполненный короткий live submit.
- Изменения и назначение: устранено устаревшее утверждение, что новый submit не выполнялся; зафиксирован ровно один разрешённый 2-second probe без пользовательских assets.
- Файлы/модули: `PROGRESS.md`.
- Проверки: все проверки из STEP-0219 остаются `PASS`; повторный `git diff --check` после этой записи — `NOT_RUN`; natural expiry и account-wide compatibility — `NOT_RUN`.
- Ограничения/остаток: live evidence остаётся scoped к workflow `2087104558464446466` и configured profile.
- Следующий шаг: повторить `git diff --check`, затем остановиться.

### STEP-0221 — 2026-09-07 — финальный L05 live diff check PASS

- Пакет и статус: L05 / `LIVE_PENDING`; разрешённый короткий live probe завершён, работа остановлена без дополнительных платных вызовов.
- Изменения и назначение: summary/handoff и acceptance evidence согласованы с фактическим одним 2-second submit/status/output PASS.
- Файлы/модули: `scripts/test-live.mjs`, `ACCEPTANCE.md`, `docs/capabilities.md`, `docs/configuration.md`, `README.md`, `PROGRESS.md`; `dist/` пересобран.
- Проверки: `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings; `node --check`, typecheck, build, full offline acceptance и live short probe — `PASS`. Natural expiry и account-wide compatibility — `NOT_RUN`.
- Ограничения/остаток: один workflow/profile не доказывает account-wide compatibility; успешная 2-second задача не является natural-expiry evidence.
- Следующий шаг: для natural expiry нужен отдельный длительный/ожидающий scope, а для account-wide — дополнительные явно выбранные workflows; автоматически не запускать.

### STEP-0222 — 2026-09-07 — актуализированы L05 counters

- Пакет и статус: L05 / `LIVE_PENDING`; short live compatibility probe завершён, две широкие проверки остаются ограниченными.
- Изменения и назначение: сводные offline counts обновлены до 40 тестов и 7 L06 тестов; новых runtime/live действий нет.
- Файлы/модули: `PROGRESS.md`.
- Проверки: `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings; все проверки STEP-0221 остаются `PASS`. Natural expiry и account-wide compatibility — `NOT_RUN`.
- Ограничения/остаток: для продолжения нужны либо отдельный expiry-wait scope, либо дополнительные workflow IDs/account discovery.
- Следующий шаг: запросить недостающий scope/IDs перед следующими live вызовами; автоматически не запускать.

### STEP-0223 — 2026-09-07 — L05 live scope gate подтверждён

- Пакет и статус: L05 / `LIVE_PENDING`; локальная реализация и текущие scoped live cases завершены, natural expiry существующей задачи и account-wide compatibility остаются недоказанными.
- Изменения и назначение: проверены последний handoff, план L05, live harness и связанные runner/recovery tests. Harness принимает `RUNNINGHUB_LIVE_CASES=full` и ключ, но это не задаёт отсутствующие case IDs и не заменяет явное разрешение на live/платные вызовы.
- Файлы/модули: `PROGRESS.md`.
- Проверки: чтение `scripts/test-live.mjs`, `src/execution/runner.ts`, `src/execution/results.ts`, L05/L06 tests и L05 plan criteria — `PASS`; live API, платные генерации, upload пользовательских данных и внешние изменения — `NOT_RUN` из-за отсутствия явного разрешения и выбранных case IDs; typecheck/build/offline tests — `NOT_RUN`, runtime-код не менялся.
- Ограничения/остаток: `natural expiry` требует разрешённой задачи, которую можно безопасно ожидать до provider expiry; `account-wide compatibility` требует явно выбранных дополнительных workflow IDs или account discovery. Переменные окружения сами по себе эти scope не предоставляют.
- Следующий шаг: получить явное разрешение на нужный live scope и соответствующие workflow/task IDs; до этого не запускать новые live calls и не переходить к L07/L08.

### STEP-0224 — 2026-09-07 — L05 scope gate локально проверен

- Пакет и статус: L05 / `LIVE_PENDING`; scope gate подтверждён без provider requests.
- Изменения и назначение: после записи STEP-0223 проверены отсутствие регрессий и корректность журнала; runtime-код и live harness не изменялись.
- Файлы/модули: `PROGRESS.md`; `dist/` пересобран штатными build/test-командами.
- Проверки: `npm.cmd run typecheck` — `PASS`; `npm.cmd run build` — `PASS`; `npm.cmd run test:acceptance:offline` — `PASS`: unit 3, contract 2, graph 8, L03 4, L04 4, L05 15, L06 7, MCP 1, всего 40 тестов, 0 failures; SQLite experimental warnings ожидаемы. `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings; live API, платные генерации, upload пользовательских данных и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: natural expiry и account-wide compatibility остаются `NOT_RUN`; требуется отдельное явное разрешение и выбранные case IDs.
- Следующий шаг: остановиться до получения live scope/IDs; новые live calls и L07/L08 не начинать автоматически.
