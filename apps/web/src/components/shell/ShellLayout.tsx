import { useState } from "react";

interface ShellBranding {
  businessName: string;
  logoUrl: string | null;
  accentColor: string;
}

interface ShellContext {
  address: string;
  statusText: string;
}

interface ShellLayoutProps {
  branding: ShellBranding | null;
  context?: ShellContext;
  children: React.ReactNode;
}

export function ShellLayout({ branding, context, children }: ShellLayoutProps) {
  const [logoError, setLogoError] = useState(false);
  const accentColor = branding?.accentColor ?? "hsl(var(--accent))";

  return (
    <div
      className="min-h-screen flex flex-col bg-background"
      style={{ "--photographer-accent": accentColor } as React.CSSProperties}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border/50 px-6 py-3.5">
        <div className="max-w-[800px] mx-auto flex items-center gap-3">
          {branding?.logoUrl && !logoError ? (
            <>
              <img
                src={branding.logoUrl}
                alt={branding.businessName}
                className="h-9 max-h-9 w-auto"
                onError={() => setLogoError(true)}
              />
              <span className="font-heading text-base font-600 text-card-foreground tracking-tight">
                {branding.businessName}
              </span>
            </>
          ) : branding ? (
            <span
              className="font-heading text-lg font-600 tracking-tight"
              style={{ color: accentColor }}
            >
              {branding.businessName}
            </span>
          ) : null}
        </div>
      </header>

      {/* Context Bar */}
      {context && (
        <div className="border-b border-border/60 bg-secondary px-6 py-2.5">
          <div className="max-w-[800px] mx-auto">
            <p className="text-sm font-body font-500 text-foreground">
              {context.address}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {context.statusText}
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 px-6 py-10">
        <div className="max-w-[800px] mx-auto animate-slide-in">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-5">
        <div className="max-w-[800px] mx-auto text-center">
          {branding && (
            <p className="text-xs font-body font-500 text-muted-foreground">
              {branding.businessName}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground/60 mt-1 tracking-wide uppercase">
            Powered by ShotReady
          </p>
        </div>
      </footer>
    </div>
  );
}
