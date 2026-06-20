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
  Loader2,
  Trash2
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

  const seedDefaultTemplates = async () => {
    const existing = await marketingService.getTemplates(user.uid);
    if (existing.length > 0) return;

    const defaults = [
      {
        userId: user.uid,
        name: 'Thank You',
        category: 'Transactional',
        subjectSuggestion: 'Thank You for Choosing Us',
        htmlContent: `<h2>Thank You!</h2><p>We truly appreciate you trusting us with your notary needs. It was a pleasure working with you, and we hope to serve you again in the future.</p><p>If you need notary services again, don't hesitate to reach out — we're available 7 days a week.</p>`,
      },
      {
        userId: user.uid,
        name: 'Appointment Reminder',
        category: 'Transactional',
        subjectSuggestion: 'Reminder: Your Upcoming Notary Appointment',
        htmlContent: `<h2>Appointment Reminder</h2><p>This is a friendly reminder about your upcoming notary appointment. Please remember to bring a valid government-issued photo ID. Do not sign any documents before the appointment — all signatures must be made in the notary's presence.</p>`,
      },
      {
        userId: user.uid,
        name: 'New Service Announcement',
        category: 'Marketing',
        subjectSuggestion: 'New Service Available',
        htmlContent: `<h2>Exciting News!</h2><p>We have a new service available for you. Contact us today to learn more about how we can help with your notary needs.</p>`,
      },
      {
        userId: user.uid,
        name: 'General Outreach',
        category: 'Marketing',
        subjectSuggestion: 'A Message from Our Team',
        htmlContent: `<h2>Hello!</h2><p>We wanted to reach out and let you know we're here for all your notary needs. Whether it's loan signings, estate planning, or general notary work — we come to you, 7 days a week.</p>`,
      },
      {
        userId: user.uid,
        name: 'How Did We Do?',
        category: 'Marketing',
        subjectSuggestion: 'How Did We Do? Please Leave Us a Review!',
        htmlContent: `
<div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
  <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:32px 40px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Integrity Closings CLT</h1>
    <p style="margin:6px 0 0;color:#93c5fd;font-size:13px;letter-spacing:1px;">PROFESSIONAL NOTARY SERVICES</p>
  </div>
  <div style="padding:36px 40px;">
    <h2 style="color:#1e3a5f;font-size:22px;margin:0 0 16px;">How Did We Do, {{firstName}}?</h2>
    <p style="color:#475569;line-height:1.7;margin:0 0 16px;">
      Thank you for choosing Integrity Closings CLT for your notary needs.
      We hope your experience was smooth and professional.
    </p>
    <p style="color:#475569;line-height:1.7;margin:0 0 24px;">
      We would truly appreciate it if you could take a moment to share your feedback
      by leaving us a Google review. Your review helps other clients find us and
      helps us continue to improve our services.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <p style="color:#1e3a5f;font-weight:bold;font-size:16px;margin:0 0 16px;">
        Scan the QR code below to leave your review:
      </p>
      <img src="data:image/png;base64,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" alt="Google Review QR Code" style="max-width:180px;height:auto;border:1px solid #e2e8f0;border-radius:12px;padding:8px;background:white;" />
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="https://www.integrityclosingsclt.com/booking" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">Book Again</a>
    </div>
  </div>
  <div style="background:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="margin:0;color:#64748b;font-size:12px;">Integrity Closings CLT &bull; Charlotte, NC</p>
    <p style="margin:6px 0 0;color:#64748b;font-size:12px;">Phone: 980-372-4103 &bull; <a href="https://www.integrityclosingsclt.com" style="color:#2563eb;text-decoration:none;">integrityclosingsclt.com</a></p>
  </div>
</div>
`,
      },
    ];

    for (const t of defaults) {
      await marketingService.addTemplate(t);
    }
    await fetchData();
  };

  useEffect(() => {
    const init = async () => {
      await fetchData();
      await seedDefaultTemplates();
    };
    init();
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

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Delete this template? This cannot be undone.')) return;
    await marketingService.deleteTemplate(id);
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
                  <button
                    onClick={() => handleDeleteTemplate(tpl.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors"
                    title="Delete template"
                  >
                    <Trash2 className="w-4 h-4" />
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
        userId={user.uid}
      />

      <AIDesignerModal 
        isOpen={isAiDesignerOpen}
        onClose={() => setIsAiDesignerOpen(false)}
        onSave={handleSaveTemplate}
        userId={user.uid}
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
