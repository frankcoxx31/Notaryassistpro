import React from 'react';
import { ExtractedData } from '../../types/idv';
import { cn } from '../../lib/utils';
import { 
  Building, 
  Calendar, 
  MapPin, 
  Hash, 
  Flag, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';

interface IdentityExtractedDataCardProps {
  data?: ExtractedData;
  isLoading?: boolean;
}

export const IdentityExtractedDataCard: React.FC<IdentityExtractedDataCardProps> = ({ data, isLoading }) => {
  const [showSensitive, setShowSensitive] = React.useState(false);

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 animate-pulse">
        <div className="h-4 bg-slate-100 rounded w-1/4 mb-6" />
        <div className="grid grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-2">
              <div className="h-3 bg-slate-50 rounded w-1/2" />
              <div className="h-5 bg-slate-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const DataRow = ({ label, value, icon: Icon, sensitive = false }: { label: string, value?: string, icon: any, sensitive?: boolean }) => (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
        <Icon className="w-3 h-3 text-slate-300" />
        {label}
      </div>
      <div className="flex items-center gap-2">
        <span className={cn(
          "text-sm font-bold text-slate-900 truncate",
          sensitive && !showSensitive && "blur-sm select-none"
        )}>
          {value || 'Not Extracted'}
        </span>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <Hash className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Extracted Information</h3>
            <div className="flex items-center gap-1.5">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                 {Math.round((data.confidence || 0) * 100)}% Confidence Score
               </span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setShowSensitive(!showSensitive)}
          className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 border border-transparent hover:border-slate-200"
        >
          {showSensitive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-8">
        <div className="lg:col-span-1">
          <DataRow label="Legal Name" value={data.fullName} icon={CheckCircle2} />
        </div>
        <div>
          <DataRow label="Date of Birth" value={data.dob} icon={Calendar} />
        </div>
        <div>
           <DataRow label="Document ID" value={data.documentNumber} icon={Hash} sensitive />
        </div>
        
        <div className="md:col-span-2">
          <DataRow label="Address" value={data.address} icon={MapPin} />
        </div>
        <div>
           <DataRow label="City / State" value={`${data.city}, ${data.state} ${data.zip}`} icon={Building} />
        </div>

        <div>
          <DataRow label="Issue Date" value={data.issueDate} icon={Calendar} />
        </div>
        <div>
          <DataRow label="Expiration" value={data.expirationDate} icon={Calendar} />
        </div>
        <div>
          <DataRow label="Issuing Body" value={`${data.issuingJurisdiction}, ${data.issuingCountry}`} icon={Flag} />
        </div>
      </div>

      {data.barcodeParsed && (
        <div className="mx-6 mb-6 p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
            AAMVA / DLDV Barcode Successfully Parsed & Cross-Referenced
          </span>
        </div>
      )}
    </div>
  );
};
