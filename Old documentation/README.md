# NHLStats Documentation

Welcome to the NHLStats documentation! This folder contains comprehensive guides for understanding, developing, and deploying the NHLStats application.

---

## 📚 Documentation Index

### Getting Started

**New to the project?** Start here:

1. **[Main README](../README.md)** - Project overview and quick start
2. **[Quick Reference](QUICK-REFERENCE.md)** - Fast lookup for commands and info ⚡
3. **[Development Guide](DEVELOPMENT.md)** - Complete setup and development workflow

### Technical Documentation

**For developers working on the codebase:**

- **[Architecture Guide](ARCHITECTURE.md)** - System design, patterns, and technical decisions
- **[API Reference](API.md)** - Complete REST API endpoint documentation
- **[Database Schema](DATABASE.md)** - Database structure, relationships, and migrations

### Operations

**For deployment and production:**

- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment, configuration, and monitoring

### Additional Resources

- **[Quick Reference](QUICK-REFERENCE.md)** - Cheat sheet for common commands ⚡
- **[Documentation Summary](SUMMARY.md)** - Overview of what documentation was created

---

## 🎯 Quick Navigation

### I want to...

**...understand the project**
→ Start with [Architecture Guide](ARCHITECTURE.md)

**...set up my development environment**
→ Follow [Development Guide](DEVELOPMENT.md#project-setup)

**...call an API endpoint**
→ Check [API Reference](API.md)

**...understand the database**
→ Review [Database Schema](DATABASE.md)

**...deploy to production**
→ Follow [Deployment Guide](DEPLOYMENT.md)

**...add a new feature**
→ See [Development Guide - Common Tasks](DEVELOPMENT.md#common-tasks)

**...troubleshoot an issue**
→ Check troubleshooting sections in [Development](DEVELOPMENT.md#troubleshooting) or [Deployment](DEPLOYMENT.md#troubleshooting)

---

## 📖 Document Summaries

### [Architecture Guide](ARCHITECTURE.md)

**What it covers:**
- Clean architecture layers and their responsibilities
- Technology stack (backend & frontend)
- Design patterns and best practices
- Cross-cutting concerns (logging, error handling, security)
- Testing strategy
- Performance considerations

**Best for:** Understanding the "why" and "how" of the codebase structure.

---

### [API Reference](API.md)

**What it covers:**
- All 50+ REST API endpoints across 7 controllers
- Request/response schemas with examples
- HTTP methods, status codes, and error responses
- Enum reference for all domain values
- Validation rules and constraints

**Best for:** Integrating with the API or understanding endpoint contracts.

---

### [Database Schema](DATABASE.md)

**What it covers:**
- All 8 database tables with detailed column descriptions
- Entity-relationship diagram (Mermaid format)
- Foreign key relationships and constraints
- Database views (UserSeasonStats, UserWeeklyStats)
- Complete enum definitions
- Migration history and workflow

**Best for:** Understanding data model and database structure.

---

### [Development Guide](DEVELOPMENT.md)

**What it covers:**
- Prerequisites and initial setup
- Running backend and frontend locally
- Database migration workflow
- Testing (backend integration tests, frontend tests)
- Code style and conventions
- Common development tasks with examples
- Troubleshooting guide

**Best for:** Day-to-day development work and onboarding new developers.

---

### [Deployment Guide](DEPLOYMENT.md)

**What it covers:**
- Environment configuration (staging, production)
- Database setup and connection strings
- Backend deployment (systemd, nginx, Docker)
- Frontend deployment (static hosting, nginx, Docker)
- Docker Compose configuration
- Monitoring, logging, and health checks
- Backup and recovery procedures
- Security checklist

**Best for:** Deploying to staging/production and maintaining live systems.

---

## 🛠️ Additional Resources

### Project Guidelines

Located in `.github/instructions/`:

- **[general.instructions.md](../.github/instructions/general.instructions.md)** - Universal coding guidelines
- **[structure.instructions.md](../.github/instructions/structure.instructions.md)** - Directory structure rules
- **[csharp.instructions.md](../.github/instructions/csharp.instructions.md)** - C# specific conventions
- **[react.instructions.md](../.github/instructions/react.instructions.md)** - React/TypeScript patterns
- **[sql.instructions.md](../.github/instructions/sql.instructions.md)** - SQL and migration guidelines

### External Links

- [ASP.NET Core Documentation](https://docs.microsoft.com/aspnet/core)
- [Entity Framework Core](https://docs.microsoft.com/ef/core)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

## 🤝 Contributing to Documentation

### When to Update Documentation

Update documentation when you:

- Add new features or endpoints
- Change database schema
- Modify architecture or patterns
- Add configuration options
- Discover solutions to common problems

### Documentation Standards

- **Clear and concise** - Use simple language
- **Code examples** - Provide working examples
- **Up-to-date** - Keep in sync with code changes
- **Well-organized** - Use headers and sections
- **Searchable** - Use descriptive terms

### How to Contribute

1. Update relevant `.md` file(s)
2. Use proper Markdown formatting
3. Add code blocks with syntax highlighting
4. Include command examples that work on Linux
5. Submit PR with documentation changes

---

## 📝 Document Changelog

### 2026-03-01

- ✅ Created complete documentation suite:
  - API Reference (50+ endpoints)
  - Database Schema (8 tables, 2 views, 8 enums)
  - Architecture Guide (clean architecture, patterns)
  - Development Guide (setup, workflow, troubleshooting)
  - Deployment Guide (production setup, Docker, monitoring)

---

## 🆘 Getting Help

- **Questions about documentation?** Open a GitHub issue
- **Found an error?** Submit a PR with the fix
- **Need more details?** Request in GitHub Discussions

---

**Last Updated:** March 1, 2026  
**Maintained by:** Singent
