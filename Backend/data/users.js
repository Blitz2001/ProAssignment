// Real user data - Update these with your actual user information
// Passwords will be automatically hashed before saving to database
const users = [
    {
        name: 'Administrator',
        email: 'admin@assminttake.com',
        password: 'AdminSecure123!', // This will be hashed automatically
        role: 'admin',
        avatar: 'https://i.pravatar.cc/150?u=admin@assminttake.com'
    },
    {
        name: 'John Smith',
        email: 'john.smith@assminttake.com',
        password: 'WriterPass123!',
        role: 'writer',
        avatar: 'https://i.pravatar.cc/150?u=john.smith@assminttake.com',
        specialty: 'Business & Marketing',
        rating: 4.8,
        completed: 15,
        status: 'Available'
    },
    {
        name: 'Sarah Johnson',
        email: 'sarah.johnson@assminttake.com',
        password: 'WriterPass123!',
        role: 'writer',
        avatar: 'https://i.pravatar.cc/150?u=sarah.johnson@assminttake.com',
        specialty: 'Humanities & Arts',
        rating: 4.6,
        completed: 12,
        status: 'Available'
    },
    {
        name: 'Michael Chen',
        email: 'michael.chen@assminttake.com',
        password: 'WriterPass123!',
        role: 'writer',
        avatar: 'https://i.pravatar.cc/150?u=michael.chen@assminttake.com',
        specialty: 'STEM',
        rating: 4.9,
        completed: 20,
        status: 'Available'
    },
    {
        name: 'Emily Davis',
        email: 'emily.davis@assminttake.com',
        password: 'ClientPass123!',
        role: 'user',
        avatar: 'https://i.pravatar.cc/150?u=emily.davis@assminttake.com'
    },
];

export default users;
