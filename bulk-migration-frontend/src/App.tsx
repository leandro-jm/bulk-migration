import React, { useState, useEffect, useCallback } from 'react';
import { Navigation } from './components/layout/Navigation';
import { DashboardView } from './components/views/DashboardView';
import { ConnectionsView } from './components/views/ConnectionsView';
import { RulePresetsView } from './components/views/RulePresetsView';
import { MigrationsView } from './components/views/MigrationsView';
import { ReportsView } from './components/views/ReportsView';
import { api } from './services/api';
import type { 
  Connection, 
  Migration, 
  Stats, 
  MigrationRule,
  Collection 
} from './types';

type ViewType = 'dashboard' | 'connections' | 'migrations' | 'reports'| 'rule-presets';

export interface AppState {
  currentView: ViewType;
  connections: Connection[];
  migrations: Migration[];
  stats: Stats;
  selectedCollections: string[];
  globalRule: MigrationRule;
  loading: boolean;
  error: string | null;
}

const App: React.FC = () => {
  // State
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, completed: 0, failed: 0, running: 0 });
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [globalRule, setGlobalRule] = useState<MigrationRule>('overwrite');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [connectionsData, statsData, migrationsData] = await Promise.all([
        api.getConnections(),
        api.getStats(),
        api.getMigrations()
      ]);
      setConnections(connectionsData);
      setStats(statsData);
      setMigrations(migrationsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Connection handlers
  const handleAddConnection = async (connection: Connection) => {
    setConnections(prev => [...prev, connection]);
  };

  const handleRemoveConnection = async (id: string) => {
    try {
      await api.deleteConnection(id);
      setConnections(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete connection');
    }
  };

  // Collection handlers
  const handleToggleCollection = (name: string) => {
    setSelectedCollections(prev =>
      prev.includes(name)
        ? prev.filter(c => c !== name)
        : [...prev, name]
    );
  };

  const handleSelectAllCollections = (collections: Collection[]) => {
    setSelectedCollections(collections.map(c => c.name));
  };

  const handleClearCollections = () => {
    setSelectedCollections([]);
  };

  // Migration handlers
  const handleMigrationComplete = () => {
    loadInitialData();
    setCurrentView('reports');
  };

  // Clear error
  const handleClearError = () => {
    setError(null);
  };

  // Render current view
  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <DashboardView
            connections={connections}
            stats={stats}
            onNavigate={setCurrentView}
          />
        );
      case 'connections':
        return (
          <ConnectionsView
            connections={connections}
            onAddConnection={handleAddConnection}
            onRemoveConnection={handleRemoveConnection}
            error={error}
            onClearError={handleClearError}
          />
        );
      case 'rule-presets':
        return <RulePresetsView />;

      case 'migrations':
        return (
          <MigrationsView
            connections={connections}
            selectedCollections={selectedCollections}
            globalRule={globalRule}
            onToggleCollection={handleToggleCollection}
            onSelectAllCollections={handleSelectAllCollections}
            onClearCollections={handleClearCollections}
            onGlobalRuleChange={setGlobalRule}
            onMigrationComplete={handleMigrationComplete}
            onNavigate={setCurrentView}
            error={error}
            onClearError={handleClearError}
          />
        );
      case 'reports':
        return (
          <ReportsView
            migrations={migrations}
            onNavigate={setCurrentView}
            onRefresh={loadInitialData}
            error={error}
            onClearError={handleClearError}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Navigation 
        currentView={currentView} 
        onViewChange={setCurrentView} 
      />
      <main className="flex-1 overflow-y-auto">
        {loading && currentView === 'dashboard' ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-600">Loading...</p>
            </div>
          </div>
        ) : (
          renderView()
        )}
      </main>
    </div>
  );
};

export default App;