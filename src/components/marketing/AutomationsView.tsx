import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Plus, 
  History, 
  Play, 
  Pause, 
  ArrowRight,
  Clock,
  Mail,
  UserCheck,
  Star,
  Loader2
} from 'lucide-react';
import { User } from 'firebase/auth';
import { cn } from '../../lib/utils';
import { MarketingAutomation } from '../../types/marketing';
import { marketingService } from '../../services/marketingService';
import CreateAutomationModal from './CreateAutomationModal';

interface AutomationsViewProps {
  user: User;
  autoOpen?: boolean;
}

const AutomationsView: React.FC<AutomationsViewProps> = ({ user, autoOpen }) => {
  const [automations, setAutomations] = useState<MarketingAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(autoOpen || false);

  useEffect(() => {
    if (autoOpen) {
      setIsModalOpen(true);
    }
  }, [autoOpen]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await marketingService.getAutomations(user.uid);
      setAutomations(data);
    } catch (error) {
      console.error('Error fetching automations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.uid]);

  const handleSaveAutomation = async (automationData: Omit<MarketingAutomation, 'id' | 'createdAt' | 'updatedAt' | 'executionStats'>) => {
    await marketingService.addAutomation(automationData);
    await fetchData();
  };

  const getTriggerLabel = (type: MarketingAutomation['triggerType']) => {
    switch (type) {
      case 'contact_created': return 'On Contact Created';
      case 'campaign_sent': return 'After Campaign Sent';
      case 'link_clicked': return 'On Link Clicked';
      case 'scheduled': return 'Scheduled Time';
      case 'manual': return 'Manual Trigger';
      default: return type;
    }
  };

  const getRandomColorClass = (id: string) => {
    const colors = [
      'from-indigo-600 to-violet-700',
      'from-emerald-600 to-teal-700',
      'from-amber-500 to-orange-600',
      'from-rose-500 to-pink-600',
      'from-slate-700 to-slate-900'
    ];
    // Seeded random based on id
    const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Marketing Automations</h2>
          <p className="text-slate-500 text-sm font-medium">Create "Set it and Forget it" email sequences</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>New Automation</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {automations.map((flow) => (
            <div key={flow.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col group hover:border-indigo-300 transition-all">
              <div className={cn("h-32 bg-gradient-to-br p-6 relative overflow-hidden", getRandomColorClass(flow.id))}>
                <Zap className="absolute right-[-20px] bottom-[-20px] w-40 h-40 text-white/10 group-hover:scale-110 transition-transform duration-500" />
                <div className="relative z-10 flex items-start justify-between">
                  <div className="flex items-center gap-2 px-2 py-1 bg-white/20 backdrop-blur-md rounded-lg text-[10px] font-bold text-white uppercase tracking-wider border border-white/10">
                     {flow.status === 'active' ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3 fill-current" />}
                     {flow.status === 'active' ? 'Active' : 'Paused'}
                  </div>
                </div>
              </div>
              
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-4 mb-1">
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">{flow.name}</h3>
                </div>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-1">
                  <History className="w-3 h-3" />
                  {getTriggerLabel(flow.triggerType)}
                </p>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6 line-clamp-2">
                  {flow.description || 'No description provided.'}
                </p>

                <div className="mt-auto space-y-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">
                        <span>Campaign Health</span>
                        <span>{flow.steps.length} Steps</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: flow.steps.length > 0 ? '100%' : '0%' }}></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                     <button className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-colors">
                       Edit Workflow
                     </button>
                     <button className="p-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                       <ArrowRight className="w-4 h-4" />
                     </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {/* New Flow Placeholder */}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="rounded-2xl border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-400 hover:bg-slate-50 transition-all group min-h-[300px]"
          >
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-indigo-50 group-hover:scale-110 transition-all">
               <Plus className="w-8 h-8 group-hover:text-indigo-600" />
             </div>
             <p className="font-bold text-sm group-hover:text-indigo-600">Build Global Automation</p>
          </button>
        </div>
      )}

      {/* Featured Suggestion */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-8 text-white relative overflow-hidden">
         <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
         <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
           <div>
             <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest mb-6 border border-white/5">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                Featured Intelligence
             </div>
             <h3 className="text-3xl font-bold mb-4 tracking-tight leading-tight">AI-Powered<br />Notary Retention Flow</h3>
             <p className="text-slate-400 text-base mb-8 max-w-md font-medium leading-relaxed">
               Uses Gemini intelligence to analyze signing frequency and automatically sends personalized re-engagement emails when a client hasn't booked in 6 months.
             </p>
             <button className="px-8 py-3 bg-white text-slate-900 rounded-2xl font-bold text-sm hover:bg-slate-100 transition-shadow shadow-xl shadow-black/20 active:scale-95">
               Activate Automation
             </button>
           </div>
           
           <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Booking Confirmation', icon: Mail, bg: 'bg-white/5 border-white/10' },
                { label: 'Signer ID Verification', icon: UserCheck, bg: 'bg-white/5 border-white/10' },
                { label: 'Payment Receipt', icon: History, bg: 'bg-white/5 border-white/10' },
                { label: 'Review Collection', icon: Star, bg: 'bg-white/5 border-white/10' }
              ].map((card, i) => (
                <div key={i} className={cn("p-4 rounded-2xl border flex flex-col items-center gap-3 backdrop-blur-sm", card.bg)}>
                  <card.icon className="w-6 h-6 text-indigo-400" />
                  <span className="text-[10px] font-bold uppercase text-center text-slate-300">{card.label}</span>
                </div>
              ))}
           </div>
         </div>
      </div>

      <CreateAutomationModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveAutomation}
        ownerId={user.uid}
      />
    </div>
  );
};

export default AutomationsView;
