import multer from 'multer';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Configure multer storage and file filter
const storage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/jpg'
  ];

  const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg'];
  const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  
  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`));
  }
};

// Create multer instances for different use cases
export const uploadSingle = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
}).single('document');

export const uploadMultiple = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
}).fields([
  { name: 'document', maxCount: 1 },
  { name: 'templateFile', maxCount: 1 }
]);

export const uploadAny = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
}).any();

export { MAX_FILE_SIZE };