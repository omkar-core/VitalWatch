'use client';
import * as React from 'react';
import Link from "next/link";
import { useRouter } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
} from "@/components/ui/sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { VitalWatchLogo } from "@/components/icons";
import { LayoutDashboard, Users, Bell, LogOut, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useUser } from '@/firebase/auth/use-user';
import useSWR from 'swr';
import type { AlertHistory } from '@/lib/types';
import { logout } from "@/firebase/auth/auth-service";
import { useToast } from "@/hooks/use-toast";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, userProfile, loading: userLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const { data: alerts, isLoading: alertsLoading } = useSWR<AlertHistory[]>('/api/alerts', fetcher, { refreshInterval: 5000 });

  const unreadAlerts = Array.isArray(alerts) ? alerts.filter(a => !a.acknowledged).length : 0;
  const loading = userLoading || alertsLoading;

  React.useEffect(() => {
    if (!userLoading && (!user || userProfile?.role !== 'doctor')) {
      router.push('/login');
    }
  }, [user, userProfile, userLoading, router]);

  const handleSignOut = async () => {
    try {
      await logout();
      toast({
        title: "Logged Out",
        description: "Successfully signed out.",
      });
      router.push('/login');
    } catch (error: any) {
       toast({
        variant: "destructive",
        title: "Logout Failed",
        description: error.message,
      });
    }
  };
  
  if (loading || !user || userProfile?.role !== 'doctor') {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Link href="/doctor" className="flex items-center gap-2 px-2 py-4" prefetch={false}>
            <VitalWatchLogo className="w-7 h-7 text-primary" />
            <span className="font-headline text-lg font-semibold">VitalWatch</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Dashboard">
                <Link href="/doctor">
                  <LayoutDashboard />
                  <span>Clinical Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Patients">
                <Link href="/doctor/patients">
                  <Users />
                  <span>Patient List</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Alerts">
                <Link href="/doctor/alerts">
                  <Bell />
                  <span>System Alerts</span>
                  {unreadAlerts > 0 && <Badge variant="destructive" className="ml-auto">{unreadAlerts}</Badge>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleSignOut} className="text-destructive hover:text-destructive">
                <LogOut />
                <span>Sign Out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-background">
        <DashboardHeader title="Clinical Hub" userProfile={userProfile} />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
