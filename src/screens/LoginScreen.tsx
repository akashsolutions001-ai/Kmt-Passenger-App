import { useState } from 'react';
import { useStudent } from '@/context/StudentContext';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bus, Loader2, AlertCircle, User } from 'lucide-react';
import { toast } from 'sonner';

export const LoginScreen: React.FC = () => {
  const { login, loginWithGoogle, continueAsGuest } = useStudent();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLoginForm, setShowLoginForm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }
    setIsLoading(true);
    const success = await login(email, password);
    setIsLoading(false);
    if (!success) setError('Invalid credentials. Please try again.');
  };

  const handleGuest = () => {
    continueAsGuest?.();
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsGoogleLoading(true);
    const success = await loginWithGoogle();
    setIsGoogleLoading(false);
    if (!success && !error) {
      // Errors are toasted inside loginWithGoogle when relevant
    }
  };

  const handlePhoneLogin = () => {
    toast.info('Phone login', { description: 'OTP login will be available soon.' });
  };

  const authBusy = isLoading || isGoogleLoading;

  return (
    <div className="min-h-screen-safe bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-elevated">
              <Bus className="w-9 h-9 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">KMT Bus Tracker</h1>
            <p className="text-muted-foreground mt-1 text-center">
              Track municipal buses across Kolhapur
            </p>
          </div>

          <Button
            className="w-full h-12 rounded-xl text-base font-semibold mb-4"
            onClick={handleGuest}
            disabled={authBusy}
          >
            Continue as Guest
          </Button>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <Button
              variant="outline"
              className="h-11 rounded-xl"
              onClick={handleGoogleLogin}
              disabled={authBusy}
            >
              {isGoogleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Google'
              )}
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-xl"
              onClick={handlePhoneLogin}
              disabled={authBusy}
            >
              Phone
            </Button>
          </div>

          {!showLoginForm ? (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowLoginForm(true)}
              disabled={authBusy}
            >
              <User className="h-4 w-4 mr-2" /> Passenger Login
            </Button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 mt-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="passenger@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 px-4 rounded-xl"
                  disabled={authBusy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 px-4 rounded-xl"
                  disabled={authBusy}
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}
              <Button type="submit" className="w-full h-12 rounded-xl font-semibold" disabled={authBusy}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};
