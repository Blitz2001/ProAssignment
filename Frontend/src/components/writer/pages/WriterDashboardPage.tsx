import React, { useState, useEffect } from 'react';
import { getWriterAssignments, getWriterPaysheets, getNotificationsForUser } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { Page, Notification } from '../../../types';
import StatCard from '../../dashboard/StatCard';

interface WriterDashboardPageProps {
    setPage: (page: Page) => void;
}

const WriterDashboardPage: React.FC<WriterDashboardPageProps> = ({ setPage }) => {
    const { user } = useAuth();
    const [stats, setStats] = useState({ active: 0, completed: 0, earnings: 0 });
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [notificationsLoading, setNotificationsLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const [assignmentsRes, paysheetsRes] = await Promise.all([
                    getWriterAssignments({ status: 'All' }),
                    getWriterPaysheets(user.id)
                ]);
                
                const activeAssignments = assignmentsRes.data.filter(a => a.status === 'In Progress' || a.status === 'Revision').length;
                const completedThisMonth = assignmentsRes.data.filter(a => (a.status === 'Completed' || a.status === 'Paid' || a.status === 'Pending Payment') && new Date(a.deadline).getMonth() === new Date().getMonth()).length;

                const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                const currentMonthName = monthNames[new Date().getMonth()];
                const currentYear = new Date().getFullYear().toString();
                
                // Handle new response format (object with individualPayments and monthlyTotals)
                // or old format (array of paysheets)
                let earningsThisMonth = 0;
                
                if (paysheetsRes.data && typeof paysheetsRes.data === 'object' && !Array.isArray(paysheetsRes.data)) {
                    // New format: object with individualPayments and monthlyTotals
                    const individualPayments = (paysheetsRes.data as any).individualPayments || [];
                    earningsThisMonth = individualPayments
                        .filter((p: any) => {
                            const period = p.period || '';
                            return period.startsWith(currentMonthName) && 
                                   period.endsWith(currentYear) && 
                                   p.paymentStatus === 'Paid';
                        })
                        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
                } else {
                    // Old format: array of paysheets
                    const paysheets = Array.isArray(paysheetsRes.data) ? paysheetsRes.data : [];
                    earningsThisMonth = paysheets
                        .filter((p: any) => {
                            const period = p.period || '';
                            return period.startsWith(currentMonthName) && 
                                   period.endsWith(currentYear) && 
                                   p.status === 'Paid';
                        })
                        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
                }

                setStats({ active: activeAssignments, completed: completedThisMonth, earnings: earningsThisMonth });

            } catch (error) {
                console.error("Failed to fetch writer dashboard data", error);
            } finally {
                setLoading(false);
            }
        };

        const fetchNotifications = async () => {
            setNotificationsLoading(true);
            try {
                if(user?.id) {
                    const res = await getNotificationsForUser(user.id);
                    setNotifications(res.data);
                }
            } catch (error) {
                console.error("Failed to fetch notifications:", error);
            } finally {
                setNotificationsLoading(false);
            }
        };

        fetchData();
        fetchNotifications();
    }, [user]);


    if (loading) {
        return <p>Loading dashboard...</p>;
    }

    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-800">Welcome, {user?.name}!</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard title="Active Assignments" value={stats.active.toString()} details="Currently in progress" iconType="clock" linkTo="My Assignments" onNavigate={setPage} />
                <StatCard title="Completed This Month" value={stats.completed.toString()} details="Successfully delivered" iconType="check" linkTo="My Assignments" onNavigate={setPage} />
                <StatCard title="Earnings This Month" value={`$${stats.earnings.toFixed(2)}`} details="Payments received" iconType="document" linkTo="My Paysheets" onNavigate={setPage} />
            </div>
             <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Recent Notifications</h3>
                {notificationsLoading ? (
                    <p className="text-gray-500">Loading notifications...</p>
                ) : notifications.length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                        {notifications.slice(0, 5).map(notif => (
                            <div key={notif.id} className={`p-3 rounded-md border ${!notif.read ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'}`}>
                                <p className="text-sm text-gray-800">{notif.message}</p>
                                <p className="text-xs text-gray-500 mt-1">{new Date(notif.timestamp).toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500">No new notifications.</p>
                )}
            </div>
        </div>
    );
};

export default WriterDashboardPage;
