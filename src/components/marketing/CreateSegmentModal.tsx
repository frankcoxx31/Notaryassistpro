import React, { useState } from 'react';
import { X, Layers, Plus, Filter, Loader2, Info, Search, User, Check, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MarketingSegment, Subscriber } from '../../types/marketing';
import { cn } from '../../lib/utils';

interface CreateSegmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (segment: Omit<MarketingSegment, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  ownerId: string;
  availableSubscribers: Subscriber[];
  initialData?: MarketingSegment | null;
}

const CreateSegmentModal: React.FC<CreateSegmentModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  ownerId,
  availableSubscribers,
  initialData
}) => {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    isDynamic: initialData ? initialData.isDynamic : true,
    rules: (initialData?.rules?.[0]) || {
      tags: [] as string[],
      contactTypes: [] as string[]
    },
    manualSubscriberIds: initialData?.manualSubscriberIds || [] as string[]
  });

  // Update formData if initialData changes (e.g. when opening "edit")
  React.useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        description: initialData.description || '',
        isDynamic: initialData.isDynamic,
        rules: (initialData.rules?.[0]) || {
          tags: [] as string[],
          contactTypes: [] as string[]
        },
        manualSubscriberIds: initialData.manualSubscriberIds || []
      });
    } else {
      setFormData({
        name: '',
        description: '',
        isDynamic: true,
        rules: { tags: [], contactTypes: [] },
        manualSubscriberIds: []
      });
    }
  }, [initialData]);

  const [tagInput, setTagInput] = useState('');

  if (!isOpen) return null;

  const contactTypes = [
    { id: 'title_rep', name: 'Title Rep' },
    { id: 'realtor', name: 'Realtor' },
    { id: 'loan_officer', name: 'Loan Officer' },
    { id: 'direct_seller', name: 'Direct Seller' },
    { id: 'other', name: 'Other' }
  ];

  const filteredSubscribers = availableSubscribers.filter(sub => 
    sub.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sub.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleContactType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      rules: {
        ...prev.rules,
        contactTypes: prev.rules.contactTypes.includes(type)
          ? prev.rules.contactTypes.filter((t: string) => t !== type)
          : [...prev.rules.contactTypes, type]
      }
    }));
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.rules.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        rules: {
          ...prev.rules,
          tags: [...prev.rules.tags, tagInput.trim()]
        }
      }));
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      rules: {
        ...prev.rules,
        tags: prev.rules.tags.filter((t: string) => t !== tag)
      }
    }));
  };

  const toggleSubscriber = (subId: string) => {
    setFormData(prev => ({
      ...prev,
      manualSubscriberIds: prev.manualSubscriberIds.includes(subId)
        ? prev.manualSubscriberIds.filter(id => id !== subId)
        : [...prev.manualSubscriberIds, subId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);

      let count = 0;
      if (formData.isDynamic) {
        // Calculate dynamic count
        const { tags = [], contactTypes = [] } = formData.rules;
        count = availableSubscribers.filter(sub => {
          const matchesTags = tags.length === 0 || (sub.tags && tags.some((t: string) => sub.tags.includes(t)));
          const matchesTypes = contactTypes.length === 0 || contactTypes.includes(sub.contactType);
          return matchesTags && matchesTypes;
        }).length;
      } else {
        count = formData.manualSubscriberIds.length;
      }

      await onSave({
        ownerId,
        name: formData.name,
        description: formData.description,
        isDynamic: formData.isDynamic,
        rules: formData.isDynamic ? [formData.rules] : [],
        manualSubscriberIds: formData.isDynamic ? [] : formData.manualSubscriberIds,
        subscriberCount: count
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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">{initialData ? 'Edit Segment' : 'New Segment'}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
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
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Who is in this segment and why?"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                />
              </div>

              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 space-y-4">
                 <div className="flex items-center gap-2 mb-2 text-indigo-700">
                   <Filter className="w-4 h-4" />
                   <span className="text-xs font-bold uppercase tracking-wider">Type</span>
                 </div>
                 
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
            </div>

            <div className="space-y-4">
              {formData.isDynamic ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                   <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Types</label>
                    <div className="flex flex-wrap gap-2">
                      {contactTypes.map(type => (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => toggleContactType(type.id)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all",
                            formData.rules.contactTypes.includes(type.id)
                              ? "bg-indigo-100 border-indigo-200 text-indigo-700"
                              : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                          )}
                        >
                          {type.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Tags</label>
                    <div className="flex gap-2 mb-2">
                      <input 
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                        placeholder="Add a tag..."
                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none"
                      />
                      <button 
                        type="button"
                        onClick={addTag}
                        className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {formData.rules.tags.map((tag: string) => (
                        <div 
                          key={tag} 
                          className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold"
                        >
                          <Tag className="w-3 h-3" />
                          <span>{tag}</span>
                          <button 
                            type="button" 
                            onClick={() => removeTag(tag)}
                            className="ml-1 text-slate-400 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {formData.rules.tags.length === 0 && (
                        <p className="text-[10px] text-slate-400 italic">No tags selected (matches all if empty)</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 animate-in fade-in slide-in-from-right-2 flex flex-col h-[350px]">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Select Subscribers</label>
                  <div className="relative shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name or email..."
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto border border-slate-100 rounded-xl bg-slate-50/30 p-2 space-y-1">
                    {filteredSubscribers.length === 0 ? (
                      <div className="py-8 text-center">
                        <User className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                        <p className="text-xs text-slate-400 font-medium">No subscribers found</p>
                      </div>
                    ) : (
                      filteredSubscribers.map(sub => {
                        const isSelected = formData.manualSubscriberIds.includes(sub.id);
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => toggleSubscriber(sub.id)}
                            className={cn(
                              "w-full flex items-center justify-between p-2 rounded-lg text-left transition-all",
                              isSelected ? "bg-white shadow-sm border-indigo-100 border ring-1 ring-indigo-500/5" : "hover:bg-slate-100"
                            )}
                          >
                            <div className="min-w-0">
                              <p className={cn("text-xs font-bold truncate", isSelected ? "text-indigo-600" : "text-slate-700")}>{sub.fullName}</p>
                              <p className="text-[10px] text-slate-400 truncate">{sub.email}</p>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                  <div className="px-1 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                    <span>{formData.manualSubscriberIds.length} Selected</span>
                    <button 
                      type="button" 
                      onClick={() => setFormData(prev => ({ ...prev, manualSubscriberIds: [] }))}
                      className="text-indigo-600 hover:text-indigo-700"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center gap-3 shrink-0 bg-slate-50/30">
          <button 
            type="button" 
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading || !formData.name || (!formData.isDynamic && formData.manualSubscriberIds.length === 0)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-shadow shadow-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>{loading ? (initialData ? 'Updating...' : 'Creating...') : (initialData ? 'Update Segment' : 'Create Segment')}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default CreateSegmentModal;
