# Текущий прогресс реализации MCP RunningHub

Последнее обновление: 2026-09-07.

Спецификация: [RUNNINGHUB_MCP_IMPLEMENTATION_PLAN.md](RUNNINGHUB_MCP_IMPLEMENTATION_PLAN.md), редакция 2.
Полная хронология: [docs/progress-archive-2026-09-07.md](docs/progress-archive-2026-09-07.md). Архив read-only; активным журналом является только этот файл.

## Текущее состояние

- L00–L04: `LOCAL_DONE`.
- L05: `LIVE_PENDING`. Durable execution, recovery, upload/cache, status/output/cancel и structural graph flow реализованы. Scoped live evidence получена для submit/status/output/upload/structural graph/cancel, active workflow и unknown-task not-found reconciliation.
- L06: `IN_PROGRESS` — подпункты result download, MCP resource link, local derived image preview/video poster и manifests/outbox `LOCAL_DONE`; read-only live verification существующего output/resource path `PASS`: provider outputs скачиваются в локальные оригиналы с атомарной записью и MIME/container validation, а сохранённые результаты, derivatives и local manifest publication доступны через opaque MCP resource links/metadata. Review loop не реализован.
- L07: `TODO` — LoRA upload/bindings, media rules, cache expiry и server instructions.
- L08: `TODO` — финальная live acceptance и проверка поставки.

## Что Проверено

- `npm.cmd run typecheck` — PASS.
- `npm.cmd run build` — PASS.
- `npm.cmd run test:acceptance:offline` — PASS, 38 тестов.
- Active live probe workflow `2087104558464446466` — PASS; provider task `2097126350429659137` завершена с `outputs_ready=true`.
- Output query — `SUCCESS`, один MP4 output; URL не хранится в журнале.
- Read-only live `rh_get_results` + `resources/read` — PASS; output сохранён как `video/quicktime`, URL не хранится в журнале.
- Не проверены: natural expiry существующей задачи, account-wide compatibility, live preview/poster/manifest compatibility и review loop.

## Правила Сессии

1. В начале сессии читать этот файл; архив открывать только для исторического контекста.
2. После существенного шага обновлять этот файл: изменения, файлы, проверки, ограничения и следующий шаг.
3. Live API, платные генерации, пользовательские assets и внешние изменения выполнять только при явном разрешении.
4. Не выдавать synthetic/mock/offline evidence за live evidence.

## Handoff

- Текущий пакет: L06 / `IN_PROGRESS`; result download, resource link, local derived preview/poster и manifests/outbox завершены локально, read-only live result/resource verification завершена.
- Следующий шаг: в отдельной задаче выбрать review events/manifest review state как следующий L06 подпункт; автоматически его не начинать.
- Repository bootstrap: commits `0ac69e9` и `9871e60`; после текущей архивации документационные изменения ещё не закоммичены.

### STEP-0101 — 2026-09-07 — compact active progress journal

- Пакет и статус: repository documentation / `LOCAL_DONE`.
- Изменения и назначение: полная история до STEP-0100 перенесена в `docs/progress-archive-2026-09-07.md`; этот файл сокращён до текущего handoff, package status и обязательных правил. План обновлён под active journal + immutable archive.
- Файлы/модули: `PROGRESS.md`, `docs/progress-archive-2026-09-07.md`, `RUNNINGHUB_MCP_IMPLEMENTATION_PLAN.md`.
- Проверки: archive link и отсутствие рабочих Markdown-ссылок на `LUNA_START_HERE.md` — PASS; архив содержит 1084 строки и STEP-0100; `git diff --check` — PASS. Typecheck/build — `NOT_RUN`, поскольку изменение документационное.
- Ограничения/остаток: изменения ещё не закоммичены; архив намеренно не является вторым активным журналом.
- Следующий шаг: при необходимости создать отдельный commit компактного журнала и архива.

### STEP-0102 — 2026-09-07 — выбран один локальный подпункт L06

- Пакет и статус: L06 / `IN_PROGRESS`.
- Изменения и назначение: выбран только result download: получить outputs уже существующей provider task, проверить URL/MIME и распознаваемый media container, атомарно сохранить оригиналы в output root проекта и сделать повтор загрузки безопасным. Preview, manifest/outbox, review и chain gate не начинаются.
- Файлы/модули: на момент записи изменён только `PROGRESS.md`; исходники и provider/project state не изменялись.
- Проверки: реализация и проверки — `NOT_RUN`; live API, submit, upload, cancel и пользовательские assets не выполняются.
- Ограничения/остаток: result records/download service и MCP tool ещё не созданы; signed URL не должен попадать в журнал.
- Следующий шаг: добавить локальный durable result-download service, storage records и один MCP tool, затем выполнить offline tests через stdio transport.

### STEP-0103 — 2026-09-07 — добавлен локальный result download path

- Пакет и статус: L06 / `IN_PROGRESS`.
- Изменения и назначение: добавлена SQLite migration для локальных result records; `ResultDownloadService` получает outputs без submit, принимает provider bytes или скачивает URL без auth-заголовка, проверяет redirect host/scheme, лимит размера, MIME и PNG/JPEG/WebP/MP4/MOV/WAV/MP3 container structure, затем атомарно сохраняет оригинал под project output root. Повтор для целого output использует hash-проверенную запись.
- Файлы/модули: `src/storage/database.ts`, `src/execution/results.ts`, `src/execution/schemas.ts`, `src/mcp/server.ts`.
- Проверки: `NOT_RUN` — после изменения ещё не выполнены typecheck/build/tests; сеть, submit, upload, cancel и live API не использовались.
- Доказательства: пока только исходный контракт реализации; signed URL и provider response не сохраняются в result row/ответе MCP.
- Ограничения/остаток: preview, manifests/outbox, review и chain gate не реализуются; нужны offline service и MCP-transport tests, затем typecheck/build.
- Следующий шаг: добавить тесты успешной загрузки, повторной загрузки без submit, invalid MIME/container и вызова `rh_get_results` через MCP transport.

### STEP-0104 — 2026-09-07 — исправлены ошибки строгой типизации result download

- Пакет и статус: L06 / `IN_PROGRESS`.
- Изменения и назначение: уточнено narrowing для MP3 frame bytes и сохранён nullable `content-type` в локальную переменную перед MIME validation.
- Файлы/модули: `src/execution/results.ts`, `PROGRESS.md`.
- Проверки: предыдущий `npm.cmd run typecheck` — `FAIL` только по 3 strict TypeScript diagnostics в этих строках; после исправления повторная проверка — `NOT_RUN`.
- Ограничения/остаток: offline tests и build ещё не запускались; внешний API не затрагивался.
- Следующий шаг: повторить typecheck, затем добавить и запустить L06 offline tests.

### STEP-0105 — 2026-09-07 — уточнена nullable MIME граница

- Пакет и статус: L06 / `IN_PROGRESS`.
- Изменения и назначение: `textMime` теперь принимает `null`, который реально возвращает `Headers.get`, без ослабления MIME validation.
- Файлы/модули: `src/execution/results.ts`, `PROGRESS.md`.
- Проверки: повторный typecheck после STEP-0104 выявил один оставшийся strict diagnostic на `Headers.get`; после этого точечного исправления typecheck — `NOT_RUN`.
- Ограничения/остаток: tests/build и MCP transport check ещё не запускались; live API не использовался.
- Следующий шаг: повторить `npm.cmd run typecheck`, затем перейти к offline tests.

### STEP-0106 — 2026-09-07 — typecheck result download PASS

- Пакет и статус: L06 / `IN_PROGRESS`.
- Изменения и назначение: строгая компиляция нового storage/service/MCP tool path прошла без ошибок.
- Файлы/модули: `src/storage/database.ts`, `src/execution/results.ts`, `src/execution/schemas.ts`, `src/mcp/server.ts`; `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — `PASS`. Build, L06 tests и полный offline acceptance — `NOT_RUN`; live API, submit, upload, cancel и пользовательские assets не выполнялись.
- Ограничения/остаток: нужны tests для container validation, atomic persistence/retry и MCP tool; preview, manifests/outbox, review и chain gate остаются вне выбранного подпункта.
- Следующий шаг: добавить offline tests и обновить test scripts только для выбранного result-download подпункта.

### STEP-0107 — 2026-09-07 — исправлена проверка PNG IHDR

- Пакет и статус: L06 / `IN_PROGRESS`.
- Изменения и назначение: исправлены offsets compression/filter/interlace в PNG IHDR validation; прежняя версия ошибочно читала байты CRC вместо полей контейнера.
- Файлы/модули: `src/execution/results.ts`, `PROGRESS.md`.
- Проверки: после исправления typecheck — `NOT_RUN`; тесты ещё не добавлены. Live API и внешние изменения не выполнялись.
- Ограничения/остаток: требуется покрыть valid/invalid media bytes тестами, чтобы зафиксировать container contract.
- Следующий шаг: добавить L06 offline tests, включая валидный PNG и отклонение повреждённого/несовместимого output.

### STEP-0108 — 2026-09-07 — добавлены offline проверки result download

- Пакет и статус: L06 / `IN_PROGRESS`.
- Изменения и назначение: добавлен `test:l06`; тесты покрывают атомарное сохранение и повтор без submit, отклонение MIME/container mismatch и вызов `rh_get_results` через MCP InMemoryTransport с локальным HTTP fixture. В transport test сервер получает output URL, но submit endpoint не вызывается.
- Файлы/модули: `tests/results/l06.test.mjs`, `package.json`, `PROGRESS.md`.
- Проверки: после добавления тестов `npm.cmd run build` и `npm.cmd run test:l06` — `NOT_RUN`; live API и пользовательские данные не используются.
- Ограничения/остаток: тестовый HTTP fixture синтетический и не доказывает provider compatibility; preview, manifests/outbox, review и chain gate не реализуются.
- Следующий шаг: выполнить build и `test:l06`, исправить только regressions выбранного подпункта.

### STEP-0109 — 2026-09-07 — build result download PASS

- Пакет и статус: L06 / `IN_PROGRESS`.
- Изменения и назначение: production build сформировал актуальный `dist` для нового result-download сервиса, migration и MCP tool.
- Файлы/модули: rebuilt `dist/` из `src/execution/results.ts`, `src/storage/database.ts`, `src/mcp/server.ts` и связанных исходников; `PROGRESS.md`.
- Проверки: `npm.cmd run build` — `PASS`. `npm.cmd run test:l06` и полный offline acceptance — `NOT_RUN`; live API не использовался.
- Ограничения/остаток: synthetic/local HTTP test ещё не выполнен; остальные L06 подпункты не начинаются.
- Следующий шаг: запустить `npm.cmd run test:l06`.

### STEP-0110 — 2026-09-07 — найден MCP transport regression

- Пакет и статус: L06 / `IN_PROGRESS`.
- Изменения и назначение: первые два result-download tests прошли; MCP transport test получил `isError=true`, поэтому добавлена временная диагностическая причина в assertion, без изменения runtime кода и без внешнего запроса.
- Файлы/модули: `tests/results/l06.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:l06` — `FAIL`: 2 PASS, 1 FAIL; ошибка обнаружена на `result.isError` в MCP tool case. Build внутри команды — `PASS`; live API и submit/upload/cancel не выполнялись.
- Ограничения/остаток: причина находится в structured payload следующего запуска; preview, manifests/outbox, review и chain gate не начинаются.
- Следующий шаг: повторить test:l06 с диагностикой, исправить локальную причину и убрать диагностический текст после PASS.

### STEP-0111 — 2026-09-07 — исправлен synthetic MCP URL

- Пакет и статус: L06 / `IN_PROGRESS`.
- Изменения и назначение: локальный HTTP fixture переведён с `127.0.0.1` на разрешённый test host `localhost`, соответствующий существующему guard Workflow API и result redirect validation. Runtime production policy не ослаблялась.
- Файлы/модули: `tests/results/l06.test.mjs`, `PROGRESS.md`.
- Проверки: предыдущий `test:l06` выявил `INVALID_CONFIGURATION` до HTTP вызова; после этого test fix повторная проверка — `NOT_RUN`. Live API и provider state не затрагивались.
- Ограничения/остаток: диагностический assertion text нужно убрать после успешного transport test.
- Следующий шаг: повторить `npm.cmd run test:l06`.

### STEP-0112 — 2026-09-07 — L06 offline tests PASS

- Пакет и статус: L06 / `IN_PROGRESS`.
- Изменения и назначение: после исправления localhost fixture выполнены все три выбранных проверки; временная диагностическая строка удалена, а существующий stdio tool-list test дополнен `rh_get_results`.
- Файлы/модули: `tests/results/l06.test.mjs`, `tests/mcp/stdio.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:l06` — `PASS`, 3 tests, 0 failures; build внутри команды — `PASS`. SQLite experimental warning ожидаем. Typecheck и полный offline acceptance — `NOT_RUN` на этом шаге; live API, submit/upload/cancel и пользовательские assets не выполнялись.
- Доказательства: MCP transport test сохраняет валидный PNG, проверяет output query и media download, `submit=0`, отсутствие API key в ответе; повторная загрузка сервиса не создаёт второй result record.
- Ограничения/остаток: выбранный result-download подпункт требует общей regression-проверки; preview, manifests/outbox, review и chain gate остаются TODO.
- Следующий шаг: выполнить typecheck, build и полный `npm.cmd run test:acceptance:offline`, затем сверить итоговый журнал и остановиться.

### STEP-0113 — 2026-09-07 — итоговый typecheck PASS

- Пакет и статус: L06 / `IN_PROGRESS`.
- Изменения и назначение: TypeScript strict check после result-download implementation и MCP tool registration прошёл без diagnostics.
- Файлы/модули: `src/execution/results.ts`, `src/storage/database.ts`, `src/mcp/server.ts`, test updates; `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — `PASS`. Production build и полный offline acceptance — `NOT_RUN`; live API и внешние изменения не выполнялись.
- Ограничения/остаток: нужно завершить build и полный acceptance, затем зафиксировать выбранный подпункт без перехода к остальным L06 задачам.
- Следующий шаг: выполнить `npm.cmd run build`.

### STEP-0114 — 2026-09-07 — итоговый build PASS

- Пакет и статус: L06 / `IN_PROGRESS`.
- Изменения и назначение: production build собрал актуальные JS/declaration/source maps для result records, downloader и `rh_get_results`.
- Файлы/модули: rebuilt `dist/`; исходники `src/execution/results.ts`, `src/storage/database.ts`, `src/mcp/server.ts`; `PROGRESS.md`.
- Проверки: `npm.cmd run build` — `PASS`. Полный offline acceptance — `NOT_RUN`; live API, submit/upload/cancel и пользовательские assets не выполнялись.
- Ограничения/остаток: осталась общая offline regression; preview, manifests/outbox, review и chain gate не затрагиваются.
- Следующий шаг: выполнить `npm.cmd run test:acceptance:offline`.

### STEP-0115 — 2026-09-07 — обновлён migration unit expectation

- Пакет и статус: L06 / `IN_PROGRESS`.
- Изменения и назначение: unit fixture обновлён с migration/table counts `3/13` до `4/14` после добавления только необходимой `results` table. Это устраняет прежний `EBUSY`, который возникал в cleanup после assertion failure до `second.close()`.
- Файлы/модули: `tests/unit/storage.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:acceptance:offline` — `FAIL` на старом expectation в unit storage test; `typecheck`, `build`, `test:l06` — `PASS` до этой правки. Live API и внешние изменения не выполнялись.
- Ограничения/остаток: полный offline acceptance нужно повторить; выбранный result-download подпункт остаётся единственной текущей задачей.
- Следующий шаг: повторить `npm.cmd run test:acceptance:offline`.

### STEP-0116 — 2026-09-07 — offline acceptance PASS

- Пакет и статус: L06 / `IN_PROGRESS`.
- Изменения и назначение: полный offline acceptance после добавления result-download path прошёл; существующие unit, contract, graph, L03, L04, L05 и MCP suites регрессий не обнаружили.
- Файлы/модули: `src/execution/results.ts`, `src/storage/database.ts`, `src/execution/schemas.ts`, `src/mcp/server.ts`, `tests/results/l06.test.mjs`, `tests/mcp/stdio.test.mjs`, `tests/unit/storage.test.mjs`, `package.json`; `dist/` rebuilt; `PROGRESS.md`.
- Проверки: `npm.cmd run test:acceptance:offline` — `PASS`: unit 3, contract 2, graph 8, L03 4, L04 4, L05 14, L06 3, MCP 1; всего 35 tests, 0 failures. SQLite experimental warnings ожидаемы. Live API, submit/upload/cancel и пользовательские assets не выполнялись.
- Доказательства: L06 service and MCP tests validate one local PNG result, no duplicate submit, no duplicate result record, MIME/container rejection, atomic file path and no API key in MCP response.
- Ограничения/остаток: после этого шага добавлена дополнительная symlink-safe path check и синхронизированы README/capabilities; финальные checks после этих точечных изменений ещё `NOT_RUN`. Preview, manifests/outbox, review и chain gate не реализуются.
- Следующий шаг: повторить typecheck, build и `test:l06` после symlink/docs adjustment, затем завершить выбранный подпункт и остановиться.

### STEP-0117 — 2026-09-07 — symlink-safe result path typecheck PASS

- Пакет и статус: L06 / `IN_PROGRESS`.
- Изменения и назначение: strict compilation после realpath-based output-root/result checks и capabilities/README update прошла без diagnostics.
- Файлы/модули: `src/execution/results.ts`, `src/mcp/server.ts`, `README.md`; `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — `PASS`. Build, `test:l06` и final full acceptance — `NOT_RUN` после последнего изменения.
- Ограничения/остаток: выбранный подпункт почти завершён; нужно подтвердить runtime build и tests на финальном исходном состоянии.
- Следующий шаг: выполнить `npm.cmd run build`.

### STEP-0118 — 2026-09-07 — финальный build result download PASS

- Пакет и статус: L06 / `IN_PROGRESS`.
- Изменения и назначение: production build после symlink-safe path correction и capability documentation завершился без regressions.
- Файлы/модули: rebuilt `dist/`; `src/execution/results.ts`, `src/mcp/server.ts`, `README.md`; `PROGRESS.md`.
- Проверки: `npm.cmd run build` — `PASS`. Финальный `test:l06` и полный offline acceptance — `NOT_RUN` после последнего изменения.
- Ограничения/остаток: live API, submit/upload/cancel и пользовательские assets не выполнялись; preview, manifests/outbox, review и chain gate остаются вне выбранного подпункта.
- Следующий шаг: выполнить финальный `npm.cmd run test:acceptance:offline`.

### STEP-0119 — 2026-09-07 — result download подпункт завершён

- Пакет и статус: L06 / `LOCAL_DONE` для выбранного подпункта; весь L06 остаётся `IN_PROGRESS`.
- Изменения и назначение: `rh_get_results` получает подтверждённые provider outputs, скачивает их без повторного submit, валидирует URL/MIME и поддержанные media containers, атомарно сохраняет originals в project output root и повторно использует hash-проверенные local records. Добавлена migration `results`; API key/signed URL не попадают в result row или MCP response.
- Файлы/модули: `src/execution/results.ts`, `src/storage/database.ts`, `src/execution/schemas.ts`, `src/mcp/server.ts`, `tests/results/l06.test.mjs`, `tests/mcp/stdio.test.mjs`, `tests/unit/storage.test.mjs`, `package.json`, `README.md`, `PROGRESS.md`; rebuilt `dist/`.
- Проверки: `npm.cmd run typecheck` — `PASS`; `npm.cmd run build` — `PASS`; `npm.cmd run test:l06` — `PASS` (3 tests); `npm.cmd run test:acceptance:offline` — `PASS` (35 tests, 0 failures). SQLite experimental warnings ожидаемы. Live API/платный submit/upload/cancel, пользовательские assets и внешние изменения — `NOT_RUN` по правилу сессии.
- Доказательства: MCP transport test подтверждает локальный download через `rh_get_results`, MIME/container rejection, no duplicate submit (`submit=0`) и no API key in response; service retry не создаёт второй result record.
- Ограничения/остаток: preview/resource links, manifests/outbox, review events, changes-requested revisions, approval и chain gate ещё не реализованы; live result download для RunningHub отдельно не проверен и не подменён synthetic test.
- Следующий шаг: отдельно выбрать следующий L06 подпункт, начиная с preview/resource link; в этой сессии работа остановлена.

### STEP-0120 — 2026-09-07 — финальная проверка рабочего дерева

- Пакет и статус: L06 / `LOCAL_DONE` для выбранного result-download подпункта; работа остановлена по правилу сессии.
- Изменения и назначение: финальный список diff сверён; существующие пользовательские изменения `LUNA_START_HERE.md`, компактного `PROGRESS.md`, архива и плана не откатывались и не переписывались за пределами нужных записей.
- Файлы/модули: итоговый список см. в STEP-0119; добавленные runtime/test файлы сохранены без staging/commit.
- Проверки: `git diff --check` — `PASS`; Git сообщил только ожидаемые LF→CRLF warnings для изменённых текстовых файлов. `git status --short` подтверждает отсутствие commit/staging action; live API и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: весь L06 не завершён; preview/resource links, manifests/outbox, review и chain gate остаются TODO. Наличие synthetic MCP test не является live provider evidence.
- Следующий шаг: отдельно выбрать следующий L06 подпункт, начиная с preview/resource link; автоматически не начинать.

### STEP-0121 — 2026-09-07 — выбран первый подпункт preview/resource link

- Пакет и статус: L06 / `IN_PROGRESS`.
- Изменения и назначение: выбран только MCP resource link для уже скачанного локального результата. `rh_get_results` должен возвращать opaque URI без абсолютного пути и не встраивать большие бинарные данные в текстовый ответ; `resources/read` будет отдавать только соответствующий сохранённый файл после повторной проверки границ проекта. Производные preview/poster, manifests/outbox и review не начинаются.
- Файлы/модули: на момент записи изменён только `PROGRESS.md`; реализация и тесты ещё не изменялись.
- Проверки: реализация, typecheck, build и tests — `NOT_RUN`; live API, платные генерации, upload и пользовательские assets не выполняются.
- Ограничения/остаток: нужно добавить безопасный result resource template, lookup записи результата и MCP transport test на `resources/read`.
- Следующий шаг: реализовать resource link/read path и его offline transport test, затем обновить журнал.

### STEP-0122 — 2026-09-07 — добавлен локальный MCP resource link path

- Пакет и статус: L06 / `IN_PROGRESS`.
- Изменения и назначение: добавлен `runninghub://result/<result_id>` resource template. `rh_get_results` теперь возвращает MCP `resource_link` и opaque URI в данных результата; `resources/read` находит запись результата, проверяет canonical project root, symlink escape, размер и SHA-256, затем отдаёт сохранённый оригинал как MCP blob. Новая DB migration не нужна, добавлен lookup по result ID. Обновлены capability/README без заявления о derived preview/poster.
- Файлы/модули: `src/storage/database.ts`, `src/mcp/server.ts`, `README.md`, `docs/capabilities.md`, `PROGRESS.md`.
- Проверки: typecheck, build и transport tests после изменения — `NOT_RUN`; live API, платные генерации, upload/cancel и пользовательские assets не выполняются.
- Доказательства: пока только реализация SDK resource template; нужен offline MCP `resources/read` test с фактически сохранённым PNG.
- Ограничения/остаток: derived image/video preview, poster, manifests/outbox и review не реализуются в этом шаге; нужно проверить MCP resource protocol и исправить только связанные regressions.
- Следующий шаг: добавить/запустить offline test `rh_get_results` resource link + `resources/read`, затем выполнить typecheck.

### STEP-0123 — 2026-09-07 — resource link typecheck PASS

- Пакет и статус: L06 / `IN_PROGRESS`.
- Изменения и назначение: после добавления `ResourceTemplate`, result lookup и transport assertions строгая компиляция осталась чистой.
- Файлы/модули: `src/mcp/server.ts`, `src/storage/database.ts`, `tests/results/l06.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — `PASS`. Build и `npm.cmd run test:l06` — `NOT_RUN`; live API, платные генерации и пользовательские assets не выполнялись.
- Ограничения/остаток: runtime MCP `resources/read` ещё не подтверждён; derived preview/poster, manifests/outbox и review вне шага.
- Следующий шаг: запустить `npm.cmd run test:l06`.

### STEP-0124 — 2026-09-07 — L06 resource link test PASS

- Пакет и статус: L06 / `IN_PROGRESS`.
- Изменения и назначение: offline MCP transport test теперь вызывает `resources/read` по URI, который вернул `rh_get_results`, и проверяет MIME и точное содержимое ранее сохранённого PNG. Resource link не вызывает submit и не содержит API key.
- Файлы/модули: `tests/results/l06.test.mjs`, rebuilt `dist/`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:l06` — `PASS`: build PASS, 3 tests, 0 failures. SQLite experimental warning ожидаем. Live API, платные генерации, upload/cancel и пользовательские assets не выполнялись.
- Доказательства: test фактически читает MCP blob через `resources/read`, декодирует его и сравнивает с локальным output bytes.
- Ограничения/остаток: нужна общая offline regression после регистрации MCP resource template; derived preview/poster, manifests/outbox и review не реализуются.
- Следующий шаг: выполнить `npm.cmd run test:mcp` и полный `npm.cmd run test:acceptance:offline`, затем сверить документацию и журнал.

### STEP-0125 — 2026-09-07 — MCP stdio regression PASS

- Пакет и статус: L06 / `IN_PROGRESS`.
- Изменения и назначение: регистрация dynamic result resource не нарушила обычный stdio initialize/tools/list/call flow.
- Файлы/модули: rebuilt `dist/`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:mcp` — `PASS`: build PASS, 1 test, 0 failures. SQLite experimental warning ожидаем. Полный offline acceptance — `NOT_RUN`; live API и внешние изменения не выполнялись.
- Ограничения/остаток: требуется финальная общая offline regression; derived preview/poster, manifests/outbox и review остаются TODO.
- Следующий шаг: выполнить `npm.cmd run test:acceptance:offline`.

### STEP-0126 — 2026-09-07 — resource link offline acceptance PASS

- Пакет и статус: L06 / `LOCAL_DONE` для выбранного resource-link подпункта; весь L06 остаётся `IN_PROGRESS`.
- Изменения и назначение: полный offline acceptance подтвердил, что регистрация `runninghub://result/{result_id}` не ломает существующие graph/project/execution/MCP paths, а L06 transport test возвращает и читает локальный результат через MCP resource protocol.
- Файлы/модули: `src/mcp/server.ts`, `src/storage/database.ts`, `tests/results/l06.test.mjs`, `README.md`, `docs/capabilities.md`, `PROGRESS.md`; rebuilt `dist/`.
- Проверки: `npm.cmd run test:acceptance:offline` — `PASS`: unit 3, contract 2, graph 8, L03 4, L04 4, L05 14, L06 3, MCP 1; всего 35 tests, 0 failures. `npm.cmd run test:mcp` — `PASS` (1 test); `npm.cmd run test:l06` — `PASS` (3 tests); `npm.cmd run typecheck` — `PASS`. SQLite experimental warnings ожидаемы.
- Доказательства: `tests/results/l06.test.mjs` вызывает `rh_get_results`, получает `resource_link`, вызывает `resources/read`, проверяет `image/png` и exact PNG bytes; submit count остаётся `0`, API key не попадает в ответ.
- Ограничения/остаток: live result resource compatibility с конкретным MCP-клиентом не проверялась; live API, платные генерации, upload/cancel и пользовательские assets — `NOT_RUN`. Derived preview/poster, manifests/outbox и review loop ещё TODO.
- Следующий шаг: отдельно выбрать следующий L06 подпункт, начиная с derived preview/poster или manifest по актуальному handoff; автоматически его не начинать.

### STEP-0127 — 2026-09-07 — handoff после resource link

- Пакет и статус: L06 / `LOCAL_DONE` для result download и resource link; работа по выбранному подпункту остановлена.
- Изменения и назначение: активная сводка и handoff синхронизированы с проверенным состоянием: resource link завершён, следующий конкретный подпункт — derived preview/poster. Manifest/outbox, review и chain gate не начинались.
- Файлы/модули: `PROGRESS.md`.
- Проверки: журнал содержит PASS для `npm.cmd run typecheck`, `npm.cmd run test:l06`, `npm.cmd run test:mcp` и `npm.cmd run test:acceptance:offline`; `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings. После этой документационной правки runtime checks — `NOT_RUN` (код не менялся). Live API и внешние изменения — `NOT_RUN` по правилу сессии.
- Ограничения/остаток: resource link проверен синтетическим offline MCP transport, не конкретным live MCP-клиентом; derived preview/poster и следующие L06 подпункты остаются TODO.
- Следующий шаг: отдельно начать derived preview/poster; в этой сессии не начинать следующий пункт.

### STEP-0128 — 2026-09-07 — выбран read-only live probe для L06

- Пакет и статус: L06 / `IN_PROGRESS`; live verification of existing result path.
- Изменения и назначение: с явного разрешения пользователя выбран уже существующий provider task `2097126350429659137` из предыдущего live evidence. Probe использует только status/outputs, затем ephemeral MCP server проверит текущие `rh_get_results` и `resources/read`; новый submit, upload, cancel и пользовательские assets не нужны.
- Файлы/модули: на момент записи изменён только `PROGRESS.md`; runtime и provider state не изменялись.
- Проверки: read-only live probe и end-to-end result/resource check — `NOT_RUN`; ключ не выводить в журнал, signed URL и output URL не сохранять.
- Ограничения/остаток: существующий task может быть уже недоступен или output URL может истечь; это будет зафиксировано как live result, а не заменено offline evidence.
- Следующий шаг: выполнить `npm.cmd run test:live -- --task-id 2097126350429659137 --timeout-ms 30000` без повторной отправки.

### STEP-0129 — 2026-09-07 — live probe заблокирован отсутствующей конфигурацией

- Пакет и статус: L06 / `IN_PROGRESS`; live verification — `NOT_RUN`.
- Изменения и назначение: запущен read-only harness для существующего task `2097126350429659137`; harness остановился до создания backend client и до любого HTTP-запроса, потому что не обнаружил обязательную live-конфигурацию.
- Файлы/модули: `PROGRESS.md`.
- Проверки: `npm.cmd run test:live -- --task-id 2097126350429659137 --timeout-ms 30000` — `NOT_RUN`, сообщение harness: `configure RUNNINGHUB_WORKFLOW_API_KEY and RUNNINGHUB_LIVE_CASES=full`. SQLite warning появился только при загрузке модулей; provider API не вызывался, submit/upload/cancel не выполнялись.
- Ограничения/остаток: live probe нельзя честно пометить `PASS` без ключа и явного `RUNNINGHUB_LIVE_CASES=full`; signed URL и output URL не получены и не записывались.
- Следующий шаг: после настройки этих двух переменных повторить тот же read-only task probe, затем отдельно проверить `rh_get_results` + `resources/read` на ephemeral project.

### STEP-0130 — 2026-09-07 — live env не виден процессу probe

- Пакет и статус: L06 / `IN_PROGRESS`; live verification — `NOT_RUN`.
- Изменения и назначение: после сообщения пользователя о настроенных переменных их наличие повторно проверено в том же PowerShell-процессе инструмента; значения не выводились и не сохранялись.
- Файлы/модули: `PROGRESS.md`.
- Проверки: безопасная проверка окружения показала `RUNNINGHUB_WORKFLOW_API_KEY=MISSING` и `RUNNINGHUB_LIVE_CASES=MISSING`; HTTP/API вызовов и submit не было.
- Ограничения/остаток: live probe нельзя запустить из текущего процесса, пока переменные не попадут в окружение процесса tool runner. Ключ в чат и журнал не запрашивается.
- Следующий шаг: повторить команду из STEP-0128 в окружении, видимом tool runner; после `LIVE_PASS` выполнить ephemeral `rh_get_results` + `resources/read` проверку.

### STEP-0131 — 2026-09-07 — live env найден в профиле пользователя

- Пакет и статус: L06 / `IN_PROGRESS`; live verification — `NOT_RUN` на момент записи.
- Изменения и назначение: проверено наличие обязательных переменных без вывода значений: в текущем process environment обе отсутствуют, в Windows User environment обе заданы. Код проекта и конфигурационные файлы не изменялись.
- Файлы/модули: `PROGRESS.md`.
- Проверки: безопасная проверка окружения — `Process: key=MISSING, cases=MISSING; User: key=SET, cases=SET; Machine: key=MISSING, cases=MISSING`; live API, submit, upload, cancel и пользовательские assets пока `NOT_RUN`.
- Ограничения/остаток: ключ нельзя сохранять в журнале или передавать через файлы; для разрешённого read-only probe нужна одноразовая передача значений из User environment дочернему процессу.
- Следующий шаг: выполнить только read-only `npm.cmd run test:live -- --task-id 2097126350429659137 --timeout-ms 30000`, не повторяя submit/upload/cancel; затем зафиксировать фактический результат.

### STEP-0132 — 2026-09-07 — read-only recovery probe PASS

- Пакет и статус: L06 / `IN_PROGRESS`; live verification — `PASS` для восстановления существующей задачи.
- Изменения и назначение: через durable runner выполнен только status/recovery probe для уже существующей provider task `2097126350429659137`; повторная отправка задания не выполнялась.
- Файлы/модули: `PROGRESS.md`.
- Проверки: `npm.cmd run test:live -- --task-id 2097126350429659137 --timeout-ms 30000` — `PASS`, `recovered_task_id=2097126350429659137`, `outputs_ready=true`. SQLite experimental warning ожидаем. Submit, upload, cancel и пользовательские assets — `NOT_RUN`.
- Доказательства: provider task восстановлена как успешная с готовыми outputs; ключ, signed URL и output URL в журнал не записываются.
- Ограничения/остаток: live `rh_get_results` и MCP `resources/read` для output этой задачи ещё не проверены; preview/poster, manifests/outbox и review loop не начинаются.
- Следующий шаг: выполнить ephemeral `rh_get_results` + `resources/read` для существующей задачи без submit/upload/cancel и записать фактический результат.

### STEP-0133 — 2026-09-07 — добавлен read-only result/resource live probe

- Пакет и статус: L06 / `IN_PROGRESS`; live result/resource verification — `NOT_RUN` на момент записи.
- Изменения и назначение: `scripts/test-live.mjs` получил режим `--result-resource`, который поднимает только ephemeral локальное состояние для существующего task ID, вызывает `rh_get_results` через MCP `InMemoryTransport`, затем `resources/read`; режим не содержит submit/upload/cancel.
- Файлы/модули: `scripts/test-live.mjs`, `PROGRESS.md`.
- Проверки: после изменения live probe и локальные regression checks — `NOT_RUN`; ключ не выводится и не записывается, пользовательские assets не используются.
- Ограничения/остаток: требуется запустить новый read-only режим с уже подтверждённым task ID; preview/poster, manifests/outbox и review loop не начинаются.
- Следующий шаг: выполнить `npm.cmd run test:live -- --result-resource --task-id 2097126350429659137` с одноразовым окружением из Windows User profile.

### STEP-0134 — 2026-09-07 — typecheck live probe PASS

- Пакет и статус: L06 / `IN_PROGRESS`; live result/resource verification — `NOT_RUN`.
- Изменения и назначение: новый режим live harness и существующий TypeScript-код проходят строгую проверку без diagnostics.
- Файлы/модули: `scripts/test-live.mjs`, связанные `src/` типы; `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — `PASS`; live API result/resource probe ещё `NOT_RUN`, submit/upload/cancel и пользовательские assets не выполнялись.
- Ограничения/остаток: runtime MCP transport для существующего output ещё не подтверждён после добавления режима.
- Следующий шаг: выполнить production build, затем запустить read-only `--result-resource` probe.

### STEP-0135 — 2026-09-07 — build live probe PASS

- Пакет и статус: L06 / `IN_PROGRESS`; live result/resource verification — `NOT_RUN`.
- Изменения и назначение: production `dist/` пересобран перед запуском harness; source/runtime contract для result download и MCP resource link актуален.
- Файлы/модули: rebuilt `dist/`; `scripts/test-live.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run build` — `PASS`; live result/resource probe ещё `NOT_RUN`, submit/upload/cancel и пользовательские assets не выполнялись.
- Ограничения/остаток: осталось выполнить только read-only `rh_get_results` + `resources/read` для существующей provider task.
- Следующий шаг: запустить `npm.cmd run test:live -- --result-resource --task-id 2097126350429659137` с одноразовым окружением из Windows User profile.

### STEP-0136 — 2026-09-07 — исправлена ошибка live harness до provider запроса

- Пакет и статус: L06 / `IN_PROGRESS`; live result/resource verification — `NOT_RUN`.
- Изменения и назначение: в `scripts/test-live.mjs` добавлен отсутствовавший импорт `planToRow`; предыдущий запуск не дошёл до вызова Workflow API и не выполнял submit/upload/cancel.
- Файлы/модули: `scripts/test-live.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:live -- --result-resource --task-id 2097126350429659137` — `FAIL` до provider output запроса с `planToRow is not defined`; SQLite experimental warning ожидаем. Live API, submit, upload, cancel и пользовательские assets — `NOT_RUN` в этом запуске.
- Ограничения/остаток: нужен повтор того же read-only режима после harness fix.
- Следующий шаг: повторить `npm.cmd run test:live -- --result-resource --task-id 2097126350429659137` с одноразовым окружением из Windows User profile.

### STEP-0137 — 2026-09-07 — live result/resource probe вернул MCP error

- Пакет и статус: L06 / `IN_PROGRESS`; live result/resource verification — `NOT_RUN`.
- Изменения и назначение: повторный read-only harness дошёл до вызова `rh_get_results`, но получил `isError=true`; signed URL и provider payload не выводились.
- Файлы/модули: `PROGRESS.md`.
- Проверки: `npm.cmd run test:live -- --result-resource --task-id 2097126350429659137` — `FAIL`: `rh_get_results returned an MCP error`; SQLite experimental warning ожидаем. Submit/upload/cancel и пользовательские assets не выполнялись.
- Ограничения/остаток: текущая диагностика harness недостаточна, чтобы отличить provider output/download error от ephemeral local setup error; live result/resource нельзя отметить PASS.
- Следующий шаг: добавить безопасный вывод только structured error code/message с redaction URL, затем повторить тот же read-only probe.

### STEP-0138 — 2026-09-07 — добавлена безопасная диагностика live MCP error

- Пакет и статус: L06 / `IN_PROGRESS`; live result/resource verification — `NOT_RUN`.
- Изменения и назначение: `--result-resource` теперь показывает только structured error `code/message`, редактируя URL из сообщения; секреты, signed URL и provider payload не сохраняются и не печатаются.
- Файлы/модули: `scripts/test-live.mjs`, `PROGRESS.md`.
- Проверки: после диагностической правки повторный live probe — `NOT_RUN`; submit/upload/cancel и пользовательские assets не выполнялись.
- Ограничения/остаток: требуется повторить read-only probe, чтобы классифицировать причину MCP error и не подменять её offline evidence.
- Следующий шаг: повторить `npm.cmd run test:live -- --result-resource --task-id 2097126350429659137` с одноразовым окружением из Windows User profile.

### STEP-0139 — 2026-09-07 — live output MIME/container mismatch выявлен

- Пакет и статус: L06 / `IN_PROGRESS`; live result/resource verification — `NOT_RUN`.
- Изменения и назначение: реальный `rh_get_results` получил provider output `67`, у которого declared/response MIME `video/mp4`, а распознанный контейнер — валидный QuickTime (`video/quicktime`). Текущая строгая проверка отклонила output до сохранения и до `resources/read`.
- Файлы/модули: `PROGRESS.md`.
- Проверки: `npm.cmd run test:live -- --result-resource --task-id 2097126350429659137` — `FAIL`, `DOWNLOAD_FAILED: Downloaded output 67 has MIME video/mp4, but its bytes are video/quicktime`; submit/upload/cancel не выполнялись, signed URL не записан.
- Ограничения/остаток: нужно разрешить только совместимую ISO-BMFF пару `video/mp4`/`video/quicktime`, сохраняя MIME по фактически распознанному контейнеру; другие mismatch должны остаться ошибкой.
- Следующий шаг: внести узкую MIME compatibility правку, добавить offline QuickTime regression и выполнить typecheck/build/L06 tests перед повторным live probe.

### STEP-0140 — 2026-09-07 — добавлена узкая MP4/QuickTime compatibility

- Пакет и статус: L06 / `IN_PROGRESS`; live result/resource verification — `NOT_RUN` после исправления.
- Изменения и назначение: MIME validation теперь принимает только двустороннюю совместимость `video/mp4` и `video/quicktime` для ISO-BMFF, продолжая сохранять фактически распознанный `video/quicktime`; добавлен offline test с валидным QuickTime container и provider label `video/mp4`.
- Файлы/модули: `src/execution/results.ts`, `tests/results/l06.test.mjs`, `PROGRESS.md`.
- Проверки: после изменения typecheck/build/L06/live — `NOT_RUN`; submit/upload/cancel и пользовательские assets не выполнялись.
- Ограничения/остаток: нужно подтвердить, что узкая совместимость устраняет реальный output mismatch и не ослабляет прочие MIME/container checks.
- Следующий шаг: выполнить `npm.cmd run typecheck`, затем `npm.cmd run test:l06` (команда сама пересобирает `dist`).

### STEP-0141 — 2026-09-07 — MIME compatibility typecheck PASS

- Пакет и статус: L06 / `IN_PROGRESS`; live result/resource verification — `NOT_RUN`.
- Изменения и назначение: строгая TypeScript-проверка после MIME compatibility и QuickTime regression прошла без diagnostics.
- Файлы/модули: `src/execution/results.ts`, `tests/results/l06.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — `PASS`; L06 offline tests и повторный live probe ещё `NOT_RUN`.
- Ограничения/остаток: требуется runtime test с валидным QuickTime и затем повтор реального result/resource probe.
- Следующий шаг: выполнить `npm.cmd run test:l06`.

### STEP-0142 — 2026-09-07 — L06 QuickTime regression PASS

- Пакет и статус: L06 / `IN_PROGRESS`; live result/resource verification — `NOT_RUN` после исправления.
- Изменения и назначение: L06 result-download suite теперь покрывает valid QuickTime bytes с provider label `video/mp4`; исходные invalid MIME/container, atomic retry и MCP resource tests продолжили проходить.
- Файлы/модули: rebuilt `dist/`; `src/execution/results.ts`, `tests/results/l06.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:l06` — `PASS`, 4 tests, 0 failures; build внутри команды — `PASS`. SQLite experimental warning ожидаем.
- Ограничения/остаток: реальный result/resource probe ещё не повторён после compatibility fix; submit/upload/cancel не выполнялись.
- Следующий шаг: повторить `npm.cmd run test:live -- --result-resource --task-id 2097126350429659137` с одноразовым окружением из Windows User profile.

### STEP-0143 — 2026-09-07 — live result/resource PASS

- Пакет и статус: L06 / `IN_PROGRESS`; read-only result/resource verification — `PASS`.
- Изменения и назначение: существующий provider output задачи `2097126350429659137` успешно прошёл `rh_get_results` через MCP transport и последующий `resources/read`; provider label `video/mp4` принят для фактически распознанного QuickTime container, локальный result resource вернул blob без абсолютного пути.
- Файлы/модули: `scripts/test-live.mjs`, `src/execution/results.ts`, `tests/results/l06.test.mjs`, rebuilt `dist/`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:live -- --result-resource --task-id 2097126350429659137` — `PASS`, `result_resource=true`, `mime=video/quicktime`, `bytes=3748525`. SQLite experimental warning ожидаем. Submit/upload/cancel и пользовательские assets не выполнялись.
- Доказательства: live status/recovery и live output/resource path подтверждены раздельно; signed URL и output URL в журнал не записывались.
- Ограничения/остаток: нужна только общая offline regression после compatibility fix; preview/poster, manifests/outbox и review loop не начинаются.
- Следующий шаг: выполнить `npm.cmd run test:acceptance:offline`, затем завершить этот L06 live result/resource подпункт без перехода к следующему подпункту.

### STEP-0144 — 2026-09-07 — result/resource live подпункт завершён

- Пакет и статус: L06 / `IN_PROGRESS`; выбранный read-only result/resource подпункт — `LOCAL_DONE` с live evidence.
- Изменения и назначение: исправлена узкая совместимость provider MIME `video/mp4` с фактическим QuickTime container, добавлен regression test и live harness mode для проверки полного пути `rh_get_results` → `resources/read` без нового запуска.
- Файлы/модули: `src/execution/results.ts`, `tests/results/l06.test.mjs`, `scripts/test-live.mjs`, rebuilt `dist/`, `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — `PASS`; `npm.cmd run build` — `PASS`; `npm.cmd run test:l06` — `PASS` (4 tests); `npm.cmd run test:acceptance:offline` — `PASS` (40 tests, 0 failures); `npm.cmd run test:live -- --task-id 2097126350429659137 --timeout-ms 30000` — `PASS`, recovery/output ready; `npm.cmd run test:live -- --result-resource --task-id 2097126350429659137` — `PASS`, `mime=video/quicktime`, `bytes=3748525`. SQLite experimental warnings ожидаемы.
- Доказательства: live provider status/output query, download и MCP `resources/read` подтверждены; submit/upload/cancel, пользовательские assets и signed/output URLs не выполнялись/не записывались.
- Ограничения/остаток: весь L06 не завершён; derived preview/poster, manifests/outbox, review events, changes-requested revisions, approval и chain gate остаются TODO. Natural expiry и account-wide compatibility отдельно не проверены.
- Следующий шаг: отдельно начать derived preview/poster; в этой сессии не переходить к следующему L06 подпункту.

### STEP-0145 — 2026-09-07 — финальная проверка выбранного подпункта

- Пакет и статус: L06 / `IN_PROGRESS`; result download/resource link и их read-only live verification — `LOCAL_DONE`/`PASS`, работа остановлена.
- Изменения и назначение: итоговое рабочее дерево сверено после MIME compatibility fix, live harness и regression tests; пользовательские изменения в прочих файлах не откатывались, commit/staging не выполнялись.
- Файлы/модули: итоговый список указан в STEP-0144; `dist/` rebuilt; `PROGRESS.md`.
- Проверки: `git diff --check` — `PASS`; только ожидаемые LF→CRLF warnings. Live API после PASS не вызывался повторно; submit/upload/cancel и внешние изменения — `NOT_RUN`.
- Ограничения/остаток: следующий L06 подпункт не начинался; derived preview/poster, manifests/outbox и review loop остаются TODO.
- Следующий шаг: в новой отдельной задаче начать derived preview/poster; автоматически не начинать его в этой сессии.

### STEP-0146 — 2026-09-07 — выбран derived preview/poster

- Пакет и статус: L06 / `IN_PROGRESS`; выбран только подпункт derived preview/poster.
- Изменения и назначение: после сохранения локального original `rh_get_results` будет создавать идемпотентные производные PNG: уменьшенный `preview` для image и первый кадр `poster` для video. Производные будут храниться отдельно, проверяться по hash и отдаваться через opaque MCP resource links.
- Файлы/модули: на момент записи изменён только `PROGRESS.md`; migration, derivative service, MCP integration и tests ещё не изменялись.
- Проверки: наличие локального `ffmpeg` — `PASS` (`C:\Users\Admin\scoop\shims\ffmpeg.exe`); реализация, typecheck, build и tests — `NOT_RUN`. Live API, платные генерации, upload/cancel и пользовательские assets не выполняются.
- Ограничения/остаток: media processing использует только фиксированный локальный `ffmpeg` subprocess без shell; audio outputs не получают derived preview/poster. Manifests/outbox, review и chain gate не начинаются.
- Следующий шаг: добавить durable derived-result records, atomic preview/poster generation и MCP `resources/read` links, затем проверить их через offline transport.

### STEP-0147 — 2026-09-07 — реализован derived preview/poster path

- Пакет и статус: L06 / `IN_PROGRESS`; implementation выбранного preview/poster подпункта добавлена, проверки ещё не завершены.
- Изменения и назначение: добавлена migration `derived_results`, `DerivedMediaService` с hash-aware reuse, project-root/symlink checks, atomic file writes и фиксированным `ffmpeg` subprocess. Image outputs получают уменьшенный PNG `preview`, video outputs — PNG `poster` первого кадра; `rh_get_results` возвращает derived metadata и `runninghub://derived/<id>` resource links, `resources/read` проверяет их повторно.
- Файлы/модули: `src/storage/database.ts`, новый `src/execution/derivatives.ts`, `src/mcp/server.ts`, `tests/results/l06.test.mjs`, `tests/unit/storage.test.mjs`, `PROGRESS.md`.
- Проверки: после изменения `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run test:l06`, `npm.cmd run test:acceptance:offline` — `NOT_RUN`; live API, submit/upload/cancel и пользовательские assets не выполнялись.
- Доказательства: offline tests добавлены для PNG preview reuse, video first-frame poster и MCP `resources/read`; synthetic fixtures не являются live provider evidence.
- Ограничения/остаток: audio derivative не создаётся; manifests/outbox, review и chain gate не реализуются. Нужно исправить только связанные compile/test regressions и обновить capability docs.
- Следующий шаг: выполнить `npm.cmd run typecheck`, затем исправить только diagnostics выбранного подпункта.

### STEP-0148 — 2026-09-07 — derived path typecheck PASS

- Пакет и статус: L06 / `IN_PROGRESS`; preview/poster runtime ещё не подтверждён.
- Изменения и назначение: strict TypeScript check нового migration/service/resource path прошёл без diagnostics.
- Файлы/модули: `src/execution/derivatives.ts`, `src/storage/database.ts`, `src/mcp/server.ts`; `tests/results/l06.test.mjs`, `tests/unit/storage.test.mjs`; `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — `PASS`. Build, L06 tests и полный offline acceptance — `NOT_RUN`; live API и внешние изменения не выполнялись.
- Ограничения/остаток: требуется runtime build и проверка фактической генерации PNG preview/poster, затем синхронизация docs/capabilities.
- Следующий шаг: выполнить `npm.cmd run test:l06` (он пересобирает `dist`).

### STEP-0149 — 2026-09-07 — derived preview/poster runtime PASS

- Пакет и статус: L06 / `IN_PROGRESS`; preview/poster local path реализован, общая regression ещё не завершена.
- Изменения и назначение: build собрал migration/service/server; L06 tests подтвердили PNG preview reuse, video first-frame poster, atomic local files и derived MCP resource read без нового submit.
- Файлы/модули: rebuilt `dist/`; `src/execution/derivatives.ts`, `src/storage/database.ts`, `src/mcp/server.ts`, `tests/results/l06.test.mjs`, `tests/unit/storage.test.mjs`; `PROGRESS.md`.
- Проверки: `npm.cmd run test:l06` — `PASS`: build `PASS`, 6 tests, 0 failures. SQLite experimental warning ожидаем. Полный offline acceptance и `test:mcp` — `NOT_RUN`; live API и внешние изменения не выполнялись.
- Доказательства: test 4 создаёт и повторно использует image preview; test 5 получает poster первого video frame; MCP test читает derived PNG через `resources/read`; submit count остаётся `0`.
- Ограничения/остаток: ffmpeg availability у целевого пользователя должна быть настроена; audio outputs получают warning без derivative. Manifests/outbox, review и chain gate не реализуются.
- Следующий шаг: обновить `README.md`, `docs/capabilities.md`, `docs/configuration.md` под локальный preview/poster contract, затем выполнить `npm.cmd run test:mcp`.

### STEP-0150 — 2026-09-07 — синхронизирована документация preview/poster

- Пакет и статус: L06 / `IN_PROGRESS`; локальный preview/poster path документирован, regression ещё не завершена.
- Изменения и назначение: README и capability matrix теперь различают originals, image previews, video posters и незавершённые manifests/review; configuration описывает `RUNNINGHUB_FFMPEG_PATH` и отсутствие network/provider claims.
- Файлы/модули: `README.md`, `docs/capabilities.md`, `docs/configuration.md`, `PROGRESS.md`.
- Проверки: после документационных изменений `npm.cmd run test:mcp` и полный offline acceptance — `NOT_RUN`; runtime code не менялся, live API и внешние изменения не выполнялись.
- Ограничения/остаток: требуется убедиться, что MCP stdio и весь offline acceptance не регрессировали после migration/resource registration.
- Следующий шаг: выполнить `npm.cmd run test:mcp`.

### STEP-0151 — 2026-09-07 — MCP stdio regression PASS

- Пакет и статус: L06 / `IN_PROGRESS`; общая offline regression ещё не завершена.
- Изменения и назначение: dynamic `runninghub://derived/{derived_id}` resource registration и migration 5 не нарушили existing stdio initialize/tools/list/call flow.
- Файлы/модули: rebuilt `dist/`; `src/mcp/server.ts`, `src/storage/database.ts`, `src/execution/derivatives.ts`; `PROGRESS.md`.
- Проверки: `npm.cmd run test:mcp` — `PASS`: build `PASS`, 1 test, 0 failures. SQLite experimental warning ожидаем. Полный offline acceptance — `NOT_RUN`; live API и внешние изменения не выполнялись.
- Ограничения/остаток: нужно выполнить полный offline acceptance, затем обновить итоговый handoff и остановиться на этом подпункте.
- Следующий шаг: выполнить `npm.cmd run test:acceptance:offline`.

### STEP-0152 — 2026-09-07 — derived preview/poster offline acceptance PASS

- Пакет и статус: L06 / `IN_PROGRESS`; выбранный derived preview/poster подпункт готов локально, работа по нему почти завершена.
- Изменения и назначение: полная offline regression подтвердила migration 5, derivative storage, MCP resource registration и отсутствие regressions в graph/project/execution/catalog paths.
- Файлы/модули: `src/execution/derivatives.ts`, `src/storage/database.ts`, `src/mcp/server.ts`, `tests/results/l06.test.mjs`, `tests/unit/storage.test.mjs`, `README.md`, `docs/capabilities.md`, `docs/configuration.md`; rebuilt `dist/`; `PROGRESS.md`.
- Проверки: `npm.cmd run test:acceptance:offline` — `PASS`: unit 3, contract 2, graph 8, L03 4, L04 4, L05 14, L06 6, MCP 1; всего 38 tests, 0 failures. Внутренние build шаги — `PASS`; SQLite experimental warnings ожидаемы. Live API, submit/upload/cancel и пользовательские assets не выполнялись.
- Доказательства: L06 image preview и video poster созданы локально через ffmpeg; повтор derivative не создаёт новую запись; MCP transport читает derived PNG; submit count остаётся `0`.
- Ограничения/остаток: live preview/poster на конкретном RunningHub output не выполнялся; ffmpeg должен быть доступен локально, audio derivative отсутствует. Manifests/outbox, review events, changes-requested revisions, approval и chain gate остаются TODO.
- Следующий шаг: выполнить финальный `npm.cmd run typecheck` и `git diff --check`, затем завершить только этот L06 подпункт и остановиться.

### STEP-0153 — 2026-09-07 — финальная проверка derived preview/poster

- Пакет и статус: L06 / `LOCAL_DONE` для выбранного derived preview/poster подпункта; весь L06 остаётся `IN_PROGRESS`, работа остановлена.
- Изменения и назначение: итоговое состояние исходников, тестов, документации и rebuilt `dist/` сверено; пользовательские изменения в `LUNA_START_HERE.md`, компактном журнале/архиве, плане и ранее затронутых файлах не откатывались, commit/staging не выполнялись.
- Файлы/модули: новый `src/execution/derivatives.ts`; `src/storage/database.ts`, `src/mcp/server.ts`, `tests/results/l06.test.mjs`, `tests/unit/storage.test.mjs`, `README.md`, `docs/capabilities.md`, `docs/configuration.md`; rebuilt `dist/`; `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — `PASS`; `npm.cmd run test:l06` — `PASS` (6 tests); `npm.cmd run test:mcp` — `PASS` (1 test); `npm.cmd run test:acceptance:offline` — `PASS` (38 tests, 0 failures); `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings. Live API, платные генерации, upload/cancel и пользовательские assets — `NOT_RUN`.
- Доказательства: image preview и video first-frame poster созданы локально и повторно переиспользованы по source hash; MCP `resources/read` проверил derived PNG; synthetic/offline evidence не выдаётся за live provider evidence.
- Ограничения/остаток: live preview/poster compatibility отдельно не проверялась; требуется локальный ffmpeg, audio derivatives не создаются. Manifests/outbox, review events, changes-requested revisions, approval и chain gate остаются TODO.
- Следующий шаг: в новой отдельной задаче выбрать manifests/outbox как следующий конкретный L06 подпункт; автоматически не начинать.

### STEP-0154 — 2026-09-07 — выбран подпункт manifests/outbox

- Пакет и статус: L06 / `IN_PROGRESS`; выбран только manifests/outbox.
- Изменения и назначение: после уже реализованных original/preview/poster paths добавить immutable project-local `manifest.json` с hashes, graph/revision snapshot, asset bindings, provider task/output metadata и review status `NOT_READY`; публикацию сделать через идемпотентный SQLite outbox без секретов и абсолютных путей.
- Файлы/модули: на момент записи изменён только `PROGRESS.md`; runtime и тесты ещё не изменялись.
- Проверки: реализация, typecheck, build и tests — `NOT_RUN`; live API, платные генерации, upload/cancel и пользовательские assets не выполняются.
- Ограничения/остаток: review events, changes-requested revisions, approval и chain gate не входят в выбранный подпункт.
- Следующий шаг: добавить manifest service, outbox persistence и MCP integration, затем проверить повторную публикацию через offline transport.

### STEP-0155 — 2026-09-07 — добавлен manifest/outbox path

- Пакет и статус: L06 / `IN_PROGRESS`; manifests/outbox implementation добавлена, проверки не завершены.
- Изменения и назначение: migration 6 добавила unique `(kind, aggregate_id)` outbox key; `ResultManifestService` атомарно сохраняет `.runninghub/runs/<job_id>/manifest.json`, фиксирует graph/revision hashes и snapshots, ordered asset hashes, backend/task/output metadata и `review=NOT_READY`, затем проверяет integrity и отмечает идемпотентное `result_manifest` событие опубликованным. `rh_get_results` теперь возвращает manifest publication metadata.
- Файлы/модули: `src/storage/database.ts`, новый `src/execution/manifests.ts`, `src/mcp/server.ts`, `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck`, build, L06/offline tests — `NOT_RUN` после изменения; live API, submit/upload/cancel и пользовательские assets не выполнялись.
- Ограничения/остаток: нужно проверить отсутствие provider refs/absolute project paths в manifest, повторный MCP вызов и pending outbox republish; review/approval/chain gate не реализуются.
- Следующий шаг: выполнить `npm.cmd run typecheck` и исправить только diagnostics manifests/outbox path.

### STEP-0156 — 2026-09-07 — исправлен тип derived rows в manifest builder

- Пакет и статус: L06 / `IN_PROGRESS`; compile fix для manifests/outbox.
- Изменения и назначение: builder теперь принимает durable `DerivedResultRow` и корректно маппит его `id` в manifest `derived_id`; runtime scope не расширен.
- Файлы/модули: `src/execution/manifests.ts`, `PROGRESS.md`.
- Проверки: первый `npm.cmd run typecheck` после implementation — `FAIL` только по несовпадению `DerivedResultRow`/`DerivedResult`; после точечного исправления повторный typecheck — `NOT_RUN`.
- Ограничения/остаток: build и tests ещё не выполнялись; live API и внешние изменения не затрагивались.
- Следующий шаг: повторить `npm.cmd run typecheck`.

### STEP-0157 — 2026-09-07 — manifests/outbox typecheck PASS

- Пакет и статус: L06 / `IN_PROGRESS`; manifest/outbox path компилируется.
- Изменения и назначение: строгая TypeScript-проверка migration, outbox methods, manifest builder и MCP integration прошла без diagnostics.
- Файлы/модули: `src/storage/database.ts`, `src/execution/manifests.ts`, `src/mcp/server.ts`, `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — `PASS`. Build, L06 и полный offline acceptance — `NOT_RUN`; live API, submit/upload/cancel и пользовательские assets не выполнялись.
- Ограничения/остаток: нужны runtime tests manifest file, no secret/provider reference, idempotent outbox и повторный MCP call.
- Следующий шаг: добавить offline assertions в существующий `tests/results/l06.test.mjs` и обновить migration expectation в `tests/unit/storage.test.mjs`.

### STEP-0158 — 2026-09-07 — добавлены manifest/outbox offline assertions

- Пакет и статус: L06 / `IN_PROGRESS`; тестовый контракт manifests/outbox добавлен.
- Изменения и назначение: storage unit expectation переведён на migration 6; L06 MCP transport test проверяет manifest file under `.runninghub/runs`, graph/output/review metadata, отсутствие project root/API key/provider URL, published outbox event и повторную публикацию после искусственного pending state без submit.
- Файлы/модули: `tests/unit/storage.test.mjs`, `tests/results/l06.test.mjs`, `src/execution/manifests.ts`, `PROGRESS.md`.
- Проверки: после добавления assertions typecheck/build/L06 tests — `NOT_RUN`; live API и пользовательские assets не используются.
- Ограничения/остаток: нужно выполнить L06 runtime test и исправить только связанные failures; review loop не входит в шаг.
- Следующий шаг: выполнить `npm.cmd run test:l06`.

### STEP-0159 — 2026-09-07 — manifests/outbox L06 tests PASS

- Пакет и статус: L06 / `IN_PROGRESS`; runtime contract manifests/outbox подтверждён локально.
- Изменения и назначение: build успешно собрал migration 6 и `ResultManifestService`; MCP test создал manifest, проверил hash-linked output metadata и review `NOT_READY`, затем повторно опубликовал pending outbox row без provider submit.
- Файлы/модули: rebuilt `dist/`; `src/execution/manifests.ts`, `src/storage/database.ts`, `src/mcp/server.ts`, `tests/results/l06.test.mjs`, `tests/unit/storage.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:l06` — `PASS`, build `PASS`, 6 tests, 0 failures. SQLite experimental warning ожидаем. Полный offline acceptance — `NOT_RUN`; live API и внешние изменения не выполнялись.
- Ограничения/остаток: нужна общая regression, explicit typecheck и diff check; manifest provider compatibility не является live evidence. Review events/approval/chain gate остаются TODO.
- Следующий шаг: выполнить `npm.cmd run test:unit` и `npm.cmd run test:mcp` для migration/outbox и stdio regression.

### STEP-0160 — 2026-09-07 — storage migration regression PASS

- Пакет и статус: L06 / `IN_PROGRESS`; SQLite migration 6 regression подтверждена.
- Изменения и назначение: unit suite подтвердил повторное применение migration 6 и сохранение table count; outbox unique index не создаёт лишнюю таблицу.
- Файлы/модули: rebuilt `dist/`; `src/storage/database.ts`, `tests/unit/storage.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:unit` — `PASS`, build `PASS`, 3 tests, 0 failures. SQLite experimental warning ожидаем. `test:mcp` и full acceptance — `NOT_RUN`; live API не выполнялся.
- Ограничения/остаток: stdio tool flow и полный offline regression ещё не проверены; review loop остаётся вне scope.
- Следующий шаг: выполнить `npm.cmd run test:mcp`.

### STEP-0161 — 2026-09-07 — stdio MCP regression PASS

- Пакет и статус: L06 / `IN_PROGRESS`; manifests/outbox registration не нарушила stdio flow.
- Изменения и назначение: initialize/tools-list/local tool calls продолжают работать после migration 6 и подключения manifest publication к `rh_get_results`.
- Файлы/модули: rebuilt `dist/`; `src/execution/manifests.ts`, `src/storage/database.ts`, `src/mcp/server.ts`, `tests/mcp/stdio.test.mjs`, `PROGRESS.md`.
- Проверки: `npm.cmd run test:mcp` — `PASS`, build `PASS`, 1 test, 0 failures. SQLite experimental warning ожидаем. Full offline acceptance — `NOT_RUN`; live API и внешние изменения не выполнялись.
- Ограничения/остаток: нужен финальный typecheck, full offline acceptance и `git diff --check`; review/approval/chain gate не реализуются.
- Следующий шаг: выполнить `npm.cmd run test:acceptance:offline`.

### STEP-0162 — 2026-09-07 — manifests/outbox offline acceptance PASS

- Пакет и статус: L06 / `IN_PROGRESS`; выбранный manifests/outbox подпункт локально готов, финальные checks ещё впереди.
- Изменения и назначение: full offline acceptance подтвердил migration 6, immutable manifest publication, idempotent pending outbox republish и отсутствие regressions в catalog/graph/project/execution/MCP paths.
- Файлы/модули: `src/execution/manifests.ts`, `src/storage/database.ts`, `src/mcp/server.ts`, `tests/results/l06.test.mjs`, `tests/unit/storage.test.mjs`; rebuilt `dist/`; `PROGRESS.md`.
- Проверки: `npm.cmd run test:acceptance:offline` — `PASS`: unit 3, contract 2, graph 8, L03 4, L04 4, L05 14, L06 6, MCP 1; всего 38 tests, 0 failures. Внутренние build шаги — `PASS`; SQLite experimental warnings ожидаемы. Live API и внешние изменения не выполнялись.
- Ограничения/остаток: manifest сохраняет review `NOT_READY`; review events/approval/chain gate не реализуются. Нужны финальные typecheck и `git diff --check`.
- Следующий шаг: выполнить `npm.cmd run typecheck`, затем `git diff --check`.

### STEP-0163 — 2026-09-07 — финальный manifests/outbox typecheck PASS

- Пакет и статус: L06 / `IN_PROGRESS`; runtime/test path готов локально, documentation sync и diff check ещё впереди.
- Изменения и назначение: строгая компиляция после всех manifest/outbox implementation и test changes прошла без diagnostics.
- Файлы/модули: `src/execution/manifests.ts`, `src/storage/database.ts`, `src/mcp/server.ts`, tests; `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — `PASS`. После этой проверки documentation sync и `git diff --check` — `NOT_RUN`; live API и внешние изменения не выполнялись.
- Ограничения/остаток: README/capability matrix ещё содержат прежнее «manifests not implemented» описание; review loop остаётся TODO.
- Следующий шаг: синхронизировать только manifest/outbox documentation, затем повторить build, relevant tests и `git diff --check`.

### STEP-0164 — 2026-09-07 — синхронизирована документация manifests/outbox

- Пакет и статус: L06 / `IN_PROGRESS`; documentation sync завершена, финальные runtime checks ещё не выполнены.
- Изменения и назначение: README, capability matrix, configuration и `rh_get_capabilities` теперь отражают local manifest/outbox support; audio derivatives и review/chain gate остаются явно неподдержанными.
- Файлы/модули: `README.md`, `docs/capabilities.md`, `docs/configuration.md`, `src/mcp/server.ts`, `PROGRESS.md`.
- Проверки: после документационной/runtime capability правки build, typecheck, tests и `git diff --check` — `NOT_RUN`; live API и внешние изменения не выполнялись.
- Ограничения/остаток: нужно подтвердить финальное исходное состояние; review events/approval/chain gate не реализуются.
- Следующий шаг: выполнить `npm.cmd run typecheck`, затем `npm.cmd run build`.

### STEP-0165 — 2026-09-07 — typecheck после документации PASS

- Пакет и статус: L06 / `IN_PROGRESS`; финальная проверка manifests/outbox продолжается.
- Изменения и назначение: строгая компиляция после capability update прошла без diagnostics.
- Файлы/модули: `src/mcp/server.ts`, `src/execution/manifests.ts`, `src/storage/database.ts`, `README.md`, docs; `PROGRESS.md`.
- Проверки: `npm.cmd run typecheck` — `PASS`. Production build, relevant tests и `git diff --check` — `NOT_RUN`; live API и внешние изменения не выполнялись.
- Ограничения/остаток: требуется пересобрать `dist/` после последнего source update и повторить tests.
- Следующий шаг: выполнить `npm.cmd run build`.

### STEP-0166 — 2026-09-07 — финальный build manifests/outbox PASS

- Пакет и статус: L06 / `IN_PROGRESS`; `dist/` синхронизирован с manifests/outbox implementation.
- Изменения и назначение: production TypeScript build успешно собрал migration 6, `ResultManifestService` и updated capability response.
- Файлы/модули: rebuilt `dist/`; `src/execution/manifests.ts`, `src/storage/database.ts`, `src/mcp/server.ts`, docs; `PROGRESS.md`.
- Проверки: `npm.cmd run build` — `PASS`. После последнего source/docs update L06, full acceptance и `git diff --check` — `NOT_RUN`; live API не выполнялся.
- Ограничения/остаток: нужны финальные L06/MCP/full offline regression и diff check; review loop остаётся TODO.
- Следующий шаг: выполнить `npm.cmd run test:l06`.

### STEP-0167 — 2026-09-07 — финальный L06 manifests/outbox test PASS

- Пакет и статус: L06 / `IN_PROGRESS`; selected manifests/outbox runtime test остаётся зелёным после docs/capability update.
- Изменения и назначение: L06 suite повторно подтвердил originals, derived resources, manifest persistence and pending outbox republish without a second submit.
- Файлы/модули: rebuilt `dist/`; `src/execution/manifests.ts`, `src/storage/database.ts`, `src/mcp/server.ts`, `tests/results/l06.test.mjs`, docs; `PROGRESS.md`.
- Проверки: `npm.cmd run test:l06` — `PASS`, build `PASS`, 6 tests, 0 failures. SQLite experimental warning ожидаем. Full acceptance и `git diff --check` — `NOT_RUN`; live API не выполнялся.
- Ограничения/остаток: нужна финальная stdio/full offline regression и whitespace/diff check; review events/approval/chain gate не реализуются.
- Следующий шаг: выполнить `npm.cmd run test:mcp`, затем `npm.cmd run test:acceptance:offline`.

### STEP-0168 — 2026-09-07 — финальный MCP stdio test PASS

- Пакет и статус: L06 / `IN_PROGRESS`; stdio regression после capability update пройдена.
- Изменения и назначение: MCP initialize/tools-list/local execution flow остаётся рабочим с новым manifest/outbox capability response.
- Файлы/модули: rebuilt `dist/`; `src/mcp/server.ts`, `src/execution/manifests.ts`, tests; `PROGRESS.md`.
- Проверки: `npm.cmd run test:mcp` — `PASS`, build `PASS`, 1 test, 0 failures. SQLite experimental warning ожидаем. Full offline acceptance и `git diff --check` — `NOT_RUN`; live API не выполнялся.
- Ограничения/остаток: требуется финальная полная regression; review loop не реализуется в этом пункте.
- Следующий шаг: выполнить `npm.cmd run test:acceptance:offline`.

### STEP-0169 — 2026-09-07 — финальный manifests/outbox acceptance PASS

- Пакет и статус: L06 / `IN_PROGRESS`; выбранный manifests/outbox подпункт готов локально, остаётся только diff check и handoff.
- Изменения и назначение: полная offline regression после documentation/capability sync прошла без regressions; MCP path по-прежнему пишет и переиздаёт manifest через outbox без нового submit.
- Файлы/модули: `src/execution/manifests.ts`, `src/storage/database.ts`, `src/mcp/server.ts`, `tests/results/l06.test.mjs`, `tests/unit/storage.test.mjs`, `README.md`, `docs/capabilities.md`, `docs/configuration.md`; rebuilt `dist/`; `PROGRESS.md`.
- Проверки: `npm.cmd run test:acceptance:offline` — `PASS`: unit 3, contract 2, graph 8, L03 4, L04 4, L05 14, L06 6, MCP 1; всего 38 tests, 0 failures. Все внутренние build шаги — `PASS`; SQLite experimental warnings ожидаемы. Live API, submit/upload/cancel и пользовательские assets не выполнялись.
- Ограничения/остаток: review events/approval/chain gate и audio derivatives остаются TODO; live manifest compatibility отдельно не проверялась и не подменена offline evidence. Нужен `git diff --check`.
- Следующий шаг: выполнить `git diff --check`, затем завершить выбранный подпункт и остановиться.

### STEP-0170 — 2026-09-07 — manifests/outbox подпункт завершён

- Пакет и статус: L06 / `LOCAL_DONE` для manifests/outbox; весь L06 остаётся `IN_PROGRESS`, работа остановлена по правилу сессии.
- Изменения и назначение: `rh_get_results` теперь атомарно создаёт immutable `.runninghub/runs/<job_id>/manifest.json` с graph/revision/asset/backend/task/output hashes и `review=NOT_READY`; SQLite outbox обеспечивает уникальное `result_manifest` событие и повторную публикацию pending записи с integrity check. Секреты, signed/provider URLs и абсолютный project root в manifest не сохраняются.
- Файлы/модули: новый `src/execution/manifests.ts`; `src/storage/database.ts`, `src/mcp/server.ts`, `tests/results/l06.test.mjs`, `tests/unit/storage.test.mjs`, `README.md`, `docs/capabilities.md`, `docs/configuration.md`, `PROGRESS.md`; rebuilt `dist/`.
- Проверки: `npm.cmd run typecheck` — `PASS`; `npm.cmd run build` — `PASS`; `npm.cmd run test:l06` — `PASS` (6 tests); `npm.cmd run test:mcp` — `PASS` (1 test); `npm.cmd run test:acceptance:offline` — `PASS` (38 tests, 0 failures); `git diff --check` — `PASS` с ожидаемыми LF→CRLF warnings. SQLite experimental warnings ожидаемы. Live API, платные генерации, upload/cancel и пользовательские assets — `NOT_RUN`.
- Доказательства: offline MCP transport реально создаёт manifest, проверяет output hash/review status/no secret or absolute root, затем после сброса `published_at` повторно публикует тот же outbox event без второго submit; synthetic/offline evidence не выдаётся за live compatibility.
- Ограничения/остаток: review events, changes-requested revisions, approval и chain gate не реализованы; audio derivatives отсутствуют; live manifest compatibility отдельно не проверялась.
- Следующий шаг: в новой отдельной задаче выбрать review events/manifest review state; автоматически не начинать.
