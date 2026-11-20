import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, driveAuthProvider, googleAuthProvider } from '../lib/firebase.ts';

interface AuthContextValue {
  user: User | null;
  idToken: string | null;
  driveAccessToken: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  connectGoogleDrive: () => Promise<string | null>;
  clearDriveAccessToken: () => void;
  signOutUser: () => Promise<void>;
  getFreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  idToken: null,
  driveAccessToken: null,
  loading: true,
  signInWithGoogle: async () => {},
  connectGoogleDrive: async () => null,
  clearDriveAccessToken: () => {},
  signOutUser: async () => {},
  getFreshToken: async () => null,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  // Store tokens strictly in memory (never in localStorage or sessionStorage)
  const [idToken, setIdToken] = useState<string | null>(null);
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          setIdToken(token);
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
        } catch (err) {
          console.warn('Auth sync warning:', err);
        }
      } else {
        setIdToken(null);
        setDriveAccessToken(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const credential = await signInWithPopup(auth, googleAuthProvider);
    const token = await credential.user.getIdToken();
    setIdToken(token);
  };

  const connectGoogleDrive = async (): Promise<string | null> => {
    const result = await signInWithPopup(auth, driveAuthProvider);
    const idTok = await result.user.getIdToken();
    setIdToken(idTok);
    const oauthCred = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = oauthCred?.accessToken || null;
    if (!accessToken) {
      throw new Error('Failed to obtain Google Drive access token.');
    }
    setDriveAccessToken(accessToken);
    return accessToken;
  };

  const clearDriveAccessToken = () => {
    setDriveAccessToken(null);
  };

  const signOutUser = async () => {
    setDriveAccessToken(null);
    await signOut(auth);
    setIdToken(null);
  };

  const getFreshToken = async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    try {
      const token = await auth.currentUser.getIdToken();
      setIdToken(token);
      return token;
    } catch {
      return idToken;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        idToken,
        driveAccessToken,
        loading,
        signInWithGoogle,
        connectGoogleDrive,
        clearDriveAccessToken,
        signOutUser,
        getFreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
