import React from 'react';
import { X, Layout, Smartphone, Monitor, Copy, CheckCircle2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MarketingTemplate } from '../../types/marketing';
import { cn } from '../../lib/utils';

interface TemplatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: MarketingTemplate | null;
}

const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({ isOpen, onClose, template }) => {
  const [viewMode, setViewMode] = React.useState<'desktop' | 'mobile'>('desktop');
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !template) return null;

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(template.htmlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-4">
            <div className={cn(
              "p-2 rounded-lg",
              template.category === 'Marketing' ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-600"
            )}>
              <Layout className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{template.name}</h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{template.category}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Saved {new Date(template.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl mr-4">
              <button 
                onClick={() => setViewMode('desktop')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  viewMode === 'desktop' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('mobile')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  viewMode === 'mobile' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
            
            <button 
              onClick={handleCopyHtml}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Copy HTML'}</span>
            </button>
            
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors ml-2">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-slate-100 p-8 overflow-y-auto flex items-start justify-center">
          <motion.div 
            animate={{ width: viewMode === 'desktop' ? '100%' : '375px' }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className={cn(
              "bg-white shadow-2xl rounded-2xl overflow-hidden transition-all duration-500",
              viewMode === 'desktop' ? "max-w-[800px]" : "h-[667px]"
            )}
          >
            <iframe 
              srcDoc={template.htmlContent}
              title="Template Preview"
              className="w-full h-full min-h-[600px] border-none"
            />
          </motion.div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500 font-medium">
            This preview shows how your template will appear in your recipient's inbox.
          </p>
          <div className="flex items-center gap-3">
             <button 
               onClick={onClose}
               className="px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95"
             >
               Close Preview
             </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default TemplatePreviewModal;
