import { useEffect, useState } from 'react';

/**
 * Animated ASCII logo cycling through the 4 variants documented in `tell.md`
 * (TELL AI / SDK / CLI / WEB). Pure presentational — no network, no secrets.
 */

const FRAMES: Array<{ label: string; art: string }> = [
  {
    label: 'TELL AI',
    art: [
      '████████╗███████╗██╗     ██╗        █████╗ ██╗',
      '╚══██╔══╝██╔════╝██║     ██║       ██╔══██╗██║',
      '   ██║   █████╗  ██║     ██║       ███████║██║',
      '   ██║   ██╔══╝  ██║     ██║       ██╔══██║██║',
      '   ██║   ███████╗███████╗███████╗  ██║  ██║██║',
    ].join('\n'),
  },
  {
    label: 'TELL SDK',
    art: [
      '████████╗███████╗██╗     ██╗       ███████╗██████╗ ██╗  ██╗',
      '╚══██╔══╝██╔════╝██║     ██║       ██╔════╝██╔══██╗██║ ██╔╝',
      '   ██║   █████╗  ██║     ██║       ███████╗██║  ██║█████╔╝ ',
      '   ██║   ██╔══╝  ██║     ██║       ╚════██║██║  ██║██╔═██╗ ',
      '   ██║   ███████╗███████╗███████╗  ███████║██████╔╝██║  ██╗',
    ].join('\n'),
  },
  {
    label: 'TELL CLI',
    art: [
      '████████╗███████╗██╗     ██╗        ██████╗██╗     ██╗',
      '╚══██╔══╝██╔════╝██║     ██║       ██╔════╝██║     ██║',
      '   ██║   █████╗  ██║     ██║       ██║     ██║     ██║',
      '   ██║   ██╔══╝  ██║     ██║       ██║     ██║     ██║',
      '   ██║   ███████╗███████╗███████╗  ╚██████╗███████╗██║',
    ].join('\n'),
  },
  {
    label: 'TELL WEB',
    art: [
      '████████╗███████╗██╗     ██╗       ██╗    ██╗███████╗██████╗ ',
      '╚══██╔══╝██╔════╝██║     ██║       ██║    ██║██╔════╝██╔══██╗',
      '   ██║   █████╗  ██║     ██║       ██║ █╗ ██║█████╗  ██████╔╝',
      '   ██║   ██╔══╝  ██║     ██║       ██║███╗██║██╔══╝  ██╔══██╗',
      '   ██║   ███████╗███████╗███████╗  ╚███╔███╔╝███████╗██████╔╝',
    ].join('\n'),
  },
];

const FRAME_MS = 2000;

export default function TellLogoLoop() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % FRAMES.length), FRAME_MS);
    return () => clearInterval(id);
  }, []);

  const frame = FRAMES[index] ?? FRAMES[0]!;

  return (
    <div className="select-none" aria-label="Tell logo">
      <pre
        aria-hidden="true"
        className="font-mono text-[8px] sm:text-[10px] leading-tight text-(--color-accent-text) whitespace-pre overflow-x-auto"
      >
        {frame.art}
        <span className="animate-pulse">█</span>
      </pre>
      <div className="mt-2 flex items-center justify-center gap-1.5" aria-hidden="true">
        {FRAMES.map((f, i) => (
          <span
            key={f.label}
            className={`h-1 w-6 transition-colors ${i === index ? 'bg-(--color-accent)' : 'bg-white/10'}`}
          />
        ))}
      </div>
      <p className="sr-only">{frame.label}</p>
    </div>
  );
}
