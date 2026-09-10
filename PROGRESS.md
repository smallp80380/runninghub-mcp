# Текущий прогресс реализации MCP RunningHub

Последнее обновление: 2026-09-07.

Спецификация: [RUNNINGHUB_MCP_IMPLEMENTATION_PLAN.md](RUNNINGHUB_MCP_IMPLEMENTATION_PLAN.md), редакция 2.
Полная хронология: [docs/progress-archive-2026-09-07.md](docs/progress-archive-2026-09-07.md). Архив read-only; активным журналом является только этот файл.

## Текущее состояние

- L00–L04: `LOCAL_DONE`.
- L05: `LIVE_PENDING`. Durable execution, recovery, upload/cache, status/output/cancel и structural graph flow реализованы; scoped live evidence получена для submit/status/output/upload/structural graph/cancel, active workflow и unknown-task not-found reconciliation.
- L06: `LOCAL_DONE` для локального review loop. Result download, MCP resource links, local derived image preview/video poster, manifests/outbox, review events/manifest review state, changes-requested revision/work item, chain gate и явно запрошенный approval continuation — `LOCAL_DONE`; read-only live result/resource verification — `PASS`. Независимое automatic approval не реализуется.
- L07: `IN_PROGRESS` — LoRA upload/bindings и media rules `LOCAL_DONE`; выбран только cache expiry, server instructions остаются `TODO`.
- L08: `TODO` — финальная live acceptance и проверка поставки.

## Что Проверено

- `npm.cmd run typecheck` — `PASS`.
- `npm.cmd run build` — `PASS`.
- `npm.cmd run test:acceptance:offline` — `PASS`, 57 тестов; L07 targeted cache/media regression — `PASS`, 12 тестов.
- Review path `npm.cmd run typecheck` — `PASS`; `npm.cmd run test:l06` — `PASS`, 7 тестов.
- Read-only live recovery/result/resource probes — `PASS`; один явно разрешённый short 2-second submit/status/output probe — `PASS`; пользовательские assets не загружались.
- Не проверены: natural expiry существующей задачи, account-wide compatibility, live preview/poster/manifest/review compatibility и live chain-gate compatibility.

## Правила Сессии

1. В начале сессии читать этот файл; архив открывать только для исторического контекста.
2. После существенного шага обновлять этот файл: изменения, файлы, проверки, ограничения и следующий шаг.
3. Live API, платные генерации, пользовательские assets и внешние изменения выполнять только при явном разрешении.
4. Не выдавать synthetic/mock/offline evidence за live evidence.

## Handoff

- Текущий пакет: L07 / `IN_PROGRESS`; LoRA upload/bindings, media rules и cache expiry `LOCAL_DONE`; server instructions и L08 не начинались.
- Следующий шаг: в новой отдельной задаче выбрать server instructions; автоматически не начинать его или L08.
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

### STEP-0225 — 2026-09-07 — live scope отсутствует в текущем процессе

- Пакет и статус: L05 / `LIVE_PENDING`; следующий пункт не может быть выполнен без внешнего live scope.
- Изменения и назначение: повторно проверен handoff и фактическое окружение текущего процесса; `RUNNINGHUB_WORKFLOW_API_KEY` не установлен, `RUNNINGHUB_LIVE_CASES` пуст, новые workflow/task IDs не переданы.
- Файлы/модули: `PROGRESS.md`.
- Проверки: проверка наличия переменных без вывода секрета — `PASS` (`key_set=False`, `live_cases=`); `git diff --check` — `PASS` с ожидаемым LF→CRLF warning; live API, платные генерации, upload пользовательских данных и внешние изменения — `NOT_RUN`; typecheck/build/tests — `NOT_RUN`, runtime-код не менялся.
- Ограничения/остаток: natural expiry требует явно выбранного provider task ID и разрешения на status/wait scope; account-wide compatibility требует явно выбранных дополнительных workflow IDs и разрешения на соответствующие probes.
- Следующий шаг: предоставить в текущем процессе live env и конкретный разрешённый scope/IDs; до этого не запускать API и не переходить к L07/L08.

### STEP-0226 — 2026-09-07 — получены workflow IDs для live scope

- Пакет и статус: L05 / `LIVE_PENDING`; account-wide probe scope уточнён, платные вызовы ещё не разрешены явно.
- Изменения и назначение: получены два выбранных workflow ID `2097177175284154370` и `2095706794198106113` из RunningHub links. Они подходят для scoped account-wide workflow checks, но не заменяют task ID для natural expiry.
- Файлы/модули: `PROGRESS.md`.
- Проверки: формат обоих workflow IDs — `PASS`; provider API, schema fetch, submit, polling, outputs, upload и внешние изменения — `NOT_RUN` до явного выбора probe mode и разрешения.
- Ограничения/остаток: нужно явно разрешить read-only schema inspection либо платный ephemeral submit/status/output probe и указать, проверять один или оба workflow ID. Natural expiry остаётся без подходящего активного task ID.
- Следующий шаг: получить явное разрешение и выбранный режим live-проверки; не запускать provider requests автоматически.

### STEP-0227 — 2026-09-07 — один дополнительный workflow live probe PASS

- Пакет и статус: L05 / `LIVE_PENDING`; один явно разрешённый probe для workflow `2097177175284154370` завершён успешно.
- Изменения и назначение: через production durable runner выполнены один submit, polling и output query; provider task `2097179243626987522` достиг `outputs_ready=true`. Пользовательские assets не загружались, второй выбранный workflow не запускался.
- Файлы/модули: `PROGRESS.md`; runtime-код и live harness не изменялись.
- Проверки: `npm.cmd run test:live -- --workflow-id 2097177175284154370 --timeout-ms 300000` с user-scoped env — `PASS`; `LIVE_SUBMIT` и `LIVE_PASS` получены, API key не выводился. Natural expiry, второй workflow, account-wide compatibility и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: успешный probe доказывает только эту комбинацию workflow/profile и не доказывает natural expiry или account-wide compatibility; provider task ID сохранён только в этом журнале.
- Следующий шаг: остановиться и не запускать второй workflow или новые платные probes без отдельного разрешения; natural expiry требует отдельного активного task scope.

### STEP-0228 — 2026-09-07 — дополнительный probe локально проверен

- Пакет и статус: L05 / `LIVE_PENDING`; разрешённый probe из STEP-0227 подтверждён, scope остаётся ограниченным одним workflow.
- Изменения и назначение: после live evidence проверены parser/build и весь offline acceptance; второй workflow и новые provider requests не выполнялись.
- Файлы/модули: `PROGRESS.md`; `dist/` пересобран штатными build/test-командами.
- Проверки: `node --check scripts/test-live.mjs` — `PASS`; `npm.cmd run typecheck` — `PASS`; `npm.cmd run build` — `PASS`; `npm.cmd run test:acceptance:offline` — `PASS`: unit 3, contract 2, graph 8, L03 4, L04 4, L05 15, L06 7, MCP 1, всего 40 тестов, 0 failures; `git diff --check` — `PASS` с ожидаемым LF→CRLF warning. SQLite experimental warnings ожидаемы.
- Ограничения/остаток: natural expiry, второй workflow `2095706794198106113` и account-wide compatibility — `NOT_RUN`; успешный probe не является доказательством expiry или account-wide coverage.
- Следующий шаг: остановиться до отдельного разрешения на второй workflow либо на read-only/expiry scope; автоматически новые live calls не запускать.

### STEP-0229 — 2026-09-07 — второй workflow отложен по подтверждённому scope

- Пакет и статус: L05 / `LIVE_PENDING`; пользователь подтвердил не запускать второй workflow для текущего пункта.
- Изменения и назначение: текущий один workflow probe считается достаточным для выбранного scope; `account-wide compatibility` намеренно остаётся `NOT_RUN` и не объявляется доказанной.
- Файлы/модули: `PROGRESS.md`.
- Проверки: решение scope зафиксировано; новые live API calls, платные генерации, upload и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: natural expiry требует отдельного provider task scope; второй workflow и account-wide compatibility отложены.
- Следующий шаг: остановиться на завершённом scope; не запускать второй workflow или новый пакет автоматически.

### STEP-0230 — 2026-09-07 — scope второго workflow явно разрешён

- Пакет и статус: L05 / `LIVE_PENDING`; предыдущая интерпретация подтверждения исправлена.
- Изменения и назначение: пользователь явно разрешил один дополнительный платный submit/status/output probe для workflow `2095706794198106113`; upload пользовательских данных не входит в scope.
- Файлы/модули: `PROGRESS.md`.
- Проверки: scope и workflow ID зафиксированы; provider API и новый live probe — `NOT_RUN` на момент записи; второй workflow будет запущен ровно один раз.
- Ограничения/остаток: natural expiry остаётся отдельным непроверенным пунктом; account-wide compatibility будет оцениваться только по двум явно выбранным workflow, без расширения до полного аккаунта.
- Следующий шаг: проверить user-scoped env и выполнить единственный разрешённый probe workflow `2095706794198106113`.

### STEP-0231 — 2026-09-07 — второй workflow live probe PASS

- Пакет и статус: L05 / `LIVE_PENDING`; второй явно разрешённый workflow probe завершён успешно.
- Изменения и назначение: через production durable runner выполнены один submit, polling и output query для workflow `2095706794198106113`; provider task `2097181200402653185` достиг `outputs_ready=true`. Пользовательские assets не загружались.
- Файлы/модули: `PROGRESS.md`; runtime-код и live harness не изменялись.
- Проверки: `npm.cmd run test:live -- --workflow-id 2095706794198106113 --timeout-ms 300000` с user-scoped env — `PASS`; API key не выводился. Новые live calls после этого probe — `NOT_RUN`.
- Ограничения/остаток: два выбранных workflow/profile имеют scoped evidence, но это не доказывает account-wide compatibility; natural expiry остаётся `NOT_RUN`.
- Следующий шаг: выполнить локальные syntax/typecheck/build/offline/diff проверки и остановиться; natural expiry не запускать автоматически.

### STEP-0232 — 2026-09-07 — второй workflow probe локально проверен

- Пакет и статус: L05 / `LIVE_PENDING`; два явно выбранных workflow имеют scoped submit/status/output evidence.
- Изменения и назначение: после второго live probe проверены parser/build и весь offline acceptance; новых provider requests не выполнялось.
- Файлы/модули: `PROGRESS.md`; `dist/` пересобран штатными build/test-командами.
- Проверки: `node --check scripts/test-live.mjs` — `PASS`; `npm.cmd run typecheck` — `PASS`; `npm.cmd run build` — `PASS`; `npm.cmd run test:acceptance:offline` — `PASS`: unit 3, contract 2, graph 8, L03 4, L04 4, L05 15, L06 7, MCP 1, всего 40 тестов, 0 failures; `git diff --check` — `PASS` с ожидаемым LF→CRLF warning. SQLite experimental warnings ожидаемы.
- Ограничения/остаток: natural expiry и полная account-wide compatibility — `NOT_RUN`; два workflow подтверждают только выбранные workflow/profile combinations.
- Следующий шаг: остановиться на завершённом выбранном scope; не запускать natural expiry, дополнительные workflow или новый пакет автоматически.

### STEP-0233 — 2026-09-07 — outputs двух live probes read-only показаны

- Пакет и статус: L05 / `LIVE_PENDING`; результаты обоих разрешённых workflow probes получены без новых submit.
- Изменения и назначение: read-only output query и download по task `2097179243626987522` и task `2097181200402653185`; локально извлечены representative image/first frames для показа. Provider task state не изменялся.
- Файлы/модули: `PROGRESS.md`; временные output copies находятся вне репозитория в approved temp directory и не являются проектными файлами.
- Проверки: первый task — image 642586 bytes, video 5.0625 s / 576x832 (1088469 bytes), ZIP с PNG 11661 bytes; второй task — video 8 s / 1280x736 с AAC audio (3578694 bytes); `ffprobe` и `ffmpeg` first-frame extraction — `PASS`. Новые submit, upload пользовательских данных и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: визуально показаны representative image/frames, а не полный просмотр движения видео; natural expiry и полная account-wide compatibility остаются `NOT_RUN`.
- Следующий шаг: остановиться на завершённом выбранном scope; новые live calls не запускать автоматически.

### STEP-0234 — 2026-09-07 — выбран L07 LoRA upload/bindings

- Пакет и статус: L07 / `IN_PROGRESS`; выбран только конкретный подпункт LoRA upload adapter и `RHLoraLoader` binding. Media rules, cache expiry, server instructions и L08 не начинаются.
- Основание: актуальный handoff после STEP-0233 требует в новой отдельной задаче выбрать следующий пункт; официальный контракт LoRA задаёт отдельный upload URL flow, MD5-кэширование и `fileName` только для `RHLoraLoader`.
- Файлы/модули: перед реализацией затронут только `PROGRESS.md`; исходные контракты проверены в `RUNNINGHUB_MCP_IMPLEMENTATION_PLAN.md`, `src/backends/workflow-api/client.ts`, `src/execution/assets.ts`, `src/execution/runner.ts`, `src/storage/database.ts`, `src/mcp/server.ts` и `data/upstream/rh-api-contract.md`.
- Проверки: чтение официальной документации LoRA — `PASS`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN` по правилу сессии.
- Ограничения/остаток: реализация и offline regression ещё не выполнены; signed URL не будет сохраняться или переиспользоваться как графовый reference.
- Следующий шаг: добавить отдельный Workflow API LoRA adapter, tagged cache/reference и MCP tool с offline tests.

### STEP-0235 — 2026-09-07 — добавлен LoRA upload/binding core

- Пакет и статус: L07 / `IN_PROGRESS`; core подпункт реализован, regression и документационная синхронизация ещё не выполнены.
- Изменения и назначение: добавлены `provider_lora`, официальный двухфазный `getLoraUploadUrl` + signed `PUT`, MD5 расчёт, отдельная migration 8/cache, `AssetProvider.uploadLora`, `rh_upload_lora` и runtime substitution `fileName`. LoRA assets требуют роль `lora`, не проходят через обычный media upload и валидируются только на `RHLoraLoader`; regular signed URLs не сохраняются.
- Файлы/модули: `src/execution/types.ts`, `src/execution/lora.ts`, `src/execution/assets.ts`, `src/execution/runner.ts`, `src/backends/workflow-api/client.ts`, `src/config.ts`, `src/storage/database.ts`, `src/execution/schemas.ts`, `src/mcp/server.ts`.
- Проверки: typecheck/build/tests — `NOT_RUN`, следующий шаг после core edit; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: signed URL expiry policy, media limits, agent instructions и live LoRA acceptance не входят в этот подпункт и остаются TODO/`NOT_RUN`.
- Следующий шаг: добавить offline LoRA contract tests; typecheck уже подтверждён.

### STEP-0236 — 2026-09-07 — LoRA core typecheck PASS

- Пакет и статус: L07 / `IN_PROGRESS`; core компилируется, offline regression ещё не добавлена.
- Изменения и назначение: подтверждён TypeScript контракт отдельного LoRA adapter/cache/binding path после core edit; compile issues не обнаружены.
- Файлы/модули: `src/execution/types.ts`, `src/execution/lora.ts`, `src/execution/assets.ts`, `src/execution/runner.ts`, `src/backends/workflow-api/client.ts`, `src/config.ts`, `src/storage/database.ts`, `src/execution/schemas.ts`, `src/mcp/server.ts`, `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — `PASS`; build, tests и `git diff --check` — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: signed URL expiry policy, media limits, agent instructions и live LoRA acceptance остаются вне выбранного подпункта.
- Следующий шаг: добавить deterministic offline tests для MD5/signed PUT, dedicated cache, cross-profile guard, binding validation и MCP tool registration.

### STEP-0237 — 2026-09-07 — добавлены LoRA offline regressions

- Пакет и статус: L07 / `IN_PROGRESS`; deterministic tests добавлены, их прогон ещё не выполнен.
- Изменения и назначение: покрыты отдельный LoRA cache/reference, запрет regular media upload, profile isolation, `RHLoraLoader` binding rejection, MD5 request и signed `PUT` без bearer auth; обновлены migration/config/tool-list expectations и отдельный `test:l07` script.
- Файлы/модули: `tests/execution/l07.test.mjs`, `tests/unit/config.test.mjs`, `tests/unit/storage.test.mjs`, `tests/mcp/stdio.test.mjs`, `package.json`, `PROGRESS.md`.
- Проверки: typecheck — `PASS` (STEP-0236); новые L07 tests, build, full offline acceptance и diff check — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: tests are synthetic/offline and do not prove provider LoRA availability; media limits, expiry policy, agent instructions и L08 не затронуты.
- Следующий шаг: выполнить `npm.cmd run test:l07` и исправить только найденные regressions.

### STEP-0238 — 2026-09-07 — LoRA targeted regression PASS

- Пакет и статус: L07 / `IN_PROGRESS`; dedicated LoRA adapter/binding behavior проходит targeted offline regression.
- Изменения и назначение: подтверждено, что runner вызывает только `uploadLora`, кэш не смешивает профили, некорректный loader блокируется до submit, а Workflow API LoRA flow считает MD5 и не передаёт bearer auth в signed `PUT`.
- Файлы/модули: rebuilt `dist/`; `src/execution/*`, `src/backends/workflow-api/client.ts`, `src/storage/database.ts`, `src/mcp/server.ts`, `tests/execution/l07.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:l07` — `PASS`, 4 tests, 0 failures; build внутри команды — `PASS`; ожидаемо выдан SQLite experimental warning. Full offline acceptance, MCP regression, explicit typecheck и diff check — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: synthetic tests не доказывают реальную доступность LoRA у профиля; docs/capability summary и MCP stdio expectation ещё нужно синхронизировать. Media limits, expiry policy, agent instructions и L08 не затронуты.
- Следующий шаг: выполнить `npm.cmd run test:mcp`, затем полный offline acceptance; после этого обновить документацию и выполнить explicit checks.

### STEP-0239 — 2026-09-07 — MCP LoRA tool regression PASS

- Пакет и статус: L07 / `IN_PROGRESS`; новый `rh_upload_lora` зарегистрирован и не ломает stdio transport.
- Изменения и назначение: реальный MCP `initialize`/`tools/list` увидел `rh_upload_lora`; существующие catalog, graph, project и execution-plan сценарии продолжают работать без provider вызова.
- Файлы/модули: rebuilt `dist/`; `src/mcp/server.ts`, `src/execution/schemas.ts`, `tests/mcp/stdio.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:mcp` — `PASS`, 1 test, 0 failures; build внутри команды — `PASS`; SQLite experimental warning ожидаем. Full offline acceptance, explicit typecheck/build и diff check — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: MCP test проверяет регистрацию, а не live upload; нужно синхронизировать docs/capabilities и прогнать весь offline suite.
- Следующий шаг: выполнить `npm.cmd run test:acceptance:offline`.

### STEP-0240 — 2026-09-07 — full offline LoRA regression PASS

- Пакет и статус: L07 / `IN_PROGRESS`; LoRA core и локальные regressions проходят весь offline suite.
- Изменения и назначение: migration 8, новый route/tool, runner binding и dedicated tests не вызвали regressions в L00–L06, graph, project или stdio MCP flows.
- Файлы/модули: rebuilt `dist/`; `src/backends/workflow-api/client.ts`, `src/config.ts`, `src/execution/assets.ts`, `src/execution/lora.ts`, `src/execution/runner.ts`, `src/execution/schemas.ts`, `src/execution/types.ts`, `src/mcp/server.ts`, `src/storage/database.ts`, tests, `package.json`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:acceptance:offline` — `PASS`: unit 3, contract 2, graph 8, L03 4, L04 4, L05 15, L06 7, L07 4, MCP 1; всего 48 tests, 0 failures. Каждый build — `PASS`; ожидаемы SQLite experimental warnings. Explicit typecheck/build и diff check — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: нужно синхронизировать README/capabilities/configuration и выполнить explicit checks; live LoRA availability не доказывалась. Media limits, expiry policy, agent instructions и L08 не затронуты.
- Следующий шаг: обновить только документацию выбранного LoRA подпункта, затем выполнить `npm.cmd run typecheck`, `npm.cmd run build` и `git diff --check`.

### STEP-0241 — 2026-09-07 — синхронизирована LoRA documentation

- Пакет и статус: L07 / `IN_PROGRESS`; выбранный LoRA подпункт документирован, explicit checks ещё не выполнены.
- Изменения и назначение: README, capability matrix и configuration описывают отдельный `rh_upload_lora`, роль `lora`, `RHLoraLoader`, MD5/get-upload-URL/signed PUT flow, profile-scoped `fileName` cache и отсутствие live LoRA evidence; обычный media upload и LoRA flow явно разведены.
- Файлы/модули: `README.md`, `docs/capabilities.md`, `docs/configuration.md`, `PROGRESS.md`.
- Проверки: документационная синхронизация — `PASS`; typecheck, build и diff check — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: media limits, cache expiry policy, agent instructions и L08 остаются отдельными TODO; L07 целиком ещё не завершён.
- Следующий шаг: выполнить `npm.cmd run typecheck`, `npm.cmd run build` и `git diff --check`.

### STEP-0242 — 2026-09-07 — LoRA final typecheck PASS

- Пакет и статус: L07 / `IN_PROGRESS`; explicit typecheck после documentation sync прошёл.
- Изменения и назначение: подтверждена согласованность TypeScript source после добавления LoRA adapter, cache migration, runner binding и MCP schema/tool.
- Файлы/модули: `src/`, `README.md`, `docs/`, `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — `PASS`; build и `git diff --check` — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: media limits, cache expiry policy, agent instructions, live LoRA acceptance и L08 остаются отдельными TODO/`NOT_RUN`.
- Следующий шаг: выполнить `npm.cmd run build`.

### STEP-0243 — 2026-09-07 — LoRA final build PASS

- Пакет и статус: L07 / `IN_PROGRESS`; production build после документационной синхронизации прошёл.
- Изменения и назначение: `dist/` пересобран из LoRA-enabled source; emitted client, runner, storage migration and MCP tool are current.
- Файлы/модули: rebuilt `dist/`; `src/`, `README.md`, `docs/`, `PROGRESS.md`.
- Проверки: `npm.cmd run build` — `PASS`; typecheck — `PASS` (STEP-0242); `git diff --check` — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: media limits, cache expiry policy, agent instructions, live LoRA acceptance и L08 остаются отдельными TODO/`NOT_RUN`.
- Следующий шаг: выполнить `git diff --check` и затем сверить итоговый diff/status.

### STEP-0244 — 2026-09-07 — LoRA diff check PASS

- Пакет и статус: L07 / `LOCAL_DONE` для выбранного LoRA upload/bindings подпункта; media rules, cache expiry, agent instructions и L08 не начинались.
- Изменения и назначение: итоговый source/test/docs diff проверен после typecheck/build; пользовательские live scope и существующие изменения не затрагивались.
- Файлы/модули: `src/backends/workflow-api/client.ts`, `src/config.ts`, `src/execution/assets.ts`, `src/execution/lora.ts`, `src/execution/runner.ts`, `src/execution/schemas.ts`, `src/execution/types.ts`, `src/mcp/server.ts`, `src/storage/database.ts`, `tests/execution/l07.test.mjs`, `tests/mcp/stdio.test.mjs`, `tests/unit/config.test.mjs`, `tests/unit/storage.test.mjs`, `README.md`, `docs/capabilities.md`, `docs/configuration.md`, `package.json`, `PROGRESS.md`; `dist/` rebuilt.
- Проверки: `git diff --check` — `PASS`; были только ожидаемые LF→CRLF warnings. `npm.cmd run typecheck` — `PASS` (STEP-0242), `npm.cmd run build` — `PASS` (STEP-0243), `npm.cmd run test:acceptance:offline` — `PASS` 48/48 (STEP-0240). Live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: реальная доступность LoRA и signed URL expiry не проверялись; media rules, cache expiry policy, agent instructions и L08 остаются следующими отдельными пунктами.
- Следующий шаг: остановиться на завершённом выбранном LoRA подпункте; в новой задаче выбрать следующий пункт L07, не начинать его автоматически.

### STEP-0245 — 2026-09-07 — обновлены L07 handoff и acceptance

- Пакет и статус: L07 / `LOCAL_DONE` для LoRA upload/bindings; остальные L07 подпункты и L08 не начинались.
- Изменения и назначение: сводка/handoff в `PROGRESS.md` теперь отражает частичный статус L07; `ACCEPTANCE.md` получил отдельную synthetic-contract запись `L07-LORA-001` с явным ограничением live availability/expiry.
- Файлы/модули: `PROGRESS.md`, `ACCEPTANCE.md`.
- Проверки: документационная сверка — `PASS`; финальный `git diff --check` после этого изменения — `NOT_RUN`; typecheck/build/offline tests уже `PASS` в STEP-0240/0242/0243. Live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: media rules, cache expiry policy, server instructions и live LoRA acceptance остаются отдельными TODO/`NOT_RUN`.
- Следующий шаг: выполнить финальный `git diff --check` и остановиться.

### STEP-0246 — 2026-09-07 — L07 LoRA подпункт финально проверен

- Пакет и статус: L07 / `LOCAL_DONE` для dedicated LoRA upload/bindings; работа остановлена по правилу сессии.
- Изменения и назначение: source, tests, acceptance evidence, documentation и handoff синхронизированы; новый `rh_upload_lora` не смешивает LoRA с обычным media upload, а `RHLoraLoader` binding проверяется до submit.
- Файлы/модули: `ACCEPTANCE.md`, `PROGRESS.md`, `README.md`, `docs/capabilities.md`, `docs/configuration.md`, `package.json`, `src/backends/workflow-api/client.ts`, `src/config.ts`, `src/execution/assets.ts`, `src/execution/lora.ts`, `src/execution/runner.ts`, `src/execution/schemas.ts`, `src/execution/types.ts`, `src/mcp/server.ts`, `src/storage/database.ts`, `tests/execution/l07.test.mjs`, `tests/mcp/stdio.test.mjs`, `tests/unit/config.test.mjs`, `tests/unit/storage.test.mjs`; `dist/` rebuilt.
- Проверки: `npm.cmd run typecheck` — `PASS`; `npm.cmd run build` — `PASS`; `npm.cmd run test:acceptance:offline` — `PASS`, 48/48 tests; `npm.cmd run test:l07` — `PASS`, 4/4; `npm.cmd run test:mcp` — `PASS`, 1/1; `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings. Live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: real LoRA availability, signed URL expiry, media limits, server instructions и L08 остаются `NOT_RUN`/`TODO`; L07 не следует считать полностью завершённым.
- Следующий шаг: в новой отдельной задаче выбрать один оставшийся L07 подпункт; автоматически не начинать media rules, cache expiry, server instructions или L08.

### STEP-0247 — 2026-09-07 — выбран L07 media rules подпункт

- Пакет и статус: L07 / `IN_PROGRESS`; выбран только media rules: лимиты references/masks/video и согласованные media semantics до provider upload/submit. Cache expiry, server instructions и L08 не входят в текущий шаг.
- Основание: последний handoff STEP-0246 требует выбрать один оставшийся L07 подпункт; первым по порядку плана выбран media rules.
- Файлы/модули: на этапе выбора изменён только `PROGRESS.md`; существующие LoRA source/tests/docs не изменялись.
- Проверки: чтение L07 контракта и связанных `assets`, `runner`, `schemas`, `server` и tests — `PASS`; typecheck, build, tests и `git diff --check` — `NOT_RUN`, реализация ещё не начата; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: требуется добавить отдельный local media profile без утверждения account-wide provider compatibility; старые synthetic fixtures не должны маскироваться под live evidence.
- Следующий шаг: добавить media validator и regression fixtures, затем проверить его до upload/submit через durable runner.

### STEP-0248 — 2026-09-07 — добавлен media-profile validator

- Пакет и статус: L07 / `IN_PROGRESS`; media validator и pre-submit runner gate добавлены, targeted regression ещё не выполнена.
- Изменения и назначение: создан `runninghub-workflow-media-v1` с лимитами 4 image references, 1 mask, 1 video и 6 media inputs; API workflow references классифицируются по representation/MIME, LoRA исключается из media flow, mask требует роль `mask` и grayscale PNG с optional alpha, alpha image references сохраняются без преобразования, JPEG с EXIF orientation кроме 1 отклоняется. `DurableWorkflowRunner.prepare` выполняет проверку до upload/cache и submit; synthetic backend сохраняет совместимость со старыми non-media fixtures без выдачи их за live evidence.
- Файлы/модули: новый `src/execution/media.ts`; `src/execution/runner.ts`; `tests/execution/l07.test.mjs`; `PROGRESS.md`.
- Проверки: typecheck, build, `npm.cmd run test:l07`, full offline acceptance и `git diff --check` — `NOT_RUN`, код и fixtures изменены непосредственно перед записью; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: правила локального поддержанного media profile не доказывают account-wide provider limits; cache expiry, server instructions, live LoRA/media acceptance и L08 не затронуты.
- Следующий шаг: выполнить `npm.cmd run test:l07` и исправить только regressions этого media rules подпункта.

### STEP-0249 — 2026-09-07 — targeted media regression PASS

- Пакет и статус: L07 / `IN_PROGRESS`; первый targeted regression после media validator прошёл, дополнительные edge cases ещё добавляются.
- Изменения и назначение: сборка TypeScript и LoRA/media regression подтвердили, что media count/role/alpha/mask checks срабатывают до regular upload и provider submit; LoRA flow не изменился.
- Файлы/модули: rebuilt `dist/`; `src/execution/media.ts`, `src/execution/runner.ts`, `tests/execution/l07.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:l07` — `PASS`, 6 tests, 0 failures; build внутри команды — `PASS`; SQLite experimental warning ожидаем. Full offline acceptance, explicit typecheck, docs/acceptance sync и `git diff --check` — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: targeted suite ещё не покрывает video count и EXIF orientation; local profile limits не являются account-wide provider evidence.
- Следующий шаг: добавить только video-limit и non-identity EXIF fixtures, затем повторить `npm.cmd run test:l07`.

### STEP-0250 — 2026-09-07 — media edge-case regression PASS

- Пакет и статус: L07 / `IN_PROGRESS`; media validator покрыт targeted offline fixtures, documentation/acceptance sync ещё не выполнена.
- Изменения и назначение: добавлены fixtures для двух video inputs и JPEG EXIF orientation 6; оба нарушения отклоняются до regular upload и provider submit. Alpha PNG reference принимается, RGB mask отклоняется, пять references отклоняются.
- Файлы/модули: rebuilt `dist/`; `src/execution/media.ts`, `src/execution/runner.ts`, `tests/execution/l07.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:l07` — `PASS`, 8 tests, 0 failures; build внутри команды — `PASS`; SQLite experimental warning ожидаем. Full offline acceptance, explicit typecheck, documentation/acceptance sync и `git diff --check` — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: это synthetic/local contract evidence для выбранного media profile, не доказательство account-wide provider limits; cache expiry, server instructions, live LoRA/media acceptance и L08 не затронуты.
- Следующий шаг: синхронизировать capability/docs/acceptance только для media rules, затем выполнить explicit typecheck/build/full offline acceptance/diff check.

### STEP-0251 — 2026-09-07 — синхронизированы media acceptance и documentation

- Пакет и статус: L07 / `IN_PROGRESS`; media rules source, tests, capability output, docs и acceptance entry синхронизированы, explicit checks ещё не выполнены.
- Изменения и назначение: `rh_get_capabilities` сообщает local `runninghub-workflow-media-v1`; README/configuration/capabilities описывают только pre-upload/pre-submit limits и явно отделяют их от provider/account evidence; `ACCEPTANCE.md` добавляет `L07-MEDIA-001` как `synthetic_contract`.
- Файлы/модули: `src/mcp/server.ts`, `README.md`, `docs/capabilities.md`, `docs/configuration.md`, `ACCEPTANCE.md`, `PROGRESS.md`.
- Проверки: documentation/acceptance synchronization — `PASS`; targeted `npm.cmd run test:l07` — `PASS` 8/8 (STEP-0250). Explicit typecheck, build, full offline acceptance и `git diff --check` — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: media profile остаётся локальной synthetic evidence; cache expiry, server instructions, live LoRA/media acceptance и L08 не затронуты.
- Следующий шаг: выполнить `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run test:acceptance:offline` и `git diff --check`.

### STEP-0252 — 2026-09-07 — media explicit typecheck/build PASS

- Пакет и статус: L07 / `IN_PROGRESS`; source и documentation sync компилируются, full offline acceptance и final diff check ещё не выполнены.
- Изменения и назначение: подтверждена TypeScript согласованность media validator, runner pre-submit gate, capability response и существующего LoRA path; `dist/` пересобран.
- Файлы/модули: `src/execution/media.ts`, `src/execution/runner.ts`, `src/mcp/server.ts`, `README.md`, `docs/`, `ACCEPTANCE.md`, `PROGRESS.md`; rebuilt `dist/`.
- Проверки: `npm.cmd run typecheck` — `PASS`; `npm.cmd run build` — `PASS`; full offline acceptance и `git diff --check` — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: provider/account media limits, LoRA availability, cache expiry, server instructions и L08 не проверялись и не реализуются в этом шаге.
- Следующий шаг: выполнить `npm.cmd run test:acceptance:offline`.

### STEP-0253 — 2026-09-07 — full offline media acceptance PASS

- Пакет и статус: L07 / `IN_PROGRESS`; media rules проходят targeted и full offline regression, остаётся финальный diff check и handoff.
- Изменения и назначение: новый media validator и capability/docs/acceptance sync не вызвали regressions в L00–L06, LoRA, graph, project или MCP stdio flows.
- Файлы/модули: rebuilt `dist/`; `src/execution/media.ts`, `src/execution/runner.ts`, `src/mcp/server.ts`, `tests/execution/l07.test.mjs`, `README.md`, `docs/capabilities.md`, `docs/configuration.md`, `ACCEPTANCE.md`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:acceptance:offline` — `PASS`: unit 3, contract 2, graph 8, L03 4, L04 4, L05 15, L06 7, L07 8, MCP 1; всего 48 tests, 0 failures. Каждый внутренний build — `PASS`; SQLite experimental warnings ожидаемы. `git diff --check` — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: provider/account limits и live media/LoRA compatibility не доказаны; cache expiry, server instructions и L08 не затронуты.
- Следующий шаг: выполнить `git diff --check`, затем сверить итоговый diff/status и завершить только выбранный media rules подпункт.

### STEP-0254 — 2026-09-07 — L07 media rules подпункт завершён

- Пакет и статус: L07 / `LOCAL_DONE` для выбранного media rules подпункта; работа остановлена по правилу сессии.
- Изменения и назначение: local `runninghub-workflow-media-v1` валидирует количество references/masks/video, media roles/MIME, alpha PNG references, grayscale mask semantics и JPEG EXIF orientation до upload/submit; runner, capability output, docs и acceptance evidence синхронизированы.
- Файлы/модули: новый `src/execution/media.ts`; `src/execution/runner.ts`, `src/mcp/server.ts`, `tests/execution/l07.test.mjs`, `README.md`, `docs/capabilities.md`, `docs/configuration.md`, `ACCEPTANCE.md`, `PROGRESS.md`; `dist/` rebuilt.
- Проверки: `npm.cmd run typecheck` — `PASS`; `npm.cmd run build` — `PASS`; `npm.cmd run test:l07` — `PASS`, 8/8; `npm.cmd run test:acceptance:offline` — `PASS`, 48/48; `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings. SQLite experimental warnings ожидаемы. Live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: local synthetic contract не доказывает provider/account-wide media limits или live LoRA/media compatibility; cache expiry, server instructions и L08 остаются `TODO`/`NOT_RUN`.
- Следующий шаг: в новой отдельной задаче выбрать cache expiry или server instructions; текущий выбранный media rules подпункт завершён, дальнейшая работа в этой сессии не выполняется.

### STEP-0255 — 2026-09-07 — выбран L07 cache expiry подпункт

- Пакет и статус: L07 / `IN_PROGRESS`; выбран только cache expiry для regular media и dedicated LoRA upload caches. Server instructions и L08 в этот шаг не входят.
- Граница реализации: сохранять известный срок действия provider file/URL, считать просроченные или некорректные записи невалидными и удалять их при чтении; повторная загрузка допускается только в новом явном upload/submit flow. Явный provider expired/not-found при submit инвалидирует связанные cache entries, но не вызывает второй submit текущего job.
- Файлы/модули: планируются `src/storage/database.ts`, `src/execution/types.ts`, `src/execution/assets.ts`, `src/backends/workflow-api/client.ts`, `src/execution/runner.ts`, targeted L07/storage tests и cache documentation/acceptance.
- Проверки: typecheck, build, L07, full offline acceptance и `git diff --check` — `NOT_RUN`, реализация ещё не начата; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: provider responses без явно известного expiry остаются cacheable без искусственного TTL; signed LoRA PUT URL не сохраняется как graph reference и его expiry не переносится на cached `fileName`. Server instructions и L08 остаются TODO.
- Следующий шаг: добавить migration и expiry-aware cache reads, затем покрыть reupload/invalidation без повторного submit offline-тестами.

### STEP-0256 — 2026-09-07 — добавлен expiry-aware upload cache runtime

- Пакет и статус: L07 / `IN_PROGRESS`; cache expiry source path добавлен для regular media и LoRA.
- Изменения и назначение: migration 9 добавляет nullable `expires_at` в оба upload cache; storage удаляет expired/invalid entries при чтении; Workflow API сохраняет explicit response/URL expiry; provider cache-expired submit invalidates plan-linked entries and marks the current job failed without a second submit.
- Файлы/модули: `src/storage/database.ts`, `src/execution/types.ts`, `src/execution/schemas.ts`, `src/execution/assets.ts`, `src/backends/workflow-api/client.ts`, `src/execution/runner.ts`, `PROGRESS.md`.
- Проверки: typecheck, build, targeted L07/storage tests, full offline acceptance и `git diff --check` — `NOT_RUN`; tests и documentation/acceptance sync ещё не добавлены. Live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: automatic reupload is not a retry of an accepted generation; it occurs only when a later explicit flow resolves a new plan. Need targeted proof for expired entries, response expiry parsing, provider invalidation and no duplicate submit.
- Следующий шаг: обновить migration expectations и добавить offline regression fixtures, затем выполнить L07 targeted test.

### STEP-0257 — 2026-09-07 — исправлен URL expiry parser regression

- Пакет и статус: L07 / `IN_PROGRESS`; targeted cache regression выявила и локализовала одну ошибку в разборе URL expiry.
- Изменения и назначение: parser теперь учитывает provider query key `Expires` с сохранением exact UTC expiry; storage migration test и cache invalidation tests уже проходят.
- Файлы/модули: `src/backends/workflow-api/client.ts`, `PROGRESS.md`.
- Проверки: первый `npm.cmd run test:l07` — `FAIL`, 10 passed/1 failed: uppercase URL parameter не извлекался; после минимального исправления повторный targeted test — `NOT_RUN`. Full offline, explicit typecheck/build и `git diff --check` — `NOT_RUN`.
- Ограничения/остаток: live upload expiry и provider-specific cache invalidation не проверяются без явного разрешения; нужно подтвердить повторный L07 после исправления.
- Следующий шаг: повторить `npm.cmd run test:l07`, затем синхронизировать только cache expiry documentation/acceptance.

### STEP-0258 — 2026-09-07 — cache expiry targeted regression PASS

- Пакет и статус: L07 / `IN_PROGRESS`; cache expiry source and targeted offline contract pass, final shared regression ещё не выполнена.
- Изменения и назначение: tests подтверждают migration 9, stale regular/LoRA entry removal and explicit reupload, Workflow API `Expires` parsing, cache-expired provider classification, invalidation of linked cache, and exactly one submit for the failed plan.
- Файлы/модули: `tests/unit/storage.test.mjs`, `tests/execution/l07.test.mjs`, rebuilt `dist/`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:unit` — `PASS`, 4 tests; `npm.cmd run test:l07` — `PASS`, 12 tests; build внутри обеих команд — `PASS`. SQLite experimental warning ожидаем. Full offline acceptance, explicit typecheck/build и `git diff --check` — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: only synthetic/local provider markers are covered; provider-specific live TTL/expiry remains unknown. Documentation/acceptance entry is synchronized; final shared regression is still required.
- Следующий шаг: выполнить explicit typecheck/build и полный offline acceptance, затем проверить diff и handoff только по cache expiry.

### STEP-0259 — 2026-09-07 — L07 cache expiry подпункт завершён

- Пакет и статус: L07 / `LOCAL_DONE` для cache expiry; дальнейшая работа остановлена по правилу сессии. Server instructions и L08 не начинались.
- Изменения и назначение: regular media и dedicated LoRA caches теперь хранят known `expires_at`, удаляют expired/invalid entries before reuse, извлекают explicit expiry из Workflow API response/URL, а explicit expired/not-found submit invalidation переводит текущий job в `FAILED` без второго submit. Acceptance/docs синхронизированы.
- Файлы/модули: `src/storage/database.ts`, `src/backends/workflow-api/client.ts`, `src/execution/assets.ts`, `src/execution/runner.ts`, `src/execution/types.ts`, `src/execution/schemas.ts`, `src/mcp/server.ts`, `tests/unit/storage.test.mjs`, `tests/execution/l07.test.mjs`, `README.md`, `docs/capabilities.md`, `docs/configuration.md`, `ACCEPTANCE.md`, `PROGRESS.md`; `dist/` rebuilt. Existing media-rule changes in the workspace were not reverted.
- Проверки: `npm.cmd run typecheck` — `PASS`; `npm.cmd run build` — `PASS`; `npm.cmd run test:unit` — `PASS`, 4; `npm.cmd run test:l07` — `PASS`, 12; `npm.cmd run test:acceptance:offline` — `PASS`, 57/57; `npm.cmd run test:mcp` — `PASS`, 1; `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings. SQLite experimental warnings ожидаемы. Live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: без explicit provider TTL искусственный срок не назначается; live signed URL/LoRA availability и provider-specific expiry не проверялись. L07 остаётся `IN_PROGRESS` из-за server instructions; L08 остаётся `TODO`.
 - Следующий шаг: в новой отдельной задаче выбрать server instructions или иной явно разрешённый оставшийся пункт; cache expiry повторно не начинать автоматически.

### STEP-0260 — 2026-09-07 — добавлена server agent instruction

 - Пакет и статус: L07 / `IN_PROGRESS`; выбранный server-instructions подпункт реализован в source/docs, targeted transport regression ещё не выполнена.
 - Изменения и назначение: добавлена self-contained последовательность `project -> scene -> work item -> workflow -> assets -> prepare -> run -> job -> results -> review`, правила ролей/LoRA, stop conditions, запрет автоматического approval и запрет повторного submit после неопределённого ответа. MCP SDK получает краткую инструкцию через `initialize.instructions`; создана полная `docs/agent-workflow.md`.
 - Файлы/модули: новый `src/mcp/instructions.ts`, новый `docs/agent-workflow.md`, `src/mcp/server.ts`, `tests/mcp/stdio.test.mjs`, `README.md`, `docs/capabilities.md`, `docs/configuration.md`, `ACCEPTANCE.md`, `PROGRESS.md`.
 - Проверки: implementation/documentation sync — `PASS`; typecheck, build, `npm.cmd run test:mcp`, full offline acceptance и `git diff --check` — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
 - Ограничения/остаток: transport receipt и offline regression ещё не подтверждены; инструкция не доказывает provider availability и не заменяет user review. L08 не затронут.
 - Следующий шаг: выполнить `npm.cmd run test:mcp` и исправить только regressions server-instructions подпункта.

### STEP-0261 — 2026-09-07 — server instruction MCP regression PASS

 - Пакет и статус: L07 / `IN_PROGRESS`; MCP initialize доставляет server instructions, targeted regression прошла.
 - Изменения и назначение: child-process test подтвердил наличие `rh_prepare_generation` в `initialize.result.instructions` и явного запрета запуска новой генерации после bare `APPROVED`; tool list и существующие local flows продолжают работать.
 - Файлы/модули: rebuilt `dist/`; `src/mcp/instructions.ts`, `src/mcp/server.ts`, `tests/mcp/stdio.test.mjs`, `docs/agent-workflow.md`, documentation/acceptance files, `PROGRESS.md`.
 - Проверки: `npm.cmd run test:mcp` — `PASS`, build внутри команды — `PASS`, 1 test, 0 failures; ожидаем SQLite experimental warning. Explicit typecheck, full offline acceptance и `git diff --check` — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
 - Ограничения/остаток: нужно выполнить shared offline regression и final explicit checks; инструкция подтверждена только транспортным контрактом и не доказывает provider availability. L08 не затронут.
 - Следующий шаг: выполнить `npm.cmd run test:acceptance:offline`, затем explicit typecheck/build и `git diff --check`.

### STEP-0262 — 2026-09-07 — server instructions full offline regression PASS

 - Пакет и статус: L07 / `IN_PROGRESS`; server-instructions source/docs and transport behavior pass the shared offline suite.
 - Изменения и назначение: instruction registration did not regress unit, catalog, graph, project, durable execution, results/review, LoRA/media, or MCP stdio flows.
 - Файлы/модули: rebuilt `dist/`; instruction/docs/acceptance changes from STEP-0260/0261 and existing offline test modules.
 - Проверки: `npm.cmd run test:acceptance:offline` — `PASS`: unit 4, contract 2, graph 8, L03 4, L04 4, L05 15, L06 7, L07 12, MCP 1; всего 53 tests, 0 failures. Каждый internal build — `PASS`; SQLite experimental warnings ожидаемы. Explicit typecheck, explicit build и `git diff --check` — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
 - Ограничения/остаток: осталось выполнить explicit final checks и итоговую сверку handoff; transport/documentation evidence не доказывает provider availability. L08 не затронут.
 - Следующий шаг: выполнить `npm.cmd run typecheck`.

### STEP-0263 — 2026-09-07 — server instructions typecheck PASS

 - Пакет и статус: L07 / `IN_PROGRESS`; TypeScript source после подключения MCP instructions компилируется, build и diff check ещё не выполнены.
 - Изменения и назначение: подтверждена типовая совместимость `SERVER_INSTRUCTIONS` и SDK `McpServer` options без изменений execution contracts.
 - Файлы/модули: `src/mcp/instructions.ts`, `src/mcp/server.ts`, related docs/tests, `PROGRESS.md`.
 - Проверки: `npm.cmd run typecheck` — `PASS`; build и `git diff --check` — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
 - Ограничения/остаток: explicit production build и final diff/handoff остаются; L08 не затронут.
 - Следующий шаг: выполнить `npm.cmd run build`.

### STEP-0264 — 2026-09-07 — server instructions build PASS

 - Пакет и статус: L07 / `IN_PROGRESS`; production build после instruction/docs sync прошёл, final diff check ещё не выполнен.
 - Изменения и назначение: `dist/` пересобран из source с `initialize.instructions`; emitted MCP server и transport regression соответствуют текущему коду.
 - Файлы/модули: rebuilt `dist/`; `src/mcp/instructions.ts`, `src/mcp/server.ts`, docs/tests/acceptance, `PROGRESS.md`.
 - Проверки: `npm.cmd run build` — `PASS`; typecheck — `PASS` (STEP-0263); `git diff --check` — `NOT_RUN`; live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
 - Ограничения/остаток: нужен только final `git diff --check` и сверка фактического diff/status; provider availability и L08 не затронуты.
 - Следующий шаг: выполнить `git diff --check`, затем сверить итоговый diff/status и handoff.

### STEP-0265 — 2026-09-07 — server instructions diff check PASS

 - Пакет и статус: L07 / `LOCAL_DONE` для выбранного server-instructions подпункта; работа останавливается по правилу сессии.
 - Изменения и назначение: итоговый source/test/docs/acceptance diff проверен после typecheck/build; server instructions подключены официальным SDK способом, а полная агентская последовательность и границы review сохранены в `docs/agent-workflow.md`.
 - Файлы/модули: новый `src/mcp/instructions.ts`, новый `docs/agent-workflow.md`, `src/mcp/server.ts`, `tests/mcp/stdio.test.mjs`, `README.md`, `docs/capabilities.md`, `docs/configuration.md`, `ACCEPTANCE.md`, `PROGRESS.md`; `dist/` rebuilt. Существующие LoRA/media/cache changes не изменялись намеренно.
 - Проверки: `npm.cmd run typecheck` — `PASS`; `npm.cmd run build` — `PASS`; `npm.cmd run test:mcp` — `PASS`, 1/1; `npm.cmd run test:acceptance:offline` — `PASS`, 53/53; `git diff --check` — `PASS` с ожидаемыми LF->CRLF warnings. Live API, платные генерации, пользовательские assets и внешние изменения — `NOT_RUN`.
 - Ограничения/остаток: MCP transport/documentation evidence не доказывает provider availability; автоматическое approval не реализуется и запрещено инструкцией. L08/live acceptance не начинались.
 - Следующий шаг: в новой отдельной задаче выбрать следующий явно разрешённый пункт; server instructions, cache expiry, media rules и LoRA подпункты повторно не начинать, L08 не запускать автоматически.

### STEP-0266 — 2026-09-07 — structural live probe NOT_RUN by process environment

 - Пакет и статус: L08 / `LIVE_PENDING`; разрешённый structural probe выбран для workflow `2097177175284154370` и target `1024x576`, но provider request не начат.
 - Изменения и назначение: выполнен только opt-in harness command; script завершился до HTTP/API вызовов с требованием `RUNNINGHUB_WORKFLOW_API_KEY` и `RUNNINGHUB_LIVE_CASES=full`. Workflow/job не создавались и баланс не затрагивался.
 - Файлы/модули: только `PROGRESS.md`; product source и user project data не изменялись.
 - Проверки: `npm.cmd run test:live -- --structural-graph --workflow-id 2097177175284154370 --resize-width 1024 --resize-height 576` — `NOT_RUN`, exit code 2; причина: live environment was not visible to the child process in the required form. SQLite experimental warning ожидаем.
 - Ограничения/остаток: live structural acceptance остаётся непроверенной; ключ и его значение не записываются в журнал. Offline acceptance остаётся PASS из STEP-0265; другие платные probes не запускались.
 - Следующий шаг: проверить наличие двух environment variables без вывода значений и повторить только этот structural probe после корректного наследования окружения.

### STEP-0267 — 2026-09-07 — live environment presence check BLOCKED

 - Пакет и статус: L08 / `LIVE_PENDING`; structural probe остаётся разрешённой, но текущий tool PowerShell process не видит live credentials/flag.
 - Изменения и назначение: безопасная проверка только boolean presence подтвердила `RUNNINGHUB_WORKFLOW_API_KEY` отсутствует и `RUNNINGHUB_LIVE_CASES` отсутствует; значения, ключи и payload не выводились.
 - Файлы/модули: только `PROGRESS.md`.
 - Проверки: environment presence command — `PASS` (оба значения `false`); повторный live submit — `NOT_RUN`, потому что harness закономерно завершится до API без ключа и `full` flag.
 - Ограничения/остаток: требуется сделать переменные видимыми именно процессу запуска `npm.cmd`/PowerShell. Без этого нельзя доказать structural graph execution; платные и внешние probes не повторялись.
 - Следующий шаг: после корректного наследования окружения повторить только structural command для workflow `2097177175284154370` с `1024x576`; ключ в `PROGRESS.md` не записывать.

### STEP-0268 — 2026-09-07 — structural live probe blocked before submit by ambiguous resize node

 - Пакет и статус: L08 / `LIVE_PENDING`; User Environment Variables были успешно переданы дочернему процессу, workflow `2097177175284154370` доступен, но structural probe требует явный resize node ID.
 - Изменения и назначение: повторён только тот же authorized structural probe с target `1024x576`; harness получил workflow и остановился на `Multiple resize nodes were found`, не выполняя платный submit.
 - Файлы/модули: только `PROGRESS.md`.
 - Проверки: `npm.cmd run test:live -- --structural-graph --workflow-id 2097177175284154370 --resize-width 1024 --resize-height 576` с User Environment Variables — `LIVE_FAIL` до submit; provider task не создан, списаний не было.
 - Ограничения/остаток: нужно выбрать точный `resize-node-id` среди найденных нод; dimensions и workflow ID уже заданы. Ключ и приватный workflow payload в журнал не записываются.
 - Следующий шаг: получить/указать явный resize node ID и повторить только этот structural probe.

### STEP-0269 — 2026-09-07 — read-only resize candidate lookup shell error

 - Пакет и статус: L08 / `LIVE_PENDING`; перед повтором structural submit потребовался read-only список resize candidates.
 - Изменения и назначение: первая попытка получить candidates через inline Node script не прошла из-за PowerShell quoting; исправляется только команда запуска.
 - Файлы/модули: только `PROGRESS.md`.
 - Проверки: read-only candidate lookup — `NOT_RUN` (Node `SyntaxError` до выполнения и до HTTP); provider task не создавался, платная генерация не запускалась.
 - Ограничения/остаток: explicit `resize-node-id` всё ещё нужен; ключ не выводился и в журнал не записывался.
 - Следующий шаг: повторить read-only lookup с безопасным quoting и вывести только resize node IDs/classes/dimensions.

### STEP-0270 — 2026-09-07 — read-only resize candidates retrieved

 - Пакет и статус: L08 / `LIVE_PENDING`; API-format workflow JSON получен без submit, найдены два resize candidates.
 - Изменения и назначение: sanitized lookup вывел только candidates: node `85` class `WanImageToVideo` и node `122` class `EmptyLatentImage`; provider payload и credentials не сохранялись.
 - Файлы/модули: только `PROGRESS.md`.
 - Проверки: read-only `POST /api/openapi/getJsonApiFormat` — `PASS`; `count=2`. Structural paid probe — `NOT_RUN` после ambiguity, provider task не создавался.
 - Ограничения/остаток: harness не может выбрать между node `85` и `122` автоматически; node `122` выглядит как явный `EmptyLatentImage` resize candidate, но перед платным submit требуется явное подтверждение пользователя.
 - Следующий шаг: подтвердить `resize-node-id` (`85` или `122`), затем повторить structural probe с `1024x576`.

### STEP-0271 — 2026-09-07 — resize node selected for structural probe

 - Пакет и статус: L08 / `LIVE_PENDING`; пользователь явно выбрал node `85` (`WanImageToVideo`) для structural probe workflow `2097177175284154370`.
 - Изменения и назначение: зафиксирован только выбор resize candidate; target dimensions остаются `1024x576`, другие nodes и workflow files не изменяются.
 - Файлы/модули: только `PROGRESS.md`.
 - Проверки: selection — `PASS`; повторный paid structural command — `NOT_RUN` на момент записи; live API, task submit и output retrieval ещё не выполнены.
 - Ограничения/остаток: это scoped probe одного workflow/profile, не account-wide compatibility evidence.
 - Следующий шаг: выполнить structural probe с `--resize-node-id 85` и показать фактический результат.

### STEP-0272 — 2026-09-07 — structural graph live acceptance PASS

 - Пакет и статус: L08 / `IN_PROGRESS`; разрешённая structural live-проверка одного workflow/profile успешно завершена.
 - Изменения и назначение: durable live runner получил API-format graph, изменил node `85` (`WanImageToVideo`) с target `1024x576`, подтвердил изменённый graph hash, отправил ровно один ephemeral task и получил готовые outputs.
 - Файлы/модули: `PROGRESS.md`, `ACCEPTANCE.md`; user workflow/project files не изменялись, acceptance workflow не сохранялся.
 - Проверки: `npm.cmd run test:live -- --structural-graph --workflow-id 2097177175284154370 --resize-node-id 85 --resize-width 1024 --resize-height 576` — `PASS`; `LIVE_STRUCTURAL_SUBMIT: node_id=85 graph_hash_changed=true execution_state=RUNNING`, затем `LIVE_PASS: structural_graph=true resize_node=85 output_ready=true`. SQLite experimental warning ожидаем.
 - Ограничения/остаток: доказана только эта комбинация workflow/profile/node/dimensions; это не account-wide compatibility и не проверка LoRA, references, cancellation или installation. Новые live-case и платные генерации не запускались.
 - Следующий шаг: остановиться после выбранной structural live-проверки; следующий L08 case выбирать только отдельным явно разрешённым шагом.

### STEP-0273 — 2026-09-07 — structural live acceptance handoff complete

 - Пакет и статус: L08 / `LOCAL_DONE` для выбранного structural graph live-case; дальнейшие live-case в этой сессии не запускаются.
 - Изменения и назначение: live result и ограничение evidence синхронизированы в `ACCEPTANCE.md`; итоговый diff проверен. Другие L08 проверки, LoRA/media live acceptance и installation не объявляются выполненными.
 - Файлы/модули: `PROGRESS.md`, `ACCEPTANCE.md`; существующие source/user workflow changes не изменялись.
 - Проверки: structural live probe — `PASS` (STEP-0272); `git diff --check` — `PASS` с ожидаемыми LF->CRLF warnings. Дополнительные paid/live cases — `NOT_RUN` по границе выбранного шага.
- Ограничения/остаток: evidence scoped to workflow `2097177175284154370`, node `85`, profile and `1024x576`; account-wide compatibility, LoRA, references, cancellation, natural expiry and clean installation remain unverified.
- Следующий шаг: в новой отдельной задаче выбрать следующий L08 acceptance case или остановиться на текущем scoped evidence; автоматически новые платные проверки не запускать.

### STEP-0274 — 2026-09-07 — выбран L08 new-graph acceptance case

- Пакет и статус: L08 / `IN_PROGRESS`; выбран только следующий case после structural probe: submit нового локального workflow без `provider_workflow_id`. Image references, video, LoRA и installation не входят в этот шаг.
- Основание: план L08 требует проверить новый граф, а раздел 10.1 оставляет обязательность `workflowId` при переданном полном `workflow` открытым вопросом. Существующий durable runner уже запрещает повторный submit и использует fallback `/task/openapi/create`, но отдельного live harness для этого пути не было.
- Файлы/модули: на этапе выбора изменён только `PROGRESS.md`; связанные `scripts/test-live.mjs`, `src/execution/runner.ts`, `src/backends/workflow-api/client.ts`, graph codecs и execution tests прочитаны.
- Проверки: анализ связанного кода и acceptance/plan scope — `PASS`; typecheck, build, tests, live API, платные генерации, upload пользовательских данных и внешние изменения — `NOT_RUN`, реализация ещё не начата.
- Ограничения/остаток: без явного разрешения live submit не выполняется; новый probe должен использовать проверенный remote API graph как источник схем, создать свежую локальную revision и не сохранять acceptance workflow в пользовательский проект.
- Следующий шаг: добавить только `--new-graph` live harness и deterministic route regression, затем выполнить локальные проверки.

### STEP-0275 — 2026-09-07 — добавлен new-graph probe и route regression

- Пакет и статус: L08 / `IN_PROGRESS`; harness и offline route contract реализованы, live acceptance ещё не выполнена.
- Изменения и назначение: `--new-graph` импортирует API-граф выбранного workflow в свежую локальную revision и вызывает durable runner без `provider_workflow_id`, поэтому Workflow API использует `/task/openapi/create`; acceptance workflow остаётся только в памяти. Добавлены regression на отсутствие `workflowId`, README-команда и отдельная `L08-LIVE-002` запись.
- Файлы/модули: `scripts/test-live.mjs`, `tests/execution/l05.test.mjs`, `README.md`, `ACCEPTANCE.md`, `PROGRESS.md`.
- Проверки: код и документационная синхронизация изменены; `node --check`, targeted test, typecheck, build, full offline acceptance и `git diff --check` — `NOT_RUN` сразу после edit; live API, платные генерации, upload пользовательских данных и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: offline route test не доказывает, что provider примет новый full graph без `workflowId`; для этого нужен ровно один явно разрешённый paid submit с выбранным workflow ID.
- Следующий шаг: выполнить `node --check scripts/test-live.mjs` и targeted `npm.cmd run test:l05`, исправляя только regressions new-graph case.

### STEP-0276 — 2026-09-07 — new-graph harness syntax PASS

- Пакет и статус: L08 / `IN_PROGRESS`; live harness syntactically valid, targeted route test ещё не выполнен.
- Изменения и назначение: проверен CLI branching для `--new-graph`; ошибок парсинга JavaScript нет.
- Файлы/модули: `scripts/test-live.mjs`, `PROGRESS.md`.
- Проверки: `node --check scripts/test-live.mjs` — `PASS`; targeted test, typecheck, build, full offline acceptance и `git diff --check` — `NOT_RUN`; live API и платные генерации — `NOT_RUN`.
- Ограничения/остаток: syntax check не доказывает корректность durable submit path или provider acceptance.
- Следующий шаг: выполнить targeted `npm.cmd run test:l05`.

### STEP-0277 — 2026-09-07 — new-graph targeted regression PASS

- Пакет и статус: L08 / `IN_PROGRESS`; deterministic route regression проходит, shared offline regression ещё не выполнена.
- Изменения и назначение: подтверждено, что submit с полным workflow без `workflow_id` выбирает `/task/openapi/create`, передаёт граф и не добавляет `workflowId`; существующие recovery/cancel/upload/status tests не регрессировали.
- Файлы/модули: rebuilt `dist/`; `scripts/test-live.mjs`, `tests/execution/l05.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:l05` — `PASS`, build `PASS`, 16 tests, 0 failures; ожидаем SQLite experimental warning. Explicit typecheck, full offline acceptance и `git diff --check` — `NOT_RUN`; live API и платные генерации — `NOT_RUN`.
- Ограничения/остаток: это synthetic route evidence; provider должен быть проверен ровно одним разрешённым new-graph submit, без upload пользовательских данных.
- Следующий шаг: выполнить `npm.cmd run typecheck` и `npm.cmd run build`, затем полный offline acceptance.

### STEP-0278 — 2026-09-07 — new-graph typecheck PASS

- Пакет и статус: L08 / `IN_PROGRESS`; TypeScript source remains consistent, production build and shared regression ещё не выполнены.
- Изменения и назначение: проверена типовая совместимость нового live harness integration с текущими graph/revision/runner/backend contracts.
- Файлы/модули: `scripts/test-live.mjs`, `tests/execution/l05.test.mjs`, source imports, `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — `PASS`; build, full offline acceptance и `git diff --check` — `NOT_RUN`; live API, платные генерации, upload пользовательских данных и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: typecheck не доказывает runtime HTTP response или provider acceptance.
- Следующий шаг: выполнить `npm.cmd run build`.

### STEP-0279 — 2026-09-07 — new-graph production build PASS

- Пакет и статус: L08 / `IN_PROGRESS`; emitted runtime обновлён, shared offline acceptance и diff check ещё не выполнены.
- Изменения и назначение: production `dist/` пересобран с `--new-graph` harness-related test/build inputs; runtime source компилируется без ошибок.
- Файлы/модули: rebuilt `dist/`; `scripts/test-live.mjs`, `tests/execution/l05.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run build` — `PASS`; typecheck — `PASS` (STEP-0278); full offline acceptance и `git diff --check` — `NOT_RUN`; live API, платные генерации, upload пользовательских данных и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: build не доказывает, что выбранный provider workflow можно запустить без `workflowId`.
- Следующий шаг: выполнить `npm.cmd run test:acceptance:offline`.

### STEP-0280 — 2026-09-07 — new-graph full offline regression PASS

- Пакет и статус: L08 / `IN_PROGRESS`; local implementation/regression complete, final diff check and live acceptance remain.
- Изменения и назначение: new-graph route behavior did not regress graph, project, execution/recovery, results/review, LoRA/media or MCP stdio flows.
- Файлы/модули: rebuilt `dist/`; `scripts/test-live.mjs`, `tests/execution/l05.test.mjs`, `README.md`, `ACCEPTANCE.md`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:acceptance:offline` — `PASS`: unit 4, contract 2, graph 8, L03 4, L04 4, L05 16, L06 7, L07 12, MCP 1; всего 58 tests, 0 failures. Internal builds — `PASS`; SQLite experimental warnings ожидаемы. `git diff --check` — `NOT_RUN`; live API, платные генерации, upload пользовательских данных и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: offline evidence подтверждает только local route contract; provider acceptance без `workflowId` ещё не доказана.
- Следующий шаг: выполнить `git diff --check`, затем сверить фактический diff и handoff без запуска live probe.

### STEP-0281 — 2026-09-07 — new-graph diff check PASS

- Пакет и статус: L08 / `IN_PROGRESS`; выбранный new-graph case реализован и локально проверен, live acceptance остаётся `NOT_RUN`.
- Изменения и назначение: итоговый whitespace/diff check прошёл; существующие user/workspace changes не откатывались и не изменялись за пределами нового harness, regression, README, acceptance и журнала.
- Файлы/модули: `scripts/test-live.mjs`, `tests/execution/l05.test.mjs`, `README.md`, `ACCEPTANCE.md`, `PROGRESS.md`; `dist/` rebuilt.
- Проверки: `git diff --check` — `PASS`, только ожидаемые LF→CRLF warnings; `node --check`, `npm.cmd run test:l05`, `npm.cmd run typecheck`, `npm.cmd run build` и `npm.cmd run test:acceptance:offline` — `PASS` в STEP-0276–0280. Live API, платные генерации, upload пользовательских данных и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: live provider evidence по отсутствующему `workflowId` отсутствует; account-wide compatibility, references/video/LoRA и installation не входят в завершённый case.
- Следующий шаг: остановиться на выбранном new-graph case; после отдельного явного разрешения выполнить ровно один `--new-graph --workflow-id <authorized-id>` probe, не начиная следующий L08 case автоматически.

### STEP-0282 — 2026-09-07 — new-graph local handoff complete

- Пакет и статус: L08 / `LOCAL_DONE` для подготовки и локальной проверки выбранного new-graph acceptance case; работа остановлена по границе текущего разрешённого scope.
- Изменения и назначение: новый ephemeral harness, route regression, README и acceptance entry завершены; user workflow/project files не изменялись, live acceptance не подменена synthetic test.
- Файлы/модули: `scripts/test-live.mjs`, `tests/execution/l05.test.mjs`, `README.md`, `ACCEPTANCE.md`, `PROGRESS.md`; `dist/` rebuilt. Существующие workspace changes в `docs/`, `src/` и L07 tests не откатывались.
- Проверки: `node --check scripts/test-live.mjs` — `PASS`; `npm.cmd run test:l05` — `PASS`, 16/16; `npm.cmd run typecheck` — `PASS`; `npm.cmd run build` — `PASS`; `npm.cmd run test:acceptance:offline` — `PASS`, 58/58; `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings. Live API, paid submit, upload пользовательских данных и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: provider acceptance нового полного графа без `workflowId` и остальные L08 cases остаются `NOT_RUN`; capability evidence ограничена локальным route contract.
- Следующий шаг: получить отдельное явное разрешение на один paid `--new-graph` probe с выбранным workflow ID; до этого не запускать live или следующий L08 case.

### STEP-0283 — 2026-09-07 — разрешён scope new-graph live probe

- Пакет и статус: L08 / `LIVE_PENDING`; для завершения выбранного case применён user-provided live opt-in (`RUNNINGHUB_LIVE_CASES` и `RUNNINGHUB_WORKFLOW_API_KEY`) и ранее выбран workflow `2097177175284154370`.
- Изменения и назначение: разрешён ровно один ephemeral submit/status/output probe через новый harness; пользовательские assets, upload, cancellation и другие workflow не входят в scope.
- Файлы/модули: только `PROGRESS.md` до запуска; product source и project files не изменяются.
- Проверки: live command — `NOT_RUN` на момент записи; ключ и payload в журнал не записываются.
- Ограничения/остаток: результат должен подтвердить или опровергнуть принятие полного API-графа без `workflowId`; после команды не запускать следующий L08 case.
- Следующий шаг: выполнить ровно `npm.cmd run test:live -- --new-graph --workflow-id 2097177175284154370 --timeout-ms 300000`.

### STEP-0284 — 2026-09-07 — new-graph live probe blocked before API

- Пакет и статус: L08 / `LIVE_PENDING`; разрешённый new-graph case не получил provider evidence, потому что live environment не был виден дочернему `npm.cmd` process.
- Изменения и назначение: harness завершился до HTTP/API вызовов; task не создавался, платный submit не выполнялся, source и user project files не изменялись.
- Файлы/модули: только `PROGRESS.md`.
- Проверки: `npm.cmd run test:live -- --new-graph --workflow-id 2097177175284154370 --timeout-ms 300000` — `NOT_RUN`, exit code 2, причина: `RUNNINGHUB_WORKFLOW_API_KEY` и/или `RUNNINGHUB_LIVE_CASES=full` отсутствовали в процессе запуска; SQLite experimental warning ожидаем. Offline checks остаются `PASS` из STEP-0282.
- Ограничения/остаток: live acceptance без `workflowId` остаётся непроверенной; ключ не записывается и не выводится. Следующие L08 cases не начинаются.
- Следующий шаг: сделать уже заданные live variables видимыми именно процессу `npm.cmd`, затем повторить только этот new-graph command; не запускать другие probes.

### STEP-0285 — 2026-09-07 — final diff check after live gate

- Пакет и статус: L08 / `LIVE_PENDING`; локальная часть new-graph case завершена, external evidence заблокирована окружением.
- Изменения и назначение: после blocked live attempt проверен итоговый whitespace diff; live command повторно не запускался.
- Файлы/модули: `PROGRESS.md`; source/test/docs files из STEP-0282 не изменялись после локального handoff.
- Проверки: `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings; `node --check`, targeted/full offline tests, typecheck и build — `PASS` из STEP-0282; live API, платные генерации, upload пользовательских данных и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: provider acceptance нового графа без `workflowId` остаётся `NOT_RUN`; не переходить к image references, video, LoRA или installation.
- Следующий шаг: после корректного наследования `RUNNINGHUB_WORKFLOW_API_KEY` и `RUNNINGHUB_LIVE_CASES=full` повторить только new-graph probe для workflow `2097177175284154370`.

### STEP-0286 — 2026-09-07 — new-graph live probe explicitly confirmed

- Пакет и статус: L08 / `LIVE_PENDING`; пользователь явно подтвердил запуск одного разрешённого new-graph paid probe.
- Изменения и назначение: scope сохранён без расширения: workflow `2097177175284154370`, один submit/status/output flow, без upload пользовательских данных, cancellation или других workflow/cases.
- Файлы/модули: до проверки окружения изменён только `PROGRESS.md`; product source и project files не изменяются.
- Проверки: Process/User environment presence check — `NOT_RUN` на момент записи; значения ключа и переменной в журнал не записываются.
- Ограничения/остаток: если User Environment Variables не унаследованы текущим процессом, live harness должен получить их внутри запуска без вывода секретов и завершиться до API при отсутствии значения.
- Следующий шаг: выполнить безопасную presence check и затем только `npm.cmd run test:live -- --new-graph --workflow-id 2097177175284154370 --timeout-ms 300000`.

### STEP-0287 — 2026-09-07 — User Environment Variables presence PASS

- Пакет и статус: L08 / `LIVE_PENDING`; user-scoped live credentials and opt-in are present, but not inherited by the current Process scope.
- Изменения и назначение: safe boolean check confirmed `user_key_set=True`, `user_cases=True`, `user_cases_full=True`; no secret values were printed or persisted.
- Файлы/модули: `PROGRESS.md` only.
- Проверки: Process/User environment presence command — `PASS`; process values were false, user values were present; live API command — `NOT_RUN` before variable propagation.
- Ограничения/остаток: current command must copy the already-present User Environment Variables into its child process environment without logging the key.
- Следующий шаг: run exactly one new-graph probe with the user-scoped values inherited by `npm.cmd`.

### STEP-0288 — 2026-09-07 — new-graph live submit outcome unknown

- Пакет и статус: L08 / `LIVE_PENDING`; единственный явно разрешённый new-graph probe не получил однозначного provider task ID или output.
- Изменения и назначение: User Environment Variables были переданы только дочернему `npm.cmd`; harness дошёл до Workflow API submit и durable runner завершил его как `SUBMIT_UNKNOWN`. Автоматический retry и второй paid POST намеренно не выполнялись.
- Файлы/модули: только `PROGRESS.md`; acceptance workflow и user project files не сохранялись и не изменялись.
- Проверки: `npm.cmd run test:live -- --new-graph --workflow-id 2097177175284154370 --timeout-ms 300000` с user-scoped env — `LIVE_FAIL: Submit outcome is unknown; automatic retry is disabled.`; environment presence — `PASS` (STEP-0287). Provider task ID/output query — `NOT_RUN`, поскольку ID не был получен; upload пользовательских данных и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: результат не доказывает ни принятие, ни отклонение полного графа без `workflowId`; provider-side task мог существовать после неоднозначного submit. Не повторять POST автоматически и не запускать следующий L08 case.
- Следующий шаг: синхронизировать `ACCEPTANCE.md` с `LIVE_PENDING`/`SUBMIT_UNKNOWN` evidence и остановиться до отдельного решения по reconcile без повторной отправки.

### STEP-0289 — 2026-09-07 — acceptance synced for ambiguous new-graph submit

- Пакет и статус: L08 / `LIVE_PENDING`; new-graph acceptance остаётся неоднозначной после единственного разрешённого submit.
- Изменения и назначение: `ACCEPTANCE.md` теперь явно отмечает `L08-LIVE-002` как `LIVE_PENDING` с evidence `STEP-0288`; unknown submit не объявлен PASS или provider rejection.
- Файлы/модули: `ACCEPTANCE.md`, `PROGRESS.md`.
- Проверки: documentation synchronization — `PASS`; no new provider request, retry, upload или external change выполнялись.
- Ограничения/остаток: task ID отсутствует, поэтому status/output reconciliation невозможна в текущем ephemeral harness; следующий L08 case не начинался.
- Следующий шаг: остановиться; отдельное решение пользователя требуется для безопасного reconcile неизвестного submit или новой явно scoped проверки, без blind retry.

### STEP-0290 — 2026-09-07 — post-live diff check PASS

- Пакет и статус: L08 / `LIVE_PENDING`; работа остановлена после одного ambiguous new-graph submit.
- Изменения и назначение: acceptance evidence и журнал проверены на whitespace errors после фиксации live outcome; новые provider calls не выполнялись.
- Файлы/модули: `ACCEPTANCE.md`, `PROGRESS.md` и ранее изменённые new-graph files; существующие workspace changes не откатывались.
- Проверки: `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings; local typecheck/build/offline suites остаются `PASS` из STEP-0282. Повторный live submit, reconcile без task ID, upload пользовательских данных и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: provider acceptance без `workflowId` не доказана; `SUBMIT_UNKNOWN` запрещает blind retry и требует отдельного reconcile решения.
- Следующий шаг: не начинать следующий L08 case; сначала принять решение по неизвестному submit без повторной платной отправки.

### STEP-0291 — 2026-09-07 — выбран fix для submit outcome handling

- Пакет и статус: execution/recovery correction / `IN_PROGRESS`; выбран только fix обработки submit outcome, без нового live submit и без перехода к следующему L08 case.
- Причина: `DurableWorkflowRunner.run` превращал provider errors без `cache_expired` в брошенный generic `SUBMIT_UNKNOWN`; live harness закрывал in-memory storage, а deterministic HTTP rejection теряла исходный статус/сообщение. При настоящем неизвестном исходе нужно вернуть durable handle и запретить retry, а не завершать обычную MCP-сессию исключением.
- Файлы/модули: планируются `src/backends/workflow-api/client.ts`, `src/execution/runner.ts`, `scripts/test-live.mjs`, `tests/execution/l05.test.mjs`, `PROGRESS.md`.
- Проверки: чтение submit/client/runner/harness/tests — `PASS`; typecheck, build, tests и live API после изменения — `NOT_RUN`; новый paid submit, upload пользовательских данных и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: без provider task ID прошлый ambiguous submit нельзя безопасно polling; исправление предотвращает будущую потерю handle и причины, но не восстанавливает уже потерянный ID.
- Следующий шаг: добавить outcome classification, durable handle regression и pending logging в live harness, затем выполнить только локальные проверки.

### STEP-0292 — 2026-09-07 — submit outcome handling corrected

- Пакет и статус: execution/recovery correction / `IN_PROGRESS`; source and regression edits complete, checks ещё не выполнены.
- Изменения и назначение: Workflow API HTTP errors теперь сохраняют sanitized status/message и разделяют `rejected` от `unknown`; deterministic rejection переводит job в `FAILED` с исходной ошибкой, unknown outcome возвращает durable `SUBMIT_UNKNOWN` handle без второго POST. New-graph harness сообщает `LIVE_PENDING` вместо generic failure when no task ID exists.
- Файлы/модули: `src/backends/workflow-api/client.ts`, `src/execution/runner.ts`, `scripts/test-live.mjs`, `tests/execution/l05.test.mjs`, `PROGRESS.md`.
- Проверки: code edit completed; typecheck, build, targeted/full tests и `git diff --check` — `NOT_RUN`; live API, retry, upload пользовательских данных и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: прошлый submit без task ID не восстановлен и повторно не отправляется; actual provider response still requires separate safe reconciliation if a task ID becomes available.
- Следующий шаг: выполнить `npm.cmd run test:l05` и исправить только regressions submit outcome handling.

### STEP-0293 — 2026-09-07 — submit outcome targeted regression PASS

- Пакет и статус: execution/recovery correction / `IN_PROGRESS`; targeted behavior passes, explicit typecheck/build, full offline suite and diff check remain.
- Изменения и назначение: tests confirm deterministic rejection preserves `PROVIDER_ERROR` and marks job `FAILED`, while unknown submit returns durable `SUBMIT_UNKNOWN` handle with exactly one submit and no session-ending throw.
- Файлы/модули: rebuilt `dist/`; `src/backends/workflow-api/client.ts`, `src/execution/runner.ts`, `scripts/test-live.mjs`, `tests/execution/l05.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:l05` — `PASS`, build `PASS`, 19 tests, 0 failures; SQLite experimental warning ожидаем. Explicit typecheck, full offline acceptance и `git diff --check` — `NOT_RUN`; live API and retries — `NOT_RUN`.
- Ограничения/остаток: no task ID exists for the earlier ambiguous submit; no new paid request was made.
- Следующий шаг: выполнить `npm.cmd run typecheck`, затем `npm.cmd run build` и full offline acceptance.

### STEP-0294 — 2026-09-07 — submit outcome typecheck PASS

- Пакет и статус: execution/recovery correction / `IN_PROGRESS`; TypeScript consistency confirmed, build/full regression remain.
- Изменения и назначение: verified new provider HTTP error context and runner durable-handle branches compile with existing execution contracts.
- Файлы/модули: `src/backends/workflow-api/client.ts`, `src/execution/runner.ts`, related tests/harness, `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — `PASS`; build, full offline acceptance и `git diff --check` — `NOT_RUN`; live API, retries and user-data upload — `NOT_RUN`.
- Ограничения/остаток: compile success does not recover the historical provider task ID.
- Следующий шаг: выполнить `npm.cmd run build`.

### STEP-0295 — 2026-09-07 — submit outcome production build PASS

- Пакет и статус: execution/recovery correction / `IN_PROGRESS`; emitted runtime is current, full offline regression and diff check remain.
- Изменения и назначение: production `dist/` rebuilt with provider outcome classification, durable unknown handle return and pending live-harness reporting.
- Файлы/модули: rebuilt `dist/`; `src/backends/workflow-api/client.ts`, `src/execution/runner.ts`, `scripts/test-live.mjs`, `tests/execution/l05.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run build` — `PASS`; typecheck — `PASS` (STEP-0294); full offline acceptance и `git diff --check` — `NOT_RUN`; live API and retries — `NOT_RUN`.
- Ограничения/остаток: runtime now preserves future unknown-submit job handles, but the previous ephemeral job has no recoverable task ID.
- Следующий шаг: выполнить `npm.cmd run test:acceptance:offline`.

### STEP-0296 — 2026-09-07 — submit outcome full offline regression PASS

- Пакет и статус: execution/recovery correction / `IN_PROGRESS`; local regression complete, final diff check remains.
- Изменения и назначение: corrected submit outcome handling did not regress storage, graph, project, execution, results/review, LoRA/media or MCP stdio flows.
- Файлы/модули: rebuilt `dist/`; `src/backends/workflow-api/client.ts`, `src/execution/runner.ts`, `scripts/test-live.mjs`, `tests/execution/l05.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:acceptance:offline` — `PASS`: unit 4, contract 2, graph 8, L03 4, L04 4, L05 19, L06 7, L07 12, MCP 1; всего 61 tests, 0 failures. Internal builds — `PASS`; SQLite experimental warnings ожидаемы. `git diff --check` — `NOT_RUN`; live API, retries and user-data upload — `NOT_RUN`.
- Ограничения/остаток: earlier ambiguous submit remains unreconciled because no task ID exists; future unknown outcomes now remain addressable through the durable job handle.
- Следующий шаг: выполнить `git diff --check` и остановиться, не повторяя live submit.

### STEP-0297 — 2026-09-07 — submit outcome correction handoff complete

- Пакет и статус: execution/recovery correction / `LOCAL_DONE`; работа остановлена по текущему запросу, следующий L08 case не начинался.
- Изменения и назначение: MCP теперь не маскирует deterministic provider rejection под `SUBMIT_UNKNOWN`; unknown submit сохраняет durable job handle, не делает второй POST, а при известном task ID `wait` продолжает bounded polling до terminal result. Live harness показывает `LIVE_PENDING` вместо прежнего generic termination.
- Файлы/модули: `src/backends/workflow-api/client.ts`, `src/execution/runner.ts`, `scripts/test-live.mjs`, `tests/execution/l05.test.mjs`, `PROGRESS.md`; `dist/` rebuilt. Existing workspace changes не откатывались.
- Проверки: `npm.cmd run test:l05` — `PASS`, 19/19; `npm.cmd run typecheck` — `PASS`; `npm.cmd run build` — `PASS`; `npm.cmd run test:acceptance:offline` — `PASS`, 61/61; `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings. Новый live submit/retry — `NOT_RUN`.
- Ограничения/остаток: прошлый ambiguous submit нельзя показать или polling без provider task ID; его повторная отправка запрещена. Для будущего запуска при `SUBMIT_UNKNOWN` MCP вернёт job handle, который можно безопасно reconciliate через `rh_job` после получения task ID.
- Следующий шаг: получить/сохранить provider task ID для старого ambiguous submit только через отдельный reconcile path; не повторять submit и не переходить к следующему L08 case автоматически.

### STEP-0298 — 2026-09-07 — выбран explicit SUBMIT_UNKNOWN reconcile path

- Пакет и статус: execution/recovery correction / `IN_PROGRESS`; выбран только безопасный attach-and-poll path для уже существующего `SUBMIT_UNKNOWN` job, без нового submit и без следующего L08 case.
- Основание: текущий `rh_job resume` переводит в `SUBMIT_UNKNOWN` только interrupted `SUBMITTING` и не принимает task ID, найденный пользователем позже. План требует сначала reconcile известного provider task ID и запрещает blind retry.
- Файлы/модули: планируются `src/execution/schemas.ts`, `src/mcp/server.ts`, `src/storage/database.ts`, `tests/execution/l05.test.mjs`, `tests/mcp/stdio.test.mjs`, `PROGRESS.md`.
- Проверки: чтение job schema/server/storage/recovery path и plan contract — `PASS`; typecheck, build, tests и live API — `NOT_RUN`; новый submit, retry, upload пользовательских данных и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: reconcile сможет ждать только после получения реального provider task ID извне; он не угадывает ID и не ищет его через неподтверждённый provider endpoint.
- Следующий шаг: добавить строгий `provider_task_id` input только для `rh_job resume` на `SUBMIT_UNKNOWN`, затем покрыть attach/poll без submit regression.

### STEP-0299 — 2026-09-07 — добавлен explicit SUBMIT_UNKNOWN task attach

- Пакет и статус: execution/recovery correction / `IN_PROGRESS`; attach path and regressions added, checks ещё не выполнены.
- Изменения и назначение: `rh_job resume` принимает `provider_task_id` только для job в `SUBMIT_UNKNOWN`; storage atomically attaches it once, переводит job в tracking, а existing `runner.recover` polls status/output without another submit. Other actions reject this field.
- Файлы/модули: `src/execution/schemas.ts`, `src/storage/database.ts`, `src/mcp/server.ts`, `tests/execution/l05.test.mjs`, `tests/mcp/stdio.test.mjs`, `PROGRESS.md`.
- Проверки: source/test edit complete; typecheck, build, targeted/full tests и `git diff --check` — `NOT_RUN`; live API, retry, upload пользовательских данных и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: caller must supply a real provider task ID obtained outside this server; attaching an invented ID is not provider evidence and will be diagnosed by status polling.
- Следующий шаг: выполнить `npm.cmd run test:l05` и `npm.cmd run test:mcp`, исправляя только reconcile regressions.

### STEP-0300 — 2026-09-07 — explicit task attach targeted regression PASS

- Пакет и статус: execution/recovery correction / `IN_PROGRESS`; runner/storage attach-and-poll regression passes, MCP transport regression ещё не выполнена.
- Изменения и назначение: a supplied task ID transitions `SUBMIT_UNKNOWN` to tracking, polls success and outputs, and rejects a second attachment; submit count remains exactly one.
- Файлы/модули: rebuilt `dist/`; `src/storage/database.ts`, `src/mcp/server.ts`, `src/execution/schemas.ts`, `tests/execution/l05.test.mjs`, `tests/mcp/stdio.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:l05` — `PASS`, build `PASS`, 20 tests, 0 failures; SQLite experimental warning ожидаем. `npm.cmd run test:mcp`, typecheck, full offline acceptance и `git diff --check` — `NOT_RUN`; live API and retries — `NOT_RUN`.
- Ограничения/остаток: test uses synthetic task ID/backend; it proves no duplicate submit and local polling semantics, not provider ownership of an externally supplied ID.
- Следующий шаг: выполнить `npm.cmd run test:mcp`.

### STEP-0301 — 2026-09-07 — MCP task attach schema regression PASS

- Пакет и статус: execution/recovery correction / `IN_PROGRESS`; MCP stdio exposes the explicit reconcile input, shared offline regression and final checks remain.
- Изменения и назначение: real child-process initialize/tools-list confirms `rh_job` advertises optional `provider_task_id`; existing MCP tool registration and local execution flow remain healthy.
- Файлы/модули: rebuilt `dist/`; `src/mcp/server.ts`, `src/execution/schemas.ts`, `src/storage/database.ts`, `tests/mcp/stdio.test.mjs`, `tests/execution/l05.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:mcp` — `PASS`, build `PASS`, 1 test, 0 failures; SQLite experimental warning ожидаем. Typecheck, full offline acceptance и `git diff --check` — `NOT_RUN`; live API and retries — `NOT_RUN`.
- Ограничения/остаток: stdio test checks schema exposure, while synthetic L05 test checks attach/poll behavior; no provider request was made.
- Следующий шаг: выполнить `npm.cmd run typecheck`, `npm.cmd run build` и full offline acceptance.

### STEP-0302 — 2026-09-07 — task attach typecheck PASS

- Пакет и статус: execution/recovery correction / `IN_PROGRESS`; source compiles, build/full offline acceptance and diff check remain.
- Изменения и назначение: verified schema, storage atomic attach and MCP resume branch type compatibility.
- Файлы/модули: `src/execution/schemas.ts`, `src/storage/database.ts`, `src/mcp/server.ts`, related tests, `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — `PASS`; build, full offline acceptance и `git diff --check` — `NOT_RUN`; live API, retries and user-data upload — `NOT_RUN`.
- Ограничения/остаток: compile pass does not identify the lost provider task ID from the earlier ephemeral probe.
- Следующий шаг: выполнить `npm.cmd run build`.

### STEP-0303 — 2026-09-07 — task attach production build PASS

- Пакет и статус: execution/recovery correction / `IN_PROGRESS`; emitted runtime is current, full offline acceptance and diff check remain.
- Изменения и назначение: production `dist/` rebuilt with explicit `SUBMIT_UNKNOWN` task-ID attach and resume polling path.
- Файлы/модули: rebuilt `dist/`; `src/execution/schemas.ts`, `src/storage/database.ts`, `src/mcp/server.ts`, related tests, `PROGRESS.md`.
- Проверки: `npm.cmd run build` — `PASS`; typecheck — `PASS` (STEP-0302); full offline acceptance и `git diff --check` — `NOT_RUN`; live API and retries — `NOT_RUN`.
- Ограничения/остаток: build does not prove the externally supplied task ID belongs to the ambiguous provider request.
- Следующий шаг: выполнить `npm.cmd run test:acceptance:offline`.

### STEP-0304 — 2026-09-07 — task attach full offline regression PASS

- Пакет и статус: execution/recovery correction / `IN_PROGRESS`; attach/reconcile path passes shared offline suite, final diff check remains.
- Изменения и назначение: explicit `provider_task_id` schema, atomic storage attach and resume path did not regress all existing local suites or MCP stdio transport.
- Файлы/модули: rebuilt `dist/`; `src/execution/schemas.ts`, `src/storage/database.ts`, `src/mcp/server.ts`, `tests/execution/l05.test.mjs`, `tests/mcp/stdio.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:acceptance:offline` — `PASS`: unit 4, contract 2, graph 8, L03 4, L04 4, L05 20, L06 7, L07 12, MCP 1; всего 62 tests, 0 failures. Internal builds — `PASS`; SQLite experimental warnings ожидаемы. `git diff --check` — `NOT_RUN`; live API, retries and user-data upload — `NOT_RUN`.
- Ограничения/остаток: synthetic attach proves local no-duplicate reconciliation only; it cannot identify the earlier lost provider task ID.
- Следующий шаг: выполнить `git diff --check` и завершить только этот reconcile path.

### STEP-0305 — 2026-09-07 — explicit task attach reconcile handoff complete

- Пакет и статус: execution/recovery correction / `LOCAL_DONE`; выбранный safe reconcile path завершён, следующий L08 case не начинался.
- Изменения и назначение: `rh_job resume` теперь может однократно принять внешний provider task ID для `SUBMIT_UNKNOWN`, сохранить его атомарно и использовать существующий polling/output path без нового submit; invalid action/state combinations отклоняются.
- Файлы/модули: `src/execution/schemas.ts`, `src/storage/database.ts`, `src/mcp/server.ts`, `tests/execution/l05.test.mjs`, `tests/mcp/stdio.test.mjs`, `PROGRESS.md`; `dist/` rebuilt. Existing workspace changes не откатывались.
- Проверки: `npm.cmd run test:l05` — `PASS`, 20/20; `npm.cmd run test:mcp` — `PASS`, 1/1; `npm.cmd run typecheck` — `PASS`; `npm.cmd run build` — `PASS`; `npm.cmd run test:acceptance:offline` — `PASS`, 62/62; `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings. Live API, retries and user-data upload — `NOT_RUN`.
- Ограничения/остаток: старый ambiguous submit не имеет task ID, поэтому его нельзя polling или показать; новый reconcile требует реальный ID от пользователя/provider UI и не доказывает его ownership самостоятельно.
- Следующий шаг: остановиться на завершённом reconcile path; при получении реального provider task ID вызвать `rh_job resume` с ним, не повторяя `rh_run_workflow`.

### STEP-0306 — 2026-09-07 — reconcile guidance and acceptance synced

- Пакет и статус: execution/recovery correction / `IN_PROGRESS`; implementation/docs synced, final checks after docs remain.
- Изменения и назначение: MCP instructions, `docs/agent-workflow.md`, README and acceptance evidence now explicitly require exact externally obtained task ID plus `rh_job resume`/`wait` for `SUBMIT_UNKNOWN`, and forbid guessed IDs or a second `rh_run_workflow`.
- Файлы/модули: `src/mcp/instructions.ts`, `docs/agent-workflow.md`, `README.md`, `ACCEPTANCE.md`, `PROGRESS.md`.
- Проверки: documentation synchronization — `PASS`; typecheck, build, MCP/full offline tests and `git diff --check` after docs — `NOT_RUN`; live API, retries and user-data upload — `NOT_RUN`.
- Ограничения/остаток: guidance cannot recover the previous missing provider task ID; no provider ownership is inferred from a caller-supplied ID.
- Следующий шаг: выполнить `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run test:acceptance:offline` и `git diff --check`.

### STEP-0307 — 2026-09-07 — reconcile guidance typecheck PASS

- Пакет и статус: execution/recovery correction / `IN_PROGRESS`; docs/instructions compile, remaining checks are pending.
- Изменения и назначение: verified `SERVER_INSTRUCTIONS` and MCP schema/runtime source after adding explicit task-ID reconcile guidance.
- Файлы/модули: `src/mcp/instructions.ts`, `src/mcp/server.ts`, `src/execution/schemas.ts`, related docs/tests, `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — `PASS`; build, full offline acceptance и `git diff --check` — `NOT_RUN`; live API, retries and user-data upload — `NOT_RUN`.
- Ограничения/остаток: typecheck does not recover the historical unknown submit.
- Следующий шаг: выполнить `npm.cmd run build`.

### STEP-0308 — 2026-09-07 — reconcile guidance production build PASS

- Пакет и статус: execution/recovery correction / `IN_PROGRESS`; emitted runtime is current, full offline acceptance and diff check remain.
- Изменения и назначение: production `dist/` rebuilt with updated agent instructions and explicit `rh_job` reconcile schema/handler.
- Файлы/модули: rebuilt `dist/`; `src/mcp/instructions.ts`, `src/mcp/server.ts`, `src/execution/schemas.ts`, docs/tests, `PROGRESS.md`.
- Проверки: `npm.cmd run build` — `PASS`; typecheck — `PASS` (STEP-0307); full offline acceptance и `git diff --check` — `NOT_RUN`; live API and retries — `NOT_RUN`.
- Ограничения/остаток: build does not verify provider task ownership or recover the old task ID.
- Следующий шаг: выполнить `npm.cmd run test:acceptance:offline`.

### STEP-0309 — 2026-09-07 — reconcile guidance full offline regression PASS

- Пакет и статус: execution/recovery correction / `IN_PROGRESS`; implementation and docs pass shared offline regression, final diff check remains.
- Изменения и назначение: explicit task-ID guidance and acceptance entry did not regress catalog, graph, project, execution, results/review, LoRA/media or MCP stdio flows.
- Файлы/модули: rebuilt `dist/`; `src/mcp/instructions.ts`, `src/mcp/server.ts`, `src/execution/schemas.ts`, `src/storage/database.ts`, `tests/execution/l05.test.mjs`, `tests/mcp/stdio.test.mjs`, `docs/agent-workflow.md`, `README.md`, `ACCEPTANCE.md`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:acceptance:offline` — `PASS`: unit 4, contract 2, graph 8, L03 4, L04 4, L05 20, L06 7, L07 12, MCP 1; всего 62 tests, 0 failures. Internal builds — `PASS`; SQLite experimental warnings ожидаемы. `git diff --check` — `NOT_RUN`; live API, retries and user-data upload — `NOT_RUN`.
- Ограничения/остаток: local/synthetic evidence does not identify or authenticate the old ambiguous provider task.
- Следующий шаг: выполнить `git diff --check` и завершить выбранный reconcile path.

### STEP-0310 — 2026-09-07 — SUBMIT_UNKNOWN reconcile path complete

- Пакет и статус: execution/recovery correction / `LOCAL_DONE`; текущий safe reconcile path завершён, дальнейшие L08 cases не начинались.
- Изменения и назначение: unknown submit now remains a durable handle; exact external task ID can be attached once through `rh_job resume`, then `rh_job wait` polls status/outputs without another submit. Instructions and acceptance evidence document the boundary.
- Файлы/модули: `src/execution/schemas.ts`, `src/storage/database.ts`, `src/mcp/server.ts`, `src/mcp/instructions.ts`, `tests/execution/l05.test.mjs`, `tests/mcp/stdio.test.mjs`, `docs/agent-workflow.md`, `README.md`, `ACCEPTANCE.md`, `PROGRESS.md`; `dist/` rebuilt. Existing workspace changes не откатывались.
- Проверки: `npm.cmd run test:l05` — `PASS`, 20/20; `npm.cmd run test:mcp` — `PASS`, 1/1; `npm.cmd run typecheck` — `PASS`; `npm.cmd run build` — `PASS`; `npm.cmd run test:acceptance:offline` — `PASS`, 62/62; `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings. Live API, retries and user-data upload — `NOT_RUN`.
 - Ограничения/остаток: старый ambiguous submit из ephemeral probe не имеет task ID и не может быть показан или polling; повторная отправка запрещена. При наличии реального ID использовать `rh_job resume` с `provider_task_id`.
 - Следующий шаг: остановиться на завершённом reconcile path; не запускать новый submit или следующий L08 case автоматически.

### STEP-0311 — 2026-09-08 — разрешён новый new-graph probe после отсутствия task ID

 - Пакет и статус: L08 / `LIVE_PENDING`; старый `SUBMIT_UNKNOWN` остаётся unreconciled, потому что реальный provider task ID не найден.
 - Изменения и назначение: проверка workspace, журнала и live harness не выявила task ID для старого submit. Пользователь явно разрешил fallback на ровно один новый `--new-graph` probe для workflow `2097177175284154370`; scope ограничен одним submit/status/output flow без upload пользовательских данных, cancel или другого workflow.
 - Файлы/модули: `PROGRESS.md`; runtime code не изменён.
 - Проверки: поиск старого task ID и проверка user-level env — `PASS` (`key_set=True`, `live_cases=full`); новый live probe — `NOT_RUN` до этой записи. Автоматический retry старого submit, upload пользовательских данных и внешние изменения — `NOT_RUN`.
 - Ограничения/остаток: новый probe не докажет результат старого submit; при неизвестном исходе нового submit нельзя повторять POST, нужно сохранить `SUBMIT_UNKNOWN` и остановиться.
 - Следующий шаг: выполнить ровно `npm.cmd run test:live -- --new-graph --workflow-id 2097177175284154370 --timeout-ms 300000` с user-level env, затем записать фактический provider outcome.

### STEP-0312 — 2026-09-08 — new-graph probe preflight PASS

 - Пакет и статус: L08 / `LIVE_PENDING`; выполняется ровно один разрешённый новый graph probe.
 - Изменения и назначение: runtime code не изменён. Проверены live harness и его guardrails: `--new-graph` принимает только явный numeric workflow ID, не комбинируется с другими probe modes, submit выполняется без `provider_workflow_id`, а неизвестный submit outcome не приводит к retry или polling.
 - Файлы/модули: `PROGRESS.md`; read-only inspection `scripts/test-live.mjs`, `RUNNINGHUB_MCP_IMPLEMENTATION_PLAN.md`.
 - Проверки: user-level env preflight — `PASS` (`RUNNINGHUB_WORKFLOW_API_KEY_SET=True`, `RUNNINGHUB_LIVE_CASES=full`); Node — `v22.18.0`; live submit/status/output — `NOT_RUN` до этой записи; upload пользовательских данных, cancel, retry старого submit и внешние изменения — `NOT_RUN`.
 - Ограничения/остаток: probe не докажет результат старого `SUBMIT_UNKNOWN`; при новом неизвестном submit нужно остановиться и сохранить этот outcome.
 - Следующий шаг: выполнить ровно указанную в `STEP-0311` команду new-graph probe и записать фактический outcome без повторного submit.

### STEP-0313 — 2026-09-08 — new-graph probe failed without task evidence

 - Пакет и статус: L08 / `LIVE_PENDING`; выбранный единственный new-graph probe завершился отказом, acceptance не доказана.
 - Изменения и назначение: runtime code и пользовательские workflow/project files не изменялись. Команда выполнила ровно один разрешённый `--new-graph` запуск; harness вернул `LIVE_FAIL: must not be null` до строки `LIVE_NEW_GRAPH_SUBMIT`, поэтому task ID и output evidence отсутствуют.
 - Файлы/модули: `PROGRESS.md`, `ACCEPTANCE.md` (синхронизация фактического live evidence).
 - Проверки: `npm.cmd run test:live -- --new-graph --workflow-id 2097177175284154370 --timeout-ms 300000` — `FAIL`, exit code 1, `LIVE_FAIL: must not be null`; SQLite experimental warning ожидаем. Автоматический retry, старый submit reconcile, upload пользовательских данных, cancel и другие live cases — `NOT_RUN`.
 - Ограничения/остаток: внешний результат не классифицирован как accepted/rejected provider task, потому что harness не вывел submit marker и не получил task ID; повторять paid probe в этом пункте нельзя.
 - Следующий шаг: выполнить локальные `typecheck`, `build`, offline acceptance и `git diff --check`, затем остановиться с L08 `LIVE_PENDING`; отдельный новый live probe возможен только после отдельного решения о диагностике/исправлении.

### STEP-0314 — 2026-09-08 — post-probe typecheck PASS

 - Пакет и статус: L08 / `LIVE_PENDING`; локальная компиляция текущего workspace подтверждена после live failure.
 - Изменения и назначение: исходники не изменялись; проверена совместимость текущего TypeScript source set.
 - Файлы/модули: `PROGRESS.md`; typecheck охватил текущие `src/` и типизированные build inputs.
 - Проверки: `npm.cmd run typecheck` — `PASS`, exit code 0; live API, retry и user-data upload — `NOT_RUN` после единственного разрешённого probe.
 - Ограничения/остаток: typecheck не классифицирует `LIVE_FAIL: must not be null` и не создаёт provider evidence.
 - Следующий шаг: выполнить `npm.cmd run build`.

### STEP-0315 — 2026-09-08 — post-probe production build PASS

 - Пакет и статус: L08 / `LIVE_PENDING`; production output rebuilt after the single live probe.
 - Изменения и назначение: `dist/` regenerated from the unchanged current source; no live or user-data operation was triggered by the build.
 - Файлы/модули: generated `dist/`; `PROGRESS.md`.
 - Проверки: `npm.cmd run build` — `PASS`, exit code 0; typecheck — `PASS` in `STEP-0314`; additional live probes and uploads — `NOT_RUN`.
 - Ограничения/остаток: build does not establish new-graph provider compatibility or explain the live `must not be null` failure.
 - Следующий шаг: выполнить `npm.cmd run test:acceptance:offline`.

### STEP-0316 — 2026-09-08 — post-probe offline acceptance PASS

 - Пакет и статус: L08 / `LIVE_PENDING`; локальная regression suite остаётся зелёной после failed live probe.
 - Изменения и назначение: runtime behavior не изменялся; все offline suites и MCP stdio transport проверены на текущем workspace.
 - Файлы/модули: generated `dist/`; `PROGRESS.md`.
 - Проверки: `npm.cmd run test:acceptance:offline` — `PASS`: unit 4, contract 2, graph 8, L03 4, L04 4, L05 20, L06 7, L07 12, MCP 1; всего 62 tests, 0 failures. SQLite experimental warnings ожидаемы. New live probes, retry, upload пользовательских данных и внешние изменения — `NOT_RUN`.
 - Ограничения/остаток: offline PASS не доказывает new-graph cloud acceptance; `L08-LIVE-002` остаётся `LIVE_PENDING` из-за `LIVE_FAIL: must not be null` без task ID/output.
 - Следующий шаг: выполнить `git diff --check` и завершить текущий пункт без перехода к следующему L08 case.

### STEP-0317 — 2026-09-08 — new-graph probe handoff after local checks

 - Пакет и статус: L08 / `LIVE_PENDING`; выбранный единственный new-graph case остановлен после фактического failure и обязательных локальных проверок.
 - Изменения и назначение: синхронизированы `ACCEPTANCE.md` и журнал live evidence; продуктовые исходники не менялись, старый `SUBMIT_UNKNOWN` не retried и новые live cases не запускались.
 - Файлы/модули: `PROGRESS.md`, `ACCEPTANCE.md`; generated `dist/` rebuilt by the checks.
 - Проверки: `npm.cmd run test:live -- --new-graph --workflow-id 2097177175284154370 --timeout-ms 300000` — `FAIL`, exit 1, `LIVE_FAIL: must not be null`; `npm.cmd run typecheck` — `PASS`; `npm.cmd run build` — `PASS`; `npm.cmd run test:acceptance:offline` — `PASS`, 62/62; `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings. Upload пользовательских данных, retry, cancel и внешние изменения — `NOT_RUN`.
 - Ограничения/остаток: `L08-LIVE-002` не доказан и не опровергнут как provider execution — harness не вывел `LIVE_NEW_GRAPH_SUBMIT`, task ID и output. Нельзя считать case `PASS` и нельзя повторять платный probe автоматически.
 - Следующий шаг: отдельное решение о диагностике/исправлении причины `must not be null` и новом single-scope live run; до этого не начинать следующий L08 case.

### STEP-0318 — 2026-09-08 — diagnosed missing RunningHub workflow anchor

 - Пакет и статус: L08 / `IN_PROGRESS`; причина live failure установлена, исправление ограничено текущим full-graph probe.
 - Причина: `scripts/test-live.mjs` создавал `runNewGraphProbe` без `provider_workflow_id`, поэтому `WorkflowApiClient` отправлял `POST /task/openapi/create` без `workflowId`. RunningHub отвечает `must not be null`, потому что его create contract требует `workflowId`; полный `workflow` является override, а не заменой обязательного anchor ID.
 - Доказательства: локальный submit path `src/backends/workflow-api/client.ts`, live harness `scripts/test-live.mjs`, deterministic route tests `tests/execution/l05.test.mjs`, официальный RunningHub Advanced Create contract: `https://pre.runninghub.ai/runninghub-api-doc-en/api-425761092`.
 - Изменения до исправления: runtime product code не изменён; новый live submit после диагностического failure ещё `NOT_RUN`, upload пользовательских данных и внешние изменения — `NOT_RUN`.
 - Ограничения/остаток: после fix это будет acceptance full-graph override с provider workflow anchor, не доказательство provider режима «без workflowId»; старый `SUBMIT_UNKNOWN` не будет retried.
 - Следующий шаг: минимально исправить `runNewGraphProbe`, tests/docs/acceptance и выполнить локальные проверки перед одним новым разрешённым live probe.

### STEP-0319 — 2026-09-08 — full-graph anchor fix applied

 - Пакет и статус: L08 / `IN_PROGRESS`; исправление текущего probe внесено, локальные проверки ещё не выполнены.
 - Изменения и назначение: `runNewGraphProbe` теперь передаёт `provider_workflow_id` равным выбранному source workflow ID, поэтому adapter отправляет `workflowId` вместе с полным exported graph; marker/acceptance/readme больше не обещают режим без anchor ID. Добавлен offline regression test на route и body.
 - Файлы/модули: `scripts/test-live.mjs`, `tests/execution/l05.test.mjs`, `README.md`, `ACCEPTANCE.md`, `PROGRESS.md`.
 - Проверки: source edit complete; `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run test:l05`, full offline acceptance и fixed live probe — `NOT_RUN` на момент записи. Upload пользовательских данных, retry старого submit, cancel и другие live cases — `NOT_RUN`.
 - Ограничения/остаток: fix проверяет provider-supported full-graph override, а не обход обязательного `workflowId`; новый submit будет выполнен только после локальных regression checks.
 - Следующий шаг: выполнить `npm.cmd run typecheck`, `npm.cmd run build` и `npm.cmd run test:l05`.

### STEP-0320 — 2026-09-08 — full-graph anchor fix typecheck PASS

 - Пакет и статус: L08 / `IN_PROGRESS`; fixed probe source compiles.
 - Изменения и назначение: проверена типовая совместимость добавленного `provider_workflow_id` в ephemeral plan и обновлённого regression test.
 - Файлы/модули: `scripts/test-live.mjs`, `tests/execution/l05.test.mjs`, related source, `PROGRESS.md`.
 - Проверки: `npm.cmd run typecheck` — `PASS`, exit code 0. Build, L05 tests, full offline acceptance и live probe — `NOT_RUN`.
 - Ограничения/остаток: typecheck не доказывает RunningHub acceptance.
 - Следующий шаг: выполнить `npm.cmd run build`.

### STEP-0321 — 2026-09-08 — full-graph anchor fix build PASS

 - Пакет и статус: L08 / `IN_PROGRESS`; emitted runtime contains the full-graph anchor fix.
 - Изменения и назначение: rebuilt `dist/` from the corrected live harness and adapter sources; no provider request was made by the build.
 - Файлы/модули: generated `dist/`; `scripts/test-live.mjs`, `tests/execution/l05.test.mjs`, `PROGRESS.md`.
 - Проверки: `npm.cmd run build` — `PASS`, exit code 0; typecheck — `PASS` in `STEP-0320`; L05 tests, full offline acceptance and live probe — `NOT_RUN`.
 - Ограничения/остаток: build does not establish provider task creation or outputs.
 - Следующий шаг: выполнить `npm.cmd run test:l05`.

### STEP-0322 — 2026-09-08 — full-graph anchor fix targeted regression PASS

 - Пакет и статус: L08 / `IN_PROGRESS`; corrected full-graph submit contract passes targeted offline regression.
 - Изменения и назначение: verified the client selects the numeric workflow route and includes the same `workflowId` in the request body while preserving the full graph payload; durable single-submit/recovery tests remain green.
 - Файлы/модули: `tests/execution/l05.test.mjs`, `scripts/test-live.mjs`, `src/backends/workflow-api/client.ts`, `PROGRESS.md`; `dist/` rebuilt by the test script.
 - Проверки: `npm.cmd run test:l05` — `PASS`, 20/20, exit code 0; SQLite experimental warning ожидаем. Full offline acceptance and fixed live probe — `NOT_RUN`.
 - Ограничения/остаток: targeted synthetic evidence does not prove provider acceptance; exactly one fixed live probe remains to run.
 - Следующий шаг: выполнить `npm.cmd run test:live -- --new-graph --workflow-id 2097177175284154370 --timeout-ms 300000` с user-level env.

### STEP-0323 — 2026-09-08 — anchored live submit accepted, provider execution failed

 - Пакет и статус: L08 / `IN_PROGRESS`; fix passed provider submit, but the resulting task failed during execution.
 - Изменения и назначение: one fixed full-graph probe submitted the exported local graph with provider workflow anchor `2097177175284154370`; RunningHub returned task `2097354717095534593`. No second submit was made.
 - Файлы/модули: `PROGRESS.md`; runtime source unchanged during the live run.
 - Проверки: fixed `npm.cmd run test:live -- --new-graph --workflow-id 2097177175284154370 --timeout-ms 300000` — submit `PASS` (`LIVE_FULL_GRAPH_SUBMIT`, task ID above), final execution `FAIL` (`execution_state=FAILED`, `artifact_state=FAILED`). Provider error details — `NOT_RUN` and require read-only status/recovery; upload, retry, cancel and other live cases — `NOT_RUN`.
 - Ограничения/остаток: the missing-anchor error is fixed, but the full graph currently fails provider execution; do not retry submit until the existing task's failure reason is inspected.
 - Следующий шаг: perform read-only recovery/status for task `2097354717095534593` without creating another task.

### STEP-0324 — 2026-09-08 — provider failure diagnosed and alternate workflow selected

 - Пакет и статус: L08 / `IN_PROGRESS`; failed task is diagnosed, no retry of its submit is allowed.
 - Доказательства: read-only `/openapi/v2/query` for task `2097354717095534593` returned `state=FAILED`, provider `errorCode=805`, `failedReason.node_id=131`, `LoraLoaderModelOnly`, and `exception_message` identifying corrupt/incomplete `kaguya_style_qwen2512.safetensors`. Read-only workflow inspection found 17 LoRA nodes in `2097177175284154370` and one different LoRA node in `2095706794198106113`.
 - Изменения и назначение: no user assets, provider workflow files, or existing task state were modified. The next probe is scoped to the alternate previously known workflow `2095706794198106113` using the corrected full-graph-anchor harness.
 - Проверки: existing-task status and workflow JSON inspections — `PASS` (read-only); second submit/status/output flow — `NOT_RUN`; retry of task `2097354717095534593`, upload пользовательских данных, cancel and other workflows — `NOT_RUN`.
 - Ограничения/остаток: alternate workflow may still fail for provider-specific reasons; if it does, preserve the task outcome and do not blind retry.
 - Следующий шаг: execute one corrected `--new-graph` probe for workflow `2095706794198106113`.

### STEP-0325 — 2026-09-08 — corrected full-graph live probe PASS

 - Пакет и статус: L08 / `IN_PROGRESS`; выбранный full-graph override probe завершён успешно.
 - Изменения и назначение: corrected harness submitted the freshly imported/exported local graph with required provider anchor workflow `2095706794198106113`; one provider task `2097355536163414018` reached successful output readiness. No user assets were uploaded and no failed task was retried.
 - Файлы/модули: `PROGRESS.md`, `ACCEPTANCE.md`; runtime source remained unchanged during polling.
 - Проверки: `npm.cmd run test:live -- --new-graph --workflow-id 2095706794198106113 --timeout-ms 300000` — `PASS`: `LIVE_FULL_GRAPH_SUBMIT` followed by `LIVE_PASS: full_graph_override=true ... output_ready=true`. Additional live cases, upload, cancel and external changes — `NOT_RUN`.
 - Ограничения/остаток: evidence proves full-graph override with a required provider workflow anchor for workflow `2095706794198106113`; it does not prove provider execution without `workflowId`, nor repair the corrupt LoRA in workflow `2097177175284154370`.
 - Следующий шаг: run full offline acceptance and `git diff --check`, then stop this selected live correction path.

### STEP-0326 — 2026-09-08 — post-live full offline regression PASS

 - Пакет и статус: L08 / `IN_PROGRESS`; successful full-graph live evidence remains green under the complete local regression suite.
 - Изменения и назначение: no additional runtime behavior changed after the successful live task; generated runtime was rebuilt by the suite.
 - Файлы/модули: `dist/`; `PROGRESS.md`.
 - Проверки: `npm.cmd run test:acceptance:offline` — `PASS`: unit 4, contract 2, graph 8, L03 4, L04 4, L05 20, L06 7, L07 12, MCP 1; всего 62 tests, 0 failures. SQLite experimental warnings ожидаемы. Additional live submit, retry, upload, cancel and external changes — `NOT_RUN`.
 - Ограничения/остаток: first workflow `2097177175284154370` remains provider-failed because of its corrupt LoRA; acceptance PASS applies only to full-graph override on `2095706794198106113`.
 - Следующий шаг: выполнить `git diff --check` и завершить исправление текущего live path.

### STEP-0327 — 2026-09-08 — full-graph live correction handoff complete

 - Пакет и статус: L08 / `LOCAL_DONE`; corrected full-graph live path and its selected successful probe are complete; no next L08 case started.
 - Изменения и назначение: RunningHub-required workflow anchor is now included in the full-graph probe; acceptance evidence records successful submit/status/output for workflow `2095706794198106113`. The original workflow's corrupt LoRA failure is documented and was not retried.
 - Файлы/модули: `scripts/test-live.mjs`, `tests/execution/l05.test.mjs`, `README.md`, `ACCEPTANCE.md`, `PROGRESS.md`; `dist/` rebuilt. Existing workspace changes were preserved.
 - Проверки: `npm.cmd run typecheck` — `PASS`; `npm.cmd run build` — `PASS`; `npm.cmd run test:l05` — `PASS`, 20/20; corrected live probe — `PASS`, task `2097355536163414018`, `output_ready=true`; `npm.cmd run test:acceptance:offline` — `PASS`, 62/62; `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings. User-data upload, retry, cancel and additional live cases — `NOT_RUN`.
 - Ограничения/остаток: `L08-LIVE-002` evidence is scoped to workflow/profile `2095706794198106113` and required provider anchor; provider execution without `workflowId` remains unsupported, and workflow `2097177175284154370` still has a corrupt provider LoRA.
 - Следующий шаг: остановиться на завершённом full-graph correction path; не запускать новый submit автоматически.

### STEP-0328 — 2026-09-08 — Workflow API contracts and preflight repair

 - Пакет и статус: L08 / `IN_PROGRESS`; исправлены выявленные контракты в source и runtime package `rhcomfy-mcp`.
 - Изменения и назначение: разделены legacy/V2 upload adapters; legacy multipart теперь передаёт `apiKey`, `fileType=input`, `file`, а V2 использует отдельный `/openapi/v2/media/upload/binary`. Числовой workflow ID с image overrides идёт через `/openapi/v2/run/workflow/{id}` только с `nodeInfoList`; full graph остаётся явной legacy-веткой. Добавлены nested provider-error parsing, no-taskId failure/charge tracking, sanitized request logging, remote `Get Workflow JSON` preflight и durable workflow states `uninitialized`/`ready`/`failed_validation`.
 - Файлы/модули: `src/backends/workflow-api/client.ts`, `src/execution/types.ts`, `src/execution/runner.ts`, `src/storage/database.ts`, `src/config.ts`, `src/mcp/server.ts`, `src/errors.ts`, `scripts/test-live.mjs`, tests/docs; rebuilt `dist/` and synchronized `rhcomfy-mcp/dist/`.
 - Проверки: `npm.cmd run build` — `PASS`; `npm.cmd run test:acceptance:offline` — `PASS`, 66/66; focused L05 contract tests — `PASS`, 24/24. Live paid submit — `NOT_RUN`.
 - Ограничения/остаток: account capability and provider acceptance for the new V2 image-override path remain unverified; no API key or user asset was logged or sent by these checks.
 - Следующий шаг: preserve the runtime package and stop before any paid live probe unless the user explicitly authorizes a specific workflow and attempt.

### STEP-0329 — 2026-09-08 — explicit submit-mode boundary verified

 - Пакет и статус: L08 / `IN_PROGRESS`; final contract refinement is complete.
 - Изменения и назначение: numeric provider IDs now default to V2 even with an empty `nodeInfoList`; legacy full-graph submissions require persisted `provider_submit_mode=legacy_graph`. Added SQLite migration for the submit mode and marked the live harness’s graph-edit probes explicitly legacy.
 - Файлы/модули: `src/backends/workflow-api/client.ts`, `src/execution/runner.ts`, `src/execution/schemas.ts`, `src/execution/types.ts`, `src/mcp/server.ts`, `src/storage/database.ts`, `scripts/test-live.mjs`, `tests/unit/storage.test.mjs`; rebuilt and synchronized `dist/` and `rhcomfy-mcp/dist/`.
 - Проверки: `npm.cmd run build` — `PASS`; unit — `PASS`, 4/4; L05 — `PASS`, 24/24; final full offline acceptance — `PASS`, 66/66. `git diff --check` — `PASS` with expected LF→CRLF warnings. Live paid submit — `NOT_RUN`.
 - Ограничения/остаток: live account capability for V2 `nodeInfoList` image overrides remains unverified; no automatic retry or paid request was performed.

### STEP-0330 — 2026-09-08 — final provider-code normalization

 - Пакет и статус: L08 / `IN_PROGRESS`; final deterministic error normalization is complete.
 - Изменения и назначение: successful provider codes `0`/`200` are no longer treated as error text; missing-task and nested validation classification remains intact. Runtime `rhcomfy-mcp/dist` was synchronized again.
 - Проверки: `npm.cmd run build` — `PASS`; final targeted L05 suite — `PASS`, 24/24; `git diff --check` — `PASS` with expected LF→CRLF warnings. Full offline suite had passed 66/66 immediately before this narrow normalization; live paid submit — `NOT_RUN`.
 - Ограничения/остаток: no provider request, upload, retry, or user-data operation was made during this repair.

### STEP-0331 — 2026-09-08 — runtime installation package synchronized

 - Пакет и статус: L08 / `LOCAL_DONE`; установочный пакет `rhcomfy-mcp` обновлён до текущего production build.
 - Изменения и назначение: синхронизированы `dist/`, README, pinned catalog data и upstream license; runtime `package.json`/`package-lock.json` сохранены в минимальном installable формате.
 - Проверки: все 120 файлов `dist/` совпадают с root build; package `npm ci --dry-run` — PASS, 90 packages; package startup/config smoke check — PASS; live network — `NOT_RUN`.

### STEP-0332 — 2026-09-08 — Codex MCP registration complete

 - Пакет и статус: L08 / `LOCAL_DONE`; `runninghub-mcp` зарегистрирован глобально в локальном Codex как stdio MCP server.
 - Конфигурация: Codex запускает `C:\Program Files\nodejs\node.exe` с `C:\Users\Admin\Documents\runninghub-mcp\rhcomfy-mcp\dist\index.js`; API key в конфигурацию не добавлялся.
 - Проверки: `codex mcp get runninghub-mcp` — enabled/stdio; `codex mcp list` — сервер присутствует. Live network — `NOT_RUN`.
 - Ограничения: текущая Codex-сессия может увидеть новый MCP только после перезапуска или открытия новой сессии.

### STEP-0333 — 2026-09-10 — полный regression/live аудит и финальный repair pass

 - Пакет и статус: L08 / `LOCAL_DONE`; текущая source/runtime сборка проверена локально и через разрешённые scoped live probes.
 - Исправления: catalog payload validation теперь отклоняет пустые обязательные массивы, unsafe integers, non-finite numbers, нарушенные min/max/step и превышение `maxLength`; `SUBMITTING`/`SUBMIT_UNKNOWN` больше не освобождаются локальным cancel; uncertain submit сохраняется и выдаёт структурированный recovery guidance; provider outputs без usable download URL игнорируются; `resolveScene` сначала проверяет существование проекта. Live harness получил корректный V2 submit route для run/cancel.
 - Проверки offline: `npm.cmd run test:acceptance:offline` — `PASS`, 72/72 (0 failures); `npm.cmd run typecheck` — `PASS`; `node --check scripts/test-live.mjs` — `PASS`; `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings.
 - Проверки live с явным разрешением платных операций: upload/cache — `PASS`; V2 submit/status/outputs — `PASS`, task `2098125028374646786`; cancel — `PASS`, task `2098126162275373058`; result download + `resources/read` — `PASS`; legacy 2-second video — `PASS`, task `2098128004452995073`; fresh full-graph override — `PASS`, task `2098129242187911170`. Повторных submit после неизвестного результата не выполнялось; ключи, signed URLs и private payloads не выводились.
 - Runtime: после финального build все 120 файлов `dist/` побайтно совпадают с `rhcomfy-mcp/dist/`.
 - Ограничения: evidence остаётся scoped к настроенному профилю и указанным workflow; account-wide совместимость, естественный expiry и реальная LoRA-доступность не заявляются подтверждёнными. Платные provider tasks остаются в истории RunningHub согласно их lifecycle.
