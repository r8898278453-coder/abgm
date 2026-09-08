import React, { useState } from 'react';
import {
  Globe,
  Smartphone,
  Monitor,
  ExternalLink,
  Sparkles,
  Phone,
  MapPin,
  CheckCircle2,
  Star,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { BusinessProfile } from '../types';

interface WebsiteBuilderViewProps {
  business: BusinessProfile;
}

export const WebsiteBuilderView: React.FC<WebsiteBuilderViewProps> = ({ business }) => {
  const [activePage, setActivePage] = useState<'main' | 'vashi' | 'nerul'>('main');
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');

  const pages = [
    { id: 'main', path: '/', label: 'Main Portal', title: 'Aaditech BGA - Custom Web, Mobile App & AI Automation Hub' },
    { id: 'seo', path: '/local-seo-thane-mumbai', label: 'Local SEO 3-Pack Hub', title: 'Dominate Google 3-Pack & Maps Rankings in Thane & Mumbai MMR' },
    { id: 'whatsapp', path: '/whatsapp-crm-automation', label: 'WhatsApp CRM Hub', title: 'Official WhatsApp Multi-Agent Chatbot & Lead Automation Suite' },
  ];

  const currentPage = pages.find((p) => p.id === activePage) || pages[0];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Globe className="w-7 h-7 text-indigo-600" />
            Mini Website Builder & Local SEO Hub
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Auto-generated high-converting local storefront with dedicated geo-targeted landing pages on bga.aaditechs.in.
          </p>
        </div>

        {/* Live URL badge */}
        <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-mono text-indigo-600 shadow-2xs">
          <span>https://bga.aaditechs.in{currentPage.path}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Controls Bar: Page selector + Device preview toggle Bento Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-bold">Local SEO Pages:</span>
          {pages.map((pg) => (
            <button
              key={pg.id}
              onClick={() => setActivePage(pg.id as any)}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                activePage === pg.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {pg.label}
            </button>
          ))}
        </div>

        {/* Device toggle */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
          <button
            onClick={() => setDeviceMode('desktop')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
              deviceMode === 'desktop' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" /> Desktop
          </button>
          <button
            onClick={() => setDeviceMode('mobile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
              deviceMode === 'mobile' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" /> Mobile
          </button>
        </div>
      </div>

      {/* Website Preview Container Bento Card */}
      <div className="bg-slate-100/70 border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm flex justify-center">
        <div
          className={`bg-white text-slate-900 rounded-2xl overflow-hidden shadow-md transition-all duration-300 border border-slate-200 flex flex-col ${
            deviceMode === 'mobile' ? 'w-[375px] min-h-[640px]' : 'w-full max-w-4xl min-h-[650px]'
          }`}
        >
          {/* Browser Bar */}
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs text-slate-500 font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
            </div>
            <div className="bg-white px-4 py-0.5 rounded-lg border border-slate-200 text-[11px] font-medium truncate max-w-xs shadow-2xs">
              bga.aaditechs.in{currentPage.path}
            </div>
            <div className="text-[10px] text-emerald-600 font-bold">SSL 🔒</div>
          </div>

          {/* Website Content */}
          <div className="p-6 space-y-8 overflow-y-auto flex-1">
            {/* Nav */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-2xs">
                  AD
                </div>
                <div>
                  <div className="font-extrabold text-sm leading-tight text-slate-900">{business.name}</div>
                  <div className="text-[10px] text-slate-500">{business.brandKit.tagline}</div>
                </div>
              </div>
              <a
                href={`tel:${business.phone}`}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition"
              >
                <Phone className="w-3 h-3" /> Call Expert
              </a>
            </div>

            {/* Hero Section */}
            <div className="text-center space-y-3 py-4">
              <div className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-bold px-3.5 py-1 rounded-full border border-indigo-100 shadow-2xs">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                4.9★ Rated Technology Partner by 450+ Indian Businesses
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                {currentPage.title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
                Enterprise web development, native Android & iOS mobile applications, Google 3-Pack SEO dominance, and automated WhatsApp CRM solutions that accelerate revenue.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <a
                  href={`https://wa.me/${business.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Namaste Aaditech Solution! I would like to consult regarding technology automation for my business.')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-xs transition"
                >
                  <Send className="w-3.5 h-3.5" /> WhatsApp Consultation
                </a>
                <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 transition">
                  Explore Tech Stack
                </button>
              </div>
            </div>

            {/* Services Cards */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 text-center">
                Popular Repair Solutions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {business.services.slice(0, 3).map((srv, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-1 shadow-2xs">
                    <div className="text-xs font-bold text-slate-900">{srv}</div>
                    <p className="text-[11px] text-slate-500">Genuine components with 90-day replacement warranty.</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Storefront Location & Hours Bar */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <MapPin className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                <span>{business.address}</span>
              </div>
              <div className="text-slate-500 font-medium">
                🕒 {business.openingHours}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
