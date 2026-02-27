"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadAdminFile = exports.deleteAdminFile = exports.uploadAdminFile = void 0;
const AdminUpload_1 = __importDefault(require("../models/AdminUpload"));
const Workspace_1 = __importDefault(require("../models/Workspace"));
const webhookService_1 = require("../services/webhookService");
// POST /:id/admin-upload — owner only
const uploadAdminFile = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const workspace = await Workspace_1.default.findById(id);
        if (!workspace)
            return res.status(404).json({ success: false, error: 'Workspace not found' });
        const isOwner = workspace.ownerId.toString() === userId;
        const isCoAdmin = workspace.coAdmins?.includes(userId);
        if (!isOwner && !isCoAdmin) {
            return res.status(403).json({ success: false, error: 'Only the workspace owner or co-admins can upload reference files' });
        }
        if (!req.file)
            return res.status(400).json({ success: false, error: 'No file provided' });
        // Fetch uploader name
        const User = require('../models/User').default;
        const user = await User.findById(userId);
        const uploaderName = user?.name || 'Unknown';
        // Save binary data to AdminUpload collection
        const adminUpload = new AdminUpload_1.default({
            workspaceId: workspace._id,
            uploaderId: userId,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            fileType: req.file.mimetype,
            fileData: req.file.buffer,
            uploadDate: new Date()
        });
        await adminUpload.save();
        await workspace.populate('members', 'email name');
        // Extract member emails (excluding the admin who is uploading the file if desired, but here we can include all)
        const memberEmails = workspace.members
            .map(m => m.email)
            .filter(email => email !== undefined);
        // Push metadata to workspace
        const meta = {
            id: adminUpload._id.toString(),
            fileName: req.file.originalname,
            fileSize: req.file.size,
            fileType: req.file.mimetype,
            uploadDate: new Date(),
            uploaderName
        };
        workspace.adminUploads.push(meta);
        await workspace.save();
        // Trigger webhook for reference uploaded
        if (user) {
            (0, webhookService_1.notifyReferenceUploaded)({
                workspaceId: workspace._id.toString(),
                workspaceName: workspace.name,
                userId: userId,
                userName: user.name,
                userEmail: user.email,
                memberEmails: memberEmails, // <--- New member emails
                fileName: req.file.originalname,
                fileSize: req.file.size,
                fileType: req.file.mimetype,
                uploadedAt: new Date()
            }).catch(err => console.error("Webhook error:", err));
        }
        res.status(201).json({ success: true, data: meta });
    }
    catch (err) {
        console.error('uploadAdminFile error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};
exports.uploadAdminFile = uploadAdminFile;
// DELETE /:id/admin-upload/:uploadId — owner only
const deleteAdminFile = async (req, res) => {
    try {
        const { id, uploadId } = req.params;
        const userId = req.user.userId;
        const workspace = await Workspace_1.default.findById(id);
        if (!workspace)
            return res.status(404).json({ success: false, error: 'Workspace not found' });
        const isOwner = workspace.ownerId.toString() === userId;
        const isCoAdmin = workspace.coAdmins?.includes(userId);
        if (!isOwner && !isCoAdmin) {
            return res.status(403).json({ success: false, error: 'Only the workspace owner or co-admins can delete reference files' });
        }
        // Delete binary document
        await AdminUpload_1.default.findByIdAndDelete(uploadId);
        // Remove metadata from workspace
        workspace.adminUploads = workspace.adminUploads.filter((u) => u.id !== uploadId);
        await workspace.save();
        res.status(200).json({ success: true, message: 'File deleted' });
    }
    catch (err) {
        console.error('deleteAdminFile error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};
exports.deleteAdminFile = deleteAdminFile;
// GET /:id/admin-upload/:uploadId/download — any member
const downloadAdminFile = async (req, res) => {
    try {
        const { id, uploadId } = req.params;
        const userId = req.user.userId;
        const workspace = await Workspace_1.default.findById(id);
        if (!workspace)
            return res.status(404).json({ success: false, error: 'Workspace not found' });
        // Verify membership
        const isMember = workspace.members.some((m) => m.toString() === userId);
        if (!isMember)
            return res.status(403).json({ success: false, error: 'Access denied' });
        const adminUpload = await AdminUpload_1.default.findById(uploadId);
        if (!adminUpload)
            return res.status(404).json({ success: false, error: 'File not found' });
        // Inline content-disposition so browser previews natively
        res.setHeader('Content-Type', adminUpload.fileType);
        res.setHeader('Content-Disposition', `inline; filename="${adminUpload.fileName}"`);
        res.send(adminUpload.fileData);
    }
    catch (err) {
        console.error('downloadAdminFile error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};
exports.downloadAdminFile = downloadAdminFile;
