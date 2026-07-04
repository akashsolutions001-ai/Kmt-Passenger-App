/**
 * Firebase Cloud Functions for Bus Tracking Notifications
 * 
 * These functions run on Firebase's servers and send push notifications
 * to passengers even when their app is CLOSED or MINIMIZED.
 * 
 * RTDB Structure:
 *   buses/{busNumber}/
 *     location: { lat, lng, routeId, routeName, routeState, ... }
 *     routeState: "not_started" | "in_progress" | "completed"
 *     currentStop: { name, order, stopId, status, ... }
 *     stops: { [stopId]: { name, order, status, ... } }
 * 
 *   passengers/{passengerId}/
 *     fcmToken: "device-token-string"
 *     routeId: "firestore-route-doc-id"
 *     stopId: "stop-identifier"
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.database();
const firestore = admin.firestore();

// ─── Helper: Find all passenger FCM tokens for a given routeId ───
async function getPassengerTokensForRoute(
    routeId: string
): Promise<{ passengerId: string; token: string; stopId?: string }[]> {
    const passengersSnap = await db.ref("passengers").once("value");
    const passengers = passengersSnap.val();
    if (!passengers) return [];

    const results: { passengerId: string; token: string; stopId?: string }[] = [];

    for (const [passengerId, data] of Object.entries(passengers)) {
        const s = data as Record<string, unknown>;
        if (s.routeId === routeId && s.fcmToken && typeof s.fcmToken === "string") {
            results.push({
                passengerId,
                token: s.fcmToken,
                stopId: typeof s.stopId === "string" ? s.stopId : undefined,
            });
        }
    }

    return results;
}

// ─── Helper: Find routeId for a bus from RTDB or Firestore ───
async function getRouteIdForBus(busNumber: string, busData: Record<string, unknown>): Promise<string | null> {
    // Try from RTDB location data first
    const location = busData.location as Record<string, unknown> | undefined;
    if (location?.routeId && typeof location.routeId === "string") {
        return location.routeId;
    }

    // Fallback: query Firestore buses collection by busNumber
    try {
        const busQuery = await firestore
            .collection("buses")
            .where("busNumber", "==", busNumber)
            .limit(1)
            .get();

        if (!busQuery.empty) {
            const busDoc = busQuery.docs[0].data();
            if (busDoc.assignedRouteId) {
                return busDoc.assignedRouteId as string;
            }
        }
    } catch (err) {
        console.error(`[CF] Firestore query failed for bus ${busNumber}:`, err);
    }

    return null;
}

// ─── Helper: Get route stops from Firestore ───
async function getRouteStops(routeId: string): Promise<{ id: string; name: string }[]> {
    try {
        const routeDoc = await firestore.collection("routes").doc(routeId).get();
        if (routeDoc.exists) {
            const data = routeDoc.data();
            if (data?.stops && Array.isArray(data.stops)) {
                return data.stops.map((s: { id?: string; name?: string }) => ({
                    id: s.id ?? "",
                    name: s.name ?? "",
                }));
            }
        }
    } catch (err) {
        console.error(`[CF] Failed to get route stops for ${routeId}:`, err);
    }
    return [];
}

// ─── Helper: Send FCM to multiple tokens, clean up invalid ones ───
async function sendToTokens(
    tokens: { passengerId: string; token: string }[],
    notification: { title: string; body: string },
    data?: Record<string, string>
): Promise<number> {
    if (tokens.length === 0) return 0;

    const messaging = admin.messaging();
    let sentCount = 0;

    // Send to each token individually to handle failures gracefully
    const promises = tokens.map(async ({ passengerId, token }) => {
        try {
            await messaging.send({
                token,
                notification: {
                    title: notification.title,
                    body: notification.body,
                },
                data: data ?? {},
                android: {
                    priority: "high",
                    notification: {
                        channelId: "bus_tracking",
                        icon: "ic_notification",
                        sound: "default",
                        clickAction: "FLUTTER_NOTIFICATION_CLICK",
                    },
                },
            });
            sentCount++;
            console.log(`[CF] Notification sent to passenger ${passengerId}`);
        } catch (err: unknown) {
            const error = err as { code?: string };
            // Remove invalid tokens
            if (
                error.code === "messaging/invalid-registration-token" ||
                error.code === "messaging/registration-token-not-registered"
            ) {
                console.warn(`[CF] Removing invalid token for passenger ${passengerId}`);
                await db.ref(`passengers/${passengerId}/fcmToken`).remove().catch(() => { });
            } else {
                console.error(`[CF] Failed to send to passenger ${passengerId}:`, err);
            }
        }
    });

    await Promise.all(promises);
    return sentCount;
}

// ═══════════════════════════════════════════════════════════════════════
// FUNCTION 1: BUS STARTED — triggers when routeState changes
// ═══════════════════════════════════════════════════════════════════════
export const onBusRouteStateChange = functions.database
    .ref("buses/{busNumber}/routeState")
    .onUpdate(async (change, context) => {
        const busNumber = context.params.busNumber;
        const before = typeof change.before.val() === "string"
            ? change.before.val()
            : (change.before.val() as Record<string, unknown>)?.state ?? "";
        const after = typeof change.after.val() === "string"
            ? change.after.val()
            : (change.after.val() as Record<string, unknown>)?.state ?? "";

        console.log(`[CF] Bus ${busNumber} routeState: "${before}" → "${after}"`);

        // ── Bus STARTED (not_started/idle → in_progress) ──
        if (after === "in_progress" && before !== "in_progress") {
            // Get full bus data to find routeId
            const busSnap = await db.ref(`buses/${busNumber}`).once("value");
            const busData = busSnap.val();
            if (!busData) return;

            const routeId = await getRouteIdForBus(busNumber, busData);
            if (!routeId) {
                console.warn(`[CF] No routeId found for bus ${busNumber}`);
                return;
            }

            const routeName = (busData.location as Record<string, unknown>)?.routeName ?? "your route";

            const passengers = await getPassengerTokensForRoute(routeId);
            console.log(`[CF] Found ${passengers.length} passengers for route ${routeId}`);

            const sent = await sendToTokens(
                passengers,
                {
                    title: "🚌 Bus Started!",
                    body: `Your bus (${busNumber}) has started on ${routeName}! Track it in real-time.`,
                },
                {
                    type: "bus-started",
                    busNumber,
                    routeId,
                }
            );

            console.log(`[CF] Bus Started notification sent to ${sent}/${passengers.length} passengers`);
        }

        // ── Bus COMPLETED (in_progress → completed) ──
        if (after === "completed" && before === "in_progress") {
            const busSnap = await db.ref(`buses/${busNumber}`).once("value");
            const busData = busSnap.val();
            if (!busData) return;

            const routeId = await getRouteIdForBus(busNumber, busData);
            if (!routeId) return;

            const passengers = await getPassengerTokensForRoute(routeId);

            const sent = await sendToTokens(
                passengers,
                {
                    title: "✅ Trip Completed",
                    body: `Bus ${busNumber} has completed its route. See you next time!`,
                },
                {
                    type: "bus-completed",
                    busNumber,
                    routeId,
                }
            );

            console.log(`[CF] Trip Completed notification sent to ${sent}/${passengers.length} passengers`);
        }
    });

// ═══════════════════════════════════════════════════════════════════════
// FUNCTION 2: STOP UPDATES — triggers when currentStop changes
// Sends "Bus Approaching", "Bus Arrived", and "Bus Passed" notifications
// ═══════════════════════════════════════════════════════════════════════
export const onBusCurrentStopChange = functions.database
    .ref("buses/{busNumber}/currentStop")
    .onUpdate(async (change, context) => {
        const busNumber = context.params.busNumber;

        const beforeStop = change.before.val() as Record<string, unknown> | null;
        const afterStop = change.after.val() as Record<string, unknown> | null;

        if (!afterStop) return;

        const afterOrder = typeof afterStop.order === "number" ? afterStop.order : -1;
        const beforeOrder = beforeStop && typeof beforeStop.order === "number" ? beforeStop.order : -1;

        // Only process if stop actually changed
        if (afterOrder === beforeOrder && afterStop.name === beforeStop?.name) return;

        const afterStopName = (afterStop.name as string) ?? "Unknown Stop";
        console.log(
            `[CF] Bus ${busNumber} stop change: order ${beforeOrder} → ${afterOrder} (${afterStopName})`
        );

        // Get bus data for routeId
        const busSnap = await db.ref(`buses/${busNumber}`).once("value");
        const busData = busSnap.val();
        if (!busData) return;

        // Only send if bus is actually running
        const rs = typeof busData.routeState === "string"
            ? busData.routeState
            : (busData.routeState as Record<string, unknown>)?.state ?? "";
        if (rs !== "in_progress") return;

        const routeId = await getRouteIdForBus(busNumber, busData);
        if (!routeId) return;

        // Get route stops to determine passenger stop positions
        const routeStops = await getRouteStops(routeId);

        const passengers = await getPassengerTokensForRoute(routeId);
        if (passengers.length === 0) return;

        for (const passenger of passengers) {
            if (!passenger.stopId) continue;

            const passengerStopIndex = routeStops.findIndex((s) => s.id === passenger.stopId);
            if (passengerStopIndex < 0) continue;

            const passengerStopName = routeStops[passengerStopIndex].name;
            const currentBusStopIndex = afterOrder > 0 ? afterOrder - 1 : -1;

            // Bus Near Your Stop (one stop away)
            if (currentBusStopIndex === passengerStopIndex - 1) {
                await sendToTokens(
                    [passenger],
                    {
                        title: "📍 Bus Near Your Stop",
                        body: `Your stop "${passengerStopName}" is coming up next! Get ready.`,
                    },
                    {
                        type: "bus-near-stop",
                        busNumber,
                        stopName: passengerStopName,
                    }
                );
                console.log(`[CF] Near-stop notification sent to ${passenger.passengerId}`);
            }

            if (currentBusStopIndex === passengerStopIndex) {
                await sendToTokens(
                    [passenger],
                    {
                        title: "🎯 Bus Arrived!",
                        body: `Bus has arrived at "${passengerStopName}"!`,
                    },
                    {
                        type: "bus-arrived",
                        busNumber,
                        stopName: passengerStopName,
                    }
                );
                console.log(`[CF] Arrival notification sent to ${passenger.passengerId}`);
            }

            const previousBusStopIndex = beforeOrder > 0 ? beforeOrder - 1 : -1;
            if (currentBusStopIndex === passengerStopIndex + 1 && previousBusStopIndex === passengerStopIndex) {
                await sendToTokens(
                    [passenger],
                    {
                        title: "⚠️ Bus Passed Your Stop",
                        body: `The bus has passed "${passengerStopName}".`,
                    },
                    {
                        type: "bus-passed",
                        busNumber,
                        stopName: passengerStopName,
                    }
                );
            }
        }
    });

// ═══════════════════════════════════════════════════════════════════════
// FUNCTION 3: NEW PASSENGER TOKEN
export const onPassengerTokenUpdate = functions.database
    .ref("passengers/{passengerId}/fcmToken")
    .onWrite(async (change, context) => {
        const passengerId = context.params.passengerId;
        const newToken = change.after.val();

        // Only fire when a new token is set (not deleted)
        if (!newToken || typeof newToken !== "string") return;

        // Don't fire if token didn't actually change
        const oldToken = change.before.val();
        if (oldToken === newToken) return;

        console.log(`[CF] Passenger ${passengerId} registered new FCM token`);

        try {
            await admin.messaging().send({
                token: newToken,
                notification: {
                    title: "🔔 Notifications Enabled",
                    body: "You'll receive alerts when your bus starts, approaches, and arrives at your stop.",
                },
                android: {
                    priority: "high",
                    notification: {
                        channelId: "bus_tracking",
                        icon: "ic_notification",
                        sound: "default",
                    },
                },
            });
            console.log(`[CF] Welcome notification sent to passenger ${passengerId}`);
        } catch (err) {
            console.error(`[CF] Failed to send welcome notification:`, err);
        }
    });

// ═══════════════════════════════════════════════════════════════════════
// FUNCTION 4: EMERGENCY ALERTS — driver SOS / breakdown / accident
// ═══════════════════════════════════════════════════════════════════════
export const onEmergencyAlert = functions.database
    .ref("buses/{busNumber}/alert")
    .onWrite(async (change, context) => {
        const busNumber = context.params.busNumber;
        const alert = change.after.val() as Record<string, unknown> | null;
        if (!alert) return;

        const busSnap = await db.ref(`buses/${busNumber}`).once("value");
        const busData = busSnap.val();
        if (!busData) return;

        const routeId = await getRouteIdForBus(busNumber, busData);
        if (!routeId) return;

        const passengers = await getPassengerTokensForRoute(routeId);
        const alertType = (alert.type as string) ?? "emergency";
        const message = (alert.message as string) ?? "Emergency alert on your route";

        await sendToTokens(
            passengers,
            {
                title: "🚨 Emergency Alert",
                body: `Bus ${busNumber}: ${message}`,
            },
            { type: "emergency-alert", busNumber, alertType }
        );

        console.log(`[CF] Emergency alert sent for bus ${busNumber}`);
    });

// ═══════════════════════════════════════════════════════════════════════
// FUNCTION 5: DELAY DETECTION
// ═══════════════════════════════════════════════════════════════════════
export const onBusDelayDetected = functions.database
    .ref("buses/{busNumber}/isDelayed")
    .onUpdate(async (change, context) => {
        const busNumber = context.params.busNumber;
        const wasDelayed = change.before.val();
        const isDelayed = change.after.val();
        if (!isDelayed || wasDelayed === isDelayed) return;

        const busSnap = await db.ref(`buses/${busNumber}`).once("value");
        const busData = busSnap.val();
        if (!busData) return;

        const routeId = await getRouteIdForBus(busNumber, busData);
        if (!routeId) return;

        const passengers = await getPassengerTokensForRoute(routeId);
        await sendToTokens(
            passengers,
            {
                title: "⏱ Bus Delayed",
                body: `Bus ${busNumber} is running behind schedule.`,
            },
            { type: "bus-delayed", busNumber, routeId }
        );
    });

/** @deprecated Use onPassengerTokenUpdate */
export const onStudentTokenUpdate = onPassengerTokenUpdate;
