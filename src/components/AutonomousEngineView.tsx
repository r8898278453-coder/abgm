import React, { useState } from 'react';
import {
  Cpu,
  Zap,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Settings,
  AlertTriangle,
  Play,
  RotateCw,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { AutonomousAction } from '../types';

interface AutonomousEngineViewProps {
  actions: AutonomousAction[];
  isAutopilotOn: boolean;
  setIsAutopilotOn: (on: boolean) => void;
  isEmergencyPaused: boolean;
  setIsEmergencyPaused: (paused: boolean) => void;
  onApproveAction: (actionId: string) => void;
}

export const AutonomousEngineView: React.FC<AutonomousEngineViewProps> = ({
  actions,
  isAutopilotOn,
  setIsAutopilotOn,
  isEmergencyPaused,
  setIsEmergencyPaused,
  onApproveAction,
}) => {
  // Approval configuration settings
  const [approvalSettings, setApprovalSettings] = useState({
    googlePosts: 'approval', // 'approval' or 'auto'
    reviewReplies: 'approval',
    socialPosts: 'auto',
    promotionalOffers: 'approval',
    profileEdits: 'approval',
    analyticsReports: 'auto',
  });

  const toggleSetting = (key: keyof typeof approvalSettings) => {
    setApprovalSettings((prev) => ({
      ...prev,
      [key]: prev[key] === 'auto' ? 'approval' : 'auto',
    }));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Cpu className="w-7 h-7 text-indigo-600" />
            Autonomous AI Marketing Engine & Approval Control
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Your 24/7 AI employee operating the continuous cycle: Observe → Analyze → Decide → Plan → Generate → Approve → Publish → Measure.
          </p>
        </div>

        {/* Emergency Stop & Autopilot Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAutopilotOn(!isAutopilotOn)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition border shadow-xs ${
              isAutopilotOn
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${isAutopilotOn ? 'text-white fill-white' : 'text-slate-400'}`} />
            <span>Autopilot: {isAutopilotOn ? 'ACTIVE (Zero-Touch)' : 'STANDBY (Approval Mode)'}</span>
          </button>
        </div>
      </div>

      {/* Autonomous Cycle Visualizer Bento Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Continuous Autonomous Marketing Loop
          </span>
          <span className="text-xs text-emerald-700 font-bold flex items-center gap-1.5 bg-emerald-100 px-2.5 py-1 rounded-full">
            <RotateCw className="w-3.5 h-3.5 animate-spin text-emerald-600" /> Cycle Loop: Active every 15 mins
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-9 gap-2 text-center text-xs">
          {[
            { step: '1. OBSERVE', desc: 'Google & Leads' },
            { step: '2. ANALYZE', desc: 'Rank & Reviews' },
            { step: '3. DECIDE', desc: 'Prioritize gap' },
            { step: '4. PLAN', desc: 'Campaign hook' },
            { step: '5. GENERATE', desc: 'Copy & Creatives' },
            { step: '6. GUARDRAILS', desc: 'Policy & Safety' },
            { step: '7. APPROVAL', desc: 'Auto / Human' },
            { step: '8. PUBLISH', desc: 'API Dispatch' },
            { step: '9. MEASURE', desc: 'Calls & Revenue' },
          ].map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-1 shadow-2xs"
            >
              <div className="font-black text-[11px] text-indigo-600">{item.step}</div>
              <div className="text-[10px] text-slate-500 font-medium">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Two Columns: Approval Settings & Live Activity Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Approval Engine Configuration (5 cols) in Bento Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Approval Workflow Rules
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Control which actions require human OK vs publish directly.</p>
            </div>

            <div className="space-y-2.5 text-xs">
              {[
                { key: 'googlePosts', label: 'Google Business Posts', desc: 'Promotional updates & photos' },
                { key: 'reviewReplies', label: 'Customer Review Replies', desc: 'Positive & complaint resolution' },
                { key: 'socialPosts', label: 'Instagram / Facebook Posts', desc: 'Daily organic tips & reels' },
                { key: 'promotionalOffers', label: 'Pricing & Promotional Discounts', desc: 'Coupons & voucher offers' },
                { key: 'profileEdits', label: 'Google Profile & Hours Changes', desc: 'Business attributes' },
                { key: 'analyticsReports', label: 'Weekly Telegram Reports', desc: 'Automated executive briefs' },
              ].map((setting) => {
                const isAuto = approvalSettings[setting.key as keyof typeof approvalSettings] === 'auto';
                return (
                  <div
                    key={setting.key}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{setting.label}</div>
                      <div className="text-[10px] text-slate-500">{setting.desc}</div>
                    </div>
                    <button
                      onClick={() => toggleSetting(setting.key as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex-shrink-0 shadow-2xs ${
                        isAuto
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {isAuto ? '⚡ Auto-Publish' : '🛡️ Needs Approval'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Live Execution Queue & Actions Feed (7 cols) in Bento Card */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600" />
                Live Action Log & Pending Approvals
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Autonomous actions executed by specialized sub-agents.</p>
            </div>

            <div className="space-y-3">
              {actions.map((act) => (
                <div
                  key={act.id}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-indigo-700">{act.agent}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-500 font-medium">{act.timestamp}</span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                        act.status === 'auto_executed' || act.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {act.status === 'auto_executed'
                        ? 'Auto-Executed'
                        : act.status === 'approved'
                        ? 'Approved'
                        : 'Awaiting Approval'}
                    </span>
                  </div>

                  <div className="font-bold text-slate-900 text-sm">
                    {act.action}
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    {act.details}
                  </p>

                  {act.status === 'pending_approval' && (
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
                      <button
                        onClick={() => onApproveAction(act.id)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Execute
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
