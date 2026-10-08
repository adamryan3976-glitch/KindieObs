import { NAV_ITEMS, ROLE_META } from '../constants.js';

export function Header({ classroom, user, role, online, onOpenClassModal, onSignOut, pendingInviteCount }) {
  return (
    <header className="no-print bg-brand-800 text-white border-b-4 border-gold-500" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="w-10 h-10 rounded-lg shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold leading-tight truncate italic tracking-tight">K-Doc</h1>
            {classroom ? (
              <p className="text-brand-200 text-xs truncate flex items-center gap-1.5">
                <span className="truncate">
                  {classroom.className} (Teacher: {classroom.teacherName})
                </span>
                {role && role !== 'owner' && (
                  <span className="shrink-0 bg-brand-700 border border-brand-600 text-brand-100 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded">
                    {ROLE_META[role]?.label || role}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-brand-200 text-xs truncate">No class selected</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="flex items-center gap-1.5 text-xs text-brand-200"
            title={online ? 'Online — changes sync right away' : 'Offline — observations are saved on this device and sync when you reconnect'}
          >
            <span className={'w-2 h-2 rounded-full ' + (online ? 'bg-emerald-400' : 'bg-gold-500 animate-pulse')} />
            <span className="hidden sm:inline">{online ? 'Online' : 'Offline'}</span>
          </span>
          <button
            onClick={onOpenClassModal}
            className="relative bg-brand-700 hover:bg-brand-600 text-white text-sm font-medium px-3 py-1.5 rounded-md border border-brand-600"
          >
            Classes
            {pendingInviteCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-gold-500 text-brand-900 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {pendingInviteCount}
              </span>
            )}
          </button>
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'Account'}
              title={`${user.displayName || ''} — sign out`}
              onClick={onSignOut}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full border border-brand-600 cursor-pointer"
            />
          ) : (
            <button onClick={onSignOut} className="text-brand-200 text-xs hover:text-white underline">
              Sign out
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export function NavTabs({ view, setView, canEdit }) {
  return (
    <div className="no-print max-w-5xl mx-auto px-2 sm:px-4 pt-2 flex gap-1 overflow-x-auto border-b border-stone-300">
      {NAV_ITEMS.filter((item) => canEdit || !item.editOnly).map((item) => {
        const Icon = item.icon;
        const active = view === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={
              'flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-medium rounded-t-lg border whitespace-nowrap ' +
              (active
                ? 'bg-stone-50 text-brand-800 border-stone-300 border-b-stone-50 -mb-px'
                : 'bg-stone-100 text-stone-500 border-transparent hover:bg-stone-200 hover:text-stone-700')
            }
          >
            <Icon size={16} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
