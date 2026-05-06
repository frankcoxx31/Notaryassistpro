import React, { useState } from 'react';
import { X, Zap, Mail, Clock, Shield, Search, Loader2, Save, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { MarketingAutomation } from '../../types/marketing';

interface CreateAutomationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (automation: Omit<MarketingAutomation, 'id' | 'createdAt' | 'updatedAt' | 'executionStats'>) => Promise<void>;
  ownerId: string;
}

const CreateAutomationModal: React.FC<CreateAutomationModalProps> = ({ isOpen, onClose, onSave, ownerId }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    triggerType: 'contact_created' as MarketingAutomation['triggerType'],
    triggerConfig: {} as any,
    isActive: true
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await onSave({
        ownerId,
        name: formData.name,
        description: formData.description,
        triggerType: formData.triggerType,
        triggerConfig: formData.triggerConfig,
        status: formData.isActive ? 'active' : 'paused',
        steps: [] 
      });
      onClose();
    } catch (error) {
      console.error('Error creating automation:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-lg">
              <Zap className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">New Automation</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Automation Name</label>
            <input 
              type="text" 
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. New Client Welcome"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
            <input 
              type="text" 
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What does this automation do?"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Trigger Type</label>
            <select 
              value={formData.triggerType}
              onChange={(e) => setFormData({ ...formData, triggerType: e.target.value as any })}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="contact_created">When a new contact is added</option>
              <option value="campaign_sent">After a campaign is sent</option>
              <option value="link_clicked">When a link is clicked</option>
              <option value="scheduled">Scheduled (Date/Time)</option>
              <option value="manual">Manual Trigger</option>
            </select>
          </div>

          <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
             <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
               <Shield className="w-5 h-5" />
             </div>
             <div>
               <p className="text-xs font-bold text-slate-900 mb-0.5">Automated Intelligence</p>
               <p className="text-[10px] text-slate-500 font-medium leading-tight">
                 NotaryPro AI monitors your CRM in real-time to trigger these workflows automatically.
               </p>
             </div>
          </div>
        </form>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-shadow shadow-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{loading ? 'Creating...' : 'Create Flow'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default CreateAutomationModal;
