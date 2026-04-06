import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Timer, Shield } from "lucide-react";
import { z } from "zod";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const emailSchema = z.string().email("Please enter a valid email address");
const signUpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  username: z.string().min(4, "Username must be at least 4 characters"),
  fullName: z.string().min(4, "Full name must be at least 4 characters"),
});

const OTP_EXPIRY_SECONDS = 120;

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [otpValue, setOtpValue] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(false);

  const [signInData, setSignInData] = useState({ email: "" });
  const [signUpData, setSignUpData] = useState({ email: "", username: "", fullName: "" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) navigate("/");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (step !== "otp" || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { setCanResend(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step, countdown]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const startCountdown = () => { setCountdown(OTP_EXPIRY_SECONDS); setCanResend(false); };

  const handleSendOTP = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const email = activeTab === "signin" ? signInData.email : signUpData.email;
      if (activeTab === "signup") { signUpSchema.parse(signUpData); } else { emailSchema.parse(email); }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
        body: JSON.stringify({ email, type: activeTab }),
      });
      const data = await res.json();

      if (!res.ok) {
        const message = data.error || "Failed to send verification code";
        // Show user-friendly messages
        if (message.includes("not found") || message.includes("No account")) {
          toast({ title: "Account not found", description: "No account exists with this email. Please sign up first.", variant: "destructive" });
        } else if (message.includes("already") || message.includes("exists")) {
          toast({ title: "Account already exists", description: "An account with this email already exists. Try signing in instead.", variant: "destructive" });
        } else {
          toast({ title: "Something went wrong", description: message, variant: "destructive" });
        }
      } else {
        toast({ title: "Code sent!", description: `Check your email ${email} for the 6-digit code.` });
        setStep("otp"); setOtpValue(""); startCountdown();
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Please check your input", description: error.errors[0].message, variant: "destructive" });
      } else {
        toast({ title: "Something went wrong", description: "Please try again later.", variant: "destructive" });
      }
    } finally { setLoading(false); }
  };

  const handleVerifyOTP = async () => {
    if (otpValue.length !== 6) return;
    setLoading(true);
    try {
      const email = activeTab === "signin" ? signInData.email : signUpData.email;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
        body: JSON.stringify({ email, code: otpValue, type: activeTab, username: signUpData.username, fullName: signUpData.fullName }),
      });
      const data = await res.json();

      if (!res.ok) {
        const message = data.error || "Invalid or expired code";
        if (message.includes("expired")) {
          toast({ title: "Code expired", description: "Your verification code has expired. Please request a new one.", variant: "destructive" });
        } else if (message.includes("invalid") || message.includes("Invalid")) {
          toast({ title: "Incorrect code", description: "The code you entered is incorrect. Please check and try again.", variant: "destructive" });
        } else {
          toast({ title: "Verification failed", description: message, variant: "destructive" });
        }
        setLoading(false); return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password });
      if (signInError) {
        toast({ title: "Sign in failed", description: "Something went wrong. Please try again.", variant: "destructive" });
      } else {
        toast({ title: data.type === "signup_complete" ? "Welcome to Campus Voice!" : "Welcome back!", description: data.type === "signup_complete" ? "Your account has been created." : "You're now signed in." });
      }
    } catch {
      toast({ title: "Something went wrong", description: "Please try again later.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleBack = () => { setStep("email"); setOtpValue(""); setCountdown(0); };

  const currentEmail = activeTab === "signin" ? signInData.email : signUpData.email;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-6 md:gap-10 items-center">
        {/* Branding - hidden on mobile, compact on md */}
        <div className="hidden md:flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Campus Voice" loading="lazy" className="h-11 w-11 rounded-xl object-cover shadow-glow" />
            <div>
              <div className="text-xl font-extrabold tracking-wide bg-gradient-to-r from-orange-500 via-pink-500 to-blue-500 text-transparent bg-clip-text" style={{ fontFamily: "'Nixmat', sans-serif" }}>
                Campus Voice
              </div>
              <p className="text-xs text-muted-foreground">Your Voice, Your Campus</p>
            </div>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold leading-tight">Transform Campus<br />Together</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Join students sharing ideas, discussing solutions, and driving real change.
            </p>
            <div className="space-y-2 pt-2">
              {["Post issues and get community support", "Upvote solutions that matter", "Track campus campaigns", "Connect with fellow students"].map((f, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="text-xs text-muted-foreground">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile logo */}
        <div className="flex md:hidden items-center justify-center gap-2.5 mb-2">
          <img src="/logo.png" alt="Campus Voice" className="h-9 w-9 rounded-xl object-cover" />
          <div className="text-lg font-extrabold bg-gradient-to-r from-orange-500 via-pink-500 to-blue-500 text-transparent bg-clip-text" style={{ fontFamily: "'Nixmat', sans-serif" }}>
            Campus Voice
          </div>
        </div>

        {/* Auth Card */}
        <Card className="p-5 md:p-7 shadow-large rounded-2xl md:rounded-3xl border-border/50">
          {step === "otp" ? (
            <div className="space-y-5">
              <button onClick={handleBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>

              <div className="text-center space-y-1.5">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Verify your email</h2>
                <p className="text-xs text-muted-foreground">
                  Enter the 6-digit code sent to <span className="font-medium text-foreground">{currentEmail}</span>
                </p>
              </div>

              {/* Timer */}
              <div className="flex items-center justify-center gap-1.5">
                <Timer className={`h-3.5 w-3.5 ${countdown > 0 ? "text-primary" : "text-destructive"}`} />
                {countdown > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    Expires in <span className="font-bold text-foreground">{formatTime(countdown)}</span>
                  </span>
                ) : (
                  <span className="text-xs font-medium text-destructive">Code expired</span>
                )}
              </div>

              {/* OTP Input */}
              <div className="flex justify-center py-2">
                <InputOTP maxLength={6} value={otpValue} onChange={(value) => {
                  setOtpValue(value);
                  if (value.length === 6) setTimeout(() => handleVerifyOTP(), 100);
                }}>
                  <InputOTPGroup className="gap-2 md:gap-3">
                    <InputOTPSlot index={0} className="w-11 h-13 md:w-12 md:h-14 text-lg md:text-xl rounded-xl border-2 border-border/60 focus-within:border-primary" />
                    <InputOTPSlot index={1} className="w-11 h-13 md:w-12 md:h-14 text-lg md:text-xl rounded-xl border-2 border-border/60 focus-within:border-primary" />
                    <InputOTPSlot index={2} className="w-11 h-13 md:w-12 md:h-14 text-lg md:text-xl rounded-xl border-2 border-border/60 focus-within:border-primary" />
                  </InputOTPGroup>
                  <div className="flex items-center px-1.5">
                    <div className="w-3 h-0.5 rounded-full bg-border" />
                  </div>
                  <InputOTPGroup className="gap-2 md:gap-3">
                    <InputOTPSlot index={3} className="w-11 h-13 md:w-12 md:h-14 text-lg md:text-xl rounded-xl border-2 border-border/60 focus-within:border-primary" />
                    <InputOTPSlot index={4} className="w-11 h-13 md:w-12 md:h-14 text-lg md:text-xl rounded-xl border-2 border-border/60 focus-within:border-primary" />
                    <InputOTPSlot index={5} className="w-11 h-13 md:w-12 md:h-14 text-lg md:text-xl rounded-xl border-2 border-border/60 focus-within:border-primary" />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button onClick={handleVerifyOTP} disabled={loading || otpValue.length !== 6 || countdown === 0} className="w-full rounded-xl gradient-primary shadow-glow hover:shadow-large transition-smooth h-11 text-sm font-semibold">
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</> : "Verify & Continue"}
              </Button>

              <div className="text-center">
                <button onClick={() => handleSendOTP()} disabled={loading || !canResend} className={`text-xs transition-colors ${canResend ? "text-muted-foreground hover:text-primary cursor-pointer" : "text-muted-foreground/50 cursor-not-allowed"}`}>
                  {canResend ? <>Didn't get the code? <span className="font-medium underline">Resend</span></> : <>Resend in {formatTime(countdown)}</>}
                </button>
              </div>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "signin" | "signup")}>
              <TabsList className="grid w-full grid-cols-2 mb-6 rounded-full p-1 bg-muted h-10">
                <TabsTrigger value="signin" className="rounded-full text-sm">Sign In</TabsTrigger>
                <TabsTrigger value="signup" className="rounded-full text-sm">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSendOTP} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="signin-email" className="text-xs font-medium">Email</Label>
                    <Input id="signin-email" type="email" placeholder="you@university.edu.in" value={signInData.email}
                      onChange={(e) => setSignInData({ ...signInData, email: e.target.value })} required className="rounded-xl h-10 text-sm" />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full rounded-xl gradient-primary shadow-glow hover:shadow-large transition-smooth h-11 text-sm font-semibold">
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : "Send Verification Code"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSendOTP} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-username" className="text-xs font-medium">Username</Label>
                    <Input id="signup-username" type="text" placeholder="Choose a username" value={signUpData.username}
                      onChange={(e) => setSignUpData({ ...signUpData, username: e.target.value })} required className="rounded-xl h-10 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-fullname" className="text-xs font-medium">Full Name</Label>
                    <Input id="signup-fullname" type="text" placeholder="Your full name" value={signUpData.fullName}
                      onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })} required className="rounded-xl h-10 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-email" className="text-xs font-medium">Email</Label>
                    <Input id="signup-email" type="email" placeholder="you@university.edu.in" value={signUpData.email}
                      onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })} required className="rounded-xl h-10 text-sm" />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full rounded-xl gradient-primary shadow-glow hover:shadow-large transition-smooth h-11 text-sm font-semibold">
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : "Send Verification Code"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Auth;
