import { Response } from 'express';
import Workspace, { ITask } from '../models/Workspace';
import { AuthRequest } from '../middleware/auth';
import { notifyWorkspaceJoined, notifyDocumentUploaded } from '../services/webhookService';
import { v4 as uuidv4 } from 'uuid';


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
        console.log(`📊 [getWorkspaceById] Documents count:`, workspace.documents?.length);
        console.log(`📊 [getWorkspaceById] First document:`, workspace.documents?.[0]);

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

        // Get user details for webhook
        const User = require('../models/User').default;
        const user = await User.findById(userId);
        const owner = await User.findById(workspace.ownerId);

        // Send webhook notification (non-blocking)
        if (user && owner) {
            notifyWorkspaceJoined({
                workspaceId: workspace._id.toString(),
                workspaceName: workspace.name,
                userId: userId,
                userName: user.name,
                userEmail: user.email,
                adminEmail: owner.email,
                joinedAt: new Date()
            }).catch(err => console.error('Webhook error:', err));
        }

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
            submitterEmail: userEmail || '',
            formatType: document.formatType || 'default',
            status: 'Pending' // Force status to Pending to avoid validation errors from 'completed' status in Analysis
        };

        workspace.documents = [documentWithUser, ...workspace.documents];
        await workspace.save();

        // Get owner email for webhook
        const User = require('../models/User').default;
        const owner = await User.findById(workspace.ownerId);

        // Send webhook notification (non-blocking)
        if (owner) {
            notifyDocumentUploaded({
                workspaceId: workspace._id.toString(),
                workspaceName: workspace.name,
                userId: userId,
                userName: userName || 'Unknown User',
                userEmail: userEmail || '',
                adminEmail: owner.email,
                fileName: document.fileName,
                fileType: document.fileType,
                analysisId: document.analysisId,
                score: document.totalScore || 0,
                issues: document.issues?.length || 0,
                uploadedAt: new Date()
            }).catch(err => console.error('Webhook error:', err));
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

// PMS: Create Task
export const createTask = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params; // Workspace ID
        const userId = req.user.userId;
        const { title, description, status, priority, assigneeId, startDate, deadline, dependencies, linkedAnalysisId, boardId, color } = req.body;

        const workspace = await Workspace.findById(id);
        if (!workspace) return res.status(404).json({ success: false, error: "Workspace not found" });

        // Check membership
        if (!workspace.members.includes(userId)) return res.status(403).json({ success: false, error: "Access denied" });

        // Basic permissions: Admin/Owner can create tasks
        if (workspace.ownerId.toString() !== userId) {
            return res.status(403).json({ success: false, error: "Only workspace owner can create tasks" });
        }

        const newTask: ITask = {
            id: uuidv4(),
            title,
            description,
            status: status || 'To Do',
            priority: priority || 'Medium',
            assigneeId,
            startDate: startDate ? new Date(startDate) : undefined,
            deadline: deadline ? new Date(deadline) : undefined,
            dependencies: dependencies || [],
            linkedAnalysisId,
            color,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Find board or default board
        let targetBoard = workspace.boards.find(b => b.id === boardId);
        if (!targetBoard) {
            if (workspace.boards.length === 0) {
                // Create default board if none exists
                const defaultBoard = {
                    id: uuidv4(),
                    name: 'Main Board',
                    columns: ['To Do', 'In Progress', 'Done'],
                    tasks: []
                };
                workspace.boards.push(defaultBoard);
                targetBoard = workspace.boards[0];
            } else {
                targetBoard = workspace.boards[0];
            }
        }

        targetBoard.tasks.push(newTask);
        await workspace.save();

        res.status(201).json({ success: true, data: newTask });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// PMS: Update Task
export const updateTask = async (req: AuthRequest, res: Response) => {
    try {
        const { id, taskId } = req.params;
        const userId = req.user.userId;
        const updates = req.body;

        const workspace = await Workspace.findById(id);
        if (!workspace) return res.status(404).json({ success: false, error: "Workspace not found" });

        if (!workspace.members.includes(userId)) return res.status(403).json({ success: false, error: "Access denied" });

        // Find task
        let task: ITask | undefined;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        let boardIndex = -1;

        for (let i = 0; i < workspace.boards.length; i++) {
            task = workspace.boards[i].tasks.find(t => t.id === taskId);
            if (task) {
                boardIndex = i;
                break;
            }
        }

        if (!task) return res.status(404).json({ success: false, error: "Task not found" });

        const isOwner = workspace.ownerId.toString() === userId;

        if (!isOwner) {
            // Check if trying to update restricted fields
            const restrictedFields = ['startDate', 'deadline', 'dependencies', 'title', 'description', 'assigneeId', 'color'];
            const updatesKeys = Object.keys(updates);
            const attemptedRestrictedUpdates = updatesKeys.some(key => restrictedFields.includes(key));

            // Check if member is trying to update someone else's status
            let illegalMemberStatusUpdate = false;
            if (updates.memberStatuses) {
                // Member can only update array if it contains ONLY their own status
                // But since we replace the array or push to it, we need to be careful.
                // Simplified approach: Members pass a single status update object, not the whole array logic here usually.
                // BUT, if the frontend sends the whole object, we need to validate.

                // Better approach for members: They should only be sending a specific "myStatus" update, 
                // but the API is generic "updateTask". 

                // Let's check logic:
                // If memberStatuses is present in updates
                if (Array.isArray(updates.memberStatuses)) {
                    // If it's an array, it implies a full replace or merge. 
                    // For a member, we should strictly only allow modifying their OWN entry.
                    // It's safer to reject generic memberStatuses update from non-admins if it touches others.

                    // ACTUALLY, let's look at how we'll implement the frontend. 
                    // The frontend will likely send `memberStatuses` array with the updated list? 
                    // OR we can support a special key or just logic here.

                    // Let's refine the logic: 
                    // If non-admin sends 'memberStatuses', we verify that:
                    // 1. They are only changing/adding their OWN status.
                    // 2. They are not removing/changing others.

                    // To simplify, let's assume the frontend sends the NEW state of `memberStatuses`?
                    // That's risky for concurrency. 
                    // Instead, let's support a specific operation or filtered update.

                    // Let's stick to the current plan:
                    // If member, we check if `memberStatuses` is being updated.
                    // We will reconcile the update manually for members.
                }
            }

            if (attemptedRestrictedUpdates) {
                return res.status(403).json({ success: false, error: "Members can only update task status" });
            }
        }

        // Apply updates
        if (isOwner) {
            // Admin can update everything
            Object.assign(task, updates);
        } else {
            // Members: Can only update 'status' (global status - wait, can they?)
            // The prompt said: "Members can add their progress status... they themselves can add and delete"
            // "Members can only change their own status".
            // "Activity Status" (global) vs "Member Status" (individual).
            // Let's assume 'status' (global) is Admin only? Or shared?
            // Prompt: "Member able to add/edit their activity Status... Admins should be easily able to see... Admin should be able add... description... Members can add their progress status"
            // It implies the global 'status' might be derived or admin managed, but members manage THEIROWN status.

            // Let's allow members to update `memberStatuses` ONLY for themselves.
            if (updates.memberStatuses && Array.isArray(updates.memberStatuses)) {
                const newMemberStatuses = updates.memberStatuses;

                // We need to merge safely
                if (!task.memberStatuses) task.memberStatuses = [];

                newMemberStatuses.forEach((newStatus: any) => {
                    // Check if this status update belongs to the requesting user
                    if (newStatus.userId === userId) {
                        // Valid update for self
                        const existingIndex = task!.memberStatuses!.findIndex((s: any) => s.userId === userId);
                        if (existingIndex >= 0) {
                            task!.memberStatuses![existingIndex] = newStatus;
                        } else {
                            task!.memberStatuses!.push(newStatus);
                        }
                    }
                    // If they try to update others, we ignore it (or error, but ignoring is softer)
                });
            }

            // Block global status update if not allowed? 
            // "Members can only change their own status" -> Implies global status is Admin?
            // Let's restrict global 'status' too for now to be safe, unless requested otherwise.
            // If `status` is in updates, ignore it for members?
            // The prompt says "Members can add their progress status...". Use own judgement.
            // I will BLOCK global status update for members to avoid confusion.
        }

        task.updatedAt = new Date();

        await workspace.save();
        res.status(200).json({ success: true, data: task });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// PMS: Delete Task
export const deleteTask = async (req: AuthRequest, res: Response) => {
    try {
        const { id, taskId } = req.params;
        const userId = req.user.userId;

        const workspace = await Workspace.findById(id);
        if (!workspace) return res.status(404).json({ success: false, error: "Workspace not found" });

        if (workspace.ownerId.toString() !== userId) return res.status(403).json({ success: false, error: "Only owner can delete tasks" });

        let deleted = false;
        workspace.boards.forEach(board => {
            const originalLength = board.tasks.length;
            board.tasks = board.tasks.filter(t => t.id !== taskId);
            if (board.tasks.length < originalLength) deleted = true;
        });

        if (!deleted) return res.status(404).json({ success: false, error: "Task not found" });

        await workspace.save();
        res.status(200).json({ success: true, message: "Task deleted" });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Update Document Status
export const updateDocumentStatus = async (req: AuthRequest, res: Response) => {
    try {
        const { id, analysisId } = req.params;
        const { status } = req.body;
        const userId = req.user.userId;

        if (!['Pending', 'Accepted', 'Rejected'].includes(status)) {
            return res.status(400).json({ success: false, error: "Invalid status" });
        }

        const workspace = await Workspace.findById(id);
        if (!workspace) return res.status(404).json({ success: false, error: "Workspace not found" });

        // Only owner can update status
        if (workspace.ownerId.toString() !== userId) {
            return res.status(403).json({ success: false, error: "Only workspace owner can update document status" });
        }

        const docIndex = workspace.documents.findIndex(d => d.analysisId === analysisId);
        if (docIndex === -1) {
            return res.status(404).json({ success: false, error: "Document not found" });
        }

        workspace.documents[docIndex].status = status;
        await workspace.save();

        res.status(200).json({ success: true, data: workspace });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Document Comments CRUD

// Document Comments CRUD

// Add Comment
export const addDocumentComment = async (req: AuthRequest, res: Response) => {
    try {
        const { id, analysisId } = req.params;
        const { text } = req.body;
        const userId = req.user.userId;

        if (!text) return res.status(400).json({ success: false, error: "Comment text is required" });

        const workspace = await Workspace.findById(id);
        if (!workspace) return res.status(404).json({ success: false, error: "Workspace not found" });

        const docIndex = workspace.documents.findIndex(d => d.analysisId === analysisId);
        if (docIndex === -1) {
            return res.status(404).json({ success: false, error: "Document not found" });
        }

        const document = workspace.documents[docIndex];
        const isOwner = workspace.ownerId.toString() === userId;
        const isDocOwner = document.userId === userId;

        // Allow Admin OR Document Owner
        if (!isOwner && !isDocOwner) {
            return res.status(403).json({ success: false, error: "You can only comment on your own documents" });
        }

        // Fetch user details for the comment
        // Fetch user details for the comment
        const User = require('../models/User').default;
        const user = await User.findById(userId);

        const newComment = {
            id: uuidv4(),
            text,
            userId,
            userName: user?.name || 'Unknown User',
            role: isOwner ? 'Admin' : 'Member',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        if (!workspace.documents[docIndex].comments) {
            workspace.documents[docIndex].comments = [];
        }

        workspace.documents[docIndex].comments!.push(newComment);
        await workspace.save();

        res.status(201).json({ success: true, data: workspace });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Edit Comment
export const editDocumentComment = async (req: AuthRequest, res: Response) => {
    try {
        const { id, analysisId, commentId } = req.params;
        const { text } = req.body;
        const userId = req.user.userId;

        if (!text) return res.status(400).json({ success: false, error: "Comment text is required" });

        const workspace = await Workspace.findById(id);
        if (!workspace) return res.status(404).json({ success: false, error: "Workspace not found" });

        const docIndex = workspace.documents.findIndex(d => d.analysisId === analysisId);
        if (docIndex === -1) return res.status(404).json({ success: false, error: "Document not found" });

        const comments = workspace.documents[docIndex].comments;
        if (!comments) return res.status(404).json({ success: false, error: "Comment not found" });

        const commentIndex = comments.findIndex(c => c.id === commentId);
        if (commentIndex === -1) return res.status(404).json({ success: false, error: "Comment not found" });

        const comment = comments[commentIndex];
        const isOwner = workspace.ownerId.toString() === userId;
        const isCommentAuthor = comment.userId === userId;

        // Allow Admin OR Comment Author
        if (!isOwner && !isCommentAuthor) {
            return res.status(403).json({ success: false, error: "You can only edit your own comments" });
        }

        comments[commentIndex].text = text;
        comments[commentIndex].updatedAt = new Date();

        await workspace.save();
        res.status(200).json({ success: true, data: workspace });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Delete Comment
export const deleteDocumentComment = async (req: AuthRequest, res: Response) => {
    try {
        const { id, analysisId, commentId } = req.params;
        const userId = req.user.userId;

        const workspace = await Workspace.findById(id);
        if (!workspace) return res.status(404).json({ success: false, error: "Workspace not found" });

        const docIndex = workspace.documents.findIndex(d => d.analysisId === analysisId);
        if (docIndex === -1) return res.status(404).json({ success: false, error: "Document not found" });

        const comments = workspace.documents[docIndex].comments;
        if (!comments) return res.status(404).json({ success: false, error: "Comment not found" });

        const comment = comments.find(c => c.id === commentId);
        if (!comment) return res.status(404).json({ success: false, error: "Comment not found" });

        const isOwner = workspace.ownerId.toString() === userId;
        const isCommentAuthor = comment.userId === userId;

        // Allow Admin OR Comment Author
        if (!isOwner && !isCommentAuthor) {
            return res.status(403).json({ success: false, error: "You can only delete your own comments" });
        }

        workspace.documents[docIndex].comments = comments.filter(c => c.id !== commentId);
        await workspace.save();

        res.status(200).json({ success: true, data: workspace });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// PMS: Get Board
export const getWorkspaceBoard = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const workspace = await Workspace.findById(id);
        if (!workspace) return res.status(404).json({ success: false, error: "Workspace not found" });
        if (!workspace.members.includes(userId)) return res.status(403).json({ success: false, error: "Access denied" });

        // Ensure at least one board exists
        if (!workspace.boards || workspace.boards.length === 0) {
            const defaultBoard = {
                id: uuidv4(),
                name: 'Main Board',
                columns: ['To Do', 'In Progress', 'Done'],
                tasks: []
            };
            workspace.boards = [defaultBoard];
            await workspace.save();
        }

        res.status(200).json({ success: true, data: workspace.boards });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
