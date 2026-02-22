import mongoose, { Schema, Document } from "mongoose";

interface IIssue {
  id: string;
  type: string;
  severity: string;
  description: string;
  suggestion: string;
  context: string;
  originalText?: string;
  correctedText?: string;
  pageNumber: number;
  position?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  isFixed: boolean;
}

export interface IAnalysis extends Document {
  analysisId: string;
  userId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileData?: Buffer;
  formatType?: string; // NEW: 'default' or 'custom'
  formatRequirements?: string; // NEW: Custom format specifications
  uploadDate: Date;
  score: number;
  issues: IIssue[];
  summary: string;
  status: string;
  processedContent?: string; // NEW: Extracted text/HTML for the editor
  correctedContent?: string; // NEW: Auto-corrected content
  metadata?: {
    company?: string;
    date?: string;
    type?: string;
  };
  images?: {
    page: number;
    category: string;
    title: string;
    filename: string;
  }[];
  analyzedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AnalysisSchema: Schema = new Schema({
  analysisId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: [false, "User ID is required"],
    index: true
  },
  fileName: {
    type: String,
    required: [true, "File name is required"],
    trim: true
  },
  fileSize: {
    type: Number
  },
  fileType: {
    type: String,
    required: [true, "File type is required"]
  },
  fileData: {
    type: Buffer,
    select: false
  },
  // NEW: Format customization fields
  formatType: {
    type: String,
    enum: ['default', 'custom', 'professional', 'academic', 'legal', 'creative', 'resume', 'concept', 'report'],
    default: 'default'
  },
  formatRequirements: {
    type: String,
    default: ''
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  score: {
    type: Number,
    required: [true, "Score is required"],
    min: 0,
    max: 100
  },
  issues: [{
    id: { type: String, required: true },
    type: { type: String, required: true },
    severity: { type: String, default: "Medium" },
    description: { type: String, required: true },
    suggestion: { type: String, required: true },
    context: { type: String, default: "" },
    originalText: { type: String, default: "" },
    correctedText: { type: String, default: "" },
    pageNumber: { type: Number, default: 1 },
    position: {
      top: { type: Number, default: 0 },
      left: { type: Number, default: 0 },
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 }
    },
    isFixed: { type: Boolean, default: false }
  }],
  summary: {
    type: String,
    default: ""
  },
  processedContent: {
    type: String,
    default: ""
  },
  correctedContent: {
    type: String,
    default: ""
  },
  metadata: {
    company: { type: String },
    date: { type: String },
    type: { type: String }
  },
  images: [{
    page: { type: Number },
    category: { type: String },
    title: { type: String },
    filename: { type: String },
    path: { type: String }
  }],
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending"
  },
  analyzedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

export default mongoose.model<IAnalysis>("Analysis", AnalysisSchema);