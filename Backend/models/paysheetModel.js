import mongoose from 'mongoose';

const paysheetSchema = mongoose.Schema({
    writer: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    type: { 
        type: String, 
        enum: ['writer', 'admin'], 
        default: 'writer' 
    }, // 'writer' for writer paysheets, 'admin' for admin commission/profit paysheets
    period: { type: String, required: true },
    amount: { type: Number, required: true },
    status: {
        type: String,
        required: true,
        enum: ['Paid', 'Pending', 'Due'],
        default: 'Pending'
    },
    assignments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' }],
    proofUrl: { type: String },
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

const Paysheet = mongoose.model('Paysheet', paysheetSchema);

export default Paysheet;
