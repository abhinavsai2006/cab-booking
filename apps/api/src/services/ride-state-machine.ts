import { RideStatus, Role } from '@prisma/client';
import { prisma } from '../db/prisma.js';

const ALLOWED_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  REQUESTED: [RideStatus.SEARCHING, RideStatus.CANCELLED_BY_RIDER, RideStatus.CANCELLED_BY_DRIVER],
  SCHEDULED: [RideStatus.SEARCHING, RideStatus.CANCELLED_BY_RIDER],
  SEARCHING: [
    RideStatus.DRIVER_ASSIGNED,
    RideStatus.NO_DRIVERS_FOUND,
    RideStatus.CANCELLED_BY_RIDER,
    RideStatus.CANCELLED_BY_DRIVER,
  ],
  DRIVER_ASSIGNED: [
    RideStatus.DRIVER_ARRIVED,
    RideStatus.CANCELLED_BY_RIDER,
    RideStatus.CANCELLED_BY_DRIVER,
  ],
  DRIVER_ARRIVED: [
    RideStatus.IN_PROGRESS,
    RideStatus.CANCELLED_BY_RIDER,
    RideStatus.CANCELLED_BY_DRIVER,
  ],
  IN_PROGRESS: [RideStatus.COMPLETED],
  COMPLETED: [],
  CANCELLED_BY_RIDER: [],
  CANCELLED_BY_DRIVER: [],
  NO_DRIVERS_FOUND: [],
};

export interface TransitionContext {
  driverId?: string;
  cancelledBy?: Role;
  cancelReason?: string;
  cancellationFee?: number;
  finalFare?: number;
  fareBreakdown?: any;
}

export class RideStateMachine {
  static canTransition(current: RideStatus, next: RideStatus): boolean {
    return ALLOWED_TRANSITIONS[current]?.includes(next) ?? false;
  }

  static async transition(
    rideId: string,
    nextStatus: RideStatus,
    ctx: TransitionContext = {}
  ) {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch with row locking where supported, or atomic query
      const ride = await tx.ride.findUnique({
        where: { id: rideId },
        include: { rider: true, driver: { include: { user: true, vehicle: true } } },
      });

      if (!ride) {
        throw new Error(`Ride with ID ${rideId} not found`);
      }

      if (!this.canTransition(ride.status, nextStatus)) {
        throw new Error(
          `Illegal transition from ${ride.status} to ${nextStatus} for ride ${rideId}`
        );
      }

      const now = new Date();
      const updateData: any = {
        status: nextStatus,
        updatedAt: now,
      };

      if (nextStatus === RideStatus.SEARCHING) {
        // start searching
      } else if (nextStatus === RideStatus.DRIVER_ASSIGNED && ctx.driverId) {
        updateData.driverId = ctx.driverId;
        updateData.acceptedAt = now;
      } else if (nextStatus === RideStatus.DRIVER_ARRIVED) {
        updateData.arrivedAt = now;
      } else if (nextStatus === RideStatus.IN_PROGRESS) {
        updateData.startedAt = now;
      } else if (nextStatus === RideStatus.COMPLETED) {
        updateData.completedAt = now;
        if (ctx.finalFare !== undefined) updateData.finalFare = ctx.finalFare;
        if (ctx.fareBreakdown !== undefined) updateData.fareBreakdown = ctx.fareBreakdown;
        updateData.paymentStatus = 'PAID';
      } else if (
        nextStatus === RideStatus.CANCELLED_BY_RIDER ||
        nextStatus === RideStatus.CANCELLED_BY_DRIVER
      ) {
        updateData.cancelledAt = now;
        updateData.cancelledBy = ctx.cancelledBy;
        updateData.cancelReason = ctx.cancelReason || 'Cancelled';
        updateData.cancellationFee = ctx.cancellationFee || 0;
      }

      const updatedRide = await tx.ride.update({
        where: { id: rideId },
        data: updateData,
        include: { rider: true, driver: { include: { user: true, vehicle: true } } },
      });

      // Create in-app notification for rider
      let notifTitle = 'Ride Update';
      let notifBody = `Your ride status is now ${nextStatus.replace(/_/g, ' ')}`;
      if (nextStatus === RideStatus.DRIVER_ASSIGNED) {
        notifTitle = 'Driver Assigned!';
        notifBody = `Your driver is on the way. Share OTP ${updatedRide.otp} at pickup.`;
      } else if (nextStatus === RideStatus.DRIVER_ARRIVED) {
        notifTitle = 'Driver Arrived!';
        notifBody = 'Your driver is waiting at the pickup location.';
      } else if (nextStatus === RideStatus.IN_PROGRESS) {
        notifTitle = 'Ride Started';
        notifBody = 'Have a safe trip!';
      } else if (nextStatus === RideStatus.COMPLETED) {
        notifTitle = 'Trip Completed';
        notifBody = `Your trip completed. Total fare: ₹${updatedRide.finalFare || updatedRide.estimatedFare}`;
      }

      await tx.notification.create({
        data: {
          userId: updatedRide.riderId,
          title: notifTitle,
          body: notifBody,
          type: 'RIDE_UPDATE',
          data: { rideId: updatedRide.id, status: nextStatus },
        },
      });

      return updatedRide;
    });
  }
}
