import { NextResponse } from 'next/server';
import { getRows } from '@/lib/griddb-client';
import type { HealthVital, PatientProfile } from '@/lib/types';

export async function GET() {
  try {
    const [patientProfilesResults, vitalsResults] = await Promise.all([
      getRows('patient_profiles', '1=1'),
      getRows('health_vitals', '1=1')
    ]);
    
    // --- Patient Stats ---
    const patientColumns = patientProfilesResults.columns || [];
    const patients: PatientProfile[] = (patientProfilesResults.results || []).map((row: any[]) => {
       return patientColumns.reduce((obj: any, col: any, index: number) => {
        obj[col.name] = row[index];
        return obj;
      }, {}) as PatientProfile;
    });

    const totalPatients = patients.length;
    const conditionCounts = {
      diabetes: patients.filter(p => p.has_diabetes).length,
      hypertension: patients.filter(p => p.has_hypertension).length,
      heart_condition: patients.filter(p => p.has_heart_condition).length,
    };

    // --- Vitals Stats ---
    const vitalColumns = vitalsResults.columns || [];
    const vitals: HealthVital[] = (vitalsResults.results || []).map((row: any[]) => {
      return vitalColumns.reduce((obj: any, col: any, index: number) => {
        obj[col.name] = row[index];
        return obj;
      }, {}) as HealthVital;
    });

    const totalReadings = vitals.length;
    let hrSum = 0, spo2Sum = 0, sysSum = 0, diaSum = 0, glucSum = 0;

    vitals.forEach(v => {
      hrSum += v.heart_rate || 0;
      spo2Sum += v.spo2 || 0;
      sysSum += v.predicted_bp_systolic || 0;
      diaSum += v.predicted_bp_diastolic || 0;
      glucSum += v.predicted_glucose || 0;
    });

    const averageVitals = {
      heart_rate: totalReadings > 0 ? Math.round(hrSum / totalReadings) : 0,
      spo2: totalReadings > 0 ? parseFloat((spo2Sum / totalReadings).toFixed(1)) : 0,
      bp_systolic: totalReadings > 0 ? Math.round(sysSum / totalReadings) : 0,
      bp_diastolic: totalReadings > 0 ? Math.round(diaSum / totalReadings) : 0,
      glucose: totalReadings > 0 ? Math.round(glucSum / totalReadings) : 0,
    };

    return NextResponse.json({
      total_patients: totalPatients,
      condition_counts: conditionCounts,
      average_vitals: averageVitals,
      total_readings: totalReadings
    });

  } catch (error: any) {
    console.error('[/api/statistics/population] Error:', error);
    return NextResponse.json({ error: error.message || 'An internal server error occurred.' }, { status: 500 });
  }
}
