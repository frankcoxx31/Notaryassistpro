import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { FileText, User, ShieldCheck, Lock, Mail, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { auth, provider } from '../firebase';
import { signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';

interface LoginPageProps {
  onSignIn?: () => void;
  onEnterDemo?: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onSignIn, onEnterDemo }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // Throttling: prevent multiple clicks

    setIsLoading(true);
    setError('');

    // Create a new AbortController for this request
    abortControllerRef.current = new AbortController();
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        setError('Server timeout. Please try again later.');
        setIsLoading(false);
      }
    }, 7000); // 7 second timeout as requested

    try {
      // Real Firebase Auth
      await signInWithEmailAndPassword(auth, email, password);
      clearTimeout(timeoutId);
      if (onSignIn) onSignIn();
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        // Handled by timeout
      } else {
        console.error('Sign in error:', err);
        setError(err.message || 'Invalid email or password');
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleGoogleSignIn = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError('');

    // Create a new AbortController for this request
    abortControllerRef.current = new AbortController();
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        setError('Server timeout. Please try again later.');
        setIsLoading(false);
      }
    }, 7000);

    try {
      if (onSignIn) {
        onSignIn();
      } else {
        await signInWithPopup(auth, provider);
      }
      clearTimeout(timeoutId);
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        // Handled by timeout
      } else {
        console.error('Google sign in error:', err);
        setError('Google sign-in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950 overflow-hidden font-sans">
      {/* Left Side: Sign-In Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 relative z-10 bg-slate-950/50 backdrop-blur-3xl">
        {/* Subtle Background Glows */}
        <div className="absolute top-1/4 -left-20 w-64 h-64 bg-sky-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 -right-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md space-y-8"
        >
          {/* Branding */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-lg shadow-sky-500/20 mb-2">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Integrity Closings CLT
            </h1>
            <p className="text-slate-400 text-sm font-medium">
              Professional Notary Management System
            </p>
          </div>

          {/* Sign-In Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/50 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            
            <form onSubmit={handleSignIn} className="space-y-6 relative z-10">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all"
                        placeholder="name@company.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Password</label>
                      <button type="button" className="text-[10px] font-bold text-sky-400 hover:text-sky-300 uppercase tracking-wider transition-colors">Forgot?</button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input 
                        type="password" 
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-center gap-3"
                  >
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                    <p className="text-xs font-medium text-rose-200">{error}</p>
                  </motion.div>
                )}

                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id="remember" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-white/10 bg-slate-900 text-sky-500 focus:ring-sky-500/50" 
                  />
                  <label htmlFor="remember" className="text-xs font-medium text-slate-400 cursor-pointer">Remember this device</label>
                </div>

                <button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-sky-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <span>Sign In to Dashboard</span>
                  )}
                </button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold"><span className="bg-slate-900 px-4 text-slate-500">Or continue with</span></div>
                </div>

                <button 
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-3.5 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                  <span>Google Account</span>
                </button>

                {onEnterDemo && (
                  <div className="pt-4 mt-4 border-t border-white/5 space-y-4">
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Want to explore first?</p>
                      <button 
                        type="button"
                        onClick={onEnterDemo}
                        className="w-full bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 font-bold py-3.5 rounded-2xl transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-1 group"
                      >
                        <span className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          Try Demo Mode
                        </span>
                        <span className="text-[9px] font-medium text-sky-500/60 lowercase tracking-normal">
                          Explore with sample data saved only in this browser
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </form>
          </div>

          <p className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
            Authorized Access Only | Integrity Closings CLT
          </p>
        </motion.div>
      </div>

      {/* Right Side: Image & Branding */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-600/20 to-indigo-900/40 mix-blend-overlay z-10" />
        <img 
          src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=2000" 
          alt="Professional Analytics"
          className="absolute inset-0 w-full h-full object-cover scale-105 hover:scale-100 transition-transform duration-[10s] ease-out"
          loading="eager"
          referrerPolicy="no-referrer"
        />
        
        {/* Overlay Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-16 z-20 bg-gradient-to-t from-slate-950 via-transparent to-transparent">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="max-w-lg space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-500/30 backdrop-blur-md">
              <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <span className="text-[10px] font-bold text-sky-300 uppercase tracking-widest">System Online</span>
            </div>
            <h2 className="text-5xl font-bold text-white leading-tight">
              Secure & Reliable <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400">Notary Management</span>
            </h2>
            <p className="text-lg text-slate-300 font-medium leading-relaxed">
              Streamline your closings with our advanced platform designed for modern notary professionals.
            </p>
            <div className="flex items-center gap-8 pt-4">
              <div>
                <p className="text-2xl font-bold text-white">99.9%</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Uptime</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <p className="text-2xl font-bold text-white">256-bit</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Encryption</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <p className="text-2xl font-bold text-white">24/7</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monitoring</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

