// backend/src/models/User.ts - Fix the interface
import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  collegeName: string;
  role: 'student' | 'teacher' | 'admin';
  studentId?: string;
  department?: string;
  logoUrl?: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  
  comparePassword(candidatePassword: string): Promise<boolean>;
  toObject(): any; // Add this to fix toObject error
}

const UserSchema: Schema = new Schema({
  email: { 
    type: String, 
    required: [true, "Email is required"], 
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: { 
    type: String, 
    required: [true, "Password is required"],
    minlength: [6, "Password must be at least 6 characters"],
    select: false // Don't include password by default in queries
  },
  name: { 
    type: String, 
    required: [true, "Name is required"],
    trim: true 
  },
  collegeName: { 
    type: String, 
    required: [true, "College name is required"] 
  },
  role: { 
    type: String, 
    required: true, 
    enum: ['student', 'teacher', 'admin'],
    default: 'student'
  },
  studentId: { type: String },
  department: { type: String },
  logoUrl: { type: String },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date }
}, {
  timestamps: true
});

// Add comparePassword method
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<IUser>('User', UserSchema);