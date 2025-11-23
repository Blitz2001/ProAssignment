import React, { useState, useCallback } from 'react';
import UploadIcon from '../icons/UploadIcon';
import { createSubmission } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const NewSubmissionsPage = () => {
    const { user } = useAuth();
    const [title, setTitle] = useState('');
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [deadline, setDeadline] = useState('');
    const [files, setFiles] = useState([]);
    const [isDragOver, setIsDragOver] = useState(false);
    
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');

    const handleFileChange = (event) => {
        if (event.target.files) {
            setFiles(Array.from(event.target.files));
        }
    };

    const handleDrop = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(false);
        if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
            setFiles(Array.from(event.dataTransfer.files));
            event.dataTransfer.clearData();
        }
    }, []);

    const handleDragOver = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(false);
    }, []);
    
    const resetForm = () => {
        setTitle('');
        setSubject('');
        setDescription('');
        setDeadline('');
        setFiles([]);
    }

    const handleSubmit = async (event) => {
        event.preventDefault();
        setStatus('loading');
        setMessage('');

        if (!user) {
            setStatus('error');
            setMessage('You must be logged in to create a submission.');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('subject', subject);
        formData.append('description', description);
        formData.append('deadline', deadline);
        files.forEach(file => {
            formData.append('attachments', file);
        });

        try {
            await createSubmission(formData);
            setStatus('success');
            setMessage('Submission created successfully! An admin will review it shortly.');
            resetForm();
        } catch (error) {
            setStatus('error');
            const errorMessage = error.response?.data?.message || 
                                error.response?.data?.errors?.[0]?.msg ||
                                error.message || 
                                'Failed to create submission. Please try again.';
            setMessage(errorMessage);
            console.error('Submission error:', error.response?.data || error);
        }
    };
    
    return (
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Create New Submission</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="e.g., Research Paper on AI" required />
                </div>
                
                <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">Subject / Course</label>
                    <input type="text" id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="e.g., Computer Science" required />
                </div>
                
                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows="4" className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Describe your assignment requirements..." required />
                </div>
                
                <div>
                    <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                    <input type="date" id="deadline" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" required min={new Date().toISOString().split("T")[0]} />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700">Attachments</label>
                    <div 
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md transition-colors duration-200 ${isDragOver ? 'border-indigo-500 bg-indigo-50' : ''}`}
                    >
                        <div className="space-y-1 text-center">
                            <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
                            <div className="flex text-sm text-gray-600">
                                <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                    <span>Upload files</span>
                                    <input id="file-upload" name="files" type="file" className="sr-only" multiple onChange={handleFileChange} />
                                 </label>
                                <p className="pl-1">or drag and drop</p>
                            </div>
                            <p className="text-xs text-gray-500">PNG, JPG, PDF, DOCX, etc.</p>
                        </div>
                    </div>
                    {files.length > 0 && (
                        <div className="mt-4">
                            <h4 className="text-sm font-medium text-gray-700">Selected files:</h4>
                            <ul className="mt-2 list-disc list-inside text-sm text-gray-600 space-y-1">
                                {files.map((file, idx) => <li key={idx}>{file.name} <span className="text-gray-500">({(file.size / 1024).toFixed(2)} KB)</span></li>)}
                            </ul>
                        </div>
                    )}
                </div>

                {status !== 'idle' && message && (
                    <div className={`text-sm p-3 rounded-md ${status === 'success' ? 'bg-green-100 text-green-800' : ''} ${status === 'error' ? 'bg-red-100 text-red-800' : ''}`}>
                        {message}
                    </div>
                )}
                
                <div className="flex justify-end pt-2">
                    <button type="submit" className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400" disabled={status === 'loading'}>
                        {status === 'loading' ? 'Submitting...' : 'Create Submission'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default NewSubmissionsPage;
