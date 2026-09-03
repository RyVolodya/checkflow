# CheckFlow v0.9.0

## Dashboard
- Dashboard summary reduced to four cards: In progress, Completed, Overdue, Deferred.
- Existing Scheduled items remain available in normal filters/Kanban but are no longer shown as a top summary card.

## Templates
- Styled Edit and Delete actions inside template cards.

## Efficiency
- New Efficiency page for performance analysis.
- Employee: own metrics only.
- Manager: users from assigned groups.
- Administrator: all users.
- Day, week, month and year periods with selectable anchor date.
- Metrics: completed, overdue/not completed, total work, average completion time, on-time rate and completion rate.
- Trend chart and per-user table.

## Groups
- New many-to-many user groups.
- Administrators can create, rename and delete groups.
- Employees and managers can belong to multiple groups.
- Employee setting to allow/deny visibility of other group members' work.
- Managers see users/work only from their groups.
- Work creation can assign an entire group; active employees in that group are expanded into individual assignees.
- User editor includes group membership management.

## Compatibility
- Existing data is preserved. Prisma db push adds the new group tables and user visibility field automatically.
