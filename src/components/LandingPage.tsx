import React from 'react';
import { 
  CheckCircle2, 
  ArrowRight, 
  Calculator, 
  BookOpen, 
  LayoutDashboard, 
  DollarSign, 
  Users, 
  Building2, 
  Clock, 
  Zap, 
  ShieldCheck, 
  PenLine,
  ChevronRight,
  Globe,
  Smartphone,
  BarChart3,
  Calendar,
  FileText,
  Mail,
  HelpCircle,
  Stethoscope, // For "hospital"
  Home, // For "nursing home"
  Gavel, // For "elder care/estate"
  FileCheck2, // Added for loan signing
  MapIcon, // Added for GNW
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

const FeatureCard = ({ icon: Icon, title, description, delay = 0 }: { icon: any, title: string, description: string, delay?: number }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    viewport={{ once: true }}
    className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
  >
    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
      <Icon className="w-7 h-7 text-indigo-600" />
    </div>
    <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
    <p className="text-slate-600 leading-relaxed">{description}</p>
  </motion.div>
);

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 overflow-x-hidden">
      {/* NAVIGATION */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-bottom border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Zap className="text-white w-6 h-6 fill-white" />
          </div>
          <span className="text-xl font-black tracking-tighter text-slate-900">NOTARY<span className="text-indigo-600">PRO</span></span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600">
          <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
          <a href="#workflow" className="hover:text-indigo-600 transition-colors">Workflow</a>
          <a href="#pricing" className="hover:text-indigo-600 transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-indigo-600 transition-colors">FAQ</a>
        </div>

        <div className="flex items-center gap-4">
          <Link 
            to="/login" 
            className="text-sm font-bold text-slate-900 px-4 py-2 hover:bg-slate-50 rounded-xl transition-colors"
          >
            Sign In
          </Link>
          <Link 
            to="/login?demo=true" 
            className="bg-indigo-600 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all flex items-center gap-2"
          >
            Launch Demo <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-20 px-6 lg:pt-48 lg:pb-32 max-w-7xl mx-auto overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -z-10 w-[600px] h-[600px] bg-indigo-50 rounded-full blur-3xl opacity-50 translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 -z-10 w-[400px] h-[400px] bg-blue-50 rounded-full blur-3xl opacity-50 -translate-x-1/2 translate-y-1/4" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-black uppercase tracking-widest border border-indigo-100">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
              </span>
              Built by a working Signing Agent
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-black text-slate-900 leading-[1.05] tracking-tight">
              Manage your <span className="text-indigo-600">Notary</span> business in one place.
            </h1>
            
            <p className="text-xl text-slate-600 leading-relaxed max-w-xl">
              Stop juggling spreadsheets and paper journals. Track signings, follow up on invoices, and see your real profitability with software designed for the actual workflow of a mobile notary.
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              <Link 
                to="/login"
                className="px-8 py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all flex items-center gap-2 text-lg"
              >
                Get Started Free <ChevronRight className="w-5 h-5" />
              </Link>
              <Link 
                to="/login?demo=true"
                className="px-8 py-4 bg-white text-slate-900 font-bold rounded-2xl border border-slate-200 hover:bg-slate-50 transition-all text-lg"
              >
                View Live Demo
              </Link>
            </div>

            <div className="flex items-center gap-6 pt-8 border-t border-slate-100">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map(i => (
                  <img 
                    key={i}
                    src={`https://picsum.photos/seed/notary${i}/100/100`} 
                    alt="User" 
                    className="w-10 h-10 rounded-full border-2 border-white object-cover"
                    referrerPolicy="no-referrer"
                  />
                ))}
              </div>
              <p className="text-sm text-slate-500 font-medium">
                <span className="text-slate-900 font-bold">500+ Notaries</span> already managing their business better.
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="relative"
          >
            <div className="bg-slate-900 rounded-[2.5rem] p-4 shadow-2xl shadow-indigo-600/20 relative z-10">
              <div className="bg-slate-50 rounded-[1.5rem] overflow-hidden border border-slate-800 aspect-[16/10] relative group">
                {/* Simulated App Screenshot */}
                <div className="absolute inset-0 bg-white">
                  {/* Mock Dashboard UI */}
                  <div className="p-6 space-y-6">
                    <div className="flex justify-between items-center">
                      <div className="w-32 h-6 bg-slate-100 rounded-full" />
                      <div className="w-8 h-8 bg-indigo-600 rounded-lg" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="h-24 bg-indigo-50 rounded-2xl border border-indigo-100" />
                      <div className="h-24 bg-slate-50 rounded-2xl border border-slate-100" />
                      <div className="h-24 bg-slate-50 rounded-2xl border border-slate-100" />
                    </div>
                    <div className="space-y-3">
                      <div className="h-12 bg-white rounded-xl border border-slate-100 flex items-center px-4 justify-between">
                        <div className="w-40 h-3 bg-slate-100 rounded-full" />
                        <div className="w-16 h-5 bg-emerald-100 rounded-full" />
                      </div>
                      <div className="h-12 bg-white rounded-xl border border-slate-100 flex items-center px-4 justify-between">
                        <div className="w-48 h-3 bg-slate-100 rounded-full" />
                        <div className="w-16 h-5 bg-blue-100 rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>
                {/* Overlay Graphic */}
                <div className="absolute inset-0 bg-indigo-600/5 group-hover:bg-transparent transition-colors duration-500" />
              </div>
            </div>
            {/* Floating floating card */}
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -bottom-8 -left-8 bg-white p-6 rounded-3xl shadow-2xl border border-slate-100 z-20 hidden md:block"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Revenue Today</p>
                  <p className="text-2xl font-black text-slate-900">$340.00</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FEATURE GRID */}
      <section id="features" className="py-24 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em]">Everything you need</h2>
            <p className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">Focus on the signing, we'll handle the logistics.</p>
            <p className="text-lg text-slate-600">Built for volume signing agents who need a clear view of their business.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={PenLine}
              title="Signings Management"
              description="Record loan signings, GNW, and specialty work with ease. Keep all details—from signer info to specific document sets—in one searchable place."
              delay={0.1}
            />
            <FeatureCard 
              icon={Building2}
              title="Company Tracking"
              description="Not all signing companies are equal. Track who you've worked with, their payment history, and maintain your preferred fee schedule for each."
              delay={0.2}
            />
            <FeatureCard 
              icon={DollarSign}
              title="Invoice & Payment Tracking"
              description="Never let a payment slip through the cracks. Monitor sent invoices, pending payments, and total accounts receivable at a glance."
              delay={0.3}
            />
            <FeatureCard 
              icon={BookOpen}
              title="Digital Notary Journal"
              description="A streamlined digital record of your notarizations. Compliant with workflow standard practices, accessible anywhere you are."
              delay={0.4}
            />
            <FeatureCard 
              icon={Calculator}
              title="Fee Evaluation Engine"
              description="Before you say yes, check the math. Input miles and base fee to see if a job actually meets your profitability requirements."
              delay={0.5}
            />
            <FeatureCard 
              icon={BarChart3}
              title="Business Visibility"
              description="See your real profit after mileage and expenses. Professional reports for tax season and daily performance tracking."
              delay={0.6}
            />
          </div>
        </div>
      </section>

      {/* WORKFLOW FOCUS */}
      <section id="workflow" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-8">
            <h2 className="text-4xl font-black text-slate-900 leading-tight">Specifically built for the <span className="text-indigo-600">mobile notary</span> workflow.</h2>
            <div className="space-y-6">
              {[
                { title: "Loan Signing Ready", text: "Optimized for Mortgage, Refinance, HELOC, and Seller packages.", icon: FileCheck2, color: "text-blue-600", bg: "bg-blue-50" },
                { title: "GNW & Mobile Work", text: "Easily track travel fees and individual notarization counts for General Notary Work.", icon: MapIcon, color: "text-amber-600", bg: "bg-amber-50" },
                { title: "Hospital & Specialty", text: "Supports bedside notarizations in nursing homes and medical facilities with specific location tracking.", icon: Stethoscope, color: "text-rose-600", bg: "bg-rose-50" },
                { title: "Estate & Elder Care", text: "Sensitive handling for Trust packages, Powers of Attorney, and Wills.", icon: Gavel, color: "text-slate-600", bg: "bg-slate-50" }
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-1", item.bg, item.color)}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{item.title}</h4>
                    <p className="text-sm text-slate-600 leading-relaxed font-medium">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-700">
              <Zap className="w-64 h-64" />
            </div>
            <div className="relative z-10 space-y-6">
              <h3 className="text-3xl font-black">Why it's different.</h3>
              <p className="text-slate-400 leading-relaxed text-lg">
                Most business software is built for desk workers. Notary Pro was built for people who spend half their day in a car.
              </p>
              <ul className="space-y-4 pt-4">
                <li className="flex items-center gap-3 text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  Manages companies, not just appointments
                </li>
                <li className="flex items-center gap-3 text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  Designed for real-time decision making
                </li>
                <li className="flex items-center gap-3 text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  Combines record-keeping with profitability
                </li>
              </ul>
              <div className="pt-8">
                <Link to="/login?demo=true" className="inline-flex items-center gap-2 text-indigo-400 font-bold hover:text-indigo-300 transition-colors">
                  Take a look at the workflow <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-24 px-6 bg-indigo-600 text-white rounded-[4rem] mx-6">
        <div className="max-w-7xl mx-auto text-center space-y-12">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl lg:text-5xl font-black tracking-tight mb-8">"I finally stopped losing track of who owed me money."</h2>
            <div className="flex flex-col items-center">
              <img 
                src="https://picsum.photos/seed/notarypro_user/100/100" 
                alt="Testimonial" 
                className="w-16 h-16 rounded-full border-2 border-white/20 object-cover mb-4"
                referrerPolicy="no-referrer"
              />
              <p className="font-bold">Sarah M.</p>
              <p className="text-indigo-200 text-sm">Full-Time Signing Agent</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-12">
            <div className="bg-white/10 p-8 rounded-3xl backdrop-blur-sm border border-white/10 text-left">
              <p className="italic text-indigo-50 mb-6">"The fee calculator is a game changer. I realized I was losing money on long-distance Seller packages."</p>
              <p className="font-bold text-sm">— Mark T.</p>
            </div>
            <div className="bg-white/10 p-8 rounded-3xl backdrop-blur-sm border border-white/10 text-left">
              <p className="italic text-indigo-50 mb-6">"Clean, fast, and simple. It doesn't feel like I'm fighting the app while I'm at a table."</p>
              <p className="font-bold text-sm">— Elena R.</p>
            </div>
            <div className="bg-white/10 p-8 rounded-3xl backdrop-blur-sm border border-white/10 text-left">
              <p className="italic text-indigo-50 mb-6">"Finally something that handles multiple signers and multiple companies correctly."</p>
              <p className="font-bold text-sm">— David L.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-32 px-6">
        <div className="max-w-3xl mx-auto text-center space-y-12">
          <div className="space-y-4">
            <h2 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em]">Simple Pricing</h2>
            <p className="text-5xl font-black text-slate-900 tracking-tight">One plan. Unlimited everything.</p>
          </div>

          <div className="bg-white p-12 rounded-[3rem] border-2 border-slate-900 shadow-[20px_20px_0px_#f8fafc] space-y-8 relative">
            <div className="absolute top-0 right-12 -translate-y-1/2 bg-emerald-500 text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest">Best Value</div>
            <div>
              <span className="text-6xl font-black text-slate-900">$10</span>
              <span className="text-slate-400 font-bold ml-2">/ month</span>
            </div>
            
            <ul className="text-left space-y-4 max-w-sm mx-auto">
              {[
                "Unlimited signers & appointments",
                "Full company tracking & history",
                "Expense & Mileage logging",
                "Digital Notary Journal",
                "Quarterly Tax Reporting",
                "Mobile cloud sync",
                "No contracts, cancel anytime"
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 font-medium text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            <button className="w-full py-5 bg-indigo-600 text-white font-black text-xl rounded-2xl shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all">
              Start Your Free Trial
            </button>
            <p className="text-xs text-slate-400 font-medium italic">No credit card required to start</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-6 max-w-4xl mx-auto">
        <h2 className="text-4xl font-black text-slate-900 mb-16 text-center">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {[
            {
              q: "Who is Notary Pro for?",
              a: "It's built for anyone performing notarizations as a business—from high-volume loan signing agents to part-time mobile notaries doing GNW."
            },
            {
              q: "Can I track invoices and payments?",
              a: "Yes. The system automatically handles invoice statuses (Sent, Paid, Overdue) and links them to the originating signing company."
            },
            {
              q: "Does it work for more than loan signings?",
              a: "Absolutely. You can track General Notary Work, Hospital signings, Trust deliveries, and more with custom notarization counts."
            },
            {
              q: "Is it mobile-friendly?",
              a: "Yes, the app is fully responsive and designed to work perfectly on your phone while you're in the field."
            },
            {
              q: "Is my data secure?",
              a: "We use bank-level encryption and secure cloud hosting to ensure your business records and journal stay private and protected."
            },
            {
              q: "How much does it cost?",
              a: "Notary Pro is just $10/month. No hidden fees, no per-signing charges, and no long-term contracts. You can cancel at any time."
            }
          ].map((item, i) => (
            <div key={i} className="group bg-slate-50 p-8 rounded-3xl border border-transparent hover:border-slate-200 transition-all cursor-default">
              <h3 className="text-lg font-black text-slate-900 mb-3">{item.q}</h3>
              <p className="text-slate-600 leading-relaxed font-medium">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-4xl mx-auto bg-slate-900 rounded-[4rem] p-16 space-y-10 relative overflow-hidden">
          <div className="absolute inset-0 bg-indigo-600/10 pointer-events-none" />
          <div className="space-y-4 relative z-10">
            <h2 className="text-4xl lg:text-6xl font-black text-white leading-tight">Ready to take control of your Notary business?</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">Join hundreds of signing agents who are scaling their business with clarity.</p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-6 relative z-10">
            <Link 
              to="/login"
              className="px-10 py-5 bg-white text-slate-900 font-black text-xl rounded-2xl shadow-2xl hover:bg-slate-50 transition-all"
            >
              Sign Up Now — $10/mo
            </Link>
            <Link 
              to="/login?demo=true"
              className="px-10 py-5 bg-indigo-600 text-white font-black text-xl rounded-2xl shadow-2xl hover:bg-indigo-700 transition-all"
            >
              Try the Demo
            </Link>
          </div>
          
          <p className="text-slate-500 font-medium relative z-10">Built with ⚡ by a Notary</p>
        </div>
      </section>

      {/* SIMPLE FOOTER */}
      <footer className="py-12 px-6 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 max-w-7xl mx-auto text-sm font-medium text-slate-400">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-indigo-600" />
          <span className="text-slate-900 font-black tracking-tighter">NOTARYPRO</span>
        </div>
        <div className="flex gap-8">
          <a href="#" className="hover:text-slate-900 transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-slate-900 transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-slate-900 transition-colors">Contact Support</a>
        </div>
        <p>&copy; {new Date().getFullYear()} NotaryPro App. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
