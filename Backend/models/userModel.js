import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        required: true,
        enum: ['admin', 'writer', 'user'],
        default: 'user',
    },
    avatar: {
        type: String,
    },
    // Writer-specific fields
    specialty: {
        type: String,
    },
    rating: {
        type: Number,
        default: 0,
    },
    completed: {
        type: Number,
        default: 0,
    },
    status: {
        type: String,
        enum: ['Available', 'Busy', 'On Vacation'],
        default: 'Available',
    },
}, {
    timestamps: true,
    toJSON: {
        transform(doc, ret) {
            ret.id = ret._id;
            delete ret._id;
            delete ret.__v;
            delete ret.password;
        }
    }
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
    if (!this.password || !enteredPassword) {
        return false;
    }
    
    if (typeof enteredPassword !== 'string') {
        return false;
    }
    
    // Ensure stored password is hashed
    if (!this.password.startsWith('$2')) {
        console.error('matchPassword: Stored password is NOT hashed!');
        return false;
    }
    
    try {
        const trimmedPassword = enteredPassword.trim();
        const result = await bcrypt.compare(trimmedPassword, this.password);
        return result;
    } catch (error) {
        console.error('matchPassword: Error comparing passwords:', error);
        return false;
    }
};

// Encrypt password using bcrypt
userSchema.pre('save', async function (next) {
    // Only hash password if it's a new document or password has been modified
    if (!this.isModified('password')) {
        console.log('   Pre-save: Password not modified, skipping hash');
        return next();
    }
    
    // If password is already hashed, skip hashing
    if (this.password && this.password.startsWith('$2')) {
        console.log('   Pre-save: Password already hashed, skipping');
        return next();
    }
    
    // Ensure password exists and is a string
    if (!this.password || typeof this.password !== 'string') {
        console.error('   Pre-save: Password is missing or not a string');
        return next(new Error('Password is required and must be a string'));
    }
    
    // Trim password before hashing
    const trimmedPassword = this.password.trim();
    if (!trimmedPassword || trimmedPassword.length === 0) {
        console.error('   Pre-save: Password is empty after trimming');
        return next(new Error('Password cannot be empty'));
    }
    
    console.log(`   Pre-save: Hashing password (length: ${trimmedPassword.length})`);
    
    // Hash the password before saving
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(trimmedPassword, salt);
        this.password = hashedPassword;
        console.log(`   Pre-save: Password hashed successfully (hash starts with: ${hashedPassword.substring(0, 10)})`);
        
        // Verify the hash immediately
        const testCompare = await bcrypt.compare(trimmedPassword, hashedPassword);
        if (!testCompare) {
            console.error('   Pre-save: CRITICAL - Hash verification failed immediately after creation!');
            return next(new Error('Password hash verification failed'));
        }
        console.log('   Pre-save: Hash verification passed ✓');
        
        next();
    } catch (error) {
        console.error('   Pre-save: Error hashing password:', error);
        return next(error);
    }
});

const User = mongoose.model('User', userSchema);

export default User;
