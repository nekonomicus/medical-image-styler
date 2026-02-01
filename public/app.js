// State management
const state = {
  referenceImage: null,
  styleSources: [],
  annotationSources: [],
  results: []
};

// DOM Elements
const referenceZone = document.getElementById('reference-zone');
const referenceInput = document.getElementById('reference-input');
const referencePreview = document.getElementById('reference-preview');

const styleSourcesZone = document.getElementById('style-sources-zone');
const styleSourcesInput = document.getElementById('style-sources-input');
const styleSourcesPreview = document.getElementById('style-sources-preview');

const annotationSourcesZone = document.getElementById('annotation-sources-zone');
const annotationSourcesInput = document.getElementById('annotation-sources-input');
const annotationSourcesPreview = document.getElementById('annotation-sources-preview');

const startStyleTransferBtn = document.getElementById('start-style-transfer');
const startAnnotationRemovalBtn = document.getElementById('start-annotation-removal');
const styleProgress = document.getElementById('style-progress');
const annotationProgress = document.getElementById('annotation-progress');

const resultsGrid = document.getElementById('results-grid');
const downloadAllBtn = document.getElementById('download-all');
const clearResultsBtn = document.getElementById('clear-results');
const toastContainer = document.getElementById('toast-container');

// Utility functions
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function createPreviewItem(file, onRemove) {
  const item = document.createElement('div');
  item.className = 'preview-item';
  
  const img = document.createElement('img');
  img.src = URL.createObjectURL(file);
  
  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-btn';
  removeBtn.innerHTML = '×';
  removeBtn.onclick = (e) => {
    e.stopPropagation();
    onRemove();
  };
  
  const filename = document.createElement('div');
  filename.className = 'filename';
  filename.textContent = file.name;
  
  item.appendChild(img);
  item.appendChild(removeBtn);
  item.appendChild(filename);
  
  return item;
}

function updateReferencePreview() {
  referencePreview.innerHTML = '';
  if (state.referenceImage) {
    referencePreview.classList.add('active');
    referenceZone.classList.add('has-files');
    const item = createPreviewItem(state.referenceImage, () => {
      state.referenceImage = null;
      updateReferencePreview();
      updateButtons();
    });
    referencePreview.appendChild(item);
  } else {
    referencePreview.classList.remove('active');
    referenceZone.classList.remove('has-files');
  }
}

function updateStyleSourcesPreview() {
  styleSourcesPreview.innerHTML = '';
  if (state.styleSources.length > 0) {
    styleSourcesPreview.classList.add('active');
    styleSourcesZone.classList.add('has-files');
    state.styleSources.forEach((file, index) => {
      const item = createPreviewItem(file, () => {
        state.styleSources.splice(index, 1);
        updateStyleSourcesPreview();
        updateButtons();
      });
      styleSourcesPreview.appendChild(item);
    });
  } else {
    styleSourcesPreview.classList.remove('active');
    styleSourcesZone.classList.remove('has-files');
  }
}

function updateAnnotationSourcesPreview() {
  annotationSourcesPreview.innerHTML = '';
  if (state.annotationSources.length > 0) {
    annotationSourcesPreview.classList.add('active');
    annotationSourcesZone.classList.add('has-files');
    state.annotationSources.forEach((file, index) => {
      const item = createPreviewItem(file, () => {
        state.annotationSources.splice(index, 1);
        updateAnnotationSourcesPreview();
        updateButtons();
      });
      annotationSourcesPreview.appendChild(item);
    });
  } else {
    annotationSourcesPreview.classList.remove('active');
    annotationSourcesZone.classList.remove('has-files');
  }
}

function updateButtons() {
  startStyleTransferBtn.disabled = !state.referenceImage || state.styleSources.length === 0;
  startAnnotationRemovalBtn.disabled = state.annotationSources.length === 0;
  downloadAllBtn.disabled = state.results.length === 0;
}

function updateResultsGrid() {
  if (state.results.length === 0) {
    resultsGrid.innerHTML = '<div class="empty-state"><p>Results will appear here after processing</p></div>';
    return;
  }
  
  resultsGrid.innerHTML = '';
  state.results.forEach((result, index) => {
    const card = document.createElement('div');
    card.className = `result-card ${result.error ? 'error' : ''}`;
    
    if (result.error) {
      card.innerHTML = `
        <div class="error-message">Error: ${result.error}</div>
        <div class="card-info">
          <div class="card-title">${result.sourceFilename}</div>
          <div class="card-type ${result.type}">${result.type === 'style-transfer' ? 'Style Transfer' : 'Annotation Removal'}</div>
        </div>
      `;
    } else {
      const imgSrc = `data:${result.image.mimeType};base64,${result.image.data}`;
      card.innerHTML = `
        <div class="image-container">
          <img src="${imgSrc}" alt="${result.sourceFilename}">
        </div>
        <div class="card-info">
          <div class="card-title">${result.sourceFilename}</div>
          <div class="card-type ${result.type}">${result.type === 'style-transfer' ? 'Style Transfer' : 'Annotation Removal'}</div>
          <div class="card-actions">
            <button class="btn secondary download-btn" data-index="${index}">Download</button>
            <button class="btn secondary use-for-cleanup-btn" data-index="${index}">Remove Annotations</button>
          </div>
        </div>
      `;
    }
    
    resultsGrid.appendChild(card);
  });
  
  // Add event listeners for download buttons
  document.querySelectorAll('.download-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      downloadResult(state.results[index]);
    });
  });
  
  // Add event listeners for "use for cleanup" buttons
  document.querySelectorAll('.use-for-cleanup-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const index = parseInt(btn.dataset.index);
      const result = state.results[index];
      if (result.image) {
        // Convert base64 to blob and add to annotation sources
        const response = await fetch(`data:${result.image.mimeType};base64,${result.image.data}`);
        const blob = await response.blob();
        const file = new File([blob], `styled_${result.sourceFilename}`, { type: result.image.mimeType });
        state.annotationSources.push(file);
        updateAnnotationSourcesPreview();
        updateButtons();
        showToast('Image added to annotation removal queue', 'success');
      }
    });
  });
}

function downloadResult(result) {
  if (!result.image) return;
  
  const link = document.createElement('a');
  link.href = `data:${result.image.mimeType};base64,${result.image.data}`;
  const ext = result.image.mimeType.split('/')[1] || 'png';
  const prefix = result.type === 'style-transfer' ? 'styled_' : 'clean_';
  link.download = `${prefix}${result.sourceFilename.replace(/\.[^.]+$/, '')}.${ext}`;
  link.click();
}

async function downloadAllResults() {
  for (const result of state.results) {
    if (result.image) {
      downloadResult(result);
      await new Promise(r => setTimeout(r, 200)); // Small delay between downloads
    }
  }
}

// Setup drag and drop
function setupDropZone(zone, input, onFilesAdded, multiple = false) {
  zone.addEventListener('click', () => input.click());
  
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  
  zone.addEventListener('dragleave', () => {
    zone.classList.remove('drag-over');
  });
  
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      onFilesAdded(multiple ? files : [files[0]]);
    }
  });
  
  input.addEventListener('change', () => {
    const files = Array.from(input.files);
    if (files.length > 0) {
      onFilesAdded(multiple ? files : [files[0]]);
    }
    input.value = '';
  });
}

// Setup all drop zones
setupDropZone(referenceZone, referenceInput, (files) => {
  state.referenceImage = files[0];
  updateReferencePreview();
  updateButtons();
}, false);

setupDropZone(styleSourcesZone, styleSourcesInput, (files) => {
  state.styleSources.push(...files);
  updateStyleSourcesPreview();
  updateButtons();
}, true);

setupDropZone(annotationSourcesZone, annotationSourcesInput, (files) => {
  state.annotationSources.push(...files);
  updateAnnotationSourcesPreview();
  updateButtons();
}, true);

// API calls
async function processStyleTransfer() {
  if (!state.referenceImage || state.styleSources.length === 0) return;
  
  startStyleTransferBtn.classList.add('loading');
  startStyleTransferBtn.disabled = true;
  
  const formData = new FormData();
  formData.append('reference', state.referenceImage);
  state.styleSources.forEach(file => {
    formData.append('sources', file);
  });
  
  styleProgress.textContent = `Processing ${state.styleSources.length} image(s)...`;
  
  try {
    const response = await fetch('/api/batch-style-transfer', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (data.success) {
      data.results.forEach(result => {
        state.results.unshift({
          ...result,
          type: 'style-transfer'
        });
      });
      updateResultsGrid();
      updateButtons();
      
      const successCount = data.results.filter(r => r.image).length;
      showToast(`Style transfer complete: ${successCount}/${data.total} images processed`, 'success');
      
      // Clear sources after successful processing
      state.styleSources = [];
      updateStyleSourcesPreview();
    } else {
      showToast(`Error: ${data.error}`, 'error');
    }
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  } finally {
    startStyleTransferBtn.classList.remove('loading');
    styleProgress.textContent = '';
    updateButtons();
  }
}

async function processAnnotationRemoval() {
  if (state.annotationSources.length === 0) return;
  
  startAnnotationRemovalBtn.classList.add('loading');
  startAnnotationRemovalBtn.disabled = true;
  
  const formData = new FormData();
  state.annotationSources.forEach(file => {
    formData.append('images', file);
  });
  
  annotationProgress.textContent = `Removing annotations from ${state.annotationSources.length} image(s)...`;
  
  try {
    const response = await fetch('/api/batch-remove-annotations', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (data.success) {
      data.results.forEach(result => {
        state.results.unshift({
          ...result,
          type: 'annotation-removal'
        });
      });
      updateResultsGrid();
      updateButtons();
      
      const successCount = data.results.filter(r => r.image).length;
      showToast(`Annotation removal complete: ${successCount}/${data.total} images processed`, 'success');
      
      // Clear sources after successful processing
      state.annotationSources = [];
      updateAnnotationSourcesPreview();
    } else {
      showToast(`Error: ${data.error}`, 'error');
    }
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  } finally {
    startAnnotationRemovalBtn.classList.remove('loading');
    annotationProgress.textContent = '';
    updateButtons();
  }
}

// Event listeners
startStyleTransferBtn.addEventListener('click', processStyleTransfer);
startAnnotationRemovalBtn.addEventListener('click', processAnnotationRemoval);
downloadAllBtn.addEventListener('click', downloadAllResults);
clearResultsBtn.addEventListener('click', () => {
  state.results = [];
  updateResultsGrid();
  updateButtons();
  showToast('Results cleared', 'info');
});

// Initial state
updateButtons();
