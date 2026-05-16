// pages/Settings/Settings.jsx — profile, password, notifications, preferences persisted via API
import { useEffect, useState } from 'react';
import {
  User,
  Lock,
  Bell,
  Globe,
  Palette,
  Save,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader/PageHeader';
import toast from 'react-hot-toast';

const Settings = () => {
  const { user, updateProfile, changePassword } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);

  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    position: '',
    bio: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurPwd, setShowCurPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfPwd, setShowConfPwd] = useState(false);

  const [notificationPrefs, setNotificationPrefs] = useState({
    emailNotifications: true,
    taskReminders: true,
    systemUpdates: false
  });

  const [appPreferences, setAppPreferences] = useState({
    timezone: 'America/New_York',
    language: 'en',
    dateFormat: 'DD-MM-YYYY',
    appearance: 'light'
  });

  useEffect(() => {
    if (!user) return;
    const prof = user.settings?.profile || {};
    setProfileData({
      name: user.name || '',
      email: user.email || '',
      phone: prof.phone ?? '',
      company: prof.company ?? '',
      position: prof.position ?? '',
      bio: prof.bio ?? ''
    });
    const n = user.settings?.notifications || {};
    setNotificationPrefs({
      emailNotifications: n.emailNotifications !== false,
      taskReminders: n.taskReminders !== false,
      systemUpdates: n.systemUpdates === true
    });
    const p = user.settings?.preferences || {};
    setAppPreferences({
      timezone: p.timezone || 'America/New_York',
      language: p.language || 'en',
      dateFormat: p.dateFormat || 'DD-MM-YYYY',
      appearance: p.appearance || 'light'
    });
  }, [user]);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'preferences', label: 'Preferences', icon: Globe }
  ];

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await updateProfile({
        name: profileData.name.trim(),
        email: profileData.email.trim(),
        phone: profileData.phone,
        company: profileData.company,
        position: profileData.position,
        bio: profileData.bio
      });
    } catch {
      /* toast in context */
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    try {
      setLoading(true);
      await changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch {
      /* toast in context */
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationSave = async (e) => {
    e?.preventDefault?.();
    try {
      setLoading(true);
      await updateProfile({
        notifications: {
          emailNotifications: notificationPrefs.emailNotifications,
          taskReminders: notificationPrefs.taskReminders,
          systemUpdates: notificationPrefs.systemUpdates
        }
      });
    } catch {
      /* toast in context */
    } finally {
      setLoading(false);
    }
  };

  const handlePreferencesSave = async (e) => {
    e?.preventDefault?.();
    try {
      setLoading(true);
      await updateProfile({
        preferences: {
          timezone: appPreferences.timezone,
          language: appPreferences.language,
          dateFormat: appPreferences.dateFormat,
          appearance: appPreferences.appearance
        }
      });
    } catch {
      /* toast in context */
    } finally {
      setLoading(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-6">
              <div className="w-24 h-24 bg-emerald-600 rounded-full flex items-center justify-center">
                <span className="text-white text-2xl font-bold">
                  {user?.name
                    ? user.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 3)
                    : '?'}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Avatar</h3>
                <p className="text-sm text-gray-500">
                  Initials from your name. Organisation:{' '}
                  <span className="font-medium text-gray-700">
                    {user?.organisation_id || 'Not set'}
                  </span>
                </p>
              </div>
            </div>

            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full name
                  </label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) =>
                      setProfileData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Your full name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) =>
                      setProfileData((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="you@company.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) =>
                      setProfileData((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    placeholder="+44 … or local number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company / site
                  </label>
                  <input
                    type="text"
                    value={profileData.company}
                    onChange={(e) =>
                      setProfileData((prev) => ({ ...prev, company: e.target.value }))
                    }
                    placeholder="Company or division name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role / position
                  </label>
                  <input
                    type="text"
                    value={profileData.position}
                    onChange={(e) =>
                      setProfileData((prev) => ({ ...prev, position: e.target.value }))
                    }
                    placeholder="Job title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                <textarea
                  value={profileData.bio}
                  onChange={(e) =>
                    setProfileData((prev) => ({ ...prev, bio: e.target.value }))
                  }
                  rows={4}
                  placeholder="Optional note for your team (not shown publicly)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{loading ? 'Saving…' : 'Save profile'}</span>
                </button>
              </div>
            </form>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Password</h3>
            <form onSubmit={handlePasswordChange} className="space-y-4 max-w-xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current password
                </label>
                <div className="relative max-w-xl">
                  <input
                    type={showCurPwd ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData((prev) => ({
                        ...prev,
                        currentPassword: e.target.value
                      }))
                    }
                    placeholder="Enter your current password"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-500 hover:text-gray-700"
                    onClick={() => setShowCurPwd((v) => !v)}
                    aria-label={showCurPwd ? 'Hide password' : 'Show password'}
                  >
                    {showCurPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPwd ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={passwordData.newPassword}
                      onChange={(e) =>
                        setPasswordData((prev) => ({
                          ...prev,
                          newPassword: e.target.value
                        }))
                      }
                      placeholder="At least 6 characters"
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-500 hover:text-gray-700"
                      onClick={() => setShowNewPwd((v) => !v)}
                      aria-label={showNewPwd ? 'Hide password' : 'Show password'}
                    >
                      {showNewPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm new password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfPwd ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={passwordData.confirmPassword}
                      onChange={(e) =>
                        setPasswordData((prev) => ({
                          ...prev,
                          confirmPassword: e.target.value
                        }))
                      }
                      placeholder="Repeat new password"
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-500 hover:text-gray-700"
                      onClick={() => setShowConfPwd((v) => !v)}
                      aria-label={showConfPwd ? 'Hide password' : 'Show password'}
                    >
                      {showConfPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center space-x-2"
              >
                <Lock className="w-4 h-4" />
                <span>{loading ? 'Updating…' : 'Update password'}</span>
              </button>
            </form>
          </div>
        );

      case 'notifications':
        return (
          <form onSubmit={handleNotificationSave} className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            <p className="text-sm text-gray-500">
              These choices are saved to your account. Email delivery depends on server
              configuration.
            </p>
            <div className="space-y-4">
              {[
                {
                  key: 'emailNotifications',
                  title: 'Email notifications',
                  desc: 'Product updates & summaries by email'
                },
                {
                  key: 'taskReminders',
                  title: 'Task reminders',
                  desc: 'Reminders for assigned tasks'
                },
                {
                  key: 'systemUpdates',
                  title: 'System updates',
                  desc: 'Maintenance and release notes'
                }
              ].map(({ key, title, desc }) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900">{title}</h4>
                    <p className="text-sm text-gray-500">{desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={notificationPrefs[key]}
                      onChange={(e) =>
                        setNotificationPrefs((prev) => ({
                          ...prev,
                          [key]: e.target.checked
                        }))
                      }
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 relative" />
                  </label>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? 'Saving…' : 'Save notification settings'}</span>
              </button>
            </div>
          </form>
        );

      case 'preferences':
        return (
          <form onSubmit={handlePreferencesSave} className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Regional & display</h3>

            <div className="space-y-4 max-w-xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time zone
                </label>
                <select
                  value={appPreferences.timezone}
                  onChange={(e) =>
                    setAppPreferences((prev) => ({ ...prev, timezone: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="UTC">UTC</option>
                  <option value="Europe/London">Europe / London</option>
                  <option value="America/New_York">US Eastern</option>
                  <option value="America/Chicago">US Central</option>
                  <option value="America/Denver">US Mountain</option>
                  <option value="America/Los_Angeles">US Pacific</option>
                  <option value="Asia/Dubai">Asia / Dubai</option>
                  <option value="Asia/Kolkata">Asia / India</option>
                  <option value="Asia/Singapore">Asia / Singapore</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Language
                </label>
                <select
                  value={appPreferences.language}
                  onChange={(e) =>
                    setAppPreferences((prev) => ({ ...prev, language: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date format
                </label>
                <select
                  value={appPreferences.dateFormat}
                  onChange={(e) =>
                    setAppPreferences((prev) => ({ ...prev, dateFormat: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <Palette className="w-4 h-4" />
                  Appearance
                </label>
                <select
                  value={appPreferences.appearance}
                  onChange={(e) =>
                    setAppPreferences((prev) => ({ ...prev, appearance: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark (saved; full theme coming soon)</option>
                  <option value="system">Match system</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? 'Saving…' : 'Save preferences'}</span>
              </button>
            </div>
          </form>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        breadcrumb={[
          { label: 'App', href: '/' },
          { label: 'Settings' }
        ]}
      />

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b">
          <nav className="flex space-x-8 px-6 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">{renderTabContent()}</div>
      </div>
    </div>
  );
};

export default Settings;
