# CheckFlow v0.8.0

## Fixed
- Ukrainian status wording updated to **Відкладені**, **Прострочені**, and **Виконані**.
- Overdue tasks/checklists can be moved back to **В роботі** from the board; new start and due dates are required.
- Desktop Kanban columns now fit the available width without horizontal card scrolling.
- Styled vertical scrollbars added to Kanban columns; mobile board retains horizontal swipe/scroll behavior.
- CheckFlow brand mark and favicon were rebuilt with padding and transparent background for light and dark themes.

## Added
- New **Templates / Шаблони** section for Manager and Administrator roles.
- Template search plus Add, Edit, Delete, and Create-from-template actions.
- Template editor supports task/checklist type, title, description, default assignees, recurrence, and checklist items.
- Creating work from a template requires fresh dates and can optionally save non-date changes back to the template.
- Existing tasks/checklists, including completed records, can be added to templates.
- New persistent `WorkTemplate` model; existing PostgreSQL data remains intact and `prisma db push` creates the new table.
