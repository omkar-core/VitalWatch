'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, HeartCrack, Activity, Droplets, HeartPulse, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import useSWR from 'swr';
import type { AlertHistory, PatientProfile } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then(res => res.json());

type PopulationStats = {
  total_patients: number;
  condition_counts: {
    diabetes: number;
    hypertension: number;
    heart_condition: number;
  };
  average_vitals: {
    heart_rate: number;
    spo2: number;
    bp_systolic: number;
    bp_diastolic: number;
    glucose: number;
  };
  total_readings: number;
}

export default function DoctorAnalyticsPage() {
  const { data: patients, isLoading: patientsLoading } = useSWR<PatientProfile[]>('/api/patients', fetcher);
  const { data: alerts, isLoading: alertsLoading } = useSWR<AlertHistory[]>('/api/alerts', fetcher);
  const { data: populationStats, isLoading: statsLoading } = useSWR<PopulationStats>('/api/statistics/population', fetcher);

  const loading = patientsLoading || alertsLoading || statsLoading;

  const getStatus = (patientId: string) => {
    const patientAlerts = Array.isArray(alerts) ? alerts.filter(a => a.patient_id === patientId) : [];
    if (patientAlerts.length === 0) return 'Stable';
    if (patientAlerts.some(a => a.severity === 'Critical')) return 'Critical';
    if (patientAlerts.some(a => a.severity === 'High')) return 'Needs Review';
    return 'Stable';
  };
  
  const patientsArray = Array.isArray(patients) ? patients : [];

  const riskDistribution = {
    stable: patientsArray.filter(p => getStatus(p.patient_id) === 'Stable').length,
    needsReview: patientsArray.filter(p => getStatus(p.patient_id) === 'Needs Review').length,
    critical: patientsArray.filter(p => getStatus(p.patient_id) === 'Critical').length,
  };

  const totalPatients = populationStats?.total_patients || 1; 

  const stablePercent = Math.round((riskDistribution.stable / totalPatients) * 100);
  const needsReviewPercent = Math.round((riskDistribution.needsReview / totalPatients) * 100);
  const criticalPercent = Math.round((riskDistribution.critical / totalPatients) * 100);


  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl font-headline">Analytics & Population Health</h1>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users /> Patient Risk Distribution</CardTitle>
            <CardDescription>Based on current active alerts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             {loading ? <Skeleton className="h-48 w-full"/> : (
                <div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center"><span className="text-sm">Stable</span><span className="text-sm font-bold">{riskDistribution.stable} ({stablePercent}%)</span></div>
                    <div className="w-full bg-muted rounded-full h-2.5">
                      <div className="bg-green-500 h-2.5 rounded-full" style={{width: `${stablePercent}%`}}></div>
                    </div>
                  </div>
                  <div className="space-y-1 mt-2">
                    <div className="flex justify-between items-center"><span className="text-sm">Needs Review</span><span className="text-sm font-bold">{riskDistribution.needsReview} ({needsReviewPercent}%)</span></div>
                    <div className="w-full bg-muted rounded-full h-2.5">
                      <div className="bg-yellow-500 h-2.5 rounded-full" style={{width: `${needsReviewPercent}%`}}></div>
                    </div>
                  </div>
                  <div className="space-y-1 mt-2">
                    <div className="flex justify-between items-center"><span className="text-sm">Critical</span><span className="text-sm font-bold">{riskDistribution.critical} ({criticalPercent}%)</span></div>
                    <div className="w-full bg-muted rounded-full h-2.5">
                      <div className="bg-red-500 h-2.5 rounded-full" style={{width: `${criticalPercent}%`}}></div>
                    </div>
                  </div>
                </div>
             )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><HeartCrack/> Condition Prevalence</CardTitle>
                <CardDescription>Distribution of chronic conditions.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-48 w-full"/> : populationStats && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="font-medium">Hypertension</span>
                            <span className="font-bold">{populationStats.condition_counts.hypertension} <span className="text-muted-foreground">({Math.round((populationStats.condition_counts.hypertension / totalPatients) * 100)}%)</span></span>
                        </div>
                         <div className="flex items-center justify-between">
                            <span className="font-medium">Diabetes</span>
                            <span className="font-bold">{populationStats.condition_counts.diabetes} <span className="text-muted-foreground">({Math.round((populationStats.condition_counts.diabetes / totalPatients) * 100)}%)</span></span>
                        </div>
                         <div className="flex items-center justify-between">
                            <span className="font-medium">Heart Condition</span>
                            <span className="font-bold">{populationStats.condition_counts.heart_condition} <span className="text-muted-foreground">({Math.round((populationStats.condition_counts.heart_condition / totalPatients) * 100)}%)</span></span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>

        <Card className="lg:col-span-1">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Activity/> Population Vitals (Avg)</CardTitle>
                <CardDescription>Average across all patient readings.</CardDescription>
            </CardHeader>
            <CardContent>
                 {loading ? <Skeleton className="h-48 w-full"/> : populationStats && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="font-medium flex items-center gap-2"><HeartPulse/> Blood Pressure</span>
                            <span className="font-bold">{populationStats.average_vitals.bp_systolic}/{populationStats.average_vitals.bp_diastolic} <span className="text-muted-foreground text-sm">mmHg</span></span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="font-medium flex items-center gap-2"><Droplets/> Glucose</span>
                            <span className="font-bold">{populationStats.average_vitals.glucose} <span className="text-muted-foreground text-sm">mg/dL</span></span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="font-medium flex items-center gap-2"><Activity/> Heart Rate</span>
                            <span className="font-bold">{populationStats.average_vitals.heart_rate} <span className="text-muted-foreground text-sm">bpm</span></span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>
    </main>
  );
}
