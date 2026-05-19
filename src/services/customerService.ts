import { 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  doc, 
  limit 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Customer } from '../types';

/**
 * Generates a 9-character random ID consistent with the CRM's current format.
 */
export const generateCustomerId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

/**
 * Sanitizes data for Firestore by removing undefined values.
 */
export const sanitizeData = (data: any): any => {
  const sanitized: any = {};
  Object.keys(data).forEach(key => {
    if (data[key] !== undefined) {
      sanitized[key] = data[key];
    }
  });
  return sanitized;
};

/**
 * Deduplication strategy:
 * 1. Check exact email match if provided.
 * 2. Check exact phone match if provided.
 * 3. Returns the first matching customer found for the given user.
 */
export const findExistingCustomer = async (
  userId: string,
  email?: string,
  phone?: string
): Promise<Customer | null> => {
  if (!email && !phone) return null;

  const customersRef = collection(db, 'customers');

  // Try email match first
  if (email) {
    const qEmail = query(
      customersRef, 
      where('userId', '==', userId), 
      where('email', '==', email),
      limit(1)
    );
    const querySnapshot = await getDocs(qEmail);
    if (!querySnapshot.empty) {
      return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Customer;
    }
  }

  // Try phone match second
  if (phone) {
    const qPhone = query(
      customersRef, 
      where('userId', '==', userId), 
      where('phone', '==', phone),
      limit(1)
    );
    const querySnapshot = await getDocs(qPhone);
    if (!querySnapshot.empty) {
      return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Customer;
    }
  }

  return null;
};

/**
 * Creates a new customer or returns an existing one based on email/phone deduplication.
 */
export const createOrFindCustomer = async (
  userId: string,
  input: Partial<Customer>
): Promise<{ customer: Customer; isNew: boolean }> => {
  const now = new Date().toISOString();
  
  // 1. Perform deduplication check
  const existing = await findExistingCustomer(userId, input.email, input.phone);
  if (existing) {
    return { customer: existing, isNew: false };
  }

  // 2. Prepare new customer record
  const firstName = input.firstName || '';
  const lastName = input.lastName || '';
  const fullName = input.fullName || `${firstName} ${lastName}`.trim();
  
  const newCustomer: Customer = {
    firstName,
    lastName,
    fullName,
    email: input.email || '',
    phone: input.phone || '',
    address: input.address || '',
    city: input.city || '',
    state: input.state || 'North Carolina',
    zip: input.zip || '',
    notes: input.notes || '',
    tags: input.tags || [],
    customerType: input.customerType || 'General Client',
    ...input, // Override with any other fields provided (preferredContactMethod, spouseName, propertyAddress)
    // Ensure critical fields are set correctly and override anything in ...input
    id: input.id || generateCustomerId(),
    userId,
    createdAt: input.createdAt || now,
    updatedAt: now
  };

  // 3. Save to Firestore
  const sanitized = sanitizeData(newCustomer);
  await setDoc(doc(db, 'customers', newCustomer.id), sanitized);

  return { customer: newCustomer, isNew: true };
};
