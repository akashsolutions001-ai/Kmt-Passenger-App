import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { auth } from '@/lib/firebase';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Google sign-in:
 * - Web: Firebase popup
 * - Android/iOS: native Google Sign-In → Firebase credential
 *   (popup auth does not work reliably inside Capacitor WebView)
 */
export async function signInWithGoogle(): Promise<User> {
  if (Capacitor.isNativePlatform()) {
    const result = await FirebaseAuthentication.signInWithGoogle();
    const idToken = result.credential?.idToken;
    if (!idToken) {
      throw Object.assign(new Error('No ID token returned from Google Sign-In'), {
        code: 'auth/missing-id-token',
      });
    }

    const credential = GoogleAuthProvider.credential(idToken, result.credential?.accessToken);
    const userCredential = await signInWithCredential(auth, credential);
    return userCredential.user;
  }

  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutAuth(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await FirebaseAuthentication.signOut();
    } catch {
      // ignore native sign-out errors; still clear Firebase web session
    }
  }
  await signOut(auth);
}

export function subscribeToAuthState(
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
}
