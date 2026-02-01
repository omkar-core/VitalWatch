'use server';

import type { ESP32Data, PatientProfile, EstimateHealthMetricsOutput } from '@/lib/types';
import { processWithGemini, processWithAzure } from './dual-architecture-processor';

type ProcessedVitals = {
    predictions: EstimateHealthMetricsOutput;
    processed_by: 'GEMINI' | 'AZURE'
};

/**
 * Intelligently routes vital sign processing to the appropriate backend architecture
 * based on environment configuration. It supports a primary backend with seamless
 * failover to a secondary backend.
 *
 * @param vital The incoming vital data from the device.
 * @param patientProfile The profile of the patient associated with the device.
 * @returns An object containing the AI predictions and which architecture was used.
 * @throws An error if all enabled processing architectures fail.
 */
export async function routeVitalsProcessing(
    vital: ESP32Data,
    patientProfile: PatientProfile
): Promise<ProcessedVitals> {

    // Reading control flags from environment variables
    const primaryBackend = process.env.PRIMARY_BACKEND || 'NON_AZURE'; // Default to NON_AZURE
    const isFailoverEnabled = process.env.BACKEND_FAILOVER_ENABLED === 'true';
    const isNonAzureEnabled = process.env.ENABLE_NON_AZURE_BACKEND === 'true';
    const isAzureEnabled = process.env.ENABLE_AZURE_BACKEND === 'true';

    const primaryFn = primaryBackend === 'AZURE' ? processWithAzure : processWithGemini;
    const secondaryFn = primaryBackend === 'AZURE' ? processWithGemini : processWithAzure;

    const primaryName = primaryBackend === 'AZURE' ? 'AZURE' : 'GEMINI';
    const secondaryName = primaryBackend === 'AZURE' ? 'GEMINI' : 'AZURE';

    const isPrimaryEnabled = primaryName === 'AZURE' ? isAzureEnabled : isNonAzureEnabled;
    const isSecondaryEnabled = secondaryName === 'AZURE' ? isAzureEnabled : isNonAzureEnabled;

    // --- Primary Attempt ---
    if (isPrimaryEnabled) {
        try {
            console.log(`Attempting processing with primary architecture (${primaryName})...`);
            const predictions = await primaryFn(vital, patientProfile);
            console.log(`Successfully processed with ${primaryName}.`);
            return { predictions, processed_by: primaryName };
        } catch (primaryError) {
            console.error(`Primary architecture (${primaryName}) failed.`, primaryError);
            if (!isFailoverEnabled) {
                throw primaryError;
            }
        }
    } else {
        console.warn(`Primary backend (${primaryName}) is disabled via environment variables.`);
    }

    // --- Failover / Secondary Attempt ---
    if (isFailoverEnabled && isSecondaryEnabled) {
        try {
            console.log(`Falling back to secondary architecture (${secondaryName})...`);
            const predictions = await secondaryFn(vital, patientProfile);
            console.log(`Successfully processed with secondary architecture ${secondaryName}.`);
            return { predictions, processed_by: secondaryName };
        } catch (secondaryError) {
            console.error(`Secondary architecture (${secondaryName}) also failed.`, secondaryError);
            throw secondaryError;
        }
    } else if (isFailoverEnabled && !isSecondaryEnabled) {
        console.error(`Failover is enabled, but the secondary backend (${secondaryName}) is disabled. Cannot proceed.`);
    }

    throw new Error("All available data processing architectures failed or were disabled.");
}
