'use client';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebase } from '..';
import type { UserRole, PatientProfile } from '@/lib/types';

const firebaseNotConfiguredError = new Error(
  'Firebase is not configured. Please check your firebase/config.ts file.'
);

export async function signUp(
  email: string,
  password: string,
  displayName: string,
  role: UserRole
) {
  const { auth, firestore } = getFirebase();
  if (!auth || !firestore) {
    throw firebaseNotConfiguredError;
  }
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );
  const user = userCredential.user;

  const avatar_url = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    displayName
  )}&background=random`;

  // Update profile in Firebase Auth
  await updateProfile(user, { displayName, photoURL: avatar_url });

  // Create user document in Firestore for role management
  const userRef = doc(firestore, 'users', user.uid);
  await setDoc(userRef, {
    uid: user.uid,
    email: user.email,
    display_name: displayName,
    role: role,
    avatar_url: avatar_url,
    created_at: serverTimestamp(),
  });

  // If the user is a patient, create a corresponding patient_profile in GridDB
  if (role === 'patient') {
    const now = new Date().toISOString();
    const newProfile: PatientProfile = {
      patient_id: user.uid,
      device_id: 'patient-01', // Align with ESP32 device ID for demo
      name: displayName,
      email: email,
      is_active: true,
      created_at: now,
      updated_at: now,
      age: undefined,
      gender: 'Other',
      phone: undefined,
      avatar_url: avatar_url,
      baseline_hr: undefined,
      baseline_spo2: undefined,
      baseline_bp_systolic: undefined,
      baseline_bp_diastolic: undefined,
      has_diabetes: false,
      has_hypertension: false,
      has_heart_condition: false,
      alert_threshold_hr_high: process.env.HR_HIGH ? parseInt(process.env.HR_HIGH) : 120,
      alert_threshold_hr_low: process.env.HR_LOW ? parseInt(process.env.HR_LOW) : 50,
      alert_threshold_spo2_low: process.env.SPO2_LOW ? parseInt(process.env.SPO2_LOW) : 92,
      alert_threshold_bp_systolic_high: 140,
      alert_threshold_glucose_high: 180,
      emergency_contact_name: undefined,
      emergency_contact_phone: undefined,
    };

    // Fire-and-forget the profile creation to make the UI faster.
    // The dashboard will handle the brief period where the profile might not exist yet.
    fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProfile),
    }).catch((e) => {
      console.error(
        'Failed to create patient profile in GridDB in the background:',
        e
      );
      // In a real app, you might add this to a retry queue or notify an admin.
    });
  }

  return user;
}

export async function login(email: string, password: string) {
  const { auth } = getFirebase();
   if (!auth) {
    throw firebaseNotConfiguredError;
  }
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  const { auth } = getFirebase();
   if (!auth) {
    throw firebaseNotConfiguredError;
  }
  return signOut(auth);
}
