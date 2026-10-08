import { FareCalculationInput, FareBreakdown } from '../types/index.js';

export function calculateFare(input: FareCalculationInput): FareBreakdown {
  const {
    baseFare,
    perKm,
    perMinute,
    minFare,
    bookingFee,
    taxPercent,
    distanceKm,
    durationMin,
    surgeMultiplier = 1.0,
    isNightTime = false,
    nightMultiplier = 1.25,
    waitingMinutes = 0,
    waitingPerMin = 2.0,
    stopsCount = 0,
    perStopFee = 20.0,
    promoDiscountPercent = 0,
    promoFlatDiscount = 0,
    maxPromoDiscount = 100,
  } = input;

  // 1. Raw distance & time charges
  const distanceFare = round(distanceKm * perKm);
  const timeFare = round(durationMin * perMinute);

  // 2. Base formula: max(minFare, baseFare + perKm*distance + perMin*duration + bookingFee)
  const baseTripFare = baseFare + distanceFare + timeFare + bookingFee;
  const initialFare = Math.max(minFare, baseTripFare);

  // 3. Waiting charge (after 3 free minutes)
  const chargeableWaitingMin = Math.max(0, waitingMinutes - 3);
  const waitingFee = round(chargeableWaitingMin * waitingPerMin);

  // 4. Multi-stop fee
  const stopsFee = round(stopsCount * perStopFee);

  // 5. Surge multiplier
  const effectiveSurge = Math.max(1.0, surgeMultiplier);
  const fareWithSurge = (initialFare + waitingFee + stopsFee) * effectiveSurge;
  const surgeAmount = round(fareWithSurge - (initialFare + waitingFee + stopsFee));

  // 6. Night multiplier
  const effectiveNight = isNightTime ? Math.max(1.0, nightMultiplier) : 1.0;
  const fareWithNight = fareWithSurge * effectiveNight;
  const nightAmount = round(fareWithNight - fareWithSurge);

  const subtotal = round(fareWithNight);

  // 7. Promo discount
  let calculatedDiscount = 0;
  if (promoDiscountPercent > 0) {
    calculatedDiscount = (subtotal * promoDiscountPercent) / 100;
  } else if (promoFlatDiscount > 0) {
    calculatedDiscount = promoFlatDiscount;
  }
  const discount = round(Math.min(calculatedDiscount, maxPromoDiscount, subtotal));

  const discountedSubtotal = Math.max(0, subtotal - discount);

  // 8. Tax
  const taxAmount = round((discountedSubtotal * taxPercent) / 100);

  // 9. Final fare
  const finalFare = round(discountedSubtotal + taxAmount);

  return {
    baseFare,
    distanceFare,
    timeFare,
    bookingFee,
    subtotal,
    surgeMultiplier: effectiveSurge,
    surgeAmount,
    nightMultiplier: effectiveNight,
    nightAmount,
    waitingFee,
    stopsFee,
    discount,
    taxPercent,
    taxAmount,
    finalFare,
    currency: 'INR',
  };
}

export function isNightHours(date: Date = new Date(), startHour = 23, endHour = 5): boolean {
  const currentHour = date.getHours();
  if (startHour > endHour) {
    // e.g. 23 to 5
    return currentHour >= startHour || currentHour < endHour;
  }
  return currentHour >= startHour && currentHour < endHour;
}

export function calculateFinalFareWithCap(
  estimatedFare: number,
  calculatedFinalFare: number,
  destinationChanged: boolean = false
): number {
  if (destinationChanged) {
    return round(calculatedFinalFare);
  }
  const maxCappedFare = round(estimatedFare * 1.5);
  return Math.min(round(calculatedFinalFare), maxCappedFare);
}

function round(val: number): number {
  return Math.round(val * 100) / 100;
}
