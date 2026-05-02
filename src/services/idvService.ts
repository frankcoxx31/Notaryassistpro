import { 
  IdentityVerificationRecord, 
  VerificationStatus, 
  VerificationStage, 
  DocumentType,
  VerificationCheck,
  IDVSettings
} from '../types/idv';
import { db } from '../firebase';
import { doc, setDoc, getDoc, updateDoc, collection, addDoc, query, where, onSnapshot } from 'firebase/firestore';

export const IDV_SETTINGS_COLLECTION = 'idv_settings';
export const IDV_RECORDS_COLLECTION = 'idv_records';

export const DEFAULT_IDV_SETTINGS: IDVSettings = {
  allowedDocumentTypes: [
    DocumentType.DRIVERS_LICENSE,
    DocumentType.STATE_ID,
    DocumentType.PASSPORT
  ],
  selfieRequired: true,
  livenessRequired: true,
  aamvaRequired: true,
  kbaEnabled: false,
  autoApproveThreshold: 0.9
};

export class IDVService {
  /**
   * Initializes a new verification record
   */
  static async startVerification(signerId: string, appointmentId: string, userId: string): Promise<string> {
    const recordId = `iv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    const newRecord: Partial<IdentityVerificationRecord> = {
      id: recordId,
      signerId,
      appointmentId,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: VerificationStatus.NOT_STARTED,
      stage: VerificationStage.EVIDENCE_COLLECTION,
      checks: [],
      auditLog: [{
        id: `aud_${Date.now()}`,
        type: 'verification_started',
        description: 'Identity verification process initialized.',
        timestamp: new Date().toISOString(),
        actorId: userId,
        actorName: 'System'
      }],
      consentCaptured: false,
      documentType: DocumentType.DRIVERS_LICENSE
    };

    await setDoc(doc(db, IDV_RECORDS_COLLECTION, recordId), newRecord);
    return recordId;
  }

  /**
   * Fetches a verification record
   */
  static async getRecord(recordId: string): Promise<IdentityVerificationRecord | null> {
    const snap = await getDoc(doc(db, IDV_RECORDS_COLLECTION, recordId));
    return snap.exists() ? snap.data() as IdentityVerificationRecord : null;
  }

  /**
   * Processes document images (simulates OCR and authenticity checks)
   */
  static async processDocument(recordId: string, frontUrl: string, backUrl?: string): Promise<void> {
    const response = await fetch('/api/idv/process-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId, frontUrl, backUrl })
    });

    if (!response.ok) {
      throw new Error('Failed to process document');
    }
  }

  /**
   * Runs face match between selfie and ID
   */
  static async runFaceMatch(recordId: string, selfieUrl: string): Promise<void> {
    const response = await fetch('/api/idv/face-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId, selfieUrl })
    });

    if (!response.ok) {
      throw new Error('Failed to run face match');
    }
  }

  /**
   * Runs liveness verification
   */
  static async runLivenessCheck(recordId: string, videoUrl?: string): Promise<void> {
    const response = await fetch('/api/idv/liveness-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId, videoUrl })
    });

    if (!response.ok) {
      throw new Error('Failed to run liveness check');
    }
  }

  /**
   * Triggers AAMVA verification
   */
  static async runAamvaCheck(recordId: string): Promise<void> {
    const response = await fetch('/api/idv/aamva-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId })
    });

    if (!response.ok) {
      throw new Error('AAMVA service unavailable');
    }
  }

  /**
   * Manual decision (Reviewer)
   */
  static async submitReviewDecision(
    recordId: string, 
    decision: 'approve' | 'reject' | 'request_retake', 
    notes: string,
    userId: string,
    userName: string
  ): Promise<void> {
    const record = await this.getRecord(recordId);
    if (!record) throw new Error('Record not found');

    const statusMap = {
      approve: VerificationStatus.APPROVED,
      reject: VerificationStatus.REJECTED,
      request_retake: VerificationStatus.RETAKE_REQUESTED
    };

    const updates: Partial<IdentityVerificationRecord> = {
      status: statusMap[decision],
      stage: VerificationStage.DECISION,
      manualReviewStatus: 'completed',
      manualReviewDecision: decision,
      reviewerNotes: notes,
      reviewedBy: userId,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      finalDecision: decision === 'approve' ? 'approved' : 'rejected'
    };

    const auditEvent = {
        id: `aud_${Date.now()}`,
        type: 'manual_review',
        description: `Manual review completed: ${decision}. Notes: ${notes}`,
        timestamp: new Date().toISOString(),
        actorId: userId,
        actorName: userName
    };

    await updateDoc(doc(db, IDV_RECORDS_COLLECTION, recordId), {
      ...updates,
      auditLog: [...record.auditLog, auditEvent]
    });
  }
}
