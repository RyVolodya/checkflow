<p align="center">
  <img src="docs/images/brand-mark.png" alt="CheckFlow logo" width="96" height="96">
</p>

<h1 align="center">CheckFlow</h1>
<p align="center"><strong>Self-hosted workspace for tasks, checklists, teams and work analytics.</strong></p>

![CheckFlow Screenshot](docs/images/checkflow.png)

## About

CheckFlow is a self-hosted web application for organizing employee tasks and multi-step checklists. It combines assignments, deadlines, recurring work, templates, group-based access, completion tracking, performance analytics and optional Telegram notifications in one responsive interface.

The application is designed for teams that want a lightweight workflow system they can deploy and keep inside their own Docker infrastructure.

## Features

- Tasks and multi-item checklists
- Start date and deadline with date and time
- Multiple assignees and assignment by group
- Employee, Manager and Administrator roles
- Employee groups with many-to-many membership
- Group-scoped Manager access and assignments
- Optional visibility of other employees' work inside a group
- Checklist item statuses, blocked reasons and optional photo confirmation
- Automatic checklist completion when the final checklist item is completed
- Completion timestamp for tasks and every checklist item
- Last completed checklist item and its completion time shown on the work card
- Actual work completion time and elapsed duration in completed work details
- Comments and deadline extension approval workflow
- Recurring work: weekly, monthly or every N days (1–365)
- Templates for reusable tasks and checklists
- Completed and overdue work history
- Cards and Kanban/Columns views
- Sorting by due date, start date or title in both Cards and Columns views
- Responsive desktop, tablet and mobile interface
- Light and dark themes
- English and Ukrainian interface
- Optional Telegram notifications

## Work Dashboard

The dashboard provides four primary work counters:

- **In progress**
- **Completed**
- **Overdue**
- **Deferred**

Scheduled work remains available through filters and the Kanban/Columns view. Completed cards use a light green visual state, while overdue and deferred work retain their dedicated status styling.

### Cards and Columns

Work can be displayed as regular cards or as a Kanban-style board. Both modes support the same sorting options:

- Due date — ascending / descending
- Start date — ascending / descending
- Title — A–Z / Z–A

In Columns mode, sorting is applied independently inside each status column.

## Tasks and Checklists

A **Task** is a single work item with an overall result. When completed, CheckFlow records the exact completion timestamp and can show the elapsed time from the configured start date.

A **Checklist** contains multiple independently tracked items. Each completed item stores its own completion timestamp. The card shows the most recently completed checklist item together with its completion time. Completing the final checklist item automatically completes the entire checklist, and the checklist completion time is synchronized with that final item.

Checklist items can also require a reason when they cannot be completed and can optionally require photo confirmation.

## Groups and Access Control

Administrators can create, rename and delete groups. Employees and Managers can belong to more than one group.

- **Employee** — works with assigned tasks and checklists. By default, an employee sees their own work. An Administrator can optionally allow an employee to see work belonging to other employees in the same groups.
- **Manager** — can work with users and assignments inside the Manager's assigned groups. A Manager may belong to multiple groups.
- **Administrator** — has full access to users, groups, work and application management.

When creating a task or checklist, a Manager or Administrator can assign individual employees or select an entire group. Group assignment is expanded into the active employees of that group so each employee remains an individual assignee for history and analytics.

## Efficiency Analytics

The **Efficiency** section provides work-performance analytics while respecting role-based access:

- Employees see only their own metrics.
- Managers see users from their assigned groups.
- Administrators can analyze all users.

Available analysis periods:

- Day
- Week
- Month
- Year

Metrics include:

- Completed work
- Overdue / not completed work
- Total work
- Average completion time
- Completion rate
- On-time completion rate
- Trend chart
- Per-user summary table

## Templates

Managers and Administrators can create reusable templates for both tasks and checklists. Templates can store:

- Work type
- Title and description
- Default assignees
- Recurrence settings
- Checklist items and photo requirements

Existing work, including completed records, can be added to Templates. Creating work from a template requires new start/deadline values, while reusable non-date settings can be saved back to the template. Template cards provide dedicated **Edit** and **Delete** actions.

## Recurring Work

CheckFlow supports:

- Weekly recurrence
- Monthly recurrence
- Custom recurrence every **N days** from 1 to 365

The recurrence interval is stored in PostgreSQL and is also supported by Templates.

## Postponement and History

Employees can request a deadline extension with a reason. Managers and Administrators can approve or reject requests. Authorized creators can also postpone work directly, with the change recorded in the work history.

Completed and overdue work is retained in History, with search and filters for type, status, assignee and date range.

## User Management

Administrators can create and manage users with:

- Name
- Username
- Position
- Role
- Password
- Telegram Chat ID
- Membership in one or more groups
- Group-work visibility permission for Employees

Administrators can also change roles, reset passwords, block/unblock users and delete users. The default account requires a password change after the first login.

## Telegram Notifications

CheckFlow can optionally send Telegram notifications for assignments, approaching deadlines, postponement decisions and direct deadline changes.

Create a Telegram bot using **BotFather**, then create a `.env` file next to `docker-compose.yml`:

```env
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
```

Configure the Telegram Chat ID for each required user in CheckFlow.

> Never commit the `.env` file or Telegram bot token to a public repository.

Add `.env` to `.gitignore`:

```gitignore
.env
```

## Languages

- 🇬🇧 English — default
- 🇺🇦 Ukrainian

The selected language is remembered by the browser between sessions.

## Installation

### Requirements

Docker and Docker Compose:

```bash
docker --version
docker compose version
```

### Download

```bash
git clone https://github.com/RyVolodya/checkflow.git
cd checkflow
```

Alternatively, download the repository as a ZIP archive and extract it.

### Start

```bash
docker compose up -d --build
```

Check the containers:

```bash
docker compose ps
```

Backend logs:

```bash
docker compose logs -f backend
```

### Update

For a normal source update:

```bash
docker compose down
docker compose up -d --build
```

Do **not** use `docker compose down -v` unless you intentionally want to remove the PostgreSQL volume and its data.

### Open CheckFlow

```text
http://SERVER-IP:8088
```

Example:

```text
http://192.168.1.100:8088
```

## Default Login

```text
Username: Manager
Password: manager
```

After the first login, CheckFlow requires the default password to be changed.

> Do not continue using the default password in a production environment.

## Docker Architecture

CheckFlow runs as separate Docker services connected through the shared `checkflow_net` network:

- **frontend** — React/Vite application served by Nginx
- **backend** — Node.js/Express API with Prisma
- **db** — PostgreSQL 17

PostgreSQL data and uploaded checklist photos use persistent Docker volumes. Rebuilding the containers does not remove persistent data.

## Technology Stack

- React
- TypeScript
- Vite
- Node.js
- Express
- Prisma
- PostgreSQL 17
- Nginx
- Docker Compose

## Current Version

**CheckFlow v0.9.2**

Recent development includes Templates, custom recurrence, Groups, Efficiency analytics, completion timestamps for tasks/checklist items, automatic checklist completion, and matching sorting controls for Cards and Columns views.

## Project Status

CheckFlow is under active development and is evolving into a self-hosted workspace for managing tasks, recurring processes, employee groups, assignments, deadlines, notifications, performance analytics and work history.
