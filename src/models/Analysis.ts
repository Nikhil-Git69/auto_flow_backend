
// import mongoose, { Schema, Document } from "mongoose";

// // Interface defining the structure of an Issue
// interface IIssue {
//   id: string;
//   type: string;
//   description: string;
//   suggestion: string;
//   isFixed: boolean;
// }

// export interface IAnalysis extends Document {
//   analysisId: string;   // Added this to match your route usage
//   userId: string;
//   fileName: string;
//   fileSize: number;     // Added this
//   fileType: string;
//   uploadDate: Date;
//   score: number;        // Renamed from totalScore to match your route usage
//   issues: IIssue[];     // Changed from string[] to object array
//   summary: string;
//   status: string;       // Added (e.g., "completed", "pending")
//   analyzedAt: Date;     // Added
//   createdAt: Date;
//   updatedAt: Date;
// }

// const AnalysisSchema: Schema = new Schema({
//   analysisId: { 
//     type: String, 
//     required: true, 
//     unique: true 
//   },
//   userId: { 
//     type: String, 
//     required: [true, "User ID is required"],
//     index: true
//   },
//   fileName: { 
//     type: String, 
//     required: [true, "File name is required"],
//     trim: true 
//   },
//   fileSize: {
//     type: Number
//   },
//   fileType: { 
//     type: String, 
//     required: [true, "File type is required"]
//   },
//   uploadDate: { 
//     type: Date, 
//     default: Date.now 
//   },
//   score: { 
//     type: Number, 
//     required: [true, "Score is required"],
//     min: 0,
//     max: 100
//   },
//   // Updated issues to be an array of objects to store fix status
//   issues: [{
//     id: String,
//     type: String,
//     description: String,
//     suggestion: String,
//     isFixed: { type: Boolean, default: false }
//   }],
//   summary: { 
//     type: String, 
//     default: ""
//   },
//   status: {
//     type: String,
//     enum: ["pending", "completed", "failed"],
//     default: "pending"
//   },
//   analyzedAt: {
//     type: Date,
//     default: Date.now
//   }
// }, {
//   timestamps: true 
// });

// // Export the model
// export default mongoose.model<IAnalysis>("Analysis", AnalysisSchema);
// import mongoose, { Schema, Document } from "mongoose";

// // Enhanced Issue interface for Word document support
// interface IIssue {
//   id: string;
//   type: string;
//   severity: string;
//   description: string;
//   suggestion: string;
//   context: string;
//   originalText?: string; // NEW: For Word document editing
//   correctedText?: string; // NEW: For Word document editing
//   pageNumber: number;
//   position?: {
//     top: number;
//     left: number;
//     width: number;
//     height: number;
//   };
//   isFixed: boolean;
// }

// export interface IAnalysis extends Document {
//   analysisId: string;
//   userId: string;
//   fileName: string;
//   fileSize: number;
//   fileType: string;
//   fileData?: Buffer; // NEW: Store file buffer for export
//   uploadDate: Date;
//   score: number;
//   issues: IIssue[];
//   summary: string;
//   status: string;
//   analyzedAt: Date;
//   createdAt: Date;
//   updatedAt: Date;
// }

// const AnalysisSchema: Schema = new Schema({
//   analysisId: { 
//     type: String, 
//     required: true, 
//     unique: true 
//   },
//   userId: { 
//     type: String, 
//     required: [true, "User ID is required"],
//     index: true
//   },
//   fileName: { 
//     type: String, 
//     required: [true, "File name is required"],
//     trim: true 
//   },
//   fileSize: {
//     type: Number
//   },
//   fileType: { 
//     type: String, 
//     required: [true, "File type is required"]
//   },
//   // NEW: Store file data for later export
//   fileData: {
//     type: Buffer,
//     select: false // Don't include in queries by default
//   },
//   uploadDate: { 
//     type: Date, 
//     default: Date.now 
//   },
//   score: { 
//     type: Number, 
//     required: [true, "Score is required"],
//     min: 0,
//     max: 100
//   },
//   // Enhanced issues schema for Word document support
//   issues: [{
//     id: { type: String, required: true },
//     type: { type: String, required: true },
//     severity: { type: String, default: "Medium" },
//     description: { type: String, required: true },
//     suggestion: { type: String, required: true },
//     context: { type: String, default: "" },
//     originalText: { type: String, default: "" }, // NEW
//     correctedText: { type: String, default: "" }, // NEW
//     pageNumber: { type: Number, default: 1 },
//     position: {
//       top: { type: Number, default: 0 },
//       left: { type: Number, default: 0 },
//       width: { type: Number, default: 0 },
//       height: { type: Number, default: 0 }
//     },
//     isFixed: { type: Boolean, default: false }
//   }],
//   summary: { 
//     type: String, 
//     default: ""
//   },
//   status: {
//     type: String,
//     enum: ["pending", "completed", "failed"],
//     default: "pending"
//   },
//   analyzedAt: {
//     type: Date,
//     default: Date.now
//   }
// }, {
//   timestamps: true 
// });

// // Export the model
// export default mongoose.model<IAnalysis>("Analysis", AnalysisSchema);
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
    enum: ['default', 'custom'],
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