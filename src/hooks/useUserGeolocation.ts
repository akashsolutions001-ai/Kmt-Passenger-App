import { useEffect, useState } from 'react';

export interface UserPosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

export function useUserGeolocation(enabled: boolean) {
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIsWatching(false);
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Location not supported on this device');
      return;
    }

    setIsWatching(true);
    setError(null);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
        setError(null);
      },
      (err) => {
        setError(err.message || 'Could not get your location');
        setIsWatching(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 20000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      setIsWatching(false);
    };
  }, [enabled]);

  return { position, error, isWatching };
}
