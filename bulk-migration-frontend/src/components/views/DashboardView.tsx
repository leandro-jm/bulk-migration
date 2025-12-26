import React from 'react';
import { Database, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import type { Connection, Stats } from '../../types';

type ViewType = 'dashboard' | 'connections' | 'rule-presets' | 'migrations' | 'reports';

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'orange';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color }) => {
  const colorStyles = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    orange: 'bg-orange-100 text-orange-600'
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <span className="text-slate-600 text-sm">{label}</span>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorStyles[color]}`}>
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold text-slate-800">{value}</div>
    </div>
  );
};

interface QuickStartStepProps {
  number: number;
  title: string;
  description: string;
  buttonText: string;
  onClick: () => void;
  enabled: boolean;
}

const QuickStartStep: React.FC<QuickStartStepProps> = ({
  number,
  title,
  description,
  buttonText,
  onClick,
  enabled
}) => (
  <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
    <div className="flex items-start gap-4">
      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
        {number}
      </div>
      <div>
        <h4 className="font-semibold text-slate-800">{title}</h4>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
    </div>
    <button
      onClick={onClick}
      disabled={!enabled}
      className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
        enabled
          ? 'bg-blue-600 text-white hover:bg-blue-700'
          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
      }`}
    >
      {buttonText}
      <ArrowRight className="w-4 h-4" />
    </button>
  </div>
);

interface DashboardViewProps {
  connections: Connection[];
  stats: Stats;
  onNavigate: (view: ViewType) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  connections,
  stats,
  onNavigate
}) => {
  const statCards: StatCardProps[] = [
    {
      label: 'Active Connections',
      value: connections.length,
      icon: <Database className="w-6 h-6" />,
      color: 'blue'
    },
    {
      label: 'Completed Migrations',
      value: stats.completed,
      icon: <CheckCircle className="w-6 h-6" />,
      color: 'green'
    },
    {
      label: 'Pending Migrations',
      value: stats.running,
      icon: <AlertCircle className="w-6 h-6" />,
      color: 'orange'
    }
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800 mb-2">
          Database Migration Manager
        </h2>
        <p className="text-slate-600">
          Manage and execute database migrations between environments
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        {statCards.map((stat, idx) => (
          <StatCard key={idx} {...stat} />
        ))}
      </div>

      <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
        <h3 className="text-xl font-bold text-slate-800 mb-4">Quick Start</h3>
        <p className="text-slate-600 mb-6">
          Get started by setting up your database connections
        </p>

        <div className="space-y-4">
          <QuickStartStep
            number={1}
            title="Configure Database Connections"
            description="Add your staging and production database connections"
            buttonText="Setup"
            onClick={() => onNavigate('connections')}
            enabled={true}
          />
          <QuickStartStep
            number={2}
            title="Add Rule Presets"
            description="Configure migration rules for your data"
            buttonText="Configure"
            onClick={() => onNavigate('rule-presets')}
            enabled={connections.length >= 2}
          />
          <QuickStartStep
            number={3}
            title="Select Collections to Migrate"
            description="Choose which tables and collections to migrate"
            buttonText="Configure"
            onClick={() => onNavigate('migrations')}
            enabled={connections.length >= 2}
          />
          <QuickStartStep
            number={4}
            title="Execute Migration"
            description="Run the migration with your configured rules"
            buttonText="Execute"
            onClick={() => onNavigate('migrations')}
            enabled={connections.length >= 2}
          />
        </div>
      </div>
    </div>
  );
};

export default DashboardView;