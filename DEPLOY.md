# Production Deployment Guide (DEPLOY.md)

This document provides step-by-step instructions to deploy the Cab Booking Platform to production across **Vercel** (Frontend), **Railway / Render / Fly.io** (Backend API & WebSockets), **Supabase** (PostgreSQL with PostGIS), and **Upstash** (Serverless Redis).

---

## 1. Database Setup (Supabase PostgreSQL)
1. Create a new project in [Supabase](https://supabase.com).
2. Under **Project Settings > Database**, enable the **PostGIS** extension if needed:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
3. Copy the Transaction/Session Connection String:
   ```
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?schema=public"
   ```
4. Run Prisma schema migration:
   ```bash
   npx prisma db push
   # Or for migration tracking:
   npx prisma migrate deploy
   ```
5. Seed initial data:
   ```bash
   pnpm seed
   ```

---

## 2. Realtime Redis Setup (Upstash)
1. Create a Redis database in [Upstash](https://upstash.com).
2. Copy the connection string:
   ```
   REDIS_URL="rediss://default:[YOUR-PASSWORD]@[YOUR-ENDPOINT].upstash.io:6379"
   ```

---

## 3. Deploy Backend API (`apps/api`) to Railway / Render / Fly.io

### Deploying to Railway:
1. Connect your GitHub repository to [Railway](https://railway.app).
2. Set the Root Directory to `apps/api` (or deploy from root using Railway monorepo config).
3. Set the Build Command:
   ```bash
   pnpm install && npx prisma generate && pnpm --filter @cab-app/shared build && pnpm --filter @cab-app/api build
   ```
4. Set the Start Command:
   ```bash
   node apps/api/dist/server.js
   ```
5. Configure Environment Variables in Railway:
   - `PORT=4000`
   - `NODE_ENV=production`
   - `DEMO_MODE=false` (or `true` for demo sandbox)
   - `DATABASE_URL=...` (from Supabase)
   - `REDIS_URL=...` (from Upstash)
   - `CLERK_SECRET_KEY=sk_live_...`
   - `STRIPE_SECRET_KEY=sk_live_...`
   - `STRIPE_WEBHOOK_SECRET=whsec_...`
   - `MAP_PROVIDER=osm` (or `google` with `GOOGLE_MAPS_API_KEY`)
   - `NEXT_PUBLIC_APP_URL=https://your-cab-app.vercel.app`
6. Railway provides a public HTTPS & WSS domain (e.g. `https://cab-api-production.up.railway.app`).

---

## 4. Deploy Frontend Web (`apps/web`) to Vercel
1. In [Vercel](https://vercel.com), import your Git repository.
2. Set the Root Directory to `apps/web`.
3. Framework Preset: **Next.js**.
4. Configure Environment Variables in Vercel:
   - `NEXT_PUBLIC_API_URL=https://cab-api-production.up.railway.app`
   - `NEXT_PUBLIC_SOCKET_URL=https://cab-api-production.up.railway.app`
   - `NEXT_PUBLIC_APP_URL=https://your-cab-app.vercel.app`
   - `NEXT_PUBLIC_MAP_PROVIDER=osm`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`
5. Click **Deploy**.

---

## 5. Webhooks Configuration
1. **Clerk Webhook:**
   - Go to Clerk Dashboard > Webhooks > Add Endpoint.
   - Endpoint URL: `https://cab-api-production.up.railway.app/api/v1/webhooks/clerk`.
   - Subscribe to `user.created`, `user.updated`.
2. **Stripe Webhook:**
   - Go to Stripe Dashboard > Developers > Webhooks > Add endpoint.
   - Endpoint URL: `https://cab-api-production.up.railway.app/api/v1/webhooks/stripe`.
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`.

---

## 6. Docker Deployment (Alternative Self-Hosted)
To run everything locally or on a VPS (EC2/DigitalOcean) in Docker:
```bash
docker compose up -d --build
```
This starts PostgreSQL, Redis, API (port 4000), and Web (port 3000) simultaneously with health checks.
