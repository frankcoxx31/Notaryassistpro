import React from 'react';
import { VerificationCheck, VerificationStatus } from '../../types/idv';
import { cn } from '../../lib/utils';
import { 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  History,
  FileSearch,
  Scan,
  Database,
  Fingerprint
} from 'lucide-react';
import { format } from 'date-fns';

interface IdentityChecksPanelProps {
  checks: VerificationCheck[];
  status: VerificationStatus;
}

export const IdentityChecksPanel: React.FC<IdentityChecksPanelProps> = ({ checks, status }) => {
  const getIcon = (id: string, checkStatus: string) => {
    if (checkStatus === 'pending') return <Clock className="w-4 h-4 text-slate-400" />;
    if (checkStatus === 'fail') return <XCircle className="w-4 h-4 text-rose-500" />;
    if (checkStatus === 'warning') return <AlertCircle className="w-4 h-4 text-amber-500" />;
    
    // Categorical Icons
    if (id.includes('img') || id.includes('ocr')) return <Scan className="w-4 h-4" />;
    if (id.includes('face') || id.includes('selfie')) return <Fingerprint className="w-4 h-4" />;
    if (id.includes('aamva') || id.includes('dmv')) return <Database className="w-4 h-4" />;
    if (id.includes('doc')) return <FileSearch className="w-4 h-4" />;
    
    return <CheckCircle2 className="w-4 h-4" />;
  };

  const getStatusLabel = (checkStatus: string) => {
    const labels = {
      pass: 'Passed',
      fail: 'Failed',
      warning: 'Warning',
      pending: 'Pending',
      inconclusive: 'Inconclusive'
    };
    return labels[checkStatus as keyof typeof labels] || checkStatus;
  };

  const getStatusColor = (checkStatus: string) => {
    const colors = {
      pass: 'text-emerald-600 bg-emerald-50 border-emerald-100',
      fail: 'text-rose-600 bg-rose-50 border-rose-100',
      warning: 'text-amber-600 bg-amber-50 border-amber-100',
      pending: 'text-slate-400 bg-slate-50 border-slate-100',
      inconclusive: 'text-slate-500 bg-slate-100 border-slate-200'
    };
    return colors[checkStatus as keyof typeof colors] || colors.pending;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          Automated Verification Checks
        </h3>
        <span className="text-[10px] font-bold text-slate-400">
          {checks.filter(c => c.status === 'pass').length} / {checks.length} Passed
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {checks.map((check) => (
          <div 
            key={check.id}
            className={cn(
              "p-3 rounded-2xl border transition-all flex items-start gap-3",
              check.status === 'fail' ? "bg-rose-50/30 border-rose-100" : "bg-white border-slate-200"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border",
              getStatusColor(check.status)
            )}>
              {getIcon(check.id, check.status)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-bold text-slate-900 truncate pr-2">{check.name}</span>
                <span className={cn(
                  "text-[9px] font-black uppercase px-1.5 py-0.5 rounded-lg border",
                  getStatusColor(check.status)
                )}>
                  {getStatusLabel(check.status)}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight line-clamp-1">
                {check.explanation}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">
                  {check.source}
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-200" />
                <span className="text-[9px] font-medium text-slate-300">
                  {format(new Date(check.timestamp), 'HH:mm (ss)')}
                </span>
              </div>
            </div>
          </div>
        ))}

        {checks.length === 0 && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 opacity-50">
            <History className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No checks run yet</p>
          </div>
        )}
      </div>

      {status === VerificationStatus.PENDING_REVIEW && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4">
          <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight">Requires Manual Review</h4>
            <p className="text-xs text-amber-700 font-medium leading-relaxed mt-1">
              Some automated checks returned warnings or failures. A notary administrator must manually review the identity evidence before approval.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
