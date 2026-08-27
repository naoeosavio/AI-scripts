import React, { useState } from 'react';
import { Key, Settings, Info, CheckCircle, AlertCircle, HelpCircle, FileText, ChevronDown, ChevronUp, Camera, History, Wrench, RefreshCw } from 'lucide-react';

interface SessionInfo {
  keysUsed: string[];
  filesChanged: string[];
  stats: { commandsRun: number; aiTurns: number; snapshots: number };
}

interface HistoryEntry {
  name: string;
  createdAt: string;
  size: number;
}

interface SettingsPanelProps {
  keysStatus: {
    google: boolean;
    openai: boolean;
    anthropic: boolean;
    xai: boolean;
    deepseek: boolean;
    fireworks: boolean;
    openrouter: boolean;
  };
  models: Array<{
    alias: string;
    spec: string;
    vendor: string;
    model: string;
    thinking: string;
    fast: boolean;
  }>;
  systemPrompt: string;
  onSystemPromptChange: (newPrompt: string) => void;
  onResetSystemPrompt: () => void;
  sessionInfo?: SessionInfo | null;
  onSnapshot?: () => void;
  snapshotBusy?: boolean;
  history?: HistoryEntry[];
  onRefreshHistory?: () => void;
}

export default function SettingsPanel({
  keysStatus,
  models,
  systemPrompt,
  onSystemPromptChange,
  onResetSystemPrompt,
  sessionInfo,
  onSnapshot,
  snapshotBusy,
  history = [],
  onRefreshHistory,
}: SettingsPanelProps) {
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [showModelsList, setShowModelsList] = useState(false);
  const [showSession, setShowSession] = useState(false);

  return (
    <div className="flex flex-col h-full bg-[#0A0A0A] overflow-y-auto custom-scrollbar p-5 space-y-5 text-white/80 select-none">
      {/* Title */}
      <div className="flex items-center gap-2 pb-3 border-b border-white/10">
        <Settings className="w-4 h-4 text-rose-600 animate-pulse" />
        <h2 className="text-[10px] font-display font-black uppercase tracking-[0.25em] text-white">Settings & Directives</h2>
      </div>

      {/* Model Keys Status */}
      <div className="bg-[#121212] p-4 rounded-none border border-white/10 space-y-3.5">
        <div className="flex items-center gap-2 font-display font-black text-[10px] tracking-widest text-white uppercase">
          <Key className="w-3.5 h-3.5 text-rose-500" />
          <span>Vendor Credentials</span>
        </div>

        <p className="text-[10px] text-white/40 leading-relaxed font-sans">
          To activate auxiliary APIs, specify security credentials in the platform secrets manager.
        </p>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="flex items-center justify-between p-2.5 rounded-none bg-[#0A0A0A] border border-white/5 font-mono">
            <span className="font-bold uppercase tracking-wider text-white/60">Gemini API</span>
            {keysStatus.google ? (
              <span className="flex items-center gap-1 text-rose-500 font-bold text-[9px] uppercase tracking-wider">
                Active
              </span>
            ) : (
              <span className="flex items-center gap-1 text-white/20 text-[9px] uppercase tracking-wider">
                Missing
              </span>
            )}
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-none bg-[#0A0A0A] border border-white/5 font-mono">
            <span className="font-bold uppercase tracking-wider text-white/60">OpenAI</span>
            {keysStatus.openai ? (
              <span className="flex items-center gap-1 text-rose-500 font-bold text-[9px] uppercase tracking-wider">
                Active
              </span>
            ) : (
              <span className="flex items-center gap-1 text-white/20 text-[9px] uppercase tracking-wider">
                Missing
              </span>
            )}
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-none bg-[#0A0A0A] border border-white/5 font-mono">
            <span className="font-bold uppercase tracking-wider text-white/60">Anthropic</span>
            {keysStatus.anthropic ? (
              <span className="flex items-center gap-1 text-rose-500 font-bold text-[9px] uppercase tracking-wider">
                Active
              </span>
            ) : (
              <span className="flex items-center gap-1 text-white/20 text-[9px] uppercase tracking-wider">
                Missing
              </span>
            )}
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-none bg-[#0A0A0A] border border-white/5 font-mono">
            <span className="font-bold uppercase tracking-wider text-white/60">DeepSeek</span>
            {keysStatus.deepseek ? (
              <span className="flex items-center gap-1 text-rose-500 font-bold text-[9px] uppercase tracking-wider">
                Active
              </span>
            ) : (
              <span className="flex items-center gap-1 text-white/20 text-[9px] uppercase tracking-wider">
                Missing
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5 p-2.5 rounded-none bg-[#0A0A0A] border border-white/5 col-span-2 font-mono">
            <span className="font-bold uppercase tracking-wider text-white/60">Other Pipelines</span>
            <div className="flex gap-4 pt-1 text-[9px] uppercase tracking-wider">
              <span className={keysStatus.xai ? "text-rose-500 font-bold" : "text-white/20"}>
                xAI: {keysStatus.xai ? "ON" : "OFF"}
              </span>
              <span className={keysStatus.fireworks ? "text-rose-500 font-bold" : "text-white/20"}>
                Fireworks: {keysStatus.fireworks ? "ON" : "OFF"}
              </span>
              <span className={keysStatus.openrouter ? "text-rose-500 font-bold" : "text-white/20"}>
                OpenRouter: {keysStatus.openrouter ? "ON" : "OFF"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* System Prompt Customizer */}
      <div className="bg-[#121212] rounded-none border border-white/10 overflow-hidden">
        <button
          onClick={() => setShowPromptEditor(!showPromptEditor)}
          className="w-full flex items-center justify-between p-4 text-left font-display font-black text-[10px] tracking-widest text-white uppercase hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-rose-500" />
            <span>Agent System Guidelines</span>
          </div>
          {showPromptEditor ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
        </button>

        {showPromptEditor && (
          <div className="p-4 border-t border-white/10 space-y-3">
            <p className="text-[10px] text-white/40 leading-relaxed font-sans">
              Override instruction weights to refine formatting syntax, command auto-execution variables, or strict error responses.
            </p>
            <textarea
              value={systemPrompt}
              onChange={(e) => onSystemPromptChange(e.target.value)}
              className="w-full h-48 p-3 bg-[#0A0A0A] text-[#F5F5F5] font-mono text-[10px] rounded-none focus:outline-none focus:border-white resize-y leading-relaxed select-text border border-white/10"
            />
            <div className="flex justify-end pt-1">
              <button
                onClick={onResetSystemPrompt}
                className="px-3 py-1 bg-white hover:bg-rose-600 text-black hover:text-white rounded-none text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-colors font-display"
              >
                Reset Default
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Session & History */}
      <div className="bg-[#121212] rounded-none border border-white/10 overflow-hidden">
        <button
          onClick={() => setShowSession(!showSession)}
          className="w-full flex items-center justify-between p-4 text-left font-display font-black text-[10px] tracking-widest text-white uppercase hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-rose-500" />
            <span>Session & History (.tell)</span>
          </div>
          {showSession ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
        </button>

        {showSession && (
          <div className="p-4 border-t border-white/10 space-y-3">
            <p className="text-[10px] text-white/40 leading-relaxed font-sans">
              Session is auto-saved to <span className="text-white/70 font-mono">.tell/session.json</span>.
              Snapshots go to <span className="text-white/70 font-mono">.tell/history/</span> with a
              <span className="text-white/70 font-mono"> latest</span> symlink.
            </p>

            {/* Stats */}
            {sessionInfo?.stats && (
              <div className="grid grid-cols-3 gap-2 text-[9px] font-mono">
                <div className="p-2 bg-[#0A0A0A] border border-white/5">
                  <span className="block text-white/30 uppercase tracking-wider">Cmds</span>
                  <strong className="text-white/90">{sessionInfo.stats.commandsRun ?? 0}</strong>
                </div>
                <div className="p-2 bg-[#0A0A0A] border border-white/5">
                  <span className="block text-white/30 uppercase tracking-wider">AI Turns</span>
                  <strong className="text-white/90">{sessionInfo.stats.aiTurns ?? 0}</strong>
                </div>
                <div className="p-2 bg-[#0A0A0A] border border-white/5">
                  <span className="block text-white/30 uppercase tracking-wider">Snapshots</span>
                  <strong className="text-white/90">{sessionInfo.stats.snapshots ?? 0}</strong>
                </div>
              </div>
            )}

            {/* Keys used (provider names only, never the secrets) */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5 text-[9px] text-white/40 uppercase tracking-widest">
                <Key className="w-2.5 h-2.5 text-rose-500" />
                Keys used (providers)
              </div>
              {sessionInfo?.keysUsed?.length ? (
                <div className="flex flex-wrap gap-1">
                  {sessionInfo.keysUsed.map((k) => (
                    <span key={k} className="px-1.5 py-0.5 bg-rose-950/50 border border-rose-600/30 text-rose-400 text-[9px] font-mono uppercase">
                      {k}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[9px] text-white/25 font-sans">No AI calls yet this session.</p>
              )}
            </div>

            {/* Files changed */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5 text-[9px] text-white/40 uppercase tracking-widest">
                <Wrench className="w-2.5 h-2.5 text-rose-500" />
                Files changed ({sessionInfo?.filesChanged?.length ?? 0})
              </div>
              {sessionInfo?.filesChanged?.length ? (
                <div className="max-h-20 overflow-y-auto custom-scrollbar space-y-0.5">
                  {sessionInfo.filesChanged.slice(0, 12).map((f, i) => (
                    <div key={i} className="text-[9px] text-white/50 font-mono truncate" title={f}>
                      {f}
                    </div>
                  ))}
                  {sessionInfo.filesChanged.length > 12 && (
                    <div className="text-[9px] text-white/25 font-mono">
                      ... +{sessionInfo.filesChanged.length - 12} more
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[9px] text-white/25 font-sans">No files modified.</p>
              )}
            </div>

            {/* Snapshot + refresh history */}
            <div className="flex items-center gap-2 pt-1">
              {onSnapshot && (
                <button
                  onClick={onSnapshot}
                  disabled={snapshotBusy}
                  className="flex items-center gap-1 px-3 py-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  <Camera className="w-3 h-3" />
                  {snapshotBusy ? 'Saving...' : 'Snapshot Now'}
                </button>
              )}
              {onRefreshHistory && (
                <button
                  onClick={onRefreshHistory}
                  className="flex items-center gap-1 px-2 py-1 border border-white/15 text-white/60 hover:text-white text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
                  title="Refresh history"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </button>
              )}
            </div>

            {/* History list */}
            {history.length > 0 && (
              <div className="max-h-24 overflow-y-auto custom-scrollbar divide-y divide-white/5 border border-white/10">
                {history.map((h) => (
                  <div key={h.name} className="flex items-center justify-between px-2 py-1 text-[9px] font-mono">
                    <span className="text-white/60 truncate max-w-[120px]" title={h.name}>
                      {h.name}
                    </span>
                    <span className="text-white/30 shrink-0">
                      {new Date(h.createdAt).toLocaleString()} · {(h.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Alias Legend / Support List */}
      <div className="bg-[#121212] rounded-none border border-white/10 overflow-hidden">
        <button
          onClick={() => setShowModelsList(!showModelsList)}
          className="w-full flex items-center justify-between p-4 text-left font-display font-black text-[10px] tracking-widest text-white uppercase hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-rose-500" />
            <span>Registered Shortcodes ({models.length})</span>
          </div>
          {showModelsList ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
        </button>

        {showModelsList && (
          <div className="p-2 border-t border-white/10 overflow-y-auto max-h-60 custom-scrollbar bg-[#0A0A0A]">
            <table className="w-full text-left text-[9px] text-white/60 font-mono">
              <thead>
                <tr className="border-b border-white/10 text-white/30 uppercase text-[8px] font-display font-black tracking-widest">
                  <th className="py-1.5 px-2">Shortcode</th>
                  <th className="py-1.5 px-2">Vendor</th>
                  <th className="py-1.5 px-2">Path ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {models.map((m) => (
                  <tr key={m.alias} className="hover:bg-white/5">
                    <td className="py-1.5 px-2 font-bold text-rose-500 uppercase">{m.alias}</td>
                    <td className="py-1.5 px-2 uppercase text-white/40">{m.vendor}</td>
                    <td className="py-1.5 px-2 truncate max-w-[110px]" title={m.model}>
                      {m.model}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Guide */}
      <div className="p-4 bg-[#121212] border border-white/10 rounded-none space-y-2.5">
        <div className="flex items-center gap-2 text-[10px] font-display font-black text-white uppercase tracking-wider">
          <HelpCircle className="w-4 h-4 text-rose-500" />
          <span>Operational Directives</span>
        </div>
        <div className="text-[10px] space-y-2 text-white/40 font-sans leading-relaxed">
          <p>
            1. **Select Pipeline**: Pick from Google Gemini, OpenAI GPT, Anthropic Claude, or DeepSeek from the top terminal navbar.
          </p>
          <p>
            2. **Submit Directives**: Query the agent to outline structures, write files, audit scripts, or debug workspace issues.
          </p>
          <p>
            3. **Authorize Hooks**: When the LLM generates bash scripts, use the secure terminal to edit, run, or skip tasks sequentially.
          </p>
        </div>
      </div>

      {/* Footer credits */}
      <div className="pt-2 text-center text-[8px] text-white/20 font-mono uppercase tracking-widest">
        <p>Tell-ai GPL-3.0 License</p>
        <p>Author: it is not savio</p>
      </div>
    </div>
  );
}
