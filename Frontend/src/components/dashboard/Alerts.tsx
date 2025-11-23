import React, { useState, useEffect } from 'react';
import { Alert } from '../../types';
import { LateSubmissionIcon, ClientFeedbackIcon, WriterAvailabilityIcon } from '../icons/AlertIcons';
// FIX: Corrected the import path for the API service.
import { getAlerts } from '../../services/api';

const alertConfig = {
    late: {
        icon: LateSubmissionIcon,
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        iconColor: 'text-red-500',
        titleColor: 'text-red-800'
    },
    feedback: {
        icon: ClientFeedbackIcon,
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        iconColor: 'text-yellow-500',
        titleColor: 'text-yellow-800'
    },
    availability: {
        icon: WriterAvailabilityIcon,
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        iconColor: 'text-blue-500',
        titleColor: 'text-blue-800'
    }
}

const AlertItem: React.FC<{ alert: Alert }> = ({ alert }) => {
    const config = alertConfig[alert.type];
    const Icon = config.icon;

    return (
        <div className={`p-4 rounded-lg border flex items-start space-x-4 ${config.bgColor} ${config.borderColor}`}>
            <div className={`flex-shrink-0 mt-1`}>
                <Icon className={`w-6 h-6 ${config.iconColor}`} />
            </div>
            <div>
                <h4 className={`font-semibold ${config.titleColor}`}>{alert.title}</h4>
                <p className="text-sm text-gray-600">{alert.details}</p>
            </div>
        </div>
    );
}

const Alerts: React.FC = () => {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAlerts = async () => {
            try {
                setLoading(true);
                const response = await getAlerts();
                setAlerts(response.data);
                setError(null);
            } catch (err) {
                setError("Failed to load alerts.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchAlerts();
    }, []);

    return (
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 h-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-6">Alerts</h3>
             {loading && <div className="text-center text-gray-500">Loading...</div>}
             {error && <div className="text-center text-red-500">{error}</div>}
             {!loading && !error && (
                <div className="space-y-4">
                    {alerts.length > 0 ? (
                        alerts.map((alert) => (
                            <AlertItem key={alert.id} alert={alert} />
                        ))
                    ) : (
                         <p className="text-center text-gray-500">No new alerts.</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default Alerts;
