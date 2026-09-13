import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Image as ImageIcon,
  Video,
  Calendar,
  Share2,
  Copy,
  Check,
  Send,
  Wand2,
  Layers,
  Palette,
  Phone,
  Clock,
  Instagram,
  Facebook,
  Globe,
  CheckCircle2,
  Database,
  Trash2,
  ArrowRight,
  AlertTriangle,
  X,
  Loader2,
} from 'lucide-react';
import { BusinessProfile, ContentPost } from '../types';
import { generateMarketingContent } from '../services/aiService';
import {
  createContentPostApi,
  updatePostStatusApi,
  deleteContentPostApi,
} from '../services/authService';

interface ContentStudioViewProps {
  business: BusinessProfile;
  posts: ContentPost[];
  companyId?: string;
  onAddNewPost: (post: ContentPost) => void;
  onPublishPost?: (postId: string) => void;
  onDeletePost?: (postId: string) => void;
  onNavigate: (tab: any) => void;
}

export const ContentStudioView: React.FC<ContentStudioViewProps> = ({
  business,
  posts,
  companyId,
  onAddNewPost,
  onPublishPost,
  onDeletePost,
  onNavigate,
}) => {
  const [localPosts, setLocalPosts] = useState<ContentPost[]>(posts);
  const [contentType, setContentType] = useState<'offer' | 'festival' | 'service' | 'educational'>('offer');
  const [targetPlatform, setTargetPlatform] = useState<'google' | 'instagram' | 'whatsapp'>('google');
  const [language, setLanguage] = useState<
    'Hinglish' | 'English' | 'Hindi' | 'Marathi' | 'Gujarati' | 'Tamil' | 'Telugu' | 'Bengali' | 'Kannada' | 'Malayalam' | 'Punjabi'
  >('Hinglish');
  const [customPrompt, setCustomPrompt] = useState('Weekend 30-Min Fast Laptop Diagnostic & 20% Off Screen Replacement');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'copywriter' | 'creative' | 'reel' | 'posts'>('copywriter');
  const [scheduleSuccessToast, setScheduleSuccessToast] = useState<string | null>(null);
  const [postActionError, setPostActionError] = useState<string | null>(null);
  const [isSavingPost, setIsSavingPost] = useState(false);
  const [isPublishingId, setIsPublishingId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [postFilter, setPostFilter] = useState<'all' | 'scheduled' | 'published'>('all');

  // Sync with incoming props from parent
  useEffect(() => {
    setLocalPosts(posts);
  }, [posts]);

  // Scheduling State
  const [scheduleDate, setScheduleDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().split('T')[0];
  });
  const [scheduleTimeSlot, setScheduleTimeSlot] = useState('11:00 AM');

  // Generated state
  const [generatedPost, setGeneratedPost] = useState<Partial<ContentPost>>({
    title: 'Weekend 30-Min Fast Diagnostic Special',
    headline: '⚡ Slow Laptop? Get 30-Minute Express Health Check & 20% Off!',
    caption: 'Is your laptop taking 10 minutes to boot or overheating during office calls? 💻 Bring it to Apex Tech Sector 17 for an ultrasonic dust clean + genuine thermal paste renewal at flat ₹499 this weekend only! Includes 90-day peace of mind warranty.',
    cta: 'Book Express Slot on WhatsApp',
    hashtags: ['#LaptopRepairNaviMumbai', '#VashiTech', '#MacBookRepair', '#ComputerClinic', '#ExpressRepair'],
    imageUrl: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=600&q=80',
    reelScript: [
      { scene: 'Scene 1 (0-4s)', visual: 'Zoom on noisy fan and thermal camera showing 92°C heat', audio: 'Your laptop should not sound like a jet taking off!' },
      { scene: 'Scene 2 (4-10s)', visual: 'High speed clean, premium thermal paste application', audio: 'Here is what 30 minutes of expert maintenance looks like at Apex Tech.' },
      { scene: 'Scene 3 (10-15s)', visual: 'Silent laptop running smooth benchmark test, owner smile', audio: 'Get your machine running at peak speed today. WhatsApp us now!' },
    ],
  });

  const handleGenerate = async () => {
    setIsGenerating(true);
    const result = await generateMarketingContent({
      businessName: business.name,
      category: business.category,
      contentType,
      platform: targetPlatform,
      offer: customPrompt,
      language,
    });

    if (result) {
      setGeneratedPost((prev) => ({
        ...prev,
        headline: result.headline || prev.headline,
        caption: result.caption || prev.caption,
        cta: result.callToAction || prev.cta,
        hashtags: result.hashtags || prev.hashtags,
        reelScript: result.reelScript || prev.reelScript,
      }));
    }
    setIsGenerating(false);
  };

  const handleSchedulePost = async () => {
    setIsSavingPost(true);
    setPostActionError(null);

    const postPayload: Partial<ContentPost> = {
      title: generatedPost.title || 'New Marketing Creative',
      type: contentType,
      platforms: [targetPlatform],
      headline: generatedPost.headline || '',
      caption: generatedPost.caption || '',
      cta: generatedPost.cta || '',
      hashtags: generatedPost.hashtags || [],
      imageUrl: generatedPost.imageUrl || 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=600&q=80',
      status: 'scheduled',
      scheduledDate: scheduleDate,
      timeSlot: scheduleTimeSlot,
      reelScript: generatedPost.reelScript,
    };

    const tempId = `temp_post_${Date.now()}`;
    const optimisticPost: ContentPost = {
      id: tempId,
      title: postPayload.title!,
      type: postPayload.type!,
      platforms: postPayload.platforms!,
      headline: postPayload.headline!,
      caption: postPayload.caption!,
      cta: postPayload.cta!,
      hashtags: postPayload.hashtags!,
      imageUrl: postPayload.imageUrl!,
      status: 'scheduled',
      scheduledDate: postPayload.scheduledDate!,
      timeSlot: postPayload.timeSlot!,
      reelScript: postPayload.reelScript,
    };

    const previousPosts = [...localPosts];
    setLocalPosts((prev) => [optimisticPost, ...prev]);

    try {
      const created = await createContentPostApi({
        ...postPayload,
        companyId,
      });

      if (!created || !created.id) {
        throw new Error('Server did not return a valid post record');
      }

      setLocalPosts((prev) => prev.map((p) => (p.id === tempId ? created : p)));
      onAddNewPost(created);
      setScheduleSuccessToast(`✓ Post "${created.title}" scheduled & saved to MySQL database (ID: ${created.id})!`);
      setTimeout(() => setScheduleSuccessToast(null), 5000);
    } catch (err: any) {
      console.error('Failed to create content post in MySQL:', err);
      // Roll back
      setLocalPosts(previousPosts);
      setPostActionError(`Failed to save post to MySQL: ${err?.message || 'Server error'}. Changes rolled back.`);
    } finally {
      setIsSavingPost(false);
    }
  };

  const handlePublishPost = async (postId: string) => {
    const previousPosts = [...localPosts];
    // Optimistic status update
    setLocalPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, status: 'published' as const } : p))
    );
    setIsPublishingId(postId);
    setPostActionError(null);

    try {
      const ok = await updatePostStatusApi(postId, 'published', companyId);
      if (!ok) {
        throw new Error('Failed to update status on server');
      }
      setScheduleSuccessToast('✓ Post published to MySQL successfully!');
      setTimeout(() => setScheduleSuccessToast(null), 4000);
      onPublishPost?.(postId);
    } catch (err: any) {
      console.error('Failed to publish post to MySQL:', err);
      // Roll back
      setLocalPosts(previousPosts);
      setPostActionError(`Failed to publish post: ${err?.message || 'Server error'}. Status reverted.`);
    } finally {
      setIsPublishingId(null);
    }
  };

  const handleDeletePost = async (postId: string, postTitle: string) => {
    if (!window.confirm(`Delete post "${postTitle}" from MySQL database?`)) return;

    const previousPosts = [...localPosts];
    // Optimistic deletion
    setLocalPosts((prev) => prev.filter((p) => p.id !== postId));
    setIsDeletingId(postId);
    setPostActionError(null);

    try {
      const ok = await deleteContentPostApi(postId, companyId);
      if (!ok) {
        throw new Error('Failed to delete post on server');
      }
      setScheduleSuccessToast('✓ Post deleted from MySQL database.');
      setTimeout(() => setScheduleSuccessToast(null), 3000);
      onDeletePost?.(postId);
    } catch (err: any) {
      console.error('Failed to delete post from MySQL:', err);
      // Roll back
      setLocalPosts(previousPosts);
      setPostActionError(`Failed to delete post from MySQL: ${err?.message || 'Server error'}. Post restored.`);
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Schedule Success Toast Banner */}
      {scheduleSuccessToast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-bold animate-in fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{scheduleSuccessToast}</span>
          </div>
          <button
            onClick={() => setScheduleSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-950 font-black px-2 py-0.5 rounded-md hover:bg-emerald-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Action Error Banner with Rollback Notification */}
      {postActionError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-bold animate-in fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{postActionError}</span>
          </div>
          <button
            onClick={() => setPostActionError(null)}
            className="text-rose-700 hover:text-rose-950 font-black px-2 py-0.5 rounded-md hover:bg-rose-100"
          >
            ✕
          </button>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-7 h-7 text-indigo-600" />
              AI Content Studio & Reel Engine
            </h1>
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <Database className="w-3 h-3 text-emerald-600" />
              MySQL Synced
            </span>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Autonomous multi-lingual copywriter, brand kit creative designer, and 15s video reel director.
          </p>
        </div>

        {/* Sub-Tabs Bento Pill */}
        <div className="flex items-center gap-1 bg-white p-1.5 rounded-2xl border border-slate-200 text-xs shadow-xs">
          <button
            onClick={() => setActiveTab('copywriter')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition ${
              activeTab === 'copywriter' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Copywriter
          </button>
          <button
            onClick={() => setActiveTab('creative')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition ${
              activeTab === 'creative' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Branded Creative
          </button>
          <button
            onClick={() => setActiveTab('reel')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition ${
              activeTab === 'reel' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Reel Script Engine
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
              activeTab === 'posts' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-3 h-3" />
            <span>Posts Queue ({localPosts.length})</span>
          </button>
        </div>
      </div>

      {/* Content Body: Either Posts Queue or Main Studio Grid */}
      {activeTab === 'posts' ? (
        <div className="space-y-4">
          {/* Controls Bar in Bento Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Filter Posts:</span>
              <div className="flex items-center gap-1.5 text-xs">
                {(['all', 'scheduled', 'published'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setPostFilter(filter)}
                    className={`px-3 py-1 rounded-xl font-bold transition capitalize ${
                      postFilter === filter
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
                    }`}
                  >
                    {filter === 'all'
                      ? `All (${localPosts.length})`
                      : filter === 'scheduled'
                      ? `Scheduled (${localPosts.filter((p) => p.status === 'scheduled').length})`
                      : `Published (${localPosts.filter((p) => p.status === 'published').length})`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => onNavigate('calendar')}
                className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-bold border border-slate-200 transition flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Open Calendar View</span>
              </button>
              <button
                onClick={() => setActiveTab('copywriter')}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition shadow-xs flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Create New Post</span>
              </button>
            </div>
          </div>

          {/* Posts List */}
          {localPosts.filter((p) => postFilter === 'all' || p.status === postFilter).length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <Database className="w-6 h-6" />
              </div>
              <div className="font-bold text-slate-900 text-sm">No Content Posts Found</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No posts match the current filter. Use the AI Copywriter or Branded Creative tabs to draft and schedule posts.
              </p>
              <button
                onClick={() => setActiveTab('copywriter')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition shadow-xs inline-flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generate New AI Post
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {localPosts
                .filter((p) => postFilter === 'all' || p.status === postFilter)
                .map((post) => (
                  <div
                    key={post.id}
                    className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3 hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-black text-sm text-slate-900 line-clamp-1">{post.title}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>
                              {post.scheduledDate} • {post.timeSlot}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize ${
                              post.status === 'published'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {post.status}
                          </span>
                          <button
                            onClick={() => handleDeletePost(post.id, post.title)}
                            disabled={isDeletingId === post.id}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition disabled:opacity-50"
                            title="Delete Post from MySQL"
                          >
                            <Trash2 className={`w-3.5 h-3.5 ${isDeletingId === post.id ? 'animate-pulse text-rose-500' : ''}`} />
                          </button>
                        </div>
                      </div>

                      {post.headline && (
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs font-bold text-slate-900 leading-snug">
                          {post.headline}
                        </div>
                      )}

                      <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                        {post.caption}
                      </p>

                      <div className="flex flex-wrap gap-1">
                        {post.platforms?.map((plat) => (
                          <span
                            key={plat}
                            className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                          >
                            {plat}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-mono">ID: {post.id}</span>
                      {post.status === 'scheduled' && (
                        <button
                          onClick={() => handlePublishPost(post.id)}
                          disabled={isPublishingId === post.id}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isPublishingId === post.id ? 'Publishing...' : 'Publish to MySQL Now'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : (
        /* Main Studio Grid */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input & Strategy Controls (5 Cols) in Bento Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-indigo-600" />
              Content Strategy Generator
            </h2>

            {/* Content Type */}
            <div className="space-y-1.5 text-xs">
              <label className="text-slate-600 font-bold">Content Objective</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'offer', label: '🔥 Offer / Discount' },
                  { id: 'festival', label: '🎉 Festival / Festive' },
                  { id: 'service', label: '🛠️ Service Showcase' },
                  { id: 'educational', label: '💡 Tech Advice / FAQ' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setContentType(item.id as any)}
                    className={`p-2.5 rounded-xl text-left font-bold border transition text-xs ${
                      contentType === item.id
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Language Selection (Section 16: English, Hindi, Hinglish, Marathi, Gujarati, Tamil, Telugu, Bengali, Kannada, Malayalam, Punjabi) */}
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <label className="text-slate-600 font-bold">Target Language</label>
                <span className="text-[10px] text-indigo-600 font-semibold">11 Indian Languages</span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(['Hinglish', 'English', 'Hindi', 'Marathi'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition border ${
                      language === lang
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
                {/* Additional Regional Languages */}
                <select
                  value={['Hinglish', 'English', 'Hindi', 'Marathi'].includes(language) ? '' : language}
                  onChange={(e) => {
                    if (e.target.value) setLanguage(e.target.value as any);
                  }}
                  className={`px-2.5 py-1 rounded-xl font-bold text-xs border bg-slate-50 text-slate-700 border-slate-200 focus:outline-none focus:border-indigo-500 ${
                    !['Hinglish', 'English', 'Hindi', 'Marathi'].includes(language) ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : ''
                  }`}
                >
                  <option value="">More Languages...</option>
                  <option value="Gujarati">Gujarati (ગુજરાતી)</option>
                  <option value="Tamil">Tamil (தமிழ்)</option>
                  <option value="Telugu">Telugu (తెలుగు)</option>
                  <option value="Bengali">Bengali (বাংলা)</option>
                  <option value="Kannada">Kannada (ಕನ್ನಡ)</option>
                  <option value="Malayalam">Malayalam (മലയാളം)</option>
                  <option value="Punjabi">Punjabi (ਪੰਜਾਬੀ)</option>
                </select>
              </div>
            </div>

            {/* Target Platform */}
            <div className="space-y-1.5 text-xs">
              <label className="text-slate-600 font-bold">Publishing Platform</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'google', label: 'Google Post' },
                  { id: 'instagram', label: 'Instagram' },
                  { id: 'whatsapp', label: 'WhatsApp' },
                ].map((plat) => (
                  <button
                    key={plat.id}
                    onClick={() => setTargetPlatform(plat.id as any)}
                    className={`p-2 rounded-xl text-center font-bold border transition text-xs ${
                      targetPlatform === plat.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {plat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Campaign Prompt or Offer */}
            <div className="space-y-1.5 text-xs">
              <label className="text-slate-600 font-bold">Offer or Campaign Hook</label>
              <textarea
                rows={3}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. 20% discount on laptop screen replacement this Saturday..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 focus:outline-none focus:border-indigo-500 shadow-2xs"
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl transition shadow-xs flex items-center justify-center gap-2 text-xs"
            >
              <Wand2 className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? 'AI Crafting Creative & Copy...' : 'Generate with LocalPulse AI'}</span>
            </button>
          </div>

          {/* Brand Kit Snapshot Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 text-xs space-y-3 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <span className="flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-indigo-600" />
                Active Brand Kit
              </span>
              <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">Auto-Applied</span>
            </div>
            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <img
                src={business.brandKit.logoUrl}
                alt="Logo"
                className="w-10 h-10 rounded-xl object-cover border border-slate-200"
              />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 truncate">{business.name}</div>
                <div className="text-[11px] text-slate-500">Primary Color: <span className="font-mono text-indigo-600 font-bold">{business.brandKit.primaryColor}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Output Preview (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {activeTab === 'copywriter' && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Generated Platform Copy
                  </span>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full font-bold">
                    {language}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-[11px]">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="bg-transparent border-none text-slate-700 font-medium focus:outline-none text-[11px]"
                    />
                    <select
                      value={scheduleTimeSlot}
                      onChange={(e) => setScheduleTimeSlot(e.target.value)}
                      className="bg-transparent border-none text-slate-700 font-medium focus:outline-none text-[11px]"
                    >
                      <option value="09:00 AM">09:00 AM</option>
                      <option value="11:00 AM">11:00 AM</option>
                      <option value="02:30 PM">02:30 PM</option>
                      <option value="06:00 PM">06:00 PM</option>
                      <option value="08:00 PM">08:00 PM</option>
                    </select>
                  </div>
                  <button
                    onClick={handleSchedulePost}
                    disabled={isSavingPost}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow-xs whitespace-nowrap disabled:opacity-50"
                  >
                    {isSavingPost ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                    <span>{isSavingPost ? 'Saving to MySQL...' : 'Save to MySQL'}</span>
                  </button>
                </div>
              </div>

              {/* Headline */}
              <div className="space-y-1 text-xs">
                <span className="text-slate-500 font-bold">Catchy Headline:</span>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 font-bold text-slate-900 text-sm">
                  {generatedPost.headline}
                </div>
              </div>

              {/* Caption */}
              <div className="space-y-1 text-xs">
                <span className="text-slate-500 font-bold">Post Caption:</span>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {generatedPost.caption}
                </div>
              </div>

              {/* CTA */}
              <div className="space-y-1 text-xs">
                <span className="text-slate-500 font-bold">Call to Action (CTA):</span>
                <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 px-3.5 py-2.5 rounded-xl font-bold flex items-center justify-between">
                  <span>{generatedPost.cta}</span>
                  <span className="text-[10px] text-indigo-600 font-semibold">Direct Link to WhatsApp</span>
                </div>
              </div>

              {/* Hashtags */}
              <div className="space-y-1 text-xs">
                <span className="text-slate-500 font-bold">Rank-Targeted Local Hashtags:</span>
                <div className="flex flex-wrap gap-1.5">
                  {generatedPost.hashtags?.map((tag, idx) => (
                    <span
                      key={idx}
                      className="bg-slate-50 text-indigo-700 px-2.5 py-1 rounded-xl border border-slate-200 text-[11px] font-bold"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'creative' && (
            /* Branded Creative Visualizer with Logo, Badge & Phone Bar */
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Brand-Applied Social Creative
                </h3>
                <span className="text-xs text-slate-500">1:1 Square (Instagram & Google Post)</span>
              </div>

              {/* Branded Banner Container */}
              <div className="relative aspect-square max-w-md mx-auto rounded-3xl overflow-hidden shadow-xl border border-slate-200 bg-slate-950 flex flex-col justify-between p-6">
                {/* Background Image with Overlay */}
                <img
                  src={generatedPost.imageUrl}
                  alt="Post creative"
                  className="absolute inset-0 w-full h-full object-cover opacity-35"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />

                {/* Top Bar inside image: Logo & Tagline */}
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-700">
                    <img
                      src={business.brandKit.logoUrl}
                      alt="Logo"
                      className="w-7 h-7 rounded-lg object-cover"
                    />
                    <div>
                      <div className="text-xs font-black text-white">{business.name}</div>
                      <div className="text-[9px] text-indigo-300 font-medium">{business.brandKit.tagline}</div>
                    </div>
                  </div>
                  <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                    LIMITED OFFER
                  </span>
                </div>

                {/* Middle Content inside image: Headline */}
                <div className="relative z-10 my-auto text-center px-4 space-y-2">
                  <div className="text-xl sm:text-2xl font-black text-white leading-tight drop-shadow-md">
                    {generatedPost.headline}
                  </div>
                  <div className="text-xs text-slate-200 drop-shadow">
                    Certified Technicians • 90-Day Written Warranty
                  </div>
                </div>

                {/* Bottom Bar inside image: Contact & Location */}
                <div className="relative z-10 bg-indigo-600/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs shadow-lg">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{business.phone}</span>
                  </div>
                  <div className="text-[11px] font-medium truncate max-w-[150px]">
                    📍 {business.address}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reel' && (
            /* AI Reel / Video Script Director */
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Video className="w-4 h-4 text-indigo-600" />
                  15-Second Viral Local Reel Script
                </h3>
                <span className="text-xs text-emerald-700 font-bold bg-emerald-100 px-2.5 py-0.5 rounded-full">Ready for Recording</span>
              </div>

              <div className="space-y-3">
                {generatedPost.reelScript?.map((scene, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-700 text-xs">{scene.scene}</span>
                      <span className="text-[10px] text-slate-500 font-medium">Pacing: High Energy</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold">Visual Prompt: </span>
                      <span className="text-slate-800">{scene.visual}</span>
                    </div>
                    <div>
                      <span className="text-indigo-600 font-bold">Spoken Voiceover: </span>
                      <span className="text-slate-900 font-medium italic">"{scene.audio}"</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};
