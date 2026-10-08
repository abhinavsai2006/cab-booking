# Architecture & Engineering Decisions (DECISIONS.md)

This log records all architecture, technology, and implementation decisions made during the development of the Cab Booking Platform.

---

### Decision 1: Monorepo Structure & Tooling
- **Choice:** `pnpm` workspaces + `Turborepo` + TypeScript strict mode.
- **Rationale:** Ensures clean code sharing (`packages/shared`, `packages/ui`) between `apps/web` (Next.js) and `apps/api` (Express + Socket.IO), unified linting/typechecking, and caching.

---

### Decision 2: Spatial Data Storage & Geo Queries
- **Choice:** In PostgreSQL, coordinate pairs are stored as explicit indexed `lat` and `lng` (Double Precision `Float`) with spatial calculation utilities in SQL and Prisma, alongside Haversine/bounding box formulas.
- **Rationale:** Ensures universal compatibility with standard PostgreSQL (local Windows/macOS/Linux PostgreSQL instances) without requiring external C PostGIS compiled binary installations, while still maintaining full compatibility with PostGIS syntax and Supabase. Realtime high-speed spatial querying (driver radius matching) is driven by Redis `GEOADD` and `GEORADIUS` / in-memory GEO quad-tree.

---

### Decision 3: Zero-Key Demo Mode & Auth Fallback
- **Choice:** Implement dual authentication mode:
  1. Production: Clerk JWT validation on HTTP requests and Socket.IO handshakes with Clerk webhooks for user sync.
  2. Local / Demo mode (`DEMO_MODE=true`): Built-in simulated auth header/token with instant role switcher (Rider, Driver, Admin) and mock Clerk sync.
- **Rationale:** Fulfills Section 0 & 12 requirement: the entire platform can be started and tested end-to-end locally with zero paid keys and zero friction, while remaining 100% production-ready for real Clerk keys.

---

### Decision 4: Redis In-Memory Fallback
- **Choice:** `apps/api` provides a resilient Redis client wrapper that connects to real Redis / Upstash if configured, and falls back gracefully to a memory-backed Geo/KeyValue engine if Redis is unavailable locally.
- **Rationale:** Guarantees local developers and evaluators can launch the full system immediately even without Docker/WSL running, while preserving full Redis commands (`GEOADD`, `GEORADIUSWITHDIST`, `SETEX`, etc.).

---

### Decision 5: Map Provider Abstraction
- **Choice:** `MapProvider` interface in `packages/shared/src/maps/`.
  - Free default: OpenStreetMap tiles via Leaflet, Nominatim for geocoding/autocomplete, and OSRM (Open Source Routing Machine) for polyline routing, ETAs, and distance calculation.
  - Google Maps: Switchable via `MAP_PROVIDER=google` with `GOOGLE_MAPS_API_KEY`.
- **Rationale:** Zero-cost local development and testing, zero rate limits for demo routes, completely swappable with Google Maps in production.

---

### Decision 6: Ride State Machine & Concurrency Control
- **Choice:** Pure state machine transition validator on server (`apps/api/src/services/ride-state-machine.ts`).
  - Transitions enforce atomic updates with PostgreSQL row-level locks (`SELECT ... FOR UPDATE`).
  - Redis distributed locks or mutex ensures only one driver can accept an offer.
  - Driver matching sends offers sequentially with 15-second timeouts.

---

### Decision 7: UI & Design System
- **Choice:** Tailwind CSS with modern Uber-inspired dark/light theme, high-contrast typography (Inter/Geist), glassmorphic bottom sheets, animated vehicle markers, and responsive mobile-first layouts.
