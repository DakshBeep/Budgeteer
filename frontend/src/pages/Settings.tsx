import { useState, useEffect } from 'react';
import { 
  BellIcon, 
  EnvelopeIcon, 
  ChartBarIcon,
  ClockIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';

interface UserPreferences {
  email_digest_frequency: string;
  notification_types: string[];
  insight_categories: string[];
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  peer_comparison_opt_in: boolean;
}

const Settings = () => {
  const { token } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>({
    email_digest_frequency: 'weekly',
    notification_types: ['in_app', 'email'],
    insight_categories: ['all'],
    quiet_hours_start: null,
    quiet_hours_end: null,
    peer_comparison_opt_in: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await fetch('http://localhost:8000/insights/preferences', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPreferences(data);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    setSaved(false);

    try {
      const response = await fetch('http://localhost:8000/insights/preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferences)
      });
      
      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationTypeToggle = (type: string) => {
    setPreferences(prev => ({
      ...prev,
      notification_types: prev.notification_types.includes(type)
        ? prev.notification_types.filter(t => t !== type)
        : [...prev.notification_types, type]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your notification preferences and insights settings
        </p>
      </div>

      <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
        {/* Email Digest Settings */}
        <div className="p-6">
          <div className="flex items-center mb-4">
            <EnvelopeIcon className="h-5 w-5 text-gray-400 mr-3" />
            <h2 className="text-lg font-medium text-gray-900">Email Digest</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Frequency
              </label>
              <select
                value={preferences.email_digest_frequency}
                onChange={(e) => setPreferences({ ...preferences, email_digest_frequency: e.target.value })}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="never">Never</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notification Types */}
        <div className="p-6">
          <div className="flex items-center mb-4">
            <BellIcon className="h-5 w-5 text-gray-400 mr-3" />
            <h2 className="text-lg font-medium text-gray-900">Notification Types</h2>
          </div>
          
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={preferences.notification_types.includes('in_app')}
                onChange={() => handleNotificationTypeToggle('in_app')}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="ml-3 text-sm text-gray-700">
                In-App Notifications
              </span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={preferences.notification_types.includes('email')}
                onChange={() => handleNotificationTypeToggle('email')}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="ml-3 text-sm text-gray-700">
                Email Notifications
              </span>
            </label>
          </div>
        </div>

        {/* Quiet Hours */}
        <div className="p-6">
          <div className="flex items-center mb-4">
            <ClockIcon className="h-5 w-5 text-gray-400 mr-3" />
            <h2 className="text-lg font-medium text-gray-900">Quiet Hours</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Start Time
              </label>
              <select
                value={preferences.quiet_hours_start || ''}
                onChange={(e) => setPreferences({ 
                  ...preferences, 
                  quiet_hours_start: e.target.value ? parseInt(e.target.value) : null 
                })}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="">No quiet hours</option>
                {[...Array(24)].map((_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i-12}:00 PM`}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">
                End Time
              </label>
              <select
                value={preferences.quiet_hours_end || ''}
                onChange={(e) => setPreferences({ 
                  ...preferences, 
                  quiet_hours_end: e.target.value ? parseInt(e.target.value) : null 
                })}
                disabled={preferences.quiet_hours_start === null}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md disabled:bg-gray-100"
              >
                <option value="">No quiet hours</option>
                {[...Array(24)].map((_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i-12}:00 PM`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {preferences.quiet_hours_start !== null && preferences.quiet_hours_end !== null && (
            <p className="mt-2 text-sm text-gray-500">
              You won't receive notifications between {
                preferences.quiet_hours_start === 0 ? '12:00 AM' : 
                preferences.quiet_hours_start < 12 ? `${preferences.quiet_hours_start}:00 AM` : 
                preferences.quiet_hours_start === 12 ? '12:00 PM' : 
                `${preferences.quiet_hours_start-12}:00 PM`
              } and {
                preferences.quiet_hours_end === 0 ? '12:00 AM' : 
                preferences.quiet_hours_end < 12 ? `${preferences.quiet_hours_end}:00 AM` : 
                preferences.quiet_hours_end === 12 ? '12:00 PM' : 
                `${preferences.quiet_hours_end-12}:00 PM`
              }
            </p>
          )}
        </div>

        {/* Peer Comparison */}
        <div className="p-6">
          <div className="flex items-center mb-4">
            <ChartBarIcon className="h-5 w-5 text-gray-400 mr-3" />
            <h2 className="text-lg font-medium text-gray-900">Privacy</h2>
          </div>
          
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={preferences.peer_comparison_opt_in}
              onChange={(e) => setPreferences({ 
                ...preferences, 
                peer_comparison_opt_in: e.target.checked 
              })}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <span className="ml-3">
              <span className="text-sm text-gray-700">
                Include me in anonymous peer comparisons
              </span>
              <p className="text-xs text-gray-500 mt-1">
                Your data will be anonymized and aggregated with other users for comparison insights
              </p>
            </span>
          </label>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-6 flex items-center justify-end">
        {saved && (
          <div className="mr-4 flex items-center text-green-600">
            <CheckIcon className="h-5 w-5 mr-2" />
            <span className="text-sm">Saved successfully</span>
          </div>
        )}
        
        <button
          onClick={savePreferences}
          disabled={saving}
          className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
            saving
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
          }`}
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
};

export default Settings;