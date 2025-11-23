import React, { useEffect, useState } from 'react';
import StatCard from './StatCard';
import RecentSubmissions from './RecentSubmissions';
import UpcomingDeadlines from './UpcomingDeadlines';
import WriterPerformance from './WriterPerformance';
import Alerts from './Alerts';
// FIX: Corrected the import path for the API service.
import { getDashboardStats } from '../../services/api';
import { DashboardStats, Page } from '../../types';

interface DashboardProps {
    setPage: (page: Page) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ setPage }) => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                const response = await getDashboardStats();
                setStats(response.data);
            } catch (error) {
                console.error("Failed to fetch dashboard stats:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return <div className="text-center p-8">Loading dashboard data...</div>;
    }

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="New Submissions" value={stats?.newSubmissions.toString() ?? '0'} details="Waiting for assignment" iconType="document" linkTo="New Submissions" onNavigate={setPage} />
                <StatCard title="Active Assignments" value={stats?.activeAssignments.toString() ?? '0'} details="Currently in progress" iconType="clock" linkTo="Assignments" onNavigate={setPage} />
                <StatCard title="Writers Available" value={stats?.writersAvailable.toString() ?? '0'} details="Ready for new tasks" iconType="users" linkTo="Writers" onNavigate={setPage} />
                <StatCard title="Completed This Month" value={stats?.completedThisMonth.toString() ?? '0'} details="Successfully delivered" iconType="check" linkTo="Assignments" onNavigate={setPage} />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <RecentSubmissions onNavigate={setPage} />
                </div>
                <div className="lg:col-span-1">
                    <UpcomingDeadlines />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <WriterPerformance />
                </div>
                <div className="lg:col-span-1">
                    <Alerts />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
