import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFirebaseConfig } from './config';

let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

// This function ensures that we initialize Firebase only once, and only on the client.
function getFirebase() {
  // Always return null on the server
  if (typeof window === 'undefined') {
    return { app: null, auth: null, firestore: null };
  }

  const config = getFirebaseConfig();

  // On the client, check if config is valid
  if (!config) {
    console.error(
      'Firebase configuration is invalid. Please check your NEXT_PUBLIC_ environment variables.'
    );
    return { app: null, auth: null, firestore: null };
  }
  
  // Initialize if not already initialized
  if (!getApps().length) {
    app = initializeApp(config);
    auth = getAuth(app);
    firestore = getFirestore(app);
  } else {
    app = getApp();
    auth = getAuth(app);
    firestore = getFirestore(app);
  }

  return { app, auth, firestore };
}

// Export the initialization function and hooks
export { getFirebase };
export { useApp, useAuth, useFirestore } from './provider';
export { useUser } from './auth/use-user';
