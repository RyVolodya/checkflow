# CheckFlow

**CheckFlow --- Your Workspace**

CheckFlow is a lightweight, self-hosted web application for managing
employee tasks and checklists. It is designed for teams that need a
simple way to assign work, track deadlines, monitor completion, and keep
a history of completed or overdue activities.

The interface is fully responsive and works on desktop computers,
laptops, tablets, and mobile devices.

**Languages:** English / Ukrainian\
**Deployment:** Docker Compose\
**Database:** PostgreSQL

![CheckFlow Screenshot](docs/images/checkflow.png)

------------------------------------------------------------------------

## Features

### Tasks & Checklists

CheckFlow supports two types of work items:

-   **Tasks** --- individual assignments with a description, start date,
    and deadline.
-   **Checklists** --- assignments containing multiple items that
    employees complete individually.

Administrators and managers can:

-   Create tasks and checklists
-   Add descriptions
-   Set start date and time
-   Set deadline date and time
-   Assign one or multiple employees
-   Edit existing tasks and checklists
-   Create recurring checklists
-   Require photos for specific checklist items
-   Monitor completion progress
-   View completed and overdue work

Future tasks can be scheduled in advance and remain in the **Scheduled**
state until their start time.

### Checklist Completion

Employees can mark individual checklist items as completed. If an item
cannot be completed, the employee must specify a reason.

Checklist items can optionally require photo confirmation. When photo
confirmation is enabled, the item cannot be completed without uploading
a photo.

### Task Completion

Employees can mark a task as completed or unable to complete. When
completing a task, an optional comment can be added. If the employee
cannot complete the task, a reason must be provided.

### Deadline Extension Requests

Employees can request a deadline extension for a task or checklist.

A manager or administrator can approve the request and specify a new
deadline, or reject it and keep the original deadline. Deadline changes
are recorded in the comments/history.

Managers or administrators who created the task can change its deadline
directly without approving their own request.

### Multiple Assignees

A task or checklist can be assigned to multiple users.

### Work History

Recently completed and overdue tasks remain visible in the main
workspace for one month. After one month, they are displayed in the
**History** section. Active tasks with future deadlines are not
archived.

History provides filters for search, Task / Checklist, status, employee,
and date range.

### Sorting

Tasks and checklists can be sorted by deadline, start date, or name in
ascending or descending order.

------------------------------------------------------------------------

## User Management

Administrators can create and manage users. Each user can have a name,
username, position, role, password, and Telegram Chat ID.

Available roles:

-   **Employee** --- can view and complete assigned work, add comments,
    upload required photos, and request deadline extensions.
-   **Manager** --- can create and manage tasks/checklists, assign
    employees, review extension requests, and monitor work.
-   **Administrator** --- has full access, including user management.

Administrators can create/edit users, change roles and positions, reset
passwords, block/unblock users, and delete users.

Deleted users are preserved in historical records so previous tasks,
comments, and audit information remain available.

------------------------------------------------------------------------

## Notifications

CheckFlow displays warnings when assigned tasks or checklists are
approaching their deadline.

Optional Telegram notifications can notify employees about:

-   New assignments
-   Upcoming deadlines
-   Approved deadline extensions
-   Rejected deadline extensions
-   Deadline changes

Each employee can have an individual Telegram Chat ID.

------------------------------------------------------------------------

## Telegram Bot Configuration

Create a Telegram bot using **BotFather** and obtain the bot token.

Create a `.env` file in the same directory as `docker-compose.yml`:

``` env
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
```

The Telegram Chat ID for each employee can be configured in CheckFlow
user settings.

> **Important:** Never commit your `.env` file or Telegram bot token to
> a public repository.

Add `.env` to `.gitignore`:

``` gitignore
.env
```

------------------------------------------------------------------------

## Languages

CheckFlow currently supports:

-   🇬🇧 English
-   🇺🇦 Ukrainian

English is the default language. The language can be changed from the
login page or application interface. The selected language is remembered
by the browser between sessions.

------------------------------------------------------------------------

## Light & Dark Themes

CheckFlow provides both light and dark themes with a responsive
interface for desktop and mobile devices.

------------------------------------------------------------------------

# Installation

## Requirements

Make sure Docker and Docker Compose are installed:

``` bash
docker --version
docker compose version
```

## 1. Download CheckFlow

Clone the repository:

``` bash
git clone https://github.com/YOUR-USERNAME/checkflow.git
cd checkflow
```

Alternatively, download the repository as a ZIP archive and extract it.

## 2. Configure Telegram (Optional)

If Telegram notifications are required:

``` bash
nano .env
```

Add:

``` env
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
```

If Telegram notifications are not required, this step can be skipped.

## 3. Start CheckFlow

``` bash
docker compose up -d --build
```

Check containers:

``` bash
docker compose ps
```

View backend logs:

``` bash
docker compose logs -f backend
```

## 4. Open CheckFlow

Open:

``` text
http://SERVER-IP:8088
```

Example:

``` text
http://192.168.1.100:8088
```

------------------------------------------------------------------------

# Default Login

The initial administrator account is:

``` text
Username: Manager
Password: manager
```

After the first login, CheckFlow requires the default password to be
changed.

> **Security:** Do not continue using the default password in a
> production environment.

------------------------------------------------------------------------

# Updating CheckFlow

Before updating, it is recommended to back up PostgreSQL.

``` bash
docker compose down
docker compose up -d --build
```

Do **not** use:

``` bash
docker compose down -v
```

unless you intentionally want to remove Docker volumes and database
data.

------------------------------------------------------------------------

# Technology Stack

-   React
-   TypeScript
-   Vite
-   Node.js
-   Express
-   Prisma
-   PostgreSQL
-   Nginx
-   Docker Compose

------------------------------------------------------------------------

# Data Storage

Application data is stored in PostgreSQL using a persistent Docker
volume. Uploaded checklist photos are also stored persistently.

Stopping or rebuilding containers does not remove this data.

------------------------------------------------------------------------

# Responsive Web Interface

CheckFlow is designed for desktop computers, laptops, tablets, and
smartphones.

Employees can receive assignments, complete checklist items, add
comments, and upload photos directly from a mobile device.

------------------------------------------------------------------------

# Project Status

CheckFlow is under active development.

The project started as a lightweight employee checklist application and
is evolving into a self-hosted workspace for managing tasks, recurring
processes, employee assignments, deadlines, notifications, and work
history.

New functionality and interface improvements will continue to be added.

------------------------------------------------------------------------

## CheckFlow

**Your Workspace.**
