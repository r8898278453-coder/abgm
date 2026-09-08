import React from 'react';
import {
  Users2,
  Star,
  TrendingUp,
  Camera,
  Share2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { CompetitorData } from '../types';

interface CompetitorsViewProps {
  competitors: CompetitorData[];
  onNavigate: (tab: any) => void;
}

export const CompetitorsView: React.FC<CompetitorsViewProps> = ({
  competitors,
  onNavigate,
}) => {
  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Users2 className="w-7 h-7 text-indigo-600" />
            Competitor Radar & Intelligence
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Automated monitoring of competing repair centers in Navi Mumbai across review velocity, posting rhythm & map rank.
          </p>
        </div>
      </div>

      {/* AI Competitor Gap Alert Bento Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                Competitive Gap Insight
              </span>
              <h3 className="text-base font-black text-slate-900 mt-0.5">
                "Star Computers gained 23 reviews this month. You gained 8."
              </h3>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Star Computers has automated review requests via billing software, accelerating their Nerul & Vashi rank. 
                Your rating is higher (<strong className="text-slate-900">4.8★ vs 4.7★</strong>), meaning catching up on volume will immediately retake the #1 local rank spot.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('reviews')}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-xs self-start md:self-auto flex-shrink-0"
          >
            <span>Launch Review Push</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Benchmark Table Bento Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Navi Mumbai Local Competitive Matrix
          </h2>
          <span className="text-xs text-slate-500 font-medium">Scanned weekly</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 rounded-xl">
              <tr>
                <th className="p-3.5 rounded-l-xl font-bold">Business Name</th>
                <th className="p-3.5 font-bold">Google Rating</th>
                <th className="p-3.5 font-bold">Total Reviews</th>
                <th className="p-3.5 font-bold">Review Growth (This Mo.)</th>
                <th className="p-3.5 font-bold">Photos Count</th>
                <th className="p-3.5 font-bold">Post Frequency</th>
                <th className="p-3.5 text-right rounded-r-xl font-bold">Visibility Rank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {competitors.map((comp) => {
                const isSelf = comp.isSelf;
                return (
                  <tr
                    key={comp.id}
                    className={`transition ${
                      isSelf ? 'bg-indigo-50/70 font-semibold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${isSelf ? 'text-indigo-900' : 'text-slate-800'}`}>
                          {comp.name}
                        </span>
                        {isSelf && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full font-bold">
                            Your Business
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 font-bold text-amber-600">
                      ★ {comp.rating.toFixed(1)}
                    </td>
                    <td className="p-3.5 font-bold text-slate-800">
                      {comp.reviewsCount}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`font-bold px-2.5 py-0.5 rounded-full text-[11px] ${
                          comp.reviewGrowthThisMonth >= 15
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        +{comp.reviewGrowthThisMonth} new
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-600 font-medium">{comp.photosCount}</td>
                    <td className="p-3.5 text-slate-600 font-medium">{comp.postsPerWeek} posts / week</td>
                    <td className="p-3.5 text-right font-black text-slate-900">
                      #{comp.localVisibilityRank}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
