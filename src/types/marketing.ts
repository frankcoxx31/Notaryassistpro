export type SubscriberStatus = 'active' | 'unsubscribed' | 'bounced' | 'suppressed';
export type ContactType = 'direct client' | 'title company' | 'attorney' | 'signing service' | 'hospital' | 'nursing home' | 'estate planning' | 'other';
export type MarketingSource = 'manual' | 'website form' | 'imported' | 'booking flow' | 'existing client';
export type EmailFrequency = 'weekly' | 'monthly' | 'only-important-updates';

export interface Subscriber {
  id: string;
  ownerId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string;
  companyName?: string;
  contactType: ContactType;
  tags: string[];
  serviceInterests: string[];
  status: SubscriberStatus;
  source: MarketingSource;
  preferredFrequency: EmailFrequency;
  emailOptIn: boolean;
  smsOptIn: boolean;
  notes?: string;
  lastBookedAt?: string | null;
  lastEmailedAt?: string | null;
  lastOpenedAt?: string | null;
  lastClickedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingSegment {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  rules: any[]; 
  isDynamic: boolean;
  manualSubscriberIds: string[];
  subscriberCount: number;
  createdAt: string;
  updatedAt: string;
}

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'canceled';
export type CampaignContentType = 'newsletter' | 'service-update' | 'announcement' | 'educational' | 'reactivation';

export interface MarketingCampaign {
  id: string;
  ownerId: string;
  name: string;
  subject: string;
  previewText?: string;
  fromName: string;
  replyTo: string;
  templateId: string;
  segmentIds: string[];
  status: CampaignStatus;
  contentType: CampaignContentType;
  scheduledAt?: string | null;
  sentAt?: string | null;
  metrics: {
    sentCount: number;
    deliveredCount: number;
    openCount: number;
    clickCount: number;
    unsubscribeCount: number;
    bounceCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface MarketingTemplate {
  id: string;
  ownerId: string;
  name: string;
  category: string;
  subjectSuggestion?: string;
  previewTextSuggestion?: string;
  htmlContent: string;
  jsonContent?: any;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
}

export type AutomationTriggerType = 
  | 'subscriber_added_to_list' 
  | 'subscriber_created' 
  | 'tag_added' 
  | 'booking_completed' 
  | 'no_booking_in_x_days' 
  | 'campaign_not_opened' 
  | 'custom_date_based'
  | 'contact_created'
  | 'campaign_sent'
  | 'link_clicked'
  | 'scheduled'
  | 'manual';
export type AutomationStatus = 'draft' | 'active' | 'paused';

export interface MarketingAutomation {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  triggerType: AutomationTriggerType;
  triggerConfig: any;
  status: AutomationStatus;
  steps: any[];
  executionStats: {
    triggerCount: number;
    completeCount: number;
    lastTriggeredAt: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface EmailEvent {
  id: string;
  ownerId: string;
  subscriberId: string;
  campaignId?: string;
  automationId?: string;
  type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'unsubscribed' | 'bounced';
  timestamp: string;
  metadata?: any;
}
