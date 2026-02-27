"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unarchiveWorkspace = exports.archiveWorkspace = exports.getWorkspaceBoard = exports.deleteDocumentComment = exports.editDocumentComment = exports.addDocumentComment = exports.updateDocumentStatus = exports.deleteTask = exports.updateTask = exports.createTask = exports.demoteToMember = exports.promoteToCoAdmin = exports.removeMember = exports.removeDocument = exports.addDocument = exports.deleteWorkspace = exports.joinWorkspace = exports.getWorkspaceById = exports.getAllWorkspaces = exports.updateWorkspace = exports.createWorkspace = void 0;
const Workspace_1 = __importDefault(require("../models/Workspace"));
const webhookService_1 = require("../services/webhookService");
const uuid_1 = require("uuid");
const createWorkspace = async (req, res) => {
    try {
        const { name, description, category } = req.body;
        const userId = req.user.userId;
        // Free-tier limit: max 3 owned workspaces
        const ownedCount = await Workspace_1.default.countDocuments({ ownerId: userId });
        if (ownedCount >= 3) {
            return res.status(403).json({
                success: false,
                limitReached: true,
                error: 'Free plan limit reached. You can only create up to 3 workspaces. Upgrade to create more.'
            });
        }
        // Generate unique access code
        let accessCode = '';
        let isUnique = false;
        while (!isUnique) {
            accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const existing = await Workspace_1.default.findOne({ accessCode });
            if (!existing)
                isUnique = true;
        }
        const workspace = new Workspace_1.default({
            name,
            description,
            category: category || 'General',
            accessCode,
            ownerId: userId,
            members: [userId]
        });
        await workspace.save();
        res.status(201).json({
            success: true,
            data: workspace
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
exports.createWorkspace = createWorkspace;
const updateWorkspace = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, category } = req.body;
        const userId = req.user.userId;
        const workspace = await Workspace_1.default.findById(id);
        if (!workspace)
            return res.status(404).json({ success: false, error: 'Workspace not found' });
        const isOwner = workspace.ownerId.toString() === userId;
        const isCoAdmin = workspace.coAdmins.includes(userId);
        if (!isOwner && !isCoAdmin) {
            return res.status(403).json({ success: false, error: 'Only the workspace owner or co-admins can edit this workspace' });
        }
        if (name !== undefined)
            workspace.name = name;
        if (description !== undefined)
            workspace.description = description;
        if (category !== undefined)
            workspace.category = category;
        await workspace.save();
        res.status(200).json({ success: true, data: workspace });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.updateWorkspace = updateWorkspace;
const getAllWorkspaces = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { archived } = req.query;
        const filter = { members: userId };
        if (archived === 'true') {
            filter.isArchived = true;
        }
        else if (archived === 'false') {
            filter.isArchived = { $ne: true };
        }
        // If archived param is missing, we could default to false to hide archived ones, 
        // but let's default to false to match WhatsApp behavior (hide archived by default).
        if (archived === undefined) {
            filter.isArchived = { $ne: true };
        }
        const workspaces = await Workspace_1.default.find(filter)
            .sort({ updatedAt: -1 });
        res.status(200).json({
            success: true,
            data: workspaces
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
exports.getAllWorkspaces = getAllWorkspaces;
const getWorkspaceById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const workspace = await Workspace_1.default.findById(id).populate('members', 'name email _id');
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
        if (!workspace.members.some((member) => member._id.toString() === userId)) {
            return res.status(403).json({
                success: false,
                error: "Access denied"
            });
        }
        res.status(200).json({
            success: true,
            data: workspace
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
exports.getWorkspaceById = getWorkspaceById;
const joinWorkspace = async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.user.userId;
        const workspace = await Workspace_1.default.findOne({ accessCode: code.toUpperCase() });
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
            (0, webhookService_1.notifyWorkspaceJoined)({
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
exports.joinWorkspace = joinWorkspace;
const deleteWorkspace = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const workspace = await Workspace_1.default.findById(id);
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
exports.deleteWorkspace = deleteWorkspace;
const addDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const document = req.body;
        const userId = req.user.userId;
        const workspace = await Workspace_1.default.findById(id);
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
        const existingDoc = workspace.documents.find(doc => doc.analysisId === document.analysisId ||
            (doc.fileName === document.fileName && doc.userId === userId));
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
            status: 'Pending' // Explicitly set to 'Pending' so it doesn't accidentally inherit 'completed' from the generic Analysis schema
        };
        workspace.documents = [documentWithUser, ...workspace.documents];
        await workspace.save();
        // Get owner email for webhook
        const User = require('../models/User').default;
        const owner = await User.findById(workspace.ownerId);
        // Send webhook notification (non-blocking)
        if (owner) {
            (0, webhookService_1.notifyDocumentUploaded)({
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
exports.addDocument = addDocument;
const removeDocument = async (req, res) => {
    try {
        const { id, analysisId } = req.params;
        const userId = req.user.userId;
        const workspace = await Workspace_1.default.findById(id);
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
exports.removeDocument = removeDocument;
const removeMember = async (req, res) => {
    try {
        const { id, memberId } = req.params;
        const userId = req.user.userId;
        const workspace = await Workspace_1.default.findById(id);
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
        workspace.members = workspace.members.filter(member => member.toString() !== memberId);
        // Also remove from coAdmins if they are one
        workspace.coAdmins = workspace.coAdmins.filter(admin => admin.toString() !== memberId);
        await workspace.save();
        res.status(200).json({
            success: true,
            message: "Member removed successfully",
            data: workspace
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
exports.removeMember = removeMember;
const promoteToCoAdmin = async (req, res) => {
    try {
        const { id, memberId } = req.params;
        const userId = req.user.userId;
        const workspace = await Workspace_1.default.findById(id);
        if (!workspace) {
            return res.status(404).json({ success: false, error: "Workspace not found" });
        }
        // Only owner can promote members
        if (workspace.ownerId.toString() !== userId) {
            return res.status(403).json({ success: false, error: "Only the workspace owner can promote members" });
        }
        // Validate member belongs to workspace
        if (!workspace.members.includes(memberId)) {
            return res.status(400).json({ success: false, error: "User is not a member of this workspace" });
        }
        // Prevent promoting the owner
        if (memberId === userId) {
            return res.status(400).json({ success: false, error: "Owner cannot be promoted (already has full access)" });
        }
        // Check if already co-admin
        if (workspace.coAdmins.includes(memberId)) {
            return res.status(400).json({ success: false, error: "User is already a co-admin" });
        }
        workspace.coAdmins.push(memberId);
        await workspace.save();
        res.status(200).json({
            success: true,
            message: "Member promoted to co-admin successfully",
            data: workspace
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.promoteToCoAdmin = promoteToCoAdmin;
const demoteToMember = async (req, res) => {
    try {
        const { id, memberId } = req.params;
        const userId = req.user.userId;
        const workspace = await Workspace_1.default.findById(id);
        if (!workspace) {
            return res.status(404).json({ success: false, error: "Workspace not found" });
        }
        // Only owner can demote members
        if (workspace.ownerId.toString() !== userId) {
            return res.status(403).json({ success: false, error: "Only the workspace owner can demote co-admins" });
        }
        // Check if user is a co-admin
        if (!workspace.coAdmins.includes(memberId)) {
            return res.status(400).json({ success: false, error: "User is not a co-admin" });
        }
        workspace.coAdmins = workspace.coAdmins.filter(admin => admin.toString() !== memberId);
        await workspace.save();
        res.status(200).json({
            success: true,
            message: "Co-admin demoted to member successfully",
            data: workspace
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.demoteToMember = demoteToMember;
// PMS: Create Task
const createTask = async (req, res) => {
    try {
        const { id } = req.params; // Workspace ID
        const userId = req.user.userId;
        const { title, description, status, priority, assigneeId, startDate, deadline, dependencies, linkedAnalysisId, boardId, color } = req.body;
        const workspace = await Workspace_1.default.findById(id);
        if (!workspace)
            return res.status(404).json({ success: false, error: "Workspace not found" });
        // Check membership
        if (!workspace.members.includes(userId))
            return res.status(403).json({ success: false, error: "Access denied" });
        // Basic permissions: Admin/Owner or Co-Admin can create tasks
        const isOwner = workspace.ownerId.toString() === userId;
        const isCoAdmin = workspace.coAdmins.includes(userId);
        if (!isOwner && !isCoAdmin) {
            return res.status(403).json({ success: false, error: "Only workspace owner or co-admins can create tasks" });
        }
        const newTask = {
            id: (0, uuid_1.v4)(),
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
                    id: (0, uuid_1.v4)(),
                    name: 'Main Board',
                    columns: ['To Do', 'In Progress', 'Done'],
                    tasks: []
                };
                workspace.boards.push(defaultBoard);
                targetBoard = workspace.boards[0];
            }
            else {
                targetBoard = workspace.boards[0];
            }
        }
        targetBoard.tasks.push(newTask);
        // Populate members to get member emails
        await workspace.populate('members', 'email name');
        const memberEmails = workspace.members
            .map(m => m.email)
            .filter(email => email !== undefined);
        await workspace.save();
        // Trigger webhook for activity added
        const User = require('../models/User').default;
        const admin = await User.findById(userId);
        if (admin) {
            (0, webhookService_1.notifyActivityAdded)({
                workspaceId: workspace._id.toString(),
                workspaceName: workspace.name,
                adminId: userId,
                adminName: admin.name || 'Unknown Admin',
                adminEmail: admin.email || 'No email',
                memberEmails: memberEmails,
                taskId: newTask.id,
                taskTitle: newTask.title,
                taskDescription: newTask.description || '',
                taskPriority: newTask.priority,
                taskDeadline: newTask.deadline,
                addedAt: new Date()
            }).catch(err => console.error("Webhook error:", err));
        }
        res.status(201).json({ success: true, data: newTask });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.createTask = createTask;
// PMS: Update Task
const updateTask = async (req, res) => {
    try {
        const { id, taskId } = req.params;
        const userId = req.user.userId;
        const updates = req.body;
        const workspace = await Workspace_1.default.findById(id);
        if (!workspace)
            return res.status(404).json({ success: false, error: "Workspace not found" });
        if (!workspace.members.includes(userId))
            return res.status(403).json({ success: false, error: "Access denied" });
        // Find task
        let task;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        let boardIndex = -1;
        for (let i = 0; i < workspace.boards.length; i++) {
            task = workspace.boards[i].tasks.find(t => t.id === taskId);
            if (task) {
                boardIndex = i;
                break;
            }
        }
        if (!task)
            return res.status(404).json({ success: false, error: "Task not found" });
        const isOwner = workspace.ownerId.toString() === userId;
        const isCoAdmin = workspace.coAdmins.includes(userId);
        const isAdmin = isOwner || isCoAdmin;
        if (!isAdmin) {
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
        if (isAdmin) {
            // Admin/Co-Admin can update everything
            const oldGlobalStatus = task.status;
            Object.assign(task, updates);
            task.updatedAt = new Date();
            // Populate members for emails
            await workspace.populate('members', 'email name');
            const memberEmails = workspace.members
                .map((m) => m.email)
                .filter((email) => !!email);
            await workspace.save();
            // Fire webhook only when global status actually changed
            if (updates.status && updates.status !== oldGlobalStatus) {
                const UserModel = require('../models/User').default;
                const actor = await UserModel.findById(userId);
                const owner = await UserModel.findById(workspace.ownerId);
                if (actor && owner) {
                    (0, webhookService_1.notifyTaskProgressUpdated)({
                        workspaceId: workspace._id.toString(),
                        workspaceName: workspace.name,
                        userId: actor._id.toString(),
                        userName: actor.name || 'Unknown',
                        userEmail: actor.email || '',
                        adminEmail: owner.email || '',
                        memberEmails,
                        taskId: task.id,
                        taskTitle: task.title,
                        oldStatus: oldGlobalStatus || '',
                        newStatus: updates.status,
                        updatedAt: new Date()
                    }).catch((err) => console.error('Task Webhook Error:', err));
                }
            }
            return res.status(200).json({ success: true, data: task });
        }
        else {
            // Members: Can only update `memberStatuses` for themselves
            if (updates.memberStatuses && Array.isArray(updates.memberStatuses)) {
                const newMemberStatuses = updates.memberStatuses;
                // We need to merge safely
                if (!task.memberStatuses)
                    task.memberStatuses = [];
                // Populate members for emails (needed for webhook)
                await workspace.populate('members', 'email name');
                const memberEmails = workspace.members
                    .map((m) => m.email)
                    .filter((email) => !!email);
                newMemberStatuses.forEach((newStatus) => {
                    // Check if this status update belongs to the requesting user
                    if (newStatus.userId === userId) {
                        // Valid update for self
                        const existingIndex = task.memberStatuses.findIndex((s) => s.userId === userId);
                        let oldStatus = 'To Do';
                        if (existingIndex >= 0) {
                            oldStatus = task.memberStatuses[existingIndex].status;
                            task.memberStatuses[existingIndex] = newStatus;
                        }
                        else {
                            task.memberStatuses.push(newStatus);
                        }
                        // Trigger webhook
                        const UserModel = require('../models/User').default;
                        UserModel.findById(userId).then((user) => {
                            UserModel.findById(workspace.ownerId).then((admin) => {
                                if (user && admin && oldStatus !== newStatus.status) {
                                    (0, webhookService_1.notifyTaskProgressUpdated)({
                                        workspaceId: workspace._id.toString(),
                                        workspaceName: workspace.name,
                                        userId: user._id.toString(),
                                        userName: user.name,
                                        userEmail: user.email,
                                        adminEmail: admin.email,
                                        memberEmails,
                                        taskId: task.id,
                                        taskTitle: task.title,
                                        oldStatus: oldStatus,
                                        newStatus: newStatus.status,
                                        updatedAt: new Date()
                                    }).catch((err) => console.error('Task Webhook Error:', err));
                                }
                            });
                        });
                    }
                    // If they try to update others, we ignore it (or error, but ignoring is softer)
                });
            }
            task.updatedAt = new Date();
            await workspace.save();
            return res.status(200).json({ success: true, data: task });
        }
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.updateTask = updateTask;
// PMS: Delete Task
const deleteTask = async (req, res) => {
    try {
        const { id, taskId } = req.params;
        const userId = req.user.userId;
        const workspace = await Workspace_1.default.findById(id);
        if (!workspace)
            return res.status(404).json({ success: false, error: "Workspace not found" });
        if (workspace.ownerId.toString() !== userId)
            return res.status(403).json({ success: false, error: "Only owner can delete tasks" });
        let deleted = false;
        workspace.boards.forEach(board => {
            const originalLength = board.tasks.length;
            board.tasks = board.tasks.filter(t => t.id !== taskId);
            if (board.tasks.length < originalLength)
                deleted = true;
        });
        if (!deleted)
            return res.status(404).json({ success: false, error: "Task not found" });
        await workspace.save();
        res.status(200).json({ success: true, message: "Task deleted" });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.deleteTask = deleteTask;
// Update Document Status
const updateDocumentStatus = async (req, res) => {
    try {
        const { id, analysisId } = req.params;
        const { status } = req.body;
        const userId = req.user.userId;
        if (!['Pending', 'Accepted', 'Rejected'].includes(status)) {
            return res.status(400).json({ success: false, error: "Invalid status" });
        }
        const workspace = await Workspace_1.default.findById(id);
        if (!workspace)
            return res.status(404).json({ success: false, error: "Workspace not found" });
        // Only owner or co-admin can update status
        const isOwner = workspace.ownerId.toString() === userId;
        const isCoAdmin = workspace.coAdmins.includes(userId);
        if (!isOwner && !isCoAdmin) {
            return res.status(403).json({ success: false, error: "Only workspace admins can update document status" });
        }
        const docIndex = workspace.documents.findIndex(d => d.analysisId === analysisId);
        if (docIndex === -1) {
            return res.status(404).json({ success: false, error: "Document not found" });
        }
        workspace.documents[docIndex].status = status;
        await workspace.save();
        if (status === 'Accepted') {
            const document = workspace.documents[docIndex];
            // Fetch admin details
            const User = require('../models/User').default;
            const admin = await User.findById(userId);
            if (admin) {
                (0, webhookService_1.notifyReportAccepted)({
                    workspaceId: workspace._id.toString(),
                    workspaceName: workspace.name,
                    userId: document.userId,
                    userName: document.submitterName || 'Unknown User',
                    userEmail: document.submitterEmail || '',
                    adminEmail: admin.email,
                    fileName: document.fileName,
                    analysisId: document.analysisId,
                    acceptedAt: new Date()
                }).catch(err => console.error('Webhook error:', err));
            }
        }
        else if (status === 'Rejected') {
            const document = workspace.documents[docIndex];
            // Fetch admin details
            const User = require('../models/User').default;
            const admin = await User.findById(userId);
            if (admin) {
                (0, webhookService_1.notifyReportRejected)({
                    workspaceId: workspace._id.toString(),
                    workspaceName: workspace.name,
                    userId: document.userId,
                    userName: document.submitterName || 'Unknown User',
                    userEmail: document.submitterEmail || '',
                    adminEmail: admin.email,
                    fileName: document.fileName,
                    analysisId: document.analysisId,
                    rejectedAt: new Date()
                }).catch(err => console.error('Webhook error:', err));
            }
        }
        res.status(200).json({ success: true, data: workspace });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.updateDocumentStatus = updateDocumentStatus;
// Document Comments CRUD
// Document Comments CRUD
// Add Comment
const addDocumentComment = async (req, res) => {
    try {
        const { id, analysisId } = req.params;
        const { text } = req.body;
        const userId = req.user.userId;
        if (!text)
            return res.status(400).json({ success: false, error: "Comment text is required" });
        const workspace = await Workspace_1.default.findById(id);
        if (!workspace)
            return res.status(404).json({ success: false, error: "Workspace not found" });
        const docIndex = workspace.documents.findIndex(d => d.analysisId === analysisId);
        if (docIndex === -1) {
            return res.status(404).json({ success: false, error: "Document not found" });
        }
        const document = workspace.documents[docIndex];
        const isOwner = workspace.ownerId.toString() === userId;
        const isCoAdmin = workspace.coAdmins.includes(userId);
        const isAdmin = isOwner || isCoAdmin;
        const isDocOwner = document.userId === userId;
        // Allow Admin OR Document Owner
        if (!isAdmin && !isDocOwner) {
            return res.status(403).json({ success: false, error: "You can only comment on your own documents" });
        }
        // Fetch user details for the comment
        const User = require('../models/User').default;
        const user = await User.findById(userId);
        const newComment = {
            id: (0, uuid_1.v4)(),
            text,
            userId,
            userName: user?.name || 'Unknown User',
            role: isAdmin ? (isOwner ? 'Owner' : 'Co-Admin') : 'Member',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        if (!workspace.documents[docIndex].comments) {
            workspace.documents[docIndex].comments = [];
        }
        workspace.documents[docIndex].comments.push(newComment);
        await workspace.save();
        res.status(201).json({ success: true, data: workspace });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.addDocumentComment = addDocumentComment;
// Edit Comment
const editDocumentComment = async (req, res) => {
    try {
        const { id, analysisId, commentId } = req.params;
        const { text } = req.body;
        const userId = req.user.userId;
        if (!text)
            return res.status(400).json({ success: false, error: "Comment text is required" });
        const workspace = await Workspace_1.default.findById(id);
        if (!workspace)
            return res.status(404).json({ success: false, error: "Workspace not found" });
        const docIndex = workspace.documents.findIndex(d => d.analysisId === analysisId);
        if (docIndex === -1)
            return res.status(404).json({ success: false, error: "Document not found" });
        const comments = workspace.documents[docIndex].comments;
        if (!comments)
            return res.status(404).json({ success: false, error: "Comment not found" });
        const commentIndex = comments.findIndex(c => c.id === commentId);
        if (commentIndex === -1)
            return res.status(404).json({ success: false, error: "Comment not found" });
        const comment = comments[commentIndex];
        const isOwner = workspace.ownerId.toString() === userId;
        const isCoAdmin = workspace.coAdmins.includes(userId);
        const isAdmin = isOwner || isCoAdmin;
        const isCommentAuthor = comment.userId === userId;
        // Allow Admin OR Comment Author
        if (!isAdmin && !isCommentAuthor) {
            return res.status(403).json({ success: false, error: "You can only edit your own comments" });
        }
        comments[commentIndex].text = text;
        comments[commentIndex].updatedAt = new Date();
        await workspace.save();
        res.status(200).json({ success: true, data: workspace });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.editDocumentComment = editDocumentComment;
// Delete Comment
const deleteDocumentComment = async (req, res) => {
    try {
        const { id, analysisId, commentId } = req.params;
        const userId = req.user.userId;
        const workspace = await Workspace_1.default.findById(id);
        if (!workspace)
            return res.status(404).json({ success: false, error: "Workspace not found" });
        const docIndex = workspace.documents.findIndex(d => d.analysisId === analysisId);
        if (docIndex === -1)
            return res.status(404).json({ success: false, error: "Document not found" });
        const comments = workspace.documents[docIndex].comments;
        if (!comments)
            return res.status(404).json({ success: false, error: "Comment not found" });
        const comment = comments.find(c => c.id === commentId);
        if (!comment)
            return res.status(404).json({ success: false, error: "Comment not found" });
        const isOwner = workspace.ownerId.toString() === userId;
        const isCoAdmin = workspace.coAdmins.includes(userId);
        const isAdmin = isOwner || isCoAdmin;
        const isCommentAuthor = comment.userId === userId;
        // Allow Admin OR Comment Author
        if (!isAdmin && !isCommentAuthor) {
            return res.status(403).json({ success: false, error: "You can only delete your own comments" });
        }
        workspace.documents[docIndex].comments = comments.filter(c => c.id !== commentId);
        await workspace.save();
        res.status(200).json({ success: true, data: workspace });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.deleteDocumentComment = deleteDocumentComment;
// PMS: Get Board
const getWorkspaceBoard = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const workspace = await Workspace_1.default.findById(id);
        if (!workspace)
            return res.status(404).json({ success: false, error: "Workspace not found" });
        if (!workspace.members.includes(userId))
            return res.status(403).json({ success: false, error: "Access denied" });
        // Ensure at least one board exists
        if (!workspace.boards || workspace.boards.length === 0) {
            const defaultBoard = {
                id: (0, uuid_1.v4)(),
                name: 'Main Board',
                columns: ['To Do', 'In Progress', 'Done'],
                tasks: []
            };
            workspace.boards = [defaultBoard];
            await workspace.save();
        }
        res.status(200).json({ success: true, data: workspace.boards });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.getWorkspaceBoard = getWorkspaceBoard;
const archiveWorkspace = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const workspace = await Workspace_1.default.findById(id);
        if (!workspace)
            return res.status(404).json({ success: false, error: 'Workspace not found' });
        if (workspace.ownerId.toString() !== userId) {
            return res.status(403).json({ success: false, error: 'Only the workspace owner can archive it' });
        }
        workspace.isArchived = true;
        await workspace.save();
        res.status(200).json({ success: true, message: 'Workspace archived', data: workspace });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.archiveWorkspace = archiveWorkspace;
const unarchiveWorkspace = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const workspace = await Workspace_1.default.findById(id);
        if (!workspace)
            return res.status(404).json({ success: false, error: 'Workspace not found' });
        if (workspace.ownerId.toString() !== userId) {
            return res.status(403).json({ success: false, error: 'Only the workspace owner can unarchive it' });
        }
        workspace.isArchived = false;
        await workspace.save();
        res.status(200).json({ success: true, message: 'Workspace unarchived', data: workspace });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.unarchiveWorkspace = unarchiveWorkspace;
