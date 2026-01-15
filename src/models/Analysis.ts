// // backend/src/models/Analysis.ts
// import mongoose, { Schema, Document } from "mongoose";

// export interface IAnalysis extends Document {
//   userId: string;
//   fileName: string;
//   fileType: string;
//   uploadDate: string;
//   totalScore: number;
//   issues: string[];
//   summary: string;
//   createdAt?: Date;
//   updatedAt?: Date;
// }

// const AnalysisSchema: Schema = new Schema({
//   userId: { 
//     type: String, 
//     required: [true, "User ID is required"] 
//   },
//   fileName: { 
//     type: String, 
//     required: [true, "File name is required"],
//     trim: true 
//   },
//   fileType: { 
//     type: String, 
//     required: [true, "File type is required"],
//     enum: ['pdf', 'docx', 'txt', 'jpg', 'png'],
//     lowercase: true
//   },
//   uploadDate: { 
//     type: String, 
//     required: [true, "Upload date is required"] 
//   },
//   totalScore: { 
//     type: Number, 
//     required: [true, "Total score is required"],
//     min: [0, "Score cannot be less than 0"],
//     max: [100, "Score cannot exceed 100"]
//   },
//   issues: { 
//     type: [String], 
//     default: [],
//     validate: {
//       validator: function(v: string[]) {
//         return v.length <= 50;
//       },
//       message: 'Cannot have more than 50 issues'
//     }
//   },
//   summary: { 
//     type: String, 
//     default: "",
//     maxlength: [2000, "Summary cannot exceed 2000 characters"]
//   }
// }, {
//   timestamps: true // This is the key - Mongoose handles dates automatically
// });

// export default mongoose.model<IAnalysis>("Analysis", AnalysisSchema);
import mongoose, { Schema, Document } from "mongoose";

// Interface defining the structure of an Issue
interface IIssue {
  id: string;
  type: string;
  description: string;
  suggestion: string;
  isFixed: boolean;
}

export interface IAnalysis extends Document {
  analysisId: string;   // Added this to match your route usage
  userId: string;
  fileName: string;
  fileSize: number;     // Added this
  fileType: string;
  uploadDate: Date;
  score: number;        // Renamed from totalScore to match your route usage
  issues: IIssue[];     // Changed from string[] to object array
  summary: string;
  status: string;       // Added (e.g., "completed", "pending")
  analyzedAt: Date;     // Added
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
    required: [true, "User ID is required"],
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
  // Updated issues to be an array of objects to store fix status
  issues: [{
    id: String,
    type: String,
    description: String,
    suggestion: String,
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

// Export the model
export default mongoose.model<IAnalysis>("Analysis", AnalysisSchema);