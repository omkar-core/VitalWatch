'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, AlertTriangle, Bell, Activity, Phone, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import useSWR, { useSWRConfig } from 'swr';
import type { PatientProfile, AlertHistory } from "@/lib/types";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function DoctorDashboard() {
  const { data: patients, isLoading: patientsLoading } = useSWR<PatientProfile[]>('/api/patients', fetcher);
  const { data: alerts, isLoading: alertsLoading } = useSWR<AlertHistory[]>('/api/alerts', fetcher);
  const { data: readings, isLoading: readingsLoading } = useSWR<{count: number}>('/api/vitals/today', fetcher);
  const { mutate } = useSWRConfig();
  const { toast } = useToast();
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const handleAcknowledge = async (alertId: string) => {
    setAcknowledgingId(alertId);
    try {
        const res = await fetch(`/api/alerts/${alertId}/acknowledge`, {
            method: 'POST',
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Failed to acknowledge alert');
        }

        toast({
            title: "Success",
            description: "Alert has been acknowledged.",
        });
        mutate('/api/alerts');
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: "Error",
            description: error.message,
        });
    } finally {
        setAcknowledgingId(null);
    }
  };

  const loading = patientsLoading || alertsLoading || readingsLoading;
  
  const criticalAlerts = Array.isArray(alerts) ? alerts.filter(a => (a.severity === 'Critical' || a.severity === 'High') && !a.acknowledged).slice(0, 2) : [];
  
  const criticalPatients = Array.isArray(patients) ? patients.filter(p => {
    const patientAlerts = Array.isArray(alerts) ? alerts.filter(a => a.patient_id === p.patient_id) : [];
    return patientAlerts.some(a => a.severity === 'Critical' || a.severity === 'High');
  }) : [];

  const summaryCards = [
    {
      title: "Total Patients",
      value: Array.isArray(patients) ? patients.length : 0,
      icon: <Users className="h-6 w-6 text-muted-foreground" />,
      loading: patientsLoading,
    },
    {
      title: "Active Alerts",
      value: Array.isArray(alerts) ? alerts.filter(a => !a.acknowledged).length : 0,
      icon: <Bell className="h-6 w-6 text-muted-foreground" />,
      loading: alertsLoading,
    },
    {
      title: "Critical Risk",
      value: criticalPatients.length,
      icon: <AlertTriangle className="h-6 w-6 text-destructive" />,
      loading: loading,
    },
    {
      title: "Readings Today",
      value: readings?.count.toLocaleString() || "0",
      icon: <Activity className="h-6 w-6 text-muted-foreground" />,
      loading: readingsLoading,
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {summaryCards.map((card) => (
                <Card key={card.title} className="transition-all hover:shadow-xl hover:-translate-y-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                        {card.icon}
                    </CardHeader>
                    <CardContent>
                        {card.loading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{card.value}</div>}
                    </CardContent>
                </Card>
            ))}
        </div>

        <Card className="transition-all hover:shadow-xl hover:-translate-y-1 border-2 border-destructive/50 bg-destructive/5">
            <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2"><AlertTriangle /> Critical Alerts (Requires Immediate Attention)</CardTitle>
                <CardDescription>Patients with vitals that have crossed critical thresholds.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 {loading ? (
                    <div className="flex justify-center items-center h-24">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                 ) : criticalAlerts.length > 0 ? (
                    criticalAlerts.map(alert => {
                        const patient = Array.isArray(patients) ? patients.find(p => p.patient_id === alert.patient_id) : null;
                        const isAcknowledging = acknowledgingId === alert.alert_id;
                        return (
                          <div key={alert.alert_id} className="p-4 border rounded-lg flex flex-wrap items-center justify-between gap-4 bg-background/50 border-destructive/20">
                              <div className="flex-1 min-w-[200px]">
                                  <p className="font-bold">{patient?.name || 'Unknown Patient'}</p>
                                  <p className="text-sm"><span className="text-destructive font-semibold">{alert.alert_message}</span></p>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                  <Button size="sm" asChild><Link href={`/doctor/patients/${alert.patient_id}`}><Users className="mr-2"/> View Details</Link></Button>
                                  <Button size="sm" variant="outline"><Phone className="mr-2"/> Call Patient</Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleAcknowledge(alert.alert_id)} disabled={isAcknowledging}>
                                    {isAcknowledging ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4"/>}
                                    Acknowledge
                                </Button>
                              </div>
                          </div>
                        )
                    })
                 ) : (
                    <p className="text-sm text-muted-foreground">No critical alerts at this time.</p>
                 )}
            </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="lg:col-span-4 transition-all hover:shadow-xl hover:-translate-y-1">
                <CardHeader>
                    <CardTitle>Patient Quick View</CardTitle>
                </CardHeader>
                <CardContent>
                     {loading ? <Skeleton className="h-48 w-full" /> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Risk</TableHead>
                                <TableHead>Last Update</TableHead>
                                <TableHead>Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Array.isArray(patients) && patients.slice(0,4).map(p => {
                                    const patientAlerts = Array.isArray(alerts) ? alerts.filter(a => a.patient_id === p.patient_id) : [];
                                    const status = patientAlerts.some(a => a.severity === 'Critical') ? 'Critical' : patientAlerts.some(a => a.severity === 'High') ? 'Needs Review' : 'Stable';
                                    return (
                                        <TableRow key={p.patient_id}>
                                            <TableCell className="font-medium">{p.name}</TableCell>
                                            <TableCell>
                                                <Badge variant={status === 'Critical' ? 'destructive' : status === 'Needs Review' ? 'secondary' : 'default'} className={status === 'Stable' ? 'bg-green-500 hover:bg-green-500/80' : ''}>{status}</Badge>
                                            </TableCell>
                                            <TableCell>{formatDistanceToNow(new Date(p.updated_at || Date.now()), { addSuffix: true })}</TableCell>
                                            <TableCell>
                                                <Button asChild variant="link" size="sm"><Link href={`/doctor/patients/${p.patient_id}`}>View</Link></Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                     )}
                     <Button variant="secondary" className="mt-4 w-full" asChild><Link href="/doctor/patients">View All Patients</Link></Button>
                </CardContent>
            </Card>
             <Card className="lg:col-span-3 transition-all hover:shadow-xl hover:-translate-y-1">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Recent Notifications</CardTitle>
                    <Button asChild variant="secondary" size="sm">
                        <Link href="/doctor/alerts">View All</Link>
                    </Button>
                </CardHeader>
                <CardContent>
                    {loading ? <Skeleton className="h-32 w-full" /> : (
                      <div className="space-y-4">
                          {Array.isArray(alerts) && alerts.filter(a => !a.acknowledged).slice(0, 3).map(alert => {
                              const patient = Array.isArray(patients) ? patients.find(p => p.patient_id === alert.patient_id) : null;
                              return (
                                <div key={alert.alert_id} className="flex items-start gap-3">
                                    <div className="flex-shrink-0 pt-1">
                                        <Bell className={`h-4 w-4 ${alert.severity === 'Critical' || alert.severity === 'High' ? 'text-destructive' : 'text-yellow-500'}`} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium leading-tight">{patient?.name || 'Unknown Patient'}: {alert.alert_message}</p>
                                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(alert.alert_timestamp))} ago</p>
                                    </div>
                                </div>
                              )
                          })}
                          {(!Array.isArray(alerts) || alerts.filter(a => !a.acknowledged).length === 0) && <p className="text-sm text-muted-foreground">No unread notifications.</p>}
                      </div>
                    )}
                </CardContent>
            </Card>
        </div>
    </main>
  );
}
