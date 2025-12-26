import React, { type HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  actions,
  children,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-slate-200 ${className}`}
      {...props}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            {title && <h3 className="text-lg font-bold text-slate-800">{title}</h3>}
            {subtitle && <p className="text-slate-600 text-sm">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};