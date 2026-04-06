import React from 'react';
import { motion } from 'motion/react';
import { FileText, User, ShieldCheck, Zap, Globe } from 'lucide-react';
import { auth, provider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';

interface LoginPageProps {
  onSignIn?: () => void;
  onDemoSignIn?: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onSignIn, onDemoSignIn }) => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');

  const handleDemoSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === 'fcoxx@icclt.com' && password === 'airman31') {
      if (onDemoSignIn) {
        onDemoSignIn();
      }
    } else {
      setError('Invalid username or password');
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      if (onSignIn) {
        onSignIn();
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950 overflow-hidden">
      {/* Left Side: Sign In Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-16 z-10 relative">
        {/* Animated Background Decorative Elements for Left Side */}
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.15, 0.1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-10%] w-[80%] h-[80%] bg-indigo-500/10 rounded-full blur-[120px] z-0" 
        />

        <motion.div 
          key="login-card"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md z-10"
        >
          <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-[0_0_50px_-12px_rgba(79,70,229,0.3)]">
            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-600/20 mb-4">
                <FileText className="w-10 h-10 text-amber-400" />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">NotaryPro</h1>
              <p className="text-amber-400/60 font-medium mt-1">Professional Notary Management</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleDemoSignIn} className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5 ml-1">
                  Username
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="fcoxx@icclt.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5 ml-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  required
                />
              </div>
              {error && (
                <p className="text-rose-400 text-xs font-medium ml-1">{error}</p>
              )}
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg shadow-indigo-600/20"
              >
                Sign In
              </button>
            </form>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900 px-2 text-white/30">Or continue with</span>
              </div>
            </div>

            {/* Google Sign In Button */}
            <button
              onClick={handleGoogleSignIn}
              className="w-full group relative flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 text-white font-semibold py-3 px-6 rounded-xl border border-white/10 transition-all duration-300"
            >
              <User className="w-5 h-5 text-amber-400" />
              <span>Google Account</span>
            </button>

            <p className="text-center text-white/30 text-[10px] mt-6">
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>

          {/* Footer Info */}
          <div className="mt-8 flex justify-center gap-6 text-white/20">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <span className="text-xs">Global Access</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs">Enterprise Security</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right Side: Image and Branding */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <motion.div
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <img 
            src="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&q=80&w=2000" 
            alt="Professional Notary Workspace"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-slate-950/20 via-slate-950/40 to-slate-950" />
        </motion.div>

        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-widest mb-6">
              <Zap className="w-3 h-3" /> Built for Professionals
            </div>
            <h2 className="text-5xl font-bold leading-tight mb-6">
              Manage your notary <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-amber-400">
                business with ease.
              </span>
            </h2>
            <p className="text-xl text-white/60 max-w-lg leading-relaxed mb-8">
              The all-in-one platform for professional notaries to track signings, 
              manage clients, and handle accounting in one secure place.
            </p>
            
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h4 className="text-amber-400 font-bold text-2xl mb-1">100%</h4>
                <p className="text-white/40 text-sm">Secure Data Storage</p>
              </div>
              <div>
                <h4 className="text-indigo-400 font-bold text-2xl mb-1">Real-time</h4>
                <p className="text-white/40 text-sm">Sync Across Devices</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Decorative overlay elements */}
        <div className="absolute top-0 right-0 p-12">
          <div className="w-32 h-32 border-t-2 border-r-2 border-white/10 rounded-tr-3xl" />
        </div>
        <div className="absolute bottom-0 left-0 p-12">
          <div className="w-32 h-32 border-b-2 border-l-2 border-white/10 rounded-bl-3xl" />
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
