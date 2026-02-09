import mongoose, { Schema, Document } from "mongoose";

export interface IWorkspace extends Document {
    name: string;
    description?: string;
    accessCode: string;
    ownerId: mongoose.Schema.Types.ObjectId;
    members: mongoose.Schema.Types.ObjectId[];
    documents: {
        analysisId: string;
        fileName: string;
        fileType: string;
        uploadDate: Date;
        userId: string; // Added userId
        submitterName: string; // Added submitterName
        submitterEmail: string; // Added submitterEmail
        totalScore: number;
        issues: any[];
        summary: string;
        processedContent: string;
        correctedContent?: string;
        correctedPdfBase64?: string;
    }[];
    createdAt: Date;
    updatedAt: Date;
}

const WorkspaceSchema: Schema = new Schema({
    name: {
        type: String,
        required: [true, "Workspace name is required"],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    accessCode: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    documents: [{
        analysisId: String,
        fileName: String,
        fileType: String,
        uploadDate: Date,
        userId: String, // Added userId
        submitterName: String, // Added submitterName
        submitterEmail: String, // Added submitterEmail
        totalScore: Number,
        issues: Array,
        summary: String,
        processedContent: String,
        correctedContent: String,
        correctedPdfBase64: String
    }]
}, {
    timestamps: true
});

export default mongoose.model<IWorkspace>('Workspace', WorkspaceSchema);
