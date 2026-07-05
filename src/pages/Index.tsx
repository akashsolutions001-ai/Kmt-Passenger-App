import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LoginScreen } from '@/screens/LoginScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { TrackingScreen } from '@/screens/TrackingScreen';

const AppContent: React.FC = () => {
  const { isLoggedIn, isGuest, selectedRoute, trackingReady } = useAuth();

  const canTrack = (isLoggedIn || isGuest) && selectedRoute && trackingReady;

  if (!isLoggedIn && !isGuest) {
    return <LoginScreen />;
  }

  if (!canTrack) {
    return <HomeScreen />;
  }

  return <TrackingScreen />;
};

const Index = () => {
  return (
    <AuthProvider>
      <div className="min-h-screen-safe bg-background">
        <AppContent />
      </div>
    </AuthProvider>
  );
};

export default Index;
