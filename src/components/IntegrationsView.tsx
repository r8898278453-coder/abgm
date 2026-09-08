import React, { useState } from 'react';
import {
  Plug,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Zap,
  Globe,
  MessageSquare,
  Send,
  Share2,
  Lock,
  Radio,
} from 'lucide-react';
import { BusinessProfile } from '../types';

interface IntegrationsViewProps {
  business: BusinessProfile;
  onUpdateBusiness?: (business: BusinessProfile) => void;
}

interface IntegrationItem {
  id: string;
  name: string;
  category: 'Google' | 'Meta' | 'Messaging' | 'Platform' | 'Social';
  description: string;
  icon: string;
  connected: boolean;
  statusText: string;
  lastSync: string;
  webhookStatus: 'active' | 'warning' | 'disconnected';
  latency: string;
}

export const IntegrationsView: React.FC<IntegrationsViewProps> = ({ business, onUpdateBusiness }) => {
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([
    {
      id: 'google_business',
      name: 'Google Business Profile & Maps',
      category: 'Google',
      description: 'Syncs 3-Pack rankings, public reviews, photos, business hours & attributes with Google APIs.',
      icon: '📍',
      connected: business.connectedAccounts.googleBusiness,
      statusText: 'Connected as Aaditech Solution (Verified Location)',
      lastSync: '4 minutes ago',
      webhookStatus: 'active',
      latency: '240ms',
    },
    {
      id: 'meta_instagram',
      name: 'Instagram Professional & Reels',
      category: 'Meta',
      description: 'Automates publishing of B2B client showcases, carousel case studies, and 15s tech reels.',
      icon: '📸',
      connected: business.connectedAccounts.metaInstagram,
      statusText: 'Connected as @aaditechs.official',
      lastSync: '12 minutes ago',
      webhookStatus: 'active',
      latency: '310ms',
    },
    {
      id: 'meta_facebook',
      name: 'Facebook Business Page',
      category: 'Meta',
      description: 'Auto-posts tech updates, festive campaigns, and captures leads from Facebook Lead Forms.',
      icon: '📘',
      connected: business.connectedAccounts.metaFacebook,
      statusText: 'Connected to Aaditech Solution Page',
      lastSync: '18 minutes ago',
      webhookStatus: 'active',
      latency: '290ms',
    },
    {
      id: 'whatsapp_cloud',
      name: 'WhatsApp Business Cloud Platform',
      category: 'Messaging',
      description: 'Official Meta Cloud API for instant lead auto-replies, quote dispatches & review collection.',
      icon: '💬',
      connected: business.connectedAccounts.whatsappBusiness,
      statusText: 'Verified Tier 1 Number (+91 98204 55120)',
      lastSync: 'Real-time Webhook Active',
      webhookStatus: 'active',
      latency: '110ms',
    },
    {
      id: 'telegram_bot',
      name: 'Telegram Bot Father AI Gateway',
      category: 'Messaging',
      description: '24/7 Natural language command hub for instant approvals, morning briefs & urgent alerts.',
      icon: '✈️',
      connected: business.connectedAccounts.telegramBot,
      statusText: 'Bot @AaditechManagerBot Active',
      lastSync: 'Real-time Webhook Active',
      webhookStatus: 'active',
      latency: '95ms',
    },
    {
      id: 'website_cname',
      name: 'Custom Domain & SSL Gateway',
      category: 'Platform',
      description: 'Connects https://aaditechs.in with automated Cloudflare SSL edge caching and SEO routing.',
      icon: '🌐',
      connected: business.connectedAccounts.website,
      statusText: 'Active on https://aaditechs.in (SSL A+)',
      lastSync: '1 hour ago',
      webhookStatus: 'active',
      latency: '45ms',
    },
    {
      id: 'linkedin_company',
      name: 'LinkedIn Company Page',
      category: 'Social',
      description: 'B2B enterprise thought-leadership and client digital transformation case studies.',
      icon: '💼',
      connected: false,
      statusText: 'Ready to connect (OAuth 2.0)',
      lastSync: 'Never',
      webhookStatus: 'disconnected',
      latency: '—',
    },
    {
      id: 'youtube_studio',
      name: 'YouTube Shorts & Studio',
      category: 'Social',
      description: 'Syndicates vertical software demo reels and automated client tutorials.',
      icon: '▶️',
      connected: false,
      statusText: 'Ready to connect (Google OAuth)',
      lastSync: 'Never',
      webhookStatus: 'disconnected',
      latency: '—',
    },
  ]);

  const [syncingId, setSyncingId] = useState<string | null>(null);

  const toggleConnection = (id: string) => {
    setIntegrations((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newStatus = !item.connected;
          return {
            ...item,
            connected: newStatus,
            statusText: newStatus ? 'Connected & Verified' : 'Disconnected',
            webhookStatus: newStatus ? 'active' : 'disconnected',
            lastSync: newStatus ? 'Just now' : 'Never',
          };
        }
        return item;
      })
    );
  };

  const handleManualSync = (id: string) => {
    setSyncingId(id);
    setTimeout(() => {
      setSyncingId(null);
      setIntegrations((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, lastSync: 'Just now', webhookStatus: 'active' } : item
        )
      );
    }, 1000);
  };

  const connectedCount = integrations.filter((i) => i.connected).length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-xs font-bold rounded-full flex items-center gap-1">
              <Plug className="w-3 h-3" /> Master Blueprint Section 4 & 65
            </span>
            <span className="text-xs text-slate-300 font-semibold">
              {connectedCount} of {integrations.length} Services Active
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">Connected Accounts & Webhook Gateway</h1>
          <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
            Unified API integrations for Aaditech Solution. The AI Marketing Manager automatically syncs reviews, posts, leads, and rankings across all channels without manual logins.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 px-4 py-3 rounded-2xl">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          <div className="text-left">
            <div className="text-xs font-bold text-white">Webhook Health: 99.98%</div>
            <div className="text-[11px] text-slate-400">Zero-Loss Event Queue Active</div>
          </div>
        </div>
      </div>

      {/* Grid of Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((item) => (
          <div
            key={item.id}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-indigo-300 transition"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl border border-slate-200">
                    {item.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-sm">{item.name}</h3>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md">
                        {item.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs">
                      {item.connected ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {item.statusText}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {item.statusText}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => toggleConnection(item.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    item.connected
                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {item.connected ? 'Disconnect' : 'Connect'}
                </button>
              </div>

              <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                {item.description}
              </p>
            </div>

            {/* Bottom Meta & Webhook Ping */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center gap-3">
                <span>Last Sync: <strong className="text-slate-700">{item.lastSync}</strong></span>
                {item.connected && (
                  <span>Latency: <strong className="text-emerald-600 font-mono">{item.latency}</strong></span>
                )}
              </div>

              {item.connected && (
                <button
                  onClick={() => handleManualSync(item.id)}
                  disabled={syncingId === item.id}
                  className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold"
                >
                  <RefreshCw className={`w-3 h-3 ${syncingId === item.id ? 'animate-spin' : ''}`} />
                  {syncingId === item.id ? 'Syncing...' : 'Sync Now'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Webhook Security & Encryption Guarantee */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-emerald-400 flex-shrink-0" />
          <div>
            <span className="font-bold text-white">Enterprise Security & Token Encryption (Section 51):</span>
            <span className="text-slate-300 ml-1">
              All Google, Meta & WhatsApp tokens are AES-256 encrypted with automatic 60-day token rotation and TLS 1.3 webhook signatures.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
