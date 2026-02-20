'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, AlertTriangle, Bell, Activity, Check, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import useSWR, { useSWRConfig } from 'swr';
import type { PatientProfile, AlertHistory } from "@/lib/types";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function DoctorDashboard() {
  const { data: patients, isLoading: patientsLoading } = useSWR<PatientProfile[]>('/api/patients', fetcher);
  const { data: alerts, isLoading: alertsLoading } = useSWR<AlertHistory[]>('/api/alerts', fetcher);
  const { data: readingsToday, isLoading: readingsLoading } = useSWR<{count: number}>('/api/vitals/today', fetcher);
  const { mutate } = useSWRConfig();
  const { toast } = useToast();
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const isDemo = (!patients || patients.length === 0) && !patientsLoading;

  const handleAcknowledge = async (alertId: string) => {
    setAcknowledgingId(alertId);
    try {
        const res = await fetch(`/api/alerts/${alertId}/acknowledge`, { method: 'POST' });
        if (!res.ok) throw new Error('Failed to acknowledge');
        toast({ title: "Success", description: "Alert acknowledged." });
        mutate('/api/alerts');
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Error", description: error.message });
    } finally {
        setAcknowledgingId(null);
    }
  };

  const criticalAlerts = Array.isArray(alerts) ? alerts.filter(a => (a.severity === 'Critical' || a.severity === 'High') && !a.acknowledged).slice(0, 3) : [];
  
  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-muted/10">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold font-headline">Clinical Overview</h1>
            <Badge variant="outline" className="bg-background">Live Monitoring Active</Badge>
        </div>

        {isDemo && (
            <Alert className="bg-primary/10 border-primary/20">
                <Info className="h-4 w-4 text-primary" />
                <AlertTitle>Simulation Mode</AlertTitle>
                <AlertDescription>No active patients found. Add a patient via the registration portal or connect a device to see real-time data.</AlertDescription>
            </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Total Patients</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{patients?.length || 0}</div>
                </CardContent>
            </Card>
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Critical Alerts</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{criticalAlerts.length}</div>
                </CardContent>
            </Card>
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Active Alerts</CardTitle>
                    <Bell className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{alerts?.filter(a => !a.acknowledged).length || 0}</div>
                </CardContent>
            </Card>
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Syncs Today</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{readingsToday?.count || 0}</div>
                </CardContent>
            </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-7">
            <Card className="md:col-span-4 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-sm font-bold">Patient Population Health</CardTitle>
                </CardHeader>
                <CardContent>
                     {patientsLoading ? <Skeleton className="h-48 w-full" /> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-[10px] font-bold uppercase">Patient Name</TableHead>
                                    <TableHead className="text-[10px] font-bold uppercase">Status</TableHead>
                                    <TableHead className="text-[10px] font-bold uppercase">Last Sync</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Array.isArray(patients) && patients.length > 0 ? patients.slice(0, 5).map(p => (
                                    <TableRow key={p.patient_id}>
                                        <TableCell className="font-bold text-sm">{p.name}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="text-[10px]">Active</Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}</TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={3} className="text-center py-10 text-muted-foreground text-xs uppercase font-bold">No clinical data available</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                     )}
                     <Button variant="secondary" className="mt-4 w-full text-xs font-bold uppercase tracking-tight" asChild><Link href="/doctor/patients">Manage Full List</Link></Button>
                </CardContent>
            </Card>

            <Card className="md:col-span-3 shadow-sm border-l-4 border-l-primary">
                <CardHeader>
                    <CardTitle className="text-sm font-bold">Critical Notifications</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {criticalAlerts.length > 0 ? criticalAlerts.map(alert => (
                            <div key={alert.alert_id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                                <AlertTriangle className="h-4 w-4 text-destructive mt-1" />
                                <div className="flex-1">
                                    <p className="text-sm font-bold leading-tight">{alert.alert_message}</p>
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase mt-1">{formatDistanceToNow(new Date(alert.alert_timestamp))} ago</p>
                                </div>
                                <Button size="icon" variant="ghost" onClick={() => handleAcknowledge(alert.alert_id)} disabled={acknowledgingId === alert.alert_id}>
                                    {acknowledgingId === alert.alert_id ? <Loader2 className="h-3 w-3 animate-spin"/> : <Check className="h-3 w-3"/>}
                                </Button>
                            </div>
                        )) : <p className="text-xs text-center py-10 font-bold uppercase text-muted-foreground tracking-widest">No pending critical alerts</p>}
                    </div>
                </CardContent>
            </Card>
        </div>
    </main>
  );
}
