# NBC Live Auction Platform — מרכז המכרזים הארצי

פלטפורמת מכרזים בלייב הראשונה בישראל. צפו, הציעו והשתתפו במכרזים חיים.

## Quick Start

1. Clone the repo
2. `cp .env.local.example .env.local`
3. Fill in Firebase credentials in `.env.local`
4. `npm install`
5. `npm run dev`
6. Visit `http://localhost:3000`

## Firebase Setup

1. Create project at https://console.firebase.google.com
2. Enable **Realtime Database**
3. Enable **Authentication** → Email/Password
4. Enable **Storage**
5. Deploy security rules: `firebase deploy --only database`
6. Deploy Cloud Functions: `cd functions && npm install && cd .. && firebase deploy --only functions`

## Creating First Admin User

1. Register normally at `/register`
2. In Firebase Console → Realtime Database → `users` → `{your uid}` → set `role` to `"admin"`
3. This is intentional — first admin must be set by someone with Firebase Console access
4. Access admin panel at `/admin`

## Seed Test Data

In browser console after login:

```javascript
import('/lib/seed-data').then(m => m.seedDatabase())
```

## Architecture

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Backend:** Firebase Realtime Database, Firebase Auth, Firebase Storage
- **Cloud Functions:**
  - `processBid` — transaction-based bid processing
  - `timerTick` — Cloud Scheduler (every 1 min) for server-authoritative timer progression
  - `onPreBidCreated` — pre-bid aggregator
  - `startAuctionLive` — transitions auction from published/draft → live
  - `activateFirstItem` — activates first pending item in a live auction
  - `advanceAuctionRound` — advances current round (1→2→3)
  - `closeItemAndAdvance` — closes current item (sold/unsold), activates next
  - `adjustAuctionTimer` — adds time or pauses timer
  - `endAuction` — manually ends a live auction
- **Real-time:** Firebase RTDB listeners with custom React hooks

## Key Pages

| Route | Description |
|---|---|
| `/` | Landing page |
| `/auctions` | Auction listings |
| `/auctions/[id]` | Auction catalog with pre-bid |
| `/live` | Live auction room |
| `/admin` | Admin dashboard |
| `/admin/auctions` | Manage auctions |
| `/admin/auctions/new` | Create new auction |
| `/admin/live` | Auctioneer console |

## Security Model

### Architecture Overview
This platform uses a server-authoritative architecture for all critical auction state.

### Authentication & Authorization
- Firebase Authentication handles user identity
- User roles stored in RTDB at `users/{uid}/role`
- Role escalation blocked: users cannot write their own `role`, `houseId`, `email`, or `createdAt` after initial registration
- Only admins can change user roles via Firebase Console or admin tools

### Auction State Transitions (Server Only)
All critical **live auction** mutations run through Firebase Cloud Functions:
- `startAuctionLive` — transitions auction from published → live, activates first item
- `activateFirstItem` — activates first pending item in a live auction
- `advanceAuctionRound` — advances current round (1→2→3)
- `closeItemAndAdvance` — closes current item (sold/unsold), activates next
- `adjustAuctionTimer` — adds time or pauses timer
- `endAuction` — manually ends a live auction

All functions verify authentication and admin/house_manager role before executing.
Operations are idempotent — safe to retry without corrupting state.

**Note:** Auction and item *creation/editing* (new auction form, seed data) still writes directly to `auctions/*` and `auction_items/*` from the client. These writes are protected by RTDB rules requiring admin/house_manager role. Only live-state transitions are server-only via Cloud Functions.

The legacy `advanceRoundOrItem` Cloud Function has been deprecated and removed from exports. The source file (`advanceItem.ts`) is retained for reference only.

### Timer Correctness
- `timerTick` Cloud Function runs every 1 minute via Cloud Scheduler
- Uses a distributed lock (`timer_locks`) to prevent duplicate processing
- Client timers are display-only — server is authoritative for progression
- Auctioneer console can manually advance if needed

### Viewer Count
- Viewer count derived from `presence/{auctionId}` by counting children
- No client writes to auctions path for viewer count
- Presence cleanup on disconnect via Firebase onDisconnect
- Presence counts authenticated viewers only

### First Admin Setup
1. Register normally at /register
2. In Firebase Console → Realtime Database → users → {your uid} → set `role` to `"admin"` manually
3. This is intentional — first admin must be set by someone with Firebase Console access

### Admin Route Protection
- All admin pages are wrapped by a shared layout (`app/(admin)/admin/layout.tsx`) that checks authentication and role
- Unauthenticated users are redirected to `/login`; non-admin authenticated users are redirected to `/`
- A loading spinner is shown while auth state resolves to prevent unauthorized content flash
- This is **client-side only** — there is no server-side session cookie or middleware-level route protection
- All data mutations are independently protected by Cloud Functions auth checks and RTDB security rules

### Known Limitations
- No server-side session cookie — middleware is pass-through; admin HTML is technically reachable but all data operations and state mutations are server-protected
- Auction/item creation still uses direct client RTDB writes (protected by role-based rules, not Cloud Functions)
- Firebase scheduler minimum granularity is 1 minute — auctioneer can manually advance rounds/items for sub-minute responsiveness

## License

ISC
