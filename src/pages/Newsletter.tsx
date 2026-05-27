import React, { useState } from 'react';
import { Mail, Users, Send, CheckCircle2 } from 'lucide-react';

const MOCK_CAMPAIGNS = [
  { id: '1', title: 'Monthly Signer Updates - May', status: 'Sent', subscribers: 245, date: 'May 14, 2026', type: 'Newsletter' },
  { id: '2', title: 'Why Choose a Professional Notary?', status: 'Sent', subscribers: 198, date: 'April 20, 2026', type: 'Marketing' },
  { id: '3', title: 'Understanding Estate Planning & POA Documents', status: 'Draft', subscribers: 0, date: 'Draft', type: 'Educational' }
];

const Newsletter = () => {
  const [campaigns, setCampaigns] = useState(MOCK_CAMPAIGNS);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [template, setTemplate] = useState('monthly');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSendNewsletter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    
    const newCampaign = {
      id: Date.now().toString(),
      title,
      status: 'Sent',
      subscribers: 245,
      date: 'Today',
      type: 'Newsletter'
    };
    
    setCampaigns([newCampaign, ...campaigns]);
    setTitle('');
    setContent('');
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
    }, 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Signer Newsletter</h1>
          <p className="text-slate-500">Engage your professional networks and schedule newsletter campaigns directly.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
            <Mail className="w-5 h-5 text-indigo-600" />
            <span className="font-bold text-slate-900 text-lg">Compose New Campaign</span>
          </div>

          <form onSubmit={handleSendNewsletter} className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Campaign Subject / Title</label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Monthly Newsletter - Estate Planning Tips"
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Audience</label>
                <input 
                  type="text" 
                  value="All Active Signers (245 Recipients)"
                  disabled
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500 font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Layout Template</label>
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer font-bold text-slate-700"
                >
                  <option value="monthly">Elegant Slate Theme</option>
                  <option value="compact">Brief Plaintext Email</option>
                  <option value="formal">Official Business Layout</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Content Editor</label>
              <textarea 
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your email contents here. You can use standard paragraphs to detail estate planning notarizations, POA processes, or general announcements..."
                required
                rows={10}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800 resize-none"
              />
            </div>

            {isSuccess && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs font-bold animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Newsletter successfully broadcasted!
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-50">
              <button
                type="submit"
                className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition-colors"
              >
                <Send className="w-4 h-4" />
                Broadcast Campaign
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-4">
              <Users className="w-5 h-5 text-sky-500" />
              <span className="font-bold text-slate-900 text-lg">Newsletter Stats</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                <span className="text-[9px] font-black text-sky-600 uppercase tracking-widest">Active Members</span>
                <p className="text-2xl font-black text-sky-900 mt-1">245</p>
              </div>
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Delivered Rate</span>
                <p className="text-2xl font-black text-indigo-900 mt-1">99.2%</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <span className="font-bold text-slate-900 text-lg">Past Campaigns</span>
            </div>

            <div className="space-y-3">
              {campaigns.map((camp) => (
                <div key={camp.id} className="p-3 border border-slate-100 rounded-xl hover:border-slate-200 transition-all">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{camp.type}</span>
                    <span className="text-xs text-slate-400 font-medium">{camp.date}</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-800">{camp.title}</h4>
                  <p className="text-[10px] text-slate-500 font-semibold mt-1">
                    {camp.status === 'Sent' ? `Delivered to ${camp.subscribers} contacts` : 'Draft Campaign'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Newsletter;
