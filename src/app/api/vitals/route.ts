
import { NextRequest, NextResponse } from 'next/server';
import type { ESP32Data, PatientProfile, HealthVital, AlertHistory } from '@/lib/types';
import { estimateHealthMetrics, EstimateHealthMetricsOutput } from '@/ai/flows/suggest-initial-diagnoses';
import { sendHealthReport, sendCriticalAlert } from '@/lib/telegram';
import { putRows, getRows } from '@/lib/griddb-client';
import { validateDeviceRequest } from '@/lib/device-auth';
import { randomUUID } from 'crypto';

type IngestRequestBody = {
  vitals: ESP32Data[];
  chatId?: string; // Optional chatId for Telegram reporting
  internal_secret?: string; // Optional secret for internal calls
}

// Architecture B: Process with Azure Function
async function processWithAzure(vital: ESP32Data, patientProfile: PatientProfile): Promise<EstimateHealthMetricsOutput> {
    console.log('Falling back to Azure Function for processing...');
    const azureUrl = process.env.AZURE_FUNCTION_URL;
    const azureKey = process.env.AZURE_FUNCTION_API_KEY;

    if (!azureUrl || !azureKey) {
        throw new Error('Azure Function URL or API Key is not configured.');
    }
    
    // Here we can add more patient context if the Azure function supports it
    const requestBody = {
        ...vital // Sending the raw vitals
    };

    const response = await fetch(azureUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-functions-key': azureKey,
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Azure Function returned an error:', response.status, errorText);
        throw new Error(`Azure Function processing failed with status: ${response.status}`);
    }

    const predictions = await response.json();

    // Normalize Azure output to match our standard EstimateHealthMetricsOutput
    // This is an assumption based on a typical ML model output. Adjust as needed.
    return {
        estimated_systolic: predictions.systolic || 120,
        estimated_diastolic: predictions.diastolic || 80,
        estimated_glucose: predictions.glucose || 100,
        confidence_score: predictions.confidence || 0.75, // Use a default confidence
        reasoning: predictions.reasoning || "Processed by Azure ML service."
    };
}


// Architecture A: Process with Gemini
async function processWithGemini(vital: ESP32Data, patientProfile: PatientProfile): Promise<EstimateHealthMetricsOutput> {
     const predictionInput = {
        age: patientProfile.age || 50,
        gender: patientProfile.gender || 'Other',
        medical_history: `Diabetes: ${patientProfile.has_diabetes}, Hypertension: ${patientProfile.has_hypertension}, Heart Condition: ${patientProfile.has_heart_condition}`,
        current_vitals: {
            timestamp: vital.timestamp,
            heart_rate: vital.heart_rate,
            spo2: vital.spo2,
            temperature: vital.temperature
        }
    };
    return await estimateHealthMetrics(predictionInput);
}


export async function POST(request: NextRequest) {
  const body: IngestRequestBody = await request.json();
  
  // 1. Authenticate Request
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

    // Process each reading (usually just one from the bot/scan)
    for (const vital of incomingVitals) {
      // 2. Fetch patient profile to get context and thresholds
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

      // 3. Dual-Architecture Processing with Failover
      let predictions: EstimateHealthMetricsOutput;
      let processed_by: 'GEMINI' | 'AZURE';
      try {
          console.log("Attempting processing with primary architecture (Gemini)...")
          predictions = await processWithGemini(vital, patientProfile);
          processed_by = 'GEMINI';
          console.log("Successfully processed with Gemini.")
      } catch (aiError) {
          console.error("Primary architecture (Gemini) failed. Falling back to secondary (Azure).", aiError);
          try {
            predictions = await processWithAzure(vital, patientProfile);
            processed_by = 'AZURE';
            console.log("Successfully processed with Azure fallback.")
          } catch(fallbackError) {
            console.error("All processing architectures failed.", fallbackError);
            throw new Error("Both Gemini and Azure processing failed.");
          }
      }


      // 4. Evaluate alert conditions based on AI output and fixed thresholds
      const alertMessages: string[] = [];
      let alert_severity: 'Critical' | 'High' = 'High';

      // Check direct vitals against thresholds
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
      
      // Check AI-driven predictions against thresholds
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
      
      // 5. Construct the full health vital record
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

      // 6. Save vitals to GridDB
      await putRows('health_vitals', [healthVitalRow]);
      
      finalHealthVital = healthVitalRecord; // Keep the last processed vital for reporting

      // 7. If alert triggered, save to GridDB and send Telegram notification
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
        
        // Send Telegram alert to Doctor/Clinic
        if (process.env.TELEGRAM_CHAT_ID) {
          await sendCriticalAlert(process.env.TELEGRAM_CHAT_ID, alert_severity, `Patient ${patientProfile.name}: ${alert_message}`);
        }
      }
    }

    // 8. If the request came from Telegram, send the full report back to the patient
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
