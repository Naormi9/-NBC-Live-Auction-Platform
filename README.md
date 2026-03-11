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

## License

ISC
