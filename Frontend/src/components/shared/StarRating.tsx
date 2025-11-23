import React, { useState } from 'react';
import StarIcon from '../icons/StarIcon';

interface StarRatingProps {
    rating: number;
    onRate?: (rating: number) => void;
    readOnly?: boolean;
    className?: string;
}

const StarRating: React.FC<StarRatingProps> = ({ rating, onRate, readOnly = false, className }) => {
    const [hoverRating, setHoverRating] = useState(0);

    return (
        <div className={`flex items-center space-x-1 ${className}`}>
            {[1, 2, 3, 4, 5].map((star) => (
                // FIX: Wrap StarIcon in a span and move event handlers to it to fix props error.
                <span
                    key={star}
                    className={!readOnly ? 'cursor-pointer' : ''}
                    onClick={() => !readOnly && onRate && onRate(star)}
                    onMouseEnter={() => !readOnly && setHoverRating(star)}
                    onMouseLeave={() => !readOnly && setHoverRating(0)}
                >
                    <StarIcon
                        className={`h-5 w-5 transition-colors ${
                            (hoverRating || rating) >= star ? 'text-yellow-400' : 'text-gray-300'
                        }`}
                    />
                </span>
            ))}
        </div>
    );
};

export default StarRating;
