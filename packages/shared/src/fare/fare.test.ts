import { describe, it, expect } from 'vitest';
import { calculateFare, calculateFinalFareWithCap, isNightHours } from './index.js';

describe('Fare Engine', () => {
  const baseInput = {
    baseFare: 50,
    perKm: 12,
    perMinute: 2,
    minFare: 80,
    bookingFee: 15,
    taxPercent: 5,
    distanceKm: 10,
    durationMin: 20,
    surgeMultiplier: 1.0,
    isNightTime: false,
    nightMultiplier: 1.25,
  };

  it('calculates standard daytime fare without surge or promo', () => {
    // distanceFare = 10 * 12 = 120
    // timeFare = 20 * 2 = 40
    // baseTrip = 50 + 120 + 40 + 15 = 225
    // max(80, 225) = 225
    // subtotal = 225
    // tax = 5% of 225 = 11.25
    // final = 236.25
    const result = calculateFare(baseInput);
    expect(result.subtotal).toBe(225);
    expect(result.taxAmount).toBe(11.25);
    expect(result.finalFare).toBe(236.25);
    expect(result.surgeAmount).toBe(0);
    expect(result.discount).toBe(0);
  });

  it('enforces minFare when trip is very short', () => {
    const result = calculateFare({
      ...baseInput,
      distanceKm: 0.5,
      durationMin: 2,
    });
    // baseTrip = 50 + 6 + 4 + 15 = 75
    // minFare is 80 -> subtotal = 80
    // tax = 5% of 80 = 4
    // final = 84
    expect(result.subtotal).toBe(80);
    expect(result.finalFare).toBe(84);
  });

  it('applies surge multiplier correctly', () => {
    const result = calculateFare({
      ...baseInput,
      surgeMultiplier: 1.5,
    });
    // 225 * 1.5 = 337.5
    expect(result.subtotal).toBe(337.5);
    expect(result.surgeAmount).toBe(112.5);
  });

  it('applies night multiplier correctly', () => {
    const result = calculateFare({
      ...baseInput,
      isNightTime: true,
      nightMultiplier: 1.25,
    });
    // 225 * 1.25 = 281.25
    expect(result.subtotal).toBe(281.25);
    expect(result.nightAmount).toBe(56.25);
  });

  it('charges for waiting only after 3 free minutes', () => {
    const withoutFee = calculateFare({
      ...baseInput,
      waitingMinutes: 3,
      waitingPerMin: 3.0,
    });
    expect(withoutFee.waitingFee).toBe(0);

    const withFee = calculateFare({
      ...baseInput,
      waitingMinutes: 8,
      waitingPerMin: 3.0,
    });
    // 8 - 3 = 5 chargeable minutes * 3.0 = 15
    expect(withFee.waitingFee).toBe(15);
  });

  it('adds multi-stop fees', () => {
    const result = calculateFare({
      ...baseInput,
      stopsCount: 2,
      perStopFee: 25.0,
    });
    expect(result.stopsFee).toBe(50);
  });

  it('applies promo discount and enforces maximum discount cap', () => {
    const result = calculateFare({
      ...baseInput,
      promoDiscountPercent: 20,
      maxPromoDiscount: 30, // subtotal is 225, 20% is 45, capped at 30
    });
    expect(result.discount).toBe(30);
    // 225 - 30 = 195; 5% tax = 9.75; final = 204.75
    expect(result.finalFare).toBe(204.75);
  });

  it('caps final fare at 1.5x estimate unless destination changed', () => {
    const estimate = 200;
    // 1.5x of 200 is 300
    expect(calculateFinalFareWithCap(estimate, 250, false)).toBe(250);
    expect(calculateFinalFareWithCap(estimate, 350, false)).toBe(300);
    // when destination changed, no cap
    expect(calculateFinalFareWithCap(estimate, 350, true)).toBe(350);
  });

  it('evaluates night hours correctly', () => {
    const lateNight = new Date('2026-05-10T23:30:00');
    const earlyMorning = new Date('2026-05-10T03:15:00');
    const afternoon = new Date('2026-05-10T14:00:00');

    expect(isNightHours(lateNight, 23, 5)).toBe(true);
    expect(isNightHours(earlyMorning, 23, 5)).toBe(true);
    expect(isNightHours(afternoon, 23, 5)).toBe(false);
  });
});
