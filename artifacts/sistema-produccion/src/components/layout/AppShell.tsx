import { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppTopbar } from './AppTopbar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-dvh w-full bg-background">
        <AppSidebar />
        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          <AppTopbar />
          <main className="min-w-0 flex-1 bg-background">
            <div className="container mx-auto max-w-[1600px] p-4 pb-10 md:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
