import { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { FRAMES } from '../constants.js';
import { sortedStudents, studentNameMap, formatDate, schoolYearLabel } from '../utils.js';
import { FrameBadge, Photo, YearSelect, EmptyState } from './shared.jsx';
import { photosEnabled } from '../lib/photos.js';

// A printable, parent-friendly record of one child's observations for the year.
export function PortfolioView({ classroom, observations, active, yearStart, setYearStart, studentId, setStudentId }) {
  const students = sortedStudents(classroom);
  const names = studentNameMap(classroom);
  const student = students.find((s) => s.id === studentId) || students[0];

  const entries = useMemo(
    () => (student ? observations.filter((o) => o.studentIds.includes(student.id)).sort((a, b) => a.createdAt - b.createdAt) : []),
    [observations, student]
  );

  const photoCount = entries.filter((o) => o.photoId).length;
  const [loaded, setLoaded] = useState(0);
  useEffect(() => setLoaded(0), [student?.id, yearStart]);
  const photosReady = !photosEnabled || loaded >= photoCount;

  if (!student) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-5">
        <EmptyState>Add students in the Roster tab first.</EmptyState>
      </div>
    );
  }

  const frameCounts = FRAMES.map((f) => ({ ...f, n: entries.filter((o) => o.frame === f.key).length }));

  return (
    <div className="max-w-4xl mx-auto px-4 py-5">
      <div className="no-print flex flex-wrap items-center gap-2 mb-4">
        <select
          value={student.id}
          onChange={(e) => setStudentId(e.target.value)}
          aria-label="Student"
          className="px-3 py-1.5 border border-stone-300 rounded-lg text-sm bg-white"
        >
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <YearSelect yearStart={yearStart} setYearStart={setYearStart} />
        <span className="ml-auto text-xs text-stone-500">{photosReady ? '' : `Loading photos ${loaded}/${photoCount}…`}</span>
        <button
          onClick={() => window.print()}
          disabled={!photosReady}
          title={photosReady ? 'Print or save as PDF' : 'Wait for photos to finish loading'}
          className="flex items-center gap-1 text-sm px-3 py-1.5 bg-brand-700 text-white rounded-lg hover:bg-brand-800 disabled:opacity-50"
        >
          <Printer size={14} /> Print
        </button>
      </div>

      <div className="print-plain bg-white rounded-2xl border border-stone-200 shadow-sm p-6 sm:p-10">
        <div className="flex flex-wrap justify-between items-end gap-4 border-b-4 border-brand-700 pb-6 mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">{student.name}</h1>
            <p className="text-brand-700 font-semibold uppercase tracking-widest text-xs mt-1">Learning Portfolio</p>
          </div>
          <div className="text-right text-sm">
            <p className="text-stone-500">{classroom.className}</p>
            <p className="font-semibold text-stone-800">{schoolYearLabel(new Date(yearStart))}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
            <p className="text-[10px] font-bold text-stone-400 uppercase">Observations</p>
            <p className="text-2xl font-extrabold text-stone-800">{entries.length}</p>
          </div>
          {frameCounts.map((f) => (
            <div key={f.key} className="bg-stone-50 border border-stone-200 rounded-xl p-3">
              <p className="text-[10px] font-bold text-stone-400 uppercase flex items-center gap-1">
                <span className={'w-2 h-2 rounded-full ' + f.dot} />
                {f.short}
              </p>
              <p className="text-2xl font-extrabold text-stone-800">{f.n}</p>
            </div>
          ))}
        </div>

        {entries.length === 0 ? (
          <EmptyState>No observations for {student.name} in this school year yet.</EmptyState>
        ) : (
          <div className="space-y-8">
            {entries.map((o) => {
              const others = o.studentIds.filter((id) => id !== student.id && names[id]).map((id) => names[id]);
              return (
                <div key={o.id} className="border-l-4 border-stone-200 pl-5 break-inside-avoid">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span className="text-sm font-bold text-brand-700 uppercase tracking-wide">{formatDate(o.createdAt, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    <FrameBadge frame={o.frame} size="lg" />
                  </div>
                  {o.expectations?.length > 0 && <h3 className="text-lg font-bold text-stone-800 leading-snug mb-1">{o.expectations.join(' · ')}</h3>}
                  {o.note && <p className="text-stone-700 leading-relaxed whitespace-pre-wrap mb-3">{o.note}</p>}
                  {others.length > 0 && <p className="text-xs text-stone-400 mb-3">With {others.join(', ')}</p>}
                  {o.photoId && (
                    <Photo
                      ownerId={active.ownerId}
                      classId={active.classId}
                      photoId={o.photoId}
                      eager
                      onLoaded={() => setLoaded((n) => n + 1)}
                      className="rounded-2xl max-w-lg aspect-[4/3]"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-12 pt-6 border-t border-stone-100 text-center text-[10px] font-semibold text-stone-400 uppercase tracking-widest">
          Confidential educational documentation · Generated {new Date().toLocaleDateString()} with K-Doc
        </p>
      </div>
    </div>
  );
}
