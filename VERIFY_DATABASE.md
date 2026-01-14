# Database Verification Guide

Since your database is already created, use these commands to verify everything is set up correctly:

## Quick Verification

### 1. Check Environment Variables
```bash
# Check MCP server .env
cd mcp-server
cat .env | grep DATABASE_URL

# Check data pipeline .env (optional)
cd ../data-pipeline
cat .env | grep DATABASE_URL
```

### 2. Test Prisma Connection
```bash
cd mcp-server
npx prisma db pull --print
```
**Expected:** Should connect and show your database schema

### 3. Check Migration Status
```bash
cd mcp-server
npx prisma migrate status
```
**Expected:** Should show migrations as "Applied" or "Already applied"

### 4. Open Prisma Studio (Visual Database Browser)
```bash
cd mcp-server
npx prisma studio
```
**Expected:** Opens browser at http://localhost:5555 showing all tables

### 5. Test Python Connection
```bash
cd data-pipeline
python3 -c "
import os
from dotenv import load_dotenv
load_dotenv()
from embedder import DatabaseConnection

db = DatabaseConnection()
if db.conn:
    print('✅ Database connected successfully!')
    print(f'   Connection: {db.database_url[:30]}...')
    db.close()
else:
    print('❌ Database not connected')
    print('   Will use JSON files as fallback')
"
```

## What You Should See

### In Prisma Studio:
- **`places`** table (empty or with restaurant data)
- **`photos`** table (empty or with photo data)
- **`reviews`** table (empty or with review data)
- **`enrichment_jobs`** table (for background jobs)
- **`provider_rate_limits`** table (for API rate tracking)

### If Database is Working:
- ✅ Prisma commands succeed
- ✅ Prisma Studio opens
- ✅ Python can connect
- ✅ Tables are visible

### If Database Needs Setup:
- ❌ Error: "Environment variable not found: DATABASE_URL"
- ❌ Error: "Connection refused"
- ❌ Error: "Database does not exist"

## Next Steps

Once verified, you can:
1. **Scrape restaurants** → Data goes to database (if configured) or JSON files
2. **Generate embeddings** → Reads from database (if DATABASE_URL set) or JSON files
3. **View data** → Use Prisma Studio to browse restaurants, reviews, photos

## Troubleshooting

**If DATABASE_URL is missing:**
- Add it to `mcp-server/.env`: `DATABASE_URL="postgresql://user:pass@host:5432/dbname"`
- Add it to `data-pipeline/.env` (optional, for embedder.py)

**If migrations not applied:**
```bash
cd mcp-server
npx prisma migrate deploy
```

**If connection fails:**
- Check PostgreSQL is running: `brew services list` or `docker ps`
- Verify connection string format
- Check firewall/network settings (for cloud databases)
