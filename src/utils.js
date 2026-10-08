import { FRAME_BY_KEY } from './constants.js';

export function csvEscape(val) {
  const s = String(val ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCSV(rows) {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

export function downloadCSV(filename, csvContent) {
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function sortedStudents(classroom) {
  return [...(classroom?.students || [])].sort((a, b) => a.name.localeCompare(b.name));
}

export function studentNameMap(classroom) {
  return Object.fromEntries((classroom?.students || []).map((s) => [s.id, s.name]));
}

// School year runs September to June. Returns the Sept 1 start of the year
// containing `date`.
export function schoolYearStart(date = new Date()) {
  const y = date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1;
  return new Date(y, 8, 1);
}

export function schoolYearLabel(start) {
  const y = start.getFullYear();
  return `${y} - ${y + 1}`;
}

export function formatDate(ms, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return ms ? new Date(ms).toLocaleDateString(undefined, opts) : '';
}

export function daysSince(ms) {
  if (!ms) return null;
  return Math.floor((Date.now() - ms) / 86400000);
}

export function frameLabel(key) {
  return FRAME_BY_KEY[key]?.label || key || '';
}
