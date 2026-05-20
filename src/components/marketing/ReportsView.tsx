import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  MailOpen, 
  MousePointer2, 
  UserX,
  PieChart as PieIcon,
  ChevronUp,
  ChevronDown,
  Mail,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { User } from 'firebase/auth';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { cn } from '../../lib/utils';
import { 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';

interface ReportsViewProps {
  user: User;
}

const ReportsView: React.FC<ReportsViewProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [totalContacts, setTotalContacts] = useState(0);
  const [unsubscribeCount, setUnsubscribeCount] = useState(0);
  const [recentCampaigns, setRecentCampaigns] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [avgOpenRate, setAvgOpenRate] = useState('0%');

  useEffect(() => {
    const fetchRealData = async () => {
      try {
        setLoading(true);

        // 1. Get total contacts from Resend via backend
        let resendCount = 0;
        try {
          const res = await fetch('/api/email/contacts-count');
          if (res.ok) {
            const data = await res.json();
            resendCount = data.count || 0;
          }
        } catch (e) {
          console.warn('Could not fetch Resend count, falling back to customers');
        }

        // 2. Fallback: count customers from Firestore
        const customersSnap = await getDocs(
          query(collection(db, 'customers'), where('userId', '==', user.uid))
        );
        const customerCount = customersSnap.docs.length;
        setTotalContacts(resendCount > 0 ? resendCount : customerCount);

        // 3. Count unsubscribes from Firestore
        const unsubSnap = await getDocs(
          query(
            collection(db, 'customers'),
            where('userId', '==', user.uid),
            where('unsubscribed', '==', true)
          )
        );
        setUnsubscribeCount(unsubSnap.docs.length);

        // 4. Get recent sent campaigns from Firestore
        const campaignsSnap = await getDocs(
          query(
            collection(db, 'marketingCampaigns'),
            where('ownerId', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(3)
          )
        );
        const campaigns = campaignsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setRecentCampaigns(campaigns);

        // 4.5 Calculate average open rate from all campaigns and email events
        let totalSentCampaign = 0;
        let totalOpenedCampaign = 0;
        try {
          const allCampaignsSnap = await getDocs(
            query(
              collection(db, 'marketingCampaigns'),
              where('ownerId', '==', user.uid)
            )
          );
          allCampaignsSnap.forEach(doc => {
            const data = doc.data();
            if (data.metrics) {
              totalSentCampaign += data.metrics.sentCount || 0;
              totalOpenedCampaign += data.metrics.openCount || 0;
            }
          });
        } catch (e) {
          console.error("Error calculating campaign stats:", e);
        }

        let extraSent = 0;
        let extraOpened = 0;
        try {
          const eventsSnap = await getDocs(
            query(
              collection(db, 'emailEvents'),
              where('ownerId', '==', user.uid)
            )
          );
          eventsSnap.forEach(doc => {
            const data = doc.data();
            if (data.type === 'sent') extraSent++;
            if (data.type === 'opened') extraOpened++;
          });
        } catch (e) {
          console.error("Error calculating extra email event stats:", e);
        }

        const totalSent = totalSentCampaign + extraSent;
        const totalOpened = totalOpenedCampaign + extraOpened;
        const avgRate = totalSent > 0 ? `${Math.round((totalOpened / totalSent) * 100)}%` : '0%';
        setAvgOpenRate(avgRate);

        // 5. Build monthly customer growth chart from createdAt dates
        const allCustomers = customersSnap.docs.map(d => d.data());
        const monthMap: Record<string, number> = {};
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        
        allCustomers.forEach(c => {
          if (c.createdAt) {
            const d = new Date(c.createdAt);
            const key = monthNames[d.getMonth()];
            monthMap[key] = (monthMap[key] || 0) + 1;
          }
        });

        // Build last 6 months
        const now = new Date();
        const last6 = Array.from({ length: 6 }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
          return monthNames[d.getMonth()];
        });

        let running = 0;
        const chartData = last6.map(month => {
          running += (monthMap[month] || 0);
          return { name: month, customers: running };
        });
        setMonthlyData(chartData);

      } catch (error) {
        console.error('Error fetching reports data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRealData();
  }, [user.uid]);

  const stats = [
    { 
      label: 'Total Contacts', 
      value: loading ? '...' : totalContacts.toLocaleString(), 
      icon: TrendingUp, 
      delta: 'Live', 
      isPositive: true, 
      color: 'text-indigo-600', 
      bg: 'bg-indigo-50' 
    },
    { 
      label: 'Avg Open Rate', 
      value: loading ? '...' : avgOpenRate, 
      icon: MailOpen, 
      delta: 'Active', 
      isPositive: true, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50' 
    },
    { 
      label: 'Campaigns Sent', 
      value: loading ? '...' : recentCampaigns.filter((c: any) => c.status === 'sent').length.toString(), 
      icon: MousePointer2, 
      delta: 'Live', 
      isPositive: true, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50' 
    },
    { 
      label: 'Unsubscribes', 
      value: loading ? '...' : unsubscribeCount.toString(), 
      icon: UserX, 
      delta: 'Live', 
      isPositive: false, 
      color: 'text-rose-600', 
      bg: 'bg-rose-50' 
    }
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
            <div className="flex items-start justify-between mb-4">
              <div className={cn("p-3 rounded-xl shadow-sm transition-transform group-hover:scale-110", stat.bg)}>
                <stat.icon className={cn("w-5 h-5", stat.color)} />
              </div>
              <div className={cn(
                "flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-sm",
                stat.isPositive ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
              )}>
                {stat.delta}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-300" /> : stat.value}
              </h3>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Customer Growth</h3>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">New customers over last 6 months</p>
            </div>
          </div>
          <div className="h-[280px] w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-300" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="colorCust" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} 
                    dy={10}
                  />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="customers" 
                    stroke="#6366f1" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorCust)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="mb-8">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Recent Campaigns</h3>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">Last 3 campaigns</p>
          </div>
          
          <div className="flex-1 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-300" />
              </div>
            ) : recentCampaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Mail className="w-10 h-10 text-slate-200 mb-3" />
                <p className="text-sm font-bold text-slate-400">No campaigns sent yet</p>
                <p className="text-xs text-slate-300 mt-1">Create and send a campaign to see it here</p>
              </div>
            ) : (
              recentCampaigns.map((camp: any, i: number) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                      <Mail className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 leading-none mb-1 group-hover:text-indigo-600 transition-colors">
                        {camp.name}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" />
                        {camp.sentAt ? new Date(camp.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Draft'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-0.5">Sent</p>
                      <p className="text-sm font-bold text-emerald-600">
                        {camp.metrics?.sentCount || 0}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-0.5">Status</p>
                      <p className={cn(
                        "text-xs font-bold capitalize",
                        camp.status === 'sent' ? 'text-emerald-600' : 
                        camp.status === 'draft' ? 'text-slate-400' : 'text-indigo-600'
                      )}>
                        {camp.status}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <button className="mt-8 w-full py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-all uppercase tracking-widest flex items-center justify-center gap-2">
            <BarChart3 className="w-4 h-4" />
            View All Campaigns
          </button>
        </div>
      </div>

      {/* List Health */}
      <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-12 relative overflow-hidden">
        <div className="absolute right-[-20px] top-[-20px] w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
        <div className="flex items-center gap-8 relative z-10">
          <div className="w-24 h-24 bg-white/10 rounded-3xl backdrop-blur-md flex items-center justify-center border border-white/20 shadow-2xl">
            <PieIcon className="w-10 h-10 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-1 tracking-tight">
              {loading ? 'Loading...' : `${totalContacts} Total Contacts`}
            </h3>
            <p className="text-indigo-100 text-sm font-medium max-w-sm leading-relaxed">
              {loading ? '' : `${unsubscribeCount} unsubscribed. ${totalContacts - unsubscribeCount} active contacts available for campaigns.`}
            </p>
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-4 shrink-0">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center mb-2 shadow-lg shadow-emerald-500/20 ring-4 ring-white/10">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] font-bold uppercase">Live Data</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-2 border border-white/10">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] font-bold uppercase">Real Stats</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsView;
