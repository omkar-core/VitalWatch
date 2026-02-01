import type { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

export type UserRole = 'doctor' | 'patient';

export interface UserProfile {
  uid: string;
  email?: string;
  display_name?: string;
  role: UserRole;
  avatar_url?: string;
  created_at: Timestamp;
}

export interface PatientProfile {
    patient_id: string; // The unique ID of the patient, matches the auth UID.
    device_id: string;
    name?: string;
    age?: number;
    gender?: 'Male' | 'Female' | 'Other';
    email?: string;
    phone?: string;
    avatar_url?: string;
    baseline_hr?: number;
    baseline_spo2?: number;
    baseline_bp_systolic?: number;
    baseline_bp_diastolic?: number;
    has_diabetes?: boolean;
    has_hypertension?: boolean;
    has_heart_condition?: boolean;
    alert_threshold_hr_high?: number;
    alert_threshold_hr_low?: number;
    alert_threshold_spo2_low?: number;
    alert_threshold_bp_systolic_high?: number;
    alert_threshold_glucose_high?: number;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    created_at: string;
    updated_at: string;
    is_active: boolean;
}

export interface HealthVital {
    timestamp: string;
    device_id: string;
    heart_rate: number;
    spo2: number;
    temperature: number;
    ppg_raw: number;
    predicted_bp_systolic?: number;
    predicted_bp_diastolic?: number;
    predicted_glucose?: number;
    alert_flag: boolean;
    created_at: string;
    confidence_score?: number;
}

export interface AlertHistory {
    alert_timestamp: string;
    alert_id: string;
    device_id: string;
    patient_id?: string;
    alert_type: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    alert_message: string;
    heart_rate?: number;
    spo2?: number;
    temperature?: number;
    ppg_raw?: number;
    predicted_bp_systolic?: number;
    predicted_bp_diastolic?: number;
    predicted_glucose?: number;
    confidence_score?: number;
    acknowledged: boolean;
    acknowledged_at?: string;
    created_at: string;
}


export type ESP32Data = {
  device_id: string;
  timestamp: string; // ISO 8601 format
  heart_rate: number;
  spo2: number;
  temperature: number;
  ppg_raw: number;
};


// AI-related types
const VitalsSchema = z.object({
  timestamp: z.string().describe('ISO 8601 timestamp of the reading.'),
  heart_rate: z.number().describe('Heart rate in beats per minute (BPM).'),
  spo2: z.number().describe('Blood oxygen saturation percentage (SpO2).'),
  temperature: z.number().describe('Body temperature in Celsius.'),
});

export const EstimateHealthMetricsInputSchema = z.object({
  age: z.number().describe('The age of the user.'),
  gender: z.string().describe('The gender of the user.'),
  medical_history: z
    .string()
    .optional()
    .describe(
      "A brief summary of the user's relevant medical history (e.g., existing conditions like diabetes, hypertension)."
    ),
  current_vitals: VitalsSchema.describe('The most recent vital signs reading.'),
  recent_vitals: z
    .array(VitalsSchema)
    .optional()
    .describe(
      'A series of recent vital signs readings for trend analysis, ordered from oldest to newest.'
    ),
});

export type EstimateHealthMetricsInput = z.infer<
  typeof EstimateHealthMetricsInputSchema
>;

export const EstimateHealthMetricsOutputSchema = z.object({
  estimated_systolic: z
    .number()
    .describe('The estimated systolic blood pressure in mmHg.'),
  estimated_diastolic: z
    .number()
    .describe('The estimated diastolic blood pressure in mmHg.'),
  estimated_glucose: z
    .number()
    .describe('The estimated blood glucose level in mg/dL.'),
  confidence_score: z
    .number()
    .min(0)
    .max(1)
    .describe('A confidence score (0-1) for the overall estimation.'),
  reasoning: z
    .string()
    .describe(
      'A brief, high-level reasoning for the estimations based on the provided inputs.'
    ),
});

export type EstimateHealthMetricsOutput = z.infer<
  typeof EstimateHealthMetricsOutputSchema
>;
