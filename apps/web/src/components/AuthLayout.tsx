import { type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { SignIn } from "./SignIn";
import { Camera, Upload, Settings, LogOut } from "lucide-react";

interface AuthLayoutProps {
  children: ReactNode;
  activePage: "dashboard" | "upload" | "settings";
}

export function AuthLayout({ children, activePage }: AuthLayoutProps) {
  const { user, loading, logOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-shimmer w-48 h-4 rounded" />
      </div>
    );
  }

  if (!user) return <SignIn />;

  const navItems = [
    { key: "dashboard" as const, label: "Dashboard", href: "/dashboard", icon: Camera },
    { key: "upload" as const, label: "Upload", href: "/upload", icon: Upload },
    { key: "settings" as const, label: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pb-16 sm:pb-0">
      {/* Desktop Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/dashboard" className="font-heading text-lg font-semibold text-foreground tracking-tight hover:opacity-80 transition-opacity">
            ShotReady
          </a>
          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => (
              <a
                key={item.key}
                href={item.href}
                data-tour={`nav-${item.key}`}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activePage === item.key
                    ? "text-accent bg-accent/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <item.icon size={16} />
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground text-sm hidden md:inline">{user.email}</span>
            <button
              onClick={logOut}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Page Content */}
      {children}

      {/* Mobile Bottom Nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border flex z-10">
        {navItems.map((item) => (
          <a
            key={item.key}
            href={item.href}
            className={`flex-1 flex flex-col items-center py-3 ${
              activePage === item.key ? "text-accent" : "text-muted-foreground"
            }`}
          >
            <item.icon size={20} />
            <span className="text-[10px] mt-1 font-medium">{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
