import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvent } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LiveBusMapProps, BusPosition, StopMarker } from './types';
import { fetchRoadRoute, waypointsKey } from '@/utils/routeGeometry';
import { MapPin, Loader2, Crosshair, Route, ExternalLink } from 'lucide-react';

// Default center (India - adjust as needed)
const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];
const DEFAULT_ZOOM = 15;

// Create a custom bus icon using SVG
const createBusIcon = (isMoving: boolean) => {
    const color = isMoving ? '#22c55e' : '#6b7280';

    return L.divIcon({
        className: 'bus-marker',
        html: `
      <div class="bus-marker-container">
        <div class="bus-marker-dot" style="background-color: ${color};">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="20" height="20">
            <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
          </svg>
        </div>
        ${isMoving ? '<div class="bus-marker-ring"></div>' : ''}
      </div>
    `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -22],
    });
};

// Bus stop sign icon with order number
const createBusStopIcon = (status: StopMarker['status'], order: number, isStudentStop: boolean) => {
    let fill = '#ffffff';
    let stroke = '#64748b';
    let badge = '#94a3b8';

    if (status === 'reached') {
        stroke = '#16a34a';
        badge = '#22c55e';
    } else if (status === 'current') {
        stroke = '#2563eb';
        badge = '#3b82f6';
    }

    const width = isStudentStop ? 36 : 30;
    const height = isStudentStop ? 48 : 42;

    return L.divIcon({
        className: 'bus-stop-marker',
        html: `
      <div class="bus-stop-marker-wrap" style="width:${width}px;height:${height}px;">
        <svg viewBox="0 0 32 44" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 1 C9 1 4 6 4 12 C4 22 16 42 16 42 C16 42 28 22 28 12 C28 6 23 1 16 1 Z"
            fill="${fill}" stroke="${stroke}" stroke-width="2"/>
          <circle cx="16" cy="13" r="8" fill="${badge}"/>
          <text x="16" y="16.5" text-anchor="middle" fill="white" font-size="9" font-weight="700">${order}</text>
        </svg>
        ${isStudentStop ? '<div class="bus-stop-star">★</div>' : ''}
      </div>
    `,
        iconSize: [width, height],
        iconAnchor: [width / 2, height],
        popupAnchor: [0, -height + 4],
    });
};

// Create stop icons based on status (legacy fallback)
const createStopIcon = (status: StopMarker['status'], isStudentStop: boolean, order = 0) => {
    return createBusStopIcon(status, order, isStudentStop);
};

// Component to handle map view updates
function MapViewController({
    busPosition,
    autoCenter,
    centerTrigger,
    hasUserInteracted,
}: {
    busPosition: BusPosition | null;
    autoCenter: boolean;
    centerTrigger: number;
    hasUserInteracted: boolean;
}) {
    const map = useMap();
    const initialCenteredRef = useRef(false);
    const lastCenterTriggerRef = useRef(0);

    useEffect(() => {
        if (!busPosition) return;

        const centerMap = () => {
            map.setView([busPosition.latitude, busPosition.longitude], DEFAULT_ZOOM, {
                animate: true,
                duration: 0.5,
            });
        };

        // First time we get a position, always center
        if (!initialCenteredRef.current) {
            centerMap();
            initialCenteredRef.current = true;
            return;
        }

        // Explicit center button presses (centerTrigger change)
        if (centerTrigger !== lastCenterTriggerRef.current) {
            lastCenterTriggerRef.current = centerTrigger;
            centerMap();
            return;
        }

        // Auto-center only when enabled and user has NOT interacted
        if (autoCenter && !hasUserInteracted) {
            centerMap();
        }
    }, [busPosition, map, centerTrigger, autoCenter, hasUserInteracted]);

    return null;
}

// Fit map to show all stops and bus
function MapBoundsController({
    stops,
    busPosition,
}: {
    stops: StopMarker[];
    busPosition: BusPosition | null;
}) {
    const map = useMap();
    const fittedKeyRef = useRef<string>('');

    useEffect(() => {
        const points: L.LatLngExpression[] = stops.map((s) => [s.latitude, s.longitude]);
        if (busPosition) {
            points.push([busPosition.latitude, busPosition.longitude]);
        }
        if (points.length === 0) return;

        const key = `${points.length}-${busPosition?.latitude ?? 0}-${busPosition?.longitude ?? 0}-${stops.map((s) => s.id).join(',')}`;
        if (fittedKeyRef.current === key) return;
        fittedKeyRef.current = key;

        if (points.length === 1) {
            map.setView(points[0], DEFAULT_ZOOM, { animate: true });
            return;
        }

        map.fitBounds(L.latLngBounds(points), {
            padding: [48, 48],
            maxZoom: 16,
            animate: true,
        });
    }, [stops, busPosition, map]);

    return null;
}

// Road-following route polyline via OSRM
function RoadRoutePolyline({ waypoints }: { waypoints: Array<[number, number]> }) {
    const [positions, setPositions] = useState<Array<[number, number]>>([]);
    const wpKey = waypointsKey(waypoints);

    useEffect(() => {
        if (waypoints.length < 2) {
            setPositions([]);
            return;
        }

        let cancelled = false;

        fetchRoadRoute(waypoints).then((roadLine) => {
            if (cancelled) return;
            setPositions(roadLine ?? waypoints);
        });

        return () => {
            cancelled = true;
        };
    }, [wpKey, waypoints]);

    if (positions.length < 2) return null;

    return [
        <Polyline
            key="route-shadow"
            positions={positions}
            pathOptions={{
                color: '#1e3a8a',
                weight: 9,
                opacity: 0.25,
                lineCap: 'round',
                lineJoin: 'round',
            }}
        />,
        <Polyline
            key="route-main"
            positions={positions}
            pathOptions={{
                color: '#2563eb',
                weight: 5,
                opacity: 0.92,
                lineCap: 'round',
                lineJoin: 'round',
            }}
        />,
    ];
}

// Component to handle map click (for fullscreen toggle)
function MapClickHandler({ onClick }: { onClick: () => void }) {
    useMapEvent('click', () => {
        onClick();
    });
    return null;
}

// Track when user manually interacts with the map (pan/zoom)
function MapInteractionController({ onUserInteract }: { onUserInteract: () => void }) {
    useMapEvent({
        dragstart() {
            onUserInteract();
        },
        zoomstart() {
            onUserInteract();
        },
    });
    return null;
}

// Component to notify Leaflet when container size changes (e.g. fullscreen toggle)
function MapResizeController({ fullscreen }: { fullscreen: boolean }) {
    const map = useMap();

    useEffect(() => {
        // small timeout lets CSS/layout settle before recalculating size
        const id = window.setTimeout(() => {
            map.invalidateSize();
        }, 150);

        return () => {
            window.clearTimeout(id);
        };
    }, [fullscreen, map]);

    return null;
}

// Component to animate bus marker
function AnimatedBusMarker({
    position,
    busNumber,
    driverName,
    routeState,
}: {
    position: BusPosition;
    busNumber?: string;
    driverName?: string;
    routeState?: string;
}) {
    const markerRef = useRef<L.Marker>(null);
    const prevPositionRef = useRef<{ lat: number; lng: number } | null>(null);

    const isMoving = useMemo(() => {
        if (!prevPositionRef.current) return routeState === 'in_progress';
        const latDiff = Math.abs(position.latitude - prevPositionRef.current.lat);
        const lngDiff = Math.abs(position.longitude - prevPositionRef.current.lng);
        return latDiff > 0.0001 || lngDiff > 0.0001;
    }, [position.latitude, position.longitude, routeState]);

    const busIcon = useMemo(() => createBusIcon(isMoving || routeState === 'in_progress'), [isMoving, routeState]);

    // Smooth animation
    useEffect(() => {
        const marker = markerRef.current;
        if (!marker) return;

        const newLatLng = L.latLng(position.latitude, position.longitude);

        if (prevPositionRef.current) {
            const duration = 1000;
            const startLat = prevPositionRef.current.lat;
            const startLng = prevPositionRef.current.lng;
            const endLat = position.latitude;
            const endLng = position.longitude;

            let startTime: number | null = null;

            const animate = (currentTime: number) => {
                if (!startTime) startTime = currentTime;
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeProgress = 1 - Math.pow(1 - progress, 3);

                const lat = startLat + (endLat - startLat) * easeProgress;
                const lng = startLng + (endLng - startLng) * easeProgress;

                marker.setLatLng([lat, lng]);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                }
            };

            requestAnimationFrame(animate);
        } else {
            marker.setLatLng(newLatLng);
        }

        prevPositionRef.current = { lat: position.latitude, lng: position.longitude };
    }, [position.latitude, position.longitude]);

    const lastUpdate = new Date(position.timestamp).toLocaleTimeString();

    return (
        <Marker
            ref={markerRef}
            position={[position.latitude, position.longitude]}
            icon={busIcon}
        >
            <Popup>
                <div className="bus-popup">
                    <div className="bus-popup-header">
                        <span className="bus-popup-icon">🚌</span>
                        <strong>{busNumber || 'Bus'}</strong>
                    </div>
                    {driverName && (
                        <div className="bus-popup-row">
                            <span className="bus-popup-label">Driver:</span>
                            <span>{driverName}</span>
                        </div>
                    )}
                    <div className="bus-popup-row">
                        <span className="bus-popup-label">Status:</span>
                        <span className={`bus-popup-status ${routeState}`}>
                            {routeState === 'in_progress' ? 'In Transit' :
                                routeState === 'completed' ? 'Completed' : 'Not Started'}
                        </span>
                    </div>
                    <div className="bus-popup-row">
                        <span className="bus-popup-label">Updated:</span>
                        <span>{lastUpdate}</span>
                    </div>
                </div>
            </Popup>
        </Marker>
    );
}

// Path Trail Component
function PathTrail({
    currentPosition,
    maxPoints = 50,
    color = '#3b82f6',
}: {
    currentPosition: BusPosition | null;
    maxPoints?: number;
    color?: string;
}) {
    const [pathPoints, setPathPoints] = useState<Array<[number, number]>>([]);
    const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        if (!currentPosition) return;

        const newPoint: [number, number] = [currentPosition.latitude, currentPosition.longitude];

        // Always record the first point, then append every subsequent update.
        // Keep only the latest `maxPoints` entries so the polyline stays performant.
        lastPositionRef.current = { lat: currentPosition.latitude, lng: currentPosition.longitude };

        setPathPoints((prev) => {
            const updated = [...prev, newPoint];
            if (updated.length > maxPoints) {
                return updated.slice(-maxPoints);
            }
            return updated;
        });
    }, [currentPosition, maxPoints]);

    if (pathPoints.length < 2) return null;

    // Using array return instead of Fragment to avoid react-leaflet Context issues
    return [
        <Polyline
            key="path-main"
            positions={pathPoints}
            pathOptions={{
                color,
                weight: 4,
                opacity: 0.7,
                lineCap: 'round',
                lineJoin: 'round',
            }}
        />,
        <Polyline
            key="path-shadow"
            positions={pathPoints}
            pathOptions={{
                color,
                weight: 8,
                opacity: 0.2,
                lineCap: 'round',
                lineJoin: 'round',
            }}
        />
    ];
}

/**
 * LiveBusMap - Real-time bus tracking map using OpenStreetMap + Leaflet
 */
export const LiveBusMap: React.FC<LiveBusMapProps> = ({
    busPosition,
    busNumber,
    driverName,
    routeState,
    stops = [],
    studentStopId,
    height = 300,
    autoCenter = false,
    showPath: initialShowPath = true,
    showRouteLine = true,
    maxPathPoints = 50,
}) => {
    const [showPath, setShowPath] = useState(initialShowPath);
    const [showRoute, setShowRoute] = useState(showRouteLine);
    const [centerTrigger, setCenterTrigger] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [hasUserInteracted, setHasUserInteracted] = useState(false);

    const initialCenter: [number, number] = busPosition
        ? [busPosition.latitude, busPosition.longitude]
        : stops.length > 0
            ? [stops[0].latitude, stops[0].longitude]
            : DEFAULT_CENTER;

    const handleCenterBus = useCallback(() => {
        setCenterTrigger((prev) => prev + 1);
        setHasUserInteracted(false);
    }, []);

    const handleTogglePath = useCallback(() => {
        setShowRoute((prev) => !prev);
    }, []);

    const routeWaypoints = useMemo(
        () =>
            [...stops]
                .sort((a, b) => a.order - b.order)
                .map((s) => [s.latitude, s.longitude] as [number, number]),
        [stops]
    );

    const hasStops = stops.length > 0;

    const handleEnterFullscreen = useCallback(() => {
        setIsFullscreen(true);
    }, []);

    const handleExitFullscreen = useCallback(() => {
        setIsFullscreen(false);
    }, []);

    const isTracking = busPosition !== null && routeState === 'in_progress';

    return (
        <div
            className={`live-bus-map-container ${isFullscreen ? 'live-bus-map-container-fullscreen' : ''}`}
            style={{ height: isFullscreen ? '100vh' : height }}
        >
            {isFullscreen && (
                <button
                    type="button"
                    className="map-fullscreen-close-btn"
                    onClick={handleExitFullscreen}
                >
                    ✕
                </button>
            )}
            {/* Loading state when no bus position and no stops */}
            {!busPosition && !hasStops && (
                <div className="map-overlay map-overlay-loading">
                    <div className="map-overlay-content">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground mt-2">
                            Waiting for bus location...
                        </p>
                    </div>
                </div>
            )}

            {/* Route not started overlay — only when no stop markers to show */}
            {busPosition && routeState === 'not_started' && !hasStops && (
                <div className="map-overlay map-overlay-not-started">
                    <div className="map-overlay-content">
                        <MapPin className="w-8 h-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mt-2">
                            Bus not started yet
                        </p>
                    </div>
                </div>
            )}

            <MapContainer
                center={initialCenter}
                zoom={DEFAULT_ZOOM}
                className="live-bus-map"
                zoomControl={true}
                scrollWheelZoom={true}
                style={{ height: '100%', width: '100%' }}
            >
                {!isFullscreen && <MapClickHandler onClick={handleEnterFullscreen} />}
                <MapResizeController fullscreen={isFullscreen} />
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapViewController
                    busPosition={busPosition}
                    autoCenter={autoCenter}
                    centerTrigger={centerTrigger}
                    hasUserInteracted={hasUserInteracted}
                />

                <MapInteractionController
                    onUserInteract={() => setHasUserInteracted(true)}
                />

                <MapBoundsController stops={stops} busPosition={busPosition} />

                {showRoute && routeWaypoints.length >= 2 && (
                    <RoadRoutePolyline waypoints={routeWaypoints} />
                )}

                {showPath && busPosition && routeState === 'in_progress' && (
                    <PathTrail
                        currentPosition={busPosition}
                        maxPoints={maxPathPoints}
                        color="#3b82f6"
                    />
                )}

                {stops.map((stop) => {
                    const isStudentStop = stop.id === studentStopId || stop.isStudentStop;
                    const icon = createStopIcon(stop.status, !!isStudentStop, stop.order);
                    const statusLabel =
                        stop.status === 'reached'
                            ? 'Reached'
                            : stop.status === 'current'
                              ? 'On the Way'
                              : 'Pending';

                    return (
                        <Marker
                            key={stop.id}
                            position={[stop.latitude, stop.longitude]}
                            icon={icon}
                        >
                            <Popup>
                                <div className="stop-popup">
                                    <div className="stop-popup-header">
                                        <strong>{stop.name}</strong>
                                        {isStudentStop && (
                                            <span className="stop-popup-badge">Your stop</span>
                                        )}
                                    </div>
                                    <div className="stop-popup-row">
                                        <span className="stop-popup-label">Stop #</span>
                                        <span>{stop.order}</span>
                                    </div>
                                    <div className="stop-popup-row">
                                        <span className="stop-popup-label">Status</span>
                                        <span className={`stop-popup-status ${stop.status}`}>
                                            {statusLabel}
                                        </span>
                                    </div>
                                    {stop.mapLink && (
                                        <a
                                            href={stop.mapLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="stop-popup-link"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            Open in Maps
                                        </a>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                {/* Only show bus marker when bus is actually in progress */}
                {busPosition && routeState === 'in_progress' && (
                    <AnimatedBusMarker
                        position={busPosition}
                        busNumber={busNumber}
                        driverName={driverName}
                        routeState={routeState}
                    />
                )}
            </MapContainer>

            {/* Custom controls */}
            <div className="map-controls">
                <button
                    onClick={handleCenterBus}
                    className="map-control-btn"
                    title="Center on bus"
                    disabled={!busPosition}
                >
                    <Crosshair className="w-5 h-5" />
                </button>
                <button
                    onClick={handleTogglePath}
                    className={`map-control-btn ${showRoute ? 'active' : ''}`}
                    title={showRoute ? 'Hide route line' : 'Show route line'}
                >
                    <Route className="w-5 h-5" />
                </button>
            </div>

            {/* Status indicator */}
            <div className="map-status-indicator">
                <div className={`map-status-dot ${isTracking ? 'tracking' : routeState === 'completed' ? 'completed' : ''}`} />
                <span className="map-status-text">
                    {isTracking ? 'Live Tracking' : routeState === 'completed' ? 'Completed' : 'Waiting'}
                </span>
            </div>
        </div>
    );
};

export default LiveBusMap;
