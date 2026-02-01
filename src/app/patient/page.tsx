'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { HeartPulse, Droplets, Wind, Wifi, Bot, Loader2, Info, Activity, BarChartHorizontal, Waves, Thermometer, CheckCircle, Hourglass } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { ingestVitalsAction } from '@/app/actions';
import type { HealthVital, PatientProfile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useUser } from '@/firebase/auth/use-user';
import useSWR from 'swr';
import { VitalsChart } from '@/components/dashboard/vitals-chart';
import { WaveformChart } from '@/components/dashboard/waveform-chart';
import { format } from 'date-fns';
import { useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';

// Helper function to get status colors
const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
        case 'critical':
        case 'stage 2 hypertension':
        case 'risky':
        case 'high': // For glucose
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

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    if (res.status === 404) return null; // Handle not found gracefully
    const error = new Error('An error occurred while fetching the data.');
    (error as any).status = res.status;
    throw error;
  }
  return res.json()
});


export default function PatientPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const [scanStatus, setScanStatus] = React.useState<'idle' | 'pending' | 'processing'>('idle');

  const swrOptions = {
    refreshInterval: 5000, // Poll every 5 seconds
    errorRetryInterval: 2000,
    errorRetryCount: 5,
  };

  const { data: patientData, isLoading: patientLoading } = useSWR<PatientProfile>(user ? `/api/patients/${user.uid}` : null, fetcher, { ...swrOptions, refreshInterval: 60000 });
  
  const { data: vitalsHistory, isLoading: historyLoading } = useSWR<HealthVital[]>(patientData?.device_id ? `/api/vitals/history/${patientData.device_id}` : null, fetcher, swrOptions);

  const patient: PatientProfile | null = patientData || null;
  const latestVital: HealthVital | null = vitalsHistory && vitalsHistory.length > 0 ? vitalsHistory[vitalsHistory.length - 1] : null;

  // Listen to scan request status from Firestore
   React.useEffect(() => {
    if (!firestore || !user) return;
    const scanDocRef = doc(firestore, 'scan_requests', user.uid);
    const unsubscribe = onSnapshot(scanDocRef, (doc) => {
      const data = doc.data();
      if (data?.status) {
        setScanStatus(data.status);
      }
    });
    return () => unsubscribe();
  }, [firestore, user]);


  const chartData = React.useMemo(() => 
    vitalsHistory
        ?.slice(-20)
        .map(v => ({
            ...v,
            time: format(new Date(v.timestamp), 'p')
        })) || [], 
    [vitalsHistory]
  );

  const handleRequestScan = async () => {
    if (scanStatus !== 'idle' || !patient?.device_id || !firestore || !user) return;
    
    setScanStatus('pending');
    toast({
        title: 'Scan Requested...',
        description: `Waiting for device to respond. This may take a moment.`,
        icon: <Hourglass className="h-6 w-6 text-primary"/>
    });

    const scanDocRef = doc(firestore, 'scan_requests', user.uid);
    await setDoc(scanDocRef, {
      status: 'pending',
      requestedAt: serverTimestamp()
    });

    // --- REAL-WORLD vs SIMULATION ---
    // In a real system, the ESP32 device would be polling the `scan_requests` collection.
    // It would see the 'pending' status, start a scan, upload the data via `/api/vitals`,
    // and then update the Firestore doc to 'completed'.
    //
    // For this demo, we simulate this device behavior with a delay.
    setTimeout(() => {
      simulateDeviceResponse(patient.device_id);
    }, 5000); // 5-second delay to simulate polling and scanning
  };

  const simulateDeviceResponse = async (deviceId: string) => {
    if (!user || !firestore) return;

    setScanStatus('processing');
    const scanDocRef = doc(firestore, 'scan_requests', user.uid);
    await setDoc(scanDocRef, { status: 'processing' }, { merge: true });

    // 1. Simulate generating data
    const mockESP32Data = [{
      device_id: deviceId,
      timestamp: new Date().toISOString(),
      heart_rate: 70 + Math.random() * 15,
      spo2: 96 + Math.random() * 3,
      temperature: 36.5 + Math.random(),
      ppg_raw: 1000 + Math.random() * 200,
    }];
    
    // 2. Simulate uploading data
    const result = await ingestVitalsAction(mockESP32Data);

    // 3. Simulate updating status on completion
    if (result.error) {
       toast({
            variant: 'destructive',
            title: 'Scan Failed!',
            description: result.error,
        });
        await setDoc(scanDocRef, { status: 'idle' }, { merge: true });
    } else {
        toast({
            title: 'Scan Complete!',
            description: `Your latest vitals have been recorded and analyzed.`,
            icon: <CheckCircle className="h-6 w-6 text-green-500"/>
        });
        await setDoc(scanDocRef, { status: 'idle', completedAt: serverTimestamp() }, { merge: true });
    }
  }


  const bp = latestVital ? {
      systolic: latestVital.predicted_bp_systolic || 0,
      diastolic: latestVital.predicted_bp_diastolic || 0,
      stage: (latestVital.predicted_bp_systolic || 0) >= 140 || (latestVital.predicted_bp_diastolic || 0) >= 90 ? 'Stage 2 Hypertension' : ((latestVital.predicted_bp_systolic || 0) >= 130 ? 'Stage 1 Hypertension' : ((latestVital.predicted_bp_systolic || 0) > 120 ? 'Elevated' : 'Normal'))
  } : null;
  
  const glucose = latestVital ? {
      value: latestVital.predicted_glucose || 0,
      status: (latestVital.predicted_glucose || 0) > 180 ? 'Critical' : ((latestVital.predicted_glucose || 0) > 140 ? 'High' : 'Normal')
  } : null;
  
  const isLoading = patientLoading || (patientData && historyLoading);

  const getScanButtonContent = () => {
    switch (scanStatus) {
      case 'pending':
        return { icon: <Loader2 className="h-6 w-6 animate-spin" />, title: 'Waiting for Device', description: 'Scan request sent...' };
      case 'processing':
        return { icon: <Loader2 className="h-6 w-6 animate-spin" />, title: 'Scanning in Progress', description: 'Measuring your vitals...' };
      case 'idle':
      default:
        return { icon: <Wifi className="h-6 w-6" />, title: 'Scan Vitals Now', description: 'Tap to get a new reading' };
    }
  }
  const scanButtonContent = getScanButtonContent();

  return (
    <div className="p-4 space-y-4">
        <Card onClick={handleRequestScan} className={cn("bg-primary text-primary-foreground border-0 transition-all", scanStatus !== 'idle' ? 'cursor-not-allowed bg-primary/80' : 'cursor-pointer hover:bg-primary/90 active:scale-[0.98] hover:shadow-lg')}>
            <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-primary-foreground/20 rounded-lg">
                    {scanButtonContent.icon}
                </div>
                <div>
                    <h2 className="font-bold text-lg font-headline">{scanButtonContent.title}</h2>
                    <p className="text-sm opacity-80">{scanButtonContent.description}</p>
                </div>
            </CardContent>
        </Card>

        <Alert variant="default" className="bg-accent/20 border-accent/50">
            <Info className="h-4 w-4" />
            <AlertTitle className="font-semibold">Not a Medical Device</AlertTitle>
            <AlertDescription>
                This system provides health estimations for informational purposes only. Consult a doctor for medical advice.
            </AlertDescription>
        </Alert>

        {isLoading ? (
            <div className="space-y-4">
                <Skeleton className="h-56 w-full rounded-lg" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-48 w-full rounded-lg" />
                    <Skeleton className="h-48 w-full rounded-lg" />
                </div>
                 <Skeleton className="h-48 w-full rounded-lg" />
            </div>
        ) : latestVital ? (
            <div className="space-y-4">
                 <Card className="border-2 border-primary/30 bg-primary/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2"><Bot/>AI PREDICTIONS</CardTitle>
                        <CardDescription>Confidence: {(latestVital.confidence_score! * 100).toFixed(0)}%</CardDescription>
                    </CardHeader>
                    <CardContent className='grid grid-cols-2 gap-4'>
                       {bp && (
                            <div className='p-4 rounded-lg bg-card border'>
                                 <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-1"><HeartPulse/>BLOOD PRESSURE</h3>
                                 <p className="text-3xl font-bold">{bp.systolic.toFixed(0)}<span className='text-muted-foreground'>/</span>{bp.diastolic.toFixed(0)}</p>
                                 <p className={cn("text-sm font-bold", getStatusColor(bp.stage))}>{bp.stage}</p>
                            </div>
                       )}
                       {glucose && (
                           <div className='p-4 rounded-lg bg-card border'>
                                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-1"><Droplets/>GLUCOSE</h3>
                                <p className="text-3xl font-bold">{glucose.value.toFixed(0)}<span className="text-lg text-muted-foreground ml-1">mg/dL</span></p>
                                <p className={cn("text-sm font-bold", getStatusColor(glucose.status))}>{glucose.status}</p>
                           </div>
                       )}
                    </CardContent>
                </Card>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                     {latestVital.heart_rate && (
                        <Card className="transition-all hover:shadow-md">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2"><Activity/> HEART RATE</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold">{latestVital.heart_rate.toFixed(0)}<span className="text-base text-muted-foreground ml-1">bpm</span></p>
                            </CardContent>
                        </Card>
                    )}

                    {latestVital.spo2 && (
                        <Card className="transition-all hover:shadow-md">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2"><Wind/> SpO₂</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold">{latestVital.spo2.toFixed(1)}<span className="text-base text-muted-foreground">%</span></p>
                            </CardContent>
                        </Card>
                    )}
                    {latestVital.temperature && (
                        <Card className="transition-all hover:shadow-md">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2"><Thermometer/> TEMPERATURE</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold">{latestVital.temperature.toFixed(1)}<span className="text-base text-muted-foreground ml-1">°C</span></p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base"><Waves />Live PPG Waveform</CardTitle>
                        <CardDescription>Raw sensor signal from the last 20 readings</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <WaveformChart 
                            data={chartData} 
                            dataKey="ppg_raw"
                            color="hsl(var(--chart-4))"
                            gradientColor="hsl(var(--chart-4))"
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base"><BarChartHorizontal/>Live Trends</CardTitle>
                        <CardDescription>Recent Heart Rate and SpO₂ readings</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <VitalsChart 
                            data={chartData} 
                            dataKey1="heart_rate" 
                            label1="Heart Rate (BPM)" 
                            color1="hsl(var(--chart-2))" 
                            dataKey2="spo2"
                            label2="SpO₂ (%)"
                            color2="hsl(var(--chart-1))"
                        />
                    </CardContent>
                </Card>
            </div>
        ) : (
            <Card>
                <CardContent className="p-6 flex flex-col items-center justify-center text-center min-h-[50vh]">
                    <h3 className="text-xl font-bold tracking-tight">No Vitals Recorded Yet</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                        Tap "Scan Vitals Now" above to get your first reading.
                    </p>
                </CardContent>
            </Card>
        )}
    </div>
  );
}
