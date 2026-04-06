import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);
  
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Embedded styles for animated background and entrances */}
      <style>{`
        /* stronger, more visible gradient */
        .animated-gradient {
          background: linear-gradient(135deg,
            rgba(124,58,237,0.20) 0%,
            rgba(14,165,233,0.18) 35%,
            rgba(251,113,133,0.18) 70%,
            rgba(236,254,255,0.16) 100%);
          background-size: 400% 400%;
          animation: gradientShift 18s ease infinite;
          filter: saturate(1.08);
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(36px);
          opacity: 0.92; /* increased visibility */
          mix-blend-mode: screen;
          transform: translate3d(0,0,0);
          pointer-events: none;
        }

        .blob-1 {
          width: 480px;
          height: 480px;
          background: radial-gradient(circle at 20% 20%, rgba(124,58,237,0.95), rgba(91,33,182,0.85));
          top: -12%;
          left: -8%;
          animation: blobMove1 12s ease-in-out infinite;
        }
        .blob-2 {
          width: 420px;
          height: 420px;
          background: radial-gradient(circle at 80% 80%, rgba(6,182,212,0.92), rgba(8,145,178,0.82));
          bottom: -12%;
          right: -8%;
          animation: blobMove2 14s ease-in-out infinite;
        }
        .blob-3 {
          width: 320px;
          height: 320px;
          background: radial-gradient(circle at 50% 50%, rgba(251,113,133,0.94), rgba(239,68,68,0.84));
          top: 18%;
          right: 6%;
          animation: blobMove3 10s ease-in-out infinite;
        }

        @keyframes blobMove1 {
          0% { transform: translateY(0) translateX(0) scale(1); }
          50% { transform: translateY(28px) translateX(18px) scale(1.06) rotate(2deg); }
          100% { transform: translateY(0) translateX(0) scale(1); }
        }
        @keyframes blobMove2 {
          0% { transform: translateY(0) translateX(0) scale(.96); }
          50% { transform: translateY(-36px) translateX(-28px) scale(1.03) rotate(-3deg); }
          100% { transform: translateY(0) translateX(0) scale(.96); }
        }
        @keyframes blobMove3 {
          0% { transform: translateY(0) translateX(0) scale(1); }
          50% { transform: translateY(20px) translateX(-14px) scale(.99) rotate(1deg); }
          100% { transform: translateY(0) translateX(0) scale(1); }
        }

        /* floating particles (more visible) */
        .particle {
          position: absolute;
          background: rgba(255,255,255,0.75);
          width: 8px;
          height: 8px;
          border-radius: 50%;
          filter: blur(4px);
          animation: particleFloat 6.5s linear infinite;
          pointer-events: none;
          mix-blend-mode: screen;
        }
        .particle.p1 { left: 8%; top: 12%; animation-delay: 0s; transform-origin: center; }
        .particle.p2 { left: 78%; top: 22%; animation-delay: 0.9s; }
        .particle.p3 { left: 50%; top: 6%;  animation-delay: 1.8s; }
        .particle.p4 { left: 22%; top: 68%; animation-delay: 2.7s; }
        .particle.p5 { left: 72%; top: 78%; animation-delay: 3.6s; }
        @keyframes particleFloat {
          0% { transform: translateY(0) scale(1); opacity: .95; }
          25% { transform: translateY(-18px) translateX(6px) scale(.9); opacity: .7; }
          50% { transform: translateY(-36px) translateX(-6px) scale(.75); opacity: .45; }
          75% { transform: translateY(-18px) translateX(6px) scale(.9); opacity: .7; }
          100% { transform: translateY(0) scale(1); opacity: .95; }
        }

        /* moving decorative elements */
        .moving-shapes {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 10;
          overflow: visible;
        }
        .moving-shape {
          position: absolute;
          width: 18px;
          height: 18px;
          border-radius: 6px;
          background: rgba(255,255,255,0.12);
          mix-blend-mode: overlay;
          filter: blur(1px);
          animation: floatDrift 9s ease-in-out infinite;
        }
        .moving-shape.s1 { left: 12%; top: 40%; background: rgba(124,58,237,0.26); animation-delay: 0s; transform: rotate(12deg); }
        .moving-shape.s2 { left: 82%; top: 10%; background: rgba(6,182,212,0.24); animation-delay: 1.2s; transform: rotate(-8deg); }
        .moving-shape.s3 { left: 38%; top: 82%; background: rgba(251,113,133,0.26); animation-delay: 2.6s; transform: rotate(22deg); }
        .moving-shape.s4 { left: 60%; top: 48%; background: rgba(99,102,241,0.20); animation-delay: 3.5s; transform: rotate(-16deg); }
        .moving-shape.s5 { left: 28%; top: 18%; background: rgba(14,165,233,0.20); animation-delay: 4.4s; transform: rotate(6deg); }

        @keyframes floatDrift {
          0% { transform: translateY(0) rotate(var(--r, 0deg)) scale(1); opacity: .9; }
          50% { transform: translateY(-40px) translateX(18px) rotate(calc(var(--r, 0deg) + 12deg)) scale(.92); opacity: .6; }
          100% { transform: translateY(0) rotate(var(--r, 0deg)) scale(1); opacity: .9; }
        }

        /* subtle shooting streaks */
        .streak {
          position: absolute;
          height: 2px;
          width: 160px;
          background: linear-gradient(90deg, rgba(255,255,255,0.0), rgba(255,255,255,0.45), rgba(255,255,255,0.0));
          filter: blur(6px);
          transform: translateX(-220px) rotate(-6deg);
          animation: streakMove 6.8s linear infinite;
          pointer-events: none;
          mix-blend-mode: screen;
        }
        .streak.sA { top: 16%; left: 100%; animation-delay: 0s; width: 260px; }
        .streak.sB { top: 60%; left: 100%; animation-delay: 2.1s; width: 200px; transform: rotate(4deg) translateX(-220px); }
        @keyframes streakMove {
          0% { transform: translateX(-260px) rotate(-6deg); opacity: 0; }
          10% { opacity: .9; }
          50% { transform: translateX(20vw) rotate(-6deg); opacity: .4; }
          90% { opacity: .9; }
          100% { transform: translateX(140vw) rotate(-6deg); opacity: 0; }
        }

        /* faint orbiting rings */
        .ring {
          position: absolute;
          width: 110px;
          height: 110px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow: 0 0 40px rgba(124,58,237,0.08);
          pointer-events: none;
          mix-blend-mode: screen;
          animation: ringOrbit 14s linear infinite;
        }
        .ring.r1 { left: 8%; top: 55%; animation-duration: 16s; }
        .ring.r2 { right: 6%; top: 30%; animation-duration: 12s; transform: scale(.86); }

        @keyframes ringOrbit {
          0% { transform: translateY(0) rotate(0deg) scale(1); opacity: .85; }
          50% { transform: translateY(-28px) rotate(180deg) scale(1.06); opacity: .45; }
          100% { transform: translateY(0) rotate(360deg) scale(1); opacity: .85; }
        }

        .card-appear {
          animation: appearCard .9s cubic-bezier(.2,.8,.2,1) both;
          will-change: transform, opacity;
        }
        @keyframes appearCard {
          from { transform: translateY(14px) scale(.98); opacity: 0; }
          to { transform: none; opacity: 1; }
        }

        .code-path {
          background: rgba(255,255,255,0.06);
          padding: 0.125rem 0.5rem;
          border-radius: 6px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Source Code Pro", monospace;
        }

        /* ensure content sits above most decorations */
        .relative-z-top { z-index: 22; position: relative; }
      `}</style>

      {/* animated gradient base */}
      <div className="absolute inset-0 animated-gradient" aria-hidden />

      

      {/* colorful blurred blobs */}
      <div className="blob blob-1" aria-hidden />
      <div className="blob blob-2" aria-hidden />
      <div className="blob blob-3" aria-hidden />


      {/* main content */}
      <div className="relative z-20 flex min-h-screen items-center justify-center">
        <Card className="p-8 rounded-2xl shadow-soft max-w-3xl mx-4 card-appear relative-z-top">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              <div className="rounded-full bg-primary/10 text-primary p-4">
                <AlertCircle className="h-8 w-8" />
              </div>
            </div>

            <div className="text-center md:text-left">
              <h1 className="text-5xl font-extrabold tracking-tight">404</h1>
              <p className="mt-2 text-lg text-muted-foreground">Page not found</p>
              <p className="mt-4 text-sm text-muted-foreground">
                The page <span className="font-mono code-path px-2 py-1">{location.pathname}</span> does not exist or may have been moved.
              </p>

              <div className="mt-6 flex flex-col sm:flex-row items-center sm:items-start gap-3 justify-center md:justify-start">
                <Button onClick={() => navigate("/")}>Return Home</Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default NotFound;
