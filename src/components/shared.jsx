import { useEffect, useRef, useState } from 'react';
import { Trash2, CloudOff, ImageOff } from 'lucide-react';
import { FRAME_BY_KEY } from '../constants.js';
import { loadPhoto, photosEnabled } from '../lib/photos.js';
import { formatDate } from '../utils.js';

export function Chip({ selected, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        'px-3.5 py-2 rounded-full text-sm font-medium border transition-colors active:scale-95 ' +
        (selected ? 'bg-brand-700 text-white border-brand-800' : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100') +
        ' ' +
        className
      }
    >
      {children}
    </button>
  );
}

export function FrameBadge({ frame, size = 'sm' }) {
  const f = FRAME_BY_KEY[frame];
  if (!f) return null;
  return (
    <span className={'inline-block border rounded font-semibold uppercase tracking-wide ' + f.color + (size === 'sm' ? ' text-[10px] px-1.5 py-0.5' : ' text-xs px-2 py-1')}>
      {size === 'sm' ? f.short : f.label}
    </span>
  );
}

// Loads a Drive photo through the photo service. Lazy by default: it waits
// until the card scrolls near the screen. `eager` loads right away (used on
// the portfolio so printing includes every photo).
export function Photo({ ownerId, classId, photoId, eager = false, className = '', onLoaded }) {
  const ref = useRef(null);
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(eager);

  useEffect(() => {
    if (eager || visible || !ref.current) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '400px' }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [eager, visible]);

  useEffect(() => {
    if (!visible || !photoId || !photosEnabled) return undefined;
    let cancelled = false;
    setFailed(false);
    loadPhoto(ownerId, classId, photoId)
      .then((s) => !cancelled && setSrc(s))
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && onLoaded?.());
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ownerId, classId, photoId]);

  if (!photoId) return null;

  return (
    <div ref={ref} className={'relative overflow-hidden bg-stone-100 ' + className}>
      {src ? (
        <img src={src} alt="Observation photo" className="w-full h-full object-cover" />
      ) : failed || !photosEnabled ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-400 text-xs gap-1">
          <ImageOff size={18} /> Photo unavailable
        </div>
      ) : (
        <div className="absolute inset-0 animate-pulse bg-stone-200" />
      )}
    </div>
  );
}

export function ObservationCard({ obs, names, active, canEdit, onDelete, onOpenPortfolio }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <article className="bg-white rounded-xl border border-stone-200 shadow-sm flex flex-col overflow-hidden break-inside-avoid">
      {obs.photoId && <Photo ownerId={active.ownerId} classId={active.classId} photoId={obs.photoId} className="h-52 w-full" />}
      <div className="p-4 flex flex-col gap-2 flex-grow">
        <div className="flex items-center justify-between gap-2">
          <FrameBadge frame={obs.frame} />
          <span className="text-[11px] font-medium text-stone-400 whitespace-nowrap flex items-center gap-1">
            {obs.pending && (
              <span title="Saved on this device — waiting to sync" className="text-gold-700">
                <CloudOff size={12} />
              </span>
            )}
            {formatDate(obs.createdAt)}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {obs.studentIds.map((id) => (
            <button
              key={id}
              onClick={() => onOpenPortfolio?.(id)}
              disabled={!names[id]}
              className="text-xs font-semibold text-brand-800 bg-brand-50 border border-brand-100 rounded-full px-2 py-0.5 hover:bg-brand-100 disabled:text-stone-400 disabled:bg-stone-50 disabled:border-stone-200"
            >
              {names[id] || 'Removed student'}
            </button>
          ))}
        </div>
        {obs.expectations?.length > 0 && <p className="text-xs font-semibold text-stone-600">{obs.expectations.join(' · ')}</p>}
        {obs.note && <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{obs.note}</p>}
        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-stone-400 truncate">{obs.createdByName ? `By ${obs.createdByName}` : ''}</span>
          {canEdit &&
            (confirming ? (
              <span className="flex items-center gap-1">
                <button onClick={() => onDelete(obs)} className="text-xs px-2 py-1 rounded bg-rose-500 text-white">
                  Delete
                </button>
                <button onClick={() => setConfirming(false)} className="text-xs px-2 py-1 rounded bg-stone-200 text-stone-600">
                  Cancel
                </button>
              </span>
            ) : (
              <button onClick={() => setConfirming(true)} className="text-stone-300 hover:text-rose-500" aria-label="Delete observation">
                <Trash2 size={15} />
              </button>
            ))}
        </div>
      </div>
    </article>
  );
}

export function YearSelect({ yearStart, setYearStart }) {
  const current = new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  const years = [current, current - 1, current - 2];
  return (
    <select
      value={new Date(yearStart).getFullYear()}
      onChange={(e) => setYearStart(new Date(Number(e.target.value), 8, 1).getTime())}
      aria-label="School year"
      className="px-3 py-1.5 border border-stone-300 rounded-lg text-sm bg-white"
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {y} - {y + 1}
        </option>
      ))}
    </select>
  );
}

export function EmptyState({ children }) {
  return <div className="text-center py-12 text-stone-400 border border-dashed border-stone-300 rounded-xl text-sm px-4">{children}</div>;
}
