# CheckFlow v0.6.0

Web application for employee checklists and tasks.

## v0.6.0
- Login fields are empty by default; users enter their own username and password.
- A MANAGER/ADMIN who created a task or checklist can postpone their own record directly by choosing a new deadline and writing a reason/comment; no self-approval request is created.
- Cards and details show who created the task/checklist.
- Header shows the current date and 24-hour time.
- Dashboard wording uses **В роботі** and includes a dedicated **В роботі** filter.
- Employees see an in-app warning when assigned records expire within the next 24 hours.
- Telegram notifications: new assignments, approved/rejected postponements, direct deadline changes and a one-time reminder within 24 hours of the deadline.
- Admin can store an optional Telegram Chat ID for each user.

## Telegram setup
1. Create a Telegram bot using **@BotFather** and obtain its bot token.
2. On the server create a `.env` file next to `docker-compose.yml`:

```env
TELEGRAM_BOT_TOKEN=123456789:YOUR_BOT_TOKEN
```

3. Restart CheckFlow.
4. Each employee who should receive Telegram notifications must first open the bot in Telegram and send `/start`.
5. Enter that employee's numeric **Telegram Chat ID** in **Користувачі → Редагувати**.

The Telegram integration is optional. If `TELEGRAM_BOT_TOKEN` or a user's Chat ID is empty, CheckFlow continues to work normally without Telegram notifications.

## Upgrade
Existing PostgreSQL data is retained. `prisma db push` adds the new optional Telegram field and notification log table.

```bash
docker compose down
docker compose up -d --build
```

Do not use `docker compose down -v` unless you intentionally want to delete the database volume.


## v0.6.0 — English / Ukrainian UI
- English is the default interface language.
- EN/UA switcher is available on the login page and in the application header.
- The selected language is stored in browser localStorage as `cf_lang` and persists across sessions.
- Date/time formatting follows the selected language and uses 24-hour time.
- Existing backend/API/database logic is unchanged.
