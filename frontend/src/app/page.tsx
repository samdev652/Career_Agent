"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  MapPin, 
  Globe, 
  Bell, 
  ChevronRight, 
  Filter, 
  User, 
  Layout, 
  Sparkles, 
  Loader2,
  ArrowUpRight,
  Bookmark,
  Briefcase,
  Settings,
  Cpu,
  Terminal,
  Zap,
  CheckCircle
} from 'lucide-react';

const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.'));
const API_BASE = process.env.NEXT_PUBLIC_API_URL || (isLocal ? "http://localhost:8000/api" : "https://career-agent-b6i0.onrender.com/api");

import Modal from '@/components/Modal';

export default function CareerDashboard() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ total_jobs: 0, high_match: 0, local_jobs: 0, engine_status: 'Active' });
  const [userProfile, setUserProfile] = useState<any>({ cv_text: '', preferred_tech_stack: [], location: 'Kenya', target_salary: '', portfolio_url: '', linkedin_url: '', base_application_letter: '' });
  const [wizardStep, setWizardStep] = useState(1);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [applying, setApplying] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [currentView, setCurrentView] = useState('jobs'); 
  const [scraperStatus, setScraperStatus] = useState(0);
  const [activityLog, setActivityLog] = useState(["System ready.", "Ready for matching."]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [generatedLetter, setGeneratedLetter] = useState({ title: '', content: '' });
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  const addLog = (msg: string) => {
    setActivityLog(prev => [msg, ...prev.slice(0, 4)]);
  };

  const fetchJobs = async (search: string = searchQuery) => {
    // setLoading(true); // Don't show full loading overlay on polling
    try {
      const url = search ? `${API_BASE}/jobs/?search=${search}` : `${API_BASE}/jobs/`;
      const response = await fetch(url);
      const data = await response.json();
      setJobs(data);
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    } finally {
      setLoading(false);
    }
  };



  const fetchProfile = async () => {
    try {
      const response = await fetch(`${API_BASE}/profiles/me/`);
      const data = await response.json();
      setUserProfile((prev: any) => ({ ...prev, ...data }));
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/jobs/stats/`);
      const data = await response.json();
      setStats(data);
      setScraperStatus(data.total_jobs > 0 ? 100 : 0);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const handleStartMatching = async () => {
    setScraping(true);
    setScraperStatus(10);
    addLog("Scanning global sources...");
    try {
      await fetch(`${API_BASE}/jobs/trigger_scrape/`, { method: 'POST' });
      
      let progress = 10;
      const interval = setInterval(async () => {
        progress = Math.min(progress + 15, 95);
        setScraperStatus(progress);
        if (progress === 40) addLog("Analyzing job requirements...");
        if (progress === 70) addLog("Matching with your profile...");
        await fetchJobs();
        await fetchStats();
      }, 5000);

      setTimeout(() => {
        clearInterval(interval);
        setScraping(false);
        setScraperStatus(100);
        addLog("Matching cycle complete.");
        fetchJobs();
        fetchStats();
      }, 60000); 
    } catch (error) {
      console.error("Failed to trigger scrape:", error);
      addLog("Matching cycle failed.");
      setScraping(false);
    }
  };



  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/profiles/me/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userProfile),
      });
      if (response.ok) {
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
    }
  };

  const handleApplyWithAI = (job: any) => {
    setSelectedJob(job);
    setWizardStep(1);
    setIsWizardOpen(true);
  };

  const handleWizardComplete = async () => {
    if (!selectedJob) return;
    setApplying(true);
    setIsWizardOpen(false);
    try {
      const job = selectedJob as any;
      const response = await fetch(`${API_BASE}/jobs/${job.id}/apply_with_ai/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cv_text: userProfile.cv_text,
          portfolio_url: userProfile.portfolio_url,
          linkedin_url: userProfile.linkedin_url,
          base_letter: userProfile.base_application_letter
        }),
      });
      const data = await response.json();
      
      if (!response.ok) {
        alert(data.error || "Failed to generate AI application. Please check your AI API key and connection.");
        return;
      }

      setGeneratedLetter({ title: selectedJob.title, content: data.cover_letter });
      setIsModalOpen(true);
    } catch (error) {
      console.error("Failed to apply with AI:", error);
    } finally {
      setApplying(false);
    }
  };

  const handleToggleSave = async (jobId: number) => {
    try {
      const response = await fetch(`${API_BASE}/jobs/${jobId}/toggle_save/`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setJobs(jobs.map(j => j.id === jobId ? { ...j, is_saved: data.is_saved } : j));
      }
    } catch (error) {
      console.error("Failed to toggle save:", error);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    // Debounce search
    const timer = setTimeout(() => fetchJobs(query), 500);
    return () => clearTimeout(timer);
  };

  const handleOpenDetails = (job: any) => {
    setSelectedJob(job);
    setIsDetailsOpen(true);
  };

  useEffect(() => {

    fetchJobs();
    fetchStats();
    fetchProfile();
  }, []);


  // Filtered jobs based on tab
  const filteredJobs = jobs.filter(job => {
    if (activeTab === 'high_match') return job.compatibility_score >= 80;
    if (activeTab === 'local') return job.location?.toLowerCase().includes('kenya') || job.is_kenyan_friendly;
    if (activeTab === 'saved') return job.is_saved;
    return true;
  });

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-[#020617] text-slate-200 font-sans overflow-hidden selection:bg-indigo-500/30">
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="glow w-[600px] h-[600px] bg-indigo-600/10 -top-[200px] -left-[200px]" />
        <div className="glow w-[500px] h-[500px] bg-violet-600/5 top-[40%] right-[10%]" />
        <div className="glow w-[400px] h-[400px] bg-emerald-600/5 bottom-[10%] left-[20%]" />
      </div>

      {/* Sidebar - responsive */}
      <aside className="w-full lg:w-80 h-auto lg:h-full flex flex-col p-4 lg:p-6 border-b lg:border-b-0 lg:border-r border-white/5 relative z-10 shrink-0">
        <div className="flex items-center gap-3 mb-12 lg:px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold font-space hidden lg:block tracking-tight">CareerAgent</span>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarLink 
            icon={<Briefcase size={20} />} 
            label="Jobs" 
            active={currentView === 'jobs'} 
            onClick={() => setCurrentView('jobs')}
          />
          <SidebarLink 
            icon={<Zap size={20} />} 
            label="Matches" 
            active={currentView === 'matches'} 
            onClick={() => setCurrentView('matches')}
          />
          <SidebarLink 
            icon={<User size={20} />} 
            label="Profile" 
            active={currentView === 'profile'} 
            onClick={() => setCurrentView('profile')}
          />
          <SidebarLink 
            icon={<Bell size={20} />} 
            label="Alerts" 
            badge={stats.high_match > 0 ? stats.high_match.toString() : null} 
          />
          <SidebarLink 
            icon={<Settings size={20} />} 
            label="Settings" 
            active={currentView === 'settings'} 
            onClick={() => setCurrentView('settings')}
          />
        </nav>

        <div className="mt-auto pt-6 border-t border-white/5 lg:px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 border border-white/10" />
            {userProfile.user_details?.username && (
              <div className="hidden lg:block">
                <p className="text-sm font-bold">{userProfile.user_details.username}</p>
                <p className="text-xs text-slate-500">{userProfile.target_salary || ""}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content - responsive */}
      <main className="flex-1 overflow-y-auto relative p-4 lg:p-12">
        {/* Top Navbar */}
        <header className="h-20 border-b border-white/5 px-8 flex items-center justify-between sticky top-0 bg-[#020617]/80 backdrop-blur-md z-30">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="relative w-full group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search by tech stack, role, or company..." 
                value={searchQuery}
                onChange={handleSearch}
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-2.5 pl-12 pr-4 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] transition-all text-sm"

              />
            </div>
          </div>

          <div className="flex items-center gap-6 ml-8">
            <div className="hidden xl:flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Scraper Engine</span>
                <span className="text-xs font-mono text-indigo-400">{scraping ? 'Processing...' : 'v1.0.0'}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-8 max-w-6xl mx-auto">
          {currentView === 'jobs' || currentView === 'matches' ? (
            <>
              {/* Hero Section */}
              <section className="mb-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="lg:col-span-2 p-10 rounded-[2.5rem] bg-gradient-to-br from-indigo-600/20 via-slate-900/40 to-slate-900/60 border border-white/10 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <Terminal size={200} />
                    </div>
                    <div className="relative z-10">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold mb-6 uppercase tracking-widest">
                        <Cpu size={14} /> AI MATCHING ENGINE ACTIVE
                      </div>
                      <h2 className="text-4xl md:text-5xl font-extrabold font-space mb-4 leading-tight">
                        {currentView === 'jobs' ? 'Accelerate Your ' : 'Your Best '}
                        <span className="text-gradient font-black">{currentView === 'jobs' ? 'Career Path' : 'AI Matches'}</span>.
                      </h2>
                      <p className="text-lg text-slate-400 mb-8 leading-relaxed max-w-xl">
                        {stats.total_jobs > 0 
                          ? `Our agent has analyzed ${stats.total_jobs} opportunities today. Found ${stats.high_match} roles that perfectly match your tech stack.`
                          : "Ready to find your next role? Let our Grok-powered agent scan for jobs that match your stack."}
                      </p>
                      <div className="flex flex-wrap gap-4">
                        <button 
                          onClick={handleStartMatching}
                          disabled={scraping}
                          className="btn-primary flex items-center gap-2 disabled:opacity-50 min-w-[200px]"
                        >
                          {scraping ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                          {scraping ? 'Processing...' : 'Start Matching'} <ChevronRight size={18} />
                        </button>
                        <button className="btn-secondary" onClick={() => fetchJobs()}>Refresh Feed</button>
                      </div>
                    </div>
                  </motion.div>

                  {/* Activity Log Panel */}
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card p-8 rounded-[2.5rem] border border-white/10 flex flex-col"
                  >
                    <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                      <Terminal size={14} className="text-indigo-500" /> Agent Activity
                    </h3>
                    <div className="flex-1 space-y-4">
                      {activityLog.map((log, i) => (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={i} 
                          className={`flex items-center gap-3 text-xs font-mono ${i === 0 ? 'text-indigo-400' : 'text-slate-500'}`}
                        >
                          <span className="opacity-30">{">"}</span>
                          <span>{log}</span>
                        </motion.div>
                      ))}
                    </div>
                    <div className="mt-6 pt-6 border-t border-white/5">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Engine Status</span>
                        <span className="text-[10px] font-bold text-indigo-400">{stats.engine_status || 'Ready'}</span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </section>


              {/* Job Feed Controls */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-2xl">
                  <TabButton label="All Jobs" active={activeTab === 'all'} onClick={() => setActiveTab('all')} />
                  <TabButton label="High Priority" active={activeTab === 'high_match'} onClick={() => setActiveTab('high_match')} />
                  <TabButton label="Local Gems" active={activeTab === 'local'} onClick={() => setActiveTab('local')} />
                  <TabButton label="Saved" active={activeTab === 'saved'} onClick={() => setActiveTab('saved')} />
                </div>
                <div className="text-sm text-slate-500">
                  Showing <span className="text-slate-200 font-bold">{filteredJobs.length}</span> results
                </div>
              </div>

              {/* Job Grid */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="animate-spin text-indigo-500" size={40} />
                  <p className="text-slate-400 font-medium">Loading your career opportunities...</p>
                </div>
              ) : filteredJobs.length > 0 ? (
                <motion.div 
                  variants={container}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                >
                  {loading ? (
                    // Show 6 skeletons while loading
                    [...Array(6)].map((_, i) => <JobSkeleton key={i} />)
                  ) : filteredJobs.map((job) => (
                    <JobCard 
                      key={job.id}
                      title={job.title}
                      company={job.company}
                      location={job.location || "Remote"}
                      salary={job.salary || "Competitive"}
                      match={job.compatibility_score}
                      tags={job.tech_stack || []}
                      description={job.ai_summary || job.description.substring(0, 150) + "..."}
                      icon={job.is_kenyan_friendly ? "🇰🇪" : "💼"}
                      onApply={(e: any) => {
                        e.stopPropagation();
                        handleApplyWithAI(job);
                      }}
                      onClick={() => handleOpenDetails(job)}
                      applying={applying}
                      isSaved={job.is_saved}
                      onToggleSave={() => handleToggleSave(job.id)}
                      url={job.url}
                    />
                  ))}

                </motion.div>
              ) : (
                <div className="glass-card p-12 rounded-[2.5rem] border border-white/5 flex flex-col items-center text-center">
                  <Briefcase size={48} className="text-slate-700 mb-4" />
                  <h3 className="text-xl font-bold mb-2">No jobs found yet</h3>
                  <p className="text-slate-500 max-w-sm mb-8">
                    Start AI Matching to let our engine scrape and analyze the latest roles for you.
                  </p>
                  <button onClick={handleStartMatching} className="btn-secondary">Run Initial Scrape</button>
                </div>
              )}
            </>
          ) : currentView === 'profile' ? (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="max-w-4xl"
            >
              <h2 className="text-3xl font-bold mb-2 font-space">Your Agent Profile</h2>
              <p className="text-slate-500 mb-8">Customize your data so our AI can match you with the perfect roles.</p>
              
              <div className="glass-card p-8 rounded-3xl border border-white/10 space-y-8">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">Your Experience / CV Text</label>
                  <textarea 
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-6 min-h-[300px] focus:outline-none focus:border-indigo-500/50 transition-all text-sm leading-relaxed"
                    placeholder="Paste your CV or a summary of your experience here..."
                    value={userProfile.cv_text || ''}
                    onChange={(e: any) => setUserProfile({...userProfile, cv_text: e.target.value})}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">Target Location</label>
                    <input 
                      type="text" 
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500/50 transition-all"
                      value={userProfile.location || ''}
                      onChange={(e: any) => setUserProfile({...userProfile, location: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">Target Salary</label>
                    <input 
                      type="text" 
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500/50 transition-all"
                      placeholder="e.g. Ksh 4.5M/yr"
                      value={userProfile.target_salary || ''}
                      onChange={(e: any) => setUserProfile({...userProfile, target_salary: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Globe className="w-5 h-5 text-indigo-400" />
                    Professional Links
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Portfolio URL</label>
                      <input 
                        type="url" 
                        value={userProfile.portfolio_url || ''} 
                        onChange={(e: any) => setUserProfile({...userProfile, portfolio_url: e.target.value})}
                        className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none"
                        placeholder="https://portfolio.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">LinkedIn Profile</label>
                      <input 
                        type="url" 
                        value={userProfile.linkedin_url || ''}
                        onChange={(e: any) => setUserProfile({...userProfile, linkedin_url: e.target.value})}
                        className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none"
                        placeholder="https://linkedin.com/in/..."
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    <Sparkles className="w-3 h-3" />
                    Base Application Letter (for AI Refinement)
                  </label>
                  <textarea 
                    value={userProfile.base_application_letter || ''} 
                    onChange={(e: any) => setUserProfile({...userProfile, base_application_letter: e.target.value})}
                    className="w-full h-40 bg-black/20 border border-white/10 rounded-xl p-4 text-sm font-mono focus:border-indigo-500 outline-none"
                    placeholder="Paste your standard cover letter template here..."
                  />
                </div>

                <div className="pt-4 flex items-center gap-4">
                  <button onClick={handleSaveProfile} className="btn-primary px-12">Save Profile Changes</button>
                  <AnimatePresence>
                    {showSaveSuccess && (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="flex items-center gap-2 text-emerald-400 font-bold"
                      >
                        <CheckCircle size={18} />
                        Profile Saved!
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="py-20 text-center">
              <h2 className="text-3xl font-bold mb-4 capitalize">{currentView} View</h2>
              <p className="text-slate-500">This section is being connected to the agent's brain...</p>
              <button onClick={() => setCurrentView('jobs')} className="mt-8 btn-primary">Back to Jobs</button>
            </div>
          )}
        </div>
        
        {/* AI Application Wizard Modal */}
        <Modal 
          isOpen={isWizardOpen} 
          onClose={() => setIsWizardOpen(false)} 
          title={`Tailoring Application for ${selectedJob?.title || 'Job'}`}
        >
          <div className="space-y-6">
            {/* Step Progress */}
            <div className="flex gap-2 mb-6">
              {[1, 2, 3].map(step => (
                <div 
                  key={step} 
                  className={`h-1 flex-1 rounded-full transition-colors ${wizardStep >= step ? 'bg-indigo-500' : 'bg-white/10'}`}
                />
              ))}
            </div>

            {wizardStep === 1 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                <h4 className="text-lg font-bold">Step 1: Your Technical Background</h4>
                <p className="text-sm text-slate-400">Review or paste your CV text. The AI uses this to match you to the job.</p>
                <textarea 
                  className="w-full h-48 bg-black/20 border border-white/10 rounded-xl p-4 text-sm font-mono focus:border-indigo-500 outline-none transition-colors"
                  placeholder="Paste your CV or technical background here..."
                  value={userProfile.cv_text || ''}
                  onChange={(e: any) => setUserProfile({...userProfile, cv_text: e.target.value})}
                />
                <button onClick={() => setWizardStep(2)} className="w-full btn-primary">Next: Links & Portfolio</button>
              </motion.div>
            )}

            {wizardStep === 2 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                <h4 className="text-lg font-bold">Step 2: Portfolio & Links</h4>
                <p className="text-sm text-slate-400">Add your portfolio URL or LinkedIn. The AI will highlight your best projects.</p>
                <input 
                  type="url"
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm focus:border-indigo-500 outline-none transition-colors"
                  placeholder="https://yourportfolio.com"
                  value={userProfile.portfolio_url || ''}
                  onChange={(e: any) => setUserProfile({...userProfile, portfolio_url: e.target.value})}
                />
                <div className="flex gap-4">
                  <button onClick={() => setWizardStep(1)} className="flex-1 px-6 py-3 border border-white/10 rounded-xl hover:bg-white/5 transition-colors">Back</button>
                  <button onClick={() => setWizardStep(3)} className="flex-1 btn-primary">Next: Base Letter</button>
                </div>
              </motion.div>
            )}

            {wizardStep === 3 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                <h4 className="text-lg font-bold">Step 3: Base Application Letter (Optional)</h4>
                <p className="text-sm text-slate-400">If you have an existing letter, paste it here. The AI will refine and polish it.</p>
                <textarea 
                  className="w-full h-48 bg-black/20 border border-white/10 rounded-xl p-4 text-sm font-mono focus:border-indigo-500 outline-none transition-colors"
                  placeholder="Optional: Paste your base application letter..."
                  value={userProfile.base_application_letter || ''}
                  onChange={(e: any) => setUserProfile({...userProfile, base_application_letter: e.target.value})}
                />
                <div className="flex gap-4">
                  <button onClick={() => setWizardStep(2)} className="flex-1 px-6 py-3 border border-white/10 rounded-xl hover:bg-white/5 transition-colors">Back</button>
                  <button onClick={handleWizardComplete} className="flex-1 btn-primary">Generate Final Application</button>
                </div>
              </motion.div>
            )}
          </div>
        </Modal>

        {/* AI Result Modal */}
        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title={`AI Application for ${generatedLetter.title}`}
        >
          <div className="space-y-6">
            <div className="p-6 bg-white/[0.03] border border-white/5 rounded-2xl font-mono text-sm leading-relaxed whitespace-pre-wrap text-slate-300">
              {generatedLetter.content}
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(generatedLetter.content);
                  alert("Copied to clipboard!");
                }}
                className="flex-1 px-6 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-sm font-bold"
              >
                Copy Letter
              </button>
              <a 
                href={selectedJob?.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white text-center rounded-xl transition-colors text-sm font-bold flex items-center justify-center gap-2"
              >
                Apply on Company Site
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>
            <button onClick={() => setIsModalOpen(false)} className="btn-secondary w-full">
              Close
            </button>
          </div>
        </Modal>

        {/* Job Details Modal */}
        <Modal
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          title={selectedJob?.title || "Job Details"}
        >
          {selectedJob && (
            <div className="space-y-8">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-2xl font-black mb-1">{selectedJob.company}</h4>
                  <div className="flex items-center gap-3 text-slate-400 font-medium">
                    <span className="flex items-center gap-1"><MapPin size={14} /> {selectedJob.location}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Globe size={14} /> {selectedJob.source}</span>
                  </div>
                </div>
                <div className="px-4 py-2 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-lg font-black font-space">
                  {selectedJob.compatibility_score}% Match
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <span className="text-[10px] uppercase font-black text-slate-500 block mb-1">Salary Range</span>
                  <p className="font-bold text-white">{selectedJob.salary || "Competitive"}</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <span className="text-[10px] uppercase font-black text-slate-500 block mb-1">Experience</span>
                  <p className="font-bold text-white">{selectedJob.experience_match === false ? 'Senior' : 'Mid-Level'}</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <span className="text-[10px] uppercase font-black text-slate-500 block mb-1">Kenyan Friendly</span>
                  <p className="font-bold text-emerald-400">{selectedJob.is_kenyan_friendly ? 'Yes' : 'Likely'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h5 className="text-sm font-black uppercase text-slate-500 tracking-widest mb-4">AI Analysis</h5>
                  <div className="p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl h-full">
                    <div className="flex items-center gap-2 text-indigo-400 mb-3 font-bold">
                      <Sparkles size={16} /> <span>Agent Summary</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-sm italic">
                      "{selectedJob.ai_summary || "Our agent is still analyzing the specifics of this role. Based on the title and tech stack, it appears to be a strong match for your backend profile."}"
                    </p>
                  </div>
                </div>

                <div>
                  <h5 className="text-sm font-black uppercase text-slate-500 tracking-widest mb-4">Match Breakdown</h5>
                    <div className="space-y-4">
                      <ScoreBar label="Tech Stack" score={selectedJob.tech_score || selectedJob.compatibility_score} color="bg-indigo-500" />
                      <ScoreBar label="Location" score={selectedJob.location_score || 90} color="bg-emerald-500" />
                    </div>
                </div>
              </div>


              <div>
                <h5 className="text-sm font-black uppercase text-slate-500 tracking-widest mb-4">Job Description</h5>
                <div className="text-slate-400 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                  {selectedJob.description}
                </div>
              </div>

              <div className="pt-6 border-t border-white/5 flex gap-4">
                <button 
                  onClick={() => {
                    setIsDetailsOpen(false);
                    handleApplyWithAI(selectedJob);
                  }}
                  className="btn-primary flex-1 py-4"
                >
                  Generate AI Application
                </button>
                <a 
                  href={selectedJob.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn-secondary flex-1 py-4 flex items-center justify-center gap-2"
                >
                  View Original <ArrowUpRight size={18} />
                </a>
              </div>
            </div>
          )}
        </Modal>


      </main>
    </div>
  );
}

function SidebarLink({ icon, label, active = false, badge = null, onClick = () => {} }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all group ${active ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
    >
      <div className="flex items-center gap-3">
        <span className={active ? 'text-indigo-400' : 'group-hover:text-indigo-400 transition-colors'}>{icon}</span>
        <span className="text-sm font-medium hidden lg:block">{label}</span>
      </div>
      {badge && <span className="px-2 py-0.5 bg-indigo-500 text-white text-[10px] font-bold rounded-full hidden lg:block">{badge}</span>}
    </button>
  );
}


function TabButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`px-5 py-2 text-sm font-bold rounded-xl transition-all ${active ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-200'}`}
    >
      {label}
    </button>
  );
}

function JobCard({ title, company, location, salary, match, tags, description, icon, onApply, onClick, applying, isSaved, onToggleSave, url }: any) {
  return (
    <motion.div 
      variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="glass-card p-6 rounded-[2rem] flex flex-col group relative overflow-hidden cursor-pointer"
    >
      {/* Glow effect on hover */}
      <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/[0.02] transition-colors pointer-events-none" />
      
      <div className="flex justify-between items-start mb-6">
        <div className="flex gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center text-3xl group-hover:border-indigo-500/30 transition-all shadow-inner">
            {icon}
          </div>
          <button 
            onClick={(e: any) => {
              e.stopPropagation();
              onToggleSave();
            }}
            className={`p-3 rounded-xl border transition-all ${isSaved ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'}`}
          >
            <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>
        <div className="flex flex-col items-end">
          <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black tracking-tighter mb-1">
            {match}% MATCH
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Just Now</span>
        </div>
      </div>

      <div className="flex-1">
        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-indigo-400 transition-colors flex items-center gap-2">
          {title}
        </h3>
        <p className="text-sm text-slate-400 mb-4 flex items-center gap-1.5 font-medium">
          {company} • <MapPin size={12} className="text-slate-500" /> {location}
        </p>
        
        <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 mb-6 font-medium">
          {description}
        </p>

        <div className="flex flex-wrap gap-2 mb-8">
          {tags.map((tag: any) => (
            <span key={tag} className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-slate-300">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-6 border-t border-white/5">
        <div>
          <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest block mb-0.5">Offered Salary</span>
          <span className="text-lg font-black text-indigo-400 font-space tracking-tight">{salary}</span>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={onApply}
            disabled={applying}
            className="flex-1 px-4 py-2.5 bg-white text-black font-black rounded-xl hover:bg-indigo-500 hover:text-white transition-all text-sm shadow-xl active:scale-95 disabled:opacity-50"
          >
            {applying ? <Loader2 className="animate-spin" size={18} /> : 'AI Apply'}
          </button>
          <a 
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="px-4 py-2.5 bg-white/5 border border-white/10 text-slate-300 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center"
          >
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </motion.div>
  );
}


function JobSkeleton() {
  return (
    <div className="glass-card p-6 rounded-[2rem] flex flex-col animate-pulse">
      <div className="flex justify-between items-start mb-6">
        <div className="w-14 h-14 rounded-2xl bg-white/5" />
        <div className="w-20 h-6 rounded-full bg-white/5" />
      </div>
      <div className="h-6 w-3/4 bg-white/5 rounded mb-2" />
      <div className="h-4 w-1/2 bg-white/5 rounded mb-6" />
      <div className="space-y-2 mb-8">
        <div className="h-3 w-full bg-white/5 rounded" />
        <div className="h-3 w-5/6 bg-white/5 rounded" />
      </div>
      <div className="flex gap-2 mb-8">
        <div className="h-6 w-16 bg-white/5 rounded-lg" />
        <div className="h-6 w-16 bg-white/5 rounded-lg" />
      </div>
      <div className="pt-6 border-t border-white/5 flex justify-between items-center">
        <div className="w-24 h-8 bg-white/5 rounded" />
        <div className="w-24 h-10 bg-white/5 rounded-xl" />
      </div>
    </div>
  );
}

function ScoreBar({ label, score, color }: { label: string, score: number, color: string }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-bold text-slate-400">{label}</span>
        <span className="text-xs font-black text-white">{score}%</span>
      </div>
      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          className={`h-full ${color}`}
        />
      </div>
    </div>
  );
}
