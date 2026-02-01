'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Info, Loader2, Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useUser } from "@/firebase/auth/use-user";
import useSWR from 'swr';
import type { AlertHistory } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function PatientAlertsPage() {
  const { user } = useUser();
  const { data: alerts, isLoading } = useSWR<AlertHistory[]>(user ? `/api/alerts?patientId=${user.uid}` : null, fetcher);

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Alerts & Advice</h1>
      </div>
      <div className="flex flex-1 flex-col gap-4 rounded-lg border border-dashed shadow-sm p-4">
        {isLoading ? (
             <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        ) : Array.isArray(alerts) && alerts.length > 0 ? (
            alerts.map((item) => (
                <Card key={item.alert_id}>
                    <CardHeader className="flex flex-row items-start gap-4">
                        {item.severity === 'Critical' || item.severity === 'High' ? <AlertTriangle className="h-6 w-6 text-yellow-500" /> : <Info className="h-6 w-6 text-primary" />}
                        <div>
                            <CardTitle>{item.severity} Alert</CardTitle>
                            <CardDescription>{formatDistanceToNow(new Date(item.alert_timestamp), {addSuffix: true})}</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p>{item.alert_message}</p>
                    </CardContent>
                </Card>
            ))
        ) : (
             <div className="flex flex-1 items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-center">
                  <Bell className="w-12 h-12 text-muted-foreground" />
                  <h3 className="text-2xl font-bold tracking-tight">
                      No Alerts or Advice
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                      You have no new health alerts or advice from your care team. Any important updates will appear here.
                  </p>
                </div>
            </div>
        )}
      </div>
    </main>
  );
}
