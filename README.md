# Medical Image Styler

Transform surgical photographs into medical book illustration style using Google Gemini 3 Pro Image Preview.

## Features

- **Style Transfer**: Upload a reference pencil sketch and batch convert surgical photos to match that style
- **Annotation Removal**: Remove text labels, arrows, and markers from images
- **Parallel Processing**: Each image is processed by its own Gemini instance for maximum speed
- **Drag & Drop Interface**: Easy-to-use web interface

## Workflow

1. **Step 1 - Style Transfer**
   - Drop your reference image (femur with plate pencil sketch)
   - Drop multiple surgical technique photos
   - Click "Start Style Transfer" to process all images in parallel

2. **Step 2 - Annotation Removal**
   - Drop styled images that still have annotations
   - Or click "Remove Annotations" on any result to send it for cleanup
   - Process removes all text, arrows, and markers

## Deployment

### Deploy to Render

1. Push this repo to GitHub
2. Connect to Render and create a new Web Service
3. Set environment variable: `GEMINI_API_KEY=your_api_key`
4. Deploy

### Run Locally

```bash
npm install
npm start
```

Open http://localhost:3000

## Environment Variables

- `GEMINI_API_KEY` - Your Google AI API key
- `PORT` - Server port (default: 3000)

## API Endpoints

- `POST /api/batch-style-transfer` - Process multiple images with style reference
- `POST /api/batch-remove-annotations` - Remove annotations from multiple images
- `GET /api/health` - Health check
