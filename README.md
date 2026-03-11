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
2. Enable **Realtime Database** (start in test mode)
3. Enable **Authentication** → Email/Password
4. Enable **Storage**
5. Deploy security rules: `firebase deploy --only database`
6. Deploy Cloud Functions: `cd functions && npm install && cd .. && firebase deploy --only functions`

## Creating First Admin User

1. Register at `/register`
2. In Firebase Console → Realtime Database → `users` → `[your uid]` → set `role` to `"admin"`
3. Access admin panel at `/admin`

## Seed Test Data

In browser console after login:

```javascript
import('/lib/seed-data').then(m => m.seedDatabase())
```

## Architecture

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Backend:** Firebase Realtime Database, Firebase Auth, Firebase Storage
- **Cloud Functions:** `processBid` (transaction-based), `advanceRoundOrItem`, `timerTick` (scheduler), `onPreBidCreated` (aggregator)
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

### Authentication
- Firebase Authentication (email/password)
- Client-side auth state via `onAuthStateChanged` in React context

### Role-Based Access
- **Roles:** `participant` (default), `house_manager`, `admin`
- Only admins can change user roles (enforced via `.validate` rules — role field is immutable after creation unless caller is admin)
- Users can only set `role: 'participant'` on first registration; `email` and `createdAt` are also immutable after creation
- `auction_items` and `auctions` are writable only by `admin` or `house_manager`

### Auction Registration
- Self-service: users register for auctions with auto-approved status
- Registration is required to place bids and use live chat
- No admin approval step (by design — open auctions)

### Admin Route Protection
Admin pages are protected by three layers:
1. **Firebase RTDB security rules** — role-based write access prevents unauthorized data changes
2. **Client-side auth guards** — admin pages check user role on mount and redirect if unauthorized
3. **Cloud Function auth checks** — `advanceRoundOrItem` and `processBid` verify caller identity and role

### Viewer Presence
- Viewer count is derived from `presence/{auctionId}` by counting child nodes (no counter writes to auction path)
- Each viewer writes a session entry under `presence/` with `onDisconnect` cleanup
- Stable session key (via `sessionStorage`) prevents overcounting on reconnect

### Known Limitations
- No server-side session cookie — middleware cannot verify Firebase Auth tokens without the admin SDK
- Admin page HTML is technically accessible (but all data operations are server-protected)
- For production with sensitive admin UI, consider implementing Firebase session cookies or a custom auth API route

## License

ISC
