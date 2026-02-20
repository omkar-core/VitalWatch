'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Info, Loader2, Bell, ShieldCheck } from "lucide-react";
import { formatDistanceToNow, subHours } from "date-fns";
import { useUser } from "@/firebase/auth/use-user";
import useSWR from 'swr';
import type { AlertHistory } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const getMockAlerts = (): AlertHistory[] => [
    {
        alert_id: 'm1',
        alert_timestamp: subHours(new Date(), 2).toISOString(),
        device_id: 'demo',
        alert_type: 'Threshold Check',
        severity: 'Low',
        alert_message: 'Your morning glucose levels are stable. Maintain current diet.',
        acknowledged: true,
        created_at: new Date().toISOString()
    },
    {
        alert_id: 'm2',
        alert_timestamp: subHours(new Date(), 24).toISOString(),
        device_id: 'demo',
        alert_type: 'AI Insight',
        severity: 'Medium',
        alert_message: 'Slight elevation in heart rate detected during evening scan. Ensure you are well-rested.',
        acknowledged: false,
        created_at: new Date().toISOString()
    }
];

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function PatientAlertsPage() {
  const { user } = useUser();
  const { data: alerts, isLoading } = useSWR<AlertHistory[]>(user ? `/api/alerts?patientId=${user.uid}` : null, fetcher);

  const isDemo = !alerts || alerts.length === 0;
  const displayAlerts = isDemo ? getMockAlerts() : alerts;

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <h1 className="text-xl font-bold font-headline">Health Alerts & Advice</h1>

      {isDemo && (
        <Alert className="bg-primary/5 border-primary/20">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <AlertTitle>Example Health Feedback</AlertTitle>
            <AlertDescription>Showing sample alerts to demonstrate how clinical advice is presented.</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-1 flex-col gap-4">
        {isLoading ? (
             <div className="flex flex-1 items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : displayAlerts.length > 0 ? (
            displayAlerts.map((item) => (
                <Card key={item.alert_id} className={cn("border-l-4", item.severity === 'Critical' ? 'border-l-destructive' : item.severity === 'Medium' ? 'border-l-yellow-500' : 'border-l-primary')}>
                    <CardHeader className="flex flex-row items-start gap-4 p-4">
                        <div className={cn("p-2 rounded-lg", item.severity === 'Critical' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}>
                            {item.severity === 'Critical' ? <AlertTriangle className="h-5 w-5" /> : <Info className="h-5 w-5" />}
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-sm font-bold uppercase">{item.severity} Alert</CardTitle>
                                <span className="text-[10px] text-muted-foreground font-medium">{formatDistanceToNow(new Date(item.alert_timestamp), {addSuffix: true})}</span>
                            </div>
                            <CardDescription className="text-foreground mt-1 text-sm font-medium leading-relaxed">{item.alert_message}</CardDescription>
                        </div>
                    </CardHeader>
                </Card>
            ))
        ) : (
             <div className="flex flex-1 items-center justify-center border-dashed border-2 rounded-xl h-64">
                <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                  <Bell className="w-8 h-8 opacity-20" />
                  <p className="text-sm font-medium">All systems normal. No active alerts.</p>
                </div>
            </div>
        )}
      </div>
    </main>
  );
}
