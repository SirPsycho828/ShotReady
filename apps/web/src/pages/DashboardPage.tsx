import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useBookings, type BookingWithId } from "../hooks/useBookings";
import { usePhotographer } from "../hooks/usePhotographer";
import { AuthLayout } from "../components/AuthLayout";
import { BookingCard } from "../components/dashboard/BookingCard";
import { FilterChipBar } from "../components/dashboard/FilterChipBar";
import {
  Search, X, Camera, Upload, Link2, Copy, Check, Settings,
  CalendarDays, Clock, CheckCircle2, AlertTriangle, ExternalLink,
} from "lucide-react";
import {
  PHOTOGRAPHER_ACTION_STATUSES,
  WAITING_ON_OTHERS_STATUSES,
  COMPLETED_STATUSES,
} from "@shotready/shared";

const ACTION_PRIORITY: Record<string, number> = {
  pending: 0, overdue: 1, shooting: 2, editing: 3, delivered: 4, confirmed: 5,
};

const FILTER_CHIPS = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "thisWeek", label: "This Week" },
  { key: "pending", label: "Pending" },
  { key: "overdue", label: "Overdue" },
];

function getDateStr(seconds: number): string {
  const d = new Date(seconds * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTodayStr(): string {
  return getDateStr(Date.now() / 1000);
}

function getMondayOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function isThisWeek(seconds: number): boolean {
  const monday = getMondayOfWeek(new Date());
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);
  return new Date(seconds * 1000) >= monday && new Date(seconds * 1000) < sunday;
}

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <AuthLayout activePage="dashboard">
      <main className="max-w-5xl mx-auto px-6 py-8">
        {user && <DashboardContent uid={user.uid} />}
      </main>
    </AuthLayout>
  );
}

function DashboardContent({ uid }: { uid: string }) {
  const { bookings, loading: bookingsLoading } = useBookings(uid);
  const { photographer } = usePhotographer(uid);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [copied, setCopied] = useState(false);

  const bookingSlug = photographer?.bookingSlug;
  const bookingUrl = bookingSlug ? `https://shotready-001.web.app/book/${bookingSlug}` : null;
  const hasProfile = !!photographer?.businessName;

  const filteredBookings = (() => {
    let result = bookings;
    if (activeFilter === "today") {
      const today = getTodayStr();
      result = result.filter((b) => {
        const ts = b.schedule.confirmedDate ?? b.schedule.requestedDate;
        return getDateStr(ts.seconds) === today;
      });
    } else if (activeFilter === "thisWeek") {
      result = result.filter((b) => {
        const ts = b.schedule.confirmedDate ?? b.schedule.requestedDate;
        return isThisWeek(ts.seconds);
      });
    } else if (activeFilter === "pending") {
      result = result.filter((b) => b.status === "pending");
    } else if (activeFilter === "overdue") {
      result = result.filter((b) => b.status === "overdue");
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.property.address.toLowerCase().includes(q) ||
          b.agent.name.toLowerCase().includes(q) ||
          b.agent.email.toLowerCase().includes(q),
      );
    }
    return result;
  })();

  const { actionItems, waitingItems, completedItems } = (() => {
    const action: BookingWithId[] = [];
    const waiting: BookingWithId[] = [];
    const completed: BookingWithId[] = [];
    for (const b of filteredBookings) {
      if ((PHOTOGRAPHER_ACTION_STATUSES as readonly string[]).includes(b.status)) action.push(b);
      else if ((WAITING_ON_OTHERS_STATUSES as readonly string[]).includes(b.status)) waiting.push(b);
      else if ((COMPLETED_STATUSES as readonly string[]).includes(b.status)) completed.push(b);
    }
    action.sort((a, b) => {
      const pa = ACTION_PRIORITY[a.status] ?? 99;
      const pb = ACTION_PRIORITY[b.status] ?? 99;
      return pa !== pb ? pa - pb : a.updatedAt.seconds - b.updatedAt.seconds;
    });
    waiting.sort((a, b) => b.updatedAt.seconds - a.updatedAt.seconds);
    completed.sort((a, b) => b.updatedAt.seconds - a.updatedAt.seconds);
    return { actionItems: action, waitingItems: waiting, completedItems: completed.slice(0, 30) };
  })();

  const isFiltered = activeFilter !== "all" || searchQuery.trim().length > 0;
  const noResults = isFiltered && filteredBookings.length === 0;
  const totalActive = actionItems.length + waitingItems.length;
  const todayCount = bookings.filter((b) => {
    const ts = b.schedule.confirmedDate ?? b.schedule.requestedDate;
    return getDateStr(ts.seconds) === getTodayStr();
  }).length;

  function handleCopyLink() {
    if (!bookingUrl) return;
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      {/* Setup Banner (show if no profile yet) */}
      {!hasProfile && (
        <a
          href="/settings"
          className="flex items-center gap-3 bg-accent/10 border border-accent/30 rounded-lg px-5 py-4 mb-6 hover:bg-accent/15 transition-colors"
        >
          <Settings size={20} className="text-accent shrink-0" />
          <div>
            <span className="text-sm font-semibold text-foreground block">Complete your profile</span>
            <span className="text-xs text-muted-foreground">
              Set up your business name, booking link, packages, and availability to start accepting bookings.
            </span>
          </div>
        </a>
      )}

      {/* Welcome + Stats */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-semibold text-foreground mb-1">
          {photographer?.businessName ? `${photographer.businessName}` : "Welcome back"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here's what's happening with your bookings.
        </p>

        <div data-tour="stats-cards" className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
              <Camera size={14} />
              <span className="text-xs uppercase tracking-wider font-medium">Active</span>
            </div>
            <span className="text-2xl font-heading font-semibold text-foreground">
              {bookingsLoading ? "–" : totalActive}
            </span>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
              <CalendarDays size={14} />
              <span className="text-xs uppercase tracking-wider font-medium">Today</span>
            </div>
            <span className="text-2xl font-heading font-semibold text-foreground">
              {bookingsLoading ? "–" : todayCount}
            </span>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
              <Clock size={14} />
              <span className="text-xs uppercase tracking-wider font-medium">Needs Action</span>
            </div>
            <span className="text-2xl font-heading font-semibold text-foreground">
              {bookingsLoading ? "–" : actionItems.length}
            </span>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
              <CheckCircle2 size={14} />
              <span className="text-xs uppercase tracking-wider font-medium">Completed</span>
            </div>
            <span className="text-2xl font-heading font-semibold text-foreground">
              {bookingsLoading ? "–" : completedItems.length}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div data-tour="quick-actions" className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {bookingUrl ? (
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-4 bg-card border border-border rounded-lg px-5 py-4 hover:border-accent/40 hover:shadow-glow-sm transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
              {copied ? <Check size={18} className="text-success" /> : <Link2 size={18} className="text-accent" />}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-foreground block">
                {copied ? "Link Copied!" : "Copy Booking Link"}
              </span>
              <span className="text-xs text-muted-foreground truncate block">
                /book/{bookingSlug}
              </span>
            </div>
            <ExternalLink size={14} className="text-muted-foreground shrink-0" />
          </button>
        ) : (
          <a
            href="/settings"
            className="flex items-center gap-4 bg-card border border-border rounded-lg px-5 py-4 hover:border-accent/40 hover:shadow-glow-sm transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
              <Link2 size={18} className="text-accent" />
            </div>
            <div>
              <span className="text-sm font-semibold text-foreground block">Set Up Booking Link</span>
              <span className="text-xs text-muted-foreground">Configure in Settings</span>
            </div>
          </a>
        )}
        <a
          href="/upload"
          className="flex items-center gap-4 bg-card border border-border rounded-lg px-5 py-4 hover:border-accent/40 hover:shadow-glow-sm transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
            <Upload size={18} className="text-accent" />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground block">Upload Photos</span>
            <span className="text-xs text-muted-foreground">Upload edited photos from your desktop</span>
          </div>
        </a>
      </div>

      {/* Jobs Section */}
      <div data-tour="jobs-pipeline" className="border-t border-border pt-6">
        <div className="flex items-center justify-between mb-4">
          {searchOpen ? (
            <div className="flex-1 flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
              <Search size={16} className="text-muted-foreground shrink-0" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search address, agent..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
              <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <h2 className="font-heading text-xl font-semibold text-foreground">Jobs</h2>
              <button onClick={() => setSearchOpen(true)} className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary" aria-label="Search bookings">
                <Search size={18} />
              </button>
            </>
          )}
        </div>

        <div className="mb-5">
          <FilterChipBar chips={FILTER_CHIPS} active={activeFilter} onSelect={setActiveFilter} />
        </div>

        {bookingsLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="animate-shimmer h-16 rounded-lg" />)}
          </div>
        )}

        {!bookingsLoading && bookings.length === 0 && (
          <div className="border border-dashed border-border rounded-xl py-12 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-4 mx-auto">
              <Camera size={24} className="text-muted-foreground" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-foreground mb-2">No bookings yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {bookingUrl
                ? "Share your booking link with agents and bookings will appear here."
                : "Set up your profile and booking link in Settings to start accepting bookings."}
            </p>
          </div>
        )}

        {!bookingsLoading && noResults && (
          <div className="flex flex-col items-center py-12 text-center">
            <Search size={36} className="text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-2">No jobs match your search</p>
            <button
              onClick={() => { setActiveFilter("all"); setSearchQuery(""); setSearchOpen(false); }}
              className="text-sm text-accent hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {!bookingsLoading && bookings.length > 0 && !noResults && (
          <div className="space-y-8">
            <section>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={14} className="text-warning" />
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  Needs Your Action ({actionItems.length})
                </h3>
              </div>
              {actionItems.length > 0 ? (
                <div className="space-y-2 stagger-children">
                  {actionItems.map((b) => <BookingCard key={b.id} booking={b} />)}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center bg-card/50 rounded-lg border border-border/50">
                  You're all caught up
                </p>
              )}
            </section>

            <section>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  Waiting on Others ({waitingItems.length})
                </h3>
              </div>
              {waitingItems.length > 0 ? (
                <div className="space-y-2 stagger-children">
                  {waitingItems.map((b) => <BookingCard key={b.id} booking={b} />)}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center bg-card/50 rounded-lg border border-border/50">
                  No jobs waiting
                </p>
              )}
            </section>

            {completedItems.length > 0 && (
              <section>
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 hover:text-foreground transition-colors"
                >
                  <CheckCircle2 size={14} />
                  Completed ({completedItems.length})
                  <svg className={`w-4 h-4 transition-transform ${showCompleted ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                {showCompleted && (
                  <div className="space-y-2 stagger-children">
                    {completedItems.map((b) => <BookingCard key={b.id} booking={b} />)}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </>
  );
}
