import type { FirebaseOptions } from 'firebase/app';

// Your web app's Firebase configuration
// This is a public configuration and is safe to be exposed on the client-side.
// Security is enforced by Firebase Security Rules.
export const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyAvkrFL1vus49_RrLf7pTO2NrR6AkCpvx8",
  authDomain: "any2pdf-c1eb3.firebaseapp.com",
  projectId: "any2pdf-c1eb3",
  storageBucket: "any2pdf-c1eb3.appspot.com",
  messagingSenderId: "989655899263",
  appId: "1:989655899263:web:da3376aed2eac83ec0b34a",
  measurementId: "G-L7CYMRDNXR"
};

// A check to ensure that the config is valid.
export const isFirebaseConfigValid = (): boolean => {
    return !!firebaseConfig.apiKey;
}
