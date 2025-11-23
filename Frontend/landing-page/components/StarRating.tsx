import React from 'react';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
}

const StarRating: React.FC<StarRatingProps> = ({ rating, maxRating = 5 }) => {
  const stars = [];
  for (let i = 1; i <= maxRating; i++) {
    stars.push(
      <svg
        key={i}
        className={`w-4 h-4 ${ // Slightly smaller stars for density
          i <= rating ? 'text-yellow-500' : 'text-gray-400' // Brighter yellow for active, medium grey for inactive stars
        } fill-current`}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
      >
        <path d="M10 15.27L16.18 19l-1.64-7.03L20 7.24l-7.19-.61L10 0 7.19 6.63 0 7.24l5.46 4.73L3.82 19z" />
      </svg>
    );
  }

  return <div className="flex">{stars}</div>;
};

export default StarRating;