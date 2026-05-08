import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Layout, 
  Palette, 
  Code, 
  Eye, 
  MoreVertical,
  CheckCircle2,
  Clock,
  Sparkles,
  Loader2
} from 'lucide-react';
import { User } from 'firebase/auth';
import { cn } from '../../lib/utils';
import { MarketingTemplate } from '../../types/marketing';
import { marketingService } from '../../services/marketingService';
import CreateTemplateModal from './CreateTemplateModal';
import AIDesignerModal from './AIDesignerModal';
import TemplatePreviewModal from './TemplatePreviewModal';
import EditTemplateModal from './EditTemplateModal';

interface TemplatesViewProps {
  user: User;
  autoOpen?: boolean;
}

const TemplatesView: React.FC<TemplatesViewProps> = ({ user, autoOpen }) => {
  const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(autoOpen || false);

  useEffect(() => {
    if (autoOpen) {
      setIsModalOpen(true);
    }
  }, [autoOpen]);
  const [isAiDesignerOpen, setIsAiDesignerOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<MarketingTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<MarketingTemplate | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All Templates');

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await marketingService.getTemplates(user.uid);
      setTemplates(data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.uid]);

  const handleSaveTemplate = async (templateData: Omit<MarketingTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    await marketingService.addTemplate(templateData);
    await fetchData();
  };

  const handlePreviewTemplate = (template: MarketingTemplate) => {
    setPreviewTemplate(template);
    setIsPreviewOpen(true);
  };

  const handleEditTemplate = (template: MarketingTemplate) => {
    setEditingTemplate(template);
    setIsEditOpen(true);
  };

  const handleUpdateTemplate = async (id: string, updates: Partial<MarketingTemplate>) => {
    await marketingService.updateTemplate(id, updates);
    await fetchData();
  };

  const categories = ['All Templates', 'Marketing', 'Transactional', 'System', 'Custom'];

  const filteredTemplates = selectedCategory === 'All Templates' 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

  const getStatusColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'marketing': return 'bg-indigo-50 text-indigo-600';
      case 'transactional': return 'bg-slate-100 text-slate-600';
      case 'system': return 'bg-amber-50 text-amber-600';
      case 'custom': return 'bg-emerald-50 text-emerald-600';
      default: return 'bg-slate-50 text-slate-400';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Email Templates</h2>
          <p className="text-slate-500 text-sm font-medium">Professional layouts for consistent notary branding</p>
        </div>
        <div className="flex items-center gap-2">
           <button 
            onClick={() => setIsAiDesignerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>AI Designer</span>
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Create New</span>
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-slate-100">
        {categories.map((cat, i) => (
          <button 
            key={i}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
              selectedCategory === cat ? "bg-slate-900 text-white shadow-md shadow-slate-200" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* New Template Card */}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="aspect-[3/4] rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-8 group hover:border-indigo-400 hover:bg-indigo-50/20 transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-indigo-50 transition-all">
              <Plus className="w-6 h-6 text-slate-400 group-hover:text-indigo-600" />
            </div>
            <p className="text-sm font-bold text-slate-400 group-hover:text-indigo-600">Start from Scratch</p>
          </button>

          {filteredTemplates.map((tpl) => (
            <div key={tpl.id} className="aspect-[3/4] bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col group hover:ring-2 hover:ring-indigo-500/20 hover:border-indigo-500 transition-all">
              <div className="flex-1 bg-slate-50 relative flex items-center justify-center p-12 overflow-hidden border-b border-slate-100">
                <FileText className="w-20 h-20 text-slate-200 group-hover:scale-110 group-hover:text-indigo-200 transition-all duration-500" />
                
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
                   <button 
                    onClick={() => handlePreviewTemplate(tpl)}
                    className="p-3 bg-white text-slate-900 rounded-full hover:scale-110 transition-transform shadow-xl"
                  >
                     <Eye className="w-5 h-5" />
                   </button>
                    <button 
                      onClick={() => handleEditTemplate(tpl)}
                      className="p-3 bg-indigo-600 text-white rounded-full hover:scale-110 transition-transform shadow-xl"
                    >
                      <Palette className="w-5 h-5" />
                    </button>
                </div>
              </div>
              
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <span className={cn("text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-current opacity-70 mb-1 inline-block", getStatusColor(tpl.category))}>
                    {tpl.category}
                  </span>
                  <button className="text-slate-300 hover:text-slate-600">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="font-bold text-slate-900 text-sm truncate mb-3 leading-tight">{tpl.name}</h3>
                
                <div className="flex items-center justify-between mt-auto">
                   <div className="flex items-center gap-1.5 text-slate-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-tight">0 Uses</span>
                   </div>
                   <span className="text-[10px] font-bold text-slate-300 italic">Just now</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Template Suggestions */}
      <div className="bg-indigo-600 rounded-3xl p-10 text-white overflow-hidden relative">
         <Sparkles className="absolute right-[-20px] top-[-20px] w-64 h-64 text-white/5 rotate-12" />
         <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-xl">
               <h3 className="text-3xl font-extrabold mb-4 tracking-tight leading-tight">Need a custom look?</h3>
               <p className="text-indigo-100 text-base font-medium leading-relaxed mb-8">
                 Use our Notary AI Designer to generate a custom template based on your commission requirements and local state notary branding.
               </p>
               <button 
                onClick={() => setIsAiDesignerOpen(true)}
                className="px-8 py-3 bg-white text-indigo-600 rounded-2xl font-bold text-sm hover:translate-y-[-2px] transition-all shadow-xl shadow-indigo-800/20 active:scale-95"
               >
                 Launch Designer
               </button>
            </div>
            <div className="flex items-center gap-4">
               {[1, 2, 3].map(i => (
                 <div key={i} className="w-24 h-32 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-md flex items-center justify-center p-4">
                    <FileText className="w-10 h-10 text-white/20" />
                 </div>
               ))}
            </div>
         </div>
      </div>

      <CreateTemplateModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTemplate}
        ownerId={user.uid}
      />

      <AIDesignerModal 
        isOpen={isAiDesignerOpen}
        onClose={() => setIsAiDesignerOpen(false)}
        onSave={handleSaveTemplate}
        ownerId={user.uid}
      />

      <TemplatePreviewModal 
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        template={previewTemplate}
      />

      <EditTemplateModal 
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={handleUpdateTemplate}
        template={editingTemplate}
      />
    </div>
  );
};

export default TemplatesView;
