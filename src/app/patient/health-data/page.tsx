'use client';

import { useMemo } from 'react';
import { VitalsChart } from "@/components/dashboard/vitals-chart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, Info } from "lucide-react";
import type { HealthVital, PatientProfile } from '@/lib/types';
import { format, subDays } from 'date-fns';
import { useUser } from '@/firebase/auth/use-user';
import useSWR from 'swr';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const getMockHistory = (): HealthVital[] => {
    const now = new Date();
    return Array.from({ length: 15 }).map((_, i) => ({
        timestamp: subDays(now, 15 - i).toISOString(),
        device_id: 'demo',
        heart_rate: 72 + Math.random() * 8,
        spo2: 98,
        temperature: 36.7,
        ppg_raw: 1500,
        predicted_bp_systolic: 118 + Math.random() * 10,
        predicted_bp_diastolic: 78 + Math.random() * 5,
        predicted_glucose: 95 + Math.random() * 20,
        alert_flag: false,
        created_at: new Date().toISOString(),
    }));
};

const fetcher = (url: string) => fetch(url).then(res => res.ok ? res.json() : null);

export default function PatientHealthDataPage() {
    const { user } = useUser();
    const { data: patientProfile, isLoading: patientLoading } = useSWR<PatientProfile>(user ? `/api/patients/${user.uid}` : null, fetcher);
    const { data: vitals, isLoading: vitalsLoading } = useSWR<HealthVital[]>(patientProfile?.device_id ? `/api/vitals/history/${patientProfile.device_id}` : null, fetcher);

    const isDemo = !vitals || vitals.length === 0;
    const displayData = isDemo ? getMockHistory() : vitals;

    const chartVitals = useMemo(() => 
        displayData.map(v => ({ ...v, time: format(new Date(v.timestamp), 'MMM dd') })),
    [displayData]);

    const glucoseSummary = useMemo(() => {
      return displayData.reduce((acc, vital) => {
          const glucose = vital.predicted_glucose || 0;
          acc.sum += glucose;
          if (glucose > acc.highest) acc.highest = glucose;
          if (glucose < acc.lowest) acc.lowest = glucose;
          if (glucose >= 70 && glucose <= 140) acc.inTarget++;
          else if (glucose > 140) acc.aboveTarget++;
          else acc.belowTarget++;
          return acc;
      }, { sum: 0, highest: 0, lowest: Infinity, inTarget: 0, aboveTarget: 0, belowTarget: 0 });
    }, [displayData]);

    const averageGlucose = Math.round(glucoseSummary.sum / displayData.length);
    const timeInTarget = Math.round((glucoseSummary.inTarget / displayData.length) * 100);

    if (patientLoading || vitalsLoading) return <div className="p-6 space-y-6"><Skeleton className='h-96 w-full' /><Skeleton className='h-64 w-full' /></div>;

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold font-headline">Health Records</h1>
        <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4"/>Export Data</Button>
      </div>

      {isDemo && (
        <Alert className="bg-primary/5 border-primary/20 mb-4">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle>Demo Records</AlertTitle>
            <AlertDescription>No clinical data found. Displaying historical trends based on standard health profiles.</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="glucose" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="glucose">Glucose Insight</TabsTrigger>
            <TabsTrigger value="bp">BP Trends</TabsTrigger>
        </TabsList>
        <TabsContent value="glucose" className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Estimated Glucose Trend</CardTitle>
                    <CardDescription>Estimated via PPG wave analysis</CardDescription>
                </CardHeader>
                <CardContent>
                    <VitalsChart data={chartVitals} dataKey1="predicted_glucose" label1="Glucose (mg/dL)" color1="hsl(var(--primary))" />
                </CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 text-center">
                    <p className="text-xs text-muted-foreground font-bold uppercase">Average</p>
                    <p className="text-2xl font-bold mt-1">{averageGlucose} <span className="text-xs font-normal">mg/dL</span></p>
                </Card>
                <Card className="p-4 text-center">
                    <p className="text-xs text-muted-foreground font-bold uppercase">In Target</p>
                    <p className="text-2xl font-bold mt-1">{timeInTarget}%</p>
                </Card>
            </div>
        </TabsContent>
        <TabsContent value="bp">
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Blood Pressure Estimation</CardTitle>
                </CardHeader>
                <CardContent>
                    <VitalsChart data={chartVitals} dataKey1="predicted_bp_systolic" label1="SYS" color1="hsl(var(--chart-2))" dataKey2="predicted_bp_diastolic" label2="DIA" color2="hsl(var(--chart-3))"/>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
      
      <Card>
        <CardHeader className="py-4">
            <CardTitle className="text-sm font-bold uppercase tracking-tight">Reading History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-bold">DATE</TableHead>
                  <TableHead className="text-xs font-bold">GLUC</TableHead>
                  <TableHead className="text-xs font-bold">BP</TableHead>
                  <TableHead className="text-xs font-bold">HR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayData.slice().reverse().map((vital, index) => (
                  <TableRow key={index} className="hover:bg-muted/30">
                    <TableCell className="text-xs font-medium">{format(new Date(vital.timestamp), 'MMM dd, HH:mm')}</TableCell>
                    <TableCell className="text-xs font-bold">{vital.predicted_glucose?.toFixed(0)}</TableCell>
                    <TableCell className="text-xs">{`${vital.predicted_bp_systolic?.toFixed(0)}/${vital.predicted_bp_diastolic?.toFixed(0)}`}</TableCell>
                    <TableCell className="text-xs">{vital.heart_rate.toFixed(0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        </CardContent>
      </Card>
    </main>
  );
}
