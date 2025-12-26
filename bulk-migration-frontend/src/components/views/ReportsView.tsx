import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  CheckCircle,
  AlertCircle,
  Loader,
  RefreshCw,
  Download,
  RotateCcw,
  XCircle
} from 'lucide-react';
import { api } from '../../services/api';
import type { Migration, MigrationDetails, MigrationResult, MigrationLog } from '../../types';

type ViewType = 'dashboard' | 'connections' | 'migrations' | 'reports';

interface MigrationListItemProps {
  migration: Migration;
  selected: boolean;
  onClick: () => void;
}

const MigrationListItem: React.FC<MigrationListItemProps> = ({
  migration,
  selected,
  onClick
}) => {
  const statusConfig = {
    completed: { icon: CheckCircle, color: 'text-green-600', label: 'Completed' },
    failed: { icon: AlertCircle, color: 'text-red-600', label: 'Failed' },
    running: { icon: Loader, color: 'text-blue-600', label: 'Running' },
    pending: { icon: AlertCircle, color: 'text-orange-600', label: 'Pending' }
  };

  const config = statusConfig[migration.status];
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg transition-colors ${
        selected
          ? 'bg-blue-50 border-2 border-blue-500'
          : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${config.color} ${migration.status === 'running' ? 'animate-spin' : ''}`} />
        <span className="text-sm font-medium text-slate-800">
          {config.label}
        </span>
      </div>
      <p className="text-xs text-slate-600">
        {new Date(migration.created_at).toLocaleDateString()}
      </p>
    </button>
  );
};

interface MigrationLogsProps {
  logs: MigrationLog[];
}

const MigrationLogs: React.FC<MigrationLogsProps> = ({ logs }) => (
  <div className="bg-white rounded-lg shadow-sm border border-slate-200">
    <div className="p-6 border-b border-slate-200">
      <h3 className="text-lg font-bold text-slate-800">Migration Logs</h3>
    </div>
    <div className="p-6 max-h-96 overflow-y-auto">
      <div className="space-y-2">
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg"
          >
            <div
              className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                log.level === 'error'
                  ? 'bg-red-500'
                  : log.level === 'warning'
                  ? 'bg-orange-500'
                  : 'bg-blue-500'
              }`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-slate-800 text-sm truncate">
                  {log.collection_name}
                </span>
                <span className="text-xs text-slate-500 flex-shrink-0">
                  {new Date(log.created_at).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm text-slate-600 break-words">{log.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

interface ReportsViewProps {
  migrations: Migration[];
  onNavigate: (view: ViewType) => void;
  onRefresh: () => void;
  error: string | null;
  onClearError: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  migrations,
  onNavigate,
  onRefresh,
  error,
  onClearError
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<MigrationDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Auto-select first migration
  useEffect(() => {
    if (migrations.length > 0 && !selectedId) {
      setSelectedId(migrations[0].id);
    }
  }, [migrations, selectedId]);

  // Load migration details
  const loadDetails = useCallback(async (id: string) => {
    setLoading(true);
    setLocalError(null);
    try {
      const data = await api.getMigration(id);
      setDetails(data);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to load migration details');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadDetails(selectedId);
    }
  }, [selectedId, loadDetails]);

  const handleExport = async () => {
    if (!selectedId) return;

    try {
      const blob = await api.exportReport(selectedId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `migration-report-${selectedId}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to export report');
    }
  };

  const handleRollback = async () => {
    if (!selectedId) return;

    if (!window.confirm('Are you sure you want to rollback this migration? This action cannot be undone.')) {
      return;
    }

    try {
      await api.rollbackMigration(selectedId);
      alert('Rollback initiated successfully');
      onRefresh();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to rollback migration');
    }
  };

  // Empty state
  if (migrations.length === 0) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-slate-200">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-800 mb-2">
            No migrations executed yet
          </h3>
          <p className="text-slate-600 mb-6">
            Execute a migration to see the report here
          </p>
          <button
            onClick={() => onNavigate('migrations')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Migrations
          </button>
        </div>
      </div>
    );
  }

  // Parse result safely
  const parsedResult: MigrationResult[] = details?.result
    ? (() => {
        try {
          return JSON.parse(details.result);
        } catch {
          return [];
        }
      })()
    : [];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Migration Reports</h2>
          <p className="text-slate-600">View details and results from your migrations</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRollback}
            disabled={!details || details.status !== 'completed'}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            Rollback
          </button>
          <button
            onClick={handleExport}
            disabled={!selectedId}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Export Report
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {(error || localError) && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700">
            <XCircle className="w-5 h-5" />
            <span>{error || localError}</span>
          </div>
          <button 
            onClick={() => { onClearError(); setLocalError(null); }} 
            className="text-red-700 hover:text-red-800"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-6">
        {/* Migration List */}
        <div className="col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Recent Migrations</h3>
            <div className="space-y-2">
              {migrations.map((migration) => (
                <MigrationListItem
                  key={migration.id}
                  migration={migration}
                  selected={selectedId === migration.id}
                  onClick={() => setSelectedId(migration.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Details Panel */}
        <div className="col-span-3 space-y-6">
          {loading ? (
            <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-slate-200">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-600">Loading migration details...</p>
            </div>
          ) : details ? (
            <>
              {/* Summary Card */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
                <div className="grid grid-cols-4 gap-6">
                  <div>
                    <p className="text-slate-600 text-sm mb-1">Status</p>
                    <div className="flex items-center gap-2">
                      {details.status === 'completed' && (
                        <>
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <span className="text-lg font-semibold text-green-600">Success</span>
                        </>
                      )}
                      {details.status === 'failed' && (
                        <>
                          <AlertCircle className="w-5 h-5 text-red-600" />
                          <span className="text-lg font-semibold text-red-600">Failed</span>
                        </>
                      )}
                      {details.status === 'running' && (
                        <>
                          <Loader className="w-5 h-5 text-blue-600 animate-spin" />
                          <span className="text-lg font-semibold text-blue-600">Running</span>
                        </>
                      )}
                      {details.status === 'pending' && (
                        <>
                          <AlertCircle className="w-5 h-5 text-orange-600" />
                          <span className="text-lg font-semibold text-orange-600">Pending</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-slate-600 text-sm mb-1">Duration</p>
                    <p className="text-lg font-semibold text-slate-800">
                      {details.duration_ms
                        ? `${(details.duration_ms / 1000).toFixed(2)}s`
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600 text-sm mb-1">Started At</p>
                    <p className="text-lg font-semibold text-slate-800">
                      {new Date(details.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Collection Results */}
              {parsedResult.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800">Collection Details</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                            Collection
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                            Rule
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                            Rows Migrated
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedResult.map((col, idx) => (
                          <tr key={idx} className="border-b border-slate-100">
                            <td className="px-6 py-4 font-medium text-slate-800">
                              {col.collection}
                            </td>
                            <td className="px-6 py-4 text-slate-600 capitalize">
                              {col.rule}
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                              {col.rowsMigrated?.toLocaleString() ?? '-'}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                                  col.status === 'success'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {col.status === 'success' ? (
                                  <CheckCircle className="w-4 h-4" />
                                ) : (
                                  <AlertCircle className="w-4 h-4" />
                                )}
                                {col.status === 'success' ? 'Success' : 'Failed'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Logs */}
              {details.logs && details.logs.length > 0 && (
                <MigrationLogs logs={details.logs} />
              )}

              {/* Error Message */}
              {details.error_message && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-6 h-6 text-red-600 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="text-lg font-semibold text-red-800 mb-2">
                        Migration Failed
                      </h4>
                      <p className="text-red-700">{details.error_message}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-slate-200">
              <p className="text-slate-600">Select a migration to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsView;