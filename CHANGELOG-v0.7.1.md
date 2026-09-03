# CheckFlow v0.7.1

## Fixed

- Fixed frontend TypeScript build failure caused by nullable `dueDate` values introduced with Deferred work items.
- `toLocalInput()` now accepts `string | null | undefined`, matching the v0.7.x data model.
- No database schema changes in this release.
