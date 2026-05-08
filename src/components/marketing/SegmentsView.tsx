import React, { useState, useEffect } from 'react';
import { Layers, Plus, Search, Loader2, MoreVertical, LayoutGrid, List } from 'lucide-react';
import { User } from 'firebase/auth';
import { marketingService } from '../../services/marketingService';
import { MarketingSegment } from '../../types/marketing';
import { cn } from '../../lib/utils';
import CreateSegmentModal from './CreateSegmentModal';

interface SegmentsViewProps {
  user: User;
  autoOpen?: boolean;
}

const SegmentsView: React.FC<SegmentsViewProps> = ({ user, autoOpen }) => {
  const [segments, setSegments] = useState<MarketingSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(autoOpen || false);

  useEffect(() => {
    if (autoOpen) {
      setIsModalOpen(true);
    }
  }, [autoOpen]);

  const fetchSegments = async () => {
    try {
      setLoading(true);
      const data = await marketingService.getSegments(user.uid);
      setSegments(data);
    } catch (error) {
      console.error('Error fetching segments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSegments();
  }, [user.uid]);

  const handleCreateSegment = async (data: any) => {
    try {
      await marketingService.addSegment(data);
      await fetchSegments();
    } catch (error) {
      console.error('Error creating segment:', error);
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Segments</h2>
          <p className="text-slate-500 text-sm font-medium">Group your subscribers for targeted messaging</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>New Segment</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
          <p className="text-slate-500 text-sm font-bold">Fetching segments...</p>
        </div>
      ) : segments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-16 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Layers className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Target with precision</h3>
            <p className="text-slate-500 max-w-sm mx-auto mt-2 mb-8 text-sm font-medium leading-relaxed">
              Segments allow you to group subscribers by behavior, interests, or contact type so you never send irrelevant content.
            </p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-shadow shadow-sm active:scale-95"
            >
              Create Your First Segment
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {segments.map((segment) => (
            <div key={segment.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-all cursor-pointer group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3">
                <button className="text-slate-300 hover:text-slate-600 transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm group-hover:shadow-indigo-200 group-hover:-translate-y-1">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-lg truncate pr-6">{segment.name}</h3>
                  <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">{segment.isDynamic ? 'Dynamic Segment' : 'Static Segment'}</p>
                </div>
              </div>

              <p className="text-sm text-slate-500 font-medium line-clamp-2 mb-8 leading-relaxed">
                {segment.description || 'No description provided.'}
              </p>

              <div className="flex items-center justify-between pt-6 border-t border-slate-50 mt-auto">
                 <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="w-7 h-7 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center">
                        <span className="text-[8px] font-bold text-slate-400">U{i}</span>
                      </div>
                    ))}
                    <div className="w-7 h-7 rounded-full border-2 border-white bg-indigo-50 flex items-center justify-center">
                      <span className="text-[8px] font-bold text-indigo-600">+{segment.subscriberCount || 0}</span>
                    </div>
                 </div>
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Active Reach</span>
              </div>
            </div>
          ))}
          
          {/* New Segment Prompt Card */}
          <button 
             onClick={() => setIsModalOpen(true)}
             className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-slate-50 transition-all group min-h-[220px]"
          >
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-indigo-50 transition-all duration-300">
              <Plus className="w-6 h-6 text-slate-400 group-hover:text-indigo-600" />
            </div>
            <p className="text-sm font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">Add New Segment</p>
          </button>
        </div>
      )}

      <CreateSegmentModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleCreateSegment}
        ownerId={user.uid}
      />
    </div>
  );
};

export default SegmentsView;
