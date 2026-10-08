# Cab Booking App (Uber/Ola Clone) - Master Build Prompt

Paste everything below the line into your AI coding agent (Claude Code, Cursor, etc.) as a single prompt.

---

## 0. ROLE AND OPERATING RULES

You are a senior staff full-stack engineer. Build a **complete, production-grade, working ride-hailing platform** (Uber/Ola style) from an empty folder to a deployed system. Build it end to end in one go, phase by phase, without stopping to ask questions. Where something is ambiguous, choose the sensible default, note it in `DECISIONS.md`, and continue.

Non-negotiable rules:

1. **No placeholders, no TODOs, no mock-only screens.** Every screen is wired to the real API and database. Every button does something.
2. **Run it.** After each phase: install, typecheck, lint, run tests, start the app, and fix every error before moving on. Never report a phase done while it fails.
3. **TypeScript everywhere**, strict mode. Validate all inputs with Zod. Share types between apps via a `packages/shared` workspace.
4. **Seed data and a demo mode** so the whole flow works locally with zero paid keys (see section 12).
5. Commit after every phase with a clear message. Keep a running `README.md` with exact setup commands.
6. Mobile-first responsive UI. The rider and driver apps must feel like native mobile apps (bottom sheets, large tap targets, installable PWA).

## 1. PRODUCT SUMMARY

Three roles on one platform:

- **Rider** - books rides, tracks driver live, pays, rates.
- **Driver** - goes online, receives ride offers, navigates, completes trips, sees earnings.
- **Admin** - manages users, drivers (KYC approval), pricing, promos, rides, payouts, support tickets, SOS alerts.

Target market: India first (INR, UPI/cash/card/wallet, vehicle types Bike, Auto, Mini, Sedan, SUV), but currency, tax and units must be configurable.

## 2. TECH STACK (fixed - do not substitute)

- **Monorepo:** pnpm workspaces + Turborepo.
- **`apps/web`:** Next.js 14 (App Router) + React + TypeScript + Tailwind CSS + shadcn/ui + Zustand + TanStack Query. Contains the Rider app (`/`), Driver app (`/driver`), Admin console (`/admin`), all role-guarded. PWA manifest + service worker.
- **`apps/api`:** Node.js + Express + TypeScript, REST + **Socket.IO** for realtime. Zod validation, Pino logging, Helmet, CORS, rate limiting.
- **Database:** PostgreSQL with **PostGIS** (Supabase Postgres or local Docker). ORM: **Prisma** (use raw SQL for geo queries). **Redis** (Upstash or local Docker) for live driver locations (GEO commands), socket presence, offer timeouts, rate limits and BullMQ queues.
- **Auth:** **Clerk** (email, phone OTP, Google social). Roles stored in Clerk `publicMetadata.role` and mirrored in the `User` table through a Clerk webhook. Backend verifies Clerk JWTs on every request and on socket handshake.
- **Payments:** **Stripe** (PaymentIntents, saved cards via SetupIntents, Stripe Connect Express for driver payouts, webhooks) plus **Cash** and in-app **Wallet** (top-up via Stripe). UPI via Stripe where available.
- **Maps:** Abstract behind a `MapProvider` interface in `packages/shared`. Implement **Leaflet + OpenStreetMap tiles + Nominatim (geocoding/autocomplete) + OSRM (routing, ETA, distance)** as the default free provider, and a **Google Maps** implementation switchable by env `MAP_PROVIDER=google|osm`.
- **Notifications:** Web Push (VAPID), in-app toasts, email via Resend (receipts, OTP fallbacks), optional SMS via Twilio for SOS.
- **Files:** Supabase Storage (or S3-compatible) for profile photos and driver documents.
- **Testing:** Vitest (unit), Supertest (API integration), Playwright (end-to-end full ride flow).
- **DevOps:** Docker Compose for local (postgres+postgis, redis, api, web), GitHub Actions CI, deploy web to **Vercel**, api to **Railway/Render/Fly**, DB on **Supabase**, Redis on **Upstash**.

## 3. REPOSITORY STRUCTURE

```
cab-app/
  apps/
    web/            # Next.js (rider, driver, admin)
    api/            # Express + Socket.IO
  packages/
    shared/         # Zod schemas, types, constants, fare utils, MapProvider interface
    ui/             # shared components (BottomSheet, MapView, RatingStars, etc.)
  prisma/           # schema.prisma, migrations, seed.ts
  docker-compose.yml
  .env.example
  DECISIONS.md  README.md
```

## 4. DATA MODEL (implement in Prisma + PostGIS)

Create all tables with indexes and foreign keys:

- **User**: id, clerkId (unique), role (RIDER|DRIVER|ADMIN), name, email, phone, photoUrl, status (ACTIVE|SUSPENDED), walletBalance, stripeCustomerId, language, createdAt.
- **EmergencyContact**: id, userId, name, phone.
- **SavedPlace**: id, userId, label (Home|Work|Other), address, lat, lng.
- **PaymentMethod**: id, userId, type (CARD|UPI|WALLET|CASH), stripePaymentMethodId, brand, last4, isDefault.
- **DriverProfile**: userId, kycStatus (PENDING|APPROVED|REJECTED), licenseNo, licenseUrl, rcUrl, insuranceUrl, aadhaarOrIdUrl, isOnline, currentLocation (geography Point), heading, ratingAvg, ratingCount, acceptanceRate, completedTrips, stripeConnectId, payoutsEnabled.
- **Vehicle**: id, driverId, type (BIKE|AUTO|MINI|SEDAN|SUV), make, model, color, plateNo, year, seats.
- **FareConfig** (per vehicle type + city): baseFare, perKm, perMinute, minFare, bookingFee, cancellationFee, waitingPerMin, nightMultiplier, nightStart, nightEnd, taxPercent, currency.
- **SurgeZone**: id, polygon (geography), multiplier, active, source (MANUAL|AUTO).
- **Ride**: id, riderId, driverId?, vehicleType, status (see state machine), pickup{address,lat,lng}, dropoff{address,lat,lng}, stops (JSON array up to 3), routePolyline, distanceKm, durationMin, estimatedFare, finalFare, fareBreakdown (JSON), surgeMultiplier, promoId?, discount, paymentMethod, paymentStatus, otp (4-digit), scheduledAt?, requestedAt, acceptedAt, arrivedAt, startedAt, completedAt, cancelledAt, cancelledBy, cancelReason, cancellationFee.
- **RideOffer**: id, rideId, driverId, status (SENT|ACCEPTED|DECLINED|EXPIRED), sentAt, respondedAt, distanceToPickupKm.
- **RideLocationPoint**: rideId, driverId, location, recordedAt (for trip replay, partitioned/pruned).
- **Payment**: id, rideId, userId, amount, currency, method, stripePaymentIntentId, status, refundedAmount, createdAt.
- **WalletTransaction**: id, userId, type (TOPUP|RIDE|REFUND|PAYOUT|PROMO), amount, balanceAfter, refId.
- **DriverEarning**: id, rideId, driverId, gross, commission, tip, net, payoutId?.
- **Payout**: id, driverId, amount, status, stripeTransferId, periodStart, periodEnd.
- **Rating**: id, rideId, fromUserId, toUserId, stars (1-5), tags\[\], comment.
- **PromoCode**: id, code, type (PERCENT|FLAT), value, maxDiscount, minFare, usageLimit, perUserLimit, validFrom, validTo, vehicleTypes\[\], firstRideOnly, active.
- **PromoRedemption**: id, promoId, userId, rideId.
- **Notification**: id, userId, title, body, type, data, readAt.
- **SupportTicket** + **TicketMessage**: category (PAYMENT|LOST\_ITEM|DRIVER\_BEHAVIOR|SAFETY|APP\_BUG|OTHER), status (OPEN|IN\_PROGRESS|RESOLVED), rideId?, messages.
- **SosAlert**: id, rideId, userId, location, status (ACTIVE|ACKNOWLEDGED|RESOLVED), createdAt.
- **AuditLog**: id, actorId, action, entity, entityId, diff, createdAt.
- **PushSubscription**: userId, endpoint, keys.

Add GiST indexes on all geography columns and composite indexes on (status, createdAt) for Ride.

## 5. RIDE STATE MACHINE (enforce server-side, reject illegal transitions)

`REQUESTED -> SEARCHING -> DRIVER_ASSIGNED -> DRIVER_ARRIVED -> IN_PROGRESS -> COMPLETED` Also: `SEARCHING -> NO_DRIVERS_FOUND`, any pre-start state `-> CANCELLED_BY_RIDER | CANCELLED_BY_DRIVER`, `SCHEDULED -> SEARCHING` (at T-10 min via BullMQ delayed job).

Every transition: writes timestamps, emits a socket event to rider, driver and admin rooms, creates a Notification, and is wrapped in a DB transaction with row locking (`SELECT ... FOR UPDATE`) so two drivers can never accept the same ride.

## 6. CORE ALGORITHMS

**Fare engine** (`packages/shared/fare.ts`, pure and unit-tested): `fare = max(minFare, baseFare + perKm*distance + perMin*duration + bookingFee) * surge * nightMultiplier`, then promo discount, then tax. Return a full breakdown object. Final fare on completion is recomputed from actual distance/time (GPS trace), capped at 1.5x the estimate unless the rider changed the destination. Waiting charge after 3 free minutes at pickup. Multi-stop adds distance and per-stop fee.

**Matching (dispatch):**

1. Query Redis GEO for online, idle, approved drivers of the requested vehicle type within a radius (start 3 km, expand to 5 then 8 km).
2. Rank by score = 0.6 \* ETA-to-pickup (OSRM) + 0.2 \* rating + 0.2 \* acceptance rate.
3. Send offers sequentially to the best driver with a **15-second** timeout (BullMQ delayed job + socket event + web push). On decline/expire, offer the next driver, skipping those already offered. After 5 attempts or 90 seconds total, mark `NO_DRIVERS_FOUND` and notify the rider.
4. Accept is atomic (transaction + lock). Generate the 4-digit start OTP on assignment.

**Surge:** a cron job every minute computes demand/supply per zone from open requests vs. online drivers and sets `SurgeZone.multiplier` (1.0 to 3.0, rounded to 0.1). Admin can override manually. Rider sees the multiplier and must accept it before booking.

**Live tracking:** driver app sends location every 3 s while online (socket event `driver:location`), server writes Redis GEO and, during a trip, appends to `RideLocationPoint` (throttled to every 5 s). Rider map animates the car marker with interpolation and rotates by heading. ETA recalculated every 20 s.

## 7. REALTIME EVENTS (Socket.IO)

Rooms: `user:{id}`, `ride:{id}`, `admin`. Authenticate the handshake with the Clerk JWT. Events:

- Client to server: `driver:online`, `driver:offline`, `driver:location`, `offer:accept`, `offer:decline`, `ride:arrived`, `ride:start` (with OTP), `ride:complete`, `ride:cancel`, `sos:trigger`, `chat:message`.
- Server to client: `offer:new`, `offer:expired`, `ride:updated`, `ride:driver_location`, `ride:eta`, `ride:no_drivers`, `payment:updated`, `chat:message`, `sos:ack`, `notification:new`, `admin:ride_feed`, `admin:sos`.
- Handle reconnection: on reconnect, client re-fetches the active ride and resubscribes. Idempotent event handlers.

## 8. REST API (all under `/api/v1`, Zod-validated, paginated lists, consistent error shape `{error:{code,message,details}}`)

- **Auth/User:** `POST /webhooks/clerk`, `GET/PATCH /me`, `POST /me/photo`, `CRUD /me/saved-places`, `CRUD /me/emergency-contacts`.
- **Maps:** `GET /maps/autocomplete`, `GET /maps/reverse`, `POST /maps/route` (pickup, stops, dropoff returns polyline, distance, duration).
- **Fare:** `POST /rides/estimate` returns an estimate for every vehicle type with ETA of the nearest driver, surge and promo preview.
- **Rides (rider):** `POST /rides` (book now or scheduled), `GET /rides/active`, `GET /rides/:id`, `POST /rides/:id/cancel`, `POST /rides/:id/change-destination`, `GET /rides` (history with filters), `GET /rides/:id/receipt` (PDF), `POST /rides/:id/rate`, `POST /rides/:id/tip`, `POST /rides/:id/share` (public tracking link with expiring token).
- **Driver:** `POST /driver/onboarding` (profile, vehicle, documents), `GET /driver/status`, `POST /driver/online|offline`, `GET /driver/earnings?range=`, `GET /driver/rides`, `POST /driver/payouts/connect` (Stripe Connect onboarding link), `GET /driver/payouts`.
- **Payments:** `POST /payments/setup-intent`, `GET/DELETE /payments/methods`, `POST /payments/wallet/topup`, `POST /rides/:id/pay`, `POST /webhooks/stripe` (payment\_intent.succeeded/failed, charge.refunded, account.updated; verify signature; idempotent via event id table).
- **Promos:** `POST /promos/validate`, `GET /promos/available`.
- **Support:** `POST /tickets`, `GET /tickets`, `POST /tickets/:id/messages`.
- **Safety:** `POST /sos`, `GET /public/track/:token`.
- **Admin:** `GET /admin/stats`, `CRUD /admin/users`, `GET/POST /admin/drivers/:id/kyc` (approve/reject with reason), `CRUD /admin/fares`, `CRUD /admin/surge-zones`, `CRUD /admin/promos`, `GET /admin/rides`, `POST /admin/rides/:id/refund`, `GET /admin/payouts` + `POST /admin/payouts/run`, `GET/PATCH /admin/tickets`, `GET/PATCH /admin/sos`, `GET /admin/audit`, `GET /admin/export/:entity.csv`.

Security on every route: role guard middleware, ownership checks (a rider can only read their own rides), rate limiting (stricter on auth, booking, OTP), request size limits, parameterized queries only, secure headers, no secrets in the client, PII not logged.

## 9. SCREENS (build every one, fully functional)

### 9.1 Shared / Auth

1. Splash + onboarding carousel (3 slides, skippable).
2. Role chooser: "Ride with us" / "Drive with us".
3. Sign in / Sign up (Clerk components themed to the app): email, phone OTP, Google.
4. Complete profile (name, photo, phone verification, emergency contact prompt for riders).
5. 404, 500, offline page, permission-denied (location) screen with instructions.
6. Notifications center with unread badge.
7. Settings: language (EN/HI/TE), dark mode, notification toggles, delete account, logout.

### 9.2 Rider app

1. **Home / Map:** full-screen map with live nearby-driver cars, "Where to?" search bar, saved places chips (Home/Work), recent destinations, current-location button, promo banner.
2. **Search destination:** pickup + drop fields, autocomplete, add up to 3 stops, set pin on map, saved/recent lists.
3. **Ride options (bottom sheet):** route drawn on map, cards for Bike/Auto/Mini/Sedan/SUV with fare, ETA, seats, surge badge; payment method selector; promo code field; schedule-for-later picker; "Book" button.
4. **Searching for driver:** animated radar, cancel button, live status text, auto-expanding search messages.
5. **Driver assigned:** driver card (photo, name, rating, vehicle, plate), OTP display, live driver marker moving to pickup, ETA, call (masked tel link), in-app chat, share trip, cancel (shows fee if applicable), SOS button.
6. **On trip:** live route progress, ETA to drop, change destination, add stop, share live trip link, SOS.
7. **Payment / trip complete:** itemized fare breakdown, pay with card/UPI/wallet/cash, add tip, apply promo, retry on failure.
8. **Rate driver:** 1-5 stars, quick tags (Polite, Clean car, Safe driving...), comment, skip.
9. **Ride history:** list with filters (status/date), search; **Ride details:** map replay of route, fare breakdown, driver info, download receipt PDF, report issue, rebook.
10. **Payments:** saved methods, add card (Stripe Elements), wallet balance + top-up + transaction history.
11. **Promos & offers:** available codes, apply.
12. **Saved places** and **Emergency contacts** management.
13. **Help & Support:** FAQ, create ticket (category + ride link), ticket thread chat.
14. **Scheduled rides:** list, edit, cancel.
15. **Public tracking page** (`/track/:token`, no login) for shared trips.

### 9.3 Driver app (`/driver`)

1. **Onboarding wizard:** personal info, vehicle details, document uploads (license, RC, insurance, ID), submit for KYC, pending-approval screen.
2. **Home:** map, big Go Online/Offline toggle, today's earnings, trips, hours online, acceptance rate.
3. **Incoming offer modal:** pickup/drop, distance, estimated fare, 15 s countdown ring, Accept/Decline, audio + vibration + push.
4. **Navigate to pickup:** route, rider info, call/chat, "I've arrived" button, waiting timer, cancel with reason.
5. **Start trip:** enter rider OTP.
6. **On trip:** turn-by-turn style route with polyline (deep link to Google Maps for navigation), live fare meter, "Complete trip" button, cash-collection prompt.
7. **Trip summary:** fare, commission, net earning; rate rider.
8. **Earnings:** daily/weekly/monthly charts, trip list, tips, commission breakdown, payout history, Stripe Connect onboarding/status, instant-cashout request.
9. **Trip history** and **Ratings & feedback** (average, distribution, comments).
10. **Profile & vehicle**, document status/expiry reminders, support, settings.

### 9.4 Admin console (`/admin`)

1. **Dashboard:** KPIs (active rides, online drivers, today's revenue, completion rate, cancellation rate), live map of all rides/drivers, charts (rides/revenue over time, by vehicle type, peak hours heatmap), live ride feed.
2. **Rides:** filterable table, ride detail with route replay, timeline, force-cancel, reassign driver, refund.
3. **Riders** and **Drivers:** tables, profile pages, suspend/activate, wallet adjust (audited); **KYC review queue** with document viewer and approve/reject.
4. **Pricing:** fare config editor per vehicle type, surge zone drawer (draw polygon on map), night charges.
5. **Promos:** create/edit/deactivate, usage stats.
6. **Payments & payouts:** transactions, run weekly payouts, failed payments, commission settings.
7. **Support:** ticket inbox with assignment, status, reply thread.
8. **SOS center:** live alerts with map + ride + contacts, acknowledge/resolve.
9. **Reports:** CSV exports, date range filters.
10. **Audit log** and **Admin settings** (platform commission %, cancellation windows, search radius, offer timeout, feature flags).

## 10. CROSS-CUTTING FEATURES

- **Cancellation policy:** free within 2 min of assignment or before driver arrival if driver delay > 5 min; otherwise fee from FareConfig charged to the canceller's side (rider fee goes to the driver). Driver cancellations lower acceptance rate and can trigger temporary suspension.
- **Receipts:** server-generated PDF (pdf-lib or Puppeteer) + email via Resend on completion.
- **In-ride chat:** persisted messages, quick replies, masked contact (no phone numbers shown).
- **SOS:** one tap sends live location to emergency contacts (SMS/email/push), flags ride, alerts admin in real time, optional call to local emergency number.
- **Ratings:** mutual; driver ratingAvg recomputed in a transaction; drivers below 4.0 over last 50 trips flagged for admin review.
- **Idempotency:** `Idempotency-Key` header on ride booking and payment endpoints.
- **Accessibility:** WCAG AA contrast, keyboard navigable, ARIA on sheets/modals, reduced-motion support.
- **i18n:** next-intl with English, Hindi, Telugu files.
- **Performance:** map markers clustered, query result caching, image optimization, p95 API under 300 ms for non-routing endpoints.

## 11. DESIGN SYSTEM

Clean, modern, high-contrast (Uber-like black/white with one accent, e.g. emerald). Inter font. 8px spacing grid, rounded-2xl cards, bottom sheets with drag handles, skeleton loaders, optimistic UI, toast feedback, empty states with illustrations, smooth Framer Motion transitions. Light and dark themes via CSS variables.

## 12. DEMO MODE AND SEED DATA

Provide `pnpm seed` that creates: 1 admin, 20 riders, 25 drivers (approved, with vehicles, scattered around a configurable city center), fare configs for all vehicle types, 3 surge zones, 5 promo codes, 200 historical rides with ratings and earnings. Provide a **driver simulator** script (`pnpm simulate`) that moves N fake online drivers along OSRM routes, auto-accepts offers after 3-8 s, and drives each trip to completion, so a rider can test the entire flow alone. `DEMO_MODE=true` uses Stripe test keys and skips real KYC checks.

## 13. TESTING REQUIREMENTS

- Unit: fare engine (night, surge, promo, multi-stop, waiting), state machine, promo validation, matching score.
- Integration: auth guards, booking, double-accept race condition, cancel fees, Stripe webhook idempotency.
- E2E (Playwright, two browser contexts): rider books, driver accepts, OTP start, complete, pay, rate; plus cancel flow and no-drivers flow.
- CI must run lint, typecheck, unit, integration and E2E on every push.

## 14. DEPLOYMENT

Dockerfiles for api and web, `docker-compose.yml` for local, GitHub Actions pipeline (test, build, deploy), Prisma migrate deploy on release, health checks `/healthz` and `/readyz`, Sentry for errors, structured logs, and a `.env.example` listing every variable (Clerk, Supabase/DB URL, Redis URL, Stripe keys + webhook secret, Resend, VAPID keys, MAP\_PROVIDER and keys, Twilio optional). Write a step-by-step `DEPLOY.md` for Vercel + Railway + Supabase + Upstash.

## 15. BUILD ORDER (execute sequentially; verify each phase before the next)

1. **Foundation:** monorepo, tooling, Docker Compose, Prisma schema + migrations + PostGIS, shared package, CI.
2. **Auth and users:** Clerk integration, webhook sync, role guards, profile screens, saved places, emergency contacts.
3. **Maps and fare:** MapProvider (OSM + Google), autocomplete, routing, fare engine, estimate endpoint, ride-options UI.
4. **Driver onboarding + admin KYC:** wizard, uploads, review queue.
5. **Realtime core:** Socket.IO auth, driver online/offline, Redis GEO, live locations, nearby cars on rider map.
6. **Booking and dispatch:** ride creation, state machine, matching with offers/timeouts, driver offer modal, OTP start, trip flow end to end.
7. **Payments:** Stripe cards, wallet, cash, tips, webhooks, receipts, refunds, driver earnings and Connect payouts.
8. **Extras:** promos, multi-stop, scheduled rides, surge, cancellations, chat, share trip, ratings, notifications and web push.
9. **Safety and support:** SOS, tickets, admin SOS center.
10. **Admin console:** all screens in 9.4, analytics, exports, audit log.
11. **Polish:** i18n, dark mode, PWA, accessibility, skeletons, empty/error states, performance pass, security review.
12. **Quality and launch:** full test suite green, seed + simulator, README and DEPLOY docs, deploy, smoke test the live URL.

## 16. DEFINITION OF DONE

The project is finished only when all of the following are true and demonstrated in your final report:

- `pnpm i && docker compose up && pnpm seed && pnpm dev` brings up the whole system locally.
- With `pnpm simulate` running, a new rider can sign up, book a ride, watch the driver arrive, ride, pay, tip, rate and download a receipt, while the admin console shows it live.
- A real driver account can onboard, get approved by admin, go online, receive and complete a ride on a second device.
- Every screen listed in section 9 exists, is responsive, and is connected to real data.
- All tests pass in CI; no console errors; Lighthouse PWA and accessibility scores above 90.
- Final output: summary of what was built, file tree, how to run, env vars needed, known limitations, and the deployed URLs.

Begin with Phase 1 now. Do not ask for confirmation between phases.
