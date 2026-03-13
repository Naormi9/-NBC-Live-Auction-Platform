import { ref, set, push, serverTimestamp } from 'firebase/database';
import { db } from './firebase';
import { DEFAULT_AUCTION_SETTINGS } from './auction-utils';

export async function seedDatabase() {
  // Create test auction
  const auctionRef = push(ref(db, 'auctions'));
  const auctionId = auctionRef.key!;

  await set(auctionRef, {
    id: auctionId,
    title: 'מכרז רכבים מרץ 2026 — בדיקה',
    houseId: 'house_001',
    houseName: 'מרכז המכרזים הארצי',
    scheduledAt: Date.now() + 3600000, // 1 hour from now
    status: 'published',
    preBidsEnabled: true,
    currentItemId: null,
    currentRound: 1,
    timerEndsAt: 0,
    timerDuration: 45,
    viewerCount: 0,
    settings: DEFAULT_AUCTION_SETTINGS,
  });

  const items = [
    {
      title: 'AUDI A3 2018',
      make: 'Audi',
      model: 'A3',
      year: 2018,
      km: 50000,
      color: 'לבן',
      engineCC: 1400,
      owners: 2,
      registrationDate: '15/03/2018',
      openingPrice: 45000,
      description: 'אאודי A3 במצב מעולה, יד שנייה, טסט חדש',
    },
    {
      title: 'BMW X5 2021',
      make: 'BMW',
      model: 'X5',
      year: 2021,
      km: 30000,
      color: 'שחור',
      engineCC: 3000,
      owners: 1,
      registrationDate: '01/06/2021',
      openingPrice: 180000,
      description: 'BMW X5 יד ראשונה, full option, מצב שמור',
    },
    {
      title: 'Toyota Corolla 2020',
      make: 'Toyota',
      model: 'Corolla',
      year: 2020,
      km: 80000,
      color: 'כסוף',
      engineCC: 1800,
      owners: 1,
      registrationDate: '10/01/2020',
      openingPrice: 55000,
      description: 'טויוטה קורולה אמינה, יד ראשונה, שירות מוסך מורשה',
    },
    {
      title: 'Mazda 3 2019',
      make: 'Mazda',
      model: '3',
      year: 2019,
      km: 65000,
      color: 'אדום',
      engineCC: 1500,
      owners: 2,
      registrationDate: '22/09/2019',
      openingPrice: 38000,
      description: 'מאזדה 3 ספורטיבית, חסכונית, מצב טוב מאוד',
    },
    {
      title: 'Hyundai Tucson 2022',
      make: 'Hyundai',
      model: 'Tucson',
      year: 2022,
      km: 20000,
      color: 'כחול',
      engineCC: 1600,
      owners: 1,
      registrationDate: '05/04/2022',
      openingPrice: 95000,
      description: 'יונדאי טוסון חדשה כמעט, יד ראשונה, אחריות יצרן',
    },
  ];

  for (let i = 0; i < items.length; i++) {
    const itemRef = push(ref(db, 'auction_items'));
    await set(itemRef, {
      id: itemRef.key,
      auctionId,
      order: i + 1,
      title: items[i].title,
      description: items[i].description,
      images: [],
      openingPrice: items[i].openingPrice,
      currentBid: items[i].openingPrice,
      currentBidderId: null,
      currentBidderName: null,
      preBidPrice: null,
      status: 'pending',
      soldAt: null,
      soldPrice: null,
      make: items[i].make,
      model: items[i].model,
      year: items[i].year,
      km: items[i].km,
      color: items[i].color,
      engineCC: items[i].engineCC,
      owners: items[i].owners,
      registrationDate: items[i].registrationDate,
    });
  }

  console.log(`Seed data created! Auction ID: ${auctionId}`);
  return auctionId;
}
