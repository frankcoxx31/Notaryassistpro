import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  addDoc,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Subscriber, 
  MarketingSegment, 
  MarketingCampaign, 
  MarketingTemplate, 
  MarketingAutomation,
  EmailEvent
} from '../types/marketing';

const COLLECTIONS = {
  SUBSCRIBERS: 'subscribers',
  SEGMENTS: 'marketingSegments',
  CAMPAIGNS: 'marketingCampaigns',
  TEMPLATES: 'marketingTemplates',
  AUTOMATIONS: 'marketingAutomations',
  EVENTS: 'emailEvents',
  QUEUE: 'outboundEmailQueue'
};

export const marketingService = {
  // Subscribers
  async getSubscribers(userId: string) {
    const q = query(
      collection(db, COLLECTIONS.SUBSCRIBERS), 
      where('ownerId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscriber));
  },

  async addSubscriber(subscriber: Omit<Subscriber, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString();
    const docRef = doc(collection(db, COLLECTIONS.SUBSCRIBERS));
    const newSubscriber: Subscriber = {
      ...subscriber,
      id: docRef.id,
      createdAt: now,
      updatedAt: now
    };
    await setDoc(docRef, newSubscriber);
    return newSubscriber;
  },

  async updateSubscriber(id: string, updates: Partial<Subscriber>) {
    const docRef = doc(db, COLLECTIONS.SUBSCRIBERS, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  },

  // Segments
  async getSegments(userId: string) {
    const q = query(
      collection(db, COLLECTIONS.SEGMENTS),
      where('ownerId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MarketingSegment));
  },

  async addSegment(segment: Omit<MarketingSegment, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString();
    const docRef = doc(collection(db, COLLECTIONS.SEGMENTS));
    const newSegment: MarketingSegment = {
      ...segment,
      id: docRef.id,
      createdAt: now,
      updatedAt: now
    };
    await setDoc(docRef, newSegment);
    return newSegment;
  },

  // Campaigns
  async getCampaigns(userId: string) {
    const q = query(
      collection(db, COLLECTIONS.CAMPAIGNS),
      where('ownerId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MarketingCampaign));
  },

  async addCampaign(campaign: Omit<MarketingCampaign, 'id' | 'createdAt' | 'updatedAt' | 'metrics'>) {
    const now = new Date().toISOString();
    const docRef = doc(collection(db, COLLECTIONS.CAMPAIGNS));
    const newCampaign: MarketingCampaign = {
      ...campaign,
      id: docRef.id,
      metrics: {
        sentCount: 0,
        deliveredCount: 0,
        openCount: 0,
        clickCount: 0,
        unsubscribeCount: 0,
        bounceCount: 0
      },
      createdAt: now,
      updatedAt: now
    };
    await setDoc(docRef, newCampaign);
    return newCampaign;
  },

  // Queue sending
  async queueCampaignSend(campaignId: string, subscriberIds: string[], userId: string) {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    
    subscriberIds.forEach(subId => {
      const queueRef = doc(collection(db, COLLECTIONS.QUEUE));
      batch.set(queueRef, {
        campaignId,
        subscriberId: subId,
        ownerId: userId,
        status: 'pending',
        createdAt: now,
        attempts: 0
      });
    });

    // Update campaign status
    const campaignRef = doc(db, COLLECTIONS.CAMPAIGNS, campaignId);
    batch.update(campaignRef, {
      status: 'sending',
      updatedAt: now
    });

    await batch.commit();
  },

  // Templates
  async getTemplates(userId: string) {
    const q = query(
      collection(db, COLLECTIONS.TEMPLATES),
      where('ownerId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MarketingTemplate));
  },

  async addTemplate(template: Omit<MarketingTemplate, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString();
    const docRef = doc(collection(db, COLLECTIONS.TEMPLATES));
    const newTemplate: MarketingTemplate = {
      ...template,
      id: docRef.id,
      createdAt: now,
      updatedAt: now
    };
    await setDoc(docRef, newTemplate);
    return newTemplate;
  },

  async updateTemplate(id: string, updates: Partial<MarketingTemplate>) {
    const docRef = doc(db, COLLECTIONS.TEMPLATES, id);
    const now = new Date().toISOString();
    await updateDoc(docRef, { ...updates, updatedAt: now });
  },

  // Automations
  async getAutomations(userId: string) {
    const q = query(
      collection(db, COLLECTIONS.AUTOMATIONS),
      where('ownerId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MarketingAutomation));
  },

  async addAutomation(automation: Omit<MarketingAutomation, 'id' | 'createdAt' | 'updatedAt' | 'executionStats'>) {
    const now = new Date().toISOString();
    const docRef = doc(collection(db, COLLECTIONS.AUTOMATIONS));
    const newAutomation: MarketingAutomation = {
      ...automation,
      id: docRef.id,
      executionStats: {
        triggerCount: 0,
        completeCount: 0,
        lastTriggeredAt: null
      },
      createdAt: now,
      updatedAt: now
    };
    await setDoc(docRef, newAutomation);
    return newAutomation;
  },

  async syncCustomersToSubscribers(ownerId: string, customers: any[]) {
    const batch = writeBatch(db);
    const existingEmails = new Set<string>();
    
    // Get existing subscribers to avoid duplicates
    const q = query(collection(db, COLLECTIONS.SUBSCRIBERS), where('ownerId', '==', ownerId));
    const snapshot = await getDocs(q);
    snapshot.forEach(doc => existingEmails.add(doc.data().email));

    let addedCount = 0;
    for (const customer of customers) {
      const email = customer.email;
      if (email && !existingEmails.has(email)) {
        const docRef = doc(collection(db, COLLECTIONS.SUBSCRIBERS));
        const now = new Date().toISOString();
        const subscriber: Subscriber = {
          id: docRef.id,
          ownerId,
          email: email,
          firstName: customer.firstName || '',
          lastName: customer.lastName || '',
          fullName: customer.fullName || `${customer.firstName} ${customer.lastName}`.trim(),
          phone: customer.phone || '',
          contactType: (customer.customerType as any) || 'other',
          status: 'active',
          source: 'imported',
          preferredFrequency: 'monthly',
          emailOptIn: true,
          smsOptIn: false,
          serviceInterests: [],
          createdAt: now,
          updatedAt: now,
          tags: customer.tags || []
        };
        
        batch.set(docRef, subscriber);
        addedCount++;
        
        if (addedCount >= 400) {
          await batch.commit();
          addedCount = 0;
        }
      }
    }
    
    if (addedCount > 0) {
      await batch.commit();
    }
  }
};
