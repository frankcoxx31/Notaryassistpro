import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Mail, 
  Signature, 
  Bell, 
  User, 
  ShieldCheck, 
  Save, 
  Loader2,
  RefreshCw,
  Info,
  Check
} from 'lucide-react';
import { User as AuthUser } from 'firebase/auth';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { marketingService } from '../../services/marketingService';

interface PreferencesViewProps {
  user: AuthUser;
}

const PreferencesView: React.FC<PreferencesViewProps> = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState({
    fromName: '',
    fromEmail: '',
    replyTo: '',
    emailSignature: '',
    autoSyncEnabled: true,
    weeklyReport: true
  });

  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        setFetching(true);
        const prefs = await marketingService.getPreferences(user.uid);
        if (prefs) {
          setFormData({
            fromName: prefs.fromName || '',
            fromEmail: prefs.fromEmail || '',
            replyTo: prefs.replyTo || '',
            emailSignature: prefs.emailSignature || '',
            autoSyncEnabled: prefs.autoSyncEnabled ?? true,
            weeklyReport: prefs.weeklyReport ?? true
          });
        } else {
          // Default values if no prefs exist — use the signed-in user's own name/email
          setFormData({
            fromName: user.displayName || '',
            fromEmail: user.email || '',
            replyTo: user.email || '',
            emailSignature: '',
            autoSyncEnabled: true,
            weeklyReport: true
          });
        }
      } catch (error) {
        console.error('Error fetching defaults:', error);
      } finally {
        setFetching(false);
      }
    };
    fetchPrefs();
  }, [user]);

  const handleSave = async () => {
    try {
      setLoading(true);
      await marketingService.updatePreferences(user.uid, formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('Failed to save preferences.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Marketing Preferences</h2>
          <p className="text-slate-500 text-sm font-medium">Configure your sender details and list management</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          <span>{loading ? 'Saving...' : saved ? 'Preferences Saved' : 'Save Changes'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Sender Configuration */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/30 flex items-center gap-3">
               <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                 <Mail className="w-4 h-4 text-indigo-600" />
               </div>
               <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Sender Identity</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">From Name</label>
                  <input 
                    type="text" 
                    value={formData.fromName}
                    onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">From Email</label>
                  <input 
                    type="email" 
                    value={formData.fromEmail}
                    onChange={(e) => setFormData({ ...formData, fromEmail: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-50/20 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reply-To Email</label>
                  <input 
                    type="email" 
                    value={formData.replyTo}
                    onChange={(e) => setFormData({ ...formData, replyTo: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  />
                  <p className="text-[10px] text-slate-400">Where recipients will respond if they click 'Reply'</p>
                </div>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-slate-50 mt-4">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Signature</label>
                <textarea 
                  rows={4}
                  value={formData.emailSignature}
                  onChange={(e) => setFormData({ ...formData, emailSignature: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                />
                <p className="text-[10px] text-slate-400 italic">This will be appended to the bottom of all manual campaigns.</p>
              </div>
            </div>
          </div>

          {/* List Management */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/30 flex items-center gap-3">
               <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                 <RefreshCw className="w-4 h-4 text-emerald-600" />
               </div>
               <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Automation & Sync</h3>
            </div>
            <div className="p-6 space-y-6">
               <div className="flex items-center justify-between group">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">Auto-Sync CRM Contacts</p>
                    <p className="text-xs text-slate-500 font-medium">Automatically add new booking signers to your subscriber list.</p>
                  </div>
                  <button 
                    onClick={() => setFormData({ ...formData, autoSyncEnabled: !formData.autoSyncEnabled })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative ring-2 ring-slate-100 shadow-inner",
                      formData.autoSyncEnabled ? "bg-emerald-500" : "bg-slate-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all",
                      formData.autoSyncEnabled ? "left-7" : "left-1"
                    )}></div>
                  </button>
               </div>

               <div className="flex items-center justify-between group">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Weekly Marketing Report</p>
                    <p className="text-xs text-slate-500 font-medium">Receive a summary of email clicks and opens every Monday.</p>
                  </div>
                  <button 
                    onClick={() => setFormData({ ...formData, weeklyReport: !formData.weeklyReport })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative ring-2 ring-slate-100 shadow-inner",
                      formData.weeklyReport ? "bg-indigo-600" : "bg-slate-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all",
                      formData.weeklyReport ? "left-7" : "left-1"
                    )}></div>
                  </button>
               </div>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
           <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-2xl border border-indigo-200 shadow-sm ring-4 ring-indigo-50/50">
             <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="w-6 h-6 text-indigo-600" />
                <h4 className="font-bold text-indigo-900 leading-tight">Deliverability<br />Status</h4>
             </div>
             <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-700">
                  <span>SPF Record</span>
                  <span className="text-emerald-600 flex items-center gap-1"><Check className="w-3 h-3" /> VERIFIED</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold text-indigo-700">
                  <span>DKIM Keys</span>
                  <span className="text-emerald-600 flex items-center gap-1"><Check className="w-3 h-3" /> VERIFIED</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold text-indigo-700">
                  <span>DMARC Policy</span>
                  <span className="text-amber-600">PENDING</span>
                </div>
             </div>
             <div className="mt-8 pt-6 border-t border-indigo-200">
                <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mb-2">Technical Insight</p>
                <p className="text-xs text-indigo-800 leading-relaxed font-medium">
                  Verifying your domain ensures your emails look professional and avoid the "via mail-server" label in Gmail.
                </p>
             </div>
           </div>

           <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 flex gap-4">
              <Info className="w-5 h-5 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-800 font-medium leading-relaxed">
                Remember to comply with CAN-SPAM laws by including your physical business address in all marketing emails. We automatically include yours from your profile settings.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default PreferencesView;
