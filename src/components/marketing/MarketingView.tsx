import React, { useState } from 'react';
import { 
  Mail, 
  Users, 
  Layers, 
  Send, 
  Zap, 
  FileText, 
  BarChart3, 
  Settings2,
  Plus,
  Search,
  Filter,
  MoreVertical,
  ChevronRight,
  MailOpen,
  MousePointer2,
  UserX,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

import { auth } from '../../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

// Sub-components
import SubscribersView from './SubscribersView';
import SegmentsView from './SegmentsView';
import CampaignsView from './CampaignsView';
import AutomationsView from './AutomationsView';
import TemplatesView from './TemplatesView';
import ReportsView from './ReportsView';
import PreferencesView from './PreferencesView';

type MarketingTab = 'subscribers' | 'segments' | 'campaigns' | 'automations' | 'templates' | 'reports' | 'preferences';

const MarketingView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MarketingTab>('campaigns');
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [autoOpenState, setAutoOpenState] = useState<Record<MarketingTab, boolean>>({
    subscribers: false,
    segments: false,
    campaigns: false,
    automations: false,
    templates: false,
    reports: false,
    preferences: false
  });
  const [user] = useAuthState(auth);

  const tabs = [
    { id: 'subscribers', name: 'Subscribers', icon: Users },
    { id: 'segments', name: 'Segments', icon: Layers },
    { id: 'campaigns', name: 'Campaigns', icon: Send },
    { id: 'automations', name: 'Automations', icon: Zap },
    { id: 'templates', name: 'Templates', icon: FileText },
    { id: 'reports', name: 'Reports', icon: BarChart3 },
    { id: 'preferences', name: 'Preferences', icon: Settings2 },
  ];

  const handleCreateAction = (tabId: MarketingTab) => {
    setActiveTab(tabId);
    setIsCreateMenuOpen(false);
    
    // Set autoOpen for that tab and reset it for others
    setAutoOpenState(prev => ({
      ...Object.keys(prev).reduce((acc, key) => ({ ...acc, [key]: false }), {} as any),
      [tabId]: true
    }));
    
    // Reset autoOpen state after a shortly longer delay so sub-views definitely catch it
    setTimeout(() => {
      setAutoOpenState(prev => ({ ...prev, [tabId]: false }));
    }, 500);
  };

  const renderContent = () => {
    if (!user) return <div className="flex items-center justify-center h-64 text-slate-500">Please sign in to access marketing features.</div>;

    switch (activeTab) {
      case 'subscribers': return <SubscribersView user={user} autoOpen={autoOpenState.subscribers} />;
      case 'segments': return <SegmentsView user={user} autoOpen={autoOpenState.segments} />;
      case 'campaigns': return <CampaignsView user={user} autoOpen={autoOpenState.campaigns} />;
      case 'automations': return <AutomationsView user={user} autoOpen={autoOpenState.automations} />;
      case 'templates': return <TemplatesView user={user} autoOpen={autoOpenState.templates} />;
      case 'reports': return <ReportsView user={user} />;
      case 'preferences': return <PreferencesView user={user} />;
      default: return <CampaignsView user={user} autoOpen={autoOpenState.campaigns} />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Marketing Center</h1>
            <p className="text-slate-500 text-sm font-medium">Manage your subscribers, campaigns, and automations</p>
          </div>
          <div className="flex items-center gap-3 relative">
            <button 
              onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-bold text-sm relative z-50"
            >
              <Plus className="w-4 h-4" />
              <span>Create New</span>
            </button>

            <AnimatePresence>
              {isCreateMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsCreateMenuOpen(false)} 
                  />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden"
                  >
                    <div className="p-2 space-y-1">
                      <button 
                        onClick={() => handleCreateAction('campaigns')}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        Email Campaign
                      </button>
                      <button 
                        onClick={() => handleCreateAction('automations')}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
                      >
                        <Zap className="w-4 h-4" />
                        Automation Flow
                      </button>
                      <button 
                        onClick={() => handleCreateAction('subscribers')}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
                      >
                        <Users className="w-4 h-4" />
                        Add Subscriber
                      </button>
                      <button 
                        onClick={() => handleCreateAction('templates')}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        New Template
                      </button>
                      <button 
                        onClick={() => handleCreateAction('segments')}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
                      >
                        <Layers className="w-4 h-4" />
                        Target Segment
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as MarketingTab)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                activeTab === tab.id 
                  ? "bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-indigo-200" 
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-indigo-600" : "text-slate-400")} />
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {renderContent()}
        </motion.div>
      </div>
    </div>
  );
};

export default MarketingView;
