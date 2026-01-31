import { NextRequest, NextResponse } from 'next/server';
import { getRows } from '@/lib/griddb-client';
import type { HealthVital } from '@/lib/types';

export async function GET(
  request: NextRequest
) {
  const patientId = request.nextUrl.pathname.split('/')[3];

  if (!patientId) {
    return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
  }

  try {
    const vitalsResults = await getRows('health_vitals', `patient_id='${patientId}'`);

    if (!vitalsResults.results || vitalsResults.results.length === 0) {
      return NextResponse.json({
        reading_count: 0,
        temperature: { avg: 0, max: 0, min: 0 },
        spo2: { avg: 0, max: 0, min: 0 },
        heart_rate: { avg: 0, max: 0, min: 0 },
        predicted_glucose: { avg: 0, max: 0, min: 0 },
        predicted_bp_systolic: { avg: 0, max: 0, min: 0 },
        predicted_bp_diastolic: { avg: 0, max: 0, min: 0 },
      });
    }

    const columns = vitalsResults.columns;
    const vitals: HealthVital[] = vitalsResults.results.map((row: any[]) => {
      return columns.reduce((obj: any, col: any, index: number) => {
        obj[col.name] = row[index];
        return obj;
      }, {}) as HealthVital;
    });

    const stats = {
      reading_count: vitals.length,
      temperature: { avg: 0, max: -Infinity, min: Infinity },
      spo2: { avg: 0, max: -Infinity, min: Infinity },
      heart_rate: { avg: 0, max: -Infinity, min: Infinity },
      predicted_glucose: { avg: 0, max: -Infinity, min: Infinity },
      predicted_bp_systolic: { avg: 0, max: -Infinity, min: Infinity },
      predicted_bp_diastolic: { avg: 0, max: -Infinity, min: Infinity },
    };

    let tempSum = 0, spo2Sum = 0, hrSum = 0, glucSum = 0, sysSum = 0, diaSum = 0;
    
    vitals.forEach(v => {
        tempSum += v.temperature;
        stats.temperature.max = Math.max(stats.temperature.max, v.temperature);
        stats.temperature.min = Math.min(stats.temperature.min, v.temperature);

        spo2Sum += v.spo2;
        stats.spo2.max = Math.max(stats.spo2.max, v.spo2);
        stats.spo2.min = Math.min(stats.spo2.min, v.spo2);

        hrSum += v.heart_rate;
        stats.heart_rate.max = Math.max(stats.heart_rate.max, v.heart_rate);
        stats.heart_rate.min = Math.min(stats.heart_rate.min, v.heart_rate);
        
        const glucose = v.predicted_glucose || 0;
        glucSum += glucose;
        stats.predicted_glucose.max = Math.max(stats.predicted_glucose.max, glucose);
        stats.predicted_glucose.min = Math.min(stats.predicted_glucose.min, glucose);
        
        const systolic = v.predicted_bp_systolic || 0;
        sysSum += systolic;
        stats.predicted_bp_systolic.max = Math.max(stats.predicted_bp_systolic.max, systolic);
        stats.predicted_bp_systolic.min = Math.min(stats.predicted_bp_systolic.min, systolic);

        const diastolic = v.predicted_bp_diastolic || 0;
        diaSum += diastolic;
        stats.predicted_bp_diastolic.max = Math.max(stats.predicted_bp_diastolic.max, diastolic);
        stats.predicted_bp_diastolic.min = Math.min(stats.predicted_bp_diastolic.min, diastolic);
    });

    stats.temperature.avg = parseFloat((tempSum / vitals.length).toFixed(1));
    stats.spo2.avg = parseFloat((spo2Sum / vitals.length).toFixed(1));
    stats.heart_rate.avg = Math.round(hrSum / vitals.length);
    stats.predicted_glucose.avg = Math.round(glucSum / vitals.length);
    stats.predicted_bp_systolic.avg = Math.round(sysSum / vitals.length);
    stats.predicted_bp_diastolic.avg = Math.round(diaSum / vitals.length);

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error(`[/api/patients/${patientId}/statistics] Error:`, error);
    return NextResponse.json({ error: error.message || 'An internal server error occurred.' }, { status: 500 });
  }
}
