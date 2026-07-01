# SQLite as the primary database

The app runs as a single-instance deployment (Azure App Service, one file-backed DB at `$HOME/data/nhlstats.db`) for a small, known set of users tracking a hobby stats league — not a multi-tenant or high-concurrency workload. SQLite was chosen over Postgres/SQL Server to avoid running and paying for a separate managed database service, at the cost of no built-in replication and file-based backup being the only durability story (see `docs/DATABASE.md` backup section).
