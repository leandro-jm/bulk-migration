# Bulk Migration

Manage and execute PostgreSQL database migrations between environments with confidence. Configure connections, rule presets, execute, and report migrations.

<h3>Connections, rule presets, execute, and report migrations</h3>
<img width="100%" src="../screenshots/bulk-migration-gui5.png"></a>

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
