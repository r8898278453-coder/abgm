import React from 'react';
import {
  ShieldAlert,
  Bot,
  Smartphone,
  Monitor,
  Zap,
  Building2,
  UserCheck,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { BusinessProfile, UserRole, InterfaceView, ViewMode } from '../types';

interface HeaderProps {
  business: BusinessProfile;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  interfaceView?: InterfaceView;
  setInterfaceView?: (view: InterfaceView) => void;
  viewMode?: ViewMode;
  setViewMode?: (view: ViewMode) => void;
  isAutopilotOn: boolean;
  setIsAutopilotOn: (on: boolean) => void;
  isEmergencyPaused: boolean;
  setIsEmergencyPaused: (paused: boolean) => void;
  activeLocation?: string;
  setActiveLocation?: (loc: string) => void;
  growthScore?: number;
  notificationsCount?: number;
  onClearNotifications?: () => void;
  onOpenOnboarding?: () => void;
  isLiveMode?: boolean;
  onOpenResetModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  business,
  activeRole,
  setActiveRole,
  interfaceView,
  setInterfaceView,
  viewMode,
  setViewMode,
  isAutopilotOn,
  setIsAutopilotOn,
  isEmergencyPaused,
  setIsEmergencyPaused,
  activeLocation = 'Navi Mumbai (Sector 17 HQ)',
  setActiveLocation,
  growthScore = 88,
  onOpenOnboarding,
  isLiveMode = false,
  onOpenResetModal,
}) => {
  const currentView = viewMode || interfaceView || 'web';
  const handleSetView = (v: InterfaceView) => {
    if (setViewMode) setViewMode(v);
    if (setInterfaceView) setInterfaceView(v);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 text-slate-900 shadow-xs">
      {isEmergencyPaused && (
        <div className="bg-rose-600 text-white px-4 py-2 text-sm font-medium flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>
              <strong>EMERGENCY STOP ACTIVE:</strong> All scheduled posts, autonomous review replies, and outbound WhatsApp messages have been paused.
            </span>
          </div>
          <button
            onClick={() => setIsEmergencyPaused(false)}
            className="bg-white text-rose-700 px-3 py-1 rounded-xl text-xs font-bold hover:bg-rose-50 transition shadow-xs"
          >
            Resume Automations
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Identity in Bento Style */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-xs flex-shrink-0">
            AS
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight truncate text-slate-900">
                {business.name}
              </span>
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-[10px] font-mono font-bold hidden md:inline-block">
                bga.aaditechs.in
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold hidden sm:inline-block">
                Score: {growthScore}/100
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="truncate">{business.category}</span>
              <span>•</span>
              <div className="flex items-center gap-1 text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                <select
                  value={activeLocation}
                  onChange={(e) => setActiveLocation && setActiveLocation(e.target.value)}
                  className="bg-slate-100 border border-slate-200 rounded-lg px-2 py-0.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="Thane West (HQ)">Thane West (HQ)</option>
                  <option value="Mumbai Fort Studio">Mumbai Fort Studio</option>
                  <option value="Navi Mumbai Vashi">Navi Mumbai Vashi</option>
                  <option value="Pune Kothrud Branch">Pune Kothrud Branch</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Interface Switcher (Bento Capsule) */}
        <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button
            onClick={() => handleSetView('web')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              currentView === 'web'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Web Platform</span>
          </button>
          <button
            onClick={() => handleSetView('mobile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              currentView === 'mobile'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobile App</span>
          </button>
          <button
            onClick={() => handleSetView('telegram')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              currentView === 'telegram'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Telegram Bot</span>
          </button>
        </div>

        {/* Right Controls: Role, Autopilot, Emergency Stop in Bento Style */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Data Environment Reset / Mode Switcher */}
          {onOpenResetModal && (
            <button
              onClick={onOpenResetModal}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition shadow-xs ${
                isLiveMode
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                  : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
              }`}
              title="System Reset: Wipe test data to start fresh or reload full blueprint test coverage"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{isLiveMode ? 'Live Mode' : 'Test Mode'}</span>
              <span>Reset</span>
            </button>
          )}

          {/* 5-Min Setup Wizard (Section 3 & 72) */}
          {onOpenOnboarding && (
            <button
              onClick={onOpenOnboarding}
              className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition shadow-xs"
              title="5-Minute Business Setup & First-Value Audit Wizard"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Setup Wizard</span>
            </button>
          )}

          {/* Role selector */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700">
            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
            <select
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value as UserRole)}
              className="bg-transparent text-slate-700 focus:outline-none cursor-pointer font-medium"
            >
              <option value="owner">Role: Owner</option>
              <option value="manager">Role: Manager</option>
              <option value="staff">Role: Staff</option>
              <option value="agency">Role: Agency</option>
              <option value="super_admin">Role: Super Admin</option>
            </select>
          </div>

          {/* Autopilot toggle */}
          <button
            onClick={() => setIsAutopilotOn(!isAutopilotOn)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
              isAutopilotOn
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 shadow-xs'
                : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
            title="When active, low-risk marketing actions run autonomously with safety guardrails"
          >
            <Zap className={`w-3.5 h-3.5 ${isAutopilotOn ? 'text-emerald-600 fill-emerald-600' : ''}`} />
            <span className="hidden sm:inline">Autopilot:</span>
            <span>{isAutopilotOn ? 'ON' : 'OFF'}</span>
          </button>

          {/* Emergency Stop Button */}
          <button
            onClick={() => setIsEmergencyPaused(!isEmergencyPaused)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs ${
              isEmergencyPaused
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-rose-600 hover:bg-rose-700 text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isEmergencyPaused ? 'Resume All' : 'Pause All (Stop)'}</span>
            <span className="sm:hidden">{isEmergencyPaused ? 'Resume' : 'Stop'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
