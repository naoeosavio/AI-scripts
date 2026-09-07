import { useState } from 'react';
import { Key, Settings, Info, FileText, ChevronDown, ChevronUp, Camera, History, Wrench, RefreshCw, Palette, Sun, Moon, Type, Check, PanelLeft, PanelRight, PanelBottom, Maximize2, EyeOff, Focus, RotateCcw, Download, Trash2 } from 'lucide-react';
import { useTheme, AccentPalette, FontChoice, ScaleLevel, LayoutMode } from '../theme.tsx';
import { apiFetch } from '../api.ts';

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
  keysStatus: Record<string, boolean>;
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
  onRestoreSnapshot?: (name: string) => void;
  onDeleteSnapshot?: (name: string) => void;
}

// Vendor key → display label (drives the credentials grid from keysStatus)
const VENDOR_LABELS: Record<string, string> = {
  google: 'Gemini API',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  xai: 'xAI',
  deepseek: 'DeepSeek',
  fireworks: 'Fireworks',
  cerebras: 'Cerebras',
  moonshotai: 'Moonshot AI',
  openrouter: 'OpenRouter',
};

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR');
}

const ACCENT_OPTIONS: { id: AccentPalette; label: string; color: string }[] = [
  { id: 'rose',    label: 'Rose',    color: '#E11D48' },
  { id: 'blue',    label: 'Blue',    color: '#2563EB' },
  { id: 'emerald', label: 'Emerald', color: '#059669' },
  { id: 'amber',   label: 'Amber',   color: '#D97706' },
  { id: 'violet',  label: 'Violet',  color: '#7C3AED' },
  { id: 'cyan',    label: 'Cyan',    color: '#0891B2' },
];

const FONT_OPTIONS: FontChoice[] = ['Inter', 'Space Grotesk', 'JetBrains Mono', 'Custom'];
const SCALE_OPTIONS: { label: string; value: ScaleLevel }[] = [
  { label: '0.85', value: 0.85 },
  { label: '0.92', value: 0.92 },
  { label: '1.0',  value: 1.0 },
  { label: '1.08', value: 1.08 },
  { label: '1.15', value: 1.15 },
];
const LAYOUT_OPTIONS: { id: LayoutMode; label: string; desc: string }[] = [
  { id: 'default', label: 'Classic', desc: 'Explorer left · bottom terminal' },
  { id: 'focused', label: 'Focused', desc: 'Explorer right · fullscreen terminal · chat maximized' },
  { id: 'custom', label: 'Custom', desc: 'You decide: sidebar side · terminal placement' },
];

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
  onRestoreSnapshot,
  onDeleteSnapshot,
}: SettingsPanelProps) {
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [showModelsList, setShowModelsList] = useState(false);
  const [showSession, setShowSession] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);

  const { config, setMode, setAccent, setFontSans, setFontDisplay, setFontMono, setScale, setLayout, setCustomSidebarSide, setCustomTerminal, setCustomFont, resetTheme } = useTheme();

  const downloadSnapshot = async (name: string) => {
    try {
      const res = await apiFetch(`/api/session/history/${encodeURIComponent(name)}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex flex-col h-full bg-(--color-bg-primary) overflow-y-auto custom-scrollbar p-5 space-y-5 text-(--color-text-secondary) select-none">
      {/* Title */}
      <div className="flex items-center gap-2 pb-3 border-b border-(--color-border-subtle)">
        <Settings className="w-4 h-4 text-(--color-accent) animate-pulse" />
        <h2 className="text-[10px] font-display font-black uppercase tracking-[0.25em] text-(--color-text-primary)">Settings & Directives</h2>
      </div>

      {/* Appearance & Theme Customizer */}
      <div className="bg-(--color-bg-secondary) rounded-none border border-(--color-border-subtle)">
        <button
          onClick={() => setShowAppearance(!showAppearance)}
          className="w-full flex items-center justify-between p-4 text-left font-display font-black text-[10px] tracking-widest text-(--color-text-primary) uppercase hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Palette className="w-3.5 h-3.5 text-(--color-accent)" />
            <span>Appearance & Theme</span>
          </div>
          {showAppearance ? <ChevronUp className="w-4 h-4 text-(--color-text-muted)" /> : <ChevronDown className="w-4 h-4 text-(--color-text-muted)" />}
        </button>

        {showAppearance && (
          <div className="p-4 border-t border-(--color-border-subtle) space-y-4">
            {/* Mode toggle */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-(--color-text-primary) font-bold flex items-center gap-1.5">
                <Type className="w-3 h-3 text-(--color-accent)" />
                Mode
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setMode('dark')}
                  className={`flex items-center gap-1 px-3 py-1 text-[9px] font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
                    config.mode === 'dark'
                      ? 'bg-(--color-accent) border-(--color-accent) text-white'
                      : 'bg-(--color-bg-primary) border-(--color-border-medium) text-(--color-text-muted) hover:text-(--color-text-primary)'
                  }`}
                >
                  <Moon className="w-3 h-3" /> Dark
                </button>
                <button
                  onClick={() => setMode('light')}
                  className={`flex items-center gap-1 px-3 py-1 text-[9px] font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
                    config.mode === 'light'
                      ? 'bg-(--color-accent) border-(--color-accent) text-white'
                      : 'bg-(--color-bg-primary) border-(--color-border-medium) text-(--color-text-muted) hover:text-(--color-text-primary)'
                  }`}
                >
                  <Sun className="w-3 h-3" /> Light
                </button>
              </div>
            </div>

            {/* Accent color */}
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-(--color-text-primary) font-bold mb-1.5">Accent Color</span>
              <div className="flex items-center gap-2">
                {ACCENT_OPTIONS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAccent(a.id)}
                    title={a.label}
                    className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer flex items-center justify-center"
                    style={{ backgroundColor: a.color, borderColor: config.accent === a.id ? 'var(--color-text-primary)' : 'transparent' }}
                  >
                    {config.accent === a.id && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Font pickers */}
            <div className="space-y-2.5">
              <FontPicker
                label="UI Font"
                value={config.fontSans}
                onChange={setFontSans}
                customValue={config.customFonts.sans}
                onCustomChange={(v) => setCustomFont('sans', v)}
              />
              <FontPicker
                label="Display Font"
                value={config.fontDisplay}
                onChange={setFontDisplay}
                customValue={config.customFonts.display}
                onCustomChange={(v) => setCustomFont('display', v)}
              />
              <FontPicker
                label="Code Font"
                value={config.fontMono}
                onChange={setFontMono}
                customValue={config.customFonts.mono}
                onCustomChange={(v) => setCustomFont('mono', v)}
              />
            </div>

            {/* Scale */}
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-(--color-text-primary) font-bold mb-1.5">UI Scale</span>
              <div className="flex items-center gap-1.5">
                {SCALE_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setScale(s.value)}
                    className={`flex-1 px-2 py-1 text-[9px] font-mono border cursor-pointer transition-colors ${
                      config.scale === s.value
                        ? 'bg-(--color-accent) border-(--color-accent) text-white font-bold'
                        : 'bg-(--color-bg-primary) border-(--color-border-medium) text-(--color-text-muted) hover:text-(--color-text-primary)'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Layout */}
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-(--color-text-primary) font-bold mb-1.5">Layout</span>
              <div className="grid grid-cols-2 gap-1.5">
                {LAYOUT_OPTIONS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLayout(l.id)}
                    className={`flex flex-col items-start gap-1 px-2.5 py-2 text-left border cursor-pointer transition-colors ${
                      config.layout === l.id
                        ? 'bg-(--color-accent-subtle) border-(--color-accent) text-(--color-text-primary)'
                        : 'bg-(--color-bg-primary) border-(--color-border-medium) text-(--color-text-muted) hover:text-(--color-text-primary)'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider">
                      {l.id === 'default' ? <PanelLeft className="w-3 h-3" /> : <Focus className="w-3 h-3" />}
                      {l.label}
                    </span>
                    <span className="text-[8.5px] font-sans leading-snug opacity-80">{l.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom layout controls */}
            {config.layout === 'custom' && (
              <div className="space-y-3 border border-(--color-border-subtle) bg-(--color-bg-primary) p-2.5">
                <p className="text-[8.5px] text-(--color-text-muted) font-sans leading-snug">
                  You decide everything: sidebar side, terminal placement. Sizes by drag (settings, terminal, editor) are persisted.
                </p>
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-(--color-text-muted) font-bold mb-1">Sidebar</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setCustomSidebarSide('left')}
                      className={`flex items-center justify-center gap-1.5 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
                        config.customSidebarSide === 'left'
                          ? 'bg-(--color-accent) border-(--color-accent) text-white'
                          : 'bg-(--color-bg-secondary) border-(--color-border-medium) text-(--color-text-muted) hover:text-(--color-text-primary)'
                      }`}
                    >
                      <PanelLeft className="w-3 h-3" /> Left
                    </button>
                    <button
                      onClick={() => setCustomSidebarSide('right')}
                      className={`flex items-center justify-center gap-1.5 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
                        config.customSidebarSide === 'right'
                          ? 'bg-(--color-accent) border-(--color-accent) text-white'
                          : 'bg-(--color-bg-secondary) border-(--color-border-medium) text-(--color-text-muted) hover:text-(--color-text-primary)'
                      }`}
                    >
                      <PanelRight className="w-3 h-3" /> Right
                    </button>
                  </div>
                </div>
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-(--color-text-muted) font-bold mb-1">Terminal</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => setCustomTerminal('bottom')}
                      className={`flex items-center justify-center gap-1 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
                        config.customTerminal === 'bottom'
                          ? 'bg-(--color-accent) border-(--color-accent) text-white'
                          : 'bg-(--color-bg-secondary) border-(--color-border-medium) text-(--color-text-muted) hover:text-(--color-text-primary)'
                      }`}
                    >
                      <PanelBottom className="w-3 h-3" /> Bottom
                    </button>
                    <button
                      onClick={() => setCustomTerminal('fullscreen')}
                      className={`flex items-center justify-center gap-1 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
                        config.customTerminal === 'fullscreen'
                          ? 'bg-(--color-accent) border-(--color-accent) text-white'
                          : 'bg-(--color-bg-secondary) border-(--color-border-medium) text-(--color-text-muted) hover:text-(--color-text-primary)'
                      }`}
                    >
                      <Maximize2 className="w-3 h-3" /> Full
                    </button>
                    <button
                      onClick={() => setCustomTerminal('hidden')}
                      className={`flex items-center justify-center gap-1 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
                        config.customTerminal === 'hidden'
                          ? 'bg-(--color-accent) border-(--color-accent) text-white'
                          : 'bg-(--color-bg-secondary) border-(--color-border-medium) text-(--color-text-muted) hover:text-(--color-text-primary)'
                      }`}
                    >
                      <EyeOff className="w-3 h-3" /> Hidden
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Reset */}
            <div className="flex justify-end pt-1">
              <button
                onClick={resetTheme}
                className="px-3 py-1 bg-(--color-bg-primary) hover:bg-(--color-accent) hover:text-white border border-(--color-border-medium) text-(--color-text-muted) rounded-none text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-colors font-display"
              >
                Reset Theme
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Model Keys Status */}
      <div className="bg-(--color-bg-secondary) p-4 rounded-none border border-(--color-border-subtle) space-y-3.5">
        <div className="flex items-center gap-2 font-display font-black text-[10px] tracking-widest text-(--color-text-primary) uppercase">
          <Key className="w-3.5 h-3.5 text-(--color-accent)" />
          <span>Vendor Credentials</span>
        </div>

        <p className="text-[10px] text-(--color-text-muted) leading-relaxed font-sans">
          To activate auxiliary APIs, set the provider keys in your local{' '}
          <span className="text-(--color-text-secondary) font-mono">.env</span> file (e.g.{' '}
          <span className="text-(--color-text-secondary) font-mono">OPENAI_API_KEY=...</span>) and restart the server.
        </p>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          {Object.entries(keysStatus).map(([vendor, active]) => (
            <div
              key={vendor}
              className="flex items-center justify-between p-2.5 rounded-none bg-(--color-bg-primary) border border-(--color-border-subtle) font-mono"
            >
              <span className="font-bold uppercase tracking-wider text-(--color-text-secondary)">
                {VENDOR_LABELS[vendor] || vendor}
              </span>
              {active ? (
                <span className="flex items-center gap-1 text-(--color-accent) font-bold text-[9px] uppercase tracking-wider">
                  Active
                </span>
              ) : (
                <span className="flex items-center gap-1 text-(--color-text-muted) text-[9px] uppercase tracking-wider">
                  Missing
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* System Prompt Customizer */}
      <div className="bg-(--color-bg-secondary) rounded-none border border-(--color-border-subtle)">
        <button
          onClick={() => setShowPromptEditor(!showPromptEditor)}
          className="w-full flex items-center justify-between p-4 text-left font-display font-black text-[10px] tracking-widest text-(--color-text-primary) uppercase hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-(--color-accent)" />
            <span>Agent System Guidelines</span>
          </div>
          {showPromptEditor ? <ChevronUp className="w-4 h-4 text-(--color-text-muted)" /> : <ChevronDown className="w-4 h-4 text-(--color-text-muted)" />}
        </button>

        {showPromptEditor && (
          <div className="p-4 border-t border-(--color-border-subtle) space-y-3">
            <p className="text-[10px] text-(--color-text-muted) leading-relaxed font-sans">
              Override instruction weights to refine formatting syntax, command auto-execution variables, or strict error responses.
            </p>
            <textarea
              value={systemPrompt}
              onChange={(e) => onSystemPromptChange(e.target.value)}
              className="w-full h-48 p-3 bg-(--color-bg-primary) text-(--color-text-primary) font-mono text-[10px] rounded-none focus:outline-none focus:border-(--color-text-primary) resize-y leading-relaxed select-text border border-(--color-border-subtle)"
            />
            <div className="flex justify-end pt-1">
              <button
                onClick={onResetSystemPrompt}
                className="px-3 py-1 bg-(--color-text-primary) hover:bg-(--color-accent) text-(--color-bg-primary) hover:text-white rounded-none text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-colors font-display"
              >
                Reset Default
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Session & History */}
      <div className="bg-(--color-bg-secondary) rounded-none border border-(--color-border-subtle)">
        <button
          onClick={() => setShowSession(!showSession)}
          className="w-full flex items-center justify-between p-4 text-left font-display font-black text-[10px] tracking-widest text-(--color-text-primary) uppercase hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-(--color-accent)" />
            <span>Session & History (.tell)</span>
          </div>
          {showSession ? <ChevronUp className="w-4 h-4 text-(--color-text-muted)" /> : <ChevronDown className="w-4 h-4 text-(--color-text-muted)" />}
        </button>

        {showSession && (
          <div className="p-4 border-t border-(--color-border-subtle) space-y-3">
            <p className="text-[10px] text-(--color-text-muted) leading-relaxed font-sans">
              Session is auto-saved to <span className="text-(--color-text-secondary) font-mono">.tell/session.json</span>.
              Snapshots go to <span className="text-(--color-text-secondary) font-mono">.tell/history/</span> with a
              <span className="text-(--color-text-secondary) font-mono"> latest</span> symlink.
            </p>

            {/* Stats */}
            {sessionInfo?.stats && (
              <div className="grid grid-cols-3 gap-2 text-[9px] font-mono">
                <div className="p-2 bg-(--color-bg-primary) border border-(--color-border-subtle)">
                  <span className="block text-(--color-text-muted) uppercase tracking-wider">Cmds</span>
                  <strong className="text-(--color-text-primary)">{sessionInfo.stats.commandsRun ?? 0}</strong>
                </div>
                <div className="p-2 bg-(--color-bg-primary) border border-(--color-border-subtle)">
                  <span className="block text-(--color-text-muted) uppercase tracking-wider">AI Turns</span>
                  <strong className="text-(--color-text-primary)">{sessionInfo.stats.aiTurns ?? 0}</strong>
                </div>
                <div className="p-2 bg-(--color-bg-primary) border border-(--color-border-subtle)">
                  <span className="block text-(--color-text-muted) uppercase tracking-wider">Snapshots</span>
                  <strong className="text-(--color-text-primary)">{sessionInfo.stats.snapshots ?? 0}</strong>
                </div>
              </div>
            )}

            {/* Keys used (provider names only, never the secrets) */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5 text-[9px] text-(--color-text-muted) uppercase tracking-widest">
                <Key className="w-2.5 h-2.5 text-(--color-accent)" />
                Keys used (providers)
              </div>
              {sessionInfo?.keysUsed?.length ? (
                <div className="flex flex-wrap gap-1">
                  {sessionInfo.keysUsed.map((k) => (
                    <span key={k} className="px-1.5 py-0.5 bg-(--color-accent-subtle) border border-(--color-accent)/30 text-(--color-accent-text) text-[9px] font-mono uppercase">
                      {k}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[9px] text-(--color-text-muted) font-sans">No AI calls yet this session.</p>
              )}
            </div>

            {/* Files changed */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5 text-[9px] text-(--color-text-muted) uppercase tracking-widest">
                <Wrench className="w-2.5 h-2.5 text-(--color-accent)" />
                Files changed ({sessionInfo?.filesChanged?.length ?? 0})
              </div>
              {sessionInfo?.filesChanged?.length ? (
                <div className="max-h-20 overflow-y-auto custom-scrollbar space-y-0.5">
                  {sessionInfo.filesChanged.slice(0, 12).map((f, i) => (
                    <div key={i} className="text-[9px] text-(--color-text-secondary) font-mono truncate" title={f}>
                      {f}
                    </div>
                  ))}
                  {sessionInfo.filesChanged.length > 12 && (
                    <div className="text-[9px] text-(--color-text-muted) font-mono">
                      ... +{sessionInfo.filesChanged.length - 12} more
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[9px] text-(--color-text-muted) font-sans">No files modified.</p>
              )}
            </div>

            {/* Snapshot + refresh history */}
            <div className="flex items-center gap-2 pt-1">
              {onSnapshot && (
                <button
                  onClick={onSnapshot}
                  disabled={snapshotBusy}
                  className="flex items-center gap-1 px-3 py-1 bg-(--color-accent) hover:bg-(--color-accent-hover) disabled:opacity-40 text-white text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  <Camera className="w-3 h-3" />
                  {snapshotBusy ? 'Saving...' : 'Snapshot Now'}
                </button>
              )}
              {onRefreshHistory && (
                <button
                  onClick={onRefreshHistory}
                  className="flex items-center gap-1 px-2 py-1 border border-(--color-border-medium) text-(--color-text-secondary) hover:text-(--color-text-primary) text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
                  title="Refresh history"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </button>
              )}
            </div>

            {/* History list */}
            {history.length > 0 && (
              <div className="max-h-32 overflow-y-auto custom-scrollbar divide-y divide-white/5 border border-(--color-border-subtle)">
                {history.map((h) => (
                  <div key={h.name} className="flex items-center gap-1 px-2 py-1 text-[9px] font-mono">
                    <span className="text-(--color-text-secondary) truncate flex-1 min-w-0" title={h.name}>
                      {h.name}
                    </span>
                    <span className="text-(--color-text-muted) shrink-0 whitespace-nowrap">
                      {formatTimestamp(h.createdAt)} · {formatBytes(h.size)}
                    </span>
                    {onRestoreSnapshot && (
                      <button
                        onClick={() => onRestoreSnapshot(h.name)}
                        className="p-0.5 text-(--color-text-muted) hover:text-(--color-accent-text) cursor-pointer shrink-0"
                        title="Restore this snapshot"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => downloadSnapshot(h.name)}
                      className="p-0.5 text-(--color-text-muted) hover:text-(--color-accent-text) cursor-pointer shrink-0"
                      title="Download snapshot"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                    {onDeleteSnapshot && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete snapshot ${h.name}?`)) onDeleteSnapshot(h.name);
                        }}
                        className="p-0.5 text-(--color-text-muted) hover:text-(--color-error) cursor-pointer shrink-0"
                        title="Delete snapshot"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Alias Legend / Support List */}
      <div className="bg-(--color-bg-secondary) rounded-none border border-(--color-border-subtle)">
        <button
          onClick={() => setShowModelsList(!showModelsList)}
          className="w-full flex items-center justify-between p-4 text-left font-display font-black text-[10px] tracking-widest text-(--color-text-primary) uppercase hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-(--color-accent)" />
            <span>Registered Shortcodes ({models.length})</span>
          </div>
          {showModelsList ? <ChevronUp className="w-4 h-4 text-(--color-text-muted)" /> : <ChevronDown className="w-4 h-4 text-(--color-text-muted)" />}
        </button>

        {showModelsList && (
          <div className="p-2 border-t border-(--color-border-subtle) overflow-y-auto max-h-60 custom-scrollbar bg-(--color-bg-primary)">
            <table className="w-full text-left text-[9px] text-(--color-text-secondary) font-mono">
              <thead>
                <tr className="border-b border-(--color-border-subtle) text-(--color-text-muted) uppercase text-[8px] font-display font-black tracking-widest">
                  <th className="py-1.5 px-2">Shortcode</th>
                  <th className="py-1.5 px-2">Vendor</th>
                  <th className="py-1.5 px-2">Path ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {models.map((m) => (
                  <tr key={m.alias} className="hover:bg-white/5">
                    <td className="py-1.5 px-2 font-bold text-(--color-accent-text) uppercase">{m.alias}</td>
                    <td className="py-1.5 px-2 uppercase text-(--color-text-muted)">{m.vendor}</td>
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
      <div className="p-4 bg-(--color-bg-secondary) border border-(--color-border-subtle) rounded-none space-y-2.5">
        <div className="flex items-center gap-2 text-[10px] font-display font-black text-(--color-text-primary) uppercase tracking-wider">
          <Info className="w-4 h-4 text-(--color-accent)" />
          <span>Operational Directives</span>
        </div>
        <div className="text-[10px] space-y-2 text-(--color-text-muted) font-sans leading-relaxed">
          <p>
            1. <strong className="text-(--color-text-secondary) font-bold">Select Pipeline</strong>: Pick from Google Gemini, OpenAI GPT, Anthropic Claude, DeepSeek, Cerebras or Moonshot from the top terminal navbar.
          </p>
          <p>
            2. <strong className="text-(--color-text-secondary) font-bold">Submit Directives</strong>: Query the agent to outline structures, write files, audit scripts, or debug workspace issues.
          </p>
          <p>
            3. <strong className="text-(--color-text-secondary) font-bold">Authorize Hooks</strong>: When the LLM generates bash scripts, use the secure terminal to edit, run, or skip tasks sequentially.
          </p>
        </div>
      </div>

      {/* Footer credits */}
      <div className="pt-2 text-center text-[8px] text-(--color-text-muted) font-mono uppercase tracking-widest">
        <p>Tell-ai GPL-3.0 License</p>
      </div>
    </div>
  );
}

function FontPicker({
  label,
  value,
  onChange,
  customValue,
  onCustomChange,
}: {
  label: string;
  value: FontChoice;
  onChange: (f: FontChoice) => void;
  customValue: string;
  onCustomChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-(--color-text-primary) font-bold">{label}</span>
        <div className="flex gap-1">
          {FONT_OPTIONS.map((f) => (
            <button
              key={f}
              onClick={() => onChange(f)}
              className={`px-2 py-1 text-[9px] border cursor-pointer transition-colors ${
                value === f
                  ? 'bg-(--color-accent) border-(--color-accent) text-white font-bold'
                  : 'bg-(--color-bg-primary) border-(--color-border-medium) text-(--color-text-muted) hover:text-(--color-text-primary)'
              }`}
            >
              {f === 'Custom' ? 'Custom' : f}
            </button>
          ))}
        </div>
      </div>
      {value === 'Custom' && (
        <input
          type="text"
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder="Font family (ex: Fira Code, monospace)"
          className="w-full bg-(--color-bg-primary) border border-(--color-border-medium) px-2 py-1 text-[9px] font-mono text-(--color-text-primary) focus:outline-none focus:border-(--color-accent)"
          spellCheck={false}
        />
      )}
    </div>
  );
}
