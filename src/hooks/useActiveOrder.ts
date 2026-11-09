import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface ActiveOrder {
  id: string;
  status: string;
  storeId?: string;
  driverStatus?: string;
  createdAt?: { toMillis?: () => number; seconds?: number } | null;
  [key: string]: unknown;
}

export const ACTIVE_ORDER_POLICY = {
  activeStatuses: [
    'pending',
    'searching',
    'accepted',
    'arriving',
    'arrived',
    'started',
    'in_progress',
    'on_trip',
    'ready_for_pickup',
    'driver_assigned',
    'at_store',
    'picked_up',
    'delivering',
    'on_the_way_to_store',
    'on_the_way_to_customer',
    'at_stop',
    'delivered',
  ],
  inactiveStatuses: [
    'completed',
    'cancelled',
    'rated',
    'cancelled_pending_refund',
    'rejected',
    'declined',
    'missed',
    'no_driver_found',
  ],
  routeForOrder(order: ActiveOrder): '/waiting-for-driver' | '/driver-coming' | '/order-tracking' | '/live-tracking' {
    const { status, driverStatus } = order;

    if (!order.storeId) {
      if (
        ['pending', 'searching'].includes(status) ||
        ['waiting', 'searching'].includes(String(driverStatus ?? ''))
      ) {
        return '/waiting-for-driver';
      }
      if (['started', 'in_progress', 'on_trip', 'at_stop'].includes(status)) {
        return '/live-tracking';
      }
      return '/driver-coming';
    }

    if (
      (status === 'driver_assigned' && driverStatus === 'assigned') ||
      ['at_store', 'picked_up', 'delivering', 'on_the_way_to_store', 'on_the_way_to_customer', 'at_stop', 'delivered'].includes(status)
    ) {
      return '/live-tracking';
    }

    return '/order-tracking';
  },
} as const;

export const ACTIVE_STATUSES = ACTIVE_ORDER_POLICY.activeStatuses;

export interface ActiveOrderContextValue {
  order: ActiveOrder | null;
  orderId: string | null;
  stage: string | null;
  isLoading: boolean;
  pendingRatingOrder: ActiveOrder | null;
}

const defaultValue: ActiveOrderContextValue = {
  order: null,
  orderId: null,
  stage: null,
  isLoading: true,
  pendingRatingOrder: null,
};

const ActiveOrderContext = createContext<ActiveOrderContextValue>(defaultValue);

const newestFirst = (orders: ActiveOrder[]) => orders.sort((a, b) => {
  const millis = (order: ActiveOrder) =>
    order.createdAt?.toMillis?.() ?? ((order.createdAt?.seconds ?? 0) * 1000);
  return millis(b) - millis(a);
});

const isInactive = (status: string) =>
  ACTIVE_ORDER_POLICY.inactiveStatuses.some((inactiveStatus) => inactiveStatus === status);

export const ActiveOrderProvider: React.FC<{ uid: string; children: React.ReactNode }> = ({ uid, children }) => {
  const [order, setOrder] = useState<ActiveOrder | null>(null);
  const [pendingRatingCandidate, setPendingRatingCandidate] = useState<ActiveOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setOrder(null);
    setPendingRatingCandidate(null);
    setIsLoading(true);
    const loadingSafetyTimeout = window.setTimeout(() => setIsLoading(false), 4000);

    const riderOrdersQuery = query(
      collection(db, 'orders'),
      where('userId', '==', uid),
    );

    const unsubscribe = onSnapshot(riderOrdersQuery, (snapshot) => {
      const riderOrders = newestFirst(snapshot.docs.map((document) => ({
        ...document.data(),
        id: document.id,
      }) as ActiveOrder));
      const orders = riderOrders.filter((candidate) =>
        Boolean(candidate.status) &&
        !isInactive(candidate.status) &&
        !isInactive(String(candidate.driverStatus ?? ''))
      );
      const activeOrder = orders[0] ?? null;
      const pendingRatingOrder = riderOrders.find((candidate) =>
        candidate.status === 'completed' &&
        !['rated', 'skipped'].includes(String(candidate.ratingStatus ?? ''))
      ) ?? null;
      setOrder(activeOrder);
      setPendingRatingCandidate(pendingRatingOrder);
      setIsLoading(false);
    }, (error) => {
      console.error('Could not load active orders:', error);
      setOrder(null);
      setPendingRatingCandidate(null);
      setIsLoading(false);
    });

    return () => {
      window.clearTimeout(loadingSafetyTimeout);
      unsubscribe();
    };
  }, [uid]);

  const value = useMemo<ActiveOrderContextValue>(() => ({
    order,
    orderId: order?.id ?? null,
    stage: order?.status ?? null,
    isLoading,
    pendingRatingOrder: order ? null : pendingRatingCandidate,
  }), [order, pendingRatingCandidate, isLoading]);

  return React.createElement(ActiveOrderContext.Provider, { value }, children);
};

export const useActiveOrder = () => useContext(ActiveOrderContext);

export const buildTrackingState = (order: ActiveOrder, orderId = order.id) => {
  const pickup = order.pickup && typeof order.pickup === 'object' && 'address' in order.pickup
    ? order.pickup.address
    : order.pickupAddress;
  const destination = order.dropoff && typeof order.dropoff === 'object' && 'address' in order.dropoff
    ? order.dropoff.address
    : order.destinationAddress;
  const pickupCoords = order.pickupCoords ?? (
    typeof order.pickupLat === 'number' && typeof order.pickupLng === 'number'
      ? { lat: order.pickupLat, lng: order.pickupLng }
      : undefined
  );
  const destinationCoords = order.destinationCoords ?? (
    typeof order.dropLat === 'number' && typeof order.dropLng === 'number'
      ? { lat: order.dropLat, lng: order.dropLng }
      : undefined
  );

  return {
    orderId,
    orderType: order.serviceType ?? order.orderType ?? (order.storeId ? 'food' : 'ride'),
    orderData: {
      ...order,
      pickup,
      destination,
      driverId: (order.driver as { id?: string } | undefined)?.id ?? order.driverId ?? null,
      driverInfo: order.driver ?? null,
      encodedPolyline: order.encodedPolyline ?? order.polyline ?? null,
      pickupCoords,
      destinationCoords,
      storeLocation: order.storeLocation ?? (order.storeId && pickupCoords ? pickupCoords : undefined),
    },
  };
};
