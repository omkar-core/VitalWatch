
'use server';

import type { ESP32Data, PatientProfile, EstimateHealthMetricsOutput } from '@/lib/types';
import { estimateHealthMetrics } from '@/ai/flows/suggest-initial-diagnoses';

// Architecture A: Process with Gemini (Primary)
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
        // `recent_vitals` could be added here if we fetch them, but for now it's optional
    };
    return await estimateHealthMetrics(predictionInput);
}

// Architecture B: Process with Azure Function (Secondary/Failover)
async function processWithAzure(vital: ESP32Data): Promise<EstimateHealthMetricsOutput> {
    console.log('Falling back to Azure Function for processing...');
    const azureUrl = process.env.AZURE_FUNCTION_URL;
    const azureKey = process.env.AZURE_FUNCTION_API_KEY;

    if (!azureUrl || !azureKey) {
        throw new Error('Azure Function URL or API Key is not configured for failover.');
    }
    
    // The Azure function might only need the raw vitals.
    // This can be adjusted if it needs more context.
    const requestBody = { ...vital };

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
        confidence_score: predictions.confidence || 0.75, // Use a default confidence if not provided
        reasoning: predictions.reasoning || "Processed by Azure ML service (failover)."
    };
}

/**
 * Processes vital data using a dual-architecture approach with failover.
 * It first tries the primary architecture (Gemini) and falls back to the secondary (Azure) on failure.
 * 
 * @param vital The incoming vital data from the device.
 * @param patientProfile The profile of the patient associated with the device.
 * @returns An object containing the AI predictions and which architecture was used.
 * @throws An error if both processing architectures fail.
 */
export async function processVitals(
    vital: ESP32Data, 
    patientProfile: PatientProfile
): Promise<{ predictions: EstimateHealthMetricsOutput; processed_by: 'GEMINI' | 'AZURE' }> {
    try {
        console.log("Attempting processing with primary architecture (Gemini)...");
        const predictions = await processWithGemini(vital, patientProfile);
        console.log("Successfully processed with Gemini.");
        return { predictions, processed_by: 'GEMINI' };
    } catch (primaryError) {
        console.error("Primary architecture (Gemini) failed. Falling back to secondary (Azure).", primaryError);
        try {
            const predictions = await processWithAzure(vital);
            console.log("Successfully processed with Azure fallback.");
            return { predictions, processed_by: 'AZURE' };
        } catch (secondaryError) {
            console.error("Secondary architecture (Azure) also failed.", secondaryError);
            // If both fail, we throw a final error to be handled by the API route.
            throw new Error("All data processing architectures failed.");
        }
    }
}
