import { Response } from 'express';
import Workspace from '../models/Workspace';
import { AuthRequest } from '../middleware/auth';

export const createWorkspace = async (req: AuthRequest, res: Response) => {
    try {
        const { name, description } = req.body;
        const userId = req.user.userId;

        // Generate unique access code
        let accessCode = '';
        let isUnique = false;
        while (!isUnique) {
            accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const existing = await Workspace.findOne({ accessCode });
            if (!existing) isUnique = true;
        }

        const workspace = new Workspace({
            name,
            description,
            accessCode,
            ownerId: userId,
            members: [userId] // Owner is also a member
        });

        await workspace.save();

        res.status(201).json({
            success: true,
            data: workspace
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const getAllWorkspaces = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user.userId;
        const workspaces = await Workspace.find({ members: userId })
            .sort({ updatedAt: -1 });

        res.status(200).json({
            success: true,
            data: workspaces
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const getWorkspaceById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const workspace = await Workspace.findById(id).populate('members', 'name email _id');

        if (!workspace) {
            return res.status(404).json({
                success: false,
                error: "Workspace not found"
            });
        }

        // Debug logging
        console.log(`📊 [getWorkspaceById] Workspace members:`, workspace.members);
        console.log(`📊 [getWorkspaceById] First member:`, workspace.members[0]);

        // Check if user is a member
        if (!workspace.members.some((member: any) => member._id.toString() === userId)) {
            return res.status(403).json({
                success: false,
                error: "Access denied"
            });
        }

        res.status(200).json({
            success: true,
            data: workspace
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const joinWorkspace = async (req: AuthRequest, res: Response) => {
    try {
        const { code } = req.body;
        const userId = req.user.userId;

        const workspace = await Workspace.findOne({ accessCode: code.toUpperCase() });

        if (!workspace) {
            return res.status(404).json({
                success: false,
                error: "Invalid access code"
            });
        }

        if (workspace.members.includes(userId)) {
            return res.status(400).json({
                success: false,
                error: "You are already a member of this workspace"
            });
        }

        workspace.members.push(userId);
        await workspace.save();

        res.status(200).json({
            success: true,
            message: "Successfully joined workspace",
            data: workspace
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const deleteWorkspace = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const workspace = await Workspace.findById(id);

        if (!workspace) {
            return res.status(404).json({
                success: false,
                error: "Workspace not found"
            });
        }

        if (workspace.ownerId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                error: "Only the owner can delete this workspace"
            });
        }

        await workspace.deleteOne();

        res.status(200).json({
            success: true,
            message: "Workspace deleted"
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }

};

export const addDocument = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const document = req.body;
        const userId = req.user.userId;

        const workspace = await Workspace.findById(id);

        if (!workspace) {
            return res.status(404).json({
                success: false,
                error: "Workspace not found"
            });
        }

        if (!workspace.members.includes(userId)) {
            return res.status(403).json({
                success: false,
                error: "Access denied"
            });
        }

        // Check availability of document
        const existingDoc = workspace.documents.find(
            doc => doc.analysisId === document.analysisId ||
                (doc.fileName === document.fileName && doc.userId === userId)
        );

        if (existingDoc) {
            return res.status(400).json({
                success: false,
                error: "You have already submitted this document to this workspace."
            });
        }

        // Get user name and email from JWT or fetch from DB
        let userName = req.user.name;
        let userEmail = req.user.email;

        // Fallback: If JWT doesn't have name/email, fetch from database
        if (!userName || !userEmail) {
            const User = require('../models/User').default;
            const user = await User.findById(userId);
            if (user) {
                userName = user.name;
                userEmail = user.email;
            }
        }

        const documentWithUser = {
            ...document,
            userId,
            submitterName: userName || 'Unknown User',
            submitterEmail: userEmail || ''
        };

        workspace.documents = [documentWithUser, ...workspace.documents];
        await workspace.save();

        res.status(200).json({
            success: true,
            data: workspace
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const removeDocument = async (req: AuthRequest, res: Response) => {
    try {
        const { id, analysisId } = req.params;
        const userId = req.user.userId;

        const workspace = await Workspace.findById(id);

        if (!workspace) {
            return res.status(404).json({
                success: false,
                error: "Workspace not found"
            });
        }

        if (!workspace.members.includes(userId)) {
            return res.status(403).json({
                success: false,
                error: "Access denied"
            });
        }

        // Only workspace owner can delete documents
        if (workspace.ownerId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                error: "Only the workspace owner can delete documents"
            });
        }

        workspace.documents = workspace.documents.filter(doc => doc.analysisId !== analysisId);
        await workspace.save();

        res.status(200).json({
            success: true,
            data: workspace
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const removeMember = async (req: AuthRequest, res: Response) => {
    try {
        const { id, memberId } = req.params;
        const userId = req.user.userId;

        const workspace = await Workspace.findById(id);

        if (!workspace) {
            return res.status(404).json({
                success: false,
                error: "Workspace not found"
            });
        }

        // Only workspace owner can remove members
        if (workspace.ownerId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                error: "Only the workspace owner can remove members"
            });
        }

        // Prevent owner from removing themselves
        if (memberId === userId) {
            return res.status(400).json({
                success: false,
                error: "You cannot remove yourself from the workspace"
            });
        }

        // Remove member from workspace
        workspace.members = workspace.members.filter(
            member => member.toString() !== memberId
        );
        await workspace.save();

        res.status(200).json({
            success: true,
            message: "Member removed successfully",
            data: workspace
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
