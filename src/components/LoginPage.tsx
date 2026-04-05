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
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-500/10 rounded-full blur-[120px]" />
      
      <motion.div 
        key="login-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
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
              <span className="bg-[#0f172a] px-2 text-white/30">Or continue with</span>
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
  );
};

export default LoginPage;
