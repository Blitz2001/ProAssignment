import React, { useState, useEffect } from 'react';
import { getRecentSubmissions, getWriters, assignWriter } from '../../services/api';
import { useSocket } from '../../context/SocketContext';

const AssignWriterModal = ({ submission, onClose, onSuccess }) => {
    const [writers, setWriters] = useState([]);
    const [selectedWriter, setSelectedWriter] = useState('');
    const [price, setPrice] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Fetch all writers to show status, but sort available ones to the top
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
                    <label htmlFor="writer" className="block text-sm font-medium text-gray-700">Writers</label>
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

const RecentSubmissions = ({ onNavigate }) => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const socket = useSocket();

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const response = await getRecentSubmissions();
      setSubmissions(response.data);
      setError(null);
    } catch (err) {
      setError("Failed to load recent submissions.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  // Socket listener for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleRefreshNewSubmissions = () => {
      fetchSubmissions();
    };

    const handleAssignmentCreated = (assignment) => {
      if (assignment.status === 'New') {
        setSubmissions(prev => {
          const exists = prev.some(s => s.id === assignment.id);
          if (!exists) {
            return [assignment, ...prev];
          }
          return prev;
        });
      }
    };

    const handleAssignmentUpdated = (assignment) => {
      if (assignment.status !== 'New') {
        setSubmissions(prev => prev.filter(s => s.id !== assignment.id));
      } else {
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
    fetchSubmissions();
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-full">
      {isModalOpen && selectedSubmission && (
        <AssignWriterModal 
            submission={selectedSubmission} 
            onClose={() => setIsModalOpen(false)}
            onSuccess={handleAssignSuccess}
        />
      )}
      <h3 className="text-lg font-semibold text-gray-800">Recent Submissions</h3>
      <p className="text-sm text-gray-500 mb-6">Assignments that need to be assigned</p>
      
      {loading && <div className="text-center text-gray-500">Loading...</div>}
      {error && <div className="text-center text-red-500">{error}</div>}
      
      {!loading && !error && (
        <>
          <div className="space-y-4">
            {submissions.length > 0 ? (
              submissions.slice(0, 3).map((submission) => (
                <div key={submission.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex justify-between items-start">
                    <div>
                        <h4 className="font-semibold text-gray-800">{submission.title}</h4>
                        <p className="text-sm text-gray-500">{submission.subject}</p>
                        <p className="text-sm text-gray-500 mt-1">
                        <span className="font-medium text-gray-600">Client:</span> {submission.studentName}
                        </p>
                    </div>
                    <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">New</span>
                    </div>
                    <div className="flex justify-between items-center mt-4">
                    <p className="text-sm text-gray-500">
                        <span className="font-medium">Deadline:</span> {new Date(submission.deadline).toLocaleDateString()}
                    </p>
                    <button 
                        onClick={() => {setSelectedSubmission(submission); setIsModalOpen(true);}}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        Assign Writer
                    </button>
                    </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">No new submissions.</p>
            )}
          </div>
          <div className="text-center mt-6">
            <button onClick={() => onNavigate('New Submissions')} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
                View All Submissions
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default RecentSubmissions;

