import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  UserPlus, 
  Download, 
  RefreshCw, 
  MoreVertical, 
  Mail, 
  Tag as TagIcon,
  CheckCircle2,
  XCircle,
  Loader2,
  Layers,
  Plus,
  Edit2,
  UserCheck,
  X,
  User as UserIcon,
  Phone as PhoneIcon,
  Printer,
  FileText,
  Upload
} from 'lucide-react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  getDocs
} from 'firebase/firestore';
import { db } from '../../firebase';
import { User } from 'firebase/auth';
import { marketingService } from '../../services/marketingService';
import { Subscriber, MarketingSegment } from '../../types/marketing';
import { BusinessProfile } from '../../types';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { printEnvelopes } from '../../lib/envelopePrint';
import { printIntroLetters } from '../../lib/introLetterPrint';
import AddSubscriberModal from './AddSubscriberModal';
import EmailModal from '../../components/EmailModal';

interface SubscribersViewProps {
  user: User;
  autoOpen?: boolean;
}

const SubscribersView: React.FC<SubscribersViewProps> = ({ user, autoOpen }) => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [segments, setSegments] = useState<MarketingSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(autoOpen || false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSegmentMenuOpen, setIsSegmentMenuOpen] = useState(false);
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
  const [emailModalCustomer, setEmailModalCustomer] = useState<any | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | Subscriber['status']>('all');
  const [filterContactType, setFilterContactType] = useState<'all' | Subscriber['contactType']>('all');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const showImportResult = (type: 'success' | 'error', message: string) => {
    setImportResult({ type, message });
    setTimeout(() => setImportResult(null), 8000);
  };

  // Real-time listener for subscribers
  useEffect(() => {
    if (!user.uid) return;

    const q = query(
      collection(db, 'subscribers'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscriber));
      setSubscribers(data);
      setLoading(false);
    }, (error) => {
      console.error('Error listening to subscribers:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user.uid]);

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
      // Only show static segments for manual adding
      setSegments(data.filter(s => !s.isDynamic));
    }, (error) => {
      console.error('Error listening to segments:', error);
    });

    return () => unsubscribe();
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

  const handlePrintEnvelope = (sub: Subscriber) => {
    printEnvelopes([{
      fullName: sub.fullName,
      companyName: sub.companyName,
      address: sub.address,
      city: sub.city,
      state: sub.state,
      zip: sub.zip,
      attn: sub.attn
    }], businessProfile);
  };

  const handlePrintLetter = (sub: Subscriber) => {
    printIntroLetters([{
      fullName: sub.fullName,
      companyName: sub.companyName,
      address: sub.address,
      city: sub.city,
      state: sub.state,
      zip: sub.zip
    }], businessProfile);
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const customersRef = collection(db, 'customers');
      const q = query(customersRef, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);

      const existingEmails = new Set(subscribers.map(s => s.email.toLowerCase()));
      let added = 0;
      let skipped = 0;

      for (const docSnap of snapshot.docs) {
        const customer = docSnap.data() as any;
        const email = (customer.email || '').trim().toLowerCase();
        if (!email || existingEmails.has(email)) {
          skipped++;
          continue;
        }

        await marketingService.addSubscriber({
          userId: user.uid,
          email: customer.email,
          firstName: customer.firstName || '',
          lastName: customer.lastName || '',
          fullName: customer.fullName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
          phone: customer.phone || '',
          address: customer.address || '',
          city: customer.city || '',
          state: customer.state || '',
          zip: customer.zip || '',
          contactType: 'direct client',
          status: 'active',
          emailOptIn: true,
          smsOptIn: false,
          tags: customer.tags || [],
          source: 'existing client',
          preferredFrequency: 'monthly',
          serviceInterests: []
        });
        existingEmails.add(email);
        added++;
      }

      alert(`Sync complete: ${added} customer${added === 1 ? '' : 's'} added as subscribers, ${skipped} already up to date or missing an email.`);
    } catch (error) {
      console.error('Error syncing customers:', error);
      alert('Failed to sync customers. Check the console for details.');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddSubscriber = async (data: Omit<Subscriber, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await marketingService.addSubscriber(data);
    } catch (error) {
      console.error('Error adding subscriber:', error);
      throw error;
    }
  };

  const handleSaveEditedSubscriber = async (id: string, updates: Partial<Subscriber>) => {
    try {
      await marketingService.updateSubscriber(id, updates);
    } catch (error) {
      console.error('Error saving edited subscriber:', error);
      throw error;
    }
  };

  const handleConvertToCustomer = async (subscriber: Subscriber) => {
    try {
      setConvertingId(subscriber.id);
      
      const customersRef = collection(db, 'customers');
      const q = query(
        customersRef,
        where('userId', '==', user.uid),
        where('email', '==', subscriber.email)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        alert("This contact is already a customer.");
        return;
      }

      const customerId = generateId();
      const newCustomer = {
        id: customerId,
        userId: user.uid,
        firstName: subscriber.firstName,
        lastName: subscriber.lastName,
        fullName: subscriber.fullName,
        email: subscriber.email,
        phone: subscriber.phone || '',
        address: '',
        city: '',
        state: '',
        zip: '',
        notes: '',
        customerType: 'General Client',
        source: 'marketing-subscriber',
        status: 'new',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'marketing-convert'
      };

      await setDoc(doc(db, 'customers', customerId), newCustomer);
      alert("Converted to customer successfully!");
    } catch (error: any) {
      console.error('Error converting to customer:', error);
      alert(`Failed to convert: ${error.message}`);
    } finally {
      setConvertingId(null);
    }
  };

  const handleAddToSegment = async (segment: MarketingSegment) => {
    try {
      const currentManualIds = segment.manualSubscriberIds || [];
      const newManualIds = Array.from(new Set([...currentManualIds, ...selectedIds]));
      
      await marketingService.updateSegment(segment.id, {
        manualSubscriberIds: newManualIds,
        subscriberCount: newManualIds.length
      });
      
      alert(`Added ${selectedIds.length} subscribers to ${segment.name}`);
      setSelectedIds([]);
      setIsSegmentMenuOpen(false);
    } catch (error) {
      console.error('Error adding to segment:', error);
      alert('Failed to add subscribers to segment.');
    }
  };

  const handleBulkAddTags = async () => {
    const input = window.prompt('Enter tag(s) to add, comma separated:');
    if (!input) return;
    const newTags = input.split(',').map(t => t.trim()).filter(t => t !== '');
    if (newTags.length === 0) return;

    try {
      const targets = subscribers.filter(s => selectedIds.includes(s.id));
      await Promise.all(targets.map(sub => {
        const mergedTags = Array.from(new Set([...(sub.tags || []), ...newTags]));
        return marketingService.updateSubscriber(sub.id, { tags: mergedTags });
      }));
      alert(`Added tag${newTags.length === 1 ? '' : 's'} to ${targets.length} subscriber${targets.length === 1 ? '' : 's'}.`);
      setSelectedIds([]);
    } catch (error) {
      console.error('Error adding tags:', error);
      alert('Failed to add tags.');
    }
  };

  const handleExport = () => {
    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Address', 'City', 'State', 'Zip', 'Contact Type', 'Status', 'Tags', 'Joined'];
    const escapeCsv = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
    const rows = filteredSubscribers.map(sub => [
      sub.firstName, sub.lastName, sub.email, sub.phone || '', sub.address || '',
      sub.city || '', sub.state || '', sub.zip || '', sub.contactType, sub.status,
      (sub.tags || []).join('; '), sub.createdAt
    ].map(escapeCsv).join(','));
    const csv = [headers.map(escapeCsv).join(','), ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `subscribers-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Matches the app's existing "healthcare-facility" / "estate-planning-attorney" tag
  // conventions (seg-healthcare-facilities, seg-estate-planning dynamic segments) so
  // imported contacts join those segments automatically.
  const CSV_TYPE_CONFIG: Record<string, { contactType: Subscriber['contactType']; typeTag: string; segmentTag: string; noun: string }> = {
    'Assisted Living': { contactType: 'nursing home', typeTag: 'nursing-home', segmentTag: 'healthcare-facility', noun: 'Nursing home / assisted living' },
    'Hospital': { contactType: 'hospital', typeTag: 'hospital', segmentTag: 'healthcare-facility', noun: 'Hospital' },
    'Hospice': { contactType: 'other', typeTag: 'hospice', segmentTag: 'healthcare-facility', noun: 'Hospice' },
    'Elder Law': { contactType: 'estate planning', typeTag: 'elder-law', segmentTag: 'estate-planning-attorney', noun: 'Elder law attorney' }
  };

  const parseCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field); field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
    if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      setImporting(true);
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length < 2) { showImportResult('error', 'CSV appears to be empty.'); return; }

      const header = rows[0].map(h => h.trim());
      const idx = (name: string) => header.indexOf(name);
      const iName = idx('FacilityName'), iStreet = idx('Street'), iCity = idx('City'),
        iState = idx('State'), iZip = idx('ZIP'), iType = idx('Type'),
        iRole = idx('DefaultContactRole'), iPhone = idx('Phone'), iEmail = idx('Email');

      if (iName === -1) { showImportResult('error', 'CSV is missing a "FacilityName" column.'); return; }

      const existingNames = new Set(
        subscribers.map(s => (s.companyName || s.fullName || '').trim().toLowerCase()).filter(Boolean)
      );

      let added = 0, skipped = 0;
      for (const r of rows.slice(1)) {
        const name = (r[iName] || '').trim();
        if (!name) continue;
        if (existingNames.has(name.toLowerCase())) { skipped++; continue; }

        const email = (iEmail !== -1 ? r[iEmail] : '').trim();
        const type = (iType !== -1 ? r[iType] : '').trim();
        const role = (iRole !== -1 ? r[iRole] : '').trim();
        const config = CSV_TYPE_CONFIG[type];

        await marketingService.addSubscriber({
          userId: user.uid,
          email,
          firstName: name,
          lastName: '',
          fullName: name,
          phone: (iPhone !== -1 ? r[iPhone] : '') || '',
          companyName: '',
          address: iStreet !== -1 ? r[iStreet] : '',
          attn: role ? `Attn: ${role}` : '',
          city: iCity !== -1 ? r[iCity] : '',
          state: iState !== -1 ? r[iState] : '',
          zip: iZip !== -1 ? r[iZip] : '',
          contactType: config?.contactType || 'other',
          status: 'active',
          source: 'imported',
          preferredFrequency: 'monthly',
          emailOptIn: !!email,
          smsOptIn: false,
          tags: config ? ['mail-campaign', config.segmentTag, config.typeTag] : ['mail-campaign'],
          serviceInterests: [],
          notes: config ? `${config.noun} — physical mail campaign.` : ''
        });
        existingNames.add(name.toLowerCase());
        added++;
      }

      showImportResult('success', `Imported ${added} new contact${added === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} already in your list` : ''}. Hospitals/nursing homes/hospice join "Healthcare Facilities (Mail)"; Elder Law firms join "Estate Planning Attorneys" — check Marketing → Segments.`);
    } catch (error) {
      console.error('Error importing CSV:', error);
      showImportResult('error', 'Failed to import CSV. See console for details.');
    } finally {
      setImporting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredSubscribers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSubscribers.map(s => s.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filteredSubscribers = subscribers.filter(sub => {
    const matchesSearch = sub.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.fullName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || sub.status === filterStatus;
    const matchesContactType = filterContactType === 'all' || sub.contactType === filterContactType;
    return matchesSearch && matchesStatus && matchesContactType;
  });

  return (
    <div className="space-y-6 relative">
      {/* Import CSV result banner */}
      <AnimatePresence>
        {importResult && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              "flex items-center justify-between gap-4 px-4 py-3 rounded-xl border text-sm font-semibold",
              importResult.type === 'success'
                ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                : "bg-rose-50 border-rose-100 text-rose-700"
            )}
          >
            <div className="flex items-center gap-2">
              {importResult.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
              <span>{importResult.message}</span>
            </div>
            <button
              onClick={() => setImportResult(null)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[90] bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-8 border border-slate-800"
          >
            <div className="flex items-center gap-3 pr-8 border-r border-slate-700">
               <span className="bg-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{selectedIds.length}</span>
               <span className="text-sm font-bold text-slate-300">Selected</span>
            </div>
            
            <div className="flex items-center gap-3 relative">
               <button 
                onClick={() => setIsSegmentMenuOpen(!isSegmentMenuOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold transition-all active:scale-95"
               >
                 <Layers className="w-3.5 h-3.5" />
                 <span>Add to Segment</span>
               </button>

               {isSegmentMenuOpen && (
                 <div className="absolute bottom-full left-0 mb-3 w-64 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden text-slate-900 py-1 z-[100]">
                    <div className="px-3 py-2 border-b border-slate-100 mb-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Target Segment</p>
                    </div>
                    {segments.length === 0 ? (
                      <div className="px-3 py-4 text-center">
                        <p className="text-xs text-slate-400 italic">No static segments found</p>
                      </div>
                    ) : (
                      segments.map(s => (
                        <button
                          key={s.id}
                          onClick={() => handleAddToSegment(s)}
                          className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center justify-between group"
                        >
                          <span className="truncate">{s.name}</span>
                          <Plus className="w-3 h-3 text-slate-300 group-hover:text-indigo-600" />
                        </button>
                      ))
                    )}
                 </div>
               )}

               <button
                onClick={handleBulkAddTags}
                className="flex items-center gap-2 px-4 py-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-xs font-bold transition-all transition-colors"
               >
                 <TagIcon className="w-3.5 h-3.5" />
                 <span>Add Tags</span>
               </button>
               
               <button 
                onClick={() => setSelectedIds([])}
                className="text-slate-400 hover:text-white px-2 py-1 text-xs font-bold transition-colors"
               >
                 Cancel
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name or email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 bg-white border rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm",
                filterStatus !== 'all' || filterContactType !== 'all' ? "border-indigo-300 text-indigo-600" : "border-slate-200 text-slate-600"
              )}
            >
              <Filter className="w-4 h-4" />
              <span>Filter</span>
            </button>
            {isFilterMenuOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-100 p-4 space-y-3 z-[100]">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="unsubscribed">Unsubscribed</option>
                    <option value="bounced">Bounced</option>
                    <option value="suppressed">Suppressed</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact Type</label>
                  <select
                    value={filterContactType}
                    onChange={(e) => setFilterContactType(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="all">All Types</option>
                    <option value="direct client">Direct Client</option>
                    <option value="title company">Title Company</option>
                    <option value="attorney">Attorney</option>
                    <option value="signing service">Signing Service</option>
                    <option value="hospital">Hospital</option>
                    <option value="nursing home">Nursing Home</option>
                    <option value="estate planning">Estate Planning</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <button
                  onClick={() => { setFilterStatus('all'); setFilterContactType('all'); setIsFilterMenuOpen(false); }}
                  className="w-full text-center px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-sm"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <RefreshCw className="w-4 h-4" />}
            <span>{syncing ? 'Syncing...' : 'Sync CRM'}</span>
          </button>
          <button
            onClick={handleExport}
            disabled={filteredSubscribers.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleImportCSV}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            title="Import mail-only contacts from a CSV"
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-sm"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <Upload className="w-4 h-4" />}
            <span>{importing ? 'Importing...' : 'Import CSV'}</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Subscriber</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
          <p className="text-slate-500 text-sm font-bold">Fetching subscribers...</p>
        </div>
      ) : subscribers.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-16 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Build your audience</h3>
            <p className="text-slate-500 max-w-sm mx-auto mt-2 mb-8 text-sm font-medium leading-relaxed">
              Start adding subscribers manually or sync your existing notary clients from your signings and journal.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button 
                onClick={() => setIsModalOpen(true)}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-shadow shadow-sm active:scale-95"
              >
                Add Subscriber
              </button>
              <button 
                onClick={handleSync}
                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
              >
                Sync with Appointments
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-3 py-3.5 w-12 text-center">
                    <button 
                      onClick={toggleSelectAll}
                      className={cn(
                        "w-5 h-5 rounded border transition-all flex items-center justify-center mx-auto",
                        selectedIds.length === filteredSubscribers.length && filteredSubscribers.length > 0
                          ? "bg-indigo-600 border-indigo-600 text-white" 
                          : "bg-white border-slate-200 hover:border-slate-300"
                      )}
                    >
                      {selectedIds.length === filteredSubscribers.length && filteredSubscribers.length > 0 && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                  </th>
                  <th className="px-3 py-3.5 w-[220px] text-[10px] font-bold uppercase tracking-widest text-slate-400">Subscriber</th>
                  <th className="px-3 py-3.5 w-[110px] text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                  <th className="px-3 py-3.5 w-[140px] text-[10px] font-bold uppercase tracking-widest text-slate-400">Type</th>
                  <th className="px-3 py-3.5 w-[160px] text-[10px] font-bold uppercase tracking-widest text-slate-400">Tags</th>
                  <th className="px-3 py-3.5 w-[110px] text-[10px] font-bold uppercase tracking-widest text-slate-400">Joined</th>
                  <th className="px-3 py-3.5 w-[360px] text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubscribers.map((sub) => (
                  <tr key={sub.id} className={cn(
                    "hover:bg-slate-50/30 transition-colors group",
                    selectedIds.includes(sub.id) && "bg-indigo-50/20"
                  )}>
                    <td className="px-3 py-3 text-center">
                      <button 
                        onClick={() => toggleSelectOne(sub.id)}
                        className={cn(
                          "w-5 h-5 rounded border transition-all flex items-center justify-center mx-auto",
                          selectedIds.includes(sub.id) 
                            ? "bg-indigo-600 border-indigo-600 text-white" 
                            : "bg-white border-slate-200 group-hover:border-slate-300"
                        )}
                      >
                        {selectedIds.includes(sub.id) && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className="w-8 h-8 shrink-0 bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-full flex items-center justify-center font-bold text-xs shadow-sm ring-1 ring-white">
                          {sub.firstName[0]}{sub.lastName[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 leading-none mb-1 truncate" title={sub.fullName}>{sub.fullName}</p>
                          <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 truncate" title={sub.email}>
                            <Mail className="w-3 h-3 text-slate-300 shrink-0" />
                            <span className="truncate">{sub.email}</span>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
                        sub.status === 'active' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : 
                        sub.status === 'unsubscribed' ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-slate-100 text-slate-600 border border-slate-200"
                      )}>
                        {sub.status === 'active' ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <XCircle className="w-3 h-3 shrink-0" />}
                        <span>{sub.status}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-block max-w-full text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 uppercase tracking-tight truncate" title={sub.contactType}>
                        {sub.contactType}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[150px]">
                        {sub.tags && sub.tags.length > 0 ? (
                          sub.tags.slice(0, 1).map((tag, i) => (
                            <span key={i} className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-indigo-100 truncate max-w-[100px]" title={tag}>
                              <TagIcon className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{tag}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] font-bold text-slate-300 uppercase italic">No tags</span>
                        )}
                        {sub.tags && sub.tags.length > 1 && (
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded shrink-0">+{sub.tags.length - 1}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-xs text-slate-500 font-bold whitespace-nowrap">
                        {format(new Date(sub.createdAt), 'MMM d, yyyy')}
                      </p>
                    </td>
                     <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => setEditingSubscriber(sub)}
                          className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-md text-xs font-bold transition-all flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0"
                          title="Edit Subscriber"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>Edit</span>
                        </button>
                        
                        <button 
                          onClick={() => handleConvertToCustomer(sub)}
                          disabled={convertingId === sub.id}
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 border border-emerald-100 rounded-md text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50 shadow-sm whitespace-nowrap shrink-0"
                          title="Convert to CRM"
                        >
                          {convertingId === sub.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 shrink-0" /> : <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                          <span>Convert</span>
                        </button>
                        
                        <button
                          onClick={() => setEmailModalCustomer({
                            id: sub.id,
                            firstName: sub.firstName,
                            lastName: sub.lastName,
                            fullName: sub.fullName,
                            email: sub.email,
                            phone: sub.phone || '',
                            address: '',
                            userId: user.uid,
                            createdAt: sub.createdAt,
                            updatedAt: sub.updatedAt
                          })}
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 border border-indigo-100 rounded-md text-xs font-bold transition-all flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0"
                          title="Send Email"
                        >
                          <Mail className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>Send Email</span>
                        </button>

                        <button
                          onClick={() => handlePrintLetter(sub)}
                          className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-md text-xs font-bold transition-all flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0"
                          title={sub.address ? 'Print Letter' : 'No mailing address on file'}
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        </button>

                        <button
                          onClick={() => handlePrintEnvelope(sub)}
                          className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-md text-xs font-bold transition-all flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0"
                          title={sub.address ? 'Print Envelope' : 'No mailing address on file'}
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-200 flex items-center justify-between">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
              Total Audience: <span className="text-indigo-600">{subscribers.length}</span>
            </p>
            {filteredSubscribers.length > 10 && (
              <div className="flex items-center gap-2">
                <button disabled className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-400 disabled:opacity-50">Previous</button>
                <button className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">Next</button>
              </div>
            )}
          </div>
        </div>
      )}

      <AddSubscriberModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleAddSubscriber}
        userId={user.uid}
      />

      {editingSubscriber && (
        <EditSubscriberModal 
          subscriber={editingSubscriber}
          onClose={() => setEditingSubscriber(null)}
          onSave={handleSaveEditedSubscriber}
        />
      )}

      {emailModalCustomer && (
        <EmailModal 
          customer={emailModalCustomer}
          onClose={() => setEmailModalCustomer(null)}
        />
      )}
    </div>
  );
};

function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 9; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

interface EditSubscriberModalProps {
  subscriber: Subscriber;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Subscriber>) => Promise<void>;
}

const EditSubscriberModal: React.FC<EditSubscriberModalProps> = ({ subscriber, onClose, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: subscriber.firstName || '',
    lastName: subscriber.lastName || '',
    email: subscriber.email || '',
    phone: subscriber.phone || '',
    address: subscriber.address || '',
    city: subscriber.city || '',
    state: subscriber.state || '',
    zip: subscriber.zip || '',
    contactType: (subscriber.contactType || 'direct client') as Subscriber['contactType'],
    tags: subscriber.tags ? subscriber.tags.join(', ') : '',
    status: (subscriber.status || 'active') as Subscriber['status']
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag !== '');

      const updates: Partial<Subscriber> = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        fullName: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip: formData.zip,
        contactType: formData.contactType as any,
        tags: tagsArray,
        status: formData.status as any,
      };

      await onSave(subscriber.id, updates);
      onClose();
    } catch (error) {
      console.error('Error updating subscriber:', error);
      alert('Failed to update subscriber.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-lg">
              <Edit2 className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Edit Subscriber</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">First Name</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="John"
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Last Name</label>
              <input 
                type="text" 
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Doe"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="email" 
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john.doe@example.com"
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone (Optional)</label>
            <div className="relative">
              <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="tel" 
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(555) 000-0000"
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mailing Address (needed to print envelopes)</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="123 Main St"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <div className="grid grid-cols-3 gap-2 pt-1">
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="City"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder="State"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <input
                type="text"
                value={formData.zip}
                onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                placeholder="ZIP"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Type</label>
              <select
                value={formData.contactType}
                onChange={(e) => setFormData({ ...formData, contactType: e.target.value as any })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 fill-slate-50"
              >
                <option value="direct client">Direct Client</option>
                <option value="title company">Title Company</option>
                <option value="attorney">Attorney</option>
                <option value="signing service">Signing Service</option>
                <option value="hospital">Hospital</option>
                <option value="nursing home">Nursing Home</option>
                <option value="estate planning">Estate Planning</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</label>
              <select 
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 fill-slate-50"
              >
                <option value="active">Active</option>
                <option value="unsubscribed">Unsubscribed</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tags (comma separated)</label>
            <div className="relative">
              <TagIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="VIP, Repeat Customer, Estate Planning"
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button 
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubscribersView;
