import express from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth';
import {
    createWorkspace,
    updateWorkspace,
    getAllWorkspaces,
    getWorkspaceById,
    joinWorkspace,
    deleteWorkspace,
    addDocument,
    removeDocument,
    removeMember,
    createTask,
    updateTask,
    deleteTask,
    getWorkspaceBoard,
    updateDocumentStatus,
    addDocumentComment,
    editDocumentComment,
    deleteDocumentComment,
    promoteToCoAdmin,
    demoteToMember,
    archiveWorkspace,
    unarchiveWorkspace
} from '../controller/workspaceController';
import {
    uploadAdminFile,
    deleteAdminFile,
    downloadAdminFile
} from '../controller/adminUploadController';

const router = express.Router();

// Multer with memory storage (100 MB limit)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }
});

// Workspace CRUD
router.post('/create', auth, createWorkspace);
router.get('/', auth, getAllWorkspaces);
router.get('/:id', auth, getWorkspaceById);
router.patch('/:id', auth, updateWorkspace);
router.post('/join', auth, joinWorkspace);
router.patch('/:id/archive', auth, archiveWorkspace);
router.patch('/:id/unarchive', auth, unarchiveWorkspace);
router.delete('/:id', auth, deleteWorkspace);

// Documents
router.post('/:id/documents', auth, addDocument);
router.delete('/:id/documents/:analysisId', auth, removeDocument);
router.patch('/:id/documents/:analysisId/status', auth, updateDocumentStatus);
router.post('/:id/documents/:analysisId/comments', auth, addDocumentComment);
router.patch('/:id/documents/:analysisId/comments/:commentId', auth, editDocumentComment);
router.delete('/:id/documents/:analysisId/comments/:commentId', auth, deleteDocumentComment);

// Members
router.delete('/:id/members/:memberId', auth, removeMember);
router.post('/:id/members/:memberId/promote', auth, promoteToCoAdmin);
router.post('/:id/members/:memberId/demote', auth, demoteToMember);

// PMS Tasks
router.post('/:id/tasks', auth, createTask);
router.patch('/:id/tasks/:taskId', auth, updateTask);
router.delete('/:id/tasks/:taskId', auth, deleteTask);
router.get('/:id/board', auth, getWorkspaceBoard);

// Admin Direct Uploads
router.post('/:id/admin-upload', auth, upload.single('file'), uploadAdminFile);
router.delete('/:id/admin-upload/:uploadId', auth, deleteAdminFile);
router.get('/:id/admin-upload/:uploadId/download', auth, downloadAdminFile);

export default router;
