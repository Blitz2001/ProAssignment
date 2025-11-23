import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
    name: { type: String, required: true },
    path: { type: String, required: true },
}, { _id: false });

const assignmentSchema = mongoose.Schema({
    title: { type: String, required: true },
    subject: { type: String, required: true },
    description: { type: String },
    student: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    writer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deadline: { type: Date, required: true },
    status: {
        type: String,
        required: true,
        enum: ['New', 'Price Set', 'Price Accepted', 'Price Rejected', 'Payment Pending', 'Payment Proof Submitted', 'In Progress', 'Completed', 'Admin Approved', 'Revision', 'Paid'],
        default: 'New',
    },
    clientPrice: { type: Number, default: 0 }, // Price shown to client
    writerPrice: { type: Number, default: 0 }, // Price shown to writer (hidden from client)
    clientAcceptedPrice: { type: Boolean, default: false }, // Client acceptance status
    progress: { type: Number, default: 0 },
    attachments: [fileSchema], // Original files from client
    completedFiles: [fileSchema], // Completed files from writer
    turnitinRequested: { type: Boolean, default: false },
    reportStatus: {
        type: String,
        enum: ['requested', 'sent_to_writer', 'writer_submitted', 'sent_to_user', 'completed'],
        default: null
    },
    reportFile: {
        name: { type: String },
        path: { type: String },
    },
    paysheet: { type: mongoose.Schema.Types.ObjectId, ref: 'Paysheet' },
    rating: { type: Number, min: 1, max: 5 },
    feedback: { type: String }, // Client feedback/comment
    paymentProof: {
        name: { type: String },
        path: { type: String },
    },
    paymentMethod: {
        type: String,
        enum: ['Bank', 'Card'],
        default: null
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed'],
        default: 'Pending'
    },
    paymentReferenceId: { type: String }, // PayHere payment reference ID for card payments
    adminApproved: { type: Boolean, default: false }, // Admin approval of writer's work
    completedAt: { type: Date }, // Timestamp when assignment was completed
}, {
    timestamps: true,
    toJSON: {
        transform(doc, ret) {
            ret.id = ret._id;
            delete ret._id;
            delete ret.__v;
        }
    }
});

const Assignment = mongoose.model('Assignment', assignmentSchema);

export default Assignment;