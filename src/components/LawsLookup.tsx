import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  MapPin, 
  BookOpen, 
  Bookmark, 
  History, 
  ExternalLink, 
  Copy, 
  Save, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  Info,
  X,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { LawItem, SavedLookup, RecentSearch } from '../types';
import { format } from 'date-fns';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { searchAiFallback, AiResearchResult } from '../services/aiService';

const TOPICS = [
  'Journal',
  'Fees',
  'ID Rules',
  'Seal/Stamp',
  'Certificate Wording',
  'RON / eNotary',
  'Training / Exam',
  'Retention',
  'Prohibited Acts'
];

const STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 
  'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

const SEED_LAWS: LawItem[] = [
  {
    id: 'nc-journal-1',
    state: 'North Carolina',
    topic: 'Journal',
    title: 'Journal Requirements',
    summary: 'North Carolina does not mandate a journal for traditional notarizations, but it is highly recommended as a best practice. However, for Electronic Notarizations (eNotary), a journal is REQUIRED.',
    officialSourceName: 'NC Secretary of State - Notary Division',
    officialSourceUrl: 'https://www.sosnc.gov/divisions/notary',
    secondarySourceName: 'NNA NC Notary Primer',
    secondarySourceUrl: 'https://www.nationalnotary.org/north-carolina',
    lastVerifiedAt: '2024-03-15',
    effectiveDate: '2023-07-01',
    keywords: ['journal', 'record', 'log', 'enotary'],
    isOfficial: true,
    disclaimerVersion: '1.0'
  },
  {
    id: 'nc-seal-1',
    state: 'North Carolina',
    topic: 'Seal/Stamp',
    title: 'Seal Design and Use',
    summary: 'A notary seal must be either a circular or rectangular stamp. It must contain the notary\'s name, the words "Notary Public," the county of commissioning, and "North Carolina." The seal must be clear and legible.',
    officialSourceName: 'NC General Statutes § 10B-37',
    officialSourceUrl: 'https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_10B/Stat_10B-37.html',
    lastVerifiedAt: '2024-03-15',
    keywords: ['seal', 'stamp', 'embosser', 'requirements'],
    isOfficial: true,
    disclaimerVersion: '1.0'
  },
  {
    id: 'nc-ron-1',
    state: 'North Carolina',
    topic: 'RON / eNotary',
    title: 'Remote Online Notarization (RON)',
    summary: 'North Carolina has enacted permanent RON legislation. Notaries must hold a current commission, complete additional training, and register with the Secretary of State before performing remote acts.',
    officialSourceName: 'NC Secretary of State - Remote Notarization',
    officialSourceUrl: 'https://www.sosnc.gov/divisions/notary/remote_notarization',
    lastVerifiedAt: '2024-03-15',
    effectiveDate: '2024-07-01',
    keywords: ['ron', 'remote', 'online', 'video', 'electronic'],
    isOfficial: true,
    disclaimerVersion: '1.0'
  },
  {
    id: 'nc-fees-1',
    state: 'North Carolina',
    topic: 'Fees',
    title: 'North Carolina Notary Fees',
    summary: 'Standard paper acknowledgments, jurats, verifications, and proofs may be charged up to $10 per notarized principal signature.\n\n• Paper notarization: $10 per notarized principal signature\n• Electronic notarization: $15 per principal signature\n• Remote notarization: $25 per principal signature\n\nTravel fees are separate and must be agreed to in advance.',
    officialSourceName: 'North Carolina General Statutes § 10B-31',
    officialSourceUrl: 'https://www.ncleg.gov/enactedlegislation/statutes/pdf/bysection/chapter_10b/gs_10b-31.pdf',
    secondarySourceName: 'National Notary Association - 2026 Notary Fees By State',
    secondarySourceUrl: 'https://www.nationalnotary.org/knowledge-center/about-notaries/notary-fees-by-state',
    lastVerifiedAt: '2024-03-15',
    keywords: ['north carolina', 'nc', 'fee', 'fees', 'notary fee', 'journal fee', 'acknowledgment', 'jurat', 'remote notarization', 'electronic notarization'],
    isOfficial: true,
    disclaimerVersion: 'v1'
  },
  {
    id: 'nc-cost-faq',
    state: 'North Carolina',
    topic: 'Fees',
    title: 'How much does a mobile notary cost in North Carolina?',
    summary: 'The State of North Carolina regulates the notarial fee at a maximum of $10 per principal signature. In addition to this state-mandated fee, mobile notaries charge a separate travel fee which varies based on distance.',
    officialSourceName: 'North Carolina General Statutes § 10B-31',
    officialSourceUrl: 'https://www.ncleg.gov/enactedlegislation/statutes/pdf/bysection/chapter_10b/gs_10b-31.pdf',
    secondarySourceName: 'NC Secretary of State Notary FAQ',
    secondarySourceUrl: 'https://www.sosnc.gov/divisions/notary/faq',
    lastVerifiedAt: '2024-03-15',
    keywords: ['how much does a mobile notary cost in north carolina', 'north carolina', 'nc', 'cost', 'travel fee', 'fees', 'mobile notary', 'travel'],
    searchKeywords: ['how much does a mobile notary cost in north carolina', 'north carolina', 'nc', 'cost', 'travel fee', 'fees', 'mobile notary', 'travel'],
    isOfficial: true,
    disclaimerVersion: 'v1'
  },
  {
    id: 'nc-id-1',
    state: 'North Carolina',
    topic: 'ID Rules',
    title: 'North Carolina ID and Personal Appearance Rules',
    summary: 'A notary must identify the principal and may not perform a notarial act if the principal does not personally appear before the notary, except where specifically authorized by remote notarization law.',
    officialSourceName: 'North Carolina General Statutes § 10B-20',
    officialSourceUrl: 'https://www.ncleg.gov/EnactedLegislation/Statutes/PDF/BySection/Chapter_10B/GS_10B-20.pdf',
    secondarySourceName: 'NC General Statutes Chapter 10B',
    secondarySourceUrl: 'https://www.ncleg.net/EnactedLegislation/Statutes/PDF/ByChapter/Chapter_10B.pdf',
    lastVerifiedAt: '2024-03-15',
    keywords: ['north carolina', 'nc', 'id', 'identification', 'personal appearance', 'signer identity'],
    isOfficial: true,
    disclaimerVersion: 'v1'
  },
  {
    id: 'nc-cert-1',
    state: 'North Carolina',
    topic: 'Certificate Wording',
    title: 'North Carolina Notarial Certificate Requirements',
    summary: 'The notarial certificate should match the type of notarial act performed and include the required notarial information under North Carolina law. Users should always verify exact wording with current official state requirements.',
    officialSourceName: 'North Carolina General Statutes Chapter 10B',
    officialSourceUrl: 'https://www.ncleg.net/EnactedLegislation/Statutes/PDF/ByChapter/Chapter_10B.pdf',
    secondarySourceName: 'NNA North Carolina State Law Summary',
    secondarySourceUrl: 'https://www.nationalnotary.org/file%20library/nna/reference-library/state-law-summaries/north_carolina.pdf',
    lastVerifiedAt: '2024-03-15',
    keywords: ['north carolina', 'nc', 'certificate', 'certificate wording', 'acknowledgment certificate', 'jurat wording'],
    isOfficial: true,
    disclaimerVersion: 'v1'
  },
  {
    id: 'nc-training-1',
    state: 'North Carolina',
    topic: 'Training / Exam',
    title: 'North Carolina Notary Training and Exam',
    summary: 'North Carolina requires applicants to complete a state-approved notary education course and pass the required exam before applying, unless an exemption applies. NNA indicates the online state exam requires a passing score of 80 percent.',
    officialSourceName: 'NC State Notary Courses',
    officialSourceUrl: 'https://lifelonglearning.ncsu.edu/notary-public-e-notary-courses/',
    secondarySourceName: 'Become a North Carolina Notary | NNA',
    secondarySourceUrl: 'https://www.nationalnotary.org/north-carolina/become-a-notary',
    lastVerifiedAt: '2024-03-15',
    keywords: ['north carolina', 'nc', 'training', 'exam', 'course', 'notary class', '80 percent'],
    isOfficial: true,
    disclaimerVersion: 'v1'
  },
  {
    id: 'nc-retention-1',
    state: 'North Carolina',
    topic: 'Retention',
    title: 'North Carolina Journal Retention Guidance',
    summary: 'North Carolina does not require a journal for traditional notarizations, but if a notary voluntarily keeps a journal, reference sources state it should be retained for at least five years.',
    officialSourceName: 'Notary Requirements for North Carolina',
    officialSourceUrl: 'https://prostamps.com/blogs/news/notary-requirements-north-carolina',
    secondarySourceName: 'How long must I retain my notary journals?',
    secondarySourceUrl: 'https://www.notarypublicstamps.com/articles/how-long-must-i-retain-my-notary-journals',
    lastVerifiedAt: '2024-03-15',
    keywords: ['north carolina', 'nc', 'retention', 'journal retention', 'notary journal', '5 years'],
    isOfficial: false,
    disclaimerVersion: 'v1'
  },
  {
    id: 'nc-prohibited-1',
    state: 'North Carolina',
    topic: 'Prohibited Acts',
    title: 'North Carolina Prohibited Acts for Notaries',
    summary: 'A North Carolina notary may not perform a notarial act when the principal does not properly appear, and a nonattorney notary may not provide unauthorized legal services such as drafting, selecting, completing, or explaining records or transactions that require a notarization.',
    officialSourceName: 'North Carolina General Statutes § 10B-20',
    officialSourceUrl: 'https://www.ncleg.gov/EnactedLegislation/Statutes/PDF/BySection/Chapter_10B/GS_10B-20.pdf',
    secondarySourceName: 'NC General Statutes Chapter 10B',
    secondarySourceUrl: 'https://www.ncleg.net/EnactedLegislation/Statutes/PDF/ByChapter/Chapter_10B.pdf',
    lastVerifiedAt: '2024-03-15',
    keywords: ['north carolina', 'nc', 'prohibited acts', 'unauthorized practice of law', 'personal appearance', 'notary misconduct'],
    isOfficial: true,
    disclaimerVersion: 'v1'
  },
  {
    id: 'nc-witness-1',
    state: 'North Carolina',
    topic: 'Prohibited Acts',
    title: 'North Carolina Notary as Document Witness',
    summary: 'In North Carolina, a notary may not act as both the notary and a document witness on the same document.',
    officialSourceName: 'National Notary Association - Notary tip: Requests to serve as a document witness',
    officialSourceUrl: 'https://www.nationalnotary.org/notary-bulletin/blog/2018/05/notary-tip-requests-to-serve-as-a-document-witness',
    secondarySourceName: 'NNA - Can A Notary Witness And Notarize, Too?',
    secondarySourceUrl: 'https://www.nationalnotary.org/notary-bulletin/blog/2019/05/hotline-can--notary-witness-notarize',
    lastVerifiedAt: '2024-03-15',
    keywords: ['north carolina','nc','witness','notary witness','document witness','can a notary be a witness','same document','prohibited acts','notary and witness'],
    searchKeywords: ['north carolina','nc','witness','notary witness','document witness','can a notary be a witness','same document','prohibited acts','notary and witness'],
    isOfficial: false,
    disclaimerVersion: 'v1'
  },
  {
    id: 'nc-travel-1',
    state: 'North Carolina',
    topic: 'Fees',
    title: 'North Carolina Notary Travel Fees',
    summary: 'A notary may charge a travel fee if all of the following requirements are met:\n1. The notary and the principal agree on the travel fee in writing before the travel.\n2. The travel fee is not more than the federal business mileage rate.\n3. The travel fee is separate from the notarial fee.',
    officialSourceName: 'North Carolina General Statutes § 10B-31(5)',
    officialSourceUrl: 'https://www.ncleg.gov/enactedlegislation/statutes/pdf/bysection/chapter_10b/gs_10b-31.pdf',
    secondarySourceName: 'NC Secretary of State Notary FAQ',
    secondarySourceUrl: 'https://www.sosnc.gov/divisions/notary/faq',
    lastVerifiedAt: '2024-03-15',
    keywords: ['north carolina', 'nc', 'travel fee', 'mileage', 'reimbursement', 'federal mileage rate', 'mobile notary fee'],
    searchKeywords: ['travel fee', 'mileage', 'mobile notary', 'reimbursement', 'federal mileage rate'],
    isOfficial: true,
    disclaimerVersion: 'v1'
  },
  {
    id: 'ca-fees-1',
    state: 'California',
    topic: 'Fees',
    title: 'Maximum Fees',
    summary: 'California notaries may charge a maximum of $15 per signature for acknowledgments, jurats, and other standard acts. Travel fees are not regulated but must be agreed upon in advance.',
    officialSourceName: 'CA Secretary of State Notary Handbook',
    officialSourceUrl: 'https://www.sos.ca.gov/notary/handbook',
    lastVerifiedAt: '2024-02-10',
    keywords: ['fees', 'maximum', 'charge', 'payment'],
    isOfficial: true,
    disclaimerVersion: '1.0'
  }
];

interface LawsLookupProps {
  userId: string;
  userState?: string;
}

const LawsLookup: React.FC<LawsLookupProps> = ({ userId, userState }) => {
  const [selectedState, setSelectedState] = useState(userState || 'North Carolina');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [officialOnly, setOfficialOnly] = useState(false);
  const [savedLookups, setSavedLookups] = useState<SavedLookup[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [aiResult, setAiResult] = useState<AiResearchResult | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAiPrompt, setShowAiPrompt] = useState(false);

  // Firestore listeners
  useEffect(() => {
    if (!userId) return;

    const savedQuery = query(collection(db, 'savedLookups'), where('userId', '==', userId));
    const unsubscribeSaved = onSnapshot(savedQuery, (snapshot) => {
      setSavedLookups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavedLookup)));
    });

    const recentQuery = query(collection(db, 'recentSearches'), where('userId', '==', userId));
    const unsubscribeRecent = onSnapshot(recentQuery, (snapshot) => {
      const searches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RecentSearch));
      setRecentSearches(searches.sort((a, b) => new Date(b.searchedAt).getTime() - new Date(a.searchedAt).getTime()).slice(0, 5));
    });

    return () => {
      unsubscribeSaved();
      unsubscribeRecent();
    };
  }, [userId]);

  const filteredLaws = useMemo(() => {
    const normalizeText = (text: string) => {
      return text
        .toLowerCase()
        .replace(/[?,.]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const normalizedQuery = normalizeText(searchQuery);

    // Intent matching
    const getIntentKeywords = (query: string) => {
      const intents: { [key: string]: string[] } = {
        'witness': ['witness', 'notary witness', 'document witness', 'prohibited acts'],
        'can a notary be a witness': ['witness', 'notary witness', 'document witness', 'prohibited acts'],
        'can notary be witness': ['witness', 'notary witness', 'document witness', 'prohibited acts'],
        'notary as witness': ['witness', 'notary witness', 'document witness', 'prohibited acts'],
        'witness same document': ['witness', 'notary witness', 'document witness', 'prohibited acts'],
        'document witness': ['witness', 'notary witness', 'document witness', 'prohibited acts'],
        'travel fee': ['fees', 'travel', 'mileage', 'mobile notary fee', 'reimbursement', 'federal mileage rate'],
        'mileage': ['fees', 'travel', 'mileage', 'reimbursement', 'federal mileage rate'],
        'can a notary charge a travel fee': ['fees', 'travel', 'mileage', 'reimbursement', 'federal mileage rate'],
        'mobile notary fee': ['fees', 'travel', 'mileage', 'mobile notary fee', 'reimbursement'],
        'how much does a mobile notary cost': ['fees', 'travel', 'mileage', 'mobile notary fee', 'reimbursement', 'cost'],
        'how much does a mobile notary cost in north carolina': ['fees', 'travel', 'mileage', 'mobile notary fee', 'reimbursement', 'cost']
      };

      for (const [key, keywords] of Object.entries(intents)) {
        if (query.includes(normalizeText(key))) {
          return keywords;
        }
      }
      return [];
    };

    const intentKeywords = getIntentKeywords(normalizedQuery);

    return SEED_LAWS.filter(law => {
      const matchesState = !selectedState || law.state === selectedState;
      
      // Normalize topics for comparison
      const normalizeTopic = (t: string) => t.toLowerCase().replace(/s$/, '').trim();
      const matchesTopic = !selectedTopic || normalizeTopic(law.topic) === normalizeTopic(selectedTopic);
      
      let matchesSearch = true;
      if (normalizedQuery) {
        const searchFields = [
          law.title,
          law.summary,
          law.state,
          law.topic,
          ...(law.keywords || []),
          ...(law.searchKeywords || [])
        ].map(f => normalizeText(f || ''));

        const matchesDirect = searchFields.some(field => field.includes(normalizedQuery));
        const matchesIntent = intentKeywords.some(keyword => 
          searchFields.some(field => field.includes(normalizeText(keyword)))
        );

        matchesSearch = matchesDirect || matchesIntent;
      }

      const matchesOfficial = !officialOnly || law.isOfficial;

      return matchesState && matchesTopic && matchesSearch && matchesOfficial;
    });
  }, [selectedState, selectedTopic, searchQuery, officialOnly]);

  const handleSearchSubmit = () => {
    console.log(`[LawsLookup] Search submitted: "${searchInput}"`);
    setSearchQuery(searchInput);
    setAiResult(null);
    setAiError(null);
    setShowAiPrompt(false);
    handleSaveSearch();
  };

  const handleAiSearch = async () => {
    const queryToSearch = searchQuery || searchInput;
    if (!queryToSearch) {
      console.warn('[LawsLookup] AI Search attempted with empty query');
      return;
    }
    
    console.log(`[LawsLookup] AI Search button clicked for query: "${queryToSearch}"`);
    setIsAiLoading(true);
    setAiError(null);
    setAiResult(null);
    
    try {
      console.log('[LawsLookup] Calling AI fallback service...');
      const result = await searchAiFallback(queryToSearch, selectedState || 'North Carolina');
      
      if (!result || (!result.answer && result.citations.length === 0)) {
        console.warn('[LawsLookup] AI returned empty result');
        setAiError('No AI answer was returned for this search');
      } else {
        console.log('[LawsLookup] AI result received successfully');
        setAiResult(result);
      }
      setShowAiPrompt(false);
    } catch (error) {
      console.error('[LawsLookup] AI Search Error:', error);
      setAiError('AI search is temporarily unavailable');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearchSubmit();
    }
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
  };

  const handleSaveSearch = async () => {
    if (!searchInput && !selectedTopic && !selectedState) return;
    try {
      await addDoc(collection(db, 'recentSearches'), {
        userId,
        query: searchInput,
        state: selectedState,
        topic: selectedTopic,
        searchedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error saving search:', error);
    }
  };

  const handleSaveLookup = async (law: LawItem) => {
    if (savedLookups.some(s => s.lawId === law.id)) return;
    try {
      await addDoc(collection(db, 'savedLookups'), {
        userId,
        lawId: law.id,
        lawTitle: law.title,
        state: law.state,
        topic: law.topic,
        savedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error saving lookup:', error);
    }
  };

  const handleRemoveSaved = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'savedLookups', id));
    } catch (error) {
      console.error('Error removing saved lookup:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast here
  };

  const clearFilters = () => {
    setSelectedState(userState || '');
    setSelectedTopic('');
    setSearchInput('');
    setSearchQuery('');
    setOfficialOnly(false);
    setAiResult(null);
    setAiError(null);
    setShowAiPrompt(false);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex-1 space-y-8">
        {/* 1. HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Laws & Regulations Lookup</h1>
            <p className="text-slate-500">Search state notary rules by topic</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
              <Bookmark className="w-5 h-5" />
            </button>
            <button 
              onClick={() => {
                setIsRefreshing(true);
                setTimeout(() => setIsRefreshing(false), 1000);
              }}
              className={cn(
                "p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all",
                isRefreshing && "animate-spin text-indigo-600"
              )}
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. PERSISTENT DISCLAIMER BANNER */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-amber-900">Informational Reference Only</h4>
            <p className="text-sm text-amber-800 leading-relaxed">
              This tool provides general notary law and regulation summaries for quick reference only. It is not legal advice, does not create an attorney-client relationship, and may not reflect the most current changes in your state. Always verify requirements with your state commissioning authority, Secretary of State, or other official state source before performing a notarial act.
            </p>
          </div>
        </div>

        {/* 3. SEARCH AND FILTER ROW */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select 
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              >
                <option value="">All States</option>
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select 
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              >
                <option value="">All Topics</option>
                {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="relative lg:col-span-2 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search by keyword, e.g. journal, witness, fees, seal"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                />
              </div>
              <button
                onClick={handleSearchSubmit}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 flex items-center gap-2 shrink-0"
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Search</span>
              </button>
              {searchInput && (
                <button
                  onClick={handleClearSearch}
                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all shrink-0"
                  title="Clear search"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 px-1">
            <input 
              type="checkbox" 
              id="official-only"
              checked={officialOnly}
              onChange={(e) => setOfficialOnly(e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
            />
            <label htmlFor="official-only" className="text-sm font-medium text-slate-600 cursor-pointer">
              Official sources only
            </label>
          </div>
        </div>

        {/* 4. QUICK TOPIC CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {TOPICS.map(topic => (
            <button
              key={topic}
              onClick={() => setSelectedTopic(topic === selectedTopic ? '' : topic)}
              className={cn(
                "p-4 rounded-2xl border text-left transition-all group",
                selectedTopic === topic 
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200" 
                  : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/30"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center mb-3",
                selectedTopic === topic ? "bg-white/20" : "bg-slate-100 group-hover:bg-indigo-100"
              )}>
                <BookOpen className={cn("w-4 h-4", selectedTopic === topic ? "text-white" : "text-slate-500 group-hover:text-indigo-600")} />
              </div>
              <span className="text-xs font-bold leading-tight">{topic}</span>
            </button>
          ))}
        </div>

        {/* 5. RESULTS LIST */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Results ({filteredLaws.length + (aiResult ? 1 : 0)})</h3>
            {(filteredLaws.length === 0 && !aiResult) && (
              <button 
                onClick={clearFilters}
                className="text-sm font-bold text-indigo-600 hover:text-indigo-700"
              >
                Clear Filters
              </button>
            )}
          </div>

          <div className="space-y-4">
            {aiError && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-rose-50 rounded-2xl border border-rose-200 p-6 text-center space-y-4"
              >
                <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6 text-rose-600" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-rose-900">{aiError}</h4>
                  <p className="text-sm text-rose-600">Please try again or search for a different topic.</p>
                </div>
                <button 
                  onClick={handleAiSearch}
                  className="px-6 py-2 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-100"
                >
                  Retry AI Search
                </button>
              </motion.div>
            )}

            {aiResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-indigo-50 rounded-2xl border border-indigo-200 shadow-sm overflow-hidden"
              >
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-md text-[10px] font-black uppercase tracking-wider">
                          AI-Assisted Research
                        </span>
                        <span className="px-2 py-0.5 bg-white text-indigo-600 rounded-md text-[10px] font-black uppercase tracking-wider border border-indigo-100">
                          {selectedState || 'All States'}
                        </span>
                      </div>
                      <h4 className="text-lg font-bold text-slate-900">Research for: "{searchQuery}"</h4>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Provider</p>
                      <p className="text-xs font-bold text-indigo-600">Perplexity AI</p>
                    </div>
                  </div>

                  <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {aiResult.answer}
                  </div>

                  <div className="space-y-3 pt-4 border-t border-indigo-100">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Citations & Sources
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {aiResult.citations.map((citation, idx) => (
                        <a 
                          key={idx}
                          href={citation.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          {citation.title}
                        </a>
                      ))}
                      {aiResult.officialStateLink && (
                        <a 
                          href={aiResult.officialStateLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
                        >
                          Official State Source
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="bg-white/50 p-3 rounded-xl flex items-start gap-2 border border-indigo-100">
                    <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-indigo-600 italic">
                      Informational reference only. Verify current requirements with your official state authority before performing a notarial act.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button 
                      onClick={() => copyToClipboard(aiResult.answer)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-indigo-600 hover:bg-white rounded-xl transition-all"
                    >
                      <Copy className="w-4 h-4" />
                      Copy Answer
                    </button>
                    <button 
                      onClick={() => setAiResult(null)}
                      className="text-sm font-bold text-slate-400 hover:text-slate-600 px-4 py-2"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {filteredLaws.length > 0 ? (
              filteredLaws.map(law => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={law.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  <div className="p-6 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[10px] font-black uppercase tracking-wider border border-indigo-100">
                            {law.state}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-50 text-slate-600 rounded-md text-[10px] font-black uppercase tracking-wider border border-slate-100">
                            {law.topic}
                          </span>
                        </div>
                        <h4 className="text-lg font-bold text-slate-900">{law.title}</h4>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Updated</p>
                        <p className="text-xs font-bold text-slate-600">{format(new Date(law.lastVerifiedAt), 'MMM d, yyyy')}</p>
                      </div>
                    </div>

                    <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{law.summary}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Official Source
                        </p>
                        <a 
                          href={law.officialSourceUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 group"
                        >
                          {law.officialSourceName}
                          <ExternalLink className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </a>
                      </div>
                      {law.secondarySourceName && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Secondary Source</p>
                          <a 
                            href={law.secondarySourceUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm font-bold text-slate-600 hover:text-indigo-600 flex items-center gap-1 group"
                          >
                            {law.secondarySourceName}
                            <ExternalLink className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl flex items-start gap-2">
                      <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-slate-500 italic">
                        Verify before use: rules can change. Confirm current requirements with the official state source linked below.
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button 
                        onClick={() => copyToClipboard(law.summary)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                      >
                        <Copy className="w-4 h-4" />
                        Copy Summary
                      </button>
                      <button 
                        onClick={() => handleSaveLookup(law)}
                        disabled={savedLookups.some(s => s.lawId === law.id)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all",
                          savedLookups.some(s => s.lawId === law.id)
                            ? "bg-emerald-50 text-emerald-600 cursor-default"
                            : "text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                        )}
                      >
                        {savedLookups.some(s => s.lawId === law.id) ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Saved
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Save
                          </>
                        )}
                      </button>
                      <a 
                        href={law.officialSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
                      >
                        Open Source
                      </a>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : !aiResult && (
              <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto">
                  <Search className="w-8 h-8 text-slate-300" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xl font-bold text-slate-900">No exact law card found</h4>
                  <p className="text-slate-500">We couldn't find a local record for your search.</p>
                </div>

                <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 max-w-md mx-auto space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-indigo-900">Search web-backed AI sources for this question?</p>
                    <p className="text-[11px] text-indigo-600 leading-relaxed">
                      Results may include citations, but always verify with your state’s official notary authority before relying on the answer.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <button 
                      onClick={handleAiSearch}
                      disabled={isAiLoading}
                      className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isAiLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Researching...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Search AI Sources
                        </>
                      )}
                    </button>
                    <button 
                      onClick={clearFilters}
                      className="px-6 py-2 bg-white text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                {searchQuery && (
                  <div className="pt-4 space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Suggestions</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {['credible witness', 'document witness'].map(suggestion => (
                        <button
                          key={suggestion}
                          onClick={() => {
                            setSearchInput(suggestion);
                            setSearchQuery(suggestion);
                          }}
                          className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-all"
                        >
                          Did you mean: {suggestion}
                        </button>
                      ))}
                      <button
                        onClick={() => setSelectedTopic('Prohibited Acts')}
                        className="px-3 py-1.5 bg-slate-50 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-100 transition-all"
                      >
                        Try topic: Prohibited Acts
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 7. FOOTER NOTE */}
        <div className="text-center pt-8 border-t border-slate-100">
          <p className="text-xs text-slate-400 italic">
            Need certainty? Check the official state source before completing a notarization.
          </p>
        </div>
      </div>

      {/* 6. SAVED / RECENT SIDEBAR */}
      <div className="w-full lg:w-80 space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-indigo-600" /> Saved Lookups
              </h4>
              <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">
                {savedLookups.length}
              </span>
            </div>
            <div className="space-y-3">
              {savedLookups.length > 0 ? (
                savedLookups.map(saved => (
                  <div key={saved.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 group relative">
                    <button 
                      onClick={() => handleRemoveSaved(saved.id)}
                      className="absolute top-2 right-2 p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <p className="text-xs font-bold text-slate-900 line-clamp-1 pr-4">{saved.lawTitle}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-400">{saved.state}</span>
                      <span className="text-[10px] text-slate-400">•</span>
                      <span className="text-[10px] text-slate-400">{saved.topic}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic text-center py-4">No saved lookups yet</p>
              )}
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-slate-100">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" /> Recent Searches
            </h4>
            <div className="space-y-2">
              {recentSearches.length > 0 ? (
                recentSearches.map(recent => (
                  <button 
                    key={recent.id}
                    onClick={() => {
                      setSearchInput(recent.query);
                      setSearchQuery(recent.query);
                      setSelectedState(recent.state);
                      setSelectedTopic(recent.topic);
                    }}
                    className="w-full text-left p-2 hover:bg-slate-50 rounded-lg transition-all flex items-center justify-between group"
                  >
                    <span className="text-xs text-slate-600 group-hover:text-indigo-600 truncate">
                      {recent.query || recent.topic || recent.state}
                    </span>
                    <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-indigo-400" />
                  </button>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic text-center py-4">No recent searches</p>
              )}
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-slate-100">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-600" /> My State Resources
            </h4>
            <div className="space-y-3">
              <a 
                href="https://www.sosnc.gov/divisions/notary" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 hover:bg-indigo-50 transition-all"
              >
                <p className="text-xs font-bold text-indigo-900">NC Notary Division</p>
                <p className="text-[10px] text-indigo-600 mt-0.5">Official Handbook & Rules</p>
              </a>
              <a 
                href="https://www.sosnc.gov/divisions/notary/enotary" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-all"
              >
                <p className="text-xs font-bold text-slate-900">NC eNotary Portal</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Electronic Registration</p>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LawsLookup;
