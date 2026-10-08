import { useMemo } from 'react';
import { Download } from 'lucide-react';
import { FRAMES, STALE_DAYS } from '../constants.js';
import { sortedStudents, daysSince, toCSV, downloadCSV, schoolYearLabel, schoolYearStart } from '../utils.js';
import { YearSelect, EmptyState } from './shared.jsx';

// Students x frames: how many observations each child has per frame this
// year, plus how long since their last one -- so nobody gets missed.
export function CoverageView({ classroom, observations, yearStart, setYearStart, onOpenPortfolio }) {
  const students = sortedStudents(classroom);
  const isCurrentYear = yearStart === schoolYearStart().getTime();

  const stats = useMemo(() => {
    const byStudent = {};
    students.forEach((s) => (byStudent[s.id] = { total: 0, last: null, frames: {} }));
    observations.forEach((o) => {
      o.studentIds.forEach((id) => {
        const st = byStudent[id];
        if (!st) return;
        st.total++;
        st.frames[o.frame] = (st.frames[o.frame] || 0) + 1;
        if (!st.last || o.createdAt > st.last) st.last = o.createdAt;
      });
    });
    return byStudent;
  }, [observations, students]);

  const due = isCurrentYear ? students.filter((s) => !stats[s.id].last || daysSince(stats[s.id].last) >= STALE_DAYS) : [];
  const max = Math.max(1, ...students.flatMap((s) => FRAMES.map((f) => stats[s.id].frames[f.key] || 0)));

  const exportCSV = () => {
    const rows = [['Student', ...FRAMES.map((f) => f.label), 'Total', 'Last observed']];
    students.forEach((s) => {
      const st = stats[s.id];
      rows.push([s.name, ...FRAMES.map((f) => st.frames[f.key] || 0), st.total, st.last ? new Date(st.last).toLocaleDateString() : 'Never']);
    });
    downloadCSV(`${classroom.className}_coverage_${schoolYearLabel(new Date(yearStart))}.csv`.replace(/\s+/g, '_'), toCSV(rows));
  };

  if (students.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-5">
        <EmptyState>Add students in the Roster tab first.</EmptyState>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-5">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <YearSelect yearStart={yearStart} setYearStart={setYearStart} />
        <button onClick={exportCSV} className="ml-auto flex items-center gap-1 text-sm px-3 py-1.5 border border-brand-700 text-brand-700 rounded-lg hover:bg-brand-50">
          <Download size={14} /> Export
        </button>
      </div>

      {isCurrentYear && (
        <div className={'rounded-xl border px-4 py-3 mb-4 text-sm ' + (due.length ? 'bg-gold-100 border-gold-300 text-gold-900' : 'bg-emerald-50 border-emerald-200 text-emerald-800')}>
          {due.length === 0 ? (
            <>Every student has been observed in the last {STALE_DAYS} days.</>
          ) : (
            <>
              <strong>
                {due.length} student{due.length === 1 ? '' : 's'}
              </strong>{' '}
              {due.length === 1 ? "hasn't" : "haven't"} been observed in {STALE_DAYS}+ days:{' '}
              {due.map((s, i) => (
                <span key={s.id}>
                  {i > 0 && ', '}
                  <button onClick={() => onOpenPortfolio(s.id)} className="underline font-medium">
                    {s.name}
                  </button>
                </span>
              ))}
            </>
          )}
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th className="text-left px-4 py-2 font-medium text-stone-600">Student</th>
              {FRAMES.map((f) => (
                <th key={f.key} className="text-center px-3 py-2 font-medium text-stone-600 whitespace-nowrap" title={f.label}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className={'w-2 h-2 rounded-full ' + f.dot} />
                    {f.short}
                  </span>
                </th>
              ))}
              <th className="text-center px-3 py-2 font-medium text-stone-600">Total</th>
              <th className="text-right px-4 py-2 font-medium text-stone-600 whitespace-nowrap">Last observed</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const st = stats[s.id];
              const d = daysSince(st.last);
              const stale = isCurrentYear && (d === null || d >= STALE_DAYS);
              return (
                <tr key={s.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-2">
                    <button onClick={() => onOpenPortfolio(s.id)} className="text-left font-medium text-stone-800 hover:text-brand-700">
                      {s.name}
                    </button>
                  </td>
                  {FRAMES.map((f) => {
                    const n = st.frames[f.key] || 0;
                    return (
                      <td key={f.key} className="px-3 py-2 text-center">
                        <span
                          className={'inline-flex w-9 h-7 items-center justify-center rounded-md text-xs font-semibold ' + (n === 0 ? 'bg-rose-50 text-rose-400 border border-rose-100' : 'text-brand-900')}
                          style={n > 0 ? { backgroundColor: `rgba(29, 78, 216, ${0.1 + 0.45 * (n / max)})` } : undefined}
                        >
                          {n}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center font-semibold text-stone-700">{st.total}</td>
                  <td className={'px-4 py-2 text-right whitespace-nowrap text-xs ' + (stale ? 'text-gold-700 font-semibold' : 'text-stone-500')}>
                    {d === null ? 'Never' : d === 0 ? 'Today' : `${d} day${d === 1 ? '' : 's'} ago`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-stone-400 mt-2">Observations without a frame count toward the total only.</p>
    </div>
  );
}
