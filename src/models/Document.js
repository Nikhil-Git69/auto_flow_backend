// backend/models/Document.js
const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  originalAnalysisId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Analysis'
  },
  fileName: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  fileData: {
    type: Buffer,
    required: true
  },
  fixesApplied: {
    type: Number,
    default: 0
  },
  issuesFixed: [{
    issueId: String,
    type: String,
    description: String,
    fixedAt: Date
  }],
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create index for faster queries
documentSchema.index({ userId: 1, uploadedAt: -1 });

module.exports = mongoose.model('Document', documentSchema);