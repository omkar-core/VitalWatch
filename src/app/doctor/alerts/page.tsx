'use client';

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { format } from "date-fns";
import useSWR, { useSWRConfig } from 'swr';
import type { AlertHistory, PatientProfile } from "@/lib/types";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function DoctorAlertsPage() {
    const { data: alerts, error: alertsError, isLoading: alertsLoading } = useSWR<AlertHistory[]>('/api/alerts', fetcher);
    const { data: patients, error: patientsError, isLoading: patientsLoading } = useSWR<PatientProfile[]>('/api/patients', fetcher);
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

            // Re-fetch alerts data to update the UI
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

    const loading = alertsLoading || patientsLoading;

    const getSeverityClass = (severity: string) => {
        switch (severity) {
        case "Critical":
            return "text-destructive";
        case "High":
            return "text-destructive";
        case "Medium":
            return "text-yellow-500";
        default:
            return "text-muted-foreground";
        }
    };

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Alerts & Notifications</h1>
      </div>
      <div
        className="flex flex-1 justify-center rounded-lg border border-dashed shadow-sm p-4"
      >
        {loading ? (
            <div className="flex justify-center items-center h-96">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        ) : (
          <Table>
          <TableHeader>
              <TableRow>
              <TableHead>Severity</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
              </TableRow>
          </TableHeader>
          <TableBody>
              {Array.isArray(alerts) && alerts.map((alert) => {
                const patient = Array.isArray(patients) ? patients.find(p => p.patient_id === alert.patient_id) : null;
                const isAcknowledging = acknowledgingId === alert.alert_id;
                return (
                  <TableRow key={alert.alert_id} className={!alert.acknowledged ? 'bg-secondary/50' : ''}>
                      <TableCell>
                      <div className="flex items-center gap-2">
                          <AlertTriangle className={`h-4 w-4 ${getSeverityClass(alert.severity)}`} />
                          <span className={`font-medium ${getSeverityClass(alert.severity)}`}>{alert.severity}</span>
                      </div>
                      </TableCell>
                      <TableCell className="font-medium">{patient?.name || 'Unknown'}</TableCell>
                      <TableCell>{alert.alert_message}</TableCell>
                      <TableCell>{format(new Date(alert.alert_timestamp), 'PPpp')}</TableCell>
                      <TableCell>
                      <Badge variant={alert.acknowledged ? "outline" : "default"}>
                          {alert.acknowledged ? "Acknowledged" : "Active"}
                      </Badge>
                      </TableCell>
                      <TableCell>
                          {!alert.acknowledged && (
                              <Button variant="outline" size="sm" onClick={() => handleAcknowledge(alert.alert_id)} disabled={isAcknowledging}>
                                  {isAcknowledging ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4"/>}
                                  Acknowledge
                              </Button>
                          )}
                      </TableCell>
                  </TableRow>
                )
              })}
          </TableBody>
          </Table>
        )}
      </div>
    </main>
  );
}
