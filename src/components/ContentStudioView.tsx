import React, { useState } from 'react';
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
} from 'lucide-react';
import { BusinessProfile, ContentPost } from '../types';
import { generateMarketingContent } from '../services/aiService';

interface ContentStudioViewProps {
  business: BusinessProfile;
  posts: ContentPost[];
  onAddNewPost: (post: ContentPost) => void;
  onNavigate: (tab: any) => void;
}

export const ContentStudioView: React.FC<ContentStudioViewProps> = ({
  business,
  posts,
  onAddNewPost,
  onNavigate,
}) => {
  const [contentType, setContentType] = useState<'offer' | 'festival' | 'service' | 'educational'>('offer');
  const [targetPlatform, setTargetPlatform] = useState<'google' | 'instagram' | 'whatsapp'>('google');
  const [language, setLanguage] = useState<
    'Hinglish' | 'English' | 'Hindi' | 'Marathi' | 'Gujarati' | 'Tamil' | 'Telugu' | 'Bengali' | 'Kannada' | 'Malayalam' | 'Punjabi'
  >('Hinglish');
  const [customPrompt, setCustomPrompt] = useState('Weekend 30-Min Fast Laptop Diagnostic & 20% Off Screen Replacement');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'copywriter' | 'creative' | 'reel'>('copywriter');
  const [scheduleSuccessToast, setScheduleSuccessToast] = useState<string | null>(null);

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

  const handleSchedulePost = () => {
    const newPost: ContentPost = {
      id: `post_${Date.now()}`,
      title: generatedPost.title || 'New Marketing Creative',
      type: contentType,
      platforms: [targetPlatform],
      headline: generatedPost.headline || '',
      caption: generatedPost.caption || '',
      cta: generatedPost.cta || '',
      hashtags: generatedPost.hashtags || [],
      imageUrl: generatedPost.imageUrl || '',
      status: 'scheduled',
      scheduledDate: '2026-09-08',
      timeSlot: '11:00 AM',
      reelScript: generatedPost.reelScript,
    };
    onAddNewPost(newPost);
    setScheduleSuccessToast(`✓ Post "${newPost.title}" scheduled & synced to ${targetPlatform.toUpperCase()}!`);
    setTimeout(() => setScheduleSuccessToast(null), 5000);
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-indigo-600" />
            AI Content Studio & Reel Engine
          </h1>
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
        </div>
      </div>

      {/* Main Studio Grid */}
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
                <button
                  onClick={handleSchedulePost}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow-xs"
                >
                  <Send className="w-3 h-3" /> Schedule & Publish
                </button>
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
    </div>
  );
};
