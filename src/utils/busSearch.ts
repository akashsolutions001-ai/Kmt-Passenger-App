import { Bus, LiveBus } from '@/types/firestore';
import {
  getBusesByRouteId,
  getDriverById,
  getLiveBusesByRouteName,
} from '@/services/firestore';

export interface AvailableBus {
  id: string;
  busNumber: string;
  assignedRouteId: string | null;
  status: Bus['status'];
  driverName?: string;
  isLive: boolean;
}

export async function fetchAvailableBusesForRoute(
  routeId: string,
  routeName: string
): Promise<AvailableBus[]> {
  const [buses, liveBuses] = await Promise.all([
    getBusesByRouteId(routeId),
    getLiveBusesByRouteName(routeName),
  ]);

  const liveByNumber = new Map(liveBuses.map((lb) => [lb.busNumber, lb]));
  const seen = new Set<string>();
  const results: AvailableBus[] = [];

  for (const bus of buses) {
    seen.add(bus.busNumber);
    const live = liveByNumber.get(bus.busNumber);
    let driverName = live?.driverName;

    if (!driverName && bus.assignedDriverId) {
      const driver = await getDriverById(bus.assignedDriverId);
      driverName = driver?.name;
    }

    results.push({
      id: bus.id,
      busNumber: bus.busNumber,
      assignedRouteId: bus.assignedRouteId,
      status: live ? 'running' : bus.status,
      driverName,
      isLive: !!live,
    });
  }

  for (const live of liveBuses) {
    if (seen.has(live.busNumber)) continue;
    results.push({
      id: live.id,
      busNumber: live.busNumber,
      assignedRouteId: routeId,
      status: 'running',
      driverName: live.driverName,
      isLive: true,
    });
  }

  return results.sort((a, b) => a.busNumber.localeCompare(b.busNumber));
}

export function availableBusToFirestoreBus(bus: AvailableBus): Bus {
  return {
    id: bus.id,
    busNumber: bus.busNumber,
    assignedRouteId: bus.assignedRouteId,
    assignedDriverId: null,
    status: bus.status,
    createdAt: {} as Bus['createdAt'],
    updatedAt: {} as Bus['updatedAt'],
  };
}
