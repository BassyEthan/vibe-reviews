# Database Setup Guide

## Current Status

**✅ Database is already created!** The schema and migrations exist, and the database has been set up.

## Database Location

The database connection is configured via the `DATABASE_URL` environment variable in your `.env` files. To verify your setup:

1. **Check if DATABASE_URL is set** in `mcp-server/.env` and `data-pipeline/.env`
2. **Verify migrations are applied** (see Verification section below)
3. **Test the connection** using Prisma Studio or connection test

## Database Schema

The Prisma schema (`mcp-server/prisma/schema.prisma`) defines:

- **`places`** - Restaurant/place data (permanent cache)
- **`photos`** - Restaurant photos (permanent cache)
- **`reviews`** - User reviews/tips (TTL cache, 30-90 days)
- **`enrichment_jobs`** - Background job tracking
- **`provider_rate_limits`** - API rate limit tracking

## Setup Options

### Option 1: Local PostgreSQL (Recommended for Development)

**1. Install PostgreSQL:**
```bash
# macOS (using Homebrew)
brew install postgresql@14
brew services start postgresql@14

# Or use Docker
docker run --name vibe-reviews-db \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=vibe_reviews \
  -p 5432:5432 \
  -d postgres:14
```

**2. Create Database:**
```bash
# Connect to PostgreSQL
psql postgres

# Create database
CREATE DATABASE vibe_reviews;

# Exit
\q
```

**3. Set Environment Variable:**
```bash
# In mcp-server/.env
DATABASE_URL="postgresql://username:password@localhost:5432/vibe_reviews"

# In data-pipeline/.env (optional, for embedder.py)
DATABASE_URL="postgresql://username:password@localhost:5432/vibe_reviews"
```

**4. Run Migrations:**
```bash
cd mcp-server
npx prisma migrate deploy
# Or for development:
npx prisma migrate dev
```

### Option 2: Cloud PostgreSQL (Recommended for Production)

**Popular Options:**
- **Neon** (Free tier): https://neon.tech
- **Supabase** (Free tier): https://supabase.com
- **Railway** (Free tier): https://railway.app
- **Render** (Free tier): https://render.com
- **AWS RDS** (Paid)
- **Google Cloud SQL** (Paid)

**Example with Neon (Free):**
1. Sign up at https://neon.tech
2. Create a new project
3. Copy the connection string (looks like):
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/vibe_reviews?sslmode=require
   ```
4. Set `DATABASE_URL` in your `.env` files
5. Run migrations: `npx prisma migrate deploy`

## Current Configuration

### MCP Server (`mcp-server/.env`)
```bash
# REQUIRED - Database connection string
DATABASE_URL="postgresql://user:password@host:5432/database_name"
```

**Status:** Currently **REQUIRED** by `mcp-server/src/config/env.ts` (line 10)

### Data Pipeline (`data-pipeline/.env`)
```bash
# OPTIONAL - Falls back to JSON files if not set
DATABASE_URL="postgresql://user:password@host:5432/database_name"
```

**Status:** Currently **OPTIONAL** - `embedder.py` will use JSON files if not set

## Database Usage

### Current Flow (Without Database)
```
scraper.py → JSON files → embedder.py → JSON files → upsert_pinecone.py → Pinecone
```

### Future Flow (With Database)
```
scraper.py → Database → embedder.py → Database → upsert_pinecone.py → Pinecone
```

## Prisma Commands

**Generate Prisma Client:**
```bash
cd mcp-server
npx prisma generate
```

**Run Migrations:**
```bash
# Development (creates migration file)
npx prisma migrate dev

# Production (applies existing migrations)
npx prisma migrate deploy
```

**View Database in Browser:**
```bash
npx prisma studio
# Opens at http://localhost:5555
```

**Reset Database (⚠️ DESTRUCTIVE):**
```bash
npx prisma migrate reset
```

## Verification

**Check if database is connected:**
```bash
cd mcp-server
npx prisma db pull  # Tries to connect and fetch schema
```

**Check migration status:**
```bash
cd mcp-server
npx prisma migrate status  # Shows which migrations are applied
```

**View database in browser:**
```bash
cd mcp-server
npx prisma studio
# Opens at http://localhost:5555 - you can see all tables and data
```

**Test connection from Python:**
```python
# In data-pipeline/
python3 -c "
from embedder import DatabaseConnection
db = DatabaseConnection()
if db.conn:
    print('✅ Database connected!')
    db.close()
else:
    print('❌ Database not connected (using JSON fallback)')
"
```

**Quick verification checklist:**
- [ ] `DATABASE_URL` is set in `mcp-server/.env`
- [ ] `DATABASE_URL` is set in `data-pipeline/.env` (optional, for embedder)
- [ ] Migrations have been applied: `npx prisma migrate status`
- [ ] Can connect: `npx prisma studio` opens successfully
- [ ] Tables exist: Check Prisma Studio for `places`, `photos`, `reviews`, etc.

## Troubleshooting

### Error: "DATABASE_URL is required"
- **Solution:** Set `DATABASE_URL` in `mcp-server/.env`

### Error: "Connection refused"
- **Solution:** Check if PostgreSQL is running: `brew services list` or `docker ps`

### Error: "Database does not exist"
- **Solution:** Create the database: `CREATE DATABASE vibe_reviews;`

### Error: "Migration failed"
- **Solution:** Check if tables already exist, may need to reset: `npx prisma migrate reset`

## Quick Start (Local PostgreSQL)

```bash
# 1. Install PostgreSQL (if not installed)
brew install postgresql@14
brew services start postgresql@14

# 2. Create database
createdb vibe_reviews

# 3. Set environment variable
cd mcp-server
echo 'DATABASE_URL="postgresql://$(whoami)@localhost:5432/vibe_reviews"' >> .env

# 4. Run migrations
npx prisma migrate deploy

# 5. Verify
npx prisma studio
```

## Next Steps

1. **Choose setup option** (local or cloud)
2. **Create PostgreSQL database**
3. **Set `DATABASE_URL` in `.env` files**
4. **Run Prisma migrations**
5. **Verify connection** with `npx prisma studio`

Once set up, the database will be used for:
- Storing restaurant data from Foursquare
- Storing reviews with TTL (time-to-live)
- Storing photos
- Background job tracking
- Rate limit tracking
