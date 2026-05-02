import React from 'react';
import { VerificationStatus } from '../../types/idv';
import { cn } from '../../lib/utils';
import { 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Loader2, 
  ShieldAlert,
  Search,
  UserCheck
} from 'lucide-react';

interface VerificationStatusBadgeProps {
  status: VerificationStatus;
  className?: string;
}

export const VerificationStatusBadge: React.FC<VerificationStatusBadgeProps> = ({ status, className }) => {
  const config = {
    [VerificationStatus.NOT_STARTED]: {
      label: 'Not Started',
      icon: Clock,
      theme: 'bg-slate-100 text-slate-600 border-slate-200'
    },
    [VerificationStatus.COLLECTING]: {
      label: 'Collecting Evidence',
      icon: Search,
      theme: 'bg-indigo-50 text-indigo-700 border-indigo-100'
    },
    [VerificationStatus.PROCESSING]: {
      label: 'Processing',
      icon: Loader2,
      theme: 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse'
    },
    [VerificationStatus.AUTO_PASSED]: {
      label: 'Auto Passed',
      icon: CheckCircle2,
      theme: 'bg-emerald-50 text-emerald-700 border-emerald-100'
    },
    [VerificationStatus.INCONCLUSIVE]: {
      label: 'Inconclusive',
      icon: AlertCircle,
      theme: 'bg-amber-50 text-amber-700 border-amber-100'
    },
    [VerificationStatus.PENDING_REVIEW]: {
      label: 'Review Required',
      icon: ShieldAlert,
      theme: 'bg-rose-50 text-rose-700 border-rose-100 animate-pulse'
    },
    [VerificationStatus.APPROVED]: {
      label: 'Verified',
      icon: UserCheck,
      theme: 'bg-emerald-600 text-white border-emerald-700'
    },
    [VerificationStatus.APPROVED_OVERRIDE]: {
      label: 'Override Approved',
      icon: UserCheck,
      theme: 'bg-indigo-600 text-white border-indigo-700'
    },
    [VerificationStatus.RETAKE_REQUESTED]: {
      label: 'Retake Requested',
      icon: AlertCircle,
      theme: 'bg-amber-100 text-amber-800 border-amber-200'
    },
    [VerificationStatus.REJECTED]: {
      label: 'Rejected',
      icon: XCircle,
      theme: 'bg-rose-600 text-white border-rose-700'
    },
    [VerificationStatus.UNAVAILABLE]: {
      label: 'Unavailable',
      icon: AlertCircle,
      theme: 'bg-slate-200 text-slate-700 border-slate-300'
    }
  };

  const { label, icon: Icon, theme } = config[status] || config[VerificationStatus.NOT_STARTED];

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
      theme,
      className
    )}>
      <Icon className={cn("w-3.5 h-3.5", status === VerificationStatus.PROCESSING && "animate-spin")} />
      {label}
    </div>
  );
};
