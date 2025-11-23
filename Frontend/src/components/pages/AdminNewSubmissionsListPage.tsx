import React, { useState, useEffect } from 'react';
import { Submission, Writer } from '../../types';
import { useSocket } from '../../context/SocketContext';
// FIX: Corrected the import path for the API service.
import { getRecentSubmissions, getWriters, assignWriter } from '../../services/api';

const AssignWriterModal: React.FC<{
    submission: Submission;
    onClose: () => void;
    onSuccess: () => void;
}> = ({ submission, onClose, onSuccess }) => {
    const [writers, setWriters] = useState<Writer[]>([]);
    const [selectedWriter, setSelectedWriter] = useState<string>('');
    const [price, setPrice] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        getWriters({}).then(res => {
            const sortedWriters = res.data.sort((a, b) => {
                if (a.status === 'Available' && b.status !== 'Available') return -1;
                if (a.status !== 'Available' && b.status === 'Available') return 1;
                return 0;
            });
            setWriters(sortedWriters);
            const firstAvailable = sortedWriters.find(w => w.status === 'Available');
            if (firstAvailable) {
                setSelectedWriter(firstAvailable.id);
            }
        });
    }, []);

    const handleSubmit = async () => {
        if (!selectedWriter || price <= 0) return;
        setIsLoading(true);
        try {
            await assignWriter(submission.id, selectedWriter, price);
            onSuccess();
        } catch (error) {
            console.error("Failed to assign writer", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-medium">Assign Writer for "{submission.title}"</h3>
                <div className="mt-4">
                    <label htmlFor="writer" className="block text-sm font-medium text-gray-700">Available Writers</label>
                    <select id="writer" value={selectedWriter} onChange={e => setSelectedWriter(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                        {writers.map(w => <option key={w.id} value={w.id} disabled={w.status !== 'Available'} className={w.status !== 'Available' ? 'text-gray-400' : ''}>
                            {w.name} - {w.specialty} ({w.status})
                        </option>)}
                    </select>
                </div>
                <div className="mt-4">
                    <label htmlFor="price" className="block text-sm font-medium text-gray-700">Writer Payment ($)</label>
                    <input 
                        type="number" 
                        id="price" 
                        value={price} 
                        onChange={e => setPrice(Number(e.target.value))}
                        className="mt-1 block w-full pl-3 pr-4 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        placeholder="e.g., 50"
                        min="0"
                    />
                </div>
                <div className="mt-6 flex justify-end space-x-4">
                    <button onClick={onClose} className="border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-50">Cancel</button>
                    <button onClick={handleSubmit} disabled={isLoading || !selectedWriter || price <= 0} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm disabled:bg-indigo-300 hover:bg-indigo-700">
                        {isLoading ? 'Assigning...' : 'Assign'}
                    </button>
                </div>
            </div>
        </div>
    );
};


const AdminNewSubmissionsListPage: React.FC = () => {
  const socket = useSocket();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const response = await getRecentSubmissions(); // This gets all new submissions
      setSubmissions(response.data);
      setError(null);
    } catch (err) {
      setError("Failed to load new submissions.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  // Socket listener for new submissions and updates
  useEffect(() => {
    if (!socket) return;

    const handleRefreshNewSubmissions = () => {
      fetchSubmissions();
    };

    const handleAssignmentCreated = (assignment: Submission) => {
      // If it's a new submission (status: 'New'), add it to the list
      if (assignment.status === 'New') {
        setSubmissions(prev => {
          // Check if it already exists
          const exists = prev.some(s => s.id === assignment.id);
          if (!exists) {
            return [assignment, ...prev];
          }
          return prev;
        });
      }
    };

    const handleAssignmentUpdated = (assignment: Submission) => {
      // If assignment status changed from 'New', remove it from the list
      if (assignment.status !== 'New') {
        setSubmissions(prev => prev.filter(s => s.id !== assignment.id));
      } else {
        // Update if it's still new
        setSubmissions(prev => {
          const index = prev.findIndex(s => s.id === assignment.id);
          if (index !== -1) {
            const updated = [...prev];
            updated[index] = assignment;
            return updated;
          }
          return prev;
        });
      }
    };

    socket.on('refreshNewSubmissions', handleRefreshNewSubmissions);
    socket.on('assignmentCreated', handleAssignmentCreated);
    socket.on('assignmentUpdated', handleAssignmentUpdated);

    return () => {
      socket.off('refreshNewSubmissions', handleRefreshNewSubmissions);
      socket.off('assignmentCreated', handleAssignmentCreated);
      socket.off('assignmentUpdated', handleAssignmentUpdated);
    };
  }, [socket]);

  const handleAssignSuccess = () => {
    setIsModalOpen(false);
    setSelectedSubmission(null);
    fetchSubmissions(); // Re-fetch to update the list
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-lg shadow-sm border border-gray-200">
        {isModalOpen && selectedSubmission && (
            <AssignWriterModal
                submission={selectedSubmission}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleAssignSuccess}
            />
        )}
        <h2 className="text-2xl font-bold text-gray-800 mb-6">New Submissions</h2>

        {loading && <div className="text-center text-gray-500 py-8">Loading...</div>}
        {error && <div className="text-center text-red-500 py-8">{error}</div>}

        {!loading && !error && (
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deadline</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {submissions.length > 0 ? (
                            submissions.map(submission => (
                                <tr key={submission.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{submission.title}</div>
                                        <div className="text-sm text-gray-500">{submission.subject}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{submission.studentName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(submission.deadline).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                            {submission.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                                        <button
                                            onClick={() => { setSelectedSubmission(submission); setIsModalOpen(true); }}
                                            className="text-indigo-600 hover:text-indigo-900"
                                        >
                                            Assign Writer
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5} className="text-center text-gray-500 py-8">No new submissions to assign.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        )}
    </div>
  );
};

export default AdminNewSubmissionsListPage;