import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminUpload extends Document {
    workspaceId: mongoose.Schema.Types.ObjectId;
    uploaderId: mongoose.Schema.Types.ObjectId;
    fileName: string;
    fileSize: number;
    fileType: string;
    fileData: Buffer;
    uploadDate: Date;
}

const AdminUploadSchema: Schema = new Schema({
    workspaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        required: true,
        index: true
    },
    uploaderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    fileType: { type: String, required: true },
    fileData: { type: Buffer, required: true },
    uploadDate: { type: Date, default: Date.now }
});

export default mongoose.model<IAdminUpload>('AdminUpload', AdminUploadSchema);
