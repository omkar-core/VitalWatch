import { NextRequest, NextResponse } from 'next/server';
import type { ESP32Data, PatientProfile, HealthVital, AlertHistory } from '@/lib/types';
import { sendHealthReport, sendCriticalAlert } from '@/lib/telegram';
import { putRows, getRows } from '@/lib/griddb-client';
import { validateDeviceRequest } from '@/lib/device-auth';
import { randomUUID } from 'crypto';
import { routeVitalsProcessing } from '@/lib/backendRouter';

type IngestRequestBody = {
  vitals: ESP32Data[];
  chatId?: string;
  internal_secret?: string;
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
      
      const enrichedVital = {
        ...vital,
        temperature: vital.temperature || 36.9
      };

      const { predictions, processed_by } = await routeVitalsProcessing(enrichedVital, patientProfile);

      const alertMessages: string[] = [];
      let alert_severity: 'Critical' | 'High' = 'High';

      if (enrichedVital.heart_rate > (patientProfile.alert_threshold_hr_high || parseInt(process.env.HR_HIGH || '120'))) {
        alertMessages.push(`High heart rate: ${enrichedVital.heart_rate.toFixed(0)} BPM.`);
        alert_severity = 'High';
      }
      if (enrichedVital.heart_rate < (patientProfile.alert_threshold_hr_low || parseInt(process.env.HR_LOW || '50'))) {
        alertMessages.push(`Low heart rate: ${enrichedVital.heart_rate.toFixed(0)} BPM.`);
        alert_severity = 'High';
      }
      if (enrichedVital.spo2 < (patientProfile.alert_threshold_spo2_low || parseInt(process.env.SPO2_LOW || '92'))) {
        alertMessages.push(`Low SpO2: ${enrichedVital.spo2.toFixed(1)}%.`);
        alert_severity = 'Critical';
      }
      if (enrichedVital.temperature > (patientProfile.alert_threshold_temp_high || parseFloat(process.env.TEMP_HIGH || '38.5'))) {
        alertMessages.push(`High temperature: ${enrichedVital.temperature.toFixed(1)}°C.`);
        alert_severity = 'High';
      }
      if (enrichedVital.temperature < (patientProfile.alert_threshold_temp_low || parseFloat(process.env.TEMP_LOW || '35.0'))) {
        alertMessages.push(`Low temperature: ${enrichedVital.temperature.toFixed(1)}°C.`);
        alert_severity = 'High';
      }
      
      if (predictions.estimated_systolic > (patientProfile.alert_threshold_bp_systolic_high || 140) && predictions.confidence_score > 0.5) {
         alertMessages.push(`AI detected BP risk: ${predictions.estimated_systolic.toFixed(0)}/${predictions.estimated_diastolic.toFixed(0)} mmHg.`);
         alert_severity = 'High';
      }
      if (predictions.estimated_glucose > (patientProfile.alert_threshold_glucose_high || 180) && predictions.confidence_score > 0.5) {
         alertMessages.push(`AI detected Glucose risk: ${predictions.estimated_glucose.toFixed(0)} mg/dL.`);
         alert_severity = 'High';
      }

      const alert_flag = alertMessages.length > 0;
      const now = new Date().toISOString();
      
      const healthVitalRecord: HealthVital = {
        timestamp: enrichedVital.timestamp,
        device_id: enrichedVital.device_id,
        heart_rate: enrichedVital.heart_rate,
        spo2: enrichedVital.spo2,
        temperature: enrichedVital.temperature,
        ppg_raw: enrichedVital.ppg_raw,
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
            alert_timestamp: enrichedVital.timestamp,
            alert_id: randomUUID(),
            device_id: enrichedVital.device_id,
            patient_id: patientProfile.patient_id,
            alert_type: "Vital Sign Out of Range",
            severity: alert_severity,
            alert_message: alert_message,
            heart_rate: enrichedVital.heart_rate,
            spo2: enrichedVital.spo2,
            temperature: healthVitalRecord.temperature,
            ppg_raw: enrichedVital.ppg_raw,
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
           await sendCriticalAlert({
            chatId: process.env.TELEGRAM_CHAT_ID,
            patientName: patientProfile.name || 'N/A',
            deviceId: enrichedVital.device_id,
            severity: alert_severity,
            alertMessage: alert_message,
            vital: healthVitalRecord,
          });
        }
      }
    }

    if (chatId && finalHealthVital) {
      await sendHealthReport(chatId, finalHealthVital);
    }

    return NextResponse.json({ message: 'Success', vital: finalHealthVital });

  } catch (error: any) {
    console.error('[/api/vitals] Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
