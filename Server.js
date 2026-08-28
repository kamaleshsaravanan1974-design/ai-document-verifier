require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const cors = require('cors');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
  fileFilter: (req, file, cb) => {
    // Validate file types (accept images only)
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
  },
});

// Environment configuration
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const PORT = process.env.PORT || 3000;

/**
 * Health check endpoint
 * GET /health
 * Returns the status of the server and AI service connectivity
 */
app.get('/health', async (req, res) => {
  try {
    // Check if AI service is reachable
    const aiServiceHealth = await axios.get(`${AI_SERVICE_URL}/health`, {
      timeout: 5000,
    });

    res.status(200).json({
      status: 'healthy',
      server: 'running',
      timestamp: new Date().toISOString(),
      aiService: {
        url: AI_SERVICE_URL,
        status: 'reachable',
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      server: 'running',
      timestamp: new Date().toISOString(),
      aiService: {
        url: AI_SERVICE_URL,
        status: 'unreachable',
        error: error.message,
      },
    });
  }
});

/**
 * Document verification endpoint
 * POST /api/verify
 * Accepts documentType, documentImage, and optional selfieImage
 * Forwards to Python AI service for analysis
 */
app.post(
  '/api/verify',
  upload.fields([
    { name: 'documentImage', maxCount: 1 },
    { name: 'selfieImage', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      // Validate required fields
      const { documentType } = req.body;

      if (!documentType) {
        return res.status(400).json({
          error: 'Missing required field',
          message: 'documentType is required',
        });
      }

      if (!req.files || !req.files.documentImage || req.files.documentImage.length === 0) {
        return res.status(400).json({
          error: 'Missing required field',
          message: 'documentImage is required',
        });
      }

      // Extract files and data
      const documentImage = req.files.documentImage[0];
      const selfieImage = req.files.selfieImage ? req.files.selfieImage[0] : null;

      // Validate document type
      const validDocumentTypes = ['aadhaar', 'pan', 'license', 'passport', 'visa'];
      if (!validDocumentTypes.includes(documentType.toLowerCase())) {
        return res.status(400).json({
          error: 'Invalid document type',
          message: `documentType must be one of: ${validDocumentTypes.join(', ')}`,
        });
      }

      // Build multipart/form-data request
      const formData = new FormData();
      formData.append('documentType', documentType);
      formData.append('documentImage', documentImage.buffer, {
        filename: documentImage.originalname,
        contentType: documentImage.mimetype,
      });

      // Add optional selfie image if provided
      if (selfieImage) {
        formData.append('selfieImage', selfieImage.buffer, {
          filename: selfieImage.originalname,
          contentType: selfieImage.mimetype,
        });
      }

      // Forward request to Python AI service
      const response = await axios.post(`${AI_SERVICE_URL}/verify`, formData, {
        headers: formData.getHeaders(),
        timeout: 60000, // 60 second timeout for AI processing
      });

      // Return analysis results to client
      res.status(200).json({
        success: true,
        message: 'Document verification completed',
        data: response.data,
      });
    } catch (error) {
      // Handle different error types
      if (error.response) {
        // AI service returned an error response
        return res.status(error.response.status || 500).json({
          success: false,
          error: 'AI service error',
          message: error.response.data?.message || error.message,
          details: error.response.data,
        });
      }

      if (error.code === 'ECONNREFUSED') {
        return res.status(503).json({
          success: false,
          error: 'Service unavailable',
          message: `Cannot connect to AI service at ${AI_SERVICE_URL}`,
        });
      }

      if (error.code === 'ENOTFOUND') {
        return res.status(503).json({
          success: false,
          error: 'Service unavailable',
          message: `AI service host not found: ${AI_SERVICE_URL}`,
        });
      }

      if (error.message && error.message.includes('Invalid file type')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid file type',
          message: error.message,
        });
      }

      // Generic error response
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred',
      });
    }
  }
);

/**
 * Error handling middleware for multer
 */
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'FILE_TOO_LARGE') {
      return res.status(413).json({
        error: 'File too large',
        message: 'File size exceeds the maximum limit of 10 MB',
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        message: error.message,
      });
    }
    return res.status(400).json({
      error: 'File upload error',
      message: error.message,
    });
  }

  if (error) {
    return res.status(400).json({
      error: 'Request error',
      message: error.message,
    });
  }

  next();
});

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`AI Service URL: ${AI_SERVICE_URL}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
