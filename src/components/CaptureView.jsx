import { useState, useRef } from 'react';
import { Camera, X, Loader2, Users } from 'lucide-react';
import { FRAMES, FRAME_BY_KEY } from '../constants.js';
import { sortedStudents } from '../utils.js';
import { newObservationId, addObservation } from '../lib/observations.js';
import { compressImage, uploadPhoto, photosEnabled } from '../lib/photos.js';
import { Chip, EmptyState } from './shared.jsx';

function Step({ n, title, children, right }) {
  return (
    <section className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-stone-800 flex items-center gap-2">
          <span className="bg-brand-100 text-brand-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">{n}</span>
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function CaptureView({ classroom, user, active, online, showToast, onGoToRoster }) {
  const students = sortedStudents(classroom);
  const fileRef = useRef(null);

  const [photo, setPhoto] = useState(null); // JPEG data URL
  const [selected, setSelected] = useState(() => new Set());
  const [frame, setFrame] = useState('');
  const [expectations, setExpectations] = useState(() => new Set());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');

  const toggle = (set, setter, value) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPhoto(await compressImage(file));
      setPhotoError('');
    } catch (err) {
      showToast(err.message);
    }
  };

  const reset = () => {
    setPhoto(null);
    setSelected(new Set());
    setFrame('');
    setExpectations(new Set());
    setNote('');
    setPhotoError('');
  };

  const save = async ({ skipPhoto = false } = {}) => {
    const studentIds = students.filter((s) => selected.has(s.id)).map((s) => s.id); // ignores anyone removed meanwhile
    if (studentIds.length === 0) return showToast('Select at least one student.');
    if (!note.trim() && !photo) return showToast('Add a note or a photo.');

    setBusy(true);
    setPhotoError('');
    let photoId = null;
    if (photo && !skipPhoto) {
      try {
        photoId = await uploadPhoto(active.ownerId, active.classId, photo);
      } catch (err) {
        setBusy(false);
        setPhotoError(online ? err.message : "You're offline, so the photo can't be uploaded yet.");
        return;
      }
    }

    const data = {
      studentIds,
      frame,
      expectations: [...expectations],
      note: note.trim(),
      photoId,
      createdAt: Date.now(),
      createdBy: user.uid,
      createdByName: user.displayName || user.email || '',
    };
    const id = newObservationId(active.ownerId, active.classId);
    // Saved on the device instantly; Firestore syncs it in the background.
    addObservation(active.ownerId, active.classId, id, data).catch((err) => {
      console.error('Observation save failed', err);
      showToast("An observation couldn't be saved — check your access to this class.", 5000);
    });
    showToast(online ? '✅ Observation saved' : '✅ Saved on this device — it will sync when you reconnect', 3500);
    reset();
    setBusy(false);
  };

  if (students.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-5">
        <EmptyState>
          <Users size={28} className="mx-auto mb-2" />
          <p className="mb-3">Add your students before capturing observations.</p>
          <button onClick={onGoToRoster} className="bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
            Go to Roster
          </button>
        </EmptyState>
      </div>
    );
  }

  const frameMeta = FRAME_BY_KEY[frame];

  return (
    <div className="max-w-xl mx-auto px-4 py-5 space-y-4 pb-24">
      {photosEnabled && (
        <Step n={1} title="Capture learning">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickPhoto} />
          {photo ? (
            <div className="relative">
              <img src={photo} alt="Preview" className="w-full rounded-xl shadow-sm" />
              <div className="absolute top-2 right-2 flex gap-2">
                <button onClick={() => fileRef.current?.click()} className="bg-white/90 text-stone-700 text-xs font-semibold px-3 py-1.5 rounded-lg shadow">
                  Retake
                </button>
                <button onClick={() => setPhoto(null)} className="bg-white/90 text-stone-700 p-1.5 rounded-lg shadow" aria-label="Remove photo">
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-stone-300 rounded-xl py-8 bg-stone-50 hover:bg-stone-100 flex flex-col items-center gap-2 text-brand-700 font-semibold"
            >
              <Camera size={32} />
              Tap to take a photo <span className="text-xs font-normal text-stone-400">(optional)</span>
            </button>
          )}
          {!online && photo && <p className="text-xs text-gold-700">You're offline — photos need a connection to upload.</p>}
        </Step>
      )}

      <Step
        n={photosEnabled ? 2 : 1}
        title="Students"
        right={
          <span className="text-xs text-stone-500">
            {selected.size} selected
            {selected.size > 0 && (
              <>
                {' · '}
                <button onClick={() => setSelected(new Set())} className="text-brand-700 font-semibold">
                  Clear
                </button>
              </>
            )}
          </span>
        }
      >
        <div className="flex flex-wrap gap-2">
          {students.map((s) => (
            <Chip key={s.id} selected={selected.has(s.id)} onClick={() => toggle(selected, setSelected, s.id)}>
              {s.name}
            </Chip>
          ))}
        </div>
      </Step>

      <Step n={photosEnabled ? 3 : 2} title="Curriculum alignment">
        <div className="grid grid-cols-2 gap-2">
          {FRAMES.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setFrame(frame === f.key ? '' : f.key);
                setExpectations(new Set());
              }}
              aria-pressed={frame === f.key}
              className={
                'text-left text-xs sm:text-sm font-semibold p-3 rounded-xl border flex items-start gap-2 ' +
                (frame === f.key ? 'border-brand-700 bg-brand-50 text-brand-900 ring-2 ring-brand-600' : 'border-stone-200 bg-stone-50 text-stone-700')
              }
            >
              <span className={'w-2.5 h-2.5 rounded-full mt-1 shrink-0 ' + f.dot} />
              {f.label}
            </button>
          ))}
        </div>
        {frameMeta && (
          <div className="flex flex-col gap-2 pt-1">
            <p className="text-xs font-semibold text-stone-500">Expectations (optional)</p>
            {frameMeta.expectations.map((exp) => (
              <Chip key={exp} selected={expectations.has(exp)} onClick={() => toggle(expectations, setExpectations, exp)} className="text-left rounded-lg text-xs">
                {exp}
              </Chip>
            ))}
          </div>
        )}
      </Step>

      <Step n={photosEnabled ? 4 : 3} title="Observation note">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="What did you observe? What did they say or do?"
          aria-label="Observation note"
          className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </Step>

      {photoError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl p-3 space-y-2" role="alert">
          <p>
            <strong>Photo not uploaded:</strong> {photoError}
          </p>
          <div className="flex gap-2">
            <button onClick={() => save()} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-600 text-white">
              Try again
            </button>
            <button onClick={() => save({ skipPhoto: true })} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-rose-300 text-rose-700">
              Save without photo
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => save()}
        disabled={busy}
        className="w-full bg-brand-700 hover:bg-brand-800 text-white font-bold py-4 rounded-xl shadow-lg active:scale-[0.99] disabled:bg-stone-400 flex items-center justify-center gap-2"
      >
        {busy ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Uploading photo…
          </>
        ) : (
          'Save observation'
        )}
      </button>
    </div>
  );
}
