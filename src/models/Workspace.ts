import mongoose, { Schema, Document } from "mongoose";

export interface ITask {
    id: string; // uuid
    title: string;
    description?: string;
    status: 'To Do' | 'In Progress' | 'Review' | 'Done';
    priority: 'Low' | 'Medium' | 'High';
    assigneeId?: string; // User ID
    startDate?: Date; // For Gantt
    deadline?: Date; // For Gantt/Deadlines
    dependencies?: string[]; // For Gantt (Task IDs)
    linkedAnalysisId?: string;
    color?: string; // Custom task color
    memberStatuses?: {
        userId: string;
        status: 'To Do' | 'In Progress' | 'Completed';
        updatedAt: Date;
    }[];
    createdAt: Date;
    updatedAt: Date;
}

export interface IBoard {
    id: string; // uuid
    name: string;
    columns: string[]; // ['To Do', 'In Progress', 'Done']
    tasks: ITask[];
}

export interface IWorkspace extends Document {
    name: string;
    description?: string;
    category: string;
    accessCode: string;
    ownerId: mongoose.Schema.Types.ObjectId;
    coAdmins: mongoose.Schema.Types.ObjectId[];
    members: mongoose.Schema.Types.ObjectId[];
    documents: {
        analysisId: string;
        fileName: string;
        fileType: string;
        uploadDate: Date;
        userId: string;
        submitterName: string;
        submitterEmail: string;
        totalScore: number;
        issues: any[];
        summary: string;
        processedContent: string;
        correctedContent?: string;
        correctedPdfBase64?: string;
        formatType?: string;
        status?: 'Pending' | 'Accepted' | 'Rejected';
        comments?: {
            id: string;
            text: string;
            userId: string;
            userName: string;
            role: string;
            createdAt: Date;
            updatedAt: Date;
        }[];
    }[];
    adminUploads: {
        id: string;
        fileName: string;
        fileSize: number;
        fileType: string;
        uploadDate: Date;
        uploaderName: string;
    }[];
    boards: IBoard[];
    isArchived: boolean;
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
    category: {
        type: String,
        trim: true,
        default: 'General'
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
    coAdmins: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    documents: [{
        analysisId: String,
        fileName: String,
        fileType: String,
        uploadDate: Date,
        userId: String,
        submitterName: String,
        submitterEmail: String,
        totalScore: Number,
        issues: Array,
        summary: String,
        processedContent: String,
        correctedContent: String,
        correctedPdfBase64: String,
        formatType: String,
        status: {
            type: String,
            enum: ['Pending', 'Accepted', 'Rejected'],
            default: 'Pending'
        },
        comments: [{
            id: String,
            text: String,
            userId: String,
            userName: String,
            role: String,
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now }
        }]
    }],
    // PMS Extension
    boards: [{
        id: String,
        name: String,
        columns: [String],
        tasks: [{
            id: String,
            title: String,
            description: String,
            status: {
                type: String,
                enum: ['To Do', 'In Progress', 'Review', 'Done'],
                default: 'To Do'
            },
            priority: {
                type: String,
                enum: ['Low', 'Medium', 'High'],
                default: 'Medium'
            },
            assigneeId: String,
            startDate: Date,
            deadline: Date,
            dependencies: [String],
            linkedAnalysisId: String,
            color: String,
            memberStatuses: [{
                userId: String,
                status: {
                    type: String,
                    enum: ['To Do', 'In Progress', 'Completed'],
                    default: 'To Do'
                },
                updatedAt: { type: Date, default: Date.now }
            }],
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now }
        }]
    }],
    adminUploads: [{
        id: String,
        fileName: String,
        fileSize: Number,
        fileType: String,
        uploadDate: { type: Date, default: Date.now },
        uploaderName: String
    }],
    isArchived: { type: Boolean, default: false }
}, {
    timestamps: true
});

export default mongoose.model<IWorkspace>('Workspace', WorkspaceSchema);
