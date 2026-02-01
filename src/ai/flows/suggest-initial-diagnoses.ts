/**
 * @fileOverview This file defines a Genkit flow for estimating health metrics based on physiological signals.
 *
 * - estimateHealthMetrics - A function that takes sensor data and returns estimated health indicators.
 * - EstimateHealthMetricsInput - The input type for the estimateHealthMetrics function.
 * - EstimateHealthMetricsOutput - The output type for the estimateHealthMetrics function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const VitalsSchema = z.object({
  timestamp: z.string().describe('ISO 8601 timestamp of the reading.'),
  heart_rate: z.number().describe('Heart rate in beats per minute (BPM).'),
  spo2: z.number().describe('Blood oxygen saturation percentage (SpO2).'),
  temperature: z.number().optional().describe('Body temperature in Celsius.'),
});

const EstimateHealthMetricsInputSchema = z.object({
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

const EstimateHealthMetricsOutputSchema = z.object({
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

export async function estimateHealthMetrics(
  input: EstimateHealthMetricsInput
): Promise<EstimateHealthMetricsOutput> {
  return estimateHealthMetricsFlow(input);
}

const estimateHealthMetricsPrompt = ai.definePrompt({
  name: 'estimateHealthMetricsPrompt',
  input: {schema: EstimateHealthMetricsInputSchema},
  output: {schema: EstimateHealthMetricsOutputSchema},
  prompt: `You are an expert system that estimates health indicators from physiological signals. Your estimations are based on established medical correlations but are NOT a diagnosis.

  **IMPORTANT:** Do NOT claim to measure blood pressure or glucose directly. You are providing an ESTIMATION based on correlations with PPG data.

  Based on the following data from a PPG sensor and user profile, provide an estimated blood pressure (systolic and diastolic) and an estimated blood glucose level. Analyze the sequence of recent vital signs to identify trends, not just the single latest reading.

  **User Profile:**
  - Age: {{{age}}}
  - Gender: {{{gender}}}
  - Medical History: {{{medical_history}}}

  **Historical Vitals Data (oldest to newest):**
  {{#each recent_vitals}}
  - HR: {{this.heart_rate}}, SpO2: {{this.spo2}} at {{this.timestamp}}
  {{/each}}

  **Current Vitals Data:**
  - Heart Rate: {{{current_vitals.heart_rate}}} BPM
  - SpO2: {{{current_vitals.spo2}}}%
  {{#if current_vitals.temperature}} - Temperature: {{{current_vitals.temperature}}}°C {{/if}}
  - Timestamp: {{{current_vitals.timestamp}}}

  **Analysis Task:**
  1.  **Blood Pressure Estimation:** Based on correlations between heart rate, SpO₂, temperature (if available), and demographic data (age, gender), and considering the trend from historical data, provide a numerical estimation for Systolic and Diastolic blood pressure in mmHg. For example, a consistently high resting heart rate may correlate with higher blood pressure. A 50-year-old male with hypertension and a high heart rate would likely have a higher estimated BP than a healthy 25-year-old female with a normal heart rate.
  2.  **Glucose Estimation:** Based on the inputs and historical trend, infer a potential blood glucose value in mg/dL. Certain patterns in heart rate variability (which you can infer from the provided signals) can be loosely correlated with glycemic changes. A user with diabetes and erratic heart rate patterns might have a higher estimated glucose level.
  3.  **Confidence Score:** Provide an overall confidence score for your estimations from 0.0 to 1.0, where 1.0 is very confident. This score should reflect the inherent limitations of estimating BP and glucose from PPG data. Confidence should be lower for users with sparse data or complex medical histories.
  4.  **Reasoning:** Briefly explain your reasoning for the numerical estimations. For example: "The elevated heart rate and the user's history of hypertension lead to a higher BP estimate. The glucose estimation is based on subtle HR variability changes, and temperature was factored in, if available."

  Generate the response in the required JSON format.
  `,
});

const estimateHealthMetricsFlow = ai.defineFlow(
  {
    name: 'estimateHealthMetricsFlow',
    inputSchema: EstimateHealthMetricsInputSchema,
    outputSchema: EstimateHealthMetricsOutputSchema,
  },
  async input => {
    const {output} = await estimateHealthMetricsPrompt(input);
    return output!;
  }
);
