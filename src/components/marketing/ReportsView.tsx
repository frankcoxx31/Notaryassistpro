import React from 'react';
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
  CheckCircle2
} from 'lucide-react';
import { User } from 'firebase/auth';
import { cn } from '../../lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

interface ReportsViewProps {
  user: User;
}

const ReportsView: React.FC<ReportsViewProps> = ({ user }) => {
  const stats = [
    { label: 'Total Subscribers', value: '1,248', icon: TrendingUp, delta: '+12%', isPositive: true, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Avg Open Rate', value: '42.6%', icon: MailOpen, delta: '+5.4%', isPositive: true, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Avg Click Rate', value: '8.2%', icon: MousePointer2, delta: '-1.2%', isPositive: false, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Unsubscribes', value: '14', icon: UserX, delta: '+2', isPositive: false, color: 'text-rose-600', bg: 'bg-rose-50' }
  ];

  const chartData = [
    { name: 'Jan', subscribers: 400, sends: 240 },
    { name: 'Feb', subscribers: 520, sends: 300 },
    { name: 'Mar', subscribers: 680, sends: 450 },
    { name: 'Apr', subscribers: 850, sends: 580 },
    { name: 'May', subscribers: 1050, sends: 720 },
    { name: 'Jun', subscribers: 1248, sends: 900 },
  ];

  const recentCampaigns = [
    { name: 'Spring Notary Tips', status: 'sent', opens: '64%', clicks: '12%', date: 'Apr 12' },
    { name: 'Holiday Hours Update', status: 'sent', opens: '82%', clicks: '4%', date: 'Mar 28' },
    { name: 'New Estate Service', status: 'sent', opens: '58%', clicks: '22%', date: 'Mar 15' },
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
                {stat.isPositive ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {stat.delta}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Growth & Engagement</h3>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">Subscriber growth vs Emails sent</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Subscribers</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-slate-200 rounded-full"></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Sends</span>
              </div>
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSub" x1="0" y1="0" x2="0" y2="1">
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
                <Area type="monotone" dataKey="subscribers" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSub)" />
                <Area type="monotone" dataKey="sends" stroke="#e2e8f0" strokeWidth={2} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
           <div className="mb-8">
             <h3 className="text-lg font-bold text-slate-900 tracking-tight">Recent Campaign Performance</h3>
             <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">Last 3 major sends</p>
           </div>
           
           <div className="flex-1 space-y-6">
              {recentCampaigns.map((camp, i) => (
                <div key={i} className="flex items-center justify-between group">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                         <Mail className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 leading-none mb-1 group-hover:text-indigo-600 transition-colors">{camp.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          {camp.date}
                        </p>
                      </div>
                   </div>
                   <div className="flex items-center gap-6">
                      <div className="text-center">
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-0.5">Opens</p>
                         <p className="text-sm font-bold text-emerald-600">{camp.opens}</p>
                      </div>
                      <div className="text-center">
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-0.5">Clicks</p>
                         <p className="text-sm font-bold text-indigo-600">{camp.clicks}</p>
                      </div>
                   </div>
                </div>
              ))}
           </div>

           <button className="mt-8 w-full py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-all uppercase tracking-widest flex items-center justify-center gap-2">
             <BarChart3 className="w-4 h-4" />
             View All Reports
           </button>
        </div>
      </div>

      {/* Newsletter Health */}
      <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-12 relative overflow-hidden">
         <div className="absolute right-[-20px] top-[-20px] w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
         <div className="flex items-center gap-8 relative z-10">
            <div className="w-24 h-24 bg-white/10 rounded-3xl backdrop-blur-md flex items-center justify-center border border-white/20 shadow-2xl">
               <PieIcon className="w-10 h-10 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-1 tracking-tight">List Health Score: 92/100</h3>
              <p className="text-indigo-100 text-sm font-medium max-w-sm leading-relaxed">
                Your email lists are remarkably clean. Low bounce rates and high engagement from your recurring signers indicate strong deliverability.
              </p>
            </div>
         </div>
         <div className="relative z-10 flex items-center gap-4 shrink-0">
            <div className="flex flex-col items-center">
               <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center mb-2 shadow-lg shadow-emerald-500/20 ring-4 ring-white/10">
                 <CheckCircle2 className="w-6 h-6 text-white" />
               </div>
               <span className="text-[10px] font-bold uppercase">Great Reach</span>
            </div>
            <div className="flex flex-col items-center opacity-40">
               <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-2 border border-white/10">
                 <AlertCircle className="w-6 h-6 text-white" />
               </div>
               <span className="text-[10px] font-bold uppercase">No Spam</span>
            </div>
         </div>
      </div>
    </div>
  );
};

export default ReportsView;
