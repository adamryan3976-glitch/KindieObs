import { useState, useEffect, useRef } from 'react';
import { Header, NavTabs } from './Header.jsx';
import { ClassModal } from './ClassModal.jsx';
import { RosterView } from './RosterView.jsx';
import { CaptureView } from './CaptureView.jsx';
import { ObservationsView } from './ObservationsView.jsx';
import { CoverageView } from './CoverageView.jsx';
import { PortfolioView } from './PortfolioView.jsx';
import { listClasses, watchClass, saveStudents, createClass as createClassDoc, deleteClass as deleteClassDoc } from '../lib/classes.js';
import { watchObservations, deleteAllObservations, deleteObservation } from '../lib/observations.js';
import { deletePhoto, deleteClassPhotos, photosEnabled } from '../lib/photos.js';
import {
  createInvite,
  listInvitesForClass,
  listMyInvites,
  cancelInvite,
  declineInvite,
  acceptInvite,
  revokeCollaborator,
  leaveClass,
} from '../lib/invites.js';
import { schoolYearStart } from '../utils.js';

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function ClassroomApp({ user, onSignOut }) {
  const [loading, setLoading] = useState(true);
  const [classIndex, setClassIndex] = useState([]); // classes this user owns
  const [sharedIndex, setSharedIndex] = useState([]); // classes shared with this user
  const [pendingInvites, setPendingInvites] = useState([]); // invitations waiting for a response
  const [active, setActive] = useState(null); // { ownerId, classId }
  const [classroom, setClassroom] = useState(null);
  const [observations, setObservations] = useState([]);
  const [obsLoading, setObsLoading] = useState(false);
  const [yearStart, setYearStart] = useState(() => schoolYearStart().getTime());
  const [view, setView] = useState('capture');
  const [showClassModal, setShowClassModal] = useState(false);
  const [portfolioStudentId, setPortfolioStudentId] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const online = useOnline();

  const lastActiveKey = `kdoc.activeClass:${user.uid}`;

  const activeRole = !classroom || !active ? null : active.ownerId === user.uid ? 'owner' : classroom.collaborators?.[user.uid]?.role || null;
  const canEdit = activeRole === 'owner' || activeRole === 'editor';

  const showToast = (msg, ms = 2500) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };

  const rememberActive = (ownerId, classId) => {
    try {
      if (ownerId && classId) localStorage.setItem(lastActiveKey, JSON.stringify({ ownerId, classId }));
      else localStorage.removeItem(lastActiveKey);
    } catch {
      // localStorage can be unavailable (e.g. private browsing)
    }
  };

  const openClass = (ownerId, classId) => {
    setActive(ownerId && classId ? { ownerId, classId } : null);
    rememberActive(ownerId, classId);
    setPortfolioStudentId(null);
  };

  // ---- Initial load: own classes, invitations, classes shared with me ----

  useEffect(() => {
    (async () => {
      setLoading(true);
      let ownClasses = [];
      let myInvites = [];
      try {
        [ownClasses, myInvites] = await Promise.all([listClasses(user.uid), listMyInvites(user.email)]);
      } catch (e) {
        console.error('Could not load classes', e);
        showToast("Couldn't load your classes — check your connection", 5000);
      }

      const idx = ownClasses.map((c) => ({
        id: c.id,
        ownerId: user.uid,
        teacherName: c.teacherName,
        className: c.className,
        collaborators: c.collaborators || {},
      }));
      setClassIndex(idx);

      const pending = myInvites.filter((inv) => inv.status === 'pending');
      const accepted = myInvites.filter((inv) => inv.status === 'accepted' && inv.collaboratorUid === user.uid);
      setPendingInvites(pending);
      const shared = accepted.map((inv) => ({
        id: inv.classId,
        ownerId: inv.ownerId,
        className: inv.className,
        ownerName: inv.ownerName,
        role: inv.role,
        inviteId: inv.id,
      }));
      setSharedIndex(shared);

      let remembered = null;
      try {
        remembered = JSON.parse(localStorage.getItem(lastActiveKey) || 'null');
      } catch {
        remembered = null;
      }

      const choices = [...idx.map((c) => ({ ownerId: c.ownerId, classId: c.id })), ...shared.map((s) => ({ ownerId: s.ownerId, classId: s.id }))];
      let choice = null;
      if (remembered && choices.some((c) => c.ownerId === remembered.ownerId && c.classId === remembered.classId)) choice = remembered;
      else if (choices.length > 0) choice = choices[0];

      if (choice) openClass(choice.ownerId, choice.classId);
      else setShowClassModal(true);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid]);

  // ---- Live class document (roster + sharing) ----

  useEffect(() => {
    if (!active) {
      setClassroom(null);
      return undefined;
    }
    setClassroom(null);
    return watchClass(
      active.ownerId,
      active.classId,
      (data) => {
        if (!data) {
          showToast('That class no longer exists');
          openClass(null, null);
          setShowClassModal(true);
          return;
        }
        setClassroom(data);
      },
      (e) => {
        console.error('Could not open class', e);
        showToast("Couldn't open that class — you may no longer have access to it", 4000);
        openClass(null, null);
        setShowClassModal(true);
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.ownerId, active?.classId]);

  // ---- Live observations for the selected school year ----

  useEffect(() => {
    setObservations([]);
    if (!active) return undefined;
    setObsLoading(true);
    return watchObservations(
      active.ownerId,
      active.classId,
      yearStart,
      (list, meta) => {
        setObservations(list);
        if (!meta.fromCache || list.length > 0) setObsLoading(false);
      },
      (e) => {
        console.error('Could not load observations', e);
        setObsLoading(false);
      }
    );
  }, [active?.ownerId, active?.classId, yearStart]);

  // Pick a sensible first tab once we know the role.
  const roleKnown = useRef(null);
  useEffect(() => {
    if (!activeRole || roleKnown.current === `${active?.ownerId}/${active?.classId}`) return;
    roleKnown.current = `${active?.ownerId}/${active?.classId}`;
    setView(activeRole === 'viewer' ? 'observations' : 'capture');
  }, [activeRole, active?.ownerId, active?.classId]);

  // ---- Classes ----

  const handleCreateClass = async (teacherName, className) => {
    try {
      const newClass = await createClassDoc(user.uid, teacherName, className);
      setClassIndex((prev) => [...prev, { id: newClass.id, ownerId: user.uid, teacherName, className, collaborators: {} }]);
      openClass(user.uid, newClass.id);
      setShowClassModal(false);
      roleKnown.current = `${user.uid}/${newClass.id}`; // stay on Roster rather than jumping to Capture
      setView('roster');
      showToast('Class created — add your students');
    } catch (e) {
      console.error(e);
      showToast("Couldn't create the class");
    }
  };

  const handleSwitchClass = async (ownerId, classId) => {
    if (active && classId === active.classId && ownerId === active.ownerId) return;
    openClass(ownerId, classId);
  };

  const handleDeleteClass = async (id) => {
    try {
      const invites = await listInvitesForClass(user.uid, id);
      await Promise.all(invites.map((inv) => cancelInvite(inv.id)));
    } catch (e) {
      console.error('Could not clean up invitations for deleted class', e);
    }
    try {
      if (photosEnabled) await deleteClassPhotos(user.uid, id);
    } catch (e) {
      console.error('Could not remove class photos', e);
    }
    try {
      await deleteAllObservations(user.uid, id);
      await deleteClassDoc(user.uid, id);
    } catch (e) {
      console.error(e);
      showToast("Couldn't delete the class");
      return;
    }
    const newIndex = classIndex.filter((c) => c.id !== id);
    setClassIndex(newIndex);
    if (active && id === active.classId && active.ownerId === user.uid) {
      const next = newIndex[0] ? { ownerId: newIndex[0].ownerId, classId: newIndex[0].id } : sharedIndex[0] ? { ownerId: sharedIndex[0].ownerId, classId: sharedIndex[0].id } : null;
      if (next) openClass(next.ownerId, next.classId);
      else {
        openClass(null, null);
        setShowClassModal(true);
      }
    }
    showToast('Class deleted');
  };

  // ---- Sharing (same flow as FDK Letters) ----

  const handleInvite = async (classId, className, invitedEmail, role) => {
    await createInvite({ ownerId: user.uid, ownerEmail: user.email, ownerName: user.displayName || '', classId, className, invitedEmail, role });
    showToast('Invitation sent');
  };

  const handleCancelOutgoingInvite = (inviteId) => cancelInvite(inviteId);

  const handleRevokeCollaborator = async (classId, uid, email) => {
    await revokeCollaborator(user.uid, classId, uid, email);
    setClassIndex((prev) =>
      prev.map((c) => {
        if (c.id !== classId) return c;
        const collaborators = { ...c.collaborators };
        delete collaborators[uid];
        return { ...c, collaborators };
      })
    );
    showToast('Access removed');
  };

  const handleAcceptInvite = async (invite) => {
    try {
      await acceptInvite(invite, user.uid, user.email, user.displayName || '');
      setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));
      setSharedIndex((prev) => [
        ...prev,
        { id: invite.classId, ownerId: invite.ownerId, className: invite.className, ownerName: invite.ownerName, role: invite.role, inviteId: invite.id },
      ]);
      showToast(`Joined ${invite.className}`);
      openClass(invite.ownerId, invite.classId);
      setShowClassModal(false);
    } catch (e) {
      console.error('Could not accept invitation', e);
      showToast('Could not accept that invitation');
    }
  };

  const handleDeclineInvite = async (invite) => {
    try {
      await declineInvite(invite.id);
      setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));
    } catch (e) {
      console.error('Could not decline invitation', e);
      showToast('Could not decline that invitation');
    }
  };

  const handleLeaveClass = async (shared) => {
    try {
      await leaveClass(shared.ownerId, shared.id, user.uid, shared.inviteId);
      const remaining = sharedIndex.filter((s) => !(s.id === shared.id && s.ownerId === shared.ownerId));
      setSharedIndex(remaining);
      if (active && active.classId === shared.id && active.ownerId === shared.ownerId) {
        const next = classIndex[0] ? { ownerId: classIndex[0].ownerId, classId: classIndex[0].id } : remaining[0] ? { ownerId: remaining[0].ownerId, classId: remaining[0].id } : null;
        if (next) openClass(next.ownerId, next.classId);
        else {
          openClass(null, null);
          setShowClassModal(true);
        }
      }
      showToast('Left class');
    } catch (e) {
      console.error('Could not leave class', e);
      showToast('Could not leave that class');
    }
  };

  // ---- Roster (blocked for viewers) ----

  const updateStudents = (updater) => {
    if (!canEdit || !classroom) return;
    const next = updater(classroom.students || []);
    setClassroom((prev) => ({ ...prev, students: next })); // instant on screen
    saveStudents(active.ownerId, active.classId, next).catch((e) => {
      console.error('Save failed', e);
      showToast("Couldn't save the roster — try refreshing the page", 4000);
    });
  };

  const handleAddStudents = (names) => {
    updateStudents((prev) => {
      const seen = new Set(prev.map((s) => s.name.toLowerCase()));
      const added = [];
      names.forEach((name) => {
        if (seen.has(name.toLowerCase())) return; // skip names already on the roster or repeated in the list
        seen.add(name.toLowerCase());
        added.push({ id: crypto.randomUUID(), name });
      });
      return [...prev, ...added];
    });
  };

  const handleRenameStudent = (studentId, name) => updateStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, name } : s)));

  const handleDeleteStudent = (studentId) => {
    updateStudents((prev) => prev.filter((s) => s.id !== studentId));
    setPortfolioStudentId((prev) => (prev === studentId ? null : prev));
  };

  // ---- Observations ----

  const handleDeleteObservation = async (obs) => {
    if (!canEdit) return;
    try {
      deleteObservation(active.ownerId, active.classId, obs.id).catch((e) => {
        console.error(e);
        showToast("Couldn't delete that observation");
      });
      if (obs.photoId && photosEnabled) await deletePhoto(active.ownerId, active.classId, obs.photoId);
      showToast('Observation deleted');
    } catch (e) {
      console.error('Photo cleanup failed', e);
      showToast('Observation deleted (photo could not be removed from Drive)');
    }
  };

  const openPortfolio = (studentId) => {
    setPortfolioStudentId(studentId);
    setView('portfolio');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-stone-400 text-sm">Loading…</p>
      </div>
    );
  }

  const shared = { classroom, observations, obsLoading, user, active, canEdit, yearStart, setYearStart, showToast };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      <Header
        classroom={classroom}
        user={user}
        role={activeRole}
        online={online}
        onOpenClassModal={() => setShowClassModal(true)}
        onSignOut={onSignOut}
        pendingInviteCount={pendingInvites.length}
      />

      {classroom ? (
        <>
          <NavTabs view={view} setView={setView} canEdit={canEdit} />
          {/* Kept mounted (just hidden) so a half-written observation survives a tab switch. */}
          {canEdit && (
            <div className={view === 'capture' ? '' : 'hidden'}>
              <CaptureView key={`${active.ownerId}/${active.classId}`} {...shared} online={online} onGoToRoster={() => setView('roster')} />
            </div>
          )}
          {view === 'observations' && <ObservationsView {...shared} onDelete={handleDeleteObservation} onOpenPortfolio={openPortfolio} />}
          {view === 'coverage' && <CoverageView {...shared} onOpenPortfolio={openPortfolio} />}
          {view === 'portfolio' && <PortfolioView {...shared} studentId={portfolioStudentId} setStudentId={setPortfolioStudentId} />}
          {view === 'roster' && (
            <RosterView classroom={classroom} readOnly={!canEdit} onAddStudents={handleAddStudents} onRenameStudent={handleRenameStudent} onDeleteStudent={handleDeleteStudent} />
          )}
        </>
      ) : active ? (
        <div className="max-w-5xl mx-auto px-4 py-16 text-center text-stone-400 text-sm">Opening class…</div>
      ) : (
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="w-16 h-16 rounded-2xl mx-auto mb-4 opacity-80" />
          {pendingInvites.length > 0 ? (
            <p className="text-stone-500 mb-4">
              You have {pendingInvites.length} invitation{pendingInvites.length === 1 ? '' : 's'} waiting, or you can create your own class.
            </p>
          ) : (
            <p className="text-stone-500 mb-4">Create a class to get started.</p>
          )}
          <button onClick={() => setShowClassModal(true)} className="bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium px-4 py-2 rounded-lg">
            {pendingInvites.length > 0 ? 'Manage classes' : 'Create a class'}
          </button>
        </div>
      )}

      <ClassModal
        show={showClassModal}
        onClose={() => setShowClassModal(false)}
        user={user}
        classIndex={classIndex}
        sharedIndex={sharedIndex}
        pendingInvites={pendingInvites}
        activeClassId={active?.classId}
        activeOwnerId={active?.ownerId}
        onCreateClass={handleCreateClass}
        onSwitchClass={handleSwitchClass}
        onDeleteClass={handleDeleteClass}
        onInvite={handleInvite}
        onCancelInvite={handleCancelOutgoingInvite}
        onRevokeCollaborator={handleRevokeCollaborator}
        onAcceptInvite={handleAcceptInvite}
        onDeclineInvite={handleDeclineInvite}
        onLeaveClass={handleLeaveClass}
      />

      {toast && (
        <div role="status" className="no-print fixed bottom-4 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50 max-w-[90vw] text-center">
          {toast}
        </div>
      )}
    </div>
  );
}
