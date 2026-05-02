import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Upload, 
  Smartphone, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  RefreshCw,
  Info,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  User,
  CreditCard,
  Target
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { DocumentType } from '../../types/idv';

interface IdentityCaptureStepProps {
  onCapture: (data: { front?: File, back?: File, selfie?: File, type: DocumentType }) => void;
  isLoading?: boolean;
}

export const IdentityCaptureStep: React.FC<IdentityCaptureStepProps> = ({ onCapture, isLoading }) => {
  const [step, setStep] = useState<'type' | 'front' | 'back' | 'selfie' | 'review'>('type');
  const [docType, setDocType] = useState<DocumentType>(DocumentType.DRIVERS_LICENSE);
  const [files, setFiles] = useState<{ front?: File, back?: File, selfie?: File }>({});
  const [previews, setPreviews] = useState<{ front?: string, back?: string, selfie?: string }>({});

  const handleFileSelect = (key: 'front' | 'back' | 'selfie', file: File) => {
    setFiles(prev => ({ ...prev, [key]: file }));
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviews(prev => ({ ...prev, [key]: e.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const nextStep = () => {
    if (step === 'type') setStep('front');
    else if (step === 'front') {
      if (docType === DocumentType.PASSPORT) setStep('selfie');
      else setStep('back');
    }
    else if (step === 'back') setStep('selfie');
    else if (step === 'selfie') setStep('review');
  };

  const prevStep = () => {
    if (step === 'front') setStep('type');
    else if (step === 'back') setStep('front');
    else if (step === 'selfie') {
      if (docType === DocumentType.PASSPORT) setStep('front');
      else setStep('back');
    }
    else if (step === 'review') setStep('selfie');
  };

  const renderTypeSelector = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-black text-slate-900 mb-2">Identify Yourself</h2>
        <p className="text-slate-500 text-sm">Please select the type of government-issued ID you will use for verification.</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {[
          { id: DocumentType.DRIVERS_LICENSE, label: "Driver's License", icon: CreditCard, desc: "Front & Back required" },
          { id: DocumentType.STATE_ID, label: "State ID Card", icon: CreditCard, desc: "Front & Back required" },
          { id: DocumentType.PASSPORT, label: "Passport", icon: ShieldCheck, desc: "Photo page only" }
        ].map(({ id, label, icon: Icon, desc }) => (
          <button
            key={id}
            onClick={() => { setDocType(id); nextStep(); }}
            className={cn(
              "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left group",
              docType === id 
                ? "border-indigo-600 bg-indigo-50/50 shadow-sm" 
                : "border-slate-100 hover:border-slate-200 bg-white"
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
              docType === id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
            )}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-slate-900">{label}</div>
              <div className="text-[10px] uppercase font-black tracking-widest text-slate-400">{desc}</div>
            </div>
            <ArrowRight className={cn(
              "ml-auto w-5 h-5 transition-transform",
              docType === id ? "text-indigo-600 translate-x-1" : "text-slate-300"
            )} />
          </button>
        ))}
      </div>

      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
          By continuing, you agree to the collection and processing of your identity documents and biometric data for verification purposes.
        </p>
      </div>
    </div>
  );

  const renderCaptureStep = (key: 'front' | 'back' | 'selfie', title: string, description: string) => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={prevStep} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="text-center flex-1 pr-10">
          <h2 className="text-xl font-black text-slate-900">{title}</h2>
          <p className="text-slate-500 text-xs">{description}</p>
        </div>
      </div>

      <div className="relative group">
        <div className={cn(
          "aspect-[3/2] w-full rounded-2xl border-4 border-dashed transition-all overflow-hidden flex flex-col items-center justify-center bg-slate-50",
          previews[key] ? "border-indigo-600 border-solid" : "border-slate-200 group-hover:border-slate-300",
          key === 'selfie' && "aspect-square max-w-[280px] mx-auto rounded-full"
        )}>
          {previews[key] ? (
            <img src={previews[key]} className="w-full h-full object-cover" alt="Capture Preview" />
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center text-slate-400">
                {key === 'selfie' ? <User className="w-8 h-8" /> : (docType === DocumentType.PASSPORT ? <ShieldCheck className="w-8 h-8" /> : <CreditCard className="w-8 h-8" />)}
              </div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center px-8">
                Place {key} of your {docType.replace('_', ' ')} within the frame
              </div>
            </div>
          )}

          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/40">
             <label className="cursor-pointer bg-white text-slate-900 px-6 py-2.5 rounded-xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-transform flex items-center gap-2">
                <Camera className="w-4 h-4" />
                {previews[key] ? 'Retake' : 'Capture'}
                <input 
                  type="file" 
                  accept="image/*" 
                  capture={key === 'selfie' ? 'user' : 'environment'} 
                  className="hidden" 
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(key, e.target.files[0])}
                />
             </label>
          </div>
        </div>

        {/* Guides */}
        {!previews[key] && key !== 'selfie' && (
           <div className="absolute inset-4 border-2 border-white/30 rounded-lg pointer-events-none border-dashed" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
            <CheckCircle2 className="w-4 h-4" /> Clear and readable
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
            <CheckCircle2 className="w-4 h-4" /> Good lighting
          </div>
        </div>
        <div className="space-y-2 text-right">
          <div className="flex items-center justify-end gap-2 text-xs font-bold text-rose-500">
            <AlertCircle className="w-4 h-4" /> No glare or blur
          </div>
          <div className="flex items-center justify-end gap-2 text-xs font-bold text-rose-500">
            <AlertCircle className="w-4 h-4" /> Not expired
          </div>
        </div>
      </div>

      <button
        disabled={!previews[key]}
        onClick={nextStep}
        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-indigo-700 disabled:opacity-50 disabled:grayscale transition-all shadow-lg flex items-center justify-center gap-2"
      >
        Continue <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );

  const renderReview = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-black text-slate-900 mb-2">Final Review</h2>
        <p className="text-slate-500 text-sm">Please ensure all images are clear and readable before submitting.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
           <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Front Image</div>
           <div className="aspect-[3/2] rounded-xl overflow-hidden border border-slate-200">
              <img src={previews.front} className="w-full h-full object-cover" />
           </div>
        </div>
        {docType !== DocumentType.PASSPORT && (
           <div className="space-y-2">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Back Image</div>
              <div className="aspect-[3/2] rounded-xl overflow-hidden border border-slate-200">
                 <img src={previews.back} className="w-full h-full object-cover" />
              </div>
           </div>
        )}
        <div className="space-y-2 col-span-2">
           <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Selfie Verification</div>
           <div className="aspect-[3/1] rounded-xl overflow-hidden border border-slate-200 relative">
              <img src={previews.selfie} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent flex items-end p-4">
                 <div className="text-white text-xs font-bold flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-400" /> Biometric Link Ready
                 </div>
              </div>
           </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={() => onCapture({ ...files, type: docType })}
          disabled={isLoading}
          className={cn(
            "w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-emerald-700 transition-all shadow-lg flex items-center justify-center gap-2",
            isLoading && "opacity-50 cursor-not-allowed"
          )}
        >
          {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          {isLoading ? 'Processing...' : 'Submit Verification'}
        </button>
        <button
          onClick={() => setStep('type')}
          className="w-full py-3 text-slate-500 font-bold text-sm hover:text-slate-700"
        >
          Retake All
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto p-4 bg-white/50 backdrop-blur-sm rounded-3xl border border-white/20 shadow-sm min-h-[500px] flex flex-col">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className="flex-1 flex flex-col justify-center"
        >
          {step === 'type' && renderTypeSelector()}
          {step === 'front' && renderCaptureStep('front', 'Front Image', `Capture the photo side of your ${docType.replace('_', ' ')}`)}
          {step === 'back' && renderCaptureStep('back', 'Back Image', `Capture the barcode side of your ${docType.replace('_', ' ')}`)}
          {step === 'selfie' && renderCaptureStep('selfie', 'Live Selfie', 'Position your face in the oval to confirm you match your ID')}
          {step === 'review' && renderReview()}
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex justify-center gap-1.5">
         {['type', 'front', docType !== DocumentType.PASSPORT && 'back', 'selfie', 'review'].filter(Boolean).map((s, idx) => (
           <div 
            key={idx} 
            className={cn(
              "h-1 rounded-full transition-all duration-300",
              step === s ? "w-8 bg-indigo-600" : "w-1.5 bg-slate-200"
            )} 
           />
         ))}
      </div>
    </div>
  );
};
