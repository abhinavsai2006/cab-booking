import { VehicleType, RideStatus, PaymentType } from '../constants/index.js';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface LocationWithAddress extends LatLng {
  address: string;
}

export interface StopPoint extends LocationWithAddress {
  order: number;
}

export interface FareCalculationInput {
  baseFare: number;
  perKm: number;
  perMinute: number;
  minFare: number;
  bookingFee: number;
  taxPercent: number;
  distanceKm: number;
  durationMin: number;
  surgeMultiplier?: number;
  isNightTime?: boolean;
  nightMultiplier?: number;
  waitingMinutes?: number;
  waitingPerMin?: number;
  stopsCount?: number;
  perStopFee?: number;
  promoDiscountPercent?: number;
  promoFlatDiscount?: number;
  maxPromoDiscount?: number;
}

export interface FareBreakdown {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  bookingFee: number;
  subtotal: number;
  surgeMultiplier: number;
  surgeAmount: number;
  nightMultiplier: number;
  nightAmount: number;
  waitingFee: number;
  stopsFee: number;
  discount: number;
  taxPercent: number;
  taxAmount: number;
  finalFare: number;
  currency: string;
}

export interface VehicleEstimate {
  vehicleType: VehicleType;
  name: string;
  description: string;
  capacity: number;
  estimatedFare: number;
  distanceKm: number;
  durationMin: number;
  etaMinutes: number;
  surgeMultiplier: number;
  breakdown: FareBreakdown;
  availableDriversCount: number;
}

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
}

export interface RouteDetails {
  distanceKm: number;
  durationMin: number;
  polyline: string;
  coordinates: [number, number][]; // [lat, lng][]
  steps?: RouteStep[];
}

export interface PlaceSuggestion {
  id: string;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
}

export interface DriverLiveState {
  driverId: string;
  name: string;
  vehicleType: VehicleType;
  make: string;
  model: string;
  plateNo: string;
  lat: number;
  lng: number;
  heading: number;
  isOnline: boolean;
  ratingAvg: number;
}

export interface RideOfferEvent {
  offerId: string;
  rideId: string;
  pickup: LocationWithAddress;
  dropoff: LocationWithAddress;
  stops: LocationWithAddress[];
  distanceKm: number;
  durationMin: number;
  estimatedFare: number;
  distanceToPickupKm: number;
  timeoutSeconds: number;
}

export interface RideUpdateEvent {
  rideId: string;
  status: RideStatus;
  driver?: {
    id: string;
    name: string;
    phone: string;
    photoUrl?: string;
    ratingAvg: number;
    vehicle: {
      make: string;
      model: string;
      color: string;
      plateNo: string;
      type: VehicleType;
    };
    currentLat?: number;
    currentLng?: number;
    heading?: number;
  };
  etaMinutes?: number;
  otp?: string;
  pickup: LocationWithAddress;
  dropoff: LocationWithAddress;
  fare: number;
}
