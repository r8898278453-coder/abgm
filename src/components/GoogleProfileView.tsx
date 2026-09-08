import React, { useState } from 'react';
import {
  MapPin,
  Clock,
  Phone,
  Globe,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Plus,
  Save,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { BusinessProfile } from '../types';

interface GoogleProfileViewProps {
  business: BusinessProfile;
  onUpdateBusiness: (updated: BusinessProfile) => void;
}

export const GoogleProfileView: React.FC<GoogleProfileViewProps> = ({
  business,
  onUpdateBusiness,
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [isSaving, setIsSaving] = useState(false);
  const [newService, setNewService] = useState('');
  const [servicesList, setServicesList] = useState(business.services);
  const [isOptimizingDesc, setIsOptimizingDesc] = useState(false);
  const [description, setDescription] = useState(business.description);

  const handleAddService = () => {
    if (!newService.trim()) return;
    setServicesList([...servicesList, newService.trim()]);
    setNewService('');
  };

  const handleRemoveService = (idx: number) => {
    setServicesList(servicesList.filter((_, i) => i !== idx));
  };

  const handleAiOptimizeDesc = () => {
    setIsOptimizingDesc(true);
    setTimeout(() => {
      setDescription(
        'Top-rated certified laptop & MacBook repair laboratory in Sector 17 Vashi, Navi Mumbai. Specializing in chip-level logic board micro-soldering, emergency liquid damage restoration, instant screen & battery replacement, and gaming PC tuning with 90-day written warranty.'
      );
      setIsOptimizingDesc(false);
    }, 900);
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      onUpdateBusiness({
        ...business,
        description,
        services: servicesList,
      });
      setIsSaving(false);
    }, 600);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <MapPin className="w-7 h-7 text-indigo-600" />
            Google Business Profile Manager & Health
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Manage your official Google Maps Presence, business attributes, services catalog, and photo sync.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Syncing with Google...' : 'Save & Push to Google'}</span>
          </button>
        </div>
      </div>

      {/* AI Health Audit Bento Pill */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-900">Profile Health Score: 84 / 100</span>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">
                  2 Recommendations
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Google Search ranking favors profiles with comprehensive service listings and high-res storefront photos.
                We identified missing keywords for <em>"MacBook Logic Board"</em> and holiday hours for upcoming festival.
              </p>
            </div>
          </div>
          <button
            onClick={handleAiOptimizeDesc}
            className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-indigo-600 border border-indigo-200 text-xs font-bold px-3.5 py-2 rounded-xl transition self-start md:self-auto shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto-Enhance Profile Description</span>
          </button>
        </div>
      </div>

      {/* Profile Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Information (2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Core Business Details
            </h2>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Business Name (as seen on Google Maps)</label>
                <input
                  type="text"
                  value={business.name}
                  readOnly
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Primary Category</label>
                  <input
                    type="text"
                    value={business.category}
                    readOnly
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Secondary Category</label>
                  <input
                    type="text"
                    value={business.subCategory}
                    readOnly
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-600 font-bold">Business Description (SEO-Optimized)</label>
                  <button
                    onClick={handleAiOptimizeDesc}
                    disabled={isOptimizingDesc}
                    className="text-[11px] text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-bold"
                  >
                    <Sparkles className="w-3 h-3" />
                    {isOptimizingDesc ? 'Rewriting with Gemini...' : 'Rewrite with Local SEO Keywords'}
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 leading-relaxed focus:outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Address</label>
                  <input
                    type="text"
                    value={business.address}
                    readOnly
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Operating Hours</label>
                  <input
                    type="text"
                    value={business.openingHours}
                    readOnly
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Services Catalog */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Services Catalog (Directly affects Google search discovery)
                </h2>
                <p className="text-xs text-slate-500">Google ranks you for keywords matching active service items.</p>
              </div>
              <span className="text-xs font-bold text-indigo-600">{servicesList.length} Active Services</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Broken Laptop Hinge Reconstruction..."
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddService()}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 shadow-2xs"
              />
              <button
                onClick={handleAddService}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1 shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Service
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {servicesList.map((srv, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between text-xs shadow-2xs"
                >
                  <span className="text-slate-800 font-medium">{srv}</span>
                  <button
                    onClick={() => handleRemoveService(idx)}
                    className="text-slate-400 hover:text-rose-600 font-bold px-1.5"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Photos, Attributes & Sync Status */}
        <div className="space-y-6">
          {/* Connection Status Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">API Sync State</span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-100 px-2.5 py-0.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Connected
              </span>
            </div>
            <div className="text-xs text-slate-600 space-y-2 border-t border-slate-100 pt-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Google Place ID:</span>
                <span className="font-mono text-slate-800 font-semibold">ChIJgT184V1WzjsR...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sync Frequency:</span>
                <span className="font-bold text-slate-800">Real-time Webhook</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Last Synced:</span>
                <span className="font-bold text-slate-800">5 minutes ago</span>
              </div>
            </div>
          </div>

          {/* Profile Media / Photos */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-indigo-600" />
                Store Photos (94 Uploaded)
              </h3>
              <span className="text-[11px] text-indigo-600 font-bold cursor-pointer hover:underline">
                + Upload New
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <img
                src="https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=300&q=80"
                alt="Storefront"
                className="w-full h-24 object-cover rounded-xl border border-slate-200"
              />
              <img
                src="https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=300&q=80"
                alt="Diagnostics Lab"
                className="w-full h-24 object-cover rounded-xl border border-slate-200"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Profiles with 100+ photos receive 5x more direction requests according to Google insights.
            </p>
          </div>

          {/* Service Area Coverage */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Service Areas Covered
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {business.serviceAreas.map((area) => (
                <span
                  key={area}
                  className="bg-slate-50 text-slate-700 text-xs px-3 py-1 rounded-xl border border-slate-200 font-medium"
                >
                  📍 {area}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
