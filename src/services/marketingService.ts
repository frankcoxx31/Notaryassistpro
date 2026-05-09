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

  async updateSegment(id: string, updates: Partial<MarketingSegment>) {
    const docRef = doc(db, COLLECTIONS.SEGMENTS, id);
    const now = new Date().toISOString();
    await updateDoc(docRef, { ...updates, updatedAt: now });
  },

  async deleteSegment(id: string) {
    const docRef = doc(db, COLLECTIONS.SEGMENTS, id);
    await deleteDoc(docRef);
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

  async updateCampaign(id: string, updates: Partial<MarketingCampaign>) {
    const docRef = doc(db, COLLECTIONS.CAMPAIGNS, id);
    const now = new Date().toISOString();
    await updateDoc(docRef, { ...updates, updatedAt: now });
  },

  async deleteCampaign(id: string) {
    const docRef = doc(db, COLLECTIONS.CAMPAIGNS, id);
    await deleteDoc(docRef);
    
    // Also clean up queue if needed, but usually we just keep the audit trail.
    // For now, just delete the campaign doc.
  },

  // Queue sending
  async getSubscribersForSegments(userId: string, segmentIds: string[]) {
    if (!segmentIds || segmentIds.length === 0) return [];

    try {
      // 1. Get all segments for this user to filter for the ones we need
      const segmentsQ = query(
        collection(db, COLLECTIONS.SEGMENTS),
        where('ownerId', '==', userId)
      );
      const segmentsSnapshot = await getDocs(segmentsQ);
      const targetSegments = segmentsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as MarketingSegment))
        .filter(s => segmentIds.includes(s.id));

      if (targetSegments.length === 0) return [];

      // 2. Get all active subscribers for this user
      const subscribersQ = query(
        collection(db, COLLECTIONS.SUBSCRIBERS),
        where('ownerId', '==', userId),
        where('status', '==', 'active')
      );
      const subscribersSnapshot = await getDocs(subscribersQ);
      const allSubscribers = subscribersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscriber));

      const finalSubscriberIds = new Set<string>();

      targetSegments.forEach(segment => {
        if (segment.isDynamic) {
          // Dynamic segments use rules
          const rule = (segment.rules && segment.rules[0]) || {};
          const { tags = [], contactTypes = [] } = rule;

          allSubscribers.forEach(sub => {
            const matchesTags = tags.length === 0 || (sub.tags && tags.some((t: string) => sub.tags.includes(t)));
            const matchesTypes = contactTypes.length === 0 || contactTypes.includes(sub.contactType);

            if (matchesTags && matchesTypes) {
              finalSubscriberIds.add(sub.id);
            }
          });
        } else {
          // Static segments use manual IDs
          if (segment.manualSubscriberIds) {
            segment.manualSubscriberIds.forEach(id => finalSubscriberIds.add(id));
          }
        }
      });

      return Array.from(finalSubscriberIds);
    } catch (error) {
      console.error('Error resolving subscribers for segments:', error);
      return [];
    }
  },

  async queueCampaignSend(campaignId: string, subscriberIds: string[], userId: string) {
    const now = new Date().toISOString();
    
    // Process in batches of 400 to be safe (limit is 500)
    const BATCH_SIZE = 400;
    for (let i = 0; i < subscriberIds.length; i += BATCH_SIZE) {
      const batchChunk = subscriberIds.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      
      batchChunk.forEach(subId => {
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
      
      // If it's the first batch, also update the campaign status
      if (i === 0) {
        const campaignRef = doc(db, COLLECTIONS.CAMPAIGNS, campaignId);
        batch.update(campaignRef, {
          status: 'sending',
          updatedAt: now
        });
      }
      
      await batch.commit();
    }
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
