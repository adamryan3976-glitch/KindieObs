import { useState } from 'react';
import { X, Trash2, Plus, Share2, UserPlus, LogOut, Check, ChevronDown, ChevronUp, Mail } from 'lucide-react';
import { ROLE_META } from '../constants.js';
import { listInvitesForClass } from '../lib/invites.js';

function RoleBadge({ role }) {
  const meta = ROLE_META[role];
  return (
    <span className="shrink-0 bg-stone-100 border border-stone-300 text-stone-600 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded">
      {meta?.label || role}
    </span>
  );
}

export function ClassModal({
  show,
  onClose,
  user,
  classIndex,
  sharedIndex,
  pendingInvites,
  activeClassId,
  activeOwnerId,
  onCreateClass,
  onSwitchClass,
  onDeleteClass,
  onInvite,
  onCancelInvite,
  onRevokeCollaborator,
  onAcceptInvite,
  onDeclineInvite,
  onLeaveClass,
}) {
  const [teacherName, setTeacherName] = useState('');
  const [className, setClassName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmLeaveKey, setConfirmLeaveKey] = useState(null);
  const [busyInviteId, setBusyInviteId] = useState(null);

  const [expandedShareId, setExpandedShareId] = useState(null);
  const [invitesByClass, setInvitesByClass] = useState({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviteError, setInviteError] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);

  if (!show) return null;

  const handleCreate = (e) => {
    e.preventDefault();
    if (!teacherName.trim() || !className.trim()) return;
    onCreateClass(teacherName.trim(), className.trim());
    setTeacherName('');
    setClassName('');
  };

  const refreshInvitesForClass = async (classId) => {
    try {
      const list = await listInvitesForClass(user.uid, classId);
      setInvitesByClass((prev) => ({ ...prev, [classId]: list.filter((inv) => inv.status === 'pending') }));
    } catch {
      setInvitesByClass((prev) => ({ ...prev, [classId]: prev[classId] || [] }));
    }
  };

  const toggleShare = async (classId) => {
    if (expandedShareId === classId) {
      setExpandedShareId(null);
      return;
    }
    setExpandedShareId(classId);
    setInviteEmail('');
    setInviteError('');
    if (!invitesByClass[classId]) {
      await refreshInvitesForClass(classId);
    }
  };

  const handleSendInvite = async (c) => {
    setInviteError('');
    if (!inviteEmail.trim()) {
      setInviteError('Enter an email address.');
      return;
    }
    setInviteBusy(true);
    try {
      await onInvite(c.id, c.className, inviteEmail.trim(), inviteRole);
      setInviteEmail('');
      await refreshInvitesForClass(c.id);
    } catch (e) {
      setInviteError(e.message || 'Could not send the invitation.');
    }
    setInviteBusy(false);
  };

  const handleCancelInvite = async (classId, inviteId) => {
    await onCancelInvite(inviteId);
    setInvitesByClass((prev) => ({ ...prev, [classId]: (prev[classId] || []).filter((i) => i.id !== inviteId) }));
  };

  const handleAccept = async (invite) => {
    setBusyInviteId(invite.id);
    await onAcceptInvite(invite);
    setBusyInviteId(null);
  };

  const handleDecline = async (invite) => {
    setBusyInviteId(invite.id);
    await onDeclineInvite(invite);
    setBusyInviteId(null);
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full my-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
          <h2 className="font-bold text-stone-800">Manage classes</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {pendingInvites.length > 0 && (
            <div className="px-5 py-4 border-b border-stone-200 bg-amber-50/60">
              <p className="text-sm font-semibold text-stone-700 mb-2 flex items-center gap-1.5">
                <Mail size={15} /> Invitations for you
              </p>
              <ul className="space-y-2">
                {pendingInvites.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-amber-300 bg-white">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-stone-800 truncate">{inv.className}</div>
                      <div className="text-xs text-stone-500 truncate">
                        From {inv.ownerName || inv.ownerEmail} &middot; <RoleBadge role={inv.role} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        disabled={busyInviteId === inv.id}
                        onClick={() => handleAccept(inv)}
                        className="text-xs px-2 py-1 rounded bg-emerald-600 text-white disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        disabled={busyInviteId === inv.id}
                        onClick={() => handleDecline(inv)}
                        className="text-xs px-2 py-1 rounded bg-stone-200 text-stone-600 disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="px-5 py-4 border-b border-stone-200">
            <p className="text-sm font-semibold text-stone-700 mb-2">Your classes</p>
            {classIndex.length === 0 && <p className="text-sm text-stone-500">No classes yet. Create your first one below.</p>}
            <ul className="space-y-2">
              {classIndex.map((c) => {
                const collaborators = Object.entries(c.collaborators || {});
                const isActive = c.id === activeClassId && c.ownerId === activeOwnerId;
                return (
                  <li key={c.id} className={'rounded-lg border ' + (isActive ? 'border-brand-600 bg-brand-50' : 'border-stone-200')}>
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <button
                        onClick={() => {
                          onSwitchClass(c.ownerId, c.id);
                          onClose();
                        }}
                        className="text-left flex-1 min-w-0"
                      >
                        <div className="text-sm font-medium text-stone-800 truncate">{c.className}</div>
                        <div className="text-xs text-stone-500 truncate">
                          Teacher: {c.teacherName}
                          {collaborators.length > 0 && ` · ${collaborators.length} shared with`}
                        </div>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => toggleShare(c.id)}
                          className={'p-1.5 rounded-md ' + (expandedShareId === c.id ? 'text-brand-700 bg-brand-100' : 'text-stone-400 hover:text-brand-700')}
                          aria-label={`Share ${c.className}`}
                          title="Share this class"
                        >
                          <Share2 size={16} />
                        </button>
                        {confirmDeleteId === c.id ? (
                          <div className="flex items-center gap-1" title="Deletes the class, all its observations, and its photos">
                            <span className="text-[11px] text-rose-600 hidden sm:inline">All observations too?</span>
                            <button
                              onClick={() => {
                                onDeleteClass(c.id);
                                setConfirmDeleteId(null);
                              }}
                              className="text-xs px-2 py-1 rounded bg-rose-500 text-white"
                            >
                              Delete
                            </button>
                            <button onClick={() => setConfirmDeleteId(null)} className="text-xs px-2 py-1 rounded bg-stone-200 text-stone-600">
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(c.id)} className="text-stone-400 hover:text-rose-500" aria-label={`Delete ${c.className}`}>
                            <Trash2 size={16} />
                          </button>
                        )}
                        {expandedShareId === c.id ? <ChevronUp size={14} className="text-stone-300" /> : <ChevronDown size={14} className="text-stone-300" />}
                      </div>
                    </div>

                    {expandedShareId === c.id && (
                      <div className="border-t border-stone-200 px-3 py-3 space-y-3 bg-stone-50 rounded-b-lg">
                        {collaborators.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-stone-500 mb-1.5">Has access</p>
                            <ul className="space-y-1.5">
                              {collaborators.map(([uid, info]) => (
                                <li key={uid} className="flex items-center justify-between gap-2 bg-white border border-stone-200 rounded-md px-2.5 py-1.5">
                                  <div className="min-w-0">
                                    <div className="text-xs text-stone-800 truncate">{info.displayName || info.email}</div>
                                    <div className="text-[11px] text-stone-400 truncate">{info.email}</div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <RoleBadge role={info.role} />
                                    <button
                                      onClick={() => onRevokeCollaborator(c.id, uid, info.email)}
                                      className="text-stone-400 hover:text-rose-500"
                                      aria-label={`Remove ${info.email}`}
                                      title="Remove access"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {(invitesByClass[c.id] || []).length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-stone-500 mb-1.5">Invitations sent</p>
                            <ul className="space-y-1.5">
                              {invitesByClass[c.id].map((inv) => (
                                <li key={inv.id} className="flex items-center justify-between gap-2 bg-white border border-dashed border-stone-300 rounded-md px-2.5 py-1.5">
                                  <div className="text-xs text-stone-600 truncate">{inv.invitedEmail}</div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <RoleBadge role={inv.role} />
                                    <span className="text-[10px] text-stone-400">pending</span>
                                    <button
                                      onClick={() => handleCancelInvite(c.id, inv.id)}
                                      className="text-stone-400 hover:text-rose-500"
                                      aria-label={`Cancel invitation to ${inv.invitedEmail}`}
                                      title="Cancel invitation"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div>
                          <p className="text-xs font-semibold text-stone-500 mb-1.5 flex items-center gap-1">
                            <UserPlus size={13} /> Invite someone
                          </p>
                          <div className="flex flex-col sm:flex-row gap-1.5">
                            <input
                              type="email"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              placeholder="Email address"
                              aria-label="Invite by email"
                              className="flex-1 px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                            <select
                              value={inviteRole}
                              onChange={(e) => setInviteRole(e.target.value)}
                              aria-label="Role to invite as"
                              className="px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                            >
                              <option value="editor">Editor (can edit)</option>
                              <option value="viewer">Viewer (view only)</option>
                            </select>
                            <button
                              onClick={() => handleSendInvite(c)}
                              disabled={inviteBusy}
                              className="flex items-center justify-center gap-1 bg-brand-700 hover:bg-brand-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg shrink-0 disabled:opacity-50"
                            >
                              <Check size={13} /> Send
                            </button>
                          </div>
                          <p className="text-[11px] text-stone-400 mt-1">{ROLE_META[inviteRole]?.hint}</p>
                          {inviteError && <p className="text-[11px] text-rose-500 mt-1">{inviteError}</p>}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <form onSubmit={handleCreate} className="mt-3 pt-3 border-t border-stone-200 space-y-2">
              <p className="text-sm font-medium text-stone-700">Add a new class</p>
              <input
                type="text"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="Teacher name"
                aria-label="Teacher name"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="Class name (e.g., Room 12 FDK)"
                aria-label="Class name"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button type="submit" className="w-full flex items-center justify-center gap-1 bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium py-2 rounded-lg">
                <Plus size={15} /> Create class
              </button>
            </form>
          </div>

          {sharedIndex.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-sm font-semibold text-stone-700 mb-2">Shared with you</p>
              <ul className="space-y-2">
                {sharedIndex.map((s) => {
                  const key = `${s.ownerId}__${s.id}`;
                  const isActive = s.id === activeClassId && s.ownerId === activeOwnerId;
                  return (
                    <li key={key} className={'flex items-center justify-between gap-2 px-3 py-2 rounded-lg border ' + (isActive ? 'border-brand-600 bg-brand-50' : 'border-stone-200')}>
                      <button
                        onClick={() => {
                          onSwitchClass(s.ownerId, s.id);
                          onClose();
                        }}
                        className="text-left flex-1 min-w-0"
                      >
                        <div className="text-sm font-medium text-stone-800 truncate flex items-center gap-1.5">
                          <span className="truncate">{s.className}</span>
                          <RoleBadge role={s.role} />
                        </div>
                        <div className="text-xs text-stone-500 truncate">Shared by {s.ownerName || 'the owner'}</div>
                      </button>
                      {confirmLeaveKey === key ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              onLeaveClass(s);
                              setConfirmLeaveKey(null);
                            }}
                            className="text-xs px-2 py-1 rounded bg-rose-500 text-white"
                          >
                            Leave
                          </button>
                          <button onClick={() => setConfirmLeaveKey(null)} className="text-xs px-2 py-1 rounded bg-stone-200 text-stone-600">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmLeaveKey(key)} className="text-stone-400 hover:text-rose-500 shrink-0" aria-label={`Leave ${s.className}`} title="Leave this class">
                          <LogOut size={16} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
