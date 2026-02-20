'use server';

import type { ESP32Data, PatientProfile, EstimateHealthMetricsOutput } from '@/lib/types';
import { estimateHealthMetrics } from '@/ai/flows/suggest-initial-diagnoses';

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

export async function processWithAzure(vital: ESP32Data): Promise<EstimateHealthMetricsOutput> {
    const azureBaseUrl = process.env.AZURE_FUNCTION_BASE_URL;
    const azurePredictPath = process.env.AZURE_FUNCTION_PREDICT_PATH;
    const azureKey = process.env.AZURE_FUNCTION_KEY;
    const azureTimeout = parseInt(process.env.AZURE_FUNCTION_TIMEOUT_MS || '8000');

    if (!azureBaseUrl || !azurePredictPath || !azureKey) {
        throw new Error('Azure Function configuration is missing.');
    }
    
    const azureUrl = `${azureBaseUrl}${azurePredictPath}`;
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
            body: JSON.stringify(vital),
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Azure processing failed: ${response.status}`);
        }

        const azureResponse = await response.json();
        const predictions = azureResponse.predictions;
        
        if (!predictions) {
            throw new Error('Azure response missing predictions.');
        }

        return {
            estimated_systolic: predictions.bp_systolic || 120,
            estimated_diastolic: predictions.bp_diastolic || 80,
            estimated_glucose: predictions.glucose || 100,
            confidence_score: azureResponse.confidence || 0.75,
            reasoning: azureResponse.reasoning || "Processed via Azure ML."
        };
    } catch (error: any) {
        clearTimeout(timeoutId);
        throw error;
    }
}
