import { PrismaClient, Role, KycStatus, VehicleType, RideStatus, PaymentType, PaymentStatus, PromoType } from '@prisma/client';
import { calculateFare, VEHICLE_TYPES, VEHICLE_DETAILS } from '../packages/shared/dist/index.js';

const prisma = new PrismaClient();

const BANGALORE_CENTER = { lat: 12.9716, lng: 77.5946 };

async function main() {
  console.log('🌱 Starting comprehensive database seeding...');

  // 1. Clean existing records for reproducible fresh seed
  await prisma.auditLog.deleteMany();
  await prisma.sosAlert.deleteMany();
  await prisma.ticketMessage.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.promoRedemption.deleteMany();
  await prisma.promoCode.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.driverEarning.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.rideLocationPoint.deleteMany();
  await prisma.rideOffer.deleteMany();
  await prisma.ride.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.driverProfile.deleteMany();
  await prisma.paymentMethod.deleteMany();
  await prisma.savedPlace.deleteMany();
  await prisma.emergencyContact.deleteMany();
  await prisma.user.deleteMany();
  await prisma.fareConfig.deleteMany();
  await prisma.surgeZone.deleteMany();

  // 2. Seed Fare Configs for all vehicle types
  console.log('Seeding Fare Configurations...');
  for (const vType of VEHICLE_TYPES) {
    const mult = VEHICLE_DETAILS[vType].baseMultiplier;
    await prisma.fareConfig.create({
      data: {
        city: 'Bangalore',
        vehicleType: vType as VehicleType,
        baseFare: Math.round(45 * mult),
        perKm: Math.round(13 * mult),
        perMinute: 2.0,
        minFare: Math.round(70 * mult),
        bookingFee: 15.0,
        cancellationFee: 50.0,
        waitingPerMin: 2.5,
        nightMultiplier: 1.25,
        nightStart: 23,
        nightEnd: 5,
        taxPercent: 5.0,
        currency: 'INR',
      },
    });
  }

  // 3. Seed Surge Zones
  console.log('Seeding Surge Zones...');
  await prisma.surgeZone.createMany({
    data: [
      {
        name: 'Koramangala Tech Hub',
        city: 'Bangalore',
        polygon: [
          [12.935, 77.62],
          [12.94, 77.63],
          [12.93, 77.64],
          [12.925, 77.625],
        ],
        multiplier: 1.4,
        active: true,
        source: 'AUTO',
      },
      {
        name: 'Indiranagar Nightlife Zone',
        city: 'Bangalore',
        polygon: [
          [12.975, 77.635],
          [12.985, 77.645],
          [12.97, 77.65],
          [12.965, 77.638],
        ],
        multiplier: 1.6,
        active: true,
        source: 'MANUAL',
      },
      {
        name: 'BLR Airport Corridor',
        city: 'Bangalore',
        polygon: [
          [13.18, 77.69],
          [13.21, 77.72],
          [13.19, 77.73],
          [13.17, 77.7],
        ],
        multiplier: 1.2,
        active: true,
        source: 'AUTO',
      },
    ],
  });

  // 4. Seed Promo Codes
  console.log('Seeding Promo Codes...');
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 60 * 24 * 3600 * 1000);
  await prisma.promoCode.createMany({
    data: [
      {
        code: 'WELCOME50',
        type: PromoType.PERCENT,
        value: 50,
        maxDiscount: 100,
        minFare: 80,
        usageLimit: 5000,
        perUserLimit: 1,
        validFrom: now,
        validTo: nextMonth,
        firstRideOnly: true,
        active: true,
      },
      {
        code: 'UBERGO20',
        type: PromoType.PERCENT,
        value: 20,
        maxDiscount: 60,
        minFare: 100,
        usageLimit: 2000,
        perUserLimit: 3,
        validFrom: now,
        validTo: nextMonth,
        firstRideOnly: false,
        active: true,
      },
      {
        code: 'FLAT75',
        type: PromoType.FLAT,
        value: 75,
        maxDiscount: 75,
        minFare: 150,
        usageLimit: 1000,
        perUserLimit: 2,
        validFrom: now,
        validTo: nextMonth,
        firstRideOnly: false,
        active: true,
      },
      {
        code: 'AIRPORT100',
        type: PromoType.FLAT,
        value: 100,
        maxDiscount: 100,
        minFare: 400,
        usageLimit: 1000,
        perUserLimit: 2,
        validFrom: now,
        validTo: nextMonth,
        firstRideOnly: false,
        active: true,
      },
      {
        code: 'WEEKEND30',
        type: PromoType.PERCENT,
        value: 30,
        maxDiscount: 90,
        minFare: 120,
        usageLimit: 3000,
        perUserLimit: 2,
        validFrom: now,
        validTo: nextMonth,
        firstRideOnly: false,
        active: true,
      },
    ],
  });

  // 5. Seed Admin User
  console.log('Seeding Admin User...');
  const admin = await prisma.user.create({
    data: {
      clerkId: 'admin_master_clerk_id',
      name: 'Super Admin',
      email: 'admin@cabapp.local',
      role: Role.ADMIN,
      phone: '+91 98888 12345',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      walletBalance: 5000.0,
    },
  });

  // 6. Seed 20 Riders
  console.log('Seeding 20 Riders...');
  const riderUsers = [];
  for (let i = 1; i <= 20; i++) {
    const rider = await prisma.user.create({
      data: {
        clerkId: `rider_${i}_clerk_id`,
        name: `Rider ${i} (Customer)`,
        email: `rider${i}@cabapp.local`,
        role: Role.RIDER,
        phone: `+91 98765 ${10000 + i}`,
        photoUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=rider_${i}`,
        walletBalance: Math.floor(200 + Math.random() * 800),
        savedPlaces: {
          create: [
            { label: 'Home', address: 'Indiranagar 12th Main, Bengaluru', lat: 12.9784, lng: 77.6408 },
            { label: 'Work', address: 'MG Road Metro Station, Bengaluru', lat: 12.9756, lng: 77.6066 },
          ],
        },
        emergencyContacts: {
          create: [{ name: 'Family Contact', phone: '+91 99000 11222' }],
        },
        paymentMethods: {
          create: [
            { type: PaymentType.WALLET, brand: 'Wallet', isDefault: true },
            { type: PaymentType.UPI, brand: 'Google Pay', last4: 'rider@okaxis' },
            { type: PaymentType.CARD, brand: 'Mastercard', last4: '5544' },
          ],
        },
      },
    });
    riderUsers.push(rider);
  }

  // 7. Seed 25 Drivers with Vehicles and scattered coordinates
  console.log('Seeding 25 Drivers...');
  const driverProfiles = [];
  const carMakes = ['Maruti Suzuki', 'Hyundai', 'Tata', 'Toyota', 'Honda', 'Bajaj', 'Honda Activa'];
  const carModels = ['Dzire', 'Aura', 'Tigor', 'Etios', 'Amaze', 'RE Auto', 'Activa 6G'];
  const colors = ['White', 'Silver', 'Grey', 'Black', 'Blue', 'Yellow'];

  for (let i = 1; i <= 25; i++) {
    // Scatter around Bangalore center (-0.05 to +0.05 degrees ~ 5km)
    const latOffset = (Math.random() - 0.5) * 0.08;
    const lngOffset = (Math.random() - 0.5) * 0.08;
    const driverLat = BANGALORE_CENTER.lat + latOffset;
    const driverLng = BANGALORE_CENTER.lng + lngOffset;

    const vType = VEHICLE_TYPES[i % VEHICLE_TYPES.length];

    const driverUser = await prisma.user.create({
      data: {
        clerkId: `driver_${i}_clerk_id`,
        name: `Driver ${i} (Captain)`,
        email: `driver${i}@cabapp.local`,
        role: Role.DRIVER,
        phone: `+91 97412 ${20000 + i}`,
        photoUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=driver_${i}`,
        walletBalance: 1500.0,
      },
    });

    const profile = await prisma.driverProfile.create({
      data: {
        userId: driverUser.id,
        kycStatus: KycStatus.APPROVED,
        licenseNo: `DL-KA01-2018000${i}`,
        isOnline: i <= 20, // 20 online, 5 offline
        currentLat: driverLat,
        currentLng: driverLng,
        heading: Math.floor(Math.random() * 360),
        ratingAvg: Math.round((4.5 + Math.random() * 0.5) * 10) / 10,
        ratingCount: Math.floor(20 + Math.random() * 80),
        acceptanceRate: Math.floor(85 + Math.random() * 15),
        completedTrips: Math.floor(10 + Math.random() * 40),
        payoutsEnabled: true,
        vehicle: {
          create: {
            type: vType as VehicleType,
            make: carMakes[i % carMakes.length],
            model: carModels[i % carModels.length],
            color: colors[i % colors.length],
            plateNo: `KA 05 ${String.fromCharCode(65 + (i % 26))} ${1000 + i}`,
            year: 2021 + (i % 4),
            seats: VEHICLE_DETAILS[vType].capacity,
          },
        },
      },
      include: { vehicle: true, user: true },
    });
    driverProfiles.push(profile);
  }

  // 8. Seed 200 Historical Rides
  console.log('Seeding 200 Historical Completed Rides...');
  const locations = [
    { address: 'MG Road Metro Station', lat: 12.9756, lng: 77.6066 },
    { address: 'Indiranagar 100ft Road', lat: 12.9784, lng: 77.6408 },
    { address: 'Koramangala Sony World', lat: 12.9352, lng: 77.6245 },
    { address: 'HSR Layout BDA Complex', lat: 12.9121, lng: 77.6446 },
    { address: 'Whitefield ITPL Gate 2', lat: 12.9863, lng: 77.7338 },
    { address: 'Electronic City Phase 1', lat: 12.8452, lng: 77.6602 },
    { address: 'Kempegowda Int Airport', lat: 13.1986, lng: 77.7066 },
    { address: 'Cubbon Park Entrance', lat: 12.9763, lng: 77.5929 },
  ];

  for (let i = 1; i <= 200; i++) {
    const rider = riderUsers[i % riderUsers.length];
    const driver = driverProfiles[i % driverProfiles.length];
    const p1 = locations[i % locations.length];
    const p2 = locations[(i + 3) % locations.length];

    const distanceKm = Math.round((4 + Math.random() * 18) * 10) / 10;
    const durationMin = Math.round(distanceKm * 2.5);

    const breakdown = calculateFare({
      baseFare: 50,
      perKm: 14,
      perMinute: 2,
      minFare: 70,
      bookingFee: 15,
      taxPercent: 5,
      distanceKm,
      durationMin,
    });

    const daysAgo = Math.floor(Math.random() * 30);
    const rideDate = new Date(now.getTime() - daysAgo * 24 * 3600 * 1000);

    const ride = await prisma.ride.create({
      data: {
        riderId: rider.id,
        driverId: driver.id,
        vehicleType: driver.vehicle!.type,
        status: RideStatus.COMPLETED,
        pickupAddress: p1.address,
        pickupLat: p1.lat,
        pickupLng: p1.lng,
        dropoffAddress: p2.address,
        dropoffLat: p2.lat,
        dropoffLng: p2.lng,
        distanceKm,
        durationMin,
        estimatedFare: breakdown.finalFare,
        finalFare: breakdown.finalFare,
        fareBreakdown: breakdown as any,
        paymentMethod: PaymentType.WALLET,
        paymentStatus: PaymentStatus.PAID,
        otp: '4488',
        requestedAt: rideDate,
        acceptedAt: new Date(rideDate.getTime() + 15000),
        startedAt: new Date(rideDate.getTime() + 300000),
        completedAt: new Date(rideDate.getTime() + (durationMin + 5) * 60000),
        createdAt: rideDate,
      },
    });

    // Driver earning
    const gross = breakdown.finalFare;
    const commission = Math.round(gross * 0.2 * 100) / 100;
    const tip = i % 5 === 0 ? 30 : 0;
    const net = Math.round((gross - commission + tip) * 100) / 100;

    await prisma.driverEarning.create({
      data: {
        rideId: ride.id,
        driverId: driver.id,
        gross,
        commission,
        tip,
        net,
        createdAt: rideDate,
      },
    });

    // Rating
    if (i % 2 === 0) {
      await prisma.rating.create({
        data: {
          rideId: ride.id,
          fromUserId: rider.id,
          toUserId: driver.userId,
          stars: 5,
          tags: ['Polite Captain', 'Clean Vehicle', 'Smooth Driving'],
          comment: 'Very pleasant trip and arrived on time!',
          createdAt: rideDate,
        },
      });
    }
  }

  console.log(`✅ Database Seeding Complete!`);
  console.log(`- 1 Super Admin: admin@cabapp.local`);
  console.log(`- 20 Riders: rider1@cabapp.local .. rider20@cabapp.local`);
  console.log(`- 25 Drivers: driver1@cabapp.local .. driver25@cabapp.local (20 online)`);
  console.log(`- 5 Promo codes (WELCOME50, UBERGO20, FLAT75, AIRPORT100, WEEKEND30)`);
  console.log(`- 200 Completed historical rides with ratings & earnings`);
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
