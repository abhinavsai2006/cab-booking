export const VEHICLE_TYPES = ['BIKE', 'AUTO', 'MINI', 'SEDAN', 'SUV'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const RIDE_STATUSES = [
  'REQUESTED',
  'SEARCHING',
  'DRIVER_ASSIGNED',
  'DRIVER_ARRIVED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED_BY_RIDER',
  'CANCELLED_BY_DRIVER',
  'NO_DRIVERS_FOUND',
  'SCHEDULED',
] as const;
export type RideStatus = (typeof RIDE_STATUSES)[number];

export const PAYMENT_TYPES = ['CARD', 'UPI', 'WALLET', 'CASH'] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const DEFAULT_CITY = 'Bangalore';
export const DEFAULT_CENTER = {
  lat: 12.9716,
  lng: 77.5946,
  name: 'Bangalore City Centre',
};

export const VEHICLE_DETAILS: Record<
  VehicleType,
  { name: string; capacity: number; icon: string; description: string; baseMultiplier: number }
> = {
  BIKE: {
    name: 'Moto Bike',
    capacity: 1,
    icon: 'bike',
    description: 'Fast & economical for solo commuters',
    baseMultiplier: 0.6,
  },
  AUTO: {
    name: 'Auto Rickshaw',
    capacity: 3,
    icon: 'auto',
    description: 'Quick local hops & everyday commute',
    baseMultiplier: 0.8,
  },
  MINI: {
    name: 'Uber Go Mini',
    capacity: 4,
    icon: 'car-mini',
    description: 'Affordable compact hatchbacks',
    baseMultiplier: 1.0,
  },
  SEDAN: {
    name: 'Premier Sedan',
    capacity: 4,
    icon: 'car-sedan',
    description: 'Comfortable sedans with top-rated drivers',
    baseMultiplier: 1.3,
  },
  SUV: {
    name: 'Uber XL (SUV)',
    capacity: 6,
    icon: 'car-suv',
    description: 'Spacious 6-seater for groups and luggage',
    baseMultiplier: 1.7,
  },
};

export const DISPATCH_CONFIG = {
  OFFER_TIMEOUT_SECONDS: 15,
  MAX_SEARCH_RADIUS_KM: 8.0,
  INITIAL_RADIUS_KM: 3.0,
  EXPANDED_RADIUS_KM: 5.0,
  MAX_OFFER_ATTEMPTS: 5,
  TOTAL_DISPATCH_TIMEOUT_SECONDS: 90,
  FREE_CANCELLATION_MINUTES: 2,
  FREE_WAITING_MINUTES: 3,
  DRIVER_LOCATION_UPDATE_INTERVAL_MS: 3000,
  DRIVER_LOCATION_THROTTLE_RECORD_MS: 5000,
  ETA_REFRESH_INTERVAL_MS: 20000,
};
