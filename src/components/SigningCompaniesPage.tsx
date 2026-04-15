import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Search, 
  Plus, 
  Filter, 
  ChevronRight, 
  Star, 
  Phone, 
  Mail, 
  Globe, 
  MapPin, 
  TrendingUp, 
  Clock, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle,
  MoreVertical,
  Trash2,
  Edit2,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SigningCompany, Appointment } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import SigningCompanyModal from './SigningCompanyModal';

interface SigningCompaniesPageProps {
  companies: SigningCompany[];
  appointments: Appointment[];
  onSave: (company: SigningCompany) => void;
  onDelete: (id: string) => void;
}

const SigningCompaniesPage = ({ 
  companies, 
  appointments, 
  onSave,
  onDelete
}: SigningCompaniesPageProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<SigningCompany | null>(null);
  const [sortField, setSortField] = useState<keyof SigningCompany>('companyName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Calculate metrics for each company based on appointments
  const companiesWithMetrics = useMemo(() => {
    return companies.map(company => {
      const companyApps = appointments.filter(a => a.companyId === company.id || a.signingCompany === company.companyName);
      
      const totalSignings = companyApps.length;
      const totalAgreed = companyApps.reduce((sum, a) => sum + (Number(a.agreedFee) || Number(a.fee) || 0), 0);
      const totalCollected = companyApps.reduce((sum, a) => sum + (Number(a.amountCollected) || 0), 0);
      const totalOutstanding = companyApps.reduce((sum, a) => sum + (Number(a.amountOutstanding) || 0), 0);
      const averageFee = totalSignings > 0 ? totalAgreed / totalSignings : 0;
      
      // Calculate average days to pay
      const paidApps = companyApps.filter(a => a.paymentReceivedDate && a.date);
      let totalDaysToPay = 0;
      paidApps.forEach(a => {
        const start = new Date(a.date);
        const end = new Date(a.paymentReceivedDate!);
        const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        totalDaysToPay += diff;
      });
      const averageDaysToPay = paidApps.length > 0 ? totalDaysToPay / paidApps.length : 0;
      
      const lastSigning = companyApps.length > 0 
        ? companyApps.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
        : null;

      return {
        ...company,
        totalSignings,
        totalCollected,
        totalOutstanding,
        averageFee,
        averageDaysToPay,
        lastSigningDate: lastSigning?.date || ''
      };
    });
  }, [companies, appointments]);

  const filteredCompanies = useMemo(() => {
    let filtered = companiesWithMetrics.filter(c => 
      c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (statusFilter !== 'All') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    return filtered.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      
      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return sortOrder === 'asc' ? numA - numB : numB - numA;
    });
  }, [companiesWithMetrics, searchQuery, statusFilter, sortField, sortOrder]);

  const selectedCompany = useMemo(() => 
    companiesWithMetrics.find(c => c.id === selectedCompanyId),
    [companiesWithMetrics, selectedCompanyId]
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active': return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[10px] font-bold uppercase tracking-wider">Active</span>;
      case 'Watch': return <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[10px] font-bold uppercase tracking-wider">Watch</span>;
      case 'Do Not Work With': return <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 rounded text-[10px] font-bold uppercase tracking-wider">No Work</span>;
      case 'Inactive': return <span className="px-2 py-0.5 bg-slate-50 text-slate-500 border border-slate-200 rounded text-[10px] font-bold uppercase tracking-wider">Inactive</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Signing Companies</h1>
          <p className="text-slate-500">Manage your relationships and track performance for every agency.</p>
        </div>
        <button 
          onClick={() => {
            setEditingCompany(null);
            setIsModalOpen(true);
          }}
          className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-sky-200 transition-all"
        >
          <Plus className="w-4 h-4" /> Add New Company
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List View */}
        <div className={cn(
          "lg:col-span-2 space-y-4 transition-all duration-300",
          selectedCompanyId ? "hidden md:block" : "block"
        )}>
          {/* Filters Bar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search by name, contact, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-500/20 focus:bg-white transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-sky-500/20"
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Watch">Watch</option>
                <option value="Do Not Work With">Do Not Work With</option>
                <option value="Inactive">Inactive</option>
              </select>
              <div className="w-px h-6 bg-slate-200 mx-1"></div>
              <button className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all">
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Companies Grid/List */}
          <div className="grid grid-cols-1 gap-3">
            {filteredCompanies.length > 0 ? (
              filteredCompanies.map(company => (
                <motion.div
                  layout
                  key={company.id}
                  onClick={() => setSelectedCompanyId(company.id)}
                  className={cn(
                    "bg-white p-4 rounded-xl border transition-all cursor-pointer group relative",
                    selectedCompanyId === company.id 
                      ? "border-sky-500 ring-1 ring-sky-500 shadow-md" 
                      : "border-slate-200 hover:border-sky-300 hover:shadow-sm"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-12 h-12 rounded-lg flex items-center justify-center shrink-0",
                        company.favorite ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-400"
                      )}>
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 group-hover:text-sky-600 transition-colors">{company.companyName}</h3>
                          {company.favorite && <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />}
                          {getStatusBadge(company.status)}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {company.contactName || 'No Contact'}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Last: {company.lastSigningDate ? format(new Date(company.lastSigningDate), 'MMM d, yyyy') : 'Never'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-slate-900">${company.averageFee?.toFixed(2)}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg Fee</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-50">
                    <div>
                      <div className="text-xs font-bold text-slate-900">{company.totalSignings}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Signings</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-rose-600">${company.totalOutstanding?.toFixed(2)}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Owed</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-sky-600">{Math.round(company.averageDaysToPay || 0)} Days</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Avg Pay</div>
                    </div>
                  </div>

                  <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="bg-white p-12 rounded-xl border border-dashed border-slate-300 text-center">
                <Building2 className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-900">No companies found</h3>
                <p className="text-slate-500 text-sm mt-1">Try adjusting your search or add a new company.</p>
                <button 
                  onClick={() => {
                    setEditingCompany(null);
                    setIsModalOpen(true);
                  }}
                  className="mt-4 text-sky-600 font-bold text-sm hover:underline"
                >
                  Add your first company
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Detail View */}
        <div className={cn(
          "lg:col-span-1 transition-all duration-300",
          selectedCompanyId ? "block" : "hidden lg:block"
        )}>
          <AnimatePresence mode="wait">
            {selectedCompany ? (
              <motion.div
                key={selectedCompany.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-8"
              >
                {/* Detail Header */}
                <div className="bg-slate-900 p-6 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 flex gap-2">
                    <button 
                      onClick={() => {
                        setEditingCompany(selectedCompany);
                        setIsModalOpen(true);
                      }}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onDelete(selectedCompany.id)}
                      className="p-2 bg-rose-500/20 hover:bg-rose-500/40 rounded-lg transition-all text-rose-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-sky-500 rounded-2xl flex items-center justify-center shadow-2xl mb-4">
                      <Building2 className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-xl font-black">{selectedCompany.companyName}</h2>
                    <div className="flex items-center gap-2 mt-2">
                      {getStatusBadge(selectedCompany.status)}
                      {selectedCompany.favorite && <Star className="w-4 h-4 text-amber-400 fill-current" />}
                    </div>
                  </div>
                </div>

                {/* Detail Stats */}
                <div className="grid grid-cols-2 border-b border-slate-100">
                  <div className="p-4 border-r border-slate-100 text-center">
                    <div className="text-lg font-black text-slate-900">${selectedCompany.totalCollected?.toLocaleString()}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Earned</div>
                  </div>
                  <div className="p-4 text-center">
                    <div className="text-lg font-black text-rose-600">${selectedCompany.totalOutstanding?.toLocaleString()}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Outstanding</div>
                  </div>
                </div>

                {/* Detail Content */}
                <div className="p-6 space-y-6">
                  {/* Contact Info */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Information</h4>
                    <div className="space-y-2">
                      {selectedCompany.contactName && (
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                          <Users className="w-4 h-4 text-slate-400" />
                          <span className="font-medium">{selectedCompany.contactName}</span>
                        </div>
                      )}
                      {selectedCompany.phone && (
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                          <Phone className="w-4 h-4 text-slate-400" />
                          <a href={`tel:${selectedCompany.phone}`} className="hover:text-sky-600 transition-colors">{selectedCompany.phone}</a>
                        </div>
                      )}
                      {selectedCompany.email && (
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                          <Mail className="w-4 h-4 text-slate-400" />
                          <a href={`mailto:${selectedCompany.email}`} className="hover:text-sky-600 transition-colors">{selectedCompany.email}</a>
                        </div>
                      )}
                      {selectedCompany.website && (
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                          <Globe className="w-4 h-4 text-slate-400" />
                          <a href={selectedCompany.website} target="_blank" rel="noopener noreferrer" className="hover:text-sky-600 transition-colors flex items-center gap-1">
                            Portal Login <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                      {selectedCompany.address && (
                        <div className="flex items-start gap-3 text-sm text-slate-600">
                          <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                          <span>{selectedCompany.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment Info */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment & Terms</h4>
                    <div className="bg-slate-50 p-3 rounded-lg space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Method:</span>
                        <span className="font-bold text-slate-700">{selectedCompany.preferredPaymentMethod || 'Not Set'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Terms:</span>
                        <span className="font-bold text-slate-700">{selectedCompany.paymentTerms || 'Not Set'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Avg Pay Speed:</span>
                        <span className="font-bold text-sky-600">{Math.round(selectedCompany.averageDaysToPay || 0)} Days</span>
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  {selectedCompany.tags && selectedCompany.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCompany.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-sky-50 text-sky-600 text-[10px] font-bold rounded border border-sky-100 uppercase tracking-wider">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-4 space-y-3">
                    <button 
                      onClick={() => setSelectedCompanyId(null)}
                      className="w-full bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 py-2.5 rounded-lg text-sm font-bold md:hidden transition-all"
                    >
                      Back to List
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 border-dashed p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <Building2 className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-slate-900 font-bold">Select a Company</h3>
                <p className="text-slate-500 text-sm mt-1 max-w-[200px]">Choose a company from the list to view detailed performance and contact info.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <SigningCompanyModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={(c) => {
          onSave(c);
          setIsModalOpen(false);
        }}
        company={editingCompany || undefined}
        userId="current-user" // This will be overridden by App.tsx if needed, but SigningCompanyModal uses it for new companies
      />
    </div>
  );
};

export default SigningCompaniesPage;
