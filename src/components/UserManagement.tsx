import React, { useState, useEffect } from 'react';
import { usersApi, User, CreateUserData, UpdateUserData } from '../services/usersApi';
import AppleButton from './AppleButton';
import AppleInput from './AppleInput';
import { FiPlus, FiEdit2, FiTrash2, FiCheck, FiX, FiUser, FiMail, FiLock, FiClock, FiKey } from 'react-icons/fi';

// Icon wrapper to fix TypeScript issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const ROLES = [
  { key: 'user', name: 'User', description: 'Basic user access', color: 'bg-blue-50 text-blue-700' },
  { key: 'facilitator', name: 'Facilitator', description: 'Retreat and operations staff', color: 'bg-green-50 text-green-700' },
  { key: 'helper', name: 'Helper', description: 'Current retreat EKG and blood pressure entry', color: 'bg-amber-50 text-amber-700' },
  { key: 'medical_staff', name: 'Medical Staff', description: 'Medical staff access', color: 'bg-purple-50 text-purple-700' },
  { key: 'medical_advisor', name: 'Medical Advisor', description: 'External medical review access', color: 'bg-indigo-50 text-indigo-700' },
  { key: 'admin', name: 'Administrator', description: 'Full system access', color: 'bg-red-50 text-red-700' },
] as const;

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resettingPasswordUser, setResettingPasswordUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);

  const [formData, setFormData] = useState<Partial<CreateUserData & { confirmPassword: string; isActive: boolean }>>({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user',
    firstName: '',
    lastName: ''
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const showError = (message: string) => {
    setError(message);
    setShowErrorModal(true);
  };

  const fetchUsers = async () => {
    try {
      const response = await usersApi.getAll();
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      showError('Error loading users. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      if (!formData.email || !formData.password) {
        showError('Please fill in all required fields');
        return;
      }

      const passwordError = validatePassword(formData.password);
      if (passwordError) {
        showError(passwordError);
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        showError('Passwords do not match');
        return;
      }

      const userData: CreateUserData = {
        email: formData.email,
        password: formData.password,
        role: formData.role as any,
        firstName: formData.firstName,
        lastName: formData.lastName
      };

      await usersApi.create(userData);
      await fetchUsers();
      setShowAddModal(false);
      resetForm();
    } catch (error: any) {
      console.error('Error creating user:', error);
      showError(error.response?.data?.message || 'Error creating user. Please try again.');
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      const updateData: UpdateUserData = {
        email: formData.email,
        role: formData.role as any,
        firstName: formData.firstName,
        lastName: formData.lastName,
        isActive: formData.isActive
      };

      await usersApi.update(editingUser._id, updateData);
      await fetchUsers();
      setEditingUser(null);
      resetForm();
    } catch (error: any) {
      console.error('Error updating user:', error);
      showError(error.response?.data?.message || 'Error updating user. Please try again.');
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (user.role === 'admin') {
      showError('Admin users cannot be deleted.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete user "${user.email}"?`)) {
      return;
    }

    try {
      await usersApi.delete(user._id);
      await fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      showError(error.response?.data?.message || 'Error deleting user. Please try again.');
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      role: user.role,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      isActive: user.isActive
    });
  };

  const handleResetPassword = (user: User) => {
    setResettingPasswordUser(user);
    setFormData({
      password: '',
      confirmPassword: ''
    });
  };

  const validatePassword = (password: string): string | null => {
    if (!password || password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handlePasswordReset = async () => {
    if (!resettingPasswordUser) return;

    try {
      if (!formData.password) {
        showError('Please enter a new password');
        return;
      }

      const passwordError = validatePassword(formData.password);
      if (passwordError) {
        showError(passwordError);
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        showError('Passwords do not match');
        return;
      }

      // Reset user password using the dedicated endpoint
      await usersApi.resetPassword(resettingPasswordUser._id, formData.password);

      await fetchUsers();
      setResettingPasswordUser(null);
      resetForm();
      showError('Password reset successfully!');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      showError(error.response?.data?.message || 'Error resetting password. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      role: 'user',
      firstName: '',
      lastName: '',
      isActive: true
    });
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = ROLES.find(r => r.key === role) || ROLES[0];
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleConfig.color}`}>
        {roleConfig.name}
      </span>
    );
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = (user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (user.firstName && user.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (user.lastName && user.lastName.toLowerCase().includes(searchTerm.toLowerCase())));

    const matchesRole = filterRole === 'all' || user.role === filterRole;

    return matchesSearch && matchesRole;
  });

  const getStats = () => {
    const stats = {
      total: users.length,
      active: users.filter(u => u.isActive).length,
      byRole: {} as Record<string, number>
    };

    ROLES.forEach(role => {
      stats.byRole[role.key] = users.filter(u => u.role === role.key).length;
    });

    return stats;
  };

  const stats = getStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">User Management</h1>
        <p className="text-gray-600">Manage system users and their roles and permissions.</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-sm font-medium text-gray-500">Total Users</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-sm font-medium text-gray-500">Active</div>
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
        </div>
        {ROLES.map(role => (
          <div key={role.key} className="bg-white rounded-lg shadow-sm border p-4">
            <div className="text-sm font-medium text-gray-500">{role.name}</div>
            <div className="text-2xl font-bold text-gray-900">{stats.byRole[role.key]}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <AppleInput
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(value) => setSearchTerm(value)}
              className="w-full sm:w-64"
              icon={<Icon icon={FiUser} className="w-4 h-4" />}
            />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Roles</option>
              {ROLES.map(role => (
                <option key={role.key} value={role.key}>{role.name}</option>
              ))}
            </select>
          </div>
          <AppleButton onClick={() => setShowAddModal(true)}>
            <Icon icon={FiPlus} className="w-4 h-4 mr-2" />
            Add User
          </AppleButton>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {(user.firstName?.[0] || user.email[0] || 'U').toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">
                          {user.firstName && user.lastName ?
                            `${user.firstName} ${user.lastName}` :
                            user.email}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center">
                          <Icon icon={FiMail} className="w-3 h-3 mr-1" />
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getRoleBadge(user.role)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <Icon icon={FiClock} className="w-3 h-3 mr-1" />
                      {user.lastLogin ?
                        new Date(user.lastLogin).toLocaleDateString() :
                        'Never'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit user"
                      >
                        <Icon icon={FiEdit2} className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleResetPassword(user)}
                        className="text-orange-600 hover:text-orange-900"
                        title="Reset password"
                      >
                        <Icon icon={FiKey} className="w-4 h-4" />
                      </button>
                      {user.role !== 'admin' && (
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete user"
                        >
                          <Icon icon={FiTrash2} className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Add New User</h2>
            <div className="space-y-4">
              <AppleInput
                label="Email *"
                type="email"
                value={formData.email || ''}
                onChange={(value) => setFormData({ ...formData, email: value })}
                placeholder="Enter email"
              />
              <div className="grid grid-cols-2 gap-4">
                <AppleInput
                  label="First Name"
                  type="text"
                  value={formData.firstName || ''}
                  onChange={(value) => setFormData({ ...formData, firstName: value })}
                  placeholder="First name"
                />
                <AppleInput
                  label="Last Name"
                  type="text"
                  value={formData.lastName || ''}
                  onChange={(value) => setFormData({ ...formData, lastName: value })}
                  placeholder="Last name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ROLES.map(role => (
                    <option key={role.key} value={role.key}>{role.name}</option>
                  ))}
                </select>
              </div>
              <AppleInput
                label="Password *"
                type="password"
                value={formData.password || ''}
                onChange={(value) => setFormData({ ...formData, password: value })}
                placeholder="Enter password"
              />
              <AppleInput
                label="Confirm Password *"
                type="password"
                value={formData.confirmPassword || ''}
                onChange={(value) => setFormData({ ...formData, confirmPassword: value })}
                placeholder="Confirm password"
              />
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <AppleButton
                variant="secondary"
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
              >
                <Icon icon={FiX} className="w-4 h-4 mr-2" />
                Cancel
              </AppleButton>
              <AppleButton
                onClick={handleCreateUser}
              >
                <Icon icon={FiCheck} className="w-4 h-4 mr-2" />
                Create User
              </AppleButton>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resettingPasswordUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Reset Password</h2>
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                Resetting password for: <strong>{resettingPasswordUser.email}</strong>
              </p>
              <p className="text-xs text-blue-600 mt-1">
                {resettingPasswordUser.email}
              </p>
            </div>
            <div className="space-y-4">
              <AppleInput
                label="New Password *"
                type="password"
                value={formData.password || ''}
                onChange={(value) => setFormData({ ...formData, password: value })}
                placeholder="Enter new password"
              />
              <AppleInput
                label="Confirm New Password *"
                type="password"
                value={formData.confirmPassword || ''}
                onChange={(value) => setFormData({ ...formData, confirmPassword: value })}
                placeholder="Confirm new password"
              />
              <div className="text-sm text-gray-500">
                <p>Password requirements:</p>
                <ul className="list-disc list-inside mt-1">
                  <li>At least 8 characters long</li>
                  <li>Contains at least one uppercase letter</li>
                  <li>Contains at least one number</li>
                </ul>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <AppleButton
                variant="secondary"
                onClick={() => {
                  setResettingPasswordUser(null);
                  resetForm();
                }}
              >
                <Icon icon={FiX} className="w-4 h-4 mr-2" />
                Cancel
              </AppleButton>
              <AppleButton
                onClick={handlePasswordReset}
              >
                <Icon icon={FiLock} className="w-4 h-4 mr-2" />
                Reset Password
              </AppleButton>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Edit User</h2>
            <div className="space-y-4">
              <AppleInput
                label="Email *"
                type="email"
                value={formData.email || ''}
                onChange={(value) => setFormData({ ...formData, email: value })}
                placeholder="Enter email"
              />
              <div className="grid grid-cols-2 gap-4">
                <AppleInput
                  label="First Name"
                  type="text"
                  value={formData.firstName || ''}
                  onChange={(value) => setFormData({ ...formData, firstName: value })}
                  placeholder="First name"
                />
                <AppleInput
                  label="Last Name"
                  type="text"
                  value={formData.lastName || ''}
                  onChange={(value) => setFormData({ ...formData, lastName: value })}
                  placeholder="Last name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={editingUser.role === 'admin'} // Prevent role change for admin
                >
                  {ROLES.map(role => (
                    <option key={role.key} value={role.key}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                  Active User
                </label>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <AppleButton
                variant="secondary"
                onClick={() => {
                  setEditingUser(null);
                  resetForm();
                }}
              >
                <Icon icon={FiX} className="w-4 h-4 mr-2" />
                Cancel
              </AppleButton>
              <AppleButton
                onClick={handleUpdateUser}
              >
                <Icon icon={FiCheck} className="w-4 h-4 mr-2" />
                Update User
              </AppleButton>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold mb-4">Notification</h2>
            <p className="text-gray-700 mb-6">{error}</p>
            <div className="flex justify-end">
              <AppleButton
                onClick={() => {
                  setShowErrorModal(false);
                  setError(null);
                }}
              >
                OK
              </AppleButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
