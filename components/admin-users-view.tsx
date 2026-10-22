'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Check, KeyRound, MoreHorizontal, Search, ShieldCheck, UserPlus, Users, UserRoundX } from 'lucide-react';
import { poultryBuildings, units, type UnitId } from '@/lib/data';
import { accessOptionsForUnits, normalizeUserPermissions, sanitizeAccess, unitIdsFromUser, unitLabelsFromIds } from '@/lib/user-access';
import { FARM_STORAGE_KEYS, readLocal, writeLocal } from '@/lib/farm-storage';
import { syncManagedUserToHR } from '@/lib/hr-directory';
import { Modal, SectionHeading, StatCard } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';

const roles = ['PDG', 'DG', 'Responsable unité', 'Magasinier', 'Caissier', 'Commercial', 'Livreur', 'Lecteur', 'Infirmier', 'Comptable'];
type AdminUser = { id: string; initials: string; name: string; identifier: string; role: string; unit?: string; allowedUnits: string[]; assignedBuildings: string[]; passwordSet: boolean; status: 'Actif' | 'Invité' | 'Suspendu'; access: string[] };
type ServerUser = Partial<AdminUser> & { id: string; name: string; identifier: string; role: string; allowedUnits: string[]; access: string[]; status: AdminUser['status']; passwordSet?: boolean };

export function AdminUsersView() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [rolesList, setRolesList] = useState<string[]>(roles);
  const [query, setQuery] = useState('');
  const [unitFilter, setUnitFilter] = useState('Toutes les unités');
  const [roleFilter, setRoleFilter] = useState('Tous les rôles');
  const [statusFilter, setStatusFilter] = useState('Tous les statuts');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [feedback, setFeedback] = useState('');
  const [allowedUnits, setAllowedUnits] = useState<UnitId[]>([]);
  const [assignedBuildings, setAssignedBuildings] = useState<string[]>([]);
  const [selectedAccess, setSelectedAccess] = useState<string[]>([]);
  const [buildingOptions, setBuildingOptions] = useState<Array<{ id: string; name: string }>>(poultryBuildings);

  useEffect(() => {
    const saved = readLocal<Array<{ id: string; name: string }>>(FARM_STORAGE_KEYS.buildings, []);
    if (saved.length) setBuildingOptions(saved);
  }, []);

  const accessOptions = useMemo(() => accessOptionsForUnits(allowedUnits), [allowedUnits]);

  useEffect(() => {
    setSelectedAccess((current) => current.filter((right) => accessOptions.includes(right)));
  }, [accessOptions]);

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      const localUsers = readLocal<AdminUser[]>(FARM_STORAGE_KEYS.users, []).map(toAdminUser);
      let remoteUsers: AdminUser[] = [];
      try {
        const response = await fetch('/api/admin/users', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json() as { users?: ServerUser[] };
          remoteUsers = (data.users ?? []).map(toAdminUser);
        }
      } catch {
        // L'annuaire local reste consultable si le serveur n'est pas disponible.
      }
      if (disposed) return;
      const remoteIds = new Set(remoteUsers.map((user) => user.id));
      const merged = [...remoteUsers, ...localUsers.filter((user) => !remoteIds.has(user.id))];
      setUsers(merged);
      writeLocal(FARM_STORAGE_KEYS.users, merged);
      merged.forEach((user) => syncManagedUserToHR(user));
    };
    void load();
    return () => { disposed = true; };
  }, []);

  function notify(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(''), 4000);
  }

  const visible = useMemo(() => users.filter((user) => `${user.name} ${user.identifier} ${user.role} ${unitLabelsFromIds(user.allowedUnits).join(' ')}`.toLowerCase().includes(query.toLowerCase()) && (unitFilter === 'Toutes les unités' || unitIdsFromUser(user.allowedUnits).includes(unitFilter as UnitId)) && (roleFilter === 'Tous les rôles' || user.role === roleFilter) && (statusFilter === 'Tous les statuts' || user.status === statusFilter)), [query, roleFilter, statusFilter, unitFilter, users]);

  function openCreate() {
    setEditing(null);
    setAllowedUnits([]);
    setAssignedBuildings([]);
    setSelectedAccess([]);
    setOpen(true);
  }

  function openEdit(user: AdminUser) {
    const selectedUnits = normalizeUserPermissions(user.allowedUnits, user.access).allowedUnits;
    setEditing(user);
    setAllowedUnits(selectedUnits);
    setAssignedBuildings(user.assignedBuildings ?? []);
    setSelectedAccess(sanitizeAccess(selectedUnits, user.access));
    setOpen(true);
  }

  function toggleAllowedUnit(nextUnit: UnitId, checked: boolean) {
    setAllowedUnits((current) => checked ? Array.from(new Set([...current, nextUnit])) : current.filter((unit) => unit !== nextUnit));
  }

  function toggleAccess(right: string, checked: boolean) {
    setSelectedAccess((current) => checked ? Array.from(new Set([...current, right])) : current.filter((item) => item !== right));
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const identifier = String(form.get('identifier') ?? '').trim();
    const role = String(form.get('role') ?? 'Responsable unité').trim();
    const rawAllowedUnits = form.getAll('allowedUnit').map(String);
    const rawAssignedBuildings = form.getAll('assignedBuilding').map(String);
    const rawAccess = form.getAll('access').map(String);
    const password = String(form.get('password') ?? '');
    const permissions = normalizeUserPermissions(rawAllowedUnits, rawAccess);
    const assignedBuildingsForUser = permissions.allowedUnits.includes('poulets') ? rawAssignedBuildings.filter((id) => buildingOptions.some((building) => building.id === id)) : [];

    if (!name || !identifier || !role || !permissions.allowedUnits.length || (!editing && !password)) {
      notify('Nom, identifiant, rôle et au moins une unité autorisée sont obligatoires.');
      return;
    }

    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editing?.id, name, identifier, role, allowedUnits: permissions.allowedUnits, access: permissions.access, assignedBuildings: assignedBuildingsForUser, status: editing?.status ?? 'Invité', password: password || undefined }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      notify(data.error ?? 'Impossible d’enregistrer cet utilisateur.');
      return;
    }
    const data = await response.json() as { user?: ServerUser };
    const serverUser = data.user;
    const labels = unitLabelsFromIds(serverUser?.allowedUnits ?? permissions.allowedUnits);
    const record: AdminUser = {
      id: serverUser?.id ?? editing?.id ?? `USR-${Date.now()}`,
      initials: name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
      name,
      identifier,
      role,
      unit: labels.join(' · '),
      allowedUnits: serverUser?.allowedUnits ?? permissions.allowedUnits,
      assignedBuildings: serverUser?.assignedBuildings ?? assignedBuildingsForUser,
      passwordSet: serverUser?.passwordSet ?? editing?.passwordSet ?? Boolean(password),
      status: serverUser?.status ?? editing?.status ?? 'Invité',
      access: serverUser?.access ?? permissions.access,
    };
    const next = editing ? users.map((user) => user.id === editing.id ? record : user) : [record, ...users];
    setUsers(next);
    writeLocal(FARM_STORAGE_KEYS.users, next);
    syncManagedUserToHR(record);
    if (!rolesList.some((item) => item.toLowerCase() === role.toLowerCase())) {
      const nextRoles = [...rolesList, role];
      setRolesList(nextRoles);
      writeLocal(FARM_STORAGE_KEYS.managedRoles, nextRoles);
    }
    setOpen(false);
    setEditing(null);
    notify(`L’utilisateur ${name} a été ${editing ? 'modifié' : 'créé'}. Il peut maintenant se connecter avec ses identifiants.`);
  }

  async function updateUser(id: string, patch: Partial<AdminUser>, message: string) {
    const response = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) });
    if (!response.ok) {
      notify('La modification serveur a échoué.');
      return;
    }
    const data = await response.json().catch(() => ({})) as { user?: ServerUser };
    const next = users.map((user) => user.id === id ? { ...user, ...patch, ...(data.user ? toAdminUser(data.user) : {}) } : user);
    setUsers(next);
    writeLocal(FARM_STORAGE_KEYS.users, next);
    notify(message);
  }

  async function deleteUser(user: AdminUser) {
    if (!window.confirm(`Supprimer définitivement l’accès de ${user.name} ?`)) return;
    const response = await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user.id }) });
    if (!response.ok) {
      notify('La suppression serveur a échoué.');
      return;
    }
    const next = users.filter((item) => item.id !== user.id);
    setUsers(next);
    writeLocal(FARM_STORAGE_KEYS.users, next);
    notify(`L’accès de ${user.name} a été supprimé.`);
  }

  return <div className="fade-in space-y-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="eyebrow mb-2">Administration · Accès</p><h1 className="page-title">Utilisateurs de toutes les unités</h1><p className="muted mt-2 max-w-2xl text-[13px]">MOVIC peut gérer tous les accès depuis cet écran. Toutes les unités cochées ont la même valeur pour l’utilisateur.</p></div><button className="btn-primary" onClick={openCreate}><UserPlus size={16} /> Créer un utilisateur</button></div>{feedback && <div className="flex items-center gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold text-[#4d8f51]"><Check size={14} />{feedback}</div>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Profils visibles" value={String(visible.length)} change={`${users.length} au total`} detail="toutes unités" icon={Users} tone="green" /><StatCard label="Actifs" value={String(users.filter((user) => user.status === 'Actif').length)} change="accès ouverts" detail="annuaire global" icon={ShieldCheck} tone="blue" /><StatCard label="Invitations" value={String(users.filter((user) => user.status === 'Invité').length)} change="à relancer" detail="accès en attente" icon={UserPlus} tone="orange" /><StatCard label="Suspendus" value={String(users.filter((user) => user.status === 'Suspendu').length)} change="accès bloqués" detail="sécurité" icon={KeyRound} tone="purple" /></div><div className="surface overflow-visible"><div className="flex flex-col gap-4 border-b border-[#edf0eb] px-5 pb-4 pt-5 sm:px-6"><SectionHeading eyebrow="Annuaire global" title="Tous les utilisateurs" description="Filtres par unité, rôle et statut." /><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa59f]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="input-base h-9 pl-9 text-[11px]" placeholder="Rechercher..." /></div><select className="input-base h-9 text-[11px]" value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)}><option>Toutes les unités</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select><select className="input-base h-9 text-[11px]" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option>Tous les rôles</option>{rolesList.map((role) => <option key={role}>{role}</option>)}</select><select className="input-base h-9 text-[11px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Tous les statuts</option><option>Actif</option><option>Invité</option><option>Suspendu</option></select></div></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Utilisateur</th><th>Rôle</th><th>Unités autorisées</th><th>Accès</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{visible.length ? visible.map((user) => <tr className="table-row table-line" key={user.id}><td><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dff3d9] text-[10px] font-black text-[#49884d]">{user.initials}</span><span><strong className="block text-ink">{user.name}</strong><small className="mt-1 block text-[10px] text-[#9aa59f]">{user.identifier}</small></span></div></td><td>{user.role}</td><td><div className="flex max-w-[290px] flex-wrap gap-1">{unitLabelsFromIds(user.allowedUnits).map((label) => <span key={label} className="rounded-full bg-[#edf3ff] px-2 py-1 text-[9px] font-bold text-[#6385bd]">{label}</span>)}{!user.allowedUnits.length && <span className="text-[10px] text-[#b45d5d]">Aucune</span>}</div></td><td><span className="text-[10px]">{user.access.slice(0, 3).join(' · ')}{user.access.length > 3 ? ` +${user.access.length - 3}` : ''}</span></td><td><StatusBadge status={user.status} /></td><td><div className="flex gap-1"><button className="icon-btn h-8 w-8" onClick={() => openEdit(user)} aria-label="Modifier"><MoreHorizontal size={15} /></button><button className="icon-btn h-8 w-8" onClick={() => updateUser(user.id, { status: user.status === 'Suspendu' ? 'Actif' : 'Suspendu' }, user.status === 'Suspendu' ? 'Compte réactivé.' : 'Compte suspendu.')} aria-label="Suspendre ou réactiver"><ShieldCheck size={14} /></button><button className="icon-btn h-8 w-8 text-[#8b73b8]" onClick={() => updateUser(user.id, { status: 'Invité', passwordSet: false }, 'Invitation forcée. Le mot de passe devra être redéfini.')} aria-label="Réinitialiser"><KeyRound size={14} /></button><button className="icon-btn h-8 w-8 text-[#b45d5d]" onClick={() => deleteUser(user)} aria-label="Supprimer"><UserRoundX size={14} /></button></div></td></tr>) : <tr><td colSpan={6} className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucun utilisateur ne correspond aux filtres.</td></tr>}</tbody></table></div></div><Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={editing ? 'Modifier un utilisateur' : 'Créer un utilisateur'}><form key={editing?.id ?? 'new-user'} onSubmit={saveUser} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Nom complet</span><input name="name" className="input-base" defaultValue={editing?.name ?? ''} required /></label><label className="block"><span className="field-label">Identifiant / email</span><input name="identifier" className="input-base" defaultValue={editing?.identifier ?? ''} required /></label><label className="block"><span className="field-label">Rôle</span><input name="role" list="admin-roles" className="input-base" defaultValue={editing?.role ?? 'Responsable unité'} required /><datalist id="admin-roles">{rolesList.map((role) => <option key={role} value={role} />)}</datalist></label><label className="block"><span className="field-label">Mot de passe initial</span><input name="password" type="password" className="input-base" placeholder={editing ? 'Laisser vide pour conserver' : 'Mot de passe'} /></label></div><div><span className="field-label">Unités autorisées</span><p className="mb-2 text-[10px] text-[#87958d]">Toutes les unités cochées sont équivalentes. Sélectionnez au moins une unité.</p><div className="grid gap-2 sm:grid-cols-2">{units.map((unit) => <label key={unit.id} className="flex items-center gap-2 rounded-lg border border-[#e6ede5] px-3 py-2.5 text-[11px] font-semibold text-[#65766c]"><input type="checkbox" name="allowedUnit" value={unit.id} checked={allowedUnits.includes(unit.id)} onChange={(event) => toggleAllowedUnit(unit.id, event.target.checked)} className="h-3.5 w-3.5 accent-[#5da561]" />{unit.label}</label>)}</div></div>{allowedUnits.includes('poulets') && <div><span className="field-label">Bâtiments attribués pour Poulets bio</span><p className="mb-2 text-[10px] text-[#87958d]">L’utilisateur voit tous les bâtiments, mais ne pourra modifier que ceux cochés. Aucune sélection = tous les bâtiments.</p><div className="grid gap-2 sm:grid-cols-2">{buildingOptions.map((building) => <label key={building.id} className="flex items-center gap-2 rounded-lg border border-[#e6ede5] px-3 py-2.5 text-[11px] font-semibold text-[#65766c]"><input type="checkbox" name="assignedBuilding" value={building.id} checked={assignedBuildings.includes(building.id)} onChange={(event) => setAssignedBuildings((current) => event.target.checked ? [...new Set([...current, building.id])] : current.filter((id) => id !== building.id))} className="h-3.5 w-3.5 accent-[#5da561]" />{building.name}</label>)}</div></div>}<div><div className="flex flex-wrap items-end justify-between gap-2"><span className="field-label">Droits complémentaires</span><span className="text-[10px] text-[#87958d]">Union des unités cochées</span></div>{accessOptions.length ? <div className="mt-1 grid max-h-60 gap-2 overflow-y-auto sm:grid-cols-2">{accessOptions.map((right) => <label key={right} className="flex items-center gap-2 rounded-lg border border-[#e6ede5] px-3 py-2 text-[10px] font-semibold text-[#65766c]"><input type="checkbox" name="access" value={right} checked={selectedAccess.includes(right)} onChange={(event) => toggleAccess(right, event.target.checked)} className="h-3.5 w-3.5 accent-[#5da561]" />{right}</label>)}</div> : <p className="mt-2 rounded-lg border border-dashed border-[#dce8db] px-3 py-4 text-[11px] text-[#89968f]">Cochez au moins une unité pour afficher ses droits.</p>}</div><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> Enregistrer l’utilisateur</button></div></form></Modal></div>;
}

function toAdminUser(user: ServerUser): AdminUser {
  const permissions = normalizeUserPermissions(user.allowedUnits ?? [], user.access ?? []);
  return { id: user.id, initials: user.initials ?? user.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(), name: user.name, identifier: user.identifier, role: user.role, unit: unitLabelsFromIds(permissions.allowedUnits).join(' · '), allowedUnits: permissions.allowedUnits, assignedBuildings: user.assignedBuildings ?? [], passwordSet: user.passwordSet ?? false, status: user.status, access: permissions.access };
}
