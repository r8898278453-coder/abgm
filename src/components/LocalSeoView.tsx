import React, { useState } from 'react';
import {
  TrendingUp,
  MapPin,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Minus,
  Search,
  Plus,
  Compass,
} from 'lucide-react';
import { KeywordRank } from '../types';

interface LocalSeoViewProps {
  keywords: KeywordRank[];
  onAddKeyword?: (kw: string) => void;
}

export const LocalSeoView: React.FC<LocalSeoViewProps> = ({ keywords }) => {
  const [newKw, setNewKw] = useState('');
  const [selectedKw, setSelectedKw] = useState<KeywordRank>(keywords[0]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Compass className="w-7 h-7 text-indigo-600" />
            Local SEO & Google Maps Rank Grid
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Geographic 3x3 node rank tracking across Thane & Mumbai MMR commercial hubs (Naupada, Majiwada, Mulund, Airoli IT Park).
          </p>
        </div>
      </div>

      {/* AI Geo-Visibility Insight Card (Bento Banner) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
              AI Local SEO Geo-Diagnosis (bga.aaditechs.in)
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">
              Strong dominance in Thane West & Naupada, opportunity to capture Airoli & Ghodbunder IT Corridor.
            </h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed max-w-3xl">
              Aaditech Solution is firmly in the <strong>Google Top 3 Map Pack</strong> for IT & web development searches within 3 km of Thane station.
              Rankings in Ghodbunder & Airoli are at <strong>#4 - #6</strong>. 
              <strong> Recommended Action:</strong> Publish localized service landing pages for Ghodbunder Road and request reviews highlighting enterprise software delivery.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Rank Grid */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Geographic Map Rank Grid for: <span className="text-indigo-600 normal-case">"{selectedKw.keyword}"</span>
            </h2>
            <p className="text-xs text-slate-500">Position in Google 3-Pack across geo coordinates</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold">Search Volume:</span>
            <span className="bg-slate-50 text-slate-800 text-xs px-3 py-1 rounded-xl border border-slate-200 font-bold">
              {selectedKw.searchVolume}
            </span>
          </div>
        </div>

        {/* 4 Node Grid Visualizer */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          {/* Thane West */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center shadow-xs">
            <div className="text-xs text-slate-500 font-bold mb-1">Area A: Thane Stn / B-Cabin</div>
            <div className={`text-4xl font-black my-2 ${selectedKw.gridRankings.vashi <= 3 ? 'text-emerald-700' : 'text-amber-600'}`}>
              #{selectedKw.gridRankings.vashi}
            </div>
            <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100 px-2.5 py-0.5 rounded-full">
              Top 3 Map Pack ⭐
            </span>
          </div>

          {/* Naupada */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center shadow-xs">
            <div className="text-xs text-slate-500 font-bold mb-1">Area B: Naupada Commercial</div>
            <div className={`text-4xl font-black my-2 ${selectedKw.gridRankings.sanpada <= 3 ? 'text-emerald-700' : 'text-amber-600'}`}>
              #{selectedKw.gridRankings.sanpada}
            </div>
            <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100 px-2.5 py-0.5 rounded-full">
              Top 3 Map Pack ⭐
            </span>
          </div>

          {/* Ghodbunder */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center shadow-xs">
            <div className="text-xs text-slate-500 font-bold mb-1">Area C: Ghodbunder / Majiwada</div>
            <div className={`text-4xl font-black my-2 ${selectedKw.gridRankings.nerul <= 3 ? 'text-emerald-700' : 'text-rose-600'}`}>
              #{selectedKw.gridRankings.nerul}
            </div>
            <span className="text-[11px] text-amber-800 font-bold bg-amber-100 px-2.5 py-0.5 rounded-full">
              Position #{selectedKw.gridRankings.nerul}
            </span>
          </div>

          {/* Airoli IT Hub */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center shadow-xs">
            <div className="text-xs text-slate-500 font-bold mb-1">Area D: Airoli / Navi Mumbai Hub</div>
            <div className={`text-4xl font-black my-2 ${selectedKw.gridRankings.belapur <= 3 ? 'text-emerald-700' : 'text-amber-600'}`}>
              #{selectedKw.gridRankings.belapur}
            </div>
            <span className="text-[11px] text-amber-800 font-bold bg-amber-100 px-2.5 py-0.5 rounded-full">
              Page 1 Organic
            </span>
          </div>
        </div>
      </div>

      {/* Keywords Performance Table */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Tracked High-Intent Local Keywords
          </h3>
          <span className="text-xs text-slate-500 font-semibold">{keywords.length} Active Trackers</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200 font-bold">
              <tr>
                <th className="p-3">Target Keyword</th>
                <th className="p-3">Current Rank</th>
                <th className="p-3">Trend (30d)</th>
                <th className="p-3">Search Vol</th>
                <th className="p-3">Vashi</th>
                <th className="p-3">Nerul</th>
                <th className="p-3">Sanpada</th>
                <th className="p-3 text-right">Select Grid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {keywords.map((kw) => {
                const diff = kw.previousRank - kw.rank;
                const isSelected = selectedKw.id === kw.id;
                return (
                  <tr
                    key={kw.id}
                    className={`hover:bg-slate-50 transition cursor-pointer ${
                      isSelected ? 'bg-indigo-50/60 font-semibold' : ''
                    }`}
                    onClick={() => setSelectedKw(kw)}
                  >
                    <td className="p-3 font-bold text-slate-900">
                      {kw.keyword}
                    </td>
                    <td className="p-3 font-black text-slate-900">
                      #{kw.rank}
                    </td>
                    <td className="p-3">
                      {diff > 0 ? (
                        <span className="text-emerald-700 flex items-center gap-1 font-bold">
                          <ArrowUp className="w-3 h-3" /> +{diff} spots
                        </span>
                      ) : diff < 0 ? (
                        <span className="text-rose-700 flex items-center gap-1 font-bold">
                          <ArrowDown className="w-3 h-3" /> {diff} spots
                        </span>
                      ) : (
                        <span className="text-slate-500 flex items-center gap-1 font-medium">
                          <Minus className="w-3 h-3" /> Steady
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-600">{kw.searchVolume}</td>
                    <td className="p-3 font-bold text-emerald-700">#{kw.gridRankings.vashi}</td>
                    <td className="p-3 font-bold text-amber-700">#{kw.gridRankings.nerul}</td>
                    <td className="p-3 font-bold text-emerald-700">#{kw.gridRankings.sanpada}</td>
                    <td className="p-3 text-right">
                      <button
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                          isSelected ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {isSelected ? 'Viewing' : 'Inspect'}
                      </button>
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
