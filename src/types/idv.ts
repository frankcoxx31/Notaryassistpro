export enum VerificationStatus {
  NOT_STARTED = 'not_started',
  COLLECTING = 'collecting',
  PROCESSING = 'processing',
  AUTO_PASSED = 'auto_passed',
  INCONCLUSIVE = 'inconclusive',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  APPROVED_OVERRIDE = 'approved_override',
  RETAKE_REQUESTED = 'retake_requested',
  REJECTED = 'rejected',
  UNAVAILABLE = 'unavailable',
}

export enum VerificationStage {
  EVIDENCE_COLLECTION = 'evidence_collection',
  VALIDATION = 'validation',
  VERIFICATION = 'verification',
  DECISION = 'decision',
  AUDIT = 'audit',
}

export enum DocumentType {
  DRIVERS_LICENSE = 'drivers_license',
  STATE_ID = 'state_id',
  PASSPORT = 'passport',
  RESIDENCE_PERMIT = 'residence_permit',
  MILITARY_ID = 'military_id',
  OTHER = 'other',
}

export interface ExtractedData {
  fullName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dob?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  issuingCountry?: string;
  issuingJurisdiction?: string;
  documentNumber?: string;
  issueDate?: string;
  expirationDate?: string;
  class?: string;
  barcodeParsed?: boolean;
  confidence?: number;
}

export interface VerificationCheck {
  id: string;
  name: string;
  status: 'pending' | 'pass' | 'warning' | 'fail' | 'inconclusive';
  explanation: string;
  source: 'automated' | 'manual' | 'external';
  timestamp: string;
  notes?: string;
  reasonCode?: string;
}

export interface AamvaResult {
  status: 'not_run' | 'pending' | 'matched' | 'partial_mismatch' | 'failed' | 'unavailable';
  details?: Record<string, 'match' | 'mismatch' | 'unverified'>;
  timestamp?: string;
}

export interface LivenessResult {
  status: 'pending' | 'pass' | 'fail' | 'inconclusive';
  score?: number;
  method?: 'video' | 'photo' | 'challenge';
}

export interface FaceMatchResult {
  status: 'pending' | 'pass' | 'fail' | 'inconclusive';
  score?: number;
}

export interface IdentityVerificationRecord {
  id: string;
  signerId: string;
  appointmentId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  status: VerificationStatus;
  stage: VerificationStage;
  
  documentType: DocumentType;
  issuingCountry?: string;
  issuingJurisdiction?: string;
  
  frontImageUrl?: string;
  backImageUrl?: string;
  selfieImageUrl?: string;
  selfieVideoUrl?: string;
  
  extractedData?: ExtractedData;
  checks: VerificationCheck[];
  
  aamvaResult?: AamvaResult;
  faceMatchResult?: FaceMatchResult;
  livenessResult?: LivenessResult;
  kbaResult?: any;
  
  manualReviewStatus?: 'none' | 'pending' | 'completed';
  manualReviewDecision?: 'approve' | 'reject' | 'request_retake';
  manualReviewReason?: string;
  reviewerNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  
  finalDecision?: 'approved' | 'rejected' | 'pending';
  finalDecisionReason?: string;
  
  consentCaptured: boolean;
  consentTimestamp?: string;
  
  auditLog: IdentityAuditEvent[];
}

export interface IdentityAuditEvent {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  metadata?: any;
}

export interface IDVSettings {
  allowedDocumentTypes: DocumentType[];
  selfieRequired: boolean;
  livenessRequired: boolean;
  aamvaRequired: boolean;
  kbaEnabled: boolean;
  autoApproveThreshold: number;
}
