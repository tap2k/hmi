import { useRef } from 'react';
import './ProfilePanel.css';

const LONG_PRESS_MS = 500;

export default function ProfilePanel({
  profiles,
  activeProfileId,
  editingProfile,
  onActivate,
  onEdit,
  onAdd,
  onSave,
  onCancel,
  onDelete,
  onEditNameChange,
}) {
  if (editingProfile) {
    return (
      <div className="profile-panel">
        <div className="profile-panel-title">
          {editingProfile.isNew ? 'NEW PROFILE' : 'EDIT PROFILE'}
        </div>
        <div className="profile-panel-body">
          <label className="profile-panel-label" htmlFor="profile-name-input">NAME</label>
          <input
            id="profile-name-input"
            className="profile-panel-input"
            value={editingProfile.name}
            onChange={e => onEditNameChange(e.target.value)}
            autoFocus
          />
          <div className="profile-panel-hint">
            Click work-light fixtures (L1–L7) on the loader to toggle them in this profile.
          </div>
        </div>
        <div className="profile-panel-footer">
          <button
            className="ppb ppb-delete"
            onClick={onDelete}
            disabled={editingProfile.isNew}
          >
            Delete
          </button>
          <button className="ppb ppb-cancel" onClick={onCancel}>Cancel</button>
          <button className="ppb ppb-ok"     onClick={onSave}>OK</button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-panel">
      <div className="profile-panel-title">PROFILES</div>
      <div className="profile-panel-body">
        {profiles.length === 0 && (
          <div className="profile-row-empty">No profiles. Tap “+ New” to create one.</div>
        )}
        {profiles.map(p => (
          <ProfileRow
            key={p.id}
            profile={p}
            active={p.id === activeProfileId}
            onActivate={() => onActivate(p)}
            onEdit={() => onEdit(p)}
          />
        ))}
      </div>
      <div className="profile-panel-footer">
        <button className="ppb ppb-add" onClick={onAdd}>+ New</button>
      </div>
    </div>
  );
}

// Click → activate. Press-and-hold (≥500ms) → edit. Movement during press cancels both.
function ProfileRow({ profile, active, onActivate, onEdit }) {
  const timerRef = useRef(null);
  const longPressedRef = useRef(false);

  const cancelTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const onPointerDown = () => {
    longPressedRef.current = false;
    cancelTimer();
    timerRef.current = setTimeout(() => {
      longPressedRef.current = true;
      timerRef.current = null;
      onEdit();
    }, LONG_PRESS_MS);
  };

  const onPointerUp = () => {
    cancelTimer();
    if (!longPressedRef.current) onActivate();
  };

  const onPointerLeave = () => {
    cancelTimer();
    longPressedRef.current = false;
  };

  return (
    <div
      className={`profile-row ${active ? 'profile-row-active' : ''}`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerLeave}
    >
      <div className="profile-row-dot" />
      <div className="profile-row-name">{profile.name}</div>
    </div>
  );
}
