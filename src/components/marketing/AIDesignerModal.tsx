import React, { useState } from 'react';
import { X, Sparkles, Send, Loader2, Wand2, ArrowRight, Save, Layout, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateEmailTemplate } from '../../services/aiService';
import { MarketingTemplate } from '../../types/marketing';
import { cn } from '../../lib/utils';

interface AIDesignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: Omit<MarketingTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  ownerId: string;
}

const AIDesignerModal: React.FC<AIDesignerModalProps> = ({ isOpen, onClose, onSave, ownerId }) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ name: string; htmlContent: string; category: string } | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    try {
      setLoading(true);
      const result = await generateEmailTemplate(prompt);
      setPreview(result);
    } catch (error) {
      console.error('Error generating template:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!preview || saving) return;

    try {
      setSaving(true);
      await onSave({
        ownerId,
        name: preview.name,
        category: preview.category,
        htmlContent: preview.htmlContent,
        thumbnail: ''
      });
      onClose();
    } catch (error) {
      console.error('Error saving template:', error);
    } finally {
      setSaving(false);
    }
  };

  const suggestions = [
    "Monthly market update for agents",
    "Welcome email for new mortgage brokers",
    "Review request for happy signers",
    "Holiday greeting for title companies"
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Notary AI Designer</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Powered by Gemini AI</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* Left: Input & Controls */}
          <div className="w-full lg:w-1/3 p-6 border-r border-slate-100 bg-slate-50/30 overflow-y-auto">
            <form onSubmit={handleGenerate} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">What should we build?</label>
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. A follow-up email for title companies after a successful signing..."
                  className="w-full h-32 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none transition-shadow placeholder:text-slate-300"
                />
              </div>

              <button 
                type="submit"
                disabled={loading || !prompt.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:shadow-none active:scale-95"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                <span>{loading ? 'Designing...' : 'Generate Template'}</span>
              </button>

              <div className="space-y-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inspiration</p>
                <div className="grid gap-2">
                  {suggestions.map((s, i) => (
                    <button 
                      key={i}
                      type="button"
                      onClick={() => setPrompt(s)}
                      className="text-left p-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-all hover:shadow-sm"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          </div>

          {/* Right: Preview */}
          <div className="flex-1 bg-slate-100 flex flex-col relative overflow-hidden">
            {!preview && !loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-slate-200 mb-6 shadow-sm">
                  <Layout className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-400 mb-2">Template Preview</h3>
                <p className="text-sm text-slate-400 max-w-xs">
                  Enter a prompt on the left to generate a professional notary email template.
                </p>
              </div>
            )}

            {loading && (
              <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm flex flex-col items-center justify-center p-12 text-center">
                 <div className="relative mb-6">
                    <div className="w-20 h-20 bg-indigo-600 rounded-full blur-2xl animate-pulse absolute inset-0"></div>
                    <div className="relative w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-xl">
                      <Sparkles className="w-8 h-8 animate-pulse" />
                    </div>
                 </div>
                 <h3 className="text-lg font-bold text-slate-900 mb-2">AI is Crafting...</h3>
                 <p className="text-sm text-slate-500 max-w-xs">
                   Designing layout, writing professional copy, and styling for all devices.
                 </p>
              </div>
            )}

            {preview && !loading && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{preview.name}</h4>
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">{preview.category}</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setPreview(null)}
                      className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                      title="Clear Preview"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 p-6 overflow-y-auto">
                  <div className="max-w-[600px] mx-auto bg-white shadow-sm ring-1 ring-slate-200 rounded-xl overflow-hidden min-h-full">
                    <iframe 
                      srcDoc={preview.htmlContent}
                      title="Email Preview"
                      className="w-full h-[600px] border-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-400">
             <Layout className="w-4 h-4" />
             <span className="text-xs font-medium">Desktop & Mobile Optimized</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="px-6 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="button" 
              disabled={!preview || saving}
              onClick={handleSave}
              className="px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Saving...' : 'Add to Templates'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AIDesignerModal;
