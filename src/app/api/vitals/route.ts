
import { NextRequest, NextResponse } from 'next/server';
import type { ESP32Data, PatientProfile, HealthVital, AlertHistory } from '@/lib/types';
import { sendHealthReport, sendCriticalAlert } from '@/lib/telegram';
import { putRows, getRows } from '@/lib/griddb-client';
import { validateDeviceRequest } from '@/lib/device-auth';
import { randomUUID } from 'crypto';
import { routeVitalsProcessing } from '@/lib/backendRouter';

type IngestRequestBody = {
  vitals: ESP32Data[];
  chatId?: string; // Optional chatId for Telegram reporting
  internal_secret?: string; // Optional secret for internal calls
}

export async function POST(request: NextRequest) {
  const body: IngestRequestBody = await request.json();
  
  const isInternalCall = body.internal_secret === process.env.INTERNAL_API_SECRET;
  if (!isInternalCall) {
    const authError = validateDeviceRequest(request);
    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }
  }

  try {
    const { vitals: incomingVitals, chatId } = body;

    if (!Array.isArray(incomingVitals) || incomingVitals.length === 0) {
      return NextResponse.json({ error: 'Invalid or empty vitals data' }, { status: 400 });
    }

    let finalHealthVital: HealthVital | null = null;

    for (const vital of incomingVitals) {
      const patientProfileResults = await getRows('patient_profiles', `device_id='${vital.device_id}'`);
      
      if (!patientProfileResults.results || patientProfileResults.results.length === 0) {
        console.warn(`No patient profile found for deviceId: ${vital.device_id}. Skipping.`);
        continue;
      }

      const profileColumns = patientProfileResults.columns;
      const profileValues = patientProfileResults.results[0];
      const patientProfile: PatientProfile = profileColumns.reduce((obj: any, col: any, index: number) => {
          obj[col.name] = profileValues[index];
          return obj;
      }, {});

      // Use the backend router to process vitals
      const { predictions, processed_by } = await routeVitalsProcessing(vital, patientProfile);

      const alertMessages: string[] = [];
      let alert_severity: 'Critical' | 'High' = 'High';

      if (vital.heart_rate > (patientProfile.alert_threshold_hr_high || parseInt(process.env.HR_HIGH || '120'))) {
        alertMessages.push(`Critical heart rate detected: ${vital.heart_rate.toFixed(0)} BPM.`);
        alert_severity = 'Critical';
      }
       if (vital.heart_rate < (patientProfile.alert_threshold_hr_low || parseInt(process.env.HR_LOW || '50'))) {
        alertMessages.push(`Critical low heart rate detected: ${vital.heart_rate.toFixed(0)} BPM.`);
        alert_severity = 'Critical';
      }
      if (vital.spo2 < (patientProfile.alert_threshold_spo2_low || parseInt(process.env.SPO2_LOW || '92'))) {
        alertMessages.push(`Critically Low SpO2 detected: ${vital.spo2.toFixed(1)}%.`);
        alert_severity = 'Critical';
      }
      
      if (predictions.estimated_systolic > (patientProfile.alert_threshold_bp_systolic_high || 140) && predictions.confidence_score > 0.5) {
         alertMessages.push(`AI detected high systolic BP risk: ~${predictions.estimated_systolic.toFixed(0)} mmHg.`);
         alert_severity = 'Critical';
      }
      if (predictions.estimated_glucose > (patientProfile.alert_threshold_glucose_high || 180) && predictions.confidence_score > 0.5) {
         alertMessages.push(`AI detected high blood glucose risk: ~${predictions.estimated_glucose.toFixed(0)} mg/dL.`);
         alert_severity = 'Critical';
      }

      const alert_flag = alertMessages.length > 0;
      const now = new Date().toISOString();
      
      const healthVitalRecord: HealthVital = {
        timestamp: vital.timestamp,
        device_id: vital.device_id,
        heart_rate: vital.heart_rate,
        spo2: vital.spo2,
        temperature: vital.temperature,
        ppg_raw: vital.ppg_raw,
        predicted_bp_systolic: predictions.estimated_systolic,
        predicted_bp_diastolic: predictions.estimated_diastolic,
        predicted_glucose: predictions.estimated_glucose,
        alert_flag: alert_flag,
        created_at: now,
        confidence_score: predictions.confidence_score,
        processed_by: processed_by,
      };
      
      const healthVitalRow = [
          healthVitalRecord.timestamp,
          healthVitalRecord.device_id,
          healthVitalRecord.heart_rate,
          healthVitalRecord.spo2,
          healthVitalRecord.temperature,
          healthVitalRecord.ppg_raw,
          healthVitalRecord.predicted_bp_systolic,
          healthVitalRecord.predicted_bp_diastolic,
          healthVitalRecord.predicted_glucose,
          healthVitalRecord.alert_flag,
          healthVitalRecord.created_at,
          healthVitalRecord.confidence_score,
          healthVitalRecord.processed_by,
      ];

      await putRows('health_vitals', [healthVitalRow]);
      
      finalHealthVital = healthVitalRecord;

      if (alert_flag) {
        const alert_message = alertMessages.join(' ');
        const alertRecord: AlertHistory = {
            alert_timestamp: vital.timestamp,
            alert_id: randomUUID(),
            device_id: vital.device_id,
            patient_id: patientProfile.patient_id,
            alert_type: "AI/Vital Threshold Exceeded",
            severity: alert_severity,
            alert_message: alert_message,
            heart_rate: vital.heart_rate,
            spo2: vital.spo2,
            temperature: vital.temperature,
            ppg_raw: vital.ppg_raw,
            predicted_glucose: healthVitalRecord.predicted_glucose,
            predicted_bp_systolic: healthVitalRecord.predicted_bp_systolic,
            predicted_bp_diastolic: healthVitalRecord.predicted_bp_diastolic,
            confidence_score: predictions.confidence_score,
            acknowledged: false,
            created_at: now
        };
        const alertRow = [
            alertRecord.alert_timestamp,
            alertRecord.alert_id,
            alertRecord.device_id,
            alertRecord.patient_id,
            alertRecord.alert_type,
            alertRecord.severity,
            alertRecord.alert_message,
            alertRecord.heart_rate,
            alertRecord.spo2,
            alertRecord.temperature,
            alertRecord.ppg_raw,
            alertRecord.predicted_bp_systolic,
            alertRecord.predicted_bp_diastolic,
            alertRecord.predicted_glucose,
            alertRecord.confidence_score,
            alertRecord.acknowledged,
            alertRecord.acknowledged_at || null,
            alertRecord.created_at,
        ];
        await putRows('alert_history', [alertRow]);
        
        if (process.env.TELEGRAM_CHAT_ID) {
          await sendCriticalAlert(process.env.TELEGRAM_CHAT_ID, alert_severity, `Patient ${patientProfile.name}: ${alert_message}`);
        }
      }
    }

    if (chatId && finalHealthVital) {
      await sendHealthReport(chatId, finalHealthVital);
    }

    return NextResponse.json({ message: 'Vitals ingested, analyzed, and stored successfully.', vital: finalHealthVital });

  } catch (error: any) {
    console.error('[/api/vitals] Error:', error);
    const chatId = body.chatId || process.env.TELEGRAM_CHAT_ID;
    if (chatId) {
        await sendCriticalAlert(chatId, 'Critical', 'Failed to process vitals. System error.');
    }
    return NextResponse.json({ error: error.message || 'An internal server error occurred.' }, { status: 500 });
  }
}
