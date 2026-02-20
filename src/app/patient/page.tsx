'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { HeartPulse, Droplets, Wind, Wifi, Bot, Loader2, Info, Activity, BarChartHorizontal, Waves, Thermometer } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { ingestVitalsAction } from '@/app/actions';
import type { HealthVital, PatientProfile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useUser } from '@/firebase/auth/use-user';
import useSWR from 'swr';
import { VitalsChart } from '@/components/dashboard/vitals-chart';
import { WaveformChart } from '@/components/dashboard/waveform-chart';
import { format, subMinutes } from 'date-fns';
import { useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

// Helper for status colors
const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
        case 'critical':
        case 'stage 2 hypertension':
        case 'risky':
        case 'high':
            return 'text-destructive';
        case 'elevated':
        case 'stage 1 hypertension':
            return 'text-yellow-600';
        case 'normal':
            return 'text-green-600';
        default:
            return 'text-muted-foreground';
    }
};

// Mock data generator for fallback
const getMockVitals = (): HealthVital[] => {
    const now = new Date();
    return Array.from({ length: 20 }).map((_, i) => ({
        timestamp: subMinutes(now, (20 - i) * 15).toISOString(),
        device_id: 'demo-device',
        heart_rate: 70 + Math.random() * 10,
        spo2: 97 + Math.random() * 2,
        temperature: 36.5 + Math.random(),
        ppg_raw: 1500 + Math.random() * 200,
        predicted_bp_systolic: 115 + Math.random() * 15,
        predicted_bp_diastolic: 75 + Math.random() * 10,
        predicted_glucose: 90 + Math.random() * 30,
        alert_flag: false,
        created_at: new Date().toISOString(),
        confidence_score: 0.85,
        processed_by: 'GEMINI'
    }));
};

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) return null;
  return res.json();
});

export default function PatientPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const [scanStatus, setScanStatus] = React.useState<'idle' | 'pending' | 'processing'>('idle');

  const { data: patientData, isLoading: patientLoading } = useSWR<PatientProfile | null>(user ? `/api/patients/${user.uid}` : null, fetcher);
  const { data: vitalsHistory, isLoading: historyLoading, mutate: mutateHistory } = useSWR<HealthVital[] | null>(patientData?.device_id ? `/api/vitals/history/${patientData.device_id}` : null, fetcher, { refreshInterval: 5000 });

  const isDemo = !vitalsHistory || vitalsHistory.length === 0;
  const displayVitals = isDemo ? getMockVitals() : vitalsHistory;
  const latestVital = displayVitals[displayVitals.length - 1];

  React.useEffect(() => {
    if (!firestore || !user) return;
    const scanDocRef = doc(firestore, 'scan_requests', user.uid);
    const unsubscribe = onSnapshot(scanDocRef, (doc) => {
      const data = doc.data();
      if (data?.status) setScanStatus(data.status);
    }, async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: scanDocRef.path, operation: 'get' }));
    });
    return () => unsubscribe();
  }, [firestore, user]);

  const chartData = React.useMemo(() => 
    displayVitals.slice(-20).map(v => ({ ...v, time: format(new Date(v.timestamp), 'p') })), 
    [displayVitals]
  );

  const handleRequestScan = async () => {
    if (scanStatus !== 'idle' || !patientData?.device_id || !firestore || !user) return;
    
    setScanStatus('pending');
    toast({ title: 'Scan Requested', description: 'Waiting for device response...' });

    const scanDocRef = doc(firestore, 'scan_requests', user.uid);
    setDoc(scanDocRef, { status: 'pending', requestedAt: serverTimestamp() }).catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: scanDocRef.path, operation: 'write' }));
    });

    setTimeout(() => simulateDeviceResponse(patientData.device_id), 4000);
  };

  const simulateDeviceResponse = async (deviceId: string) => {
    if (!user || !firestore) return;
    setScanStatus('processing');
    const scanDocRef = doc(firestore, 'scan_requests', user.uid);
    setDoc(scanDocRef, { status: 'processing' }, { merge: true });

    const mockReading = [{
      device_id: deviceId,
      timestamp: new Date().toISOString(),
      heart_rate: 72 + Math.random() * 5,
      spo2: 98,
      temperature: 36.8,
      ppg_raw: 1600,
    }];
    
    const result = await ingestVitalsAction(mockReading);

    if (result.error || !result.data?.vital) {
        toast({ variant: 'destructive', title: 'Scan Failed', description: "Real-time communication interrupted." });
        setDoc(scanDocRef, { status: 'idle' }, { merge: true });
    } else {
        mutateHistory([...(vitalsHistory || []), result.data.vital], { revalidate: false });
        toast({ title: 'Scan Complete', description: 'New health metrics recorded.' });
        setDoc(scanDocRef, { status: 'idle', completedAt: serverTimestamp() }, { merge: true });
    }
  };

  const bp = {
      systolic: latestVital.predicted_bp_systolic || 120,
      diastolic: latestVital.predicted_bp_diastolic || 80,
      stage: (latestVital.predicted_bp_systolic || 0) >= 140 ? 'Stage 2 Hypertension' : (latestVital.predicted_bp_systolic || 0) >= 130 ? 'Stage 1 Hypertension' : 'Normal'
  };
  
  const glucose = {
      value: latestVital.predicted_glucose || 100,
      status: (latestVital.predicted_glucose || 0) > 140 ? 'High' : 'Normal'
  };

  const scanButtonContent = {
    pending: { icon: <Loader2 className="animate-spin" />, title: 'Waiting...', description: 'Syncing device...' },
    processing: { icon: <Loader2 className="animate-spin" />, title: 'Measuring...', description: 'Acquiring PPG signal...' },
    idle: { icon: <Wifi />, title: 'Scan Vitals Now', description: 'Tap for real-time analysis' }
  }[scanStatus];

  if (patientLoading) return <div className="p-4 space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="p-4 space-y-4">
        {isDemo && (
            <Alert className="bg-primary/10 border-primary/20">
                <Info className="h-4 w-4 text-primary" />
                <AlertTitle>Viewing Demo Dashboard</AlertTitle>
                <AlertDescription>No device connected. Showing historical trend simulation.</AlertDescription>
            </Alert>
        )}

        <Card onClick={handleRequestScan} className={cn("bg-primary text-primary-foreground border-0 transition-all shadow-md", scanStatus !== 'idle' ? 'opacity-80' : 'cursor-pointer hover:scale-[1.01] active:scale-95')}>
            <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl">{scanButtonContent.icon}</div>
                <div>
                    <h2 className="font-bold text-lg">{scanButtonContent.title}</h2>
                    <p className="text-sm opacity-80">{scanButtonContent.description}</p>
                </div>
            </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-wider"><Bot className="w-4 h-4"/> AI Predictions</CardTitle>
                </CardHeader>
                <CardContent className='grid grid-cols-2 gap-3'>
                    <div className='p-3 rounded-xl bg-card border'>
                        <h3 className="text-[10px] font-bold text-muted-foreground mb-1 uppercase">Blood Pressure</h3>
                        <p className="text-2xl font-bold">{bp.systolic.toFixed(0)}<span className='text-muted-foreground'>/</span>{bp.diastolic.toFixed(0)}</p>
                        <p className={cn("text-[10px] font-bold", getStatusColor(bp.stage))}>{bp.stage}</p>
                    </div>
                    <div className='p-3 rounded-xl bg-card border'>
                        <h3 className="text-[10px] font-bold text-muted-foreground mb-1 uppercase">Glucose</h3>
                        <p className="text-2xl font-bold">{glucose.value.toFixed(0)}<span className="text-xs text-muted-foreground ml-1">mg/dL</span></p>
                        <p className={cn("text-[10px] font-bold", getStatusColor(glucose.status))}>{glucose.status}</p>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
                <Card className="flex flex-col justify-center p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase"><Activity className="w-4 h-4"/> HR</div>
                    <p className="text-2xl font-bold mt-1">{latestVital.heart_rate.toFixed(0)} <span className="text-xs font-normal">bpm</span></p>
                </Card>
                <Card className="flex flex-col justify-center p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase"><Wind className="w-4 h-4"/> SpO₂</div>
                    <p className="text-2xl font-bold mt-1">{latestVital.spo2.toFixed(1)} <span className="text-xs font-normal">%</span></p>
                </Card>
            </div>
        </div>

        <Card>
            <CardHeader className="py-4 px-6">
                <CardTitle className="flex items-center gap-2 text-sm font-bold"><Waves className="w-4 h-4 text-primary" /> PPG Signal Quality</CardTitle>
            </CardHeader>
            <CardContent className="px-2">
                <WaveformChart data={chartData} dataKey="ppg_raw" color="hsl(var(--primary))" gradientColor="hsl(var(--primary))" />
            </CardContent>
        </Card>

        <Card>
            <CardHeader className="py-4 px-6">
                <CardTitle className="flex items-center gap-2 text-sm font-bold"><BarChartHorizontal className="w-4 h-4 text-primary" /> Vital Trends</CardTitle>
            </CardHeader>
            <CardContent className="px-2">
                <VitalsChart data={chartData} dataKey1="heart_rate" label1="HR" color1="hsl(var(--chart-2))" dataKey2="spo2" label2="SpO₂" color2="hsl(var(--chart-1))" />
            </CardContent>
        </Card>
    </div>
  );
}
