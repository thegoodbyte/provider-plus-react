import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiEdit2, FiMail, FiMapPin, FiPhone, FiPlus, FiSearch, FiTrash2, FiUsers } from 'react-icons/fi';
import LoadingSpinner from './LoadingSpinner';
import { contactBookApi } from '../services/api';
import { ContactBookEntry } from '../types';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const roleOptions = [
  'helper',
  'translator',
  'driver',
  'doctor',
  'nurse',
  'therapist',
  'cook',
  'house manager',
  'maintenance',
  'supplier',
  'legal',
  'other',
];

const emptyForm: Partial<ContactBookEntry> = {
  name: '',
  role: 'helper',
  organization: '',
  phone: '',
  email: '',
  whatsapp: '',
  location: '',
  languages: [],
  tags: [],
  notes: '',
  isActive: true,
};

const splitList = (value?: string) =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const joinList = (value?: string[]) => (value || []).join(', ');

const roleLabel = (role?: string) =>
  (role || 'other')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const ContactBookPage: React.FC = () => {
  const [contacts, setContacts] = useState<ContactBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactBookEntry | null>(null);
  const [formData, setFormData] = useState<Partial<ContactBookEntry>>(emptyForm);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await contactBookApi.getAll({
        search: search.trim() || undefined,
        role: roleFilter || undefined,
        includeInactive,
      });
      setContacts(response.data || []);
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || loadError?.message || 'Unable to load contact book.');
    } finally {
      setLoading(false);
    }
  }, [includeInactive, roleFilter, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadContacts();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [loadContacts]);

  const roleCounts = useMemo(() => {
    return contacts.reduce<Record<string, number>>((acc, contact) => {
      const role = contact.role || 'other';
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});
  }, [contacts]);

  const openCreate = () => {
    setEditingContact(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const openEdit = (contact: ContactBookEntry) => {
    setEditingContact(contact);
    setFormData({
      ...contact,
      languages: contact.languages || [],
      tags: contact.tags || [],
      isActive: contact.isActive !== false,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingContact(null);
    setFormData(emptyForm);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = event.target;
    if (type === 'checkbox') {
      setFormData((prev) => ({ ...prev, [name]: (event.target as HTMLInputElement).checked }));
      return;
    }
    if (name === 'languages' || name === 'tags') {
      setFormData((prev) => ({ ...prev, [name]: splitList(value) }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.name?.trim() || !formData.role?.trim()) {
      setError('Name and role are required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...formData,
        name: formData.name.trim(),
        role: formData.role.trim(),
        languages: formData.languages || [],
        tags: formData.tags || [],
        isActive: formData.isActive !== false,
      } as Omit<ContactBookEntry, '_id'>;

      if (editingContact?._id) {
        await contactBookApi.update(editingContact._id, payload);
      } else {
        await contactBookApi.create(payload);
      }
      closeModal();
      await loadContacts();
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || saveError?.message || 'Unable to save contact.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (contact: ContactBookEntry) => {
    if (!contact._id) return;
    if (!window.confirm(`Delete ${contact.name} from the contact book?`)) return;

    try {
      await contactBookApi.delete(contact._id);
      await loadContacts();
    } catch (deleteError: any) {
      setError(deleteError?.response?.data?.message || deleteError?.message || 'Unable to delete contact.');
    }
  };

  if (loading && contacts.length === 0) {
    return <LoadingSpinner message="Loading contact book..." />;
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
              <Icon icon={FiUsers} className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Contact Book</h1>
              <p className="text-sm text-gray-500">Helpers, translators, drivers, suppliers, and other useful contacts.</p>
            </div>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
        >
          <Icon icon={FiPlus} className="h-4 w-4" />
          Add Contact
        </button>
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px_auto]">
        <label className="relative block">
          <Icon icon={FiSearch} className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, role, phone, email, language, notes..."
            className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-gray-400 focus:outline-none"
          />
        </label>
        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          className="rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
        >
          <option value="">All roles</option>
          {roleOptions.map((role) => (
            <option key={role} value={role}>{roleLabel(role)}</option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
            className="rounded border-gray-300"
          />
          Include inactive
        </label>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(roleCounts).map(([role, count]) => (
          <button
            key={role}
            type="button"
            onClick={() => setRoleFilter(roleFilter === role ? '' : role)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              roleFilter === role ? 'border-gray-800 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {roleLabel(role)} {count}
          </button>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white lg:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Contact</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Languages</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Notes</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {contacts.map((contact) => (
              <tr key={contact._id} className={contact.isActive === false ? 'bg-gray-50 text-gray-500' : 'hover:bg-gray-50'}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{contact.name}</div>
                  <div className="text-xs text-gray-500">{[contact.organization, contact.location].filter(Boolean).join(' - ')}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">{roleLabel(contact.role)}</span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {contact.phone ? <a className="text-gray-800 underline-offset-2 hover:underline" href={`tel:${contact.phone}`}>{contact.phone}</a> : '-'}
                  {contact.whatsapp && <div className="text-xs text-gray-500">WA: {contact.whatsapp}</div>}
                </td>
                <td className="px-4 py-3 text-sm">
                  {contact.email ? <a className="text-gray-800 underline-offset-2 hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a> : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{joinList(contact.languages) || '-'}</td>
                <td className="max-w-xs px-4 py-3 text-sm text-gray-600">
                  <div className="line-clamp-2">{contact.notes || joinList(contact.tags) || '-'}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openEdit(contact)} className="icon-action-btn icon-action-btn-edit" title="Edit contact">
                      <Icon icon={FiEdit2} />
                    </button>
                    <button onClick={() => handleDelete(contact)} className="icon-action-btn icon-action-btn-delete" title="Delete contact">
                      <Icon icon={FiTrash2} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {contacts.length === 0 && <div className="px-4 py-10 text-center text-sm text-gray-500">No contacts found.</div>}
      </div>

      <div className="grid gap-3 lg:hidden">
        {contacts.map((contact) => (
          <div key={contact._id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-gray-900">{contact.name}</div>
                <div className="text-sm text-gray-600">{roleLabel(contact.role)}{contact.organization ? ` - ${contact.organization}` : ''}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(contact)} className="icon-action-btn icon-action-btn-edit" title="Edit contact">
                  <Icon icon={FiEdit2} />
                </button>
                <button onClick={() => handleDelete(contact)} className="icon-action-btn icon-action-btn-delete" title="Delete contact">
                  <Icon icon={FiTrash2} />
                </button>
              </div>
            </div>
            <div className="space-y-2 text-sm text-gray-700">
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-2">
                  <Icon icon={FiPhone} className="h-4 w-4 text-gray-400" />
                  {contact.phone}
                </a>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2">
                  <Icon icon={FiMail} className="h-4 w-4 text-gray-400" />
                  {contact.email}
                </a>
              )}
              {contact.location && (
                <div className="flex items-center gap-2">
                  <Icon icon={FiMapPin} className="h-4 w-4 text-gray-400" />
                  {contact.location}
                </div>
              )}
              {Boolean(contact.languages?.length) && <div>Languages: {joinList(contact.languages)}</div>}
              {contact.notes && <div className="rounded bg-gray-50 p-2 text-gray-600">{contact.notes}</div>}
            </div>
          </div>
        ))}
        {contacts.length === 0 && <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">No contacts found.</div>}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <form onSubmit={handleSubmit} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{editingContact ? 'Edit Contact' : 'Add Contact'}</h2>
              <button type="button" onClick={closeModal} className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100">Close</button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Name</span>
                <input name="name" value={formData.name || ''} onChange={handleInputChange} required className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Role</span>
                <input
                  name="role"
                  list="contact-book-role-options"
                  value={formData.role || ''}
                  onChange={handleInputChange}
                  required
                  placeholder="helper, translator, driver..."
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                />
                <datalist id="contact-book-role-options">
                  {roleOptions.map((role) => <option key={role} value={role} />)}
                </datalist>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Organization</span>
                <input name="organization" value={formData.organization || ''} onChange={handleInputChange} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Location</span>
                <input name="location" value={formData.location || ''} onChange={handleInputChange} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Phone</span>
                <input name="phone" value={formData.phone || ''} onChange={handleInputChange} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">WhatsApp</span>
                <input name="whatsapp" value={formData.whatsapp || ''} onChange={handleInputChange} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Email</span>
                <input name="email" type="email" value={formData.email || ''} onChange={handleInputChange} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Languages</span>
                <input name="languages" value={joinList(formData.languages)} onChange={handleInputChange} placeholder="EN, CZ, PL" className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm font-medium text-gray-700">Tags</span>
                <input name="tags" value={joinList(formData.tags)} onChange={handleInputChange} placeholder="urgent, Prague, ceremony" className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm font-medium text-gray-700">Notes</span>
                <textarea name="notes" value={formData.notes || ''} onChange={handleInputChange} rows={4} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" />
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="isActive" checked={formData.isActive !== false} onChange={handleInputChange} className="rounded border-gray-300" />
                Active
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeModal} className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="rounded-md border border-gray-900 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Contact'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ContactBookPage;
