import { NextResponse } from 'next/server';
import { getRows, putRows } from '@/lib/griddb-client';
import { PatientProfile } from '@/lib/types';

export async function GET() {
  try {
    const patientProfilesResults = await getRows('patient_profiles', '1=1'); // Get all
    
    if (!patientProfilesResults.results || patientProfilesResults.results.length === 0) {
      return NextResponse.json([]);
    }

    const columns = patientProfilesResults.columns;
    const profiles = patientProfilesResults.results.map((row: any[]) => {
       return columns.reduce((obj: any, col: any, index: number) => {
        obj[col.name] = row[index];
        return obj;
      }, {});
    });

    return NextResponse.json(profiles);
  } catch (error: any) {
    console.error('[/api/patients] Error:', error);
    return NextResponse.json({ error: error.message || 'An internal server error occurred.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
    try {
        const profile: PatientProfile = await request.json();

        // GridDB expects an array of arrays for rows. Order is critical.
        const profileRow = [
            profile.patient_id,
            profile.device_id,
            profile.name || null,
            profile.age || null,
            profile.gender || null,
            profile.email || null,
            profile.phone || null,
            profile.avatar_url || null,
            profile.baseline_hr || null,
            profile.baseline_spo2 || null,
            profile.baseline_bp_systolic || null,
            profile.baseline_bp_diastolic || null,
            profile.has_diabetes === true,
            profile.has_hypertension === true,
            profile.has_heart_condition === true,
            profile.alert_threshold_hr_high || null,
            profile.alert_threshold_hr_low || null,
            profile.alert_threshold_spo2_low || null,
            profile.alert_threshold_bp_systolic_high || null,
            profile.alert_threshold_glucose_high || null,
            profile.alert_threshold_temp_high || null,
            profile.alert_threshold_temp_low || null,
            profile.emergency_contact_name || null,
            profile.emergency_contact_phone || null,
            profile.created_at,
            profile.updated_at,
            profile.is_active === true
        ];

        await putRows('patient_profiles', [profileRow]);

        return NextResponse.json({ message: "Patient registered successfully", patientId: profile.patient_id }, { status: 201 });

    } catch (error: any) {
        console.error('[/api/patients] POST Error:', error);
        return NextResponse.json({ error: error.message || 'An internal server error occurred.' }, { status: 500 });
    }
}
