import React from 'react';
import { motion } from 'motion/react';
import { FileText, User, ShieldCheck, Zap, Globe } from 'lucide-react';
import { auth, provider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';

interface LoginPageProps {
  onSignIn?: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onSignIn }) => {
  const handleSignIn = async () => {
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

          {/* Features */}
          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Secure Cloud Storage</h3>
                <p className="text-xs text-white/40">Your data is encrypted and backed up automatically.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Real-time Sync</h3>
                <p className="text-xs text-white/40">Access your business from any device, anywhere.</p>
              </div>
            </div>
          </div>

          {/* Sign In Button */}
          <button
            onClick={handleSignIn}
            className="w-full group relative flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 shadow-lg shadow-indigo-600/20 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <User className="w-5 h-5" />
            <span>Sign In with Google</span>
          </button>

          <p className="text-center text-white/30 text-xs mt-6">
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
