import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { FRAMES } from '../constants.js';
import { sortedStudents, studentNameMap, toCSV, downloadCSV, formatDate, frameLabel, schoolYearLabel } from '../utils.js';
import { ObservationCard, YearSelect, EmptyState } from './shared.jsx';

export function ObservationsView({ classroom, observations, obsLoading, active, canEdit, yearStart, setYearStart, onDelete, onOpenPortfolio }) {
  const students = sortedStudents(classroom);
  const names = studentNameMap(classroom);
  const [studentId, setStudentId] = useState('all');
  const [frame, setFrame] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return observations.filter(
      (o) =>
        (studentId === 'all' || o.studentIds.includes(studentId)) &&
        (frame === 'all' || o.frame === frame) &&
        (!q || o.note?.toLowerCase().includes(q) || o.expectations?.some((e) => e.toLowerCase().includes(q)))
    );
  }, [observations, studentId, frame, search]);

  const exportCSV = () => {
    const rows = [['Date', 'Students', 'Frame', 'Expectations', 'Note', 'Has photo', 'Recorded by']];
    filtered.forEach((o) => {
      rows.push([
        formatDate(o.createdAt, { year: 'numeric', month: '2-digit', day: '2-digit' }),
        o.studentIds.map((id) => names[id] || 'Removed student').join('; '),
        frameLabel(o.frame),
        (o.expectations || []).join('; '),
        o.note || '',
        o.photoId ? 'Yes' : 'No',
        o.createdByName || '',
      ]);
    });
    downloadCSV(`${classroom.className}_observations_${schoolYearLabel(new Date(yearStart))}.csv`.replace(/\s+/g, '_'), toCSV(rows));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-5">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)} aria-label="Student" className="px-3 py-1.5 border border-stone-300 rounded-lg text-sm bg-white">
          <option value="all">All students</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select value={frame} onChange={(e) => setFrame(e.target.value)} aria-label="Frame" className="px-3 py-1.5 border border-stone-300 rounded-lg text-sm bg-white">
          <option value="all">All frames</option>
          {FRAMES.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
        <YearSelect yearStart={yearStart} setYearStart={setYearStart} />
        <label className="relative flex-1 min-w-[10rem]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes"
            aria-label="Search notes"
            className="w-full pl-8 pr-3 py-1.5 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </label>
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="flex items-center gap-1 text-sm px-3 py-1.5 border border-brand-700 text-brand-700 rounded-lg hover:bg-brand-50 disabled:opacity-40"
        >
          <Download size={14} /> Export
        </button>
      </div>

      <p className="text-sm text-stone-500 mb-3">
        {filtered.length} observation{filtered.length === 1 ? '' : 's'}
      </p>

      {obsLoading && observations.length === 0 ? (
        <EmptyState>Loading observations…</EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState>{observations.length === 0 ? 'No observations yet this school year.' : 'Nothing matches these filters.'}</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-start">
          {filtered.map((o) => (
            <ObservationCard key={o.id} obs={o} names={names} active={active} canEdit={canEdit} onDelete={onDelete} onOpenPortfolio={onOpenPortfolio} />
          ))}
        </div>
      )}
    </div>
  );
}
