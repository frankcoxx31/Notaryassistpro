import React, { useState } from 'react';
import { 
  X, 
  Send, 
  Layers, 
  FileText, 
  Check, 
  ChevronRight, 
  ChevronLeft,
  Mail,
  Info,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';
import { cn } from '../../lib/utils';
import { MarketingSegment, MarketingTemplate } from '../../types/marketing';

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  segments: MarketingSegment[];
  templates: MarketingTemplate[];
}

type Step = 'details' | 'audience' | 'template' | 'confirm';

const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave,
  segments,
  templates
}) => {
  const [step, setStep] = useState<Step>('details');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    selectedSegmentIds: [] as string[],
    selectedTemplateId: ''
  });

  if (!isOpen) return null;

  const handleNext = () => {
    if (step === 'details') setStep('audience');
    else if (step === 'audience') setStep('template');
    else if (step === 'template') setStep('confirm');
  };

  const handleBack = () => {
    if (step === 'audience') setStep('details');
    else if (step === 'template') setStep('audience');
    else if (step === 'confirm') setStep('template');
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving campaign:', error);
    } finally {
      setLoading(false);
    }
  };

  const steps: { id: Step; label: string; icon: any }[] = [
    { id: 'details', label: 'Details', icon: Mail },
    { id: 'audience', label: 'Audience', icon: Layers },
    { id: 'template', label: 'Template', icon: FileText },
    { id: 'confirm', label: 'Review', icon: Check },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-lg">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Create New Campaign</h2>
              <p className="text-xs text-slate-500 font-medium tracking-wide border px-1.5 py-0.5 rounded border-slate-200 inline-block mt-0.5">STEP {steps.findIndex(s => s.id === step) + 1} OF 4</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Progress Stepper */}
        <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-center gap-12 overflow-x-auto scollbar-hide">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 relative">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                step === s.id ? "bg-indigo-600 text-white shadow-lg ring-4 ring-indigo-50" : 
                steps.findIndex(st => st.id === step) > i ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
              )}>
                {steps.findIndex(st => st.id === step) > i ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={cn(
                "text-sm font-semibold whitespace-nowrap",
                step === s.id ? "text-indigo-600" : "text-slate-400"
              )}>
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <div className="hidden sm:block absolute left-[120%] top-1/2 -translate-y-1/2 w-8 h-[2px] bg-slate-100" />
              )}
            </div>
          ))}
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          <AnimatePresence mode="wait">
            {step === 'details' && (
              <motion.div 
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 max-w-2xl mx-auto"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      Campaign Name
                      <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded uppercase font-bold">Internal Reference</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. July 2024 Newsletter"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      Subject Line
                      <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Visible to Users</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="What should your subscribers see in their inbox?"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                    />
                  </div>
                </div>

                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex gap-3">
                  <Info className="w-5 h-5 text-indigo-600 shrink-0" />
                  <p className="text-xs text-indigo-700 leading-relaxed font-medium">
                    A great subject line is short, personalized, and avoids "spammy" words like "FREE" or "URGENT". 
                    This helps your email land in the inbox instead of the spam folder.
                  </p>
                </div>
              </motion.div>
            )}

            {step === 'audience' && (
              <motion.div 
                key="audience"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="mb-6 text-center">
                  <h3 className="text-lg font-bold text-slate-900">Who should receive this?</h3>
                  <p className="text-slate-500 text-sm font-medium">Select one or more segments to target</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {segments.length > 0 ? (
                    segments.map((segment) => (
                      <div 
                        key={segment.id}
                        onClick={() => {
                          const ids = formData.selectedSegmentIds.includes(segment.id)
                            ? formData.selectedSegmentIds.filter(id => id !== segment.id)
                            : [...formData.selectedSegmentIds, segment.id];
                          setFormData({ ...formData, selectedSegmentIds: ids });
                        }}
                        className={cn(
                          "cursor-pointer p-4 rounded-xl border-2 transition-all group flex items-start gap-4",
                          formData.selectedSegmentIds.includes(segment.id)
                            ? "bg-indigo-50 border-indigo-600 shadow-md ring-4 ring-indigo-50" 
                            : "bg-white border-slate-100 hover:border-slate-200"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center transition-colors shadow-sm",
                          formData.selectedSegmentIds.includes(segment.id) ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                        )}>
                          <Layers className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{segment.name}</p>
                          <p className="text-[11px] text-slate-500 font-medium mb-2">{segment.description}</p>
                          <div className="inline-block px-2 py-0.5 bg-white border border-slate-100 rounded text-[10px] font-bold text-slate-400 group-hover:text-indigo-400">
                             {segment.subscriberCount || 0} SUBSCRIBERS
                          </div>
                        </div>
                        {formData.selectedSegmentIds.includes(segment.id) && (
                          <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                            <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 py-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                      <p className="text-slate-400 text-sm font-semibold italic">No segments found. Please create a segment first.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {step === 'template' && (
              <motion.div 
                key="template"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="mb-6 text-center">
                  <h3 className="text-lg font-bold text-slate-900">Choose a layout</h3>
                  <p className="text-slate-500 text-sm font-medium">Select the design for your email</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {templates.length > 0 ? (
                    templates.map((tpl) => (
                      <div 
                        key={tpl.id}
                        onClick={() => setFormData({ ...formData, selectedTemplateId: tpl.id })}
                        className={cn(
                          "cursor-pointer flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all group",
                          formData.selectedTemplateId === tpl.id 
                            ? "bg-indigo-50 border-indigo-600 shadow-md ring-4 ring-indigo-50" 
                            : "bg-white border-slate-100 hover:border-slate-200"
                        )}
                      >
                        <div className={cn(
                          "w-full aspect-[4/5] rounded-lg border border-slate-100 flex items-center justify-center transition-colors bg-slate-50",
                          formData.selectedTemplateId === tpl.id ? "bg-indigo-100" : "group-hover:bg-slate-100"
                        )}>
                          <FileText className={cn("w-10 h-10", formData.selectedTemplateId === tpl.id ? "text-indigo-600" : "text-slate-300")} />
                        </div>
                        <p className="text-xs font-bold text-slate-700 text-center uppercase tracking-tight group-hover:text-indigo-600 truncate w-full">
                          {tpl.name}
                        </p>
                      </div>
                    ))
                  ) : (
                    [{id: 'default', name: 'Default Plain'}].map((tpl) => (
                       <div 
                        key={tpl.id}
                        onClick={() => setFormData({ ...formData, selectedTemplateId: tpl.id })}
                        className={cn(
                          "cursor-pointer flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all group",
                          formData.selectedTemplateId === tpl.id 
                            ? "bg-indigo-50 border-indigo-600 shadow-md flex-1" 
                            : "bg-white border-slate-100 hover:border-slate-200 flex-1"
                        )}
                      >
                        <div className="w-full aspect-[4/5] rounded-lg border border-slate-100 flex items-center justify-center bg-slate-50">
                          <FileText className="w-10 h-10 text-slate-300" />
                        </div>
                        <p className="text-xs font-bold text-slate-700 uppercase">{tpl.name}</p>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {step === 'confirm' && (
              <motion.div 
                key="confirm"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8 max-w-xl mx-auto"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100 shadow-sm">
                    <Check className="w-8 h-8 stroke-[3px]" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Ready to go!</h3>
                  <p className="text-slate-500 text-sm font-medium">Review your campaign details before saving as a draft.</p>
                </div>

                <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="p-5 space-y-4">
                    <div className="flex items-start gap-4">
                       <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-100 shadow-sm shrink-0">
                         <Mail className="w-5 h-5 text-indigo-600" />
                       </div>
                       <div>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Campaign Info</p>
                         <h4 className="text-base font-bold text-slate-900">{formData.name}</h4>
                         <p className="text-sm text-slate-500 font-medium italic">"{formData.subject}"</p>
                       </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                       <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-100 shadow-sm shrink-0">
                         <Layers className="w-5 h-5 text-indigo-600" />
                       </div>
                       <div>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Target Audience</p>
                         <h4 className="text-sm font-bold text-slate-900">
                           {formData.selectedSegmentIds.length} Segments Selected
                         </h4>
                         <p className="text-xs text-indigo-600 font-medium">Approx. {formData.selectedSegmentIds.length * 12} recipients</p>
                       </div>
                    </div>

                    <div className="flex items-start gap-4">
                       <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-100 shadow-sm shrink-0">
                         <FileText className="w-5 h-5 text-indigo-600" />
                       </div>
                       <div>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Selected Design</p>
                         <h4 className="text-sm font-bold text-slate-900">
                           {templates.find(t => t.id === formData.selectedTemplateId)?.name || 'Default Template'}
                         </h4>
                       </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button 
            onClick={handleBack}
            disabled={step === 'details' || loading}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
              step === 'details' ? "invisible" : "text-slate-600 hover:bg-slate-200"
            )}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          
          <div className="flex items-center gap-3">
             <button 
                onClick={onClose}
                className="px-4 py-2 text-slate-500 text-sm font-bold hover:text-slate-700 transition-colors"
                disabled={loading}
              >
                Cancel
             </button>
             {step === 'confirm' ? (
                <button 
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Save as Draft
                </button>
             ) : (
                <button 
                  onClick={handleNext}
                  disabled={
                    (step === 'details' && (!formData.name || !formData.subject)) ||
                    (step === 'audience' && formData.selectedSegmentIds.length === 0) ||
                    (step === 'template' && !formData.selectedTemplateId)
                  }
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
             )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CreateCampaignModal;
