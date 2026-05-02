import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { 
  IdentityVerificationRecord, 
  VerificationStatus, 
  VerificationStage,
  DocumentType
} from '../../types/idv';
import { IDVService } from '../../services/idvService';
import { IdentityCaptureStep } from './IdentityCaptureStep';
import { IdentityExtractedDataCard } from './IdentityExtractedDataCard';
import { IdentityChecksPanel } from './IdentityChecksPanel';
import { VerificationStatusBadge } from './VerificationStatusBadge';
import { cn } from '../../lib/utils';
import { 
  FileText, 
  ShieldCheck, 
  History, 
  Settings, 
  Loader2, 
  AlertTriangle,
  RefreshCw,
  MoreVertical,
  CheckCircle2,
  XCircle,
  MessageSquare
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

interface IdentityVerificationModuleProps {
  signerId: string;
  appointmentId: string;
  userId: string;
  userName: string;
  onClose?: () => void;
  isAdmin?: boolean;
}

export const IdentityVerificationModule: React.FC<IdentityVerificationModuleProps> = ({ 
  signerId, 
  appointmentId, 
  userId, 
  userName,
  onClose,
  isAdmin = false
}) => {
  const [activeTab, setActiveTab] = useState<VerificationStage>(VerificationStage.EVIDENCE_COLLECTION);
  const [record, setRecord] = useState<IdentityVerificationRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll or subscribe to existing record
  useEffect(() => {
    // In a real app, we search for the latest record for this signer+appointment
    // For now, assume it's passed or we start fresh if not found
    // (Simulating the search logic)
    setIsLoading(true);
    // Subscription logic would go here
    const q = doc(db, 'idv_records', `iv_${signerId}_${appointmentId}`); // Simplified ID
    const unsub = onSnapshot(q, (snapshot) => {
      if (snapshot.exists()) {
        setRecord(snapshot.data() as IdentityVerificationRecord);
        setIsLoading(false);
      } else {
        setRecord(null);
        setIsLoading(false);
      }
    });

    return () => unsub();
  }, [signerId, appointmentId]);

  const handleStartVerification = async () => {
    setIsLoading(true);
    try {
      const recordId = await IDVService.startVerification(signerId, appointmentId, userId);
      // The snapshot will pick it up
    } catch (err) {
      setError('Failed to initialize verification system');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCaptureComplete = async (data: any) => {
    setIsProcessing(true);
    try {
      // 1. Upload files (MOCK for now - assuming URLs are generated or handled by component)
      const frontUrl = "https://example.com/id-front.jpg";
      const backUrl = data.type !== DocumentType.PASSPORT ? "https://example.com/id-back.jpg" : undefined;
      const selfieUrl = "https://example.com/selfie.jpg";

      // 2. Process Document (AI Extraction & Authenticity)
      const recordId = record?.id || `iv_${signerId}_${appointmentId}`; // fallback for simulation
      await IDVService.processDocument(recordId, frontUrl, backUrl);
      
      // 3. Face Match
      await IDVService.runFaceMatch(recordId, selfieUrl);

      // 4. AAMVA Check
      if (data.type === DocumentType.DRIVERS_LICENSE) {
        await IDVService.runAamvaCheck(recordId);
      }

      setActiveTab(VerificationStage.VALIDATION);
    } catch (err) {
      setError('Verification processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderHeader = () => (
    <div className="p-6 border-b border-slate-100 bg-white sticky top-0 z-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Identity Assurance</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">AAMVA & NIST-Compliant Identity Proofing</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {record && <VerificationStatusBadge status={record.status} />}
          <div className="h-8 w-[1px] bg-slate-100 mx-1 hidden md:block" />
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-6 mt-8">
        {[
          { id: VerificationStage.EVIDENCE_COLLECTION, label: 'Capture', icon: FileText },
          { id: VerificationStage.VALIDATION, label: 'Checks', icon: ShieldCheck },
          { id: VerificationStage.AUDIT, label: 'Audit Log', icon: History }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as VerificationStage)}
            className={cn(
              "flex items-center gap-2 py-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all",
              activeTab === tab.id 
                ? "border-indigo-600 text-indigo-600" 
                : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="p-24 flex flex-col items-center justify-center gap-4 bg-white rounded-3xl border border-slate-200">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-sm font-black text-slate-300 uppercase tracking-wider">Syncing Identity Records...</p>
      </div>
    );
  }

  if (!record && activeTab !== VerificationStage.EVIDENCE_COLLECTION) {
     return (
        <div className="p-12 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
           <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
           <h3 className="text-lg font-bold text-slate-900">No Record Found</h3>
           <p className="text-sm text-slate-500 mb-6">Start a new identity verification process for this signer.</p>
           <button 
             onClick={handleStartVerification}
             className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all shadow-lg"
           >
              Initialize IDV
           </button>
        </div>
     );
  }

  return (
    <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] lg:max-h-[800px] w-full max-w-5xl mx-auto">
      {renderHeader()}

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
        <AnimatePresence mode="wait">
          <motion.div
             key={activeTab}
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -10 }}
             className="space-y-8"
          >
            {activeTab === VerificationStage.EVIDENCE_COLLECTION && (
              <IdentityCaptureStep 
                onCapture={handleCaptureComplete} 
                isLoading={isProcessing} 
              />
            )}

            {activeTab === VerificationStage.VALIDATION && record && (
              <div className="space-y-8">
                <IdentityExtractedDataCard data={record.extractedData} isLoading={isProcessing} />
                <IdentityChecksPanel checks={record.checks} status={record.status} />
              </div>
            )}

            {activeTab === VerificationStage.AUDIT && record && (
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verification Timeline</h4>
                </div>
                <div className="divide-y divide-slate-100">
                  {record.auditLog.map((event, idx) => (
                    <div key={event.id} className="p-4 flex gap-4 hover:bg-slate-50 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                         <span className="text-xs font-black text-slate-400">{idx + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                           <span className="text-xs font-bold text-slate-900">{event.type.replace(/_/g, ' ').toUpperCase()}</span>
                           <span className="text-[10px] font-medium text-slate-400">{event.timestamp}</span>
                        </div>
                        <p className="text-[11px] text-slate-500">{event.description}</p>
                        <div className="mt-1 text-[9px] font-bold text-indigo-500 uppercase">{event.actorName}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {isAdmin && record && record.status === VerificationStatus.PENDING_REVIEW && (
        <div className="p-6 bg-white border-t border-slate-100 flex items-center justify-between gap-4">
           <div className="flex items-center gap-2">
             <MessageSquare className="w-5 h-5 text-slate-400" />
             <input 
              type="text" 
              placeholder="Add reviewer notes..." 
              className="bg-slate-50 border-none rounded-xl text-sm px-4 py-2 w-64 focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
             />
           </div>
           <div className="flex items-center gap-3">
              <button 
                onClick={() => IDVService.submitReviewDecision(record.id, 'reject', 'Identity could not be verified', userId, userName)}
                className="px-6 py-2.5 text-rose-600 font-black uppercase text-[10px] tracking-widest hover:bg-rose-50 rounded-xl transition-all"
              >
                 Reject ID
              </button>
              <button 
                onClick={() => IDVService.submitReviewDecision(record.id, 'approve', 'Manually verified by notary', userId, userName)}
                className="px-8 py-2.5 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
              >
                 <CheckCircle2 className="w-4 h-4" /> Approve Verifcation
              </button>
           </div>
        </div>
      )}
    </div>
  );
};
