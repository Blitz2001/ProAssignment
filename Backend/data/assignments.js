const assignments = [
    { title: 'Research Paper on AI', subject: 'Computer Science', deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), status: 'New', price: 50 },
    { title: 'History of Ancient Rome', subject: 'History', deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), status: 'New', price: 40 },
    { title: 'Marketing Strategy Analysis', subject: 'Business', deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), status: 'In Progress', writerName: 'John Smith', progress: 75, price: 75 },
    { title: 'Literary Review of "1984"', subject: 'Literature', deadline: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), status: 'Completed', writerName: 'Sarah Johnson', progress: 100, completedFiles: [{name: 'review.pdf', path: 'uploads/sample-review.pdf'}], turnitinRequested: true, price: 60 },
    { title: 'Quantum Physics Problem Set', subject: 'Physics', deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), status: 'Payment Pending', writerName: 'John Smith', progress: 100, completedFiles: [{name: 'problems.pdf', path: 'uploads/sample-problems.pdf'}], price: 90 },
    { title: 'Climate Change Report', subject: 'Environmental Science', deadline: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), status: 'Paid', writerName: 'Sarah Johnson', progress: 100, completedFiles: [{name: 'report.pdf', path: 'uploads/sample-report.pdf'}], price: 85, rating: 4 },
];

export default assignments;