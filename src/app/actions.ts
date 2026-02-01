
"use server";

import type { HealthVital, PatientProfile, AlertHistory, ESP32Data } from '@/lib/types';
import { sendTelegramMessage, sendPreparationMessage, sendProgressUpdate } from "@/lib/telegram";
import { getHealthChatResponse as getHealthChatResponseFlow } from '@/ai/flows/health-chat';
import { generateTrendAnalysis as generateTrendAnalysisFlow, type GenerateTrendAnalysisInput } from '@/ai/flows/generate-trend-analysis';


type ActionResult<T> = {
    data?: T;
    error?: string;
}

// This is the action called by the patient dashboard "Scan Vitals" button
export async function ingestVitalsAction(vitals: ESP32Data[]): Promise<ActionResult<{ message: string, vital: HealthVital | null }>> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/vitals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        vitals,
        // This secret bypasses the device-specific auth check for internal, server-side calls
        internal_secret: process.env.INTERNAL_API_SECRET 
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(errorBody.error || 'Failed to ingest vitals data.');
    }

    const result = await response.json();
    return { data: result };

  } catch (e: any) {
    console.error("Error in ingestVitalsAction:", e);
    return { error: e.message || 'An unknown error occurred during the vitals ingestion process.' };
  }
}

// This is the action called by the Telegram bot
export async function triggerVitalsScanFromTelegram(chatId: string, patientId: string): Promise<ActionResult<string>> {
  try {
     // 1. Send preparation instructions
    await sendPreparationMessage(chatId);
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay

    // 2. Simulate multi-phase scan with progress updates
    await sendProgressUpdate(chatId, "Contact Check", 25, "Checking for wrist contact...");
    await new Promise(resolve => setTimeout(resolve, 2000));

    await sendProgressUpdate(chatId, "Stabilization", 50, "Calibrating sensor...");
    await new Promise(resolve => setTimeout(resolve, 2000));

    await sendProgressUpdate(chatId, "Data Acquisition", 75, "Reading PPG signal...");
    await new Promise(resolve => setTimeout(resolve, 2000));

    await sendProgressUpdate(chatId, "Signal Processing", 100, "Measurement complete. Analyzing data...");
    
    // 3. Generate mock data and call the ingest API
    const mockESP32Data: ESP32Data[] = [{
      device_id: patientId, // For the demo, patientId is used as deviceId
      timestamp: new Date().toISOString(),
      heart_rate: 70 + Math.random() * 15,
      spo2: 96 + Math.random() * 3,
      temperature: 36.5 + Math.random(),
      ppg_raw: 1000 + Math.random() * 200,
    }];
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/vitals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Pass both vitals and chatId to the ingest API for reporting
      body: JSON.stringify({ 
        vitals: mockESP32Data, 
        chatId,
        // This secret bypasses the device-specific auth check for internal, server-side calls
        internal_secret: process.env.INTERNAL_API_SECRET
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(errorBody.error || 'Failed to ingest vitals data.');
    }

    const result = await response.json();
    // The final report is sent by the ingest API, so we just return success here.
    return { data: result.message };

  } catch (e: any) {
     console.error("Error in triggerVitalsScanFromTelegram:", e);
    await sendTelegramMessage({ chatId, text: `❌ *Error:* ${e.message || 'An unknown error occurred.'}` });
    return { error: e.message || 'An unknown error occurred.' };
  }
}

export async function getHealthChatResponse(
  question: string,
  vitalsContext: string
): Promise<ActionResult<string>> {
  try {
    const result = await getHealthChatResponseFlow({ question, vitalsContext });
    return { data: result.answer };
  } catch (e: any) {
    console.error("Error in getHealthChatResponse:", e);
    return { error: e.message || 'The AI assistant is currently unavailable.' };
  }
}

export async function generateTrendAnalysis(input: GenerateTrendAnalysisInput): Promise<ActionResult<string>> {
    try {
        const result = await generateTrendAnalysisFlow(input);
        return { data: result.analysis };
    } catch(e: any) {
        console.error("Error in generateTrendAnalysis:", e);
        return { error: e.message || 'The AI assistant is currently unavailable.' };
    }
}
