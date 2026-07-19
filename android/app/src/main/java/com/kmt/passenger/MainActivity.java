package com.kmt.passenger;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();
    }

    /**
     * Guard against Capacitor Bridge being null when Android tries to save
     * instance state (e.g. when Chrome Custom Tab opens for Google sign-in).
     * Without this, a NullPointerException crashes the app every time the
     * sign-in screen is shown.
     */
    @Override
    public void onSaveInstanceState(Bundle outState) {
        if (getBridge() != null) {
            super.onSaveInstanceState(outState);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    "bus_tracking",
                    "Bus Tracking",
                    NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Notifications for bus tracking updates");
            channel.enableVibration(true);
            channel.setShowBadge(true);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}
