import React from 'react';
import { Layout, Settings, ArrowRight, FileText, BookTemplate, type LucideIcon } from 'lucide-react';


type ViewType = 'dashboard' | 'connections' | 'migrations' | 'reports' | 'rule-presets';

interface NavItemConfig {
  icon: LucideIcon;
  label: string;
  view: ViewType;
}

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
      active
        ? 'bg-slate-700 text-white'
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`}
  >
    <Icon className="w-5 h-5" />
    <span>{label}</span>
  </button>
);

interface NavigationProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentView, onViewChange }) => {
  const navItems: NavItemConfig[] = [
    { icon: Layout, label: 'Dashboard', view: 'dashboard' },
    { icon: Settings, label: 'Connections', view: 'connections' },
      { icon: BookTemplate, label: 'Rule Presets', view: 'rule-presets' }, // NOVO
    { icon: ArrowRight, label: 'Migrations', view: 'migrations' },
    { icon: FileText, label: 'Reports', view: 'reports' }
  ];

  return (
    <div className="w-64 bg-slate-900 text-white h-screen flex flex-col">
      <div className="p-4 border-b border-slate-700 flex items-center gap-3">
        <img src="/logo.png" alt="Bulk Logo" className="w-8 h-8" />
        <h1 className="text-xl font-bold">Bulk Migration</h1>
      </div>

      <nav className="flex-1 p-4">
        {navItems.map((item) => (
          <NavItem
            key={item.view}
            icon={item.icon}
            label={item.label}
            active={currentView === item.view}
            onClick={() => onViewChange(item.view)}
          />
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <p className="text-xs text-slate-500 text-center">
          Bulk Migration v0.1.0
        </p>
      </div>
    </div>
  );
};

export default Navigation;