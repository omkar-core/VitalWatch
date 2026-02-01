
import type { FirebaseOptions } from 'firebase/app';

/**
 * Creates and returns the Firebase configuration object from environment variables.
 * This function ensures that process.env is accessed just-in-time.
 * @returns {FirebaseOptions | null} The Firebase config object or null if essential variables are missing.
 */
export const getFirebaseConfig = (): FirebaseOptions | null => {
    const firebaseConfig: FirebaseOptions = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
    };

    // A check to ensure that the config is valid.
    if (!firebaseConfig.apiKey) {
        return null;
    }

    return firebaseConfig;
};
