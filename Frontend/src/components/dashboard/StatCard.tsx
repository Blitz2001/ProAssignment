import React from 'react';
import { IconProps } from '../icons/IconProps';
import { Page } from '../../types';

const DocumentIcon: React.FC<IconProps> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const ClockIcon: React.FC<IconProps> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const UsersIcon: React.FC<IconProps> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197m0 0A5.995 5.995 0 0012 12a5.995 5.995 0 00-3-5.197m-3 0A5.995 5.995 0 006 12a5.995 5.995 0 003 5.197" /></svg>;
const CheckIcon: React.FC<IconProps> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

const icons = {
  document: DocumentIcon,
  clock: ClockIcon,
  users: UsersIcon,
  check: CheckIcon,
};

interface StatCardProps {
  title: string;
  value: string;
  details: string;
  iconType: keyof typeof icons;
  linkTo: Page;
  onNavigate: (page: Page) => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, details, iconType, linkTo, onNavigate }) => {
  const Icon = icons[iconType];
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <Icon className="h-6 w-6 text-gray-400" />
      </div>
      <div className="mt-2">
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{details}</p>
      </div>
      <button
        onClick={() => onNavigate(linkTo)}
        className="text-sm font-medium text-indigo-600 hover:text-indigo-800 mt-4 self-start text-left"
      >
        View Details &rarr;
      </button>
    </div>
  );
};

export default StatCard;
