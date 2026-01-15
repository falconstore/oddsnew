import { useState, useCallback } from 'react';

interface SwipeGestureOptions {
  threshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export function useSwipeGesture({
  threshold = 50,
  onSwipeLeft,
  onSwipeRight,
}: SwipeGestureOptions) {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [swiping, setSwiping] = useState(false);
  const [swipeDistance, setSwipeDistance] = useState(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setSwiping(true);
    setSwipeDistance(0);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStart === null) return;
    const currentTouch = e.targetTouches[0].clientX;
    setTouchEnd(currentTouch);
    setSwipeDistance(touchStart - currentTouch);
  }, [touchStart]);

  const onTouchEnd = useCallback(() => {
    setSwiping(false);
    if (!touchStart || !touchEnd) {
      setSwipeDistance(0);
      return;
    }
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > threshold;
    const isRightSwipe = distance < -threshold;
    
    if (isLeftSwipe && onSwipeLeft) {
      onSwipeLeft();
    }
    
    if (isRightSwipe && onSwipeRight) {
      onSwipeRight();
    }
    
    setSwipeDistance(0);
    setTouchStart(null);
    setTouchEnd(null);
  }, [touchStart, touchEnd, threshold, onSwipeLeft, onSwipeRight]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    swiping,
    swipeDistance,
  };
}
