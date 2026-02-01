const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// API Key from environment variable only (never hardcode)
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('GEMINI_API_KEY environment variable is required');
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(API_KEY);

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Model configuration matching user's settings
// Using Gemini 3 Pro Image Preview as specified
const modelConfig = {
  model: 'gemini-3-pro-image-preview',
  generationConfig: {
    temperature: 1,
    responseModalities: ['image', 'text']
  }
};

// Helper to convert buffer to base64 for Gemini
function bufferToGenerativePart(buffer, mimeType) {
  return {
    inlineData: {
      data: buffer.toString('base64'),
      mimeType
    }
  };
}

// Helper to get mime type from filename
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  return mimeTypes[ext] || 'image/jpeg';
}

// Style transfer endpoint - processes one image with reference
app.post('/api/style-transfer', upload.fields([
  { name: 'reference', maxCount: 1 },
  { name: 'source', maxCount: 1 }
]), async (req, res) => {
  try {
    if (!req.files.reference || !req.files.source) {
      return res.status(400).json({ error: 'Both reference and source images required' });
    }

    const refFile = req.files.reference[0];
    const srcFile = req.files.source[0];
    const sourceFilename = srcFile.originalname;

    const refPart = bufferToGenerativePart(refFile.buffer, getMimeType(refFile.originalname));
    const srcPart = bufferToGenerativePart(srcFile.buffer, getMimeType(srcFile.originalname));

    const model = genAI.getGenerativeModel(modelConfig);

    const prompt = `You are given two images:

IMAGE 1 (REFERENCE STYLE): A medical book illustration showing a femur bone with a metal plate and screws attached - this is a pencil sketch/technical drawing style from a medical textbook.

IMAGE 2 (SOURCE TO RECREATE): A surgical technique step photograph showing an actual surgical procedure or patient positioning.

YOUR TASK: Recreate IMAGE 2 (the surgical technique photograph) faithfully but in the artistic style of IMAGE 1 (the pencil sketch medical illustration style). 

- Preserve all anatomical details, positioning, and content from the surgical photograph
- Transform it into the same pencil sketch/medical illustration style as the reference
- Keep the same composition and perspective
- The result should look like it belongs in the same medical textbook as the reference image

Generate the recreated image now.`;

    const result = await model.generateContent([prompt, refPart, srcPart]);
    const response = await result.response;

    // Extract image from response
    let imageData = null;
    let textResponse = '';

    if (response.candidates && response.candidates[0]) {
      const parts = response.candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData) {
          imageData = {
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType
          };
        }
        if (part.text) {
          textResponse = part.text;
        }
      }
    }

    if (!imageData) {
      return res.status(500).json({ 
        error: 'No image generated', 
        text: textResponse,
        fullResponse: JSON.stringify(response, null, 2)
      });
    }

    res.json({
      success: true,
      sourceFilename,
      image: imageData,
      text: textResponse
    });

  } catch (error) {
    console.error('Style transfer error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.toString()
    });
  }
});

// Batch style transfer - processes multiple images in parallel
app.post('/api/batch-style-transfer', upload.fields([
  { name: 'reference', maxCount: 1 },
  { name: 'sources', maxCount: 50 }
]), async (req, res) => {
  try {
    if (!req.files.reference || !req.files.sources) {
      return res.status(400).json({ error: 'Reference and source images required' });
    }

    const refFile = req.files.reference[0];
    const sourceFiles = req.files.sources;

    console.log(`Processing ${sourceFiles.length} images for style transfer...`);

    // Process all images in parallel
    const results = await Promise.allSettled(
      sourceFiles.map(async (srcFile) => {
        const refPart = bufferToGenerativePart(refFile.buffer, getMimeType(refFile.originalname));
        const srcPart = bufferToGenerativePart(srcFile.buffer, getMimeType(srcFile.originalname));

        const model = genAI.getGenerativeModel(modelConfig);

        const prompt = `You are given two images:

IMAGE 1 (REFERENCE STYLE): A medical book illustration showing a femur bone with a metal plate and screws attached - this is a pencil sketch/technical drawing style from a medical textbook.

IMAGE 2 (SOURCE TO RECREATE): A surgical technique step photograph showing an actual surgical procedure or patient positioning.

YOUR TASK: Recreate IMAGE 2 (the surgical technique photograph) faithfully but in the artistic style of IMAGE 1 (the pencil sketch medical illustration style). 

- Preserve all anatomical details, positioning, and content from the surgical photograph
- Transform it into the same pencil sketch/medical illustration style as the reference
- Keep the same composition and perspective
- The result should look like it belongs in the same medical textbook as the reference image

Generate the recreated image now.`;

        const result = await model.generateContent([prompt, refPart, srcPart]);
        const response = await result.response;

        let imageData = null;
        let textResponse = '';

        if (response.candidates && response.candidates[0]) {
          const parts = response.candidates[0].content.parts;
          for (const part of parts) {
            if (part.inlineData) {
              imageData = {
                data: part.inlineData.data,
                mimeType: part.inlineData.mimeType
              };
            }
            if (part.text) {
              textResponse = part.text;
            }
          }
        }

        return {
          sourceFilename: srcFile.originalname,
          image: imageData,
          text: textResponse
        };
      })
    );

    const processed = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          sourceFilename: sourceFiles[index].originalname,
          error: result.reason?.message || 'Unknown error'
        };
      }
    });

    res.json({
      success: true,
      total: sourceFiles.length,
      results: processed
    });

  } catch (error) {
    console.error('Batch style transfer error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Annotation removal endpoint - processes one image
app.post('/api/remove-annotations', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image required' });
    }

    const imgPart = bufferToGenerativePart(req.file.buffer, getMimeType(req.file.originalname));
    const sourceFilename = req.file.originalname;

    const model = genAI.getGenerativeModel(modelConfig);

    const prompt = `Remove all annotations from this image. Change nothing else. 

The image may contain text labels, arrows, numbers, letters, measurement lines, or other annotation markers. Remove all of these completely while preserving the underlying image exactly as it is.

Generate the clean image without any annotations.`;

    const result = await model.generateContent([prompt, imgPart]);
    const response = await result.response;

    let imageData = null;
    let textResponse = '';

    if (response.candidates && response.candidates[0]) {
      const parts = response.candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData) {
          imageData = {
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType
          };
        }
        if (part.text) {
          textResponse = part.text;
        }
      }
    }

    if (!imageData) {
      return res.status(500).json({ 
        error: 'No image generated',
        text: textResponse
      });
    }

    res.json({
      success: true,
      sourceFilename,
      image: imageData,
      text: textResponse
    });

  } catch (error) {
    console.error('Annotation removal error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch annotation removal - processes multiple images in parallel
app.post('/api/batch-remove-annotations', upload.array('images', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Images required' });
    }

    console.log(`Processing ${req.files.length} images for annotation removal...`);

    // Process all images in parallel
    const results = await Promise.allSettled(
      req.files.map(async (file) => {
        const imgPart = bufferToGenerativePart(file.buffer, getMimeType(file.originalname));

        const model = genAI.getGenerativeModel(modelConfig);

        const prompt = `Remove all annotations from this image. Change nothing else. 

The image may contain text labels, arrows, numbers, letters, measurement lines, or other annotation markers. Remove all of these completely while preserving the underlying image exactly as it is.

Generate the clean image without any annotations.`;

        const result = await model.generateContent([prompt, imgPart]);
        const response = await result.response;

        let imageData = null;
        let textResponse = '';

        if (response.candidates && response.candidates[0]) {
          const parts = response.candidates[0].content.parts;
          for (const part of parts) {
            if (part.inlineData) {
              imageData = {
                data: part.inlineData.data,
                mimeType: part.inlineData.mimeType
              };
            }
            if (part.text) {
              textResponse = part.text;
            }
          }
        }

        return {
          sourceFilename: file.originalname,
          image: imageData,
          text: textResponse
        };
      })
    );

    const processed = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          sourceFilename: req.files[index].originalname,
          error: result.reason?.message || 'Unknown error'
        };
      }
    });

    res.json({
      success: true,
      total: req.files.length,
      results: processed
    });

  } catch (error) {
    console.error('Batch annotation removal error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Medical Image Styler running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
