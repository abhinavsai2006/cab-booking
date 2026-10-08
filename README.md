# Cab Booking Platform (Uber / Ola Clone)

A complete, production-grade, full-stack ride-hailing platform built with Next.js 14, Express, Socket.IO, PostgreSQL, Prisma, Redis, Leaflet/OSM, Stripe, and Clerk.

---

## 🚀 Quick Start (Zero-Key Demo Mode)

The entire platform runs out-of-the-box locally with zero paid keys required.

### 1. Prerequisites
- Node.js >= 18 (Node 22 recommended)
- `pnpm` (`npm i -g pnpm`)
- PostgreSQL (running locally on port 5432, or Supabase, or Docker)

### 2. Installation
```bash
# Clone and enter workspace
pnpm install
```

### 3. Database Setup
```bash
# Push Prisma schema to your PostgreSQL database
npx prisma db push

# Seed demo users, drivers, vehicles, fares, surge zones, promos & history
pnpm seed
```

### 4. Running the Platform
```bash
# Run both Backend API (port 4000) and Web App (port 3000) concurrently:
pnpm dev
```

- **Rider App:** [http://localhost:3000](http://localhost:3000)
- **Driver App:** [http://localhost:3000/driver](http://localhost:3000/driver)
- **Admin Console:** [http://localhost:3000/admin](http://localhost:3000/admin)
- **Backend API:** [http://localhost:4000/api/v1](http://localhost:4000/api/v1)

### 5. Running the Autonomous Driver Simulator
```bash
# Simulates online drivers, auto-accepts incoming ride requests, and moves vehicles live
pnpm simulate
```

---

## 📦 Project Structure

```
├── apps/
│   ├── api/             # Express + Socket.IO realtime server
│   └── web/             # Next.js 14 App Router (Rider, Driver, Admin)
├── packages/
│   ├── shared/          # Types, Zod schemas, pure Fare Engine, MapProvider
│   └── ui/              # BottomSheet, RatingStars, CountdownRing, StatusBadge, Modals
├── prisma/              # Prisma schema, migrations, seed script
├── scripts/             # Driver simulator
├── docker-compose.yml   # Multi-container Docker deployment
└── DECISIONS.md         # Architecture & engineering decision log
```

---

## 🛠️ Testing
```bash
# Run test suite
pnpm test
```
