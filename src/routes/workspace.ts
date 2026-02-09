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
    removeMember
} from '../controller/workspaceController';

const router = express.Router();

router.post('/create', auth, createWorkspace);
router.get('/', auth, getAllWorkspaces);
router.get('/:id', auth, getWorkspaceById);
router.post('/join', auth, joinWorkspace);
router.delete('/:id', auth, deleteWorkspace);
router.post('/:id/documents', auth, addDocument);
router.delete('/:id/documents/:analysisId', auth, removeDocument);
router.delete('/:id/members/:memberId', auth, removeMember);

export default router;
