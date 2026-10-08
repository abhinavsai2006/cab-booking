import { z } from 'zod';
import { VEHICLE_TYPES, PAYMENT_TYPES, RIDE_STATUSES } from '../constants/index.js';

export const LocationSchema = z.object({
  address: z.string().min(1, 'Address is required'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const AutocompleteQuerySchema = z.object({
  query: z.string().min(2, 'Query must be at least 2 characters'),
  city: z.string().optional(),
});

export const ReverseGeocodeQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const RouteQuerySchema = z.object({
  pickup: LocationSchema,
  dropoff: LocationSchema,
  stops: z.array(LocationSchema).max(3).optional().default([]),
});

export const FareEstimateQuerySchema = z.object({
  pickup: LocationSchema,
  dropoff: LocationSchema,
  stops: z.array(LocationSchema).max(3).optional().default([]),
  promoCode: z.string().optional(),
});

export const CreateRideSchema = z.object({
  vehicleType: z.enum(VEHICLE_TYPES),
  pickup: LocationSchema,
  dropoff: LocationSchema,
  stops: z.array(LocationSchema).max(3).optional().default([]),
  paymentMethod: z.enum(PAYMENT_TYPES).default('CASH'),
  promoCode: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
});

export const CancelRideSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
});

export const ChangeDestinationSchema = z.object({
  newDropoff: LocationSchema,
});

export const DriverOnboardingSchema = z.object({
  licenseNo: z.string().min(5, 'Valid license number is required'),
  licenseUrl: z.string().url().optional(),
  rcUrl: z.string().url().optional(),
  insuranceUrl: z.string().url().optional(),
  aadhaarOrIdUrl: z.string().url().optional(),
  vehicle: z.object({
    type: z.enum(VEHICLE_TYPES),
    make: z.string().min(2),
    model: z.string().min(2),
    color: z.string().min(2),
    plateNo: z.string().min(4),
    year: z.number().min(2000).max(new Date().getFullYear() + 1),
    seats: z.number().min(1).max(8),
  }),
});

export const UpdateLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional().default(0),
  speed: z.number().optional().default(0),
});

export const StartTripSchema = z.object({
  otp: z.string().length(4, 'OTP must be 4 digits'),
});

export const RateRideSchema = z.object({
  stars: z.number().int().min(1).max(5),
  tags: z.array(z.string()).optional().default([]),
  comment: z.string().max(500).optional(),
});

export const TipRideSchema = z.object({
  amount: z.number().positive('Tip must be a positive number'),
});

export const SavedPlaceSchema = z.object({
  label: z.string().min(1),
  address: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
});

export const EmergencyContactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(8),
});

export const CreateSupportTicketSchema = z.object({
  category: z.enum(['PAYMENT', 'LOST_ITEM', 'DRIVER_BEHAVIOR', 'SAFETY', 'APP_BUG', 'OTHER']),
  subject: z.string().min(3),
  message: z.string().min(5),
  rideId: z.string().uuid().optional(),
});

export const TicketMessageSchema = z.object({
  message: z.string().min(1),
});

export const TriggerSosSchema = z.object({
  rideId: z.string().uuid().optional(),
  lat: z.number(),
  lng: z.number(),
  address: z.string().optional(),
});

export const ValidatePromoSchema = z.object({
  code: z.string().min(2),
  vehicleType: z.enum(VEHICLE_TYPES),
  estimatedFare: z.number().positive(),
});

export const CreatePromoSchema = z.object({
  code: z.string().min(3).toUpperCase(),
  type: z.enum(['PERCENT', 'FLAT']),
  value: z.number().positive(),
  maxDiscount: z.number().positive(),
  minFare: z.number().positive(),
  usageLimit: z.number().int().positive().default(1000),
  perUserLimit: z.number().int().positive().default(1),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime(),
  vehicleTypes: z.array(z.enum(VEHICLE_TYPES)).optional(),
  firstRideOnly: z.boolean().default(false),
  active: z.boolean().default(true),
});

export const AdminKycReviewSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().optional(),
});

export const AdminFareConfigSchema = z.object({
  city: z.string().default('Bangalore'),
  vehicleType: z.enum(VEHICLE_TYPES),
  baseFare: z.number().positive(),
  perKm: z.number().positive(),
  perMinute: z.number().positive(),
  minFare: z.number().positive(),
  bookingFee: z.number().default(15),
  cancellationFee: z.number().default(50),
  waitingPerMin: z.number().default(2),
  nightMultiplier: z.number().default(1.25),
  nightStart: z.number().default(23),
  nightEnd: z.number().default(5),
  taxPercent: z.number().default(5),
  currency: z.string().default('INR'),
});

export const AdminSurgeZoneSchema = z.object({
  name: z.string().min(2),
  city: z.string().default('Bangalore'),
  polygon: z.array(z.tuple([z.number(), z.number()])).min(3),
  multiplier: z.number().min(1.0).max(4.0),
  active: z.boolean().default(true),
  source: z.enum(['MANUAL', 'AUTO']).default('MANUAL'),
});
