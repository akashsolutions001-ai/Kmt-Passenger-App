import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Student, Route, BusState, AppNotification, StopStatus } from '@/types/student';
import { Passenger as FirestorePassenger, Route as FirestoreRoute, LiveBus } from '@/types/firestore';
import type { RealtimeBusLocation, RealtimeCurrentStop, RealtimeStopEntry } from '@/types/realtime';
import {
  getRoutes,
  subscribeToRoutes,
  subscribeToLiveBus,
  getPassengerByEmail,
  getPassengerByDocId,
  createPassenger,
  subscribeToPassenger,
  subscribeToPassengerByDocId,
  updatePassenger,
  updatePassengerByDocId,
  getBusByRouteId,
  subscribeToBusByRouteId,
} from '@/services/firestore';
import { subscribeToRealtimeBusByBusNumber, subscribeToRealtimeBusByRouteId } from '@/services/realtimeDb';
import {
  initFCMForPassenger,
  refreshAndSaveFCMToken,
  registerServiceWorker,
  requestNotificationPermission,
  setupForegroundMessageHandler,
  showSystemNotification,
  updatePassengerRouteStopInRTDB,
} from '@/services/fcm';
import { signInWithGoogle, signOutAuth, subscribeToAuthState } from '@/services/auth';
import {
  convertFirestoreRouteToAppRoute,
  convertLiveBusToBusState,
  getStopStatusByIndex,
} from '@/utils/firestoreConverters';
import { toast } from 'sonner';

const SESSION_STORAGE_KEY = 'kmt_passenger_session';

interface StudentContextType {
  student: Student | null;
  passenger: Student | null;
  isLoggedIn: boolean;
  isGuest: boolean;
  trackingReady: boolean;
  routes: Route[];
  selectedRoute: Route | null;
  liveBus: LiveBus | null;
  realtimeLocation: RealtimeBusLocation | null;
  realtimeRouteState: string | null;
  realtimeCurrentStop: RealtimeCurrentStop | null;
  /** RTDB stops keyed by stop id e.g. "1-1", "1-2" */
  realtimeStops: Record<string, RealtimeStopEntry> | null;
  busState: BusState;
  notifications: AppNotification[];
  unreadCount: number;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  continueAsGuest: () => void;
  refreshTracking: () => void;
  logout: () => void;
  selectRoute: (routeId: string) => void;
  selectStop: (stopId: string) => void;
  confirmSelection: () => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const useStudent = () => {
  const context = useContext(StudentContext);
  if (!context) {
    throw new Error('useStudent must be used within a StudentProvider');
  }
  return context;
};

export const StudentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isGuest, setIsGuest] = useState(() => {
    try {
      return localStorage.getItem('kmt_guest') === 'true';
    } catch {
      return false;
    }
  });
  const [trackingReady, setTrackingReady] = useState(false);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [liveBus, setLiveBus] = useState<LiveBus | null>(null);
  const [realtimeLocation, setRealtimeLocation] = useState<RealtimeBusLocation | null>(null);
  const [realtimeRouteState, setRealtimeRouteState] = useState<string | null>(null);
  const [realtimeCurrentStop, setRealtimeCurrentStop] = useState<RealtimeCurrentStop | null>(null);
  const [realtimeStops, setRealtimeStops] = useState<Record<string, RealtimeStopEntry> | null>(null);
  const [assignedBusNumber, setAssignedBusNumber] = useState<string | null>(null);
  const [trackingRefreshNonce, setTrackingRefreshNonce] = useState(0);
  const [busState, setBusState] = useState<BusState>({
    status: 'not-started',
    currentStopIndex: -1,
    lastUpdated: new Date(),
  });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [previousStopIndex, setPreviousStopIndex] = useState<number>(-1);
  const previousStopIndexRef = useRef<number>(-1);
  const busStartedNotifiedRef = useRef<boolean>(false);
  const selectedRouteRef = useRef<Route | null>(null);
  const studentRef = useRef<Student | null>(null);
  const assignedBusNumberRef = useRef<string | null>(null);
  const previousRouteIdRef = useRef<string | null>(null);
  const lastLoggedStateRef = useRef<string | undefined>(undefined);
  const lastLoggedStopRef = useRef<string | undefined>(undefined);
  const [sessionRestored, setSessionRestored] = useState(false);
  const studentSubscriptionRef = useRef<(() => void) | null>(null);

  selectedRouteRef.current = selectedRoute;
  studentRef.current = student;

  // Register service worker early (required for FCM on web)
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    registerServiceWorker().then((registration) => {
      if (registration) {
        console.log('[App] ✅ Service Worker registered successfully');
      }
    });
  }, []);

  const establishPassengerSession = useCallback(async (firestoreStudent: FirestorePassenger) => {
    let currentRoutes = routes;
    if (currentRoutes.length === 0) {
      try {
        const firestoreRoutes = await getRoutes();
        currentRoutes = firestoreRoutes.map(convertFirestoreRouteToAppRoute);
        setRoutes(currentRoutes);
      } catch (error) {
        console.error('Error loading routes during login:', error);
      }
    }

    const appStudent: Student = {
      id: firestoreStudent.id,
      studentId: firestoreStudent.passengerId,
      name: firestoreStudent.name,
      email: firestoreStudent.email ?? '',
      selectedRouteId: firestoreStudent.selectedRouteId ?? firestoreStudent.routeId,
      selectedStopId: firestoreStudent.selectedStopId ?? firestoreStudent.stopId,
      routeName: firestoreStudent.routeName,
      hasCompletedSetup:
        firestoreStudent.hasCompletedSetup || !!firestoreStudent.selectedRouteId || !!firestoreStudent.routeId,
    };

    setStudent(appStudent);
    setIsLoggedIn(true);
    setIsGuest(false);
    try {
      localStorage.removeItem('kmt_guest');
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ email: appStudent.email }));
    } catch {
      // ignore
    }

    if (appStudent.selectedRouteId) {
      const route = currentRoutes.find((r) => r.id === appStudent.selectedRouteId);
      if (route) {
        setSelectedRoute(route);
      } else if (firestoreStudent.routeName) {
        const routeByName = currentRoutes.find((r) => r.name === firestoreStudent.routeName);
        if (routeByName) setSelectedRoute(routeByName);
      }
    }

    if (studentSubscriptionRef.current) {
      studentSubscriptionRef.current();
      studentSubscriptionRef.current = null;
    }

    const unsubscribe = subscribeToPassengerByDocId(firestoreStudent.id, (updatedStudent) => {
      if (updatedStudent) {
        const updatedAppStudent: Student = {
          id: updatedStudent.id,
          studentId: updatedStudent.passengerId,
          name: updatedStudent.name,
          email: updatedStudent.email ?? '',
          selectedRouteId: updatedStudent.selectedRouteId ?? updatedStudent.routeId,
          selectedStopId: updatedStudent.selectedStopId ?? updatedStudent.stopId,
          routeName: updatedStudent.routeName,
          hasCompletedSetup:
            updatedStudent.hasCompletedSetup || !!updatedStudent.selectedRouteId || !!updatedStudent.routeId,
        };
        setStudent(updatedAppStudent);

        if (updatedAppStudent.selectedRouteId) {
          setRoutes((currentRoutes) => {
            const route = currentRoutes.find((r) => r.id === updatedAppStudent.selectedRouteId);
            if (route) setSelectedRoute(route);
            return currentRoutes;
          });
        }
      }
    });
    studentSubscriptionRef.current = unsubscribe;
  }, [routes]);

  // Restore session: Firebase Google auth or saved email login
  useEffect(() => {
    if (sessionRestored || isLoggedIn) return;

    try {
      if (localStorage.getItem('kmt_guest') === 'true') {
        setIsGuest(true);
        setSessionRestored(true);
        return;
      }
    } catch {
      // ignore
    }

    let handled = false;

    const unsub = subscribeToAuthState(async (firebaseUser) => {
      if (handled) return;

      if (firebaseUser?.email) {
        handled = true;
        try {
          let firestoreStudent = await getPassengerByEmail(firebaseUser.email);
          if (!firestoreStudent) {
            const docId = await createPassenger({
              name: firebaseUser.displayName || 'KMT Passenger',
              email: firebaseUser.email,
              passengerId: `PSG-${Date.now()}`,
              status: 'active',
              hasCompletedSetup: false,
            });
            firestoreStudent = await getPassengerByDocId(docId);
          }
          if (firestoreStudent) {
            await establishPassengerSession(firestoreStudent);
          }
        } catch (err) {
          console.warn('[Session] Failed to restore Google session:', err);
        }
        setSessionRestored(true);
        return;
      }

      handled = true;
      try {
        const raw = localStorage.getItem(SESSION_STORAGE_KEY);
        if (!raw) {
          setSessionRestored(true);
          return;
        }
        const { email } = JSON.parse(raw) as { email: string };
        if (!email) {
          setSessionRestored(true);
          return;
        }
        getPassengerByEmail(email).then(async (firestoreStudent) => {
          if (!firestoreStudent) {
            localStorage.removeItem(SESSION_STORAGE_KEY);
            setSessionRestored(true);
            return;
          }
          await establishPassengerSession(firestoreStudent);
          setSessionRestored(true);
        }).catch((err) => {
          console.warn('[Session] Failed to restore session:', err);
          setSessionRestored(true);
        });
      } catch {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        setSessionRestored(true);
      }
    });

    return unsub;
  }, [sessionRestored, isLoggedIn, establishPassengerSession]);

  // FCM: request permission, get token, save to passengers/{passengerId}/fcmToken
  useEffect(() => {
    if (!student) return;
    // Use same key as RTDB: students/1 → student.id (Firestore doc id) so Cloud Function finds fcmToken
    const studentId = student.id;
    if (!studentId) return;

    const opts = { routeId: student.selectedRouteId, stopId: student.selectedStopId };

    const runFCM = () => {
      initFCMForPassenger(studentId, opts).then((ok) => {
        if (ok) {
          console.info('[FCM] Token saved to RTDB passengers/' + studentId);
        } else {
          toast.error('Notifications not enabled', {
            description: 'Allow notifications in browser settings to get bus alerts.',
          });
        }
      }).catch((err) => {
        console.warn('FCM init failed:', err);
        toast.error('Could not enable notifications', { description: String(err?.message || err) });
      });
    };

    // Keep RTDB students/{studentId} in sync so Cloud Functions can find students to notify
    updatePassengerRouteStopInRTDB(studentId, student.selectedRouteId, student.selectedStopId).catch(() => { });

    const hasWebNotification = typeof window !== 'undefined' && 'Notification' in window;
    if (hasWebNotification && Notification.permission === 'default') {
      toast('Get bus updates', {
        description: 'Allow notifications to know when your bus is near.',
        action: {
          label: 'Allow',
          onClick: () => {
            requestNotificationPermission().then((permission) => {
              if (permission === 'granted') runFCM();
            });
          },
        },
        duration: 12000,
      });
      // Proactively show browser permission prompt after a short delay so user can allow
      const t = setTimeout(() => {
        requestNotificationPermission().then((permission) => {
          if (permission === 'granted') runFCM();
        });
      }, 1500);
      return () => clearTimeout(t);
    }

    runFCM();

    // When tab becomes visible, refresh token and save (in case token rotated)
    const onVisibility = () => {
      const hasWebNotif = typeof window !== 'undefined' && 'Notification' in window;
      if (document.visibilityState === 'visible' && (!hasWebNotif || Notification.permission === 'granted')) {
        refreshAndSaveFCMToken(studentId, opts).catch(() => { });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const unsubscribe = setupForegroundMessageHandler((payload) => {
      const title = payload.notification?.title ?? (payload.data as Record<string, string> | undefined)?.title ?? 'Bus Tracker';
      const body = payload.notification?.body ?? (payload.data as Record<string, string> | undefined)?.body ?? '';
      // Use notification type + timestamp for unique tag so notifications don't replace each other
      const notifType = (payload.data as Record<string, string> | undefined)?.type ?? 'fcm';
      const uniqueTag = `bus-${notifType}-${Date.now()}`;
      // Show system notification (OS tray) like on phone/laptop
      showSystemNotification(title, { body, tag: uniqueTag });
      // Also show in-app toast when app is focused
      toast(title, { description: body || undefined });
    });
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [student]);

  const addNotification = useCallback((type: AppNotification['type'], message: string) => {
    const notification: AppNotification = {
      id: `notif-${Date.now()}`,
      type,
      message,
      timestamp: new Date(),
      read: false,
    };
    setNotifications((prev) => [notification, ...prev]);
  }, []);

  const refreshTracking = useCallback(() => {
    setTrackingRefreshNonce((n) => n + 1);
  }, []);

  // Load routes from Firestore
  useEffect(() => {
    const loadRoutes = async () => {
      try {
        const firestoreRoutes = await getRoutes();
        const appRoutes = firestoreRoutes.map(convertFirestoreRouteToAppRoute);
        setRoutes(appRoutes);

        // If student is logged in but route not set, try to set it now
        if (student?.selectedRouteId && !selectedRoute) {
          const route = appRoutes.find((r) => r.id === student.selectedRouteId);
          if (route) {
            setSelectedRoute(route);
          }
        }
      } catch (error) {
        console.error('Error loading routes:', error);
      }
    };

    loadRoutes();

    // Subscribe to route changes
    const unsubscribe = subscribeToRoutes((firestoreRoutes) => {
      const appRoutes = firestoreRoutes.map(convertFirestoreRouteToAppRoute);
      setRoutes(appRoutes);

      // Update selected route if it exists
      if (selectedRoute) {
        const updatedRoute = appRoutes.find((r) => r.id === selectedRoute.id);
        if (updatedRoute) {
          setSelectedRoute(updatedRoute);
        }
      } else if (student?.selectedRouteId) {
        // If route wasn't set before, try to set it now
        const route = appRoutes.find((r) => r.id === student.selectedRouteId);
        if (route) {
          setSelectedRoute(route);
        }
      }
    });

    return () => unsubscribe();
  }, [student?.selectedRouteId, trackingRefreshNonce]);

  // Step 1: Find which bus serves the student's route (NEW: Query Firestore first)
  useEffect(() => {
    // Use selectedRouteId (NEW field) first, fallback to routeId (DEPRECATED)
    const routeId = student?.selectedRouteId ?? student?.routeId;

    // Only rerun if routeId actually changed (not just student object recreated)
    if (previousRouteIdRef.current === routeId) {
      return;
    }

    if (!routeId) {
      // Only cleanup if we had a routeId before
      if (previousRouteIdRef.current !== null) {
        previousRouteIdRef.current = null;
        assignedBusNumberRef.current = null;
        setAssignedBusNumber(null);
        setRealtimeLocation(null);
        setRealtimeRouteState(null);
        setRealtimeCurrentStop(null);
        setRealtimeStops(null);
      }
      return;
    }

    previousRouteIdRef.current = routeId;
    console.log('[Firestore] Finding active bus for route:', selectedRoute.name);

    // Subscribe to live bus updates by route NAME (matching how driver reports it)
    const unsubscribe = subscribeToLiveBus(selectedRoute.name, (liveBus) => {
      if (!liveBus) {
        console.warn('[Firestore] No live bus found for route:', selectedRoute.name);
        if (assignedBusNumberRef.current !== null) {
          assignedBusNumberRef.current = null;
          setAssignedBusNumber(null);
          // Clear realtime data when bus goes offline
          setRealtimeLocation(null);
          setRealtimeRouteState(null);
          setRealtimeCurrentStop(null);
          setRealtimeStops(null);
        }
        return;
      }

      const busNumber = liveBus.busNumber;
      console.log('[Firestore] Live bus detected:', busNumber, 'for route:', selectedRoute.name);

      // Only update state if bus number has actually changed
      if (assignedBusNumberRef.current !== busNumber) {
        assignedBusNumberRef.current = busNumber;
        setAssignedBusNumber(busNumber);
      }
    });

    return () => unsubscribe();
  }, [student?.selectedRouteId, student?.routeId, selectedRoute?.name, trackingRefreshNonce]);

  // Step 2: Subscribe to RTDB using bus number (NEW: Direct subscription by busNumber)
  // IMPORTANT: Notification logic lives HERE because the driver app writes to RTDB, not Firestore.
  useEffect(() => {
    if (!assignedBusNumber) {
      // Bus not found or not assigned yet
      return;
    }

    console.log('[RTDB] Subscribing to bus data for busNumber:', assignedBusNumber);

    // Track whether this is the first callback from RTDB after subscribing.
    // The first callback is the CURRENT state (not a state change), so we must
    // NOT fire notifications for it — otherwise every app open re-triggers them.
    let isFirstCallback = true;

    const unsubscribe = subscribeToRealtimeBusByBusNumber(
      assignedBusNumber,
      (data) => {
        if (!data) {
          console.warn('[RTDB] No data received for bus:', assignedBusNumber);
          setRealtimeLocation(null);
          setRealtimeRouteState(null);
          setRealtimeCurrentStop(null);
          setRealtimeStops(null);
          return;
        }

        // Only log on state changes to avoid console spam (RTDB updates every ~2s)
        const newState = data.routeState;
        const newStop = data.currentStop?.name;
        if (newState !== lastLoggedStateRef.current || newStop !== lastLoggedStopRef.current) {
          console.log('[RTDB] Bus update:', data.busNumber, '| state:', newState, '| stop:', newStop);
          lastLoggedStateRef.current = newState;
          lastLoggedStopRef.current = newStop;
        }

        setRealtimeLocation(data.location);
        setRealtimeRouteState(data.routeState ?? null);
        setRealtimeCurrentStop(data.currentStop ?? null);
        setRealtimeStops(data.stops ?? null);

        // Use RTDB as source-of-truth for status + current stop index (matches driver app)
        const rs = (data.routeState ?? data.location?.routeState ?? '').toString();
        const hasCurrentStop = !!data.currentStop;

        const status =
          rs === 'completed'
            ? 'completed'
            : (rs === 'in_progress' || hasCurrentStop)
              ? 'running'
              : 'not-started';

        const ts =
          data.currentStop?.updatedAt ?? data.location.updatedAt ?? data.location.timestamp ?? Date.now();

        // ── Compute currentStopIndex from RTDB ──
        // Prefer stops[id].status === 'current', else data.currentStop.
        // Use order-based matching (find by order in sorted stops array) to avoid
        // off-by-one issues caused by assuming order-1 equals the array index.
        let currentStopIndex = -1;
        const currentRoute = selectedRouteRef.current;

        /** Helper: find stop index by order value (matches stop.order in sorted array) */
        const findByOrder = (order: number): number => {
          if (!currentRoute) return -1;
          const idx = currentRoute.stops.findIndex((s) => s.order === order);
          // If order-based findIndex fails (e.g., order field not stored on route stops),
          // fall back to positional: order is 1-based, array is 0-based
          return idx >= 0 ? idx : Math.max(0, Math.min(order - 1, currentRoute.stops.length - 1));
        };

        /** Helper: case-insensitive name match */
        const findByName = (name: string): number => {
          if (!currentRoute) return -1;
          const lower = name.toLowerCase().trim();
          return currentRoute.stops.findIndex((s) => s.name.toLowerCase().trim() === lower);
        };

        if (currentRoute) {
          if (data.stops && typeof data.stops === 'object') {
            const entries = Object.entries(data.stops);
            const current = entries.find(([, s]) => s?.status === 'current');
            if (current) {
              const [stopKey, stopEntry] = current;
              // Try exact key match
              currentStopIndex = currentRoute.stops.findIndex((s) => s.id === stopKey);

              // Try matching by stopId field
              if (currentStopIndex < 0 && stopEntry.stopId) {
                currentStopIndex = currentRoute.stops.findIndex((s) => s.id === stopEntry.stopId);
              }

              // Try matching by name (case-insensitive)
              if (currentStopIndex < 0 && stopEntry.name) {
                currentStopIndex = findByName(stopEntry.name);
              }

              // Fallback to order-based matching (find by order, not order-1)
              if (currentStopIndex < 0 && typeof stopEntry.order === 'number') {
                currentStopIndex = findByOrder(stopEntry.order);
              }
            } else {
              // No stop has status==='current': infer from reached stops.
              // The highest-order 'reached' stop IS the stop the bus is currently at.
              let highestReachedOrder = -1;
              let highestReachedEntry: RealtimeStopEntry | null = null;
              for (const [, entry] of entries) {
                if (entry?.status === 'reached' && typeof entry.order === 'number') {
                  if (entry.order > highestReachedOrder) {
                    highestReachedOrder = entry.order;
                    highestReachedEntry = entry;
                  }
                }
              }
              if (highestReachedEntry) {
                if (highestReachedEntry.stopId) {
                  currentStopIndex = currentRoute.stops.findIndex((s) => s.id === highestReachedEntry!.stopId);
                }
                if (currentStopIndex < 0 && highestReachedEntry.name) {
                  currentStopIndex = findByName(highestReachedEntry.name);
                }
                if (currentStopIndex < 0 && typeof highestReachedEntry.order === 'number') {
                  currentStopIndex = findByOrder(highestReachedEntry.order);
                }
              }
            }
          }

          // Fallback to currentStop from RTDB
          if (currentStopIndex < 0 && data.currentStop) {
            // Try matching by stopId
            if (data.currentStop.stopId) {
              currentStopIndex = currentRoute.stops.findIndex((s) => s.id === data.currentStop!.stopId);
            }

            // Try matching by name (case-insensitive)
            if (currentStopIndex < 0 && data.currentStop.name) {
              currentStopIndex = findByName(data.currentStop.name);
            }

            // Fallback to order (find by order value, not order-1)
            if (currentStopIndex < 0 && typeof data.currentStop.order === 'number') {
              currentStopIndex = findByOrder(data.currentStop.order);
            }
          }

          // Ensure index is within bounds
          if (currentStopIndex >= currentRoute.stops.length) {
            currentStopIndex = currentRoute.stops.length - 1;
          }
        }

        setBusState((prev) => ({
          ...prev,
          status,
          currentStopIndex,
          lastUpdated: new Date(ts),
        }));

        // ── NOTIFICATION LOGIC (based on RTDB data, the single source of truth) ──
        const currentStudent = studentRef.current;
        if (currentStudent?.selectedStopId && currentRoute) {
          // Check if data is fresh (within last 5 minutes)
          const dataTimestamp = typeof ts === 'number' ? ts : Date.now();
          const dataAgeMs = Date.now() - dataTimestamp;
          const fiveMinutesMs = 5 * 60 * 1000;
          const isDataFresh = dataAgeMs < fiveMinutesMs;

          const isActuallyRunning = (status === 'running' || rs === 'in_progress') && isDataFresh;

          // ── FIRST CALLBACK: sync state only, do NOT fire notifications ──
          // The first RTDB callback is the current snapshot (not a state change).
          // Without this guard, every app open/reopen re-fires "Bus Started!".
          if (isFirstCallback) {
            isFirstCallback = false;
            console.log('[RTDB] Initial snapshot — syncing state, skipping notifications. status:', status, 'stopIdx:', currentStopIndex);
            // Sync refs so subsequent callbacks know the baseline
            if (isActuallyRunning) {
              busStartedNotifiedRef.current = true; // bus already running, mark as notified
            }
            previousStopIndexRef.current = currentStopIndex;
            setPreviousStopIndex(currentStopIndex);
            return; // skip notification logic on initial load
          }

          // Reset "bus started" flag when bus is no longer running
          if (!isActuallyRunning) {
            busStartedNotifiedRef.current = false;
          }

          // Show system notifications on ALL platforms.
          // On native, showSystemNotification uses Capacitor LocalNotifications.
          // On web, it uses the browser Notification API.

          // Notify when bus starts — ONCE only (on state TRANSITION to running)
          if (isActuallyRunning && !busStartedNotifiedRef.current) {
            const title = '🚌 Bus Started!';
            const body = 'Your bus has started! Track its progress in real-time.';
            addNotification('bus-started', body);
            showSystemNotification(title, { body, tag: 'bus-started' });
            busStartedNotifiedRef.current = true;
            console.log('[Notification] Bus started notification sent (RTDB)');
          }

          // Stop-based notifications
          const studentStopIndex = currentRoute.stops.findIndex((s) => s.id === currentStudent.selectedStopId);
          const studentStopName = studentStopIndex >= 0 ? currentRoute.stops[studentStopIndex].name : 'your stop';
          const prevStop = previousStopIndexRef.current;

          if (isActuallyRunning && currentStopIndex >= 0 && currentStopIndex !== prevStop && studentStopIndex >= 0) {
            // Bus is ONE stop away from student's stop
            if (currentStopIndex === studentStopIndex - 1) {
              const title = '📍 Bus Approaching!';
              const body = `Your stop "${studentStopName}" is coming up next! Get ready.`;
              addNotification('stop-approaching', body);
              showSystemNotification(title, { body, tag: 'bus-approaching' });
              console.log('[Notification] Bus approaching notification sent (RTDB)');
            }

            // Bus arrives AT student's stop
            if (currentStopIndex === studentStopIndex) {
              const title = '🎯 Bus Arrived!';
              const body = `Bus has arrived at "${studentStopName}"! Time to board.`;
              addNotification('stop-reached', body);
              showSystemNotification(title, { body, tag: 'bus-arrived' });
              console.log('[Notification] Bus arrived notification sent (RTDB)');
            }

            // Bus has PASSED student's stop
            if (currentStopIndex === studentStopIndex + 1 && prevStop === studentStopIndex) {
              const title = '⚠️ Bus Passed Your Stop';
              const body = `The bus has passed "${studentStopName}". Please contact the driver if needed.`;
              addNotification('alert', body);
              showSystemNotification(title, { body, tag: 'bus-passed' });
              console.log('[Notification] Bus passed notification sent (RTDB)');
            }
          }

          // Only update previousStopIndex if data is fresh
          if (isDataFresh) {
            previousStopIndexRef.current = currentStopIndex;
            setPreviousStopIndex(currentStopIndex);
          }
        }
      },
      (err) => {
        console.error('RTDB subscribe error:', err);
        setRealtimeLocation(null);
        setRealtimeRouteState(null);
        setRealtimeCurrentStop(null);
        setRealtimeStops(null);
      }
    );

    return () => unsubscribe();
  }, [assignedBusNumber, addNotification]);

  // Subscribe to live bus updates when route is selected or student has routeName
  // NOTE: Notification logic has been moved to the RTDB callback above.
  // This Firestore subscription only updates the liveBus state (for UI display).
  useEffect(() => {
    // Determine route name to subscribe to
    let routeNameToSubscribe: string | null = null;

    if (realtimeLocation?.routeName) {
      routeNameToSubscribe = realtimeLocation.routeName;
    } else if (selectedRoute) {
      routeNameToSubscribe = selectedRoute.name;
    } else if (student?.routeName) {
      routeNameToSubscribe = student.routeName;
    }

    if (!routeNameToSubscribe) {
      setLiveBus(null);
      return;
    }

    console.log('Subscribing to live bus for route:', routeNameToSubscribe);

    const unsubscribe = subscribeToLiveBus(
      routeNameToSubscribe,
      (bus) => {
        setLiveBus(bus);
        // Only update busState from Firestore if RTDB is not providing data
        // (RTDB is the primary source of truth for status)
        if (bus && !assignedBusNumber) {
          const newBusState = convertLiveBusToBusState(bus);
          setBusState(newBusState);
        }
      },
      (error) => {
        console.error('Error subscribing to live bus:', error);
      }
    );

    return () => {
      console.log('Unsubscribing from live bus');
      unsubscribe();
    };
  }, [realtimeLocation?.routeName, selectedRoute?.name, student?.routeName, assignedBusNumber]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const firestoreStudent = await getPassengerByEmail(email);
      if (!firestoreStudent) return false;

      const storedPassword = firestoreStudent.password || '';
      if (storedPassword !== password) return false;

      await establishPassengerSession(firestoreStudent);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }, [establishPassengerSession]);

  const loginWithGoogle = useCallback(async (): Promise<boolean> => {
    try {
      const user = await signInWithGoogle();
      if (!user.email) {
        toast.error('Google sign-in failed', { description: 'No email found on your Google account.' });
        return false;
      }

      let firestoreStudent = await getPassengerByEmail(user.email);
      if (!firestoreStudent) {
        const docId = await createPassenger({
          name: user.displayName || 'KMT Passenger',
          email: user.email,
          passengerId: `PSG-${Date.now()}`,
          status: 'active',
          hasCompletedSetup: false,
        });
        firestoreStudent = await getPassengerByDocId(docId);
        if (!firestoreStudent) return false;
      }

      await establishPassengerSession(firestoreStudent);
      toast.success('Signed in with Google');
      return true;
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === 'auth/popup-closed-by-user') return false;
      console.error('Google login error:', error);
      toast.error('Google sign-in failed', {
        description:
          err.code === 'auth/operation-not-allowed'
            ? 'Enable Google sign-in in Firebase Console → Authentication → Sign-in method.'
            : err.message ?? 'Please try again.',
      });
      return false;
    }
  }, [establishPassengerSession]);

  const continueAsGuest = useCallback(() => {
    setIsGuest(true);
    setIsLoggedIn(false);
    try {
      localStorage.setItem('kmt_guest', 'true');
    } catch {
      // ignore
    }
  }, []);

  const logout = useCallback(() => {
    if (studentSubscriptionRef.current) {
      studentSubscriptionRef.current();
      studentSubscriptionRef.current = null;
    }
    signOutAuth().catch(() => {});
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
    setStudent(null);
    setIsLoggedIn(false);
    setIsGuest(false);
    setTrackingReady(false);
    try {
      localStorage.removeItem('kmt_guest');
    } catch {
      // ignore
    }
    setSelectedRoute(null);
    setLiveBus(null);
    setRealtimeLocation(null);
    setRealtimeRouteState(null);
    setRealtimeCurrentStop(null);
    setRealtimeStops(null);
    setBusState({
      status: 'not-started',
      currentStopIndex: -1,
      lastUpdated: new Date(),
    });
    setNotifications([]);
    setPreviousStopIndex(-1);
  }, []);

  const selectRoute = useCallback((routeId: string) => {
    const route = routes.find((r) => r.id === routeId);
    if (route) {
      setSelectedRoute(route);
      setTrackingReady(false);
      if (!isGuest) {
        setStudent((prev) => prev ? { ...prev, selectedRouteId: routeId, selectedStopId: undefined } : null);
      }
    }
  }, [routes, isGuest]);

  const selectStop = useCallback((stopId: string) => {
    if (isGuest) {
      setTrackingReady(false);
      return;
    }
    setStudent((prev) => prev ? { ...prev, selectedStopId: stopId } : null);
  }, [isGuest]);

  const confirmSelection = useCallback(async () => {
    if (isGuest && selectedRoute) {
      setTrackingReady(true);
      return;
    }

    if (!student || !selectedRoute || !student.selectedRouteId || !student.selectedStopId) {
      console.error('Cannot confirm: missing passenger, route, or stop selection');
      toast.error('Please select both a route and a stop before confirming');
      return;
    }

    try {
      const firestoreStudent = await getPassengerByEmail(student.email);
      if (!firestoreStudent) {
        console.error('Student not found in Firestore');
        toast.error('Student record not found. Please try logging in again.');
        return;
      }

      const stopName = selectedRoute.stops.find((s) => s.id === student.selectedStopId)?.name;

      const updates = {
        // App-specific selection fields
        selectedRouteId: student.selectedRouteId,
        selectedStopId: student.selectedStopId,
        hasCompletedSetup: true,

        // Mirror into the main profile fields used in your sample document
        routeId: student.selectedRouteId,
        routeName: selectedRoute.name,
        stopId: student.selectedStopId,
        stopName: stopName || null,
      };

      console.log('Updating student document:', firestoreStudent.id, 'with updates:', updates);

      // Use document ID directly instead of querying by studentId
      await updatePassengerByDocId(firestoreStudent.id, updates);

      console.log('Successfully updated passenger in Firestore');
      toast.success('Route and stop saved successfully!');

      updatePassengerRouteStopInRTDB(firestoreStudent.id, student.selectedRouteId, student.selectedStopId).catch((err) => {
        console.warn('Failed to update RTDB:', err);
      });

      setTrackingReady(true);
    } catch (error) {
      console.error('Error confirming selection:', error);
      toast.error('Failed to save selection. Please try again.');
    }
  }, [student, selectedRoute, isGuest]);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  // Get stop status helper function
  const getStopStatus = useCallback((index: number): StopStatus => {
    if (!liveBus || !selectedRoute) return 'pending';
    return getStopStatusByIndex(liveBus, index);
  }, [liveBus, selectedRoute]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <StudentContext.Provider
      value={{
        student,
        passenger: student,
        isLoggedIn,
        isGuest,
        trackingReady,
        routes,
        selectedRoute,
        liveBus,
        realtimeLocation,
        realtimeRouteState,
        realtimeCurrentStop,
        realtimeStops,
        busState,
        notifications,
        unreadCount,
        login,
        loginWithGoogle,
        continueAsGuest,
        refreshTracking,
        logout,
        selectRoute,
        selectStop,
        confirmSelection,
        markNotificationRead,
        clearNotifications,
      }}
    >
      {children}
    </StudentContext.Provider>
  );
};
