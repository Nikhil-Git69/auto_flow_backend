import express from 'express';
import { auth } from '../middleware/auth';
import {
    createWorkspace,
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
    deleteDocumentComment
} from '../controller/workspaceController';

const router = express.Router();

router.post('/create', auth, createWorkspace);
router.get('/', auth, getAllWorkspaces);
router.get('/:id', auth, getWorkspaceById);
router.post('/join', auth, joinWorkspace);
router.delete('/:id', auth, deleteWorkspace);
router.post('/:id/documents', auth, addDocument);
router.delete('/:id/documents/:analysisId', auth, removeDocument);

router.patch('/:id/documents/:analysisId/status', auth, updateDocumentStatus); // Status update
router.post('/:id/documents/:analysisId/comments', auth, addDocumentComment); // Add comment
router.patch('/:id/documents/:analysisId/comments/:commentId', auth, editDocumentComment); // Edit comment
router.delete('/:id/documents/:analysisId/comments/:commentId', auth, deleteDocumentComment); // Delete comment

router.delete('/:id/members/:memberId', auth, removeMember);
router.post('/:id/tasks', auth, createTask);
router.patch('/:id/tasks/:taskId', auth, updateTask);
router.delete('/:id/tasks/:taskId', auth, deleteTask);
router.get('/:id/board', auth, getWorkspaceBoard);

export default router;
