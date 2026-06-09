import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { X, ArrowRight, SkipForward } from "lucide-react";

/* ── Tour step definitions ── */

interface TourStep {
  target: string;           // data-tour attribute value
  title: string;
  content: string;
  placement?: "top" | "bottom";
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "stats-cards",
    title: "Your Booking Snapshot",
    content: "See active jobs, today's shoots, items needing action, and completed work — all at a glance.",
    placement: "bottom",
  },
  {
    target: "quick-actions",
    title: "Quick Actions",
    content: "Copy your booking link to share with agents, or jump straight to uploading edited photos.",
    placement: "bottom",
  },
  {
    target: "jobs-pipeline",
    title: "Your Jobs Pipeline",
    content: "Bookings are organized by what needs your attention first. Filter and search to find any job.",
    placement: "top",
  },
  {
    target: "nav-upload",
    title: "Upload Photos",
    content: "After editing in Lightroom, upload photos here. Your agent gets a proofing gallery to pick their favorites.",
    placement: "bottom",
  },
  {
    target: "nav-settings",
    title: "Business Settings",
    content: "Set up your profile, service packages, and availability. All three are needed before agents can book you.",
    placement: "bottom",
  },
];

const STORAGE_KEY = "shotready-tour-completed";
const PENDING_KEY = "shotready-tour-pending";

/* ── Context ── */

interface TourContextValue {
  startTour: () => void;
  isActive: boolean;
}

const TourContext = createContext<TourContextValue>({
  startTour: () => {},
  isActive: false,
});

export const useTour = () => useContext(TourContext);

/* ── Provider ── */

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const currentStep = TOUR_STEPS[step];

  const measureTarget = useCallback(() => {
    if (!active || !currentStep) return;
    const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      setRect(r);
      // Scroll into view if needed
      const inView = r.top >= 0 && r.bottom <= window.innerHeight;
      if (!inView) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Re-measure after scroll
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setRect(el.getBoundingClientRect()));
        });
      }
    } else {
      setRect(null);
    }
  }, [active, currentStep]);

  useEffect(() => {
    measureTarget();
    window.addEventListener("resize", measureTarget);
    window.addEventListener("scroll", measureTarget, true);
    return () => {
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
    };
  }, [measureTarget]);

  // Auto-start check
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY) === "true";
    const pending = localStorage.getItem(PENDING_KEY) === "true";
    if (!completed || pending) {
      // Delay to let the DOM render
      const timer = setTimeout(() => {
        const hasTarget = document.querySelector(`[data-tour="${TOUR_STEPS[0].target}"]`);
        if (hasTarget) {
          localStorage.removeItem(PENDING_KEY);
          setStep(0);
          setActive(true);
        }
      }, 700);
      return () => clearTimeout(timer);
    }
  }, []);

  function startTour() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PENDING_KEY);
    setStep(0);
    setActive(true);
  }

  function endTour() {
    localStorage.setItem(STORAGE_KEY, "true");
    setActive(false);
    setRect(null);
  }

  function next() {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      endTour();
    }
  }

  // Tooltip positioning
  const tooltipStyle = (): React.CSSProperties => {
    if (!rect) return { display: "none" };
    const pad = 12;
    const placement = currentStep?.placement ?? "bottom";
    const centerX = rect.left + rect.width / 2;
    const tooltipWidth = 320;
    let left = centerX - tooltipWidth / 2;
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));

    if (placement === "bottom") {
      return { position: "fixed", top: rect.bottom + pad, left, width: tooltipWidth, zIndex: 10001 };
    }
    return { position: "fixed", bottom: window.innerHeight - rect.top + pad, left, width: tooltipWidth, zIndex: 10001 };
  };

  return (
    <TourContext.Provider value={{ startTour, isActive: active }}>
      {children}
      {active && rect && currentStep && (
        <>
          {/* Overlay with spotlight cutout */}
          <div ref={overlayRef} className="fixed inset-0 z-[10000] pointer-events-auto">
            <svg className="absolute inset-0 w-full h-full">
              <defs>
                <mask id="tour-mask">
                  <rect x="0" y="0" width="100%" height="100%" fill="white" />
                  <rect
                    x={rect.left - 6}
                    y={rect.top - 6}
                    width={rect.width + 12}
                    height={rect.height + 12}
                    rx="8"
                    fill="black"
                  />
                </mask>
              </defs>
              <rect
                x="0" y="0" width="100%" height="100%"
                fill="rgba(0,0,0,0.65)"
                mask="url(#tour-mask)"
              />
            </svg>
            {/* Spotlight ring */}
            <div
              className="absolute border-2 border-accent rounded-lg pointer-events-none animate-pulse"
              style={{
                left: rect.left - 6,
                top: rect.top - 6,
                width: rect.width + 12,
                height: rect.height + 12,
              }}
            />
          </div>

          {/* Tooltip */}
          <div style={tooltipStyle()} className="animate-slide-in">
            <div className="bg-card border border-border rounded-lg shadow-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                    {step + 1}/{TOUR_STEPS.length}
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">{currentStep.title}</h3>
                </div>
                <button
                  onClick={endTour}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
                  aria-label="Close tour"
                >
                  <X size={14} />
                </button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                {currentStep.content}
              </p>
              <div className="flex items-center justify-between">
                <button
                  onClick={endTour}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <SkipForward size={12} /> Skip tour
                </button>
                <button
                  onClick={next}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-accent-foreground text-xs font-semibold rounded-md hover:opacity-90 transition-opacity"
                >
                  {step < TOUR_STEPS.length - 1 ? (
                    <>Next <ArrowRight size={12} /></>
                  ) : (
                    "Done"
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </TourContext.Provider>
  );
}
