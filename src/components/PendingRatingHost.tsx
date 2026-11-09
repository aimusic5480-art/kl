import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getDoc, increment, updateDoc, doc } from 'firebase/firestore';
import { RatingModal } from './RatingModal';
import { db } from '../config/firebase';
import { ActiveOrder, useActiveOrder } from '../hooks/useActiveOrder';
import { markOrderRated } from '../services/orderService';

interface PendingRatingHostProps {
  onOpenChange: (isOpen: boolean) => void;
}

interface RatingDetails {
  orderId: string;
  driverName: string;
  driverPhoto: string;
  driverId: string;
  storeName: string;
  storeImage: string;
  storeId: string;
}

type RatingOrderRecord = ActiveOrder & {
  driver?: unknown;
  driverSnapshot?: unknown;
  driverName?: unknown;
  driverPhoto?: unknown;
  driverId?: unknown;
  storeName?: unknown;
  storeImage?: unknown;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? value as Record<string, unknown> : {};
const asText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export const PendingRatingHost: React.FC<PendingRatingHostProps> = ({ onOpenChange }) => {
  const { pendingRatingOrder } = useActiveOrder();
  const location = useLocation();
  const shownOrderIds = useRef(new Set<string>());
  const submitted = useRef(false);
  const [visibleOrder, setVisibleOrder] = useState<ActiveOrder | null>(null);
  const [ratingDetails, setRatingDetails] = useState<RatingDetails | null>(null);

  useEffect(() => {
    const isLiveTrackingPage = location.pathname === '/driver-coming' || location.pathname === '/live-tracking';
    if (!pendingRatingOrder || isLiveTrackingPage || shownOrderIds.current.has(pendingRatingOrder.id)) return;

    const order = pendingRatingOrder as RatingOrderRecord;
    const driverSnapshot = asRecord(order.driverSnapshot);
    const driver = asRecord(order.driver);
    const driverId = asText(order.driverId);
    const storeId = asText(order.storeId);
    const details: RatingDetails = {
      orderId: order.id,
      driverName: asText(driverSnapshot.firstName) || asText(driver.name) || asText(order.driverName),
      driverPhoto: asText(driverSnapshot.profilePicture) || asText(driver.photo) || asText(order.driverPhoto),
      driverId: driverId || asText(driver.id),
      storeName: asText(order.storeName),
      storeImage: asText(order.storeImage),
      storeId,
    };

    shownOrderIds.current.add(pendingRatingOrder.id);
    submitted.current = false;
    setVisibleOrder(pendingRatingOrder);
    setRatingDetails(details);
    onOpenChange(true);

    if (driverId && (!details.driverName || !details.driverPhoto)) {
      void getDoc(doc(db, 'drivers', driverId)).then((snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        setRatingDetails((current) => current?.orderId === order.id ? {
          ...current,
          driverName: current.driverName || asText(data.profile?.firstName) || asText(data.firstName),
          driverPhoto: current.driverPhoto || asText(data.profile?.profilePicture) || asText(data.profilePicture),
        } : current);
      }).catch((error) => console.error('Could not load driver details for rating:', error));
    }

    if (storeId && (!details.storeName || !details.storeImage)) {
      void getDoc(doc(db, 'stores', storeId)).then((snapshot) => {
        if (!snapshot.exists()) return;
        const store = snapshot.data();
        setRatingDetails((current) => current?.orderId === order.id ? {
          ...current,
          storeName: current.storeName || asText(store.storeName),
          storeImage: current.storeImage || asText(store.logo),
        } : current);
      }).catch((error) => console.error('Could not load store details for rating:', error));
    }
  }, [pendingRatingOrder, location.pathname, onOpenChange]);

  const handleClose = () => {
    const order = visibleOrder;
    setVisibleOrder(null);
    onOpenChange(false);

    if (!order || submitted.current) return;

    const nextPromptCount = Number(order.ratingPromptCount ?? 0) + 1;
    void updateDoc(doc(db, 'orders', order.id), {
      ratingPromptCount: increment(1),
      ...(nextPromptCount >= 3 ? { ratingStatus: 'skipped' } : {}),
    }).catch((error) => console.error('Could not save rating dismissal:', error));
  };

  const handleSubmitted = async () => {
    if (!visibleOrder) return;
    submitted.current = true;
    await markOrderRated(visibleOrder.id);
  };

  if (!visibleOrder) return null;

  const visibleDetails = ratingDetails?.orderId === visibleOrder.id ? ratingDetails : null;
  return (
    <RatingModal
      isOpen
      canClose
      onClose={handleClose}
      onSubmitted={handleSubmitted}
      path={visibleOrder.storeId ? 'store_delivery' : 'direct_trip'}
      driverName={visibleDetails?.driverName || 'Driver'}
      driverPhoto={visibleDetails?.driverPhoto || ''}
      driverId={visibleDetails?.driverId || ''}
      orderId={visibleOrder.id}
      storeName={visibleDetails?.storeName || 'Store'}
      storeImage={visibleDetails?.storeImage || ''}
      storeId={visibleDetails?.storeId || ''}
    />
  );
};
