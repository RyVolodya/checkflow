# CheckFlow v0.7.0

- Added CheckFlow brand mark to login/sidebar and favicon.
- Added Docker `restart: unless-stopped` for database, backend and frontend; all services use the `checkflow_net` network.
- Added live session validation via `/api/auth/me`; expired/invalid sessions now return directly to Login instead of showing an empty dashboard.
- Scheduled work becomes **In progress** on its start calendar date (Europe/Kyiv), regardless of the exact start hour.
- Added **Deferred** status. Deferred work has no start/due date and can later be edited and returned to active work.
- Added Deferred dashboard counter/filter.
- Added Dashboard Cards / Board view switch.
- Added Kanban columns: In progress, Deferred, Completed, Overdue, Scheduled.
- Added drag-and-drop status changes with confirmation and Edit option.
- Moving to Completed records completion time automatically; moving to Deferred clears dates.
- Kanban columns scroll vertically; mobile uses horizontal swipe between full-width columns.
