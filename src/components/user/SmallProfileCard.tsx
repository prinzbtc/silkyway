import { FC } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { CountrySelectValue } from '@/types/country';
import Link from 'next/link';

interface SmallProfileCardProps {
  id: string;
  username: string;
  avatar?: string | null;
  location?: CountrySelectValue | null;
}

const SmallProfileCard: FC<SmallProfileCardProps> = ({ 
  id, 
  username, 
  avatar, 
  location 
}) => {
  return (
    <Link 
      href={`/users/${id}`}
      className="block"
    >
      <div 
        className="flex items-center space-x-4 bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
      >
        {/* Profile Picture */}
        <div className="flex-shrink-0">
          <Avatar>
            <AvatarImage 
              src={avatar || '/default-avatar.png'} 
              alt={`${username}'s profile picture`} 
            />
            <AvatarFallback>{username?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        </div>

        {/* User Info */}
        <div className="flex-grow">
          <h3 className="text-sm font-semibold text-gray-800">{username}</h3>
          {location && (
            <div className="flex items-center text-xs text-gray-500 mt-1">
              <span>{location.flag}</span>
              <span className="ml-1">{location.label}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default SmallProfileCard;
