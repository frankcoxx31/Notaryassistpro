import React, { useState } from 'react';
import { X, Layers, Plus, Filter, Loader2, Info } from 'lucide-react';
import { motion } from 'motion/react';
import { MarketingSegment } from '../../types/marketing';
import { cn } from '../../lib/utils';

interface CreateSegmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (segment: Omit<MarketingSegment, 'id' | 'createdAt' | 'updatedAt' | 'subscriberCount'>) => Promise<void>;
  ownerId: string;
}

const CreateSegmentModal: React.FC<CreateSegmentModalProps> = ({ isOpen, onClose, onSave, ownerId }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isDynamic: true,
    rules: {
      tags: [] as string[],
      contactTypes: [] as string[]
    }
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
        isDynamic: formData.isDynamic,
        rules: [formData.rules],
        manualSubscriberIds: []
      });
      onClose();
    } catch (error) {
      console.error('Error creating segment:', error);
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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">New Segment</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Segment Name</label>
            <input 
              type="text" 
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. VIP Title Partners"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
            <textarea 
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Who is in this segment and why?"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
            />
          </div>

          <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 space-y-4">
             <div className="flex items-center gap-2 mb-2 text-indigo-700">
               <Filter className="w-4 h-4" />
               <span className="text-xs font-bold uppercase tracking-wider">Segmentation Rules</span>
             </div>
             <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
               Dynamic segments automatically include subscribers who match your criteria. Fixed segments require manual addition.
             </p>
             
             <div className="flex items-center bg-white p-1 rounded-lg border border-slate-200 shadow-sm w-fit">
               <button 
                 type="button"
                 onClick={() => setFormData({ ...formData, isDynamic: true })}
                 className={cn("px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all", formData.isDynamic ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400")}
               >
                 Dynamic
               </button>
               <button 
                 type="button"
                 onClick={() => setFormData({ ...formData, isDynamic: false })}
                 className={cn("px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all", !formData.isDynamic ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400")}
               >
                 Fixed
               </button>
             </div>
          </div>

          <div className="pt-4 flex items-center gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-shadow shadow-sm disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>{loading ? 'Creating...' : 'Create Segment'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default CreateSegmentModal;
