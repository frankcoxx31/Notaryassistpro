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

  const renderContent = () => {
    if (!user) return <div className="flex items-center justify-center h-64 text-slate-500">Please sign in to access marketing features.</div>;

    switch (activeTab) {
      case 'subscribers': return <SubscribersView user={user} />;
      case 'segments': return <SegmentsView user={user} />;
      case 'campaigns': return <CampaignsView user={user} />;
      case 'automations': return <AutomationsView user={user} />;
      case 'templates': return <TemplatesView user={user} />;
      case 'reports': return <ReportsView user={user} />;
      case 'preferences': return <PreferencesView user={user} />;
      default: return <CampaignsView user={user} />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Marketing Center</h1>
            <p className="text-slate-500 text-sm">Manage your subscribers, campaigns, and automations</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
              <Plus className="w-4 h-4" />
              <span>Create New</span>
            </button>
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
