import { useState } from "react";
import {
  Camera,
  CalendarCheck,
  ImageDown,
  Smartphone,
  Globe,
  Zap,
  Shield,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";

/* ── Navigation ── */

function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/70 border-b border-border/30">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <span className="font-heading text-xl font-500 tracking-tight text-foreground">
          ShotReady
        </span>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          <a
            href="#features"
            className="text-sm text-muted-foreground hover:text-accent transition-colors"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-sm text-muted-foreground hover:text-accent transition-colors"
          >
            How It Works
          </a>
          <a
            href="/dashboard"
            className="text-sm font-medium text-foreground border border-border rounded-md px-4 py-2 hover:border-accent/50 hover:text-accent transition-colors"
          >
            Sign In
          </a>
          <a
            href="#get-started"
            className="text-sm font-medium text-accent-foreground bg-accent rounded-md px-4 py-2 hover:opacity-90 transition-opacity"
          >
            Get Started
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden p-2 text-foreground"
          aria-label="Toggle menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-border/30 bg-background/95 backdrop-blur-md px-6 py-4 space-y-3 animate-slide-in">
          <a
            href="#features"
            onClick={() => setOpen(false)}
            className="block text-sm text-muted-foreground"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            onClick={() => setOpen(false)}
            className="block text-sm text-muted-foreground"
          >
            How It Works
          </a>
          <a
            href="/dashboard"
            className="block text-sm font-medium text-foreground"
          >
            Sign In
          </a>
          <a
            href="#get-started"
            onClick={() => setOpen(false)}
            className="block text-sm font-medium text-center text-accent-foreground bg-accent rounded-md px-4 py-2.5"
          >
            Get Started
          </a>
        </div>
      )}
    </nav>
  );
}

/* ── Hero ── */

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
      {/* Full-bleed background image */}
      <div className="absolute inset-0">
        <img
          src="/images/hero-twilight.jpg"
          alt="Luxury home photographed at twilight"
          className="w-full h-full object-cover"
        />
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
        {/* Enlarger glow — warm amber radial from center */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(212,165,116,0.08) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        <p className="text-xs font-body font-500 tracking-[0.2em] uppercase text-accent mb-6 animate-slide-in">
          Real Estate Photography OS
        </p>
        <h1
          className="font-heading text-5xl md:text-7xl lg:text-8xl font-500 text-foreground leading-[1.05] tracking-tight mb-6 animate-slide-in"
          style={{ animationDelay: "100ms" }}
        >
          Every Shot, <br className="hidden sm:block" />
          <span className="italic">Developed</span> to Perfection
        </h1>
        <p
          className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto mb-10 animate-slide-in"
          style={{ animationDelay: "200ms" }}
        >
          The complete operating system for independent listing photographers.
          Agents book, you shoot, photos get processed and delivered — all from
          your phone.
        </p>
        <div
          className="flex flex-col sm:flex-row gap-3 justify-center animate-slide-in"
          style={{ animationDelay: "300ms" }}
        >
          <a
            href="#get-started"
            className="btn-accent inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-accent text-accent-foreground font-body text-sm font-600 tracking-[0.05em] uppercase rounded-md"
          >
            Get Started Free
            <ChevronRight size={16} />
          </a>
          <a
            href="#how-it-works"
            className="btn-accent inline-flex items-center justify-center px-8 py-3.5 border border-border text-foreground font-body text-sm font-600 tracking-[0.05em] uppercase rounded-md hover:border-accent/50 hover:text-accent"
          >
            See How It Works
          </a>
        </div>
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32"
        style={{
          background: "linear-gradient(to top, hsl(20 11% 5%), transparent)",
        }}
      />
    </section>
  );
}

/* ── Photo Showcase Strip ── */

function PhotoStrip() {
  const photos = [
    { src: "/images/feature-exterior.jpg", alt: "Modern home with pool" },
    { src: "/images/feature-interior.jpg", alt: "Bright modern kitchen" },
    { src: "/images/feature-living.jpg", alt: "Sunlit living room" },
  ];

  return (
    <section className="py-8 px-6 reveal">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          {photos.map((p, i) => (
            <div
              key={p.alt}
              className="rounded-lg overflow-hidden photo-glow animate-develop"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <img
                src={p.src}
                alt={p.alt}
                className="w-full h-40 md:h-56 object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Features ── */

const features = [
  {
    icon: CalendarCheck,
    title: "Branded Booking",
    description:
      "Agents book through your branded page — your logo, your colors, your packages. One link, no account needed.",
    accent: true,
  },
  {
    icon: Smartphone,
    title: "Field Mode",
    description:
      "Shot list checklist on your phone. Track every room, mark angles complete, never miss a deliverable.",
  },
  {
    icon: ImageDown,
    title: "Photo Proofing",
    description:
      "Agents review watermarked photos, select their favorites, and approve — all from the same booking link.",
  },
  {
    icon: Zap,
    title: "Automated Processing",
    description:
      "Upload from Lightroom, thumbnails and watermarks generate automatically. MLS-compliant delivery with one tap.",
    accent: true,
  },
  {
    icon: Globe,
    title: "Route Optimization",
    description:
      "Plan multi-shoot days with optimized routes and golden hour lighting windows.",
  },
  {
    icon: Shield,
    title: "Invoicing & Payments",
    description:
      "Draft invoices from booking data, send via Stripe, and track payments — all within the app.",
  },
];

function Features() {
  return (
    <section id="features" className="py-24 md:py-32 px-6 reveal">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-body font-500 tracking-[0.2em] uppercase text-accent mb-3">
            Everything You Need
          </p>
          <h2 className="font-heading text-3xl md:text-5xl font-500 text-foreground tracking-tight">
            One App, Entire Workflow
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {features.map((f) => (
            <div
              key={f.title}
              className={`group bg-card border border-border rounded-lg p-6 md:p-8 transition-all duration-[var(--duration-normal)] hover:border-accent/30 hover:shadow-glow-sm ${
                f.accent ? "lg:col-span-1" : ""
              }`}
            >
              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center mb-4 group-hover:bg-accent/10 transition-colors">
                <f.icon size={20} className="text-accent" />
              </div>
              <h3 className="font-heading text-xl font-600 text-card-foreground mb-2">
                {f.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── How It Works ── */

const steps = [
  {
    num: "01",
    icon: Camera,
    title: "Agent Books a Shoot",
    description:
      "Share your booking link. Agents pick a package, choose a date, and submit — no account needed.",
  },
  {
    num: "02",
    icon: Smartphone,
    title: "You Shoot & Upload",
    description:
      "Field mode guides your shoot. Export from Lightroom, drag into the web companion, and photos process automatically.",
  },
  {
    num: "03",
    icon: ImageDown,
    title: "Agent Reviews & Pays",
    description:
      "Agents proof photos from the same booking link, approve their selection, download the MLS-ready ZIP, and pay via Stripe.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 md:py-32 px-6 reveal">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-body font-500 tracking-[0.2em] uppercase text-accent mb-3">
            Simple Workflow
          </p>
          <h2 className="font-heading text-3xl md:text-5xl font-500 text-foreground tracking-tight">
            Three Steps. Every Time.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 stagger-children">
          {steps.map((s) => (
            <div key={s.num} className="text-center md:text-left">
              <span className="inline-block font-heading text-5xl font-500 text-accent/20 mb-4">
                {s.num}
              </span>
              <div className="w-12 h-12 rounded-lg bg-card border border-border flex items-center justify-center mx-auto md:mx-0 mb-4">
                <s.icon size={22} className="text-accent" />
              </div>
              <h3 className="font-heading text-lg font-600 text-foreground mb-2">
                {s.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA ── */

function FinalCta() {
  return (
    <section id="get-started" className="py-24 md:py-32 px-6 reveal">
      <div className="max-w-3xl mx-auto bg-card border border-border rounded-xl p-12 md:p-16 text-center relative overflow-hidden">
        {/* Enlarger glow behind CTA */}
        <div
          className="absolute inset-0 pointer-events-none rounded-xl"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(212,165,116,0.06) 0%, transparent 70%)",
          }}
        />
        <div className="relative z-10">
          <h2 className="font-heading text-3xl md:text-4xl font-500 text-foreground tracking-tight mb-4">
            Ready to Streamline Your Shoots?
          </h2>
          <p className="text-muted-foreground text-sm md:text-base mb-8 max-w-lg mx-auto leading-relaxed">
            Join photographers who spend less time on admin and more time behind
            the lens. Set up takes five minutes.
          </p>
          <a
            href="/dashboard"
            className="btn-accent inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-accent text-accent-foreground font-body text-sm font-600 tracking-[0.05em] uppercase rounded-md"
          >
            Get Started Free
            <ChevronRight size={16} />
          </a>
          <p className="text-muted-foreground/60 text-xs mt-4">
            No credit card required
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ── */

function Footer() {
  return (
    <footer className="border-t border-border/50 px-6 py-8">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="font-heading text-base font-500 text-foreground tracking-tight">
          ShotReady
        </span>
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} ShotReady. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

/* ── Page ── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <PhotoStrip />
      <Features />
      <HowItWorks />
      <FinalCta />
      <Footer />
    </div>
  );
}
