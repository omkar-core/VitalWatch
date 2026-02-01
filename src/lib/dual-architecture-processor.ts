
'use server';

import type { ESP32Data, PatientProfile, EstimateHealthMetricsOutput } from '@/lib/types';
import { estimateHealthMetrics } from '@/ai/flows/suggest-initial-diagnoses';

// Architecture A: Process with Gemini (Primary)
export async function processWithGemini(vital: ESP32Data, patientProfile: PatientProfile): Promise<EstimateHealthMetricsOutput> {
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

// Architecture B: Process with Azure Function (Secondary/Failover)
export async function processWithAzure(vital: ESP32Data): Promise<EstimateHealthMetricsOutput> {
    console.log('Processing with Azure Function...');
    
    const azureBaseUrl = process.env.AZURE_FUNCTION_BASE_URL;
    const azurePredictPath = process.env.AZURE_FUNCTION_PREDICT_PATH;
    const azureKey = process.env.AZURE_FUNCTION_KEY;
    const azureTimeout = parseInt(process.env.AZURE_FUNCTION_TIMEOUT_MS || '8000');

    if (!azureBaseUrl || !azurePredictPath || !azureKey) {
        throw new Error('Azure Function URL, path, or API Key is not configured for failover.');
    }
    
    const azureUrl = `${azureBaseUrl}${azurePredictPath}`;
    const requestBody = { ...vital };
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), azureTimeout);

    try {
        const response = await fetch(azureUrl, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                'x-functions-key': azureKey,
            },
            body: JSON.stringify(requestBody),
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Azure Function returned an error:', response.status, errorText);
            throw new Error(`Azure Function processing failed with status: ${response.status}`);
        }

        const predictions = await response.json();

        return {
            estimated_systolic: predictions.systolic || 120,
            estimated_diastolic: predictions.diastolic || 80,
            estimated_glucose: predictions.glucose || 100,
            confidence_score: predictions.confidence || 0.75,
            reasoning: predictions.reasoning || "Processed by Azure ML service."
        };
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
             throw new Error(`Azure Function request timed out after ${azureTimeout}ms.`);
        }
        throw error;
    }
}
