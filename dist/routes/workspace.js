"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const workspaceController_1 = require("../controller/workspaceController");
const router = express_1.default.Router();
router.post('/create', auth_1.auth, workspaceController_1.createWorkspace);
router.get('/', auth_1.auth, workspaceController_1.getAllWorkspaces);
router.get('/:id', auth_1.auth, workspaceController_1.getWorkspaceById);
router.post('/join', auth_1.auth, workspaceController_1.joinWorkspace);
router.delete('/:id', auth_1.auth, workspaceController_1.deleteWorkspace);
router.post('/:id/documents', auth_1.auth, workspaceController_1.addDocument);
router.delete('/:id/documents/:analysisId', auth_1.auth, workspaceController_1.removeDocument);
router.patch('/:id/documents/:analysisId/status', auth_1.auth, workspaceController_1.updateDocumentStatus); // Status update
router.post('/:id/documents/:analysisId/comments', auth_1.auth, workspaceController_1.addDocumentComment); // Add comment
router.patch('/:id/documents/:analysisId/comments/:commentId', auth_1.auth, workspaceController_1.editDocumentComment); // Edit comment
router.delete('/:id/documents/:analysisId/comments/:commentId', auth_1.auth, workspaceController_1.deleteDocumentComment); // Delete comment
router.delete('/:id/members/:memberId', auth_1.auth, workspaceController_1.removeMember);
router.post('/:id/tasks', auth_1.auth, workspaceController_1.createTask);
router.patch('/:id/tasks/:taskId', auth_1.auth, workspaceController_1.updateTask);
router.delete('/:id/tasks/:taskId', auth_1.auth, workspaceController_1.deleteTask);
router.get('/:id/board', auth_1.auth, workspaceController_1.getWorkspaceBoard);
exports.default = router;
