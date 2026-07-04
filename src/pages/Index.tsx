import { useState } from 'react';
import { StudentProvider, useStudent } from '@/context/StudentContext';
import { LoginScreen } from '@/screens/LoginScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { TrackingScreen } from '@/screens/TrackingScreen';

const AppContent: React.FC = () => {
  const { isLoggedIn, isGuest, selectedRoute, trackingReady } = useStudent();
  const [showLogin, setShowLogin] = useState(false);

  const canTrack = (isLoggedIn || isGuest) && selectedRoute && trackingReady;

  if (!isLoggedIn && !isGuest) {
    return <LoginScreen />;
  }

  if (showLogin && !isLoggedIn) {
    return <LoginScreen />;
  }

  if (!canTrack) {
    return <HomeScreen onOpenLogin={() => setShowLogin(true)} />;
  }

  return <TrackingScreen />;
};

const Index = () => {
  return (
    <StudentProvider>
      <div className="min-h-screen-safe bg-background">
        <AppContent />
      </div>
    </StudentProvider>
  );
};

export default Index;
