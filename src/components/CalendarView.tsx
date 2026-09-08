import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Sparkles,
  CheckCircle2,
  Clock,
  Filter,
  Plus,
  RefreshCw,
  Send,
} from 'lucide-react';
import { ContentPost } from '../types';

interface CalendarViewProps {
  posts: ContentPost[];
  onNavigate: (tab: any) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ posts, onNavigate }) => {
  const [selectedPlatform, setSelectedPlatform] = useState<'all' | 'google' | 'instagram' | 'whatsapp'>('all');
  const [isPlanning, setIsPlanning] = useState(false);
  const [planSuccessToast, setPlanSuccessToast] = useState<string | null>(null);

  // Generate a reactive 30-day schedule array
  const [items, setItems] = useState([
    { day: 'Mon, Sep 1', platform: 'google', title: 'Weekly Diagnostic Slot Announcement', time: '10:00 AM', status: 'published' },
    { day: 'Wed, Sep 3', platform: 'instagram', title: 'Reel: Slow MacBook SSD Fix', time: '05:30 PM', status: 'published' },
    { day: 'Fri, Sep 5', platform: 'google', title: 'Weekend 30-Min Fast Diagnostic Offer', time: '11:00 AM', status: 'scheduled' },
    { day: 'Sat, Sep 6', platform: 'whatsapp', title: 'Broadcast: Student Upgrade Concession', time: '12:00 PM', status: 'scheduled' },
    { day: 'Mon, Sep 8', platform: 'google', title: 'FAQ: Liquid Spill Emergency Steps', time: '10:30 AM', status: 'draft' },
    { day: 'Wed, Sep 10', platform: 'instagram', title: 'Before & After: Gaming Rig Dust Cleaning', time: '06:00 PM', status: 'draft' },
    { day: 'Fri, Sep 12', platform: 'google', title: 'Ganesh Chaturthi Festive Tech Offer', time: '09:30 AM', status: 'draft' },
    { day: 'Sat, Sep 13', platform: 'whatsapp', title: 'Festive VIP Priority Booking Link', time: '11:00 AM', status: 'draft' },
    { day: 'Tue, Sep 16', platform: 'instagram', title: 'Customer Story: Saved 45k on Motherboard', time: '04:00 PM', status: 'draft' },
    { day: 'Fri, Sep 19', platform: 'google', title: 'Original Chargers & Batteries Stock Update', time: '11:30 AM', status: 'draft' },
  ]);

  const handlePlanNextMonth = () => {
    setIsPlanning(true);
    setTimeout(() => {
      setIsPlanning(false);
      setItems([
        { day: 'Mon, Sep 1', platform: 'google', title: 'Weekly Diagnostic Slot Announcement', time: '10:00 AM', status: 'published' },
        { day: 'Wed, Sep 3', platform: 'instagram', title: 'Reel: Slow MacBook SSD Fix', time: '05:30 PM', status: 'published' },
        { day: 'Fri, Sep 5', platform: 'google', title: 'Weekend 30-Min Fast Diagnostic Offer', time: '11:00 AM', status: 'scheduled' },
        { day: 'Sat, Sep 6', platform: 'whatsapp', title: 'Broadcast: Student Upgrade Concession', time: '12:00 PM', status: 'scheduled' },
        { day: 'Mon, Sep 8', platform: 'google', title: 'FAQ: Liquid Spill Emergency Steps', time: '10:30 AM', status: 'scheduled' },
        { day: 'Wed, Sep 10', platform: 'instagram', title: 'Before & After: Gaming Rig Dust Cleaning', time: '06:00 PM', status: 'scheduled' },
        { day: 'Fri, Sep 12', platform: 'google', title: 'Ganesh Chaturthi Festive Tech Offer', time: '09:30 AM', status: 'scheduled' },
        { day: 'Sat, Sep 13', platform: 'whatsapp', title: 'Festive VIP Priority Booking Link', time: '11:00 AM', status: 'scheduled' },
        { day: 'Tue, Sep 16', platform: 'instagram', title: 'Customer Story: Saved 45k on Motherboard', time: '04:00 PM', status: 'scheduled' },
        { day: 'Fri, Sep 19', platform: 'google', title: 'Original Chargers & Batteries Stock Update', time: '11:30 AM', status: 'scheduled' },
        { day: 'Mon, Sep 22', platform: 'google', title: 'Navratri Special Corporate Laptop Health Check', time: '10:00 AM', status: 'scheduled' },
        { day: 'Wed, Sep 24', platform: 'instagram', title: 'Reel: Why Free Antivirus Fails Small Businesses', time: '05:00 PM', status: 'scheduled' },
        { day: 'Fri, Sep 26', platform: 'whatsapp', title: 'VIP Alert: Flash Screen Replacement Voucher (20% Off)', time: '11:30 AM', status: 'scheduled' },
        { day: 'Sun, Sep 28', platform: 'google', title: 'Dussehra Mega Upgrade Offer & Zero EMI options', time: '09:00 AM', status: 'scheduled' },
        { day: 'Wed, Oct 1', platform: 'instagram', title: 'Video: Data Recovery Demo from Dead Hard Drive', time: '06:30 PM', status: 'scheduled' },
        { day: 'Sat, Oct 4', platform: 'google', title: 'Diwali Pre-Booking for SME Annual Maintenance AMC', time: '10:30 AM', status: 'scheduled' },
        { day: 'Tue, Oct 7', platform: 'whatsapp', title: 'Diwali Greetings & Client Appreciation Tech Voucher', time: '12:00 PM', status: 'scheduled' },
      ]);
      setPlanSuccessToast('✨ AI Content Engine has generated full 30-day balanced content plan synced with Google, Instagram & WhatsApp!');
      setTimeout(() => setPlanSuccessToast(null), 6000);
    }, 1000);
  };

  const filteredItems = items.filter((item) => {
    if (selectedPlatform === 'all') return true;
    return item.platform === selectedPlatform;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <CalendarIcon className="w-7 h-7 text-indigo-600" />
            30-Day Content Calendar & Planner
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Auto-balanced publishing schedule factoring in local festivals (Ganesh Utsav, Diwali), seasonality & competitor moves.
          </p>
        </div>

        <button
          onClick={handlePlanNextMonth}
          disabled={isPlanning}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-xs w-fit"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isPlanning ? 'animate-spin' : ''}`} />
          <span>{isPlanning ? 'Analyzing Festivals & Planning...' : 'Plan Next 30 Days with AI'}</span>
        </button>
      </div>

      {/* Dynamic Generation Success Banner */}
      {planSuccessToast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-bold animate-in fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{planSuccessToast}</span>
          </div>
          <button
            onClick={() => setPlanSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-950 font-black px-2 py-0.5 rounded-md hover:bg-emerald-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Bar Bento Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-bold">Filter Channel:</span>
          {(['all', 'google', 'instagram', 'whatsapp'] as const).map((plat) => (
            <button
              key={plat}
              onClick={() => setSelectedPlatform(plat)}
              className={`px-3 py-1.5 rounded-xl font-bold capitalize transition ${
                selectedPlatform === plat
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {plat}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500 font-medium flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Published
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Scheduled
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Draft
          </span>
        </div>
      </div>

      {/* Calendar Grid Bento Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          September 2026 Marketing Roster
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredItems.map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs flex flex-col justify-between space-y-3 hover:border-indigo-300 transition shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">{item.day}</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3 text-slate-400" /> {item.time}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      item.status === 'published'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'scheduled'
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>

              <div className="text-sm font-semibold text-slate-800">
                {item.title}
              </div>

              <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[11px] text-indigo-700 uppercase font-bold">
                  Channel: {item.platform}
                </span>
                <button
                  onClick={() => onNavigate('content')}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold"
                >
                  Edit Creative →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
