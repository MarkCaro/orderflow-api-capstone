---
paths:
  - "migrations/**"
---

# Migrations

- Migrations are numbered and replayed in order by `migrations/run.js`, which has no
  applied-migrations ledger — it just reruns every `.sql` file each time, relying on idempotent SQL
  (`IF NOT EXISTS`). Never edit a migration file that has already been applied (any file at or
  below the highest number currently in `migrations/`) — create a new, higher-numbered file
  instead. Editing an applied migration desyncs environments that already ran it.
- Every migration must be reversible in principle: prefer additive changes (new table, new
  nullable column, new index) over destructive ones (dropping a column/table) in a single step.
  If a destructive change is required, note the rollback approach in a SQL comment at the top of
  the file.
- Use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX` (not `CREATE INDEX IF NOT EXISTS`, which
  Postgres versions before 9.5 lack — match the existing files' style) consistent with
  `001_create_users.sql` through `006_create_activity_logs.sql`.