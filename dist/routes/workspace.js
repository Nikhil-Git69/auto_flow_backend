"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middleware/auth");
const workspaceController_1 = require("../controller/workspaceController");
const adminUploadController_1 = require("../controller/adminUploadController");
const router = express_1.default.Router();
// Multer with memory storage (100 MB limit)
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }
});
// Workspace CRUD
router.post('/create', auth_1.auth, workspaceController_1.createWorkspace);
router.get('/', auth_1.auth, workspaceController_1.getAllWorkspaces);
router.get('/:id', auth_1.auth, workspaceController_1.getWorkspaceById);
router.patch('/:id', auth_1.auth, workspaceController_1.updateWorkspace);
router.post('/join', auth_1.auth, workspaceController_1.joinWorkspace);
router.patch('/:id/archive', auth_1.auth, workspaceController_1.archiveWorkspace);
router.patch('/:id/unarchive', auth_1.auth, workspaceController_1.unarchiveWorkspace);
router.delete('/:id', auth_1.auth, workspaceController_1.deleteWorkspace);
// Documents
router.post('/:id/documents', auth_1.auth, workspaceController_1.addDocument);
router.delete('/:id/documents/:analysisId', auth_1.auth, workspaceController_1.removeDocument);
router.patch('/:id/documents/:analysisId/status', auth_1.auth, workspaceController_1.updateDocumentStatus);
router.post('/:id/documents/:analysisId/comments', auth_1.auth, workspaceController_1.addDocumentComment);
router.patch('/:id/documents/:analysisId/comments/:commentId', auth_1.auth, workspaceController_1.editDocumentComment);
router.delete('/:id/documents/:analysisId/comments/:commentId', auth_1.auth, workspaceController_1.deleteDocumentComment);
// Members
router.delete('/:id/members/:memberId', auth_1.auth, workspaceController_1.removeMember);
router.post('/:id/members/:memberId/promote', auth_1.auth, workspaceController_1.promoteToCoAdmin);
router.post('/:id/members/:memberId/demote', auth_1.auth, workspaceController_1.demoteToMember);
// PMS Tasks
router.post('/:id/tasks', auth_1.auth, workspaceController_1.createTask);
router.patch('/:id/tasks/:taskId', auth_1.auth, workspaceController_1.updateTask);
router.delete('/:id/tasks/:taskId', auth_1.auth, workspaceController_1.deleteTask);
router.get('/:id/board', auth_1.auth, workspaceController_1.getWorkspaceBoard);
// Admin Direct Uploads
router.post('/:id/admin-upload', auth_1.auth, upload.single('file'), adminUploadController_1.uploadAdminFile);
router.delete('/:id/admin-upload/:uploadId', auth_1.auth, adminUploadController_1.deleteAdminFile);
router.get('/:id/admin-upload/:uploadId/download', auth_1.auth, adminUploadController_1.downloadAdminFile);
exports.default = router;
