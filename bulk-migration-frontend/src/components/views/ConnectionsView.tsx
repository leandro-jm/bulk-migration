import React, { useState } from 'react';
import { Database, Plus, Trash2, Loader, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import type { Connection, ConnectionFormData } from '../../types';

interface ConnectionsViewProps {
  connections: Connection[];
  onAddConnection: (connection: Connection) => void;
  onRemoveConnection: (id: string) => void;
  error: string | null;
  onClearError: () => void;
}

const initialFormData: ConnectionFormData = {
  name: '',
  host: 'localhost',
  port: '5432',
  database: '',
  username: 'postgres',
  password: '',
  ssl: false,
  ssl_mode: 'prefer',
  reject_unauthorized: false
};

export const ConnectionsView: React.FC<ConnectionsViewProps> = ({
  connections,
  onAddConnection,
  onRemoveConnection,
  error,
  onClearError
}) => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<ConnectionFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const connection = await api.createConnection(formData);
      onAddConnection(connection);
      setShowForm(false);
      setFormData(initialFormData);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save connection');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setFormData(initialFormData);
    setFormError(null);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Database Connections</h2>
          <p className="text-slate-600">Manage your PostgreSQL database connections</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Connection
        </button>
      </div>

      {(error || formError) && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700">
            <XCircle className="w-5 h-5" />
            <span>{error || formError}</span>
          </div>
          <button onClick={() => { onClearError(); setFormError(null); }} className="text-red-700 hover:text-red-800">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {connections.length === 0 && !showForm && (
        <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-slate-200">
          <Database className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-800 mb-2">
            No connections configured
          </h3>
          <p className="text-slate-600 mb-6">
            Add your first database connection to get started
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Connection
          </button>
        </div>
      )}

{connections.map((conn) => (
  <div key={conn.id} className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 mb-4">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <h3 className="text-lg font-semibold text-slate-800">{conn.name}</h3>
          {conn.ssl && (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium flex items-center gap-1">
              🔒 SSL
            </span>
          )}
        </div>
        <p className="text-sm text-slate-600">
          {conn.host}:{conn.port}/{conn.database}
        </p>
        {conn.ssl && (
          <p className="text-xs text-slate-500 mt-1">
            SSL Mode: {conn.ssl_mode || 'prefer'} | 
            Certificate Verification: {conn.reject_unauthorized ? 'Enabled' : 'Disabled'}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm flex items-center gap-1">
          <CheckCircle className="w-4 h-4" />
          Connected
        </span>
        <button
          onClick={() => onRemoveConnection(conn.id)}
          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  </div>
))}

      {showForm && (
        <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-xl font-bold text-slate-800 mb-4">New Database Connection</h3>
          <p className="text-slate-600 mb-6">Enter your PostgreSQL database credentials</p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Connection Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Production DB"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Host *
              </label>
              <input
                type="text"
                name="host"
                value={formData.host}
                onChange={handleInputChange}
                placeholder="localhost"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Port *
              </label>
              <input
                type="text"
                name="port"
                value={formData.port}
                onChange={handleInputChange}
                placeholder="5432"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Database Name *
              </label>
              <input
                type="text"
                name="database"
                value={formData.database}
                onChange={handleInputChange}
                placeholder="myapp_db"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Username *
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="postgres"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Password *
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="••••••••"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2 border-t border-slate-200 pt-4 mt-4">
  <h4 className="text-sm font-semibold text-slate-700 mb-3">SSL Configuration</h4>
  <p className="text-xs text-slate-500 mb-4">
    Enable SSL for cloud databases (AWS RDS, Azure Database, Google Cloud SQL, etc.)
  </p>
  
  <div className="space-y-4">
    {/* Enable SSL */}
    <div className="flex items-center gap-3">
      <input
        type="checkbox"
        id="ssl"
        checked={formData.ssl || false}
        onChange={(e) => setFormData({...formData, ssl: e.target.checked})}
        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
      />
      <label htmlFor="ssl" className="text-sm font-medium text-slate-700">
        Enable SSL/TLS Connection
      </label>
    </div>

    {formData.ssl && (
      <>
        {/* SSL Mode */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            SSL Mode
          </label>
          <select
            value={formData.ssl_mode || 'prefer'}
            onChange={(e) => setFormData({
              ...formData, 
              ssl_mode: e.target.value as 'disable' | 'require' | 'prefer'
            })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="prefer">Prefer (recommended)</option>
            <option value="require">Require (force SSL)</option>
            <option value="disable">Disable</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">
            AWS RDS and most cloud providers require SSL
          </p>
        </div>

        {/* Reject Unauthorized */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="reject_unauthorized"
            checked={formData.reject_unauthorized || false}
            onChange={(e) => setFormData({
              ...formData, 
              reject_unauthorized: e.target.checked
            })}
            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 mt-0.5"
          />
          <div>
            <label htmlFor="reject_unauthorized" className="text-sm font-medium text-slate-700">
              Verify SSL Certificate
            </label>
            <p className="text-xs text-slate-500 mt-1">
              Disable for self-signed certificates or development environments
            </p>
          </div>
        </div>

        {/* SSL Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-700">
            <strong>💡 Tip:</strong> For AWS RDS, Azure Database, and Google Cloud SQL, 
            keep SSL enabled with mode "prefer" and certificate verification disabled.
          </p>
        </div>
      </>
    )}
  </div>
</div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 flex items-center gap-2"
            >
              {saving && <Loader className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save Connection'}
            </button>
            <button
              onClick={handleCancel}
              className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionsView;