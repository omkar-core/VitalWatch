"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import useSWR from 'swr';
import type { PatientProfile, AlertHistory } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function DoctorPatientsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: allPatients, isLoading: patientsLoading } = useSWR<PatientProfile[]>('/api/patients', fetcher);
  const { data: alerts, isLoading: alertsLoading } = useSWR<AlertHistory[]>('/api/alerts', fetcher);

  const loading = patientsLoading || alertsLoading;

  const filteredPatients = Array.isArray(allPatients) ? allPatients.filter(patient =>
    patient.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  const getStatus = (patientId: string) => {
    const patientAlerts = Array.isArray(alerts) ? alerts.filter(a => a.patient_id === patientId) : [];
    if (patientAlerts.some(a => a.severity === 'Critical')) return 'Critical';
    if (patientAlerts.some(a => a.severity === 'High')) return 'Needs Review';
    return 'Stable';
  };

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <Card>
        <CardHeader>
            <CardTitle>Patient Management</CardTitle>
            <CardDescription>Search, filter, and manage all your patients.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex items-center gap-4 mb-4">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search patients by name..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </div>

            <div className="rounded-lg border">
                {loading ? (
                    <div className="h-96 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : (
                  <Table>
                  <TableHeader>
                      <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Risk Status</TableHead>
                      <TableHead>Last Update</TableHead>
                      <TableHead><span className="sr-only">Actions</span></TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {filteredPatients.map((patient) => {
                          const status = getStatus(patient.patient_id);
                          const conditions = [
                            patient.has_diabetes && "Diabetes",
                            patient.has_hypertension && "Hypertension",
                            patient.has_heart_condition && "Heart Condition"
                          ].filter(Boolean).join(', ');
                          return (
                              <TableRow key={patient.patient_id}>
                                  <TableCell className="font-medium">
                                      <div className="flex items-center gap-3">
                                          <Image src={patient.avatar_url || `https://ui-avatars.com/api/?name=${patient.name}`} alt={patient.name || ''} width={32} height={32} className="rounded-full object-cover" />
                                          {patient.name}
                                      </div>
                                  </TableCell>
                                  <TableCell>{conditions || 'N/A'}</TableCell>
                                  <TableCell>
                                      <Badge variant={status === 'Critical' ? 'destructive' : status === 'Needs Review' ? 'secondary' : 'default'}
                                      className={status === 'Stable' ? 'bg-green-500 hover:bg-green-500/80' : ''}>
                                          {status}
                                      </Badge>
                                  </TableCell>
                                  <TableCell>{formatDistanceToNow(new Date(patient.updated_at || Date.now()), { addSuffix: true })}</TableCell>
                                  <TableCell>
                                      <Button variant="outline" size="sm" asChild>
                                          <Link href={`/doctor/patients/${patient.patient_id}`}>View</Link>
                                      </Button>
                                  </TableCell>
                              </TableRow>
                          )
                      })}
                  </TableBody>
                  </Table>
                )}
            </div>
        </CardContent>
      </Card>
    </main>
  );
}
