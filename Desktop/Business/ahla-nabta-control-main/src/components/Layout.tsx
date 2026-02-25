import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="h-14 flex items-center border-b px-4 bg-card">
            <SidebarTrigger />
          </header>
          <div className="p-3 sm:p-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
