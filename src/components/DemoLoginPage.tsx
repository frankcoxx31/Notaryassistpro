import React, { useState } from 'react';
import { motion } from 'motion/react';
import { FileText, RefreshCw, ShieldCheck, Zap, ArrowRight, Info } from 'lucide-react';

interface DemoLoginPageProps {
  onEnterDemo: () => void;
  onResetDemo?: () => void;
}

const DemoLoginPage: React.FC<DemoLoginPageProps> = ({ onEnterDemo, onResetDemo }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleEnterDemo = () => {
    setIsLoading(true);
    // Simulate a brief loading state for better UX
    setTimeout(() => {
      onEnterDemo();
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen flex bg-slate-950 overflow-hidden font-sans">
      {/* Left Side: Demo Entry */}
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
              NotaryPro
            </h1>
            <p className="text-slate-400 text-sm font-medium">
              Professional Notary Management System
            </p>
          </div>

          {/* Demo Entry Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/50 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            
            <div className="space-y-8 relative z-10 text-center py-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-2">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Demo Version</span>
                </div>
                <h2 className="text-2xl font-bold text-white">Try Notary Pro</h2>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Explore the full platform features with pre-loaded sample data. 
                  All changes are saved locally in your browser.
                </p>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={handleEnterDemo}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-sky-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 group"
                >
                  {isLoading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  )}
                  <span>{isLoading ? 'Loading Demo...' : 'Enter Demo Mode'}</span>
                </button>
                
                <div className="flex flex-col items-center gap-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                    No account required • Private Local Storage
                  </p>
                </div>
              </div>

              <div className="pt-6 border-t border-white/5">
                <div className="flex items-start gap-3 text-left bg-slate-900/50 p-4 rounded-xl border border-white/5">
                  <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    This is a <span className="text-white font-bold">Demo Environment</span>. 
                    Authentication is disabled. To use your real data, please visit the production version.
                  </p>
                </div>
              </div>

              {onResetDemo && (
                <button 
                  onClick={onResetDemo}
                  className="text-[10px] font-bold text-slate-500 hover:text-rose-400 transition-colors uppercase tracking-widest"
                >
                  Reset Demo Data
                </button>
              )}
            </div>
          </div>

          <p className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
            Demo Environment | NotaryPro
          </p>
        </motion.div>
      </div>

      {/* Right Side: Visuals */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-600/20 to-indigo-900/40 mix-blend-overlay z-10" />
        <img 
          src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=2000" 
          alt="Professional Analytics"
          className="absolute inset-0 w-full h-full object-cover scale-105"
          loading="eager"
          referrerPolicy="no-referrer"
        />
        
        <div className="absolute inset-0 flex flex-col justify-end p-16 z-20 bg-gradient-to-t from-slate-950 via-transparent to-transparent">
          <div className="max-w-lg space-y-6">
            <h2 className="text-5xl font-bold text-white leading-tight">
              The Modern <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400">Notary Workspace</span>
            </h2>
            <p className="text-lg text-slate-300 font-medium leading-relaxed">
              Experience how easy it is to manage signings, track payments, and grow your notary business.
            </p>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                <ShieldCheck className="w-6 h-6 text-sky-400 mb-2" />
                <p className="text-sm font-bold text-white">Local Privacy</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Browser-only storage</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                <Zap className="w-6 h-6 text-amber-400 mb-2" />
                <p className="text-sm font-bold text-white">Instant Access</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">No signup needed</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoLoginPage;
