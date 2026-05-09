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
  const accentColor = branding?.accentColor ?? "#2563EB";

  return (
    <div
      className="min-h-screen flex flex-col bg-white"
      style={{ "--accent": accentColor } as React.CSSProperties}
    >
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-[800px] mx-auto flex items-center gap-3">
          {branding?.logoUrl && !logoError ? (
            <>
              <img
                src={branding.logoUrl}
                alt={branding.businessName}
                className="h-10 max-h-10 w-auto"
                onError={() => setLogoError(true)}
              />
              <span className="text-base font-semibold text-gray-900">
                {branding.businessName}
              </span>
            </>
          ) : branding ? (
            <span
              className="text-lg font-bold"
              style={{ color: accentColor }}
            >
              {branding.businessName}
            </span>
          ) : null}
        </div>
      </header>

      {/* Context Bar */}
      {context && (
        <div className="border-b border-gray-100 bg-gray-50 px-6 py-2.5">
          <div className="max-w-[800px] mx-auto">
            <p className="text-sm font-medium text-gray-900">
              {context.address}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {context.statusText}
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-[800px] mx-auto">{children}</div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 px-6 py-4" style={{ minHeight: "60px" }}>
        <div className="max-w-[800px] mx-auto text-center">
          {branding && (
            <p className="text-sm text-gray-600">{branding.businessName}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">Powered by ShotReady</p>
        </div>
      </footer>
    </div>
  );
}
