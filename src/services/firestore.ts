import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Bus,
  Driver,
  Route,
  LiveBus,
  Complaint,
  Passenger,
  AdminStop,
  Announcement,
  Depot,
} from "@/types/firestore";

// ==================== Routes ====================
export const getRoutes = async (): Promise<Route[]> => {
  const routesRef = collection(db, "routes");
  const q = query(routesRef, orderBy("name"));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Route[];
};

export const getRouteById = async (routeId: string): Promise<Route | null> => {
  const routeRef = doc(db, "routes", routeId);
  const routeSnap = await getDoc(routeRef);

  if (routeSnap.exists()) {
    return { id: routeSnap.id, ...routeSnap.data() } as Route;
  }
  return null;
};

export const subscribeToRoutes = (
  callback: (routes: Route[]) => void
): (() => void) => {
  const routesRef = collection(db, "routes");
  const q = query(routesRef, orderBy("name"));

  return onSnapshot(q, (querySnapshot) => {
    const routes = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Route[];
    callback(routes);
  });
};

// ==================== Stops (admin-managed) ====================

const isAdminManagedStop = (stop: AdminStop): boolean => {
  if (stop.status === "inactive") return false;
  return true;
};

export const getAdminStops = async (): Promise<AdminStop[]> => {
  const stopsRef = collection(db, "stops");
  const querySnapshot = await getDocs(stopsRef);

  return querySnapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as AdminStop))
    .filter(isAdminManagedStop)
    .sort((a, b) => a.order - b.order);
};

export const getStopsByRouteId = async (routeId: string): Promise<AdminStop[]> => {
  const stopsRef = collection(db, "stops");
  const q = query(stopsRef, where("routeId", "==", routeId));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as AdminStop))
    .filter(isAdminManagedStop)
    .sort((a, b) => a.order - b.order);
};

export const subscribeToAdminStops = (
  callback: (stops: AdminStop[]) => void
): (() => void) => {
  const stopsRef = collection(db, "stops");

  return onSnapshot(stopsRef, (querySnapshot) => {
    const stops = querySnapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as AdminStop))
      .filter(isAdminManagedStop)
      .sort((a, b) => a.order - b.order);
    callback(stops);
  });
};

// ==================== Live Buses ====================
export const getLiveBuses = async (): Promise<LiveBus[]> => {
  const liveBusesRef = collection(db, "liveBuses");
  const querySnapshot = await getDocs(liveBusesRef);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as LiveBus[];
};

export const getLiveBusByRouteName = async (
  routeName: string
): Promise<LiveBus | null> => {
  const liveBusesRef = collection(db, "liveBuses");
  const q = query(liveBusesRef, where("routeName", "==", routeName));
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as LiveBus;
  }
  return null;
};

export const getLiveBusesByRouteName = async (
  routeName: string
): Promise<LiveBus[]> => {
  const liveBusesRef = collection(db, "liveBuses");
  const q = query(liveBusesRef, where("routeName", "==", routeName));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as LiveBus[];
};

export const getLiveBusByRouteId = async (
  routeId: string
): Promise<LiveBus | null> => {
  const route = await getRouteById(routeId);
  if (!route) return null;
  return getLiveBusByRouteName(route.name);
};

export const subscribeToLiveBus = (
  routeName: string,
  callback: (liveBus: LiveBus | null) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const liveBusesRef = collection(db, "liveBuses");
  const q = query(liveBusesRef, where("routeName", "==", routeName));

  return onSnapshot(
    q,
    (querySnapshot) => {
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const liveBusData = { id: doc.id, ...doc.data() } as LiveBus;
        callback(liveBusData);
      } else {
        console.log(`[Firestore] No live bus for route: "${routeName}"`);
        callback(null);
      }
    },
    (error) => {
      console.error('Error in live bus subscription:', error);
      if (onError) {
        onError(error);
      }
    }
  );
};

export const subscribeToLiveBuses = (
  callback: (liveBuses: LiveBus[]) => void
): (() => void) => {
  const liveBusesRef = collection(db, "liveBuses");

  return onSnapshot(liveBusesRef, (querySnapshot) => {
    const liveBuses = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as LiveBus[];
    callback(liveBuses);
  });
};

// ==================== Buses ====================
export const getBuses = async (): Promise<Bus[]> => {
  const busesRef = collection(db, "buses");
  const querySnapshot = await getDocs(busesRef);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Bus[];
};

export const getBusById = async (busId: string): Promise<Bus | null> => {
  const busRef = doc(db, "buses", busId);
  const busSnap = await getDoc(busRef);

  if (busSnap.exists()) {
    return { id: busSnap.id, ...busSnap.data() } as Bus;
  }
  return null;
};

export const getBusByRouteId = async (routeId: string): Promise<Bus | null> => {
  const buses = await getBusesByRouteId(routeId);
  return buses[0] ?? null;
};

export const getBusesByRouteId = async (routeId: string): Promise<Bus[]> => {
  const busesRef = collection(db, "buses");
  const q = query(busesRef, where("assignedRouteId", "==", routeId));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as Bus[];
};

export const getBusByNumber = async (busNumber: string): Promise<Bus | null> => {
  const busesRef = collection(db, "buses");
  const q = query(busesRef, where("busNumber", "==", busNumber));
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Bus;
  }
  return null;
};

export const subscribeToBusByRouteId = (
  routeId: string,
  callback: (bus: Bus | null) => void
): (() => void) => {
  const busesRef = collection(db, "buses");
  const q = query(busesRef, where("assignedRouteId", "==", routeId));

  return onSnapshot(q, (querySnapshot) => {
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      callback({ id: doc.id, ...doc.data() } as Bus);
    } else {
      callback(null);
    }
  });
};

// ==================== Drivers ====================
export const getDrivers = async (): Promise<Driver[]> => {
  const driversRef = collection(db, "drivers");
  const querySnapshot = await getDocs(driversRef);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Driver[];
};

export const getDriverById = async (driverId: string): Promise<Driver | null> => {
  const driverRef = doc(db, "drivers", driverId);
  const driverSnap = await getDoc(driverRef);

  if (driverSnap.exists()) {
    return { id: driverSnap.id, ...driverSnap.data() } as Driver;
  }
  return null;
};

// ==================== Depots ====================
export const getDepots = async (): Promise<Depot[]> => {
  const depotsRef = collection(db, "depots");
  const querySnapshot = await getDocs(depotsRef);

  return querySnapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Depot))
    .filter((d) => d.active !== false);
};

// ==================== Announcements ====================
export const getAnnouncements = async (): Promise<Announcement[]> => {
  const announcementsRef = collection(db, "announcements");
  const q = query(announcementsRef, orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Announcement))
    .filter((a) => a.active !== false);
};

export const subscribeToAnnouncements = (
  callback: (announcements: Announcement[]) => void
): (() => void) => {
  const announcementsRef = collection(db, "announcements");
  const q = query(announcementsRef, orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (querySnapshot) => {
      const announcements = querySnapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Announcement))
        .filter((a) => a.active !== false);
      callback(announcements);
    },
    () => callback([])
  );
};

// ==================== Complaints ====================

const stripUndefined = <T extends Record<string, unknown>>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as Partial<T>;

export const createComplaint = async (
  complaint: Omit<Complaint, "id" | "createdAt" | "updatedAt">
): Promise<string> => {
  const complaintsRef = collection(db, "complaints");
  const newComplaint = stripUndefined({
    ...complaint,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  const docRef = await addDoc(complaintsRef, newComplaint);
  return docRef.id;
};

export const getComplaintsByPassengerId = async (
  passengerId: string
): Promise<Complaint[]> => {
  const complaintsRef = collection(db, "complaints");
  const q = query(
    complaintsRef,
    where("passengerId", "==", passengerId),
    orderBy("createdAt", "desc")
  );
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Complaint[];
};

export const subscribeToComplaints = (
  passengerId: string,
  callback: (complaints: Complaint[]) => void
): (() => void) => {
  const complaintsRef = collection(db, "complaints");
  const q = query(
    complaintsRef,
    where("passengerId", "==", passengerId),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (querySnapshot) => {
    const complaints = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Complaint[];
    callback(complaints);
  });
};

// ==================== Passengers ====================
export const getPassengerById = async (passengerId: string): Promise<Passenger | null> => {
  const passengersRef = collection(db, "passengers");
  const q = query(passengersRef, where("passengerId", "==", passengerId));
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Passenger;
  }
  return null;
};

export const getPassengerByEmail = async (email: string): Promise<Passenger | null> => {
  const passengersRef = collection(db, "passengers");
  const q = query(passengersRef, where("email", "==", email));
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Passenger;
  }
  return null;
};

export const getPassengerByDocId = async (docId: string): Promise<Passenger | null> => {
  const passengerRef = doc(db, "passengers", docId);
  const passengerSnap = await getDoc(passengerRef);
  if (!passengerSnap.exists()) return null;
  return { id: passengerSnap.id, ...passengerSnap.data() } as Passenger;
};

export const createPassenger = async (
  passenger: Omit<Passenger, "id" | "createdAt" | "updatedAt">
): Promise<string> => {
  const passengersRef = collection(db, "passengers");
  const docRef = await addDoc(passengersRef, {
    ...passenger,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updatePassenger = async (
  passengerId: string,
  updates: Partial<Passenger>
): Promise<void> => {
  const passengersRef = collection(db, "passengers");
  const q = query(passengersRef, where("passengerId", "==", passengerId));
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    const docRef = doc(db, "passengers", querySnapshot.docs[0].id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  } else {
    throw new Error(`Passenger with passengerId "${passengerId}" not found`);
  }
};

export const updatePassengerByDocId = async (
  docId: string,
  updates: Partial<Passenger>
): Promise<void> => {
  const docRef = doc(db, "passengers", docId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

export const subscribeToPassenger = (
  passengerId: string,
  callback: (passenger: Passenger | null) => void
): (() => void) => {
  const passengersRef = collection(db, "passengers");
  const q = query(passengersRef, where("passengerId", "==", passengerId));

  return onSnapshot(q, (querySnapshot) => {
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      callback({ id: doc.id, ...doc.data() } as Passenger);
    } else {
      callback(null);
    }
  });
};

export const subscribeToPassengerByDocId = (
  docId: string,
  callback: (passenger: Passenger | null) => void
): (() => void) => {
  const docRef = doc(db, "passengers", docId);

  return onSnapshot(docRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      callback({ id: docSnapshot.id, ...docSnapshot.data() } as Passenger);
    } else {
      callback(null);
    }
  });
};
