import React, { useState, useEffect } from 'react';
import { Layers, Plus, Search, Loader2, MoreVertical, LayoutGrid, List, Trash2, Printer, FileText } from 'lucide-react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../../firebase';
import { User } from 'firebase/auth';
import { marketingService } from '../../services/marketingService';
import { MarketingSegment } from '../../types/marketing';
import { BusinessProfile } from '../../types';
import { cn } from '../../lib/utils';
import { printEnvelopes } from '../../lib/envelopePrint';
import { printIntroLetters } from '../../lib/introLetterPrint';
import CreateSegmentModal from './CreateSegmentModal';

interface SegmentsViewProps {
  user: User;
  autoOpen?: boolean;
}

const SegmentsView: React.FC<SegmentsViewProps> = ({ user, autoOpen }) => {
  const [segments, setSegments] = useState<MarketingSegment[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(autoOpen || false);
  const [editingSegment, setEditingSegment] = useState<MarketingSegment | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);

  useEffect(() => {
    if (autoOpen) {
      setIsModalOpen(true);
    }
  }, [autoOpen]);

  // Real-time listener for segments
  useEffect(() => {
    if (!user.uid) return;

    const q = query(
      collection(db, 'marketingSegments'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MarketingSegment));
      setSegments(data);
      setLoading(false);
    }, (error) => {
      console.error('Error listening to segments:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user.uid]);

  // Fetch subscribers (for modal usage)
  const fetchSubscribers = async () => {
    try {
      const data = await marketingService.getSubscribers(user.uid);
      setSubscribers(data);
    } catch (error) {
      console.error('Error fetching subscribers:', error);
    }
  };

  // Fetch customers so segment counts reflect the full CRM
  useEffect(() => {
    if (!user.uid) return;
    const q = query(
      collection(db, 'customers'),
      where('userId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    fetchSubscribers();
  }, [user.uid]);

  // Fetch business profile for the envelope return address
  useEffect(() => {
    if (!user.uid) return;
    getDoc(doc(db, 'profiles', user.uid))
      .then(snap => {
        if (snap.exists()) setBusinessProfile(snap.data() as BusinessProfile);
      })
      .catch(error => console.error('Error fetching business profile:', error));
  }, [user.uid]);

  const handleSaveSegment = async (data: any) => {
    try {
      if (editingSegment) {
        await marketingService.updateSegment(editingSegment.id, data);
      } else {
        await marketingService.addSegment(data);
      }
      setEditingSegment(null);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving segment:', error);
      throw error;
    }
  };

  const handleEditSegment = (segment: MarketingSegment) => {
    setEditingSegment(segment);
    setIsModalOpen(true);
  };

  const handleDeleteSegment = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation(); // Don't trigger edit
    if (typeof window !== 'undefined' && !window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await marketingService.deleteSegment(id);
    } catch (error) {
      console.error('Error deleting segment:', error);
      alert('Failed to delete segment.');
    }
  };

  // Resolve which people belong to a segment — checks both customers and
  // subscribers (dynamic tag/type rules, or a manual subscriber list).
  const getSegmentMembers = (segment: MarketingSegment) => {
    if (segment.isDynamic) {
      const rule = (segment.rules && segment.rules[0]) || {};
      const { tags = [], contactTypes = [] } = rule;
      const allPeople = [
        ...customers.map(c => ({
          id: c.id,
          tags: c.tags || [],
          contactType: (c.customerType || '').toLowerCase().replace(/\s+/g, '_'),
          email: c.email || '',
          fullName: c.fullName,
          companyName: c.companyName,
          address: c.address,
          city: c.city,
          state: c.state,
          zip: c.zip,
          attn: c.attn
        })),
        ...subscribers.map(s => ({
          id: s.id,
          tags: s.tags || [],
          contactType: s.contactType || '',
          email: s.email || '',
          fullName: s.fullName,
          companyName: s.companyName,
          address: s.address,
          city: s.city,
          state: s.state,
          zip: s.zip,
          attn: s.attn
        })),
      ];
      // Deduplicate by email — but a blank email isn't a real identity key,
      // so contacts without one (e.g. mail-only leads) are always kept distinct
      // rather than collapsing every no-email contact down to a single entry.
      const seen = new Set<string>();
      const unique = allPeople.filter(p => {
        const key = p.email.trim();
        if (!key) return true;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return unique.filter(p => {
        const matchesTags = !tags.length || tags.some((t: string) => p.tags.includes(t));
        const matchesTypes = !contactTypes.length || contactTypes.includes(p.contactType);
        return matchesTags && matchesTypes;
      });
    }
    const ids = new Set(segment.manualSubscriberIds || []);
    return subscribers.filter(sub => ids.has(sub.id));
  };

  // Calculate real-time reach for all segments
  const segmentsWithCounts = segments.map(segment => ({
    ...segment,
    subscriberCount: getSegmentMembers(segment).length
  }));

  const handlePrintEnvelopes = (e: React.MouseEvent, segment: MarketingSegment) => {
    e.stopPropagation();
    printEnvelopes(getSegmentMembers(segment), businessProfile);
  };

  const handlePrintLetters = (e: React.MouseEvent, segment: MarketingSegment) => {
    e.stopPropagation();
    printIntroLetters(getSegmentMembers(segment), businessProfile);
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
          {segmentsWithCounts.map((segment) => (
            <div 
              key={segment.id} 
              onClick={() => handleEditSegment(segment)}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-3 flex items-center gap-1">
                <button
                  onClick={(e) => handlePrintLetters(e, segment)}
                  className="p-1.5 text-slate-300 hover:text-indigo-600 transition-colors"
                  title="Print Letters"
                >
                  <FileText className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handlePrintEnvelopes(e, segment)}
                  className="p-1.5 text-slate-300 hover:text-indigo-600 transition-colors"
                  title="Print Envelopes"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteSegment(e, segment.id, segment.name)}
                  className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                  title="Delete Segment"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
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

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
                <div>
                  <span className="text-2xl font-black text-indigo-600">{segment.subscriberCount || 0}</span>
                  <span className="text-xs font-bold text-slate-400 ml-1.5">contacts</span>
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
        onClose={() => {
          setIsModalOpen(false);
          setEditingSegment(null);
        }}
        onSave={handleSaveSegment}
        userId={user.uid}
        availableSubscribers={subscribers}
        initialData={editingSegment}
      />
    </div>
  );
};

export default SegmentsView;
