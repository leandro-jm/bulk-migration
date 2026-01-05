# Bulk Migration

Manage and execute PostgreSQL database migrations between environments with confidence. Configure connections, rule presets, execute, and report migrations.

<h3>Connections, rule presets, execute, and report migrations</h3>
<img width="100%" src="screenshots/bulk-migration-gui5.png"></a>

## 📑 Table of Contents

- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [Quick Start with Docker](#-quick-start-with-docker)
- [Installation - Backend](#-installation-back-end)
- [Installation - Frontend](#-installation-front-end)
- [Project Structure](#-project-structure)
- [API Endpoints](#-api-endpoints)
- [Migration Rules](#-migration-rules)
- [Security](#-security)
- [Troubleshooting](#-troubleshooting)
- [Logs](#-logs)
- [Production Deploy](#-production-deploy)
- [Contributing](#-contributing)
- [License](#-license)
- [Authors](#-authors)

## 🚀 Features

### Backend (Node.js + Express)
- ✅ Complete REST API
- ✅ PostgreSQL connection management
- ✅ Migration execution with multiple strategies
- ✅ Detailed logging system
- ✅ Reports and statistics

### Frontend (React)
- ✅ Dashboard with statistics
- ✅ Visual connection management
- ✅ Configure Rule presets
- ✅ Migration configuration per collection
- ✅ Modern and responsive interface
- ✅ Report visualization

## 📋 Prerequisites

### For Docker (Recommended)
- Docker 20+
- Docker Compose 2+

### For Manual Installation
- Node.js 18+ (Backend) / Node.js 20+ (Frontend)
- PostgreSQL 12+
- npm or yarn

### TODO
- ✅ Rollback support (structure ready)

## 🐳 Quick Start with Docker

The easiest way to run the entire application is using Docker Compose.

### 1. Clone the repository

```bash
git clone git@github.com:leandro-jm/bulk-migration.git
cd bulk-migration
```

### 2. Start all services

```bash
docker compose up -d
```

This will start:
- **Backend**: http://localhost:3001
- **Frontend**: http://localhost:3000
- **PostgreSQL Database**: localhost:5432

### 3. View logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

### 4. Stop services

```bash
# Stop containers (keeps data)
docker compose stop

# Stop and remove containers (keeps data)
docker compose down

# Stop, remove containers and volumes (removes all data)
docker compose down -v
```

### Docker Services Configuration

The `docker-compose.yml` includes:

**Backend Service:**
- Port: 3001
- Auto-connects to PostgreSQL
- Environment variables pre-configured
- Hot-reload enabled (development mode)

**Frontend Service:**
- Port: 3000
- Built with Vite + React
- Hot-reload enabled
- Pre-configured to connect to backend

**Database Service:**
- PostgreSQL 16 Alpine
- Port: 5432
- User: `nocobase`
- Password: `nocobase`
- Database: `bulk_migration`
- Data persisted in Docker volume

### Rebuilding after code changes

```bash
# Rebuild specific service
docker compose up -d --build backend
docker compose up -d --build frontend

# Rebuild all services
docker compose up -d --build
```

### Publishing to Docker Hub

If you want to publish your images to Docker Hub with **multi-platform support** (amd64 + arm64):

**Why multi-platform?**
- ✅ Works on Intel/AMD processors (amd64) - most cloud servers
- ✅ Works on Apple Silicon M1/M2/M3 (arm64) - Mac development
- ✅ Works on ARM servers (arm64) - AWS Graviton, Oracle Cloud, etc.
- ✅ Single image tag works on all platforms automatically

#### Quick method (Recommended)

Use the automated script that builds for both amd64 and arm64:

```bash
# Publish as 'latest' (multi-platform)
./publish-docker.sh

# Publish with specific version tag (multi-platform)
./publish-docker.sh v1.0.0
```

The script will:
1. Check Docker Hub login and Docker Buildx availability
2. Create/use a multi-platform builder
3. Build images for **linux/amd64** and **linux/arm64**
4. Tag images (latest + version if specified)
5. Push all images to Docker Hub

**Verify multi-platform support:**
```bash
docker buildx imagetools inspect leandrojm/bulk-migration-backend:latest
docker buildx imagetools inspect leandrojm/bulk-migration-frontend:latest
```

#### Manual method (Multi-platform)

If you prefer to do it manually with multi-platform support:

**1. Login to Docker Hub**

```bash
docker login
```

**2. Create a buildx builder**

```bash
# Create a new builder instance
docker buildx create --name multiplatform --use

# Bootstrap the builder
docker buildx inspect --bootstrap
```

**3. Build and push for multiple platforms**

```bash
# Backend - build for amd64 and arm64
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag leandrojm/bulk-migration-backend:latest \
  --tag leandrojm/bulk-migration-backend:v1.0.0 \
  --push \
  ./bulk-migration-backend

# Frontend - build for amd64 and arm64
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag leandrojm/bulk-migration-frontend:latest \
  --tag leandrojm/bulk-migration-frontend:v1.0.0 \
  --push \
  ./bulk-migration-frontend
```

**Note:** The `--push` flag is required when building for multiple platforms.

### Using published images from Docker Hub

To use the published images without building locally, use the production compose file:

```bash
# Pull and start services using pre-built images
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Stop services
docker compose -f docker-compose.prod.yml down
```

This will pull the images directly from Docker Hub:
- `leandrojm/bulk-migration-backend:latest`
- `leandrojm/bulk-migration-frontend:latest`


## 🔧 Installation BACK-END

### 1. Clone the repository

```bash
git clone git@github.com:leandro-jm/bulk-migration.git
cd bulk-migration
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Create a `.env` file in the project root:

```env
PORT=3001
NODE_ENV=development
LOG_LEVEL=debug

# Main application database
APP_DB_HOST=localhost
APP_DB_PORT=5432
APP_DB_NAME=bulk_migration
APP_DB_USER=postgres
APP_DB_PASSWORD=postgres
```

### 4. Create the database

```bash
# PostgreSQL CLI
psql -U postgres
CREATE DATABASE bulk_migration;
\q
```

### 5. Start the server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server will be running at `http://localhost:3001`

## 📁 Project Structure

```
bulk-migration/
├── config/
│   ├── database.js          # Database configuration
│   └── logger.js            # Logging system
├── routes/
│   ├── connections.js       # Connection routes
│   ├── migrations.js        # Migration routes
│   └── reports.js           # Report routes
├── services/
│   ├── connectionService.js # Connection logic
│   └── migrationService.js  # Migration logic
├── scripts/
│   ├── setup.sh            # Setup script
│   ├── create-db.sql       # Initial SQL
│   └── test-setup.js       # Setup test
├── logs/                    # Application logs
├── .env                     # Environment variables
├── server.js               # Main server
└── package.json
```

## 🔌 API Endpoints

### Connections

```
GET    /api/connections              # List all connections
POST   /api/connections              # Create new connection
POST   /api/connections/test         # Test a connection
GET    /api/connections/:id/collections  # List collections
DELETE /api/connections/:id          # Remove connection
```

### Migrations

```
GET    /api/migrations               # List all migrations
GET    /api/migrations/:id           # Migration details
POST   /api/migrations/execute       # Execute migration
POST   /api/migrations/:id/rollback  # Perform rollback
```

### Reports

```
GET    /api/reports/stats            # General statistics
GET    /api/reports/:id/export       # Export report
```

## 🎯 Migration Rules

### Schema Only
Migrates only table structure (no data)

### Overwrite (Truncate and Insert)
- Recreates table structure
- Removes all existing data (TRUNCATE)
- Inserts all data from source

### Upsert
- Recreates structure if necessary
- Inserts new records
- Updates existing records (based on primary key)

### Insert Ignore
- Recreates structure if necessary
- Inserts only non-existing records
- Ignores duplicate key errors


## 🔐 Security

⚠️ **IMPORTANT**: In production, you should:

1. **Encrypt passwords in database**
   - Use bcrypt or similar for password hashing
   - Never store passwords in plain text

2. **Add authentication**
   - Implement JWT or sessions
   - Protect all sensitive routes

3. **Input validation**
   - Validate all input data
   - Sanitize SQL queries

4. **Rate limiting**
   - Limit requests per IP/user
   - Prevent DDoS attacks

5. **Mandatory HTTPS**
   - Use SSL certificates
   - Redirect HTTP to HTTPS

## 🐛 Troubleshooting

### PostgreSQL connection error

```bash
# Check if PostgreSQL is running
sudo service postgresql status

# Check credentials in .env
cat .env
```

### Tables are not created

```bash
# Check logs
tail -f logs/combined.log
```

## 📝 Logs

Logs are saved in:
- `logs/error.log` - Errors only
- `logs/combined.log` - All logs

```bash
# View real-time logs
tail -f logs/combined.log

# Filter errors
grep ERROR logs/combined.log
```

## 🚀 Production Deploy

### Using PM2

```bash
npm install -g pm2

# Start the application
pm2 start server.js --name bulk-migration

# Configure auto-restart
pm2 startup
pm2 save
```

### Using Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

EXPOSE 3001
CMD ["node", "server.js"]
```

## 🔧 Installation FRONT-END

## File Structure

```
migration-manager-frontend/
├── public/
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navigation.tsx      
│   │   │   └── index.ts
│   │   └── views/
│   │       ├── DashboardView.tsx   
│   │       ├── ConnectionsView.tsx 
│   │       ├── MigrationsView.tsx  
│   │       ├── ReportsView.tsx     
│   │       └── index.ts
│   ├── services/
│   │   └── api.ts                  
│   ├── types/
│   │   └── index.ts                
│   ├── App.tsx                     
│   ├── index.tsx                   
│   ├── index.css
│   └── vite-env.d.ts
├── .env
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 🚀 Quick Setup

### 1. Clone the repository

```bash
git clone git@github.com:leandro-jm/bulk-migration.git
cd bulk-migration
```

### 2. Install dependencies

```bash
npm install lucide-react
npm install -D tailwindcss postcss autoprefixer @types/node
npx tailwindcss init -p
```

### 3. Configure environment variables

**.env:**
```env
VITE_API_URL=http://localhost:3001/api
```

### 4. Run

```bash
npm run dev
```

## 🔧 Useful Commands

```bash
# Development
npm run dev

# Build
npm run build

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

---


## 🤝 Contributing

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is under the MIT license.

## 👥 Authors

- Leandro Martins - [@leandro-jm](https://github.com/leandro-jm)
- https://www.linkedin.com/in/leandrojmartins/

## 🙏 Acknowledgments

- No-code tools migrations
- PostgreSQL Community
- Express.js and Knex.js
- Name project inspired in film Interstellar :)

---
