# 🚀 PROMPT FOR CLAUDE CODE — NBC Live Auction Platform

> העתק את כל הטקסט הזה ל-Claude Code, יחד עם קובץ BIDDING_PLATFORM_SPEC.md המצורף.

---

## MISSION

Build a **production-ready live vehicle auction web platform** called **"מרכז המכרזים הארצי"** (NBC — National Bidding Center).

This is a full-stack Next.js 14 application with Firebase Realtime Database powering real-time bidding. The entire product spec is attached in `BIDDING_PLATFORM_SPEC.md` — read it fully before writing a single line of code.

---

## TECH STACK (non-negotiable)

- **Framework:** Next.js 14 App Router + TypeScript
- **Styling:** Tailwind CSS
- **Database + Realtime:** Firebase Realtime Database (RTDB)
- **Auth:** Firebase Auth (email/password + phone OTP)
- **Backend Logic:** Firebase Cloud Functions (Node.js 20)
- **File Storage:** Firebase Storage (vehicle images)
- **Direction:** RTL Hebrew throughout (`dir="rtl"`, `lang="he"`)
- **Fonts:** Heebo (Google Fonts) — primary Hebrew font

---

## DESIGN SYSTEM

Implement exactly this visual language:

```css
/* Core Colors */
--bg-primary:    #0D0D0D;   /* main background */
--bg-surface:    #141414;   /* cards, panels */
--bg-elevated:   #1E1E1E;   /* modals, dropdowns */
--accent:        #6C63FF;   /* primary purple - buttons, highlights */
--accent-hover:  #5A52E0;
--bid-price:     #00D4AA;   /* teal - current bid amount */
--text-primary:  #FFFFFF;
--text-secondary:#A0A0A0;
--timer-green:   #22C55E;   /* > 10 sec */
--timer-orange:  #F97316;   /* 5-10 sec */
--timer-red:     #EF4444;   /* < 5 sec — add pulse animation */
--live-dot:      #EF4444;   /* red blinking dot for LIVE indicator */
--border:        rgba(255,255,255,0.08);
```

**UI Principles:**
- Dark theme only (no light mode needed for MVP)
- Sharp, modern — like a fintech product meets auction house
- Large, confident typography for prices (bid amounts in `--bid-price` teal, large font)
- Subtle glass-morphism for panels (`backdrop-filter: blur`)
- Smooth transitions (200ms) on all interactive elements
- Mobile-first — the live auction room must work perfectly on iPhone
- Red blinking `● שידור חי` badge whenever an auction is LIVE
- Viewer count: `👁 142 צופים` in the live room header

---

## PROJECT STRUCTURE

```
/
├── app/
│   ├── (public)/
│   │   ├── page.tsx                    # Landing page
│   │   ├── auctions/page.tsx           # Active auctions list
│   │   ├── auctions/[id]/page.tsx      # Auction catalog (pre-live browsing)
│   │   ├── auctions/[id]/item/[itemId] # Single item detail
│   │   └── live/page.tsx               # Live auction room (THE main page)
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   └── (admin)/
│       ├── admin/page.tsx              # Admin dashboard
│       ├── admin/auctions/page.tsx     # Manage auctions
│       ├── admin/auctions/new/page.tsx # Create auction
│       ├── admin/auctions/[id]/page.tsx # Edit auction + catalog
│       └── admin/live/page.tsx         # AUCTIONEER CONTROL PANEL
├── components/
│   ├── live/
│   │   ├── LiveRoom.tsx               # Main live auction component
│   │   ├── BidButton.tsx              # The bid button (smart state)
│   │   ├── AuctionTimer.tsx           # Countdown with color states
│   │   ├── CurrentItem.tsx            # Item display + image carousel
│   │   ├── BidHistory.tsx             # Real-time bid feed
│   │   ├── CatalogSidebar.tsx         # Item list with sold markers
│   │   └── LiveChat.tsx               # Chat panel
│   ├── admin/
│   │   └── AuctioneerConsole.tsx      # Auctioneer control panel
│   └── ui/ (shared components)
├── lib/
│   ├── firebase.ts                    # Firebase config
│   ├── firebase-admin.ts              # Admin SDK
│   └── auction-utils.ts               # Shared bid logic
├── functions/
│   ├── src/
│   │   ├── index.ts                   # Cloud Functions entry
│   │   ├── processBid.ts              # Core bid processing
│   │   ├── advanceItem.ts             # Move to next item
│   │   └── timerManager.ts            # Timer tick logic
└── ...config files
```

---

## FIREBASE RTDB SCHEMA

Implement exactly this data structure:

```
/auctions/{auctionId}
  id: string
  title: string                        # "מכרז רכבים מרץ 2026 חלק א'"
  houseId: string
  houseName: string
  scheduledAt: timestamp
  status: "draft" | "published" | "live" | "ended"
  preBidsEnabled: boolean
  currentItemId: string | null         # which item is ON STAGE right now
  currentRound: 1 | 2 | 3
  timerEndsAt: timestamp               # server timestamp when timer expires
  timerDuration: number                # seconds for current round
  viewerCount: number
  settings:
    round1: { increment: 1000, timerSeconds: 45 }
    round2: { increment: 500,  timerSeconds: 30 }
    round3: { increment: 250,  timerSeconds: 30 }
    hardCloseMinutes: 30

/auction_items/{itemId}
  id: string
  auctionId: string
  order: number                        # 1, 2, 3... determines sequence
  title: string                        # "AUDI A3 2018"
  description: string
  images: string[]                     # Firebase Storage URLs
  openingPrice: number                 # set by auction house
  currentBid: number                   # live current highest bid
  currentBidderId: string | null
  currentBidderName: string | null
  preBidPrice: number | null           # highest pre-bid received
  status: "pending" | "active" | "sold" | "unsold"
  soldAt: timestamp | null
  soldPrice: number | null
  # Vehicle fields:
  make: string        # יצרן
  model: string
  year: number
  km: number
  color: string
  engineCC: number
  owners: number      # יד
  registrationDate: string

/pending_bids/{pushId}                 # WRITE-ONLY for clients
  auctionId: string
  itemId: string
  userId: string
  userDisplayName: string
  amount: number
  timestamp: serverTimestamp
  round: number

/pre_bids/{auctionId}/{itemId}/{userId}
  userId: string
  userDisplayName: string
  amount: number
  timestamp: serverTimestamp

/bid_history/{auctionId}/{itemId}
  {pushId}:
    userId: string
    userDisplayName: string
    amount: number
    round: number
    timestamp: serverTimestamp

/live_chat/{auctionId}
  {pushId}:
    senderId: string
    senderName: string
    senderRole: "user" | "auctioneer" | "system"
    message: string
    timestamp: serverTimestamp

/registrations/{auctionId}/{userId}
  userId: string
  registeredAt: serverTimestamp
  status: "pending" | "approved"

/users/{userId}
  displayName: string
  email: string
  phone: string
  role: "participant" | "house_manager" | "admin"
  houseId: string | null
  createdAt: serverTimestamp
```

---

## CLOUD FUNCTIONS — THE BRAIN

### `processBid` (onValueCreated `/pending_bids/{bidId}`)

```typescript
// This is the ONLY function that writes to auction_items
// Clients NEVER write directly to currentBid
export const processBid = onValueCreated("/pending_bids/{bidId}", async (event) => {
  const bid = event.data.val();
  const itemRef = db.ref(`/auction_items/${bid.itemId}`);
  const auctionRef = db.ref(`/auctions/${bid.auctionId}`);

  await itemRef.transaction((item) => {
    if (!item || item.status !== "active") return; // abort
    
    const auction = /* get from auctionRef */;
    const round = auction.currentRound;
    const increment = auction.settings[`round${round}`].increment;
    
    // Rule: minimum bid = currentBid + increment
    if (bid.amount < item.currentBid + increment) return; // reject
    
    // Rule: cannot outbid yourself
    if (bid.userId === item.currentBidderId) return; // reject
    
    // Accept the bid
    item.currentBid = bid.amount;
    item.currentBidderId = bid.userId;
    item.currentBidderName = bid.userDisplayName;
    return item;
  });

  // Reset timer on successful bid
  const timerDuration = /* get from round settings */;
  await auctionRef.update({
    timerEndsAt: Date.now() + timerDuration * 1000
  });

  // Write to bid_history
  await db.ref(`/bid_history/${bid.auctionId}/${bid.itemId}`).push({...bid});
  
  // Clean up pending_bid
  await event.data.ref.remove();
});
```

### `advanceRoundOrItem` (HTTP callable — called by auctioneer or timer)

Logic:
1. If `currentRound < 3` → increment round, reset timer
2. If `currentRound === 3` → close current item (sold/unsold), advance to next item by `order`
3. If no more items → mark auction as "ended", send winner notifications

### `timerTick` (Scheduled every 5 seconds)

Check all `live` auctions. If `timerEndsAt < now` → call `advanceRoundOrItem`.

---

## PAGES TO BUILD

### 1. Landing Page `/`

Hero section with:
- Large headline: **"הדרך החדשה לקנות ולמכור. מכרזים חיים בזמן אמת."**
- Subtitle: "פלטפורמת מכרזים בלייב הראשונה בישראל. צפו, הציעו והשתתפו במכרזים חיים של ספקים ועסקים מובילים"
- Two CTAs: `לצפייה במכרזים פעילים` (dark) + `להשתתפות במכרז` (accent purple)
- Below fold: "מכרזים פעילים עכשיו" section with live badge
- Features section, stats section
- Design: matches the screenshot provided — clean, professional, RTL

### 2. Auctions List `/auctions`

Grid of auction cards showing:
- Auction name, date/time, house name
- Item count, preview images
- Status badge: LIVE (red) / upcoming (gray) / ended
- Filter/search bar

### 3. Auction Catalog `/auctions/[id]`

- Auction header (title, date, house, status)
- Registration CTA if not registered
- Grid of item cards — each showing: car image, title, opening price, pre-bid count
- Pre-bid button on each card (if enabled and user registered)
- Pre-bid modal: input amount with increment validation

### 4. 🔴 LIVE AUCTION ROOM `/live` — THE MOST IMPORTANT PAGE

**Desktop layout (3 columns):**
```
┌─────────────────┬──────────────────────────┬──────────────┐
│   LEFT PANEL    │      CENTER STAGE        │ RIGHT PANEL  │
│                 │                          │              │
│ 🟠 Timer        │  [Car Image Carousel]    │ 📋 Catalog   │
│ 06:24           │                          │              │
│                 │  AUDI A3 2018            │ Item 1 ✓sold │
│ 💬 Live Chat    │  פריט 1 מתוך 5           │ Item 2 🔴now │
│                 │                          │ Item 3       │
│ [message feed]  │  מחיר מחירון: ₪210,000   │ Item 4       │
│                 │  הצעה נוכחית: ₪271,000   │ Item 5       │
│ [chat input]    │                          │              │
│                 │  [BID ₪272,000 →]        │              │
└─────────────────┴──────────────────────────┴──────────────┘
```

**Mobile layout (stacked):**
- Header: logo + `● שידור חי` + `👁 142 צופים`
- Car image carousel (full width)
- Item info + prices
- Catalog strip (horizontal scroll)
- Sticky bottom bar: Timer | Bid Button

**The Bid Button — smart states:**
```
State 1: Not registered    → "הירשם להשתתפות" (gray, disabled)
State 2: Registered, can bid → "הצע ₪272,000 ↑" (accent purple)
State 3: I AM the leader  → "אתה המציע המוביל ✓" (teal, disabled)
State 4: Just outbid      → "הצע ₪XXX ↑" flashes red border briefly
State 5: Auction ended    → "המכרז הסתיים" (gray)
```

**Timer component:**
- Shows MM:SS (or just SS when under 60)
- Green bg > 10s | Orange bg 5-10s | Red bg + pulse animation < 5s
- Round indicator: "סיבוב 1 מתוך 3"

**Live Chat:**
- System messages in gray italic: "הפריט עלה לבמה", "הצעה התקבלה", "הפריט נמכר ב-₪272,000"
- Auctioneer messages in purple/bold
- User messages in white
- Input only visible to registered users (hint: "שלח הודעה לכרוז (רק הוא יראה)")

**Bid History feed** (below center or in sidebar):
- Real-time list: "משתתף #501 הציע ₪272,000 — סיבוב 2"

### 5. Admin Dashboard `/admin`

Clean stats overview:
- Total auctions, active users, total bids, revenue
- Quick actions: create auction, view live

### 6. Create/Edit Auction `/admin/auctions/new`

Form fields:
- Auction name, date+time picker, house name
- Toggle: pre-bids enabled/disabled
- Round settings: increment + timer per round (with defaults)
- Hard close limit
- Add items section (drag-to-reorder)
- Per item: car details form + image upload (Firebase Storage)

### 7. 🎛️ AUCTIONEER CONSOLE `/admin/live`

**This is the auctioneer's war room during a live auction.**

Layout:
```
┌─────────────────────────────────────────┐
│  ● LIVE  מכרז מרץ 2026  │  👁 142 צופים │
├───────────────┬─────────────────────────┤
│ CURRENT ITEM  │   CONTROLS              │
│               │                         │
│ AUDI A3 2018  │ [⏸ עצור טיימר]         │
│ Bid: ₪271,000 │ [+30 שנ] [+60 שנ]      │
│ Leader: #501  │ [+120 שנ] [+custom]    │
│               │                         │
│ Round: 2/3    │ [⏭ סיים פריט + הבא]    │
│ Timer: 06:24  │ [✗ לא נמכר → הבא]      │
├───────────────┴─────────────────────────┤
│ SEND MESSAGE TO ALL PARTICIPANTS        │
│ [text input.....................] [שלח] │
├─────────────────────────────────────────┤
│ UPCOMING ITEMS (drag to reorder)        │
│ 2. BMW X5 2021  |  3. Toyota Corolla   │
└─────────────────────────────────────────┘
```

---

## FIREBASE SECURITY RULES

```json
{
  "rules": {
    "pending_bids": {
      "$bidId": {
        ".write": "auth != null",
        ".validate": "
          newData.hasChildren(['auctionId','itemId','userId','amount','timestamp']) &&
          newData.child('userId').val() === auth.uid &&
          newData.child('amount').isNumber() &&
          newData.child('amount').val() > 0
        "
      }
    },
    "auction_items": {
      "$itemId": {
        ".read": true,
        ".write": "false"  // Only Cloud Functions write here
      }
    },
    "auctions": {
      ".read": true,
      "$auctionId": {
        ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'house_manager'"
      }
    },
    "pre_bids": {
      "$auctionId": {
        "$itemId": {
          "$userId": {
            ".read": "auth != null && auth.uid === $userId",
            ".write": "auth != null && auth.uid === $userId"
          }
        }
      }
    },
    "live_chat": {
      "$auctionId": {
        ".read": true,
        ".write": "auth != null"
      }
    },
    "registrations": {
      "$auctionId": {
        "$userId": {
          ".read": "auth != null && auth.uid === $userId",
          ".write": "auth != null && auth.uid === $userId"
        }
      }
    },
    "users": {
      "$userId": {
        ".read": "auth != null && auth.uid === $userId",
        ".write": "auth != null && auth.uid === $userId"
      }
    },
    "bid_history": {
      ".read": true,
      ".write": false
    }
  }
}
```

---

## REAL-TIME HOOKS — implement these custom hooks

```typescript
// useAuction(auctionId) — subscribe to auction state
// useCurrentItem(auctionId) — subscribe to active item
// useBidHistory(auctionId, itemId) — last 20 bids
// useLiveChat(auctionId) — last 50 messages
// useCatalog(auctionId) — all items with statuses
// useViewerCount(auctionId) — presence-based counter
// useTimer(auctionId) — client-side countdown from server timerEndsAt
```

---

## BIDDING FLOW IN FRONTEND

```typescript
const placeBid = async (amount: number) => {
  if (!user || !currentItem || currentItem.currentBidderId === user.uid) return;
  
  const round = auction.currentRound;
  const increment = auction.settings[`round${round}`].increment;
  const minBid = currentItem.currentBid + increment;
  
  if (amount < minBid) {
    toast.error(`הצעה מינימלית: ₪${minBid.toLocaleString()}`);
    return;
  }
  
  // Write to pending_bids — Cloud Function processes it
  await push(ref(db, 'pending_bids'), {
    auctionId: auction.id,
    itemId: currentItem.id,
    userId: user.uid,
    userDisplayName: user.displayName,
    amount,
    round,
    timestamp: serverTimestamp()
  });
};
```

---

## SEED DATA — create this test data on first run

```typescript
// Auction: "מכרז רכבים מרץ 2026 — בדיקה"
// Status: "published" (will be changed to live for testing)
// Items:
// 1. AUDI A3 2018, 50,000 ק"מ, פתיחה ₪45,000
// 2. BMW X5 2021, 30,000 ק"מ, פתיחה ₪180,000
// 3. Toyota Corolla 2020, 80,000 ק"מ, פתיחה ₪55,000
// 4. Mazda 3 2019, 65,000 ק"מ, פתיחה ₪38,000
// 5. Hyundai Tucson 2022, 20,000 ק"מ, פתיחה ₪95,000
// Demo user: admin@nbc.co.il / Admin1234
// Demo user: participant@test.co.il / Test1234
```

---

## ENV SETUP

Create `.env.local.example`:
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_DATABASE_URL=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_ADMIN_PRIVATE_KEY=
FIREBASE_ADMIN_CLIENT_EMAIL=
```

---

## DELIVERABLES CHECKLIST

Build in this exact order (MVP first):

### Phase 1 — Core (build this first, make it work)
- [ ] Firebase setup + schema + security rules
- [ ] Cloud Function: `processBid` with transaction
- [ ] Cloud Function: `advanceRoundOrItem`
- [ ] Cloud Function: `timerTick` (scheduled)
- [ ] `/live` page — fully functional live room (desktop + mobile)
- [ ] Auctioneer console `/admin/live` — timer controls + advance item
- [ ] Auth: login + register

### Phase 2 — Complete product
- [ ] Landing page `/`
- [ ] Auctions list + catalog pages
- [ ] Pre-bid system
- [ ] Create/edit auction admin pages
- [ ] Item management + image upload
- [ ] Winner notifications (email via Firebase Extensions or SendGrid)
- [ ] Ended auctions archive

### Phase 3 — Polish
- [ ] Loading states + skeleton screens
- [ ] Error boundaries
- [ ] Toast notifications (react-hot-toast)
- [ ] PWA manifest (mobile installable)
- [ ] README with setup instructions

---

## ABSOLUTE RULES

1. **All UI text is Hebrew** — no English visible to end users
2. **RTL everywhere** — `dir="rtl"` on html, flex/grid directions adjusted
3. **The bid button never shows a stale price** — always `currentBid + increment`
4. **Clients NEVER write to `auction_items` directly** — only via `pending_bids`
5. **Timer resets on every accepted bid** — Cloud Function handles this
6. **Cannot outbid yourself** — validated in Cloud Function transaction
7. **One live auction at a time** — enforced in admin create form
8. **Mobile live room must feel native** — test on 375px width

---

## START HERE

Read `BIDDING_PLATFORM_SPEC.md` fully.
Then scaffold the project with `create-next-app`.
Then build Phase 1 completely before touching Phase 2.
The live room (`/live`) and auctioneer console (`/admin/live`) are the heart of this product — make them perfect.
