import React, { useState, useEffect, useCallback } from 'react';
import { Play, AlertCircle, RefreshCw, XCircle, BookTemplate } from 'lucide-react';
import { api } from '../../services/api';
import type { Connection, Collection, MigrationRule, CollectionConfig, RulePreset } from '../../types';

type ViewType = 'dashboard' | 'connections' | 'migrations' | 'reports' | 'rule-presets';

interface MigrationRuleOption {
  value: MigrationRule;
  label: string;
}

const MIGRATION_RULES: MigrationRuleOption[] = [
  { value: 'schema', label: 'Schema only' },
  { value: 'overwrite', label: 'Overwrite (Truncate and Insert)' },
  { value: 'upsert', label: 'Upsert' },
  { value: 'ignore', label: 'Insert Ignore' }
];

interface MigrationsViewProps {
  connections: Connection[];
  selectedCollections: string[];
  globalRule: MigrationRule;
  onToggleCollection: (name: string) => void;
  onSelectAllCollections: (collections: Collection[]) => void;
  onClearCollections: () => void;
  onGlobalRuleChange: (rule: MigrationRule) => void;
  onMigrationComplete: () => void;
  onNavigate: (view: ViewType) => void;
  error: string | null;
  onClearError: () => void;
}

export const MigrationsView: React.FC<MigrationsViewProps> = ({
  connections,
  selectedCollections,
  globalRule,
  onToggleCollection,
  onSelectAllCollections,
  onClearCollections,
  onGlobalRuleChange,
  onMigrationComplete,
  onNavigate,
  error,
  onClearError
}) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [sourceConnectionId, setSourceConnectionId] = useState('');
  const [targetConnectionId, setTargetConnectionId] = useState('');
  const [collectionRules, setCollectionRules] = useState<Record<string, MigrationRule>>({});
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Rule Presets
  const [rulePresets, setRulePresets] = useState<RulePreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [presetApplied, setPresetApplied] = useState(false);

  const loadCollections = useCallback(async () => {
    if (!sourceConnectionId) {
      setCollections([]);
      return;
    }

    setLoading(true);
    setLocalError(null);
    try {
      const data = await api.getCollections(sourceConnectionId);
      setCollections(data);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  }, [sourceConnectionId]);

  // Carregar rule presets
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const data = await api.getRulePresets();
        console.log('Loaded presets:', data);
        
        // Garantir que rules é objeto
        const parsedPresets = data.map(p => {
          let rules = p.rules;
          if (typeof rules === 'string') {
            try {
              rules = JSON.parse(rules);
            } catch (e) {
              console.error('Failed to parse rules:', e);
              rules = {};
            }
          }
          return { ...p, rules: rules || {} };
        });
        
        setRulePresets(parsedPresets);
      } catch (err) {
        console.error('Failed to load rule presets:', err);
      }
    };
    loadPresets();
  }, []);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const handleExecute = async () => {
    if (!sourceConnectionId || !targetConnectionId) {
      setLocalError('Please select source and target connections');
      return;
    }

    if (selectedCollections.length === 0) {
      setLocalError('Please select at least one collection to migrate');
      return;
    }

    if (sourceConnectionId === targetConnectionId) {
      setLocalError('Source and target connections must be different');
      return;
    }

    setExecuting(true);
    setLocalError(null);

    try {
      const collectionsData: CollectionConfig[] = selectedCollections.map(name => ({
        name,
        rule: collectionRules[name] || globalRule
      }));

      const result = await api.executeMigration({
        sourceConnectionId,
        targetConnectionId,
        globalRule,
        collections: collectionsData
      });

      // Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const migration = await api.getMigration(result.migrationId);
          if (migration.status === 'completed' || migration.status === 'failed') {
            clearInterval(pollInterval);
            setExecuting(false);
            onMigrationComplete();
          }
        } catch {
          clearInterval(pollInterval);
          setExecuting(false);
        }
      }, 2000);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to execute migration');
      setExecuting(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectAllCollections(collections);
    } else {
      onClearCollections();
    }
  };

  const handleCollectionRuleChange = (name: string, rule: MigrationRule) => {
    setCollectionRules(prev => ({ ...prev, [name]: rule }));
  };

  // Aplicar preset
  const handleApplyPreset = async () => {
    if (!selectedPresetId) {
      setLocalError('Please select a preset');
      return;
    }
    
    const preset = rulePresets.find(p => p.id === selectedPresetId);
    if (!preset) {
      setLocalError('Preset not found');
      return;
    }
    
    console.log('Applying preset:', preset);
    
    // Aplicar as rules do preset
    setCollectionRules(preset.rules);
    
    // Selecionar automaticamente as tabelas que têm rules no preset
    const tablesToSelect = collections
      .filter(col => Object.keys(preset.rules).includes(col.name))
      .map(col => col.name);
    
    // Limpar seleção atual
    onClearCollections();
    
    // Selecionar as tabelas do preset
    tablesToSelect.forEach(tableName => {
      if (!selectedCollections.includes(tableName)) {
        onToggleCollection(tableName);
      }
    });
    
    setPresetApplied(true);
    setLocalError(null);
    
    // Scroll para a tabela de collections
    setTimeout(() => {
      const collectionsSection = document.querySelector('[data-section="collections"]');
      if (collectionsSection) {
        collectionsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const filteredCollections = collections.filter(col =>
    col.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Show message if not enough connections
  if (connections.length < 2) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-slate-200">
          <AlertCircle className="w-16 h-16 text-orange-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-800 mb-2">
            Two connections required
          </h3>
          <p className="text-slate-600 mb-6">
            Please configure at least two database connections before setting up migrations
          </p>
          <button
            onClick={() => onNavigate('connections')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Connections
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Migration Configuration</h2>
          <p className="text-slate-600">Select collections and configure migration rules</p>
        </div>
        <button
          onClick={handleExecute}
          disabled={selectedCollections.length === 0 || executing || !sourceConnectionId || !targetConnectionId}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {executing ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Play className="w-5 h-5" />
          )}
          {executing ? 'Executing...' : 'Execute Migration'}
        </button>
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

      {/* Connection Selection */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 mb-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Select Connections</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Source Connection
            </label>
            <select
              value={sourceConnectionId}
              onChange={(e) => {
                setSourceConnectionId(e.target.value);
                setPresetApplied(false);
              }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Select source...</option>
              {connections.map(conn => (
                <option key={conn.id} value={conn.id}>{conn.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Target Connection
            </label>
            <select
              value={targetConnectionId}
              onChange={(e) => setTargetConnectionId(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Select target...</option>
              {connections.map(conn => (
                <option key={conn.id} value={conn.id}>{conn.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Rule Preset Selector */}
      {rulePresets.length > 0 && sourceConnectionId && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 shadow-sm border-2 border-blue-200 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <BookTemplate className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-bold text-slate-800">Apply Rule Preset</h3>
          </div>
          <p className="text-slate-600 mb-4">
            Select a pre-configured set of migration rules to automatically configure your migration
          </p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <select
                value={selectedPresetId}
                onChange={(e) => {
                  setSelectedPresetId(e.target.value);
                  setPresetApplied(false);
                }}
                className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-base"
              >
                <option value="">Select a preset...</option>
                {rulePresets.map(preset => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name} ({Object.keys(preset.rules).length} tables)
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleApplyPreset}
              disabled={!selectedPresetId}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed font-medium"
            >
              Apply Preset
            </button>
          </div>
          {presetApplied && selectedPresetId && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700 font-medium">
                ✓ Preset applied successfully! Rules have been set for{' '}
                {Object.keys(rulePresets.find(p => p.id === selectedPresetId)?.rules || {}).length} tables.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Global Rule */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 mb-6">
        <h3 className="text-lg font-bold text-slate-800 mb-2">Global Rule</h3>
        <p className="text-slate-600 mb-4">Set a default migration rule for all collections</p>
        <div className="flex flex-wrap gap-3">
          {MIGRATION_RULES.map((rule) => (
            <button
              key={rule.value}
              onClick={() => onGlobalRuleChange(rule.value)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                globalRule === rule.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {rule.label}
            </button>
          ))}
        </div>
      </div>

      {/* Collections Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200" data-section="collections">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Collections</h3>
              <p className="text-slate-600 text-sm">
                Select collections and configure individual rules
                {selectedCollections.length > 0 && (
                  <span className="ml-2 text-blue-600 font-medium">
                    ({selectedCollections.length} selected)
                  </span>
                )}
              </p>
            </div>
            <input
              type="text"
              placeholder="Search collections..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-600">Loading collections...</p>
            </div>
          ) : collections.length === 0 ? (
            <div className="text-center py-12 text-slate-600">
              {sourceConnectionId
                ? 'No collections found in this database'
                : 'Select a source connection to view collections'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedCollections.length === collections.length && collections.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                      Collection Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                      Rows
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                      Migration Rule
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCollections.map((col) => (
                    <tr
                      key={col.name}
                      className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                        selectedCollections.includes(col.name) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedCollections.includes(col.name)}
                          onChange={() => onToggleCollection(col.name)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {col.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {col.description}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {col.rowCount?.toLocaleString() ?? '-'}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={collectionRules[col.name] || globalRule}
                          onChange={(e) => handleCollectionRuleChange(col.name, e.target.value as MigrationRule)}
                          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          {MIGRATION_RULES.map(r => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MigrationsView;