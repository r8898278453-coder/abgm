import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { AuditView } from './components/AuditView';
import { GoogleProfileView } from './components/GoogleProfileView';
import { LocalSeoView } from './components/LocalSeoView';
import { CompetitorsView } from './components/CompetitorsView';
import { ReviewsView } from './components/ReviewsView';
import { ContentStudioView } from './components/ContentStudioView';
import { CalendarView } from './components/CalendarView';
import { CampaignsView } from './components/CampaignsView';
import { LeadsCrmView } from './components/LeadsCrmView';
import { WebsiteBuilderView } from './components/WebsiteBuilderView';
import { TelegramBotView } from './components/TelegramBotView';
import { AutonomousEngineView } from './components/AutonomousEngineView';
import { TrustSafetyView } from './components/TrustSafetyView';
import { AgencyView } from './components/AgencyView';
import { MobileAppView } from './components/MobileAppView';
import { IntegrationsView } from './components/IntegrationsView';
import { BillingAdminView } from './components/BillingAdminView';
import { KnowledgeBaseView } from './components/KnowledgeBaseView';
import { OnboardingModal } from './components/OnboardingModal';
import { AskAiModal } from './components/AskAiModal';
import { ResetSystemModal } from './components/ResetSystemModal';
import { AuthScreen } from './components/AuthScreen';
import { CreateCompanyModal } from './components/CreateCompanyModal';
import { Sparkles, Building2 } from 'lucide-react';

import {
  getStoredUser,
  clearStoredSession,
  fetchUserCompanies,
  fetchCompanyData,
  saveCompanyData,
  fetchCompanyLeads,
  getStoredActiveCompanyId,
  setStoredActiveCompanyId,
  checkAuthSession,
} from './services/authService';

import {
  initialBusiness,
  initialAuditItems,
  initialReviews,
  initialKeywords,
  initialCompetitors,
  initialPosts,
  initialCampaigns,
  initialLeads,
  initialAutonomousActions,
  initialGrowthScore,
  freshBlankBusiness,
  freshBlankGrowthScore,
} from './data/initialData';

import {
  UserRole,
  ViewMode,
  NavigationTab,
  BusinessProfile,
  AuditItem,
  ReviewItem,
  LeadItem,
  ContentPost,
  AutonomousAction,
  GrowthScore,
  AuthUser,
  CompanyRecord,
} from './types';

export default function App() {
  // Authentication & Multi-Company States
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(() => getStoredActiveCompanyId());
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState<boolean>(false);
  const [loadingCompanies, setLoadingCompanies] = useState<boolean>(false);

  // Global System Controls
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [userRole, setUserRole] = useState<UserRole>('owner');
  const [viewMode, setViewMode] = useState<ViewMode>('web');
  const [isAutopilotOn, setIsAutopilotOn] = useState<boolean>(true);
  const [isEmergencyPaused, setIsEmergencyPaused] = useState<boolean>(false);
  const [notificationsCount, setNotificationsCount] = useState<number>(3);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isAskAiOpen, setIsAskAiOpen] = useState<boolean>(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [isLiveMode, setIsLiveMode] = useState<boolean>(true);

  // Core Data States
  const [business, setBusiness] = useState<BusinessProfile>(initialBusiness);
  const [growthScore, setGrowthScore] = useState<GrowthScore>(initialGrowthScore);
  const [auditItems, setAuditItems] = useState<AuditItem[]>(initialAuditItems);
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews);
  const [keywords, setKeywords] = useState(initialKeywords);
  const [competitors, setCompetitors] = useState(initialCompetitors);
  const [contentPosts, setContentPosts] = useState<ContentPost[]>(initialPosts);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [leads, setLeads] = useState<LeadItem[]>(initialLeads);
  const [actions, setActions] = useState<AutonomousAction[]>(initialAutonomousActions);

  // Verify auth session on mount
  useEffect(() => {
    checkAuthSession().then((verifiedUser) => {
      if (verifiedUser) {
        setUser(verifiedUser);
        if (verifiedUser.role) setUserRole(verifiedUser.role);
      }
    });
  }, []);

  // Fetch companies when user is logged in
  useEffect(() => {
    if (!user) return;
    setLoadingCompanies(true);
    fetchUserCompanies()
      .then((userCompanies) => {
        setCompanies(userCompanies);
        if (userCompanies.length > 0) {
          const storedId = getStoredActiveCompanyId();
          const targetCompany = userCompanies.find((c) => c.id === storedId) || userCompanies[0];
          setActiveCompanyId(targetCompany.id);
          setStoredActiveCompanyId(targetCompany.id);
          loadCompanyData(targetCompany);
        } else {
          setActiveCompanyId(null);
        }
      })
      .finally(() => setLoadingCompanies(false));
  }, [user]);

  // Load isolated company data payload
  const loadCompanyData = async (comp: CompanyRecord) => {
    setBusiness((prev) => ({
      ...prev,
      id: comp.id,
      name: comp.name,
      category: comp.category,
      city: comp.city,
      phone: comp.phone || prev.phone,
      website: comp.website || prev.website,
    }));

    const payload = await fetchCompanyData(comp.id);
    if (payload) {
      if (payload.growth_score) setGrowthScore(payload.growth_score);
      if (payload.audit_items) setAuditItems(payload.audit_items);
      if (payload.reviews) setReviews(payload.reviews);
      if (payload.keywords) setKeywords(payload.keywords);
      if (payload.competitors) setCompetitors(payload.competitors);
      if (payload.posts) setContentPosts(payload.posts);
      if (payload.campaigns) setCampaigns(payload.campaigns);
      if (payload.autonomous_actions) setActions(payload.autonomous_actions);
    }

    // Load isolated leads for this specific company
    const companyLeads = await fetchCompanyLeads(comp.id);
    if (companyLeads && companyLeads.length > 0) {
      setLeads(companyLeads);
    } else if (payload && payload.leads) {
      setLeads(payload.leads);
    } else {
      setLeads([]);
    }
  };

  // Switch company handler
  const handleSelectCompany = (companyId: string) => {
    const comp = companies.find((c) => c.id === companyId);
    if (!comp) return;
    setActiveCompanyId(companyId);
    setStoredActiveCompanyId(companyId);
    loadCompanyData(comp);
  };

  // New company created handler
  const handleCompanyCreated = (newComp: CompanyRecord) => {
    setCompanies((prev) => [...prev, newComp]);
    setActiveCompanyId(newComp.id);
    setStoredActiveCompanyId(newComp.id);
    setIsCreateCompanyOpen(false);
    loadCompanyData(newComp);
  };

  // User Logout
  const handleLogout = () => {
    clearStoredSession();
    setUser(null);
    setCompanies([]);
    setActiveCompanyId(null);
  };


  // Restore saved state from localStorage if available
  useEffect(() => {
    try {
      const savedState = localStorage.getItem('localpulse_app_state');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        if (parsed.business) setBusiness(parsed.business);
        if (parsed.reviews) setReviews(parsed.reviews);
        if (parsed.leads) setLeads(parsed.leads);
        if (parsed.contentPosts) setContentPosts(parsed.contentPosts);
        if (parsed.campaigns) setCampaigns(parsed.campaigns);
        if (parsed.actions) setActions(parsed.actions);
        if (parsed.auditItems) setAuditItems(parsed.auditItems);
      }
    } catch (err) {
      console.error('Failed to load localpulse state from storage:', err);
    }
  }, []);

  // Persist state updates to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('localpulse_is_live_mode', JSON.stringify(isLiveMode));
      localStorage.setItem(
        'localpulse_app_state',
        JSON.stringify({
          business,
          reviews,
          leads,
          contentPosts,
          campaigns,
          actions,
          auditItems,
        })
      );
    } catch (err) {
      console.error('Failed to persist localpulse state to storage:', err);
    }
  }, [business, reviews, leads, contentPosts, campaigns, actions, auditItems, isLiveMode]);

  // Factory reset to clean slate for real business onboarding
  const handleFactoryReset = () => {
    setBusiness(freshBlankBusiness);
    setReviews([]);
    setLeads([]);
    setContentPosts([]);
    setCampaigns([]);
    setActions([]);
    setIsLiveMode(true);
    setIsOnboardingOpen(true);
  };

  // Reload Master Blueprint Demo Data for end-to-end testing
  const handleLoadDemoData = () => {
    setBusiness(initialBusiness);
    setReviews(initialReviews);
    setLeads(initialLeads);
    setContentPosts(initialPosts);
    setCampaigns(initialCampaigns);
    setActions(initialAutonomousActions);
    setAuditItems(initialAuditItems);
    setIsLiveMode(false);
  };

  const handleImportData = (imported: any) => {
    if (imported.business) setBusiness(imported.business);
    if (imported.reviews) setReviews(imported.reviews);
    if (imported.leads) setLeads(imported.leads);
    if (imported.posts) setContentPosts(imported.posts);
    if (imported.contentPosts) setContentPosts(imported.contentPosts);
    if (imported.campaigns) setCampaigns(imported.campaigns);
    if (imported.actions) setActions(imported.actions);
    if (imported.auditItems) setAuditItems(imported.auditItems);
    if (typeof imported.isLiveMode === 'boolean') setIsLiveMode(imported.isLiveMode);
  };

  // Handlers for state updates
  const handleFixAuditItem = (id: string) => {
    setAuditItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'pass' as const, resolved: true } : item))
    );
  };

  const handleQuickApproveReviews = () => {
    setReviews((prev) =>
      prev.map((r) =>
        !r.replied
          ? {
              ...r,
              replied: true,
              replyText: 'Thank you for choosing Apex Tech Care! We appreciate your trust in our repair lab.',
              replyDate: 'Just now',
            }
          : r
      )
    );
  };

  const handlePublishPost = (postId: string) => {
    setContentPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, status: 'published' as const } : p))
    );
  };

  const handleAddReviewReply = (reviewId: string, replyText: string) => {
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId
          ? {
              ...r,
              replied: true,
              replyText,
              replyDate: 'Just now',
            }
          : r
      )
    );
  };

  const handleAddNewPost = (post: ContentPost) => {
    setContentPosts((prev) => [post, ...prev]);
  };

  const handleUpdateLeadStage = (leadId: string, stage: LeadItem['stage']) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stage } : l))
    );
  };

  const handleApproveAction = (actionId: string) => {
    setActions((prev) =>
      prev.map((a) => (a.id === actionId ? { ...a, status: 'approved' as const } : a))
    );
  };

  // Switch to Telegram view if ViewMode is set to telegram
  const renderedTab = viewMode === 'telegram' ? 'telegram' : activeTab;

  // Render AuthScreen Barrier if not signed in
  if (!user) {
    return <AuthScreen onAuthenticated={(u) => setUser(u)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Header Navigation */}
      <Header
        business={business}
        activeRole={userRole}
        setActiveRole={setUserRole}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isAutopilotOn={isAutopilotOn}
        setIsAutopilotOn={setIsAutopilotOn}
        notificationsCount={notificationsCount}
        onClearNotifications={() => setNotificationsCount(0)}
        isEmergencyPaused={isEmergencyPaused}
        setIsEmergencyPaused={setIsEmergencyPaused}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
        isLiveMode={isLiveMode}
        onOpenResetModal={() => setIsResetModalOpen(true)}
        user={user}
        companies={companies}
        activeCompanyId={activeCompanyId || undefined}
        onSelectCompany={handleSelectCompany}
        onOpenCreateCompany={() => setIsCreateCompanyOpen(true)}
        onLogout={handleLogout}
      />


      {/* Main View Shell with Bento Spacing */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-3 sm:px-6 py-6 gap-6 items-start">
        {/* Left Navigation Sidebar */}
        <Sidebar
          currentTab={renderedTab as any}
          setCurrentTab={(tab) => {
            setActiveTab(tab as any);
            if (viewMode === 'telegram' && tab !== 'telegram') {
              setViewMode('web');
            }
          }}
          unansweredReviewsCount={(reviews || []).filter((r) => !r.replied).length}
          criticalIssuesCount={(auditItems || []).filter((a) => a.severity === 'critical' && a.status !== 'pass').length}
          newLeadsCount={(leads || []).filter((l) => l.stage === 'new').length}
          isAutopilotOn={isAutopilotOn}
        />

        {/* Content Area */}
        <main className="flex-1 min-w-0">
          {/* Emergency Alert Banner if activated */}
          {isEmergencyPaused && (
            <div className="mb-6 bg-rose-50 border border-rose-200 rounded-3xl p-5 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🛑</span>
                <div>
                  <div className="font-bold text-rose-900 text-sm">Automations Paused via Emergency Stop</div>
                  <div className="text-xs text-rose-700">Scheduled social posts, review replies & WhatsApp broadcasts are temporarily halted.</div>
                </div>
              </div>
              <button
                onClick={() => setIsEmergencyPaused(false)}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-2xl transition shadow-xs"
              >
                Resume All
              </button>
            </div>
          )}

          {/* Active View Router */}
          {viewMode === 'mobile' ? (
            <MobileAppView
              business={business}
              growthScore={growthScore}
              auditItems={auditItems}
              reviews={reviews}
              posts={contentPosts}
              leads={leads}
              onOpenTelegram={() => setViewMode('telegram')}
              onNavigateToTab={(tab) => {
                setActiveTab(tab);
                setViewMode('web');
              }}
              isAutopilotOn={isAutopilotOn}
            />
          ) : (
            <>
              {renderedTab === 'dashboard' && (
                <DashboardView
                  business={business}
                  growthScore={growthScore}
                  auditItems={auditItems}
                  reviews={reviews}
                  posts={contentPosts}
                  leads={leads}
                  onNavigate={setActiveTab}
                  onQuickApproveReviews={handleQuickApproveReviews}
                  onPublishPost={handlePublishPost}
                  unansweredReviews={(reviews || []).filter((r) => !r.replied).length}
                  newLeadsCount={(leads || []).filter((l) => l.stage === 'new').length}
                />
              )}

              {renderedTab === 'audit' && (
                <AuditView
                  auditItems={auditItems}
                  growthScore={growthScore}
                  business={business}
                  onResolveItem={handleFixAuditItem}
                  onFixItem={handleFixAuditItem}
                  onNavigate={setActiveTab}
                />
              )}

              {(renderedTab === 'google_profile' || renderedTab === 'google') && (
                <GoogleProfileView
                  business={business}
                  onUpdateBusiness={setBusiness}
                />
              )}

              {(renderedTab === 'local_seo' || renderedTab === 'seo') && (
                <LocalSeoView
                  keywords={keywords}
                />
              )}

              {renderedTab === 'competitors' && (
                <CompetitorsView
                  competitors={competitors}
                  onNavigate={setActiveTab}
                />
              )}

              {renderedTab === 'reviews' && (
                <ReviewsView
                  reviews={reviews}
                  business={business}
                  onAddReply={handleAddReviewReply}
                />
              )}

              {renderedTab === 'content' && (
                <ContentStudioView
                  business={business}
                  posts={contentPosts}
                  onAddNewPost={handleAddNewPost}
                  onNavigate={setActiveTab}
                />
              )}

              {renderedTab === 'calendar' && (
                <CalendarView
                  posts={contentPosts}
                  onNavigate={setActiveTab}
                />
              )}

              {renderedTab === 'campaigns' && (
                <CampaignsView
                  campaigns={campaigns}
                />
              )}

              {renderedTab === 'leads' && (
                <LeadsCrmView
                  leads={leads}
                  onUpdateLeadStage={handleUpdateLeadStage}
                />
              )}

              {renderedTab === 'website' && (
                <WebsiteBuilderView
                  business={business}
                />
              )}

              {renderedTab === 'telegram' && (
                <TelegramBotView
                  business={business}
                  onNavigate={setActiveTab}
                />
              )}

              {renderedTab === 'autonomous' && (
                <AutonomousEngineView
                  actions={actions}
                  isAutopilotOn={isAutopilotOn}
                  setIsAutopilotOn={setIsAutopilotOn}
                  isEmergencyPaused={isEmergencyPaused}
                  setIsEmergencyPaused={setIsEmergencyPaused}
                  onApproveAction={handleApproveAction}
                />
              )}

              {(renderedTab === 'safety' || renderedTab === 'ai_control') && (
                <TrustSafetyView
                  isEmergencyPaused={isEmergencyPaused}
                  setIsEmergencyPaused={setIsEmergencyPaused}
                />
              )}

              {renderedTab === 'agency' && (
                <AgencyView
                  business={business}
                  onNavigate={setActiveTab}
                />
              )}

              {renderedTab === 'integrations' && (
                <IntegrationsView
                  business={business}
                  onUpdateBusiness={setBusiness}
                />
              )}

              {renderedTab === 'billing' && (
                <BillingAdminView
                  business={business}
                />
              )}

              {renderedTab === 'knowledge' && (
                <KnowledgeBaseView
                  business={business}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* 5-Minute Onboarding & Setup Wizard (Section 3 & 72) */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        business={business}
        onComplete={(updated) => setBusiness(updated)}
      />

      {/* Floating 24/7 Ask AI Copilot (Section 24 & 66) */}
      <aside aria-label="Ask AI Copilot Floating Action" className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsAskAiOpen(true)}
          className="group flex items-center gap-2.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 transform hover:scale-105 border border-indigo-400/30"
        >
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
          </div>
          <span className="font-bold text-xs sm:text-sm tracking-wide">Ask AI Copilot</span>
          <span className="hidden sm:inline-block bg-indigo-800/80 text-[10px] font-mono px-2 py-0.5 rounded-full text-indigo-200 border border-indigo-700">
            24/7
          </span>
        </button>
      </aside>

      <AskAiModal
        isOpen={isAskAiOpen}
        onClose={() => setIsAskAiOpen(false)}
        business={business}
      />

      {/* First Company Setup Wizard if zero companies exist */}
      <CreateCompanyModal
        isOpen={companies.length === 0 && !loadingCompanies}
        isFirstCompany={true}
        onCompanyCreated={handleCompanyCreated}
      />

      {/* Add New Company Modal triggered from Header dropdown */}
      <CreateCompanyModal
        isOpen={isCreateCompanyOpen}
        isFirstCompany={false}
        onClose={() => setIsCreateCompanyOpen(false)}
        onCompanyCreated={handleCompanyCreated}
      />

      {/* Complete System Reset & Mode Controller (Section 83) */}
      <ResetSystemModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        isLiveMode={isLiveMode}
        onFactoryReset={handleFactoryReset}
        onLoadDemoData={handleLoadDemoData}
        onImportData={handleImportData}
        currentState={{
          business,
          reviews,
          leads,
          posts: contentPosts,
          campaigns,
          actions,
          auditItems,
          growthScore,
        }}
      />
    </div>
  );
}
