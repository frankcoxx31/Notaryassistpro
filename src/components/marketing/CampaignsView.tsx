import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  FileEdit,
  MoreVertical,
  BarChart3,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { User } from 'firebase/auth';
import { marketingService } from '../../services/marketingService';
import { MarketingCampaign, MarketingSegment, MarketingTemplate } from '../../types/marketing';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import CreateCampaignModal from './CreateCampaignModal';

interface CampaignsViewProps {
  user: User;
  autoOpen?: boolean;
}

const CampaignsView: React.FC<CampaignsViewProps> = ({ user, autoOpen }) => {
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [segments, setSegments] = useState<MarketingSegment[]>([]);
  const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(autoOpen || false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    if (autoOpen) {
      setIsModalOpen(true);
    }
  }, [autoOpen]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [campaignData, segmentData, templateData] = await Promise.all([
        marketingService.getCampaigns(user.uid),
        marketingService.getSegments(user.uid),
        marketingService.getTemplates(user.uid)
      ]);
      setCampaigns(campaignData);
      setSegments(segmentData);
      setTemplates(templateData);
    } catch (error) {
      console.error('Error fetching marketing data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.uid]);

  const handleCreateCampaign = async (data: any, sendNow?: boolean) => {
    try {
      const newCampaign = await marketingService.addCampaign({
        ownerId: user.uid,
        name: data.name,
        subject: data.subject,
        templateId: data.selectedTemplateId,
        segmentIds: data.selectedSegmentIds,
        status: 'draft',
        contentType: 'newsletter',
        fromName: user.displayName || user.email?.split('@')[0] || 'NotaryPro Agent', 
        replyTo: user.email || ''
      });

      if (sendNow) {
        // Resolve subscriber IDs based on segments
        const subscriberIds = await marketingService.getSubscribersForSegments(user.uid, data.selectedSegmentIds);
        
        if (subscriberIds.length > 0) {
          await marketingService.queueCampaignSend(newCampaign.id, subscriberIds, user.uid);
          alert(`Successfully created and queued "${data.name}" for ${subscriberIds.length} recipients!`);
        } else {
          alert(`Campaign created as draft, but no active subscribers were found in the selected segments to send.`);
        }
      }

      await fetchData();
    } catch (error) {
      console.error('Error creating campaign:', error);
      throw error;
    }
  };

  const handleSendCampaign = async (campaign: MarketingCampaign) => {
    if (!window.confirm(`Are you sure you want to send "${campaign.name}" now?`)) return;

    try {
      setSendingId(campaign.id);
      
      // 1. Resolve subscriber IDs based on segments
      const subscriberIds = await marketingService.getSubscribersForSegments(user.uid, campaign.segmentIds);
      
      if (subscriberIds.length === 0) {
        alert('No active subscribers found in the selected segments. Please update your segments or subscribers first.');
        return;
      }

      // 2. Queue the send
      await marketingService.queueCampaignSend(campaign.id, subscriberIds, user.uid);
      
      // 3. Refresh data
      await fetchData();
      
      alert(`Successfully queued "${campaign.name}" for ${subscriberIds.length} recipients!`);
    } catch (error) {
      console.error('Error sending campaign:', error);
      alert('Failed to send campaign. Please try again.');
    } finally {
      setSendingId(null);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'sending': return 'bg-blue-50 text-blue-600 border-blue-100 animate-pulse';
      case 'scheduled': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'draft': return 'bg-slate-50 text-slate-500 border-slate-100';
      case 'canceled': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-slate-50 text-slate-500 border-slate-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return CheckCircle2;
      case 'sending': return Send;
      case 'scheduled': return Calendar;
      case 'draft': return FileEdit;
      case 'canceled': return AlertCircle;
      default: return Clock;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Email Campaigns</h2>
          <p className="text-slate-500 text-sm font-medium">Create and track one-time email sends</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>New Campaign</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
          <p className="text-slate-500 text-sm font-medium">Loading your campaigns...</p>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-16 text-center">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Send className="w-10 h-10 text-indigo-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Reach your audience</h3>
            <p className="text-slate-500 max-w-sm mx-auto mt-2 mb-8 text-sm font-medium leading-relaxed">
              Keep your clients informed about new services, holiday hours, or seasonal notary tips with beautiful email campaigns.
            </p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-shadow shadow-sm active:scale-95"
            >
              Create Your First Campaign
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {campaigns.map((campaign) => {
            const StatusIcon = getStatusIcon(campaign.status);
            return (
              <div key={campaign.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all group flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                    getStatusStyle(campaign.status)
                  )}>
                    <StatusIcon className="w-3 h-3" />
                    {campaign.status}
                  </div>
                  <button className="text-slate-300 hover:text-slate-600 transition-colors">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
                
                <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors mb-1 truncate">
                  {campaign.name}
                </h3>
                <p className="text-xs text-slate-500 mb-6 truncate italic font-medium">
                  "{campaign.subject}"
                </p>

                <div className="mt-auto pt-6 border-t border-slate-50">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-4">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {campaign.sentAt 
                        ? format(new Date(campaign.sentAt), 'MMM d, h:mm a') 
                        : `Created ${format(new Date(campaign.createdAt), 'MMM d')}`}
                    </span>
                    <span className="flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" />
                      Analytics Ready
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-50/80 rounded-lg p-2 text-center border border-slate-100">
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight mb-0.5">Opens</p>
                      <p className="text-sm font-bold text-slate-900">{campaign.metrics?.openCount || 0}</p>
                    </div>
                    <div className="bg-slate-50/80 rounded-lg p-2 text-center border border-slate-100">
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight mb-0.5">Clicks</p>
                      <p className="text-sm font-bold text-slate-900">{campaign.metrics?.clickCount || 0}</p>
                    </div>
                    <div className="bg-slate-50/80 rounded-lg p-2 text-center border border-slate-100">
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight mb-0.5">Bounces</p>
                      <p className="text-sm font-bold text-slate-900">{campaign.metrics?.bounceCount || 0}</p>
                    </div>
                  </div>

                  {campaign.status === 'draft' && (
                    <div className="mt-4 flex gap-2">
                       <button 
                        onClick={() => handleSendCampaign(campaign)}
                        disabled={sendingId === campaign.id}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 active:scale-95 disabled:opacity-50"
                      >
                        {sendingId === campaign.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                        <span>Send Campaign</span>
                      </button>
                      <button className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors">
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateCampaignModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleCreateCampaign}
        segments={segments}
        templates={templates}
      />
    </div>
  );
};

export default CampaignsView;
