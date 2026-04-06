import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { FileText, User, ShieldCheck, Lock, Mail, Check } from 'lucide-react';
import { auth, provider } from '../firebase';
import { signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';

interface LoginPageProps {
  onSignIn?: () => void;
  onDemoSignIn?: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onSignIn, onDemoSignIn }) => {
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
      // Demo login check first (static logic)
      if (email === 'fcoxx@icclt.com' && password === 'airman31') {
        clearTimeout(timeoutId);
        if (onDemoSignIn) {
          onDemoSignIn();
        }
        return;
      }

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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md z-10"
      >
        {/* Glassmorphism Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 lg:p-10 shadow-2xl shadow-black/50">
          {/* Branding / Logo Placeholder */}
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/20 mb-6 group transition-transform hover:scale-105 duration-300">
              <FileText className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight text-center">
              Integrity Closings CLT
            </h1>
            <div className="h-1 w-12 bg-indigo-500 rounded-full mt-3 opacity-50" />
            <p className="text-slate-400 font-medium mt-3 text-sm uppercase tracking-[0.2em]">Notary Management</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSignIn} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                Email Address
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/10 transition-all duration-300"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                Password
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/10 transition-all duration-300"
                  required
                />
              </div>
            </div>

            {/* Remember Me Toggle */}
            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div 
                  onClick={() => setRememberMe(!rememberMe)}
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-all duration-200 ${
                    rememberMe 
                      ? 'bg-indigo-600 border-indigo-600' 
                      : 'border-white/20 bg-white/5 group-hover:border-white/40'
                  }`}
                >
                  {rememberMe && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">Remember Me</span>
              </label>
              <button type="button" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                Forgot Password?
              </button>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-center gap-3"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <p className="text-rose-400 text-xs font-medium">{error}</p>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3 text-lg ${
                isLoading ? 'opacity-70 cursor-not-allowed' : 'active:scale-[0.98]'
              }`}
            >
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-widest">
              <span className="bg-[#0f172a] px-4 text-white/30">Or</span>
            </div>
          </div>

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 text-white font-semibold py-4 px-6 rounded-2xl border border-white/10 transition-all duration-300 active:scale-[0.98]"
          >
            <User className="w-5 h-5 text-indigo-400" />
            <span>Sign in with Google</span>
          </button>
        </div>

        {/* Footer Info */}
        <div className="mt-10 flex flex-col items-center gap-4 text-white/20">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] uppercase tracking-widest font-bold">Secure Access</span>
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-center">
            Authorized Access Only | Integrity Closings CLT
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;

