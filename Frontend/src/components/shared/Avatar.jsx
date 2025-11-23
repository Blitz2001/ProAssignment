import React from 'react';

const getInitials = (name) => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length > 1 && names[names.length - 1]) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name[0].toUpperCase();
};

const Avatar = ({ user, className = 'h-10 w-10', onClick }) => {
    const baseClasses = onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : '';
    
    if (user?.avatar) {
        return (
            <img 
                className={`${className} rounded-full object-cover ${baseClasses}`} 
                src={user.avatar} 
                alt={user.name}
                onClick={onClick}
            />
        );
    }

    const initials = getInitials(user?.name);
    // Simple hashing for a consistent color
    const charCodeSum = (user?.name || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
        'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 
        'bg-teal-500', 'bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500'
    ];
    const color = colors[charCodeSum % colors.length];

    return (
        <div 
            className={`${className} rounded-full flex items-center justify-center text-white font-bold ${color} ${baseClasses}`}
            onClick={onClick}
        >
            <span>{initials}</span>
        </div>
    );
};

export default Avatar;

