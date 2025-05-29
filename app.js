// Input validation helpers
const validators = {
  projectTitle: (value) => {
    return value.length > 0 && value.length <= 100;
  },
  imageText: (value) => {
    return value.length <= 500;
  },
  fileType: (file, allowedTypes) => {
    return allowedTypes.includes(file.type);
  },
  fileSize: (file, maxSize = 5 * 1024 * 1024) => { // 5MB max by default
    return file.size <= maxSize;
  }
};

// Security: Sanitize text input
function sanitizeText(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// File type checking - Security: Explicit allowed types
const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const allowedAudioTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg'];

class StoryEditor {
  constructor() {
    this.stories = [];
    this.currentStory = null;
    this.isDragging = false;
    this.draggedItem = null;
    this.isGenerating = false; // New flag to prevent multiple generations
    this.useComicFont = false; // New flag for font toggle
    this.audioFile = null; // Add audio file storage

    // Initialize elements
    this.initializeElements();
    this.attachEventListeners();

    // Add default story
    this.addStory();
  }

  initializeElements() {
    // Main containers
    this.storiesContainer = document.getElementById('stories');
    this.projectTitleInput = document.getElementById('project-title');
    this.statusElement = document.getElementById('status');
    this.downloads = document.getElementById('downloads');
    
    // File inputs
    this.imageUpload = document.getElementById('image-upload');
    this.audioInput = document.getElementById('audio-input');
    this.loadInput = document.getElementById('load-input');
    
    // Preview elements
    this.videoPreview = document.getElementById('videoPreview');
    this.canvas = document.getElementById('videoCanvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Buttons and controls
    this.generateButton = document.getElementById('generate-video');
    this.selectAudioButton = document.getElementById('select-audio');
    this.removeAudioButton = document.getElementById('remove-audio');
    this.addStoryButton = document.getElementById('add-story');
    this.newProjectButton = document.getElementById('new-project');
    this.saveProjectButton = document.getElementById('save-project');
    this.loadProjectButton = document.getElementById('load-project');
    this.comicFontToggle = document.getElementById('use-comic-font');
    
    // Templates
    this.storyTemplate = document.getElementById('story-template');
    this.imageTemplate = document.getElementById('image-item-template');

    // Validate required elements
    this.validateRequiredElements();
  }

  // Security: Validate all required elements exist
  validateRequiredElements() {
    const requiredElements = [
      'stories', 'project-title', 'status', 'downloads',
      'image-upload', 'audio-input', 'load-input',
      'videoPreview', 'videoCanvas',
      'generate-video', 'select-audio', 'remove-audio',
      'add-story', 'new-project', 'save-project', 'load-project',
      'story-template', 'image-item-template'
    ];

    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    if (missingElements.length > 0) {
      throw new Error(`Missing required elements: ${missingElements.join(', ')}`);
    }
  }

  attachEventListeners() {
    // Project controls
    this.newProjectButton.addEventListener('click', () => this.newProject());
    this.saveProjectButton.addEventListener('click', () => this.saveProject());
    this.loadProjectButton.addEventListener('click', () => this.loadInput.click());
    this.loadInput.addEventListener('change', (e) => this.loadProject(e));
    
    // Story controls
    this.addStoryButton.addEventListener('click', () => this.addStory());
    
    // Image upload
    this.imageUpload.addEventListener('change', (e) => this.handleImageUpload(e));
    
    // Audio controls
    this.selectAudioButton.addEventListener('click', () => this.audioInput.click());
    this.audioInput.addEventListener('change', (e) => this.handleAudioSelect(e));
    this.removeAudioButton.addEventListener('click', () => this.removeAudio());
    
    // Generate video with debounce
    this.generateButton.addEventListener('click', this.debounce(() => this.generateVideo(), 1000));
    
    // Add comic font toggle listener
    if (this.comicFontToggle) {
      this.comicFontToggle.addEventListener('change', (e) => {
        this.useComicFont = e.target.checked;
      });
    }
    
    // Project title validation
    this.projectTitleInput.addEventListener('input', (e) => {
      const isValid = validators.projectTitle(e.target.value);
      e.target.setCustomValidity(isValid ? '' : 'Project title is required and must be less than 100 characters');
    });
  }

  // Security: Debounce function to prevent rapid-fire clicks
  debounce(func, wait) {
    let timeout;
    return (...args) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        func.apply(this, args);
      }, wait);
    };
  }

  setStatus(message) {
    if (this.statusElement) {
      this.statusElement.textContent = sanitizeText(message);
    }
  }

  async handleAudioSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!validators.fileType(file, allowedAudioTypes)) {
      this.setStatus('Invalid audio file type. Please use MP3, WAV, or OGG.');
      return;
    }

    if (!validators.fileSize(file, 10 * 1024 * 1024)) { // 10MB limit for audio
      this.setStatus('Audio file is too large. Maximum size is 10MB.');
      return;
    }

    this.audioFile = file;
      document.getElementById('audio-name').textContent = sanitizeText(file.name);
      this.removeAudioButton.style.display = 'inline';
    this.hidePreview(); // Hide preview when audio is changed
      this.setStatus('Audio file selected.');
  }

  removeAudio() {
    this.audioFile = null;
    if (this.audioInput) {
      this.audioInput.value = '';
    }
      document.getElementById('audio-name').textContent = 'No audio selected';
      this.removeAudioButton.style.display = 'none';
    this.hidePreview(); // Hide preview when audio is removed
    this.setStatus('Audio removed.');
  }

  newProject(skipDefaultStory = false) {
    if (!confirm('Are you sure you want to start a new project? All unsaved changes will be lost.')) {
      return;
    }

    try {
      // Clean up existing object URLs
      this.stories.forEach(story => {
        story.images.forEach(image => {
          if (image.url) {
            URL.revokeObjectURL(image.url);
          }
        });
      });

      // Reset state
      this.stories = [];
      this.currentStory = null;
      this.isDragging = false;
      this.draggedItem = null;

      // Clear UI
      if (this.storiesContainer) {
        this.storiesContainer.innerHTML = '';
      }
      if (this.projectTitleInput) {
        this.projectTitleInput.value = '';
      }
      if (this.videoPreview) {
        this.videoPreview.src = '';
        this.videoPreview.style.display = 'none';
      }
      if (this.downloads) {
        this.downloads.innerHTML = '';
      }
      
      this.removeAudio();
      this.setStatus('New project started.');

      // Add default story only if not skipped
      if (!skipDefaultStory) {
        this.addStory();
      }
    } catch (error) {
      console.error('Error creating new project:', error);
      this.setStatus('Error creating new project. Please try again.');
    }
  }

  addStory(afterStoryId = null) {
    try {
      if (!this.storyTemplate || !this.storiesContainer) {
        throw new Error('Required elements not found');
      }

      const storyFragment = this.storyTemplate.content.cloneNode(true);
      const storyNode = storyFragment.querySelector('.story');
      const story = {
        id: Date.now(),
        images: [],
        transition: 'fade'
      };

      if (!storyNode) {
        throw new Error('Story template structure is invalid');
      }

      storyNode.dataset.storyId = story.id;

      // Set up all story event listeners
      this.setupStoryEventListeners(story, storyNode);

      // Insert the story at the correct position
      if (afterStoryId !== null) {
        const afterIndex = this.stories.findIndex(s => s.id === afterStoryId);
        if (afterIndex !== -1) {
          this.stories.splice(afterIndex + 1, 0, story);
          const afterElement = this.storiesContainer.querySelector(`[data-story-id="${afterStoryId}"]`);
          if (afterElement) {
            afterElement.after(storyNode);
          }
        }
      } else {
        this.stories.push(story);
        this.storiesContainer.appendChild(storyNode);
      }

      this.updateStoryNumbers();
      this.setStatus('New story added.');
    } catch (error) {
      console.error('Error adding story:', error);
      this.setStatus('Error adding story. Please try again.');
    }
  }

  deleteStory(storyId) {
    try {
      const index = this.stories.findIndex(s => s.id === storyId);
      if (index === -1) return;

      // Clean up image URLs
      this.stories[index].images.forEach(image => {
        if (image.url) {
          URL.revokeObjectURL(image.url);
        }
      });

      this.stories.splice(index, 1);
      const storyElement = this.storiesContainer?.querySelector(`[data-story-id="${storyId}"]`);
      if (storyElement) {
        storyElement.remove();
      }
      this.updateStoryNumbers();
      this.setStatus('Story deleted.');

      // Add a new story if there are none left
      if (this.stories.length === 0) {
        this.addStory();
      }
    } catch (error) {
      console.error('Error deleting story:', error);
      this.setStatus('Error deleting story. Please try again.');
    }
  }

  moveStory(storyId, direction) {
    try {
      const index = this.stories.findIndex(s => s.id === storyId);
      if (index === -1) return;

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= this.stories.length) return;

      // Get the story elements
      const currentElement = this.storiesContainer?.querySelector(`[data-story-id="${storyId}"]`);
      const otherElement = direction === 'up' 
        ? currentElement?.previousElementSibling 
        : currentElement?.nextElementSibling;

      if (!currentElement || !otherElement) return;

      // Swap stories in the data model
      [this.stories[index], this.stories[newIndex]] = [this.stories[newIndex], this.stories[index]];

      // Perform the DOM swap
      if (direction === 'up') {
        otherElement.parentNode?.insertBefore(currentElement, otherElement);
      } else {
        otherElement.parentNode?.insertBefore(otherElement, currentElement);
      }

      this.updateStoryNumbers();
      this.hidePreview(); // Hide preview when stories are reordered
      this.setStatus(`Story moved ${direction}.`);
    } catch (error) {
      console.error('Error moving story:', error);
      this.setStatus('Error moving story. Please try again.');
    }
  }

  updateStoryNumbers() {
    try {
      const stories = this.storiesContainer?.querySelectorAll('.story');
      if (!stories) return;

      stories.forEach((story, index) => {
        const numberElement = story.querySelector('.story-number');
        if (numberElement) {
          numberElement.textContent = (index + 1).toString();
        }
      });
    } catch (error) {
      console.error('Error updating story numbers:', error);
    }
  }

  async handleImageUpload(event) {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    this.hidePreview(); // Hide preview when new images are added

    for (const file of files) {
      if (!validators.fileType(file, allowedImageTypes)) {
        this.setStatus(`Invalid file type: ${sanitizeText(file.name)}. Skipping...`);
        continue;
      }

      if (!validators.fileSize(file)) {
        this.setStatus(`File too large: ${sanitizeText(file.name)}. Skipping...`);
        continue;
      }

      try {
        // Read file as base64
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });

        // Create blob URL for display
        const imageUrl = URL.createObjectURL(file);
        await this.addImageToStory(this.currentStory.id, imageUrl, base64Data);
      } catch (error) {
        console.error('Error adding image:', error);
        this.setStatus(`Error adding image: ${sanitizeText(file.name)}. Please try again.`);
      }
    }

    // Clear the input for security
    if (event.target) {
      event.target.value = '';
    }
  }

  async addImageToStory(storyId, imageUrl, base64Data) {
    try {
      const story = this.stories.find(s => s.id === storyId);
      if (!story) {
        throw new Error('Story not found');
      }

      if (!this.imageTemplate) {
        throw new Error('Image template not found');
      }

      const imageElement = this.imageTemplate.content.cloneNode(true);
      const imageItem = imageElement.querySelector('.image-item');
      const img = imageElement.querySelector('img');
      
      if (!imageItem || !img) {
        throw new Error('Invalid image template structure');
      }

      const imageData = {
        id: Date.now(),
        url: imageUrl,
        base64Data: base64Data,
        text: '',
        duration: 3 // Default duration in seconds
      };

      img.src = imageUrl;
      imageItem.dataset.imageId = imageData.id;

      this.setupImageEventListeners(story, imageItem, imageData);
      story.images.push(imageData);

      const storyElement = this.storiesContainer?.querySelector(`[data-story-id="${storyId}"]`);
      const imageList = storyElement?.querySelector('.image-list');
      
      if (!imageList) {
        throw new Error('Image list container not found');
      }

      imageList.appendChild(imageElement);
      this.setStatus('Image added successfully.');
    } catch (error) {
      console.error('Error adding image to story:', error);
      this.setStatus('Error adding image to story. Please try again.');
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    }
  }

  setupImageEventListeners(story, imageItem, imageData) {
    try {
      // Remove any existing event listeners
      const newImageItem = imageItem.cloneNode(true);
      imageItem.parentNode?.replaceChild(newImageItem, imageItem);
      imageItem = newImageItem;

      const textarea = imageItem.querySelector('.image-text');
      const durationInput = imageItem.querySelector('.image-duration');

      if (!textarea || !durationInput) {
        throw new Error('Required image controls not found');
      }

      // Add validation to textarea
      textarea.addEventListener('input', (e) => {
        const isValid = validators.imageText(e.target.value);
        e.target.setCustomValidity(isValid ? '' : 'Text must be less than 500 characters');
        if (isValid) {
          imageData.text = sanitizeText(e.target.value);
          this.hidePreview(); // Hide preview when text changes
        }
      });

      // Add duration input handler
      durationInput.value = imageData.duration?.toString() || '3';
      durationInput.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        if (value >= 1 && value <= 60) {
          imageData.duration = value;
          e.target.setCustomValidity('');
          this.hidePreview(); // Hide preview when duration changes
        } else {
          e.target.setCustomValidity('Duration must be between 1 and 60 seconds');
        }
      });

      // Delete image button
      const deleteButton = imageItem.querySelector('.delete-image');
      if (deleteButton) {
        const deleteHandler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          if (confirm('Are you sure you want to delete this image?')) {
            story.images = story.images.filter(img => img.id !== imageData.id);
            imageItem.remove();
            if (imageData.url) {
              URL.revokeObjectURL(imageData.url);
            }
            this.hidePreview(); // Hide preview when image is deleted
            this.setStatus('Image deleted successfully.');
          }
        };
        deleteButton.addEventListener('click', deleteHandler, { once: true });
      }

      // Move image buttons
      const moveUpBtn = imageItem.querySelector('.move-image-up');
      const moveDownBtn = imageItem.querySelector('.move-image-down');
      
      if (moveUpBtn && moveDownBtn) {
        moveUpBtn.addEventListener('click', () => {
          this.moveImage(story, imageItem, 'up');
          this.hidePreview(); // Hide preview when image is moved
        });
        moveDownBtn.addEventListener('click', () => {
          this.moveImage(story, imageItem, 'down');
          this.hidePreview(); // Hide preview when image is moved
        });
      }

      // Drag and drop
      this.setupDragAndDrop(imageItem);
    } catch (error) {
      console.error('Error setting up image event listeners:', error);
      this.setStatus('Error setting up image controls. Please try again.');
    }
  }

  moveImage(story, imageItem, direction) {
    try {
      const imageList = imageItem.parentElement;
      if (!imageList) return;

      const items = Array.from(imageList.children);
      const currentIndex = items.indexOf(imageItem);
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      if (newIndex < 0 || newIndex >= items.length) return;

      // Update DOM
      if (direction === 'up') {
        imageList.insertBefore(imageItem, items[newIndex]);
      } else {
        imageList.insertBefore(imageItem, items[newIndex].nextSibling);
      }

      // Update data model
      const imageId = parseInt(imageItem.dataset.imageId);
      const index = story.images.findIndex(img => img.id === imageId);
      if (index !== -1) {
        const [image] = story.images.splice(index, 1);
        story.images.splice(direction === 'up' ? index - 1 : index + 1, 0, image);
      }
    } catch (error) {
      console.error('Error moving image:', error);
      this.setStatus('Error moving image. Please try again.');
    }
  }

  setupDragAndDrop(imageItem) {
    if (!imageItem || !imageItem.parentElement) return;

    try {
      imageItem.addEventListener('dragstart', (e) => {
        this.isDragging = true;
        this.draggedItem = imageItem;
        imageItem.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      imageItem.addEventListener('dragend', () => {
        this.isDragging = false;
        this.draggedItem = null;
        imageItem.classList.remove('dragging');
      });

      const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (!this.isDragging || !this.draggedItem) return;
        
        const imageList = imageItem.parentElement;
        if (!imageList) return;

        const items = Array.from(imageList.children);
        const draggedIndex = items.indexOf(this.draggedItem);
        const targetIndex = items.indexOf(imageItem);
        
        if (draggedIndex === -1 || targetIndex === -1) return;
        
        const rect = imageItem.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        
        imageItem.style.borderTop = '';
        imageItem.style.borderBottom = '';
        
        if (draggedIndex < targetIndex && e.clientY > midY) {
          imageItem.style.borderBottom = '2px solid #007bff';
        } else if (draggedIndex > targetIndex && e.clientY <= midY) {
          imageItem.style.borderTop = '2px solid #007bff';
        }
      };

      imageItem.addEventListener('dragover', handleDragOver);
      
      imageItem.addEventListener('dragleave', () => {
        imageItem.style.borderTop = '';
        imageItem.style.borderBottom = '';
      });

      const handleDrop = (e) => {
        e.preventDefault();
        imageItem.style.borderTop = '';
        imageItem.style.borderBottom = '';
        
        if (!this.isDragging || !this.draggedItem || this.draggedItem === imageItem) return;

        const imageList = imageItem.parentElement;
        if (!imageList) return;

        const storyElement = imageList.closest('.story');
        if (!storyElement) return;

        const storyId = parseInt(storyElement.dataset.storyId);
        const story = this.stories.find(s => s.id === storyId);
        if (!story) return;

        const items = Array.from(imageList.children);
        const fromIndex = items.indexOf(this.draggedItem);
        const toIndex = items.indexOf(imageItem);

        if (fromIndex !== -1 && toIndex !== -1) {
          const rect = imageItem.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          
          // Update DOM
          if (fromIndex < toIndex && e.clientY > midY) {
            imageList.insertBefore(this.draggedItem, imageItem.nextSibling);
          } else {
            imageList.insertBefore(this.draggedItem, imageItem);
          }

          // Update data model
          const [movedImage] = story.images.splice(fromIndex, 1);
          const finalIndex = fromIndex < toIndex && e.clientY > midY ? toIndex : toIndex;
          story.images.splice(finalIndex, 0, movedImage);
        }
      };

      imageItem.addEventListener('drop', handleDrop);
      
      // Set up the image list container for drag and drop
      const imageList = imageItem.parentElement;
      if (imageList && !imageList.dataset.dragDropInitialized) {
        imageList.dataset.dragDropInitialized = 'true';
        
        imageList.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        });
        
        imageList.addEventListener('drop', (e) => {
          e.preventDefault();
          if (!this.isDragging || !this.draggedItem) return;
          
          const storyElement = imageList.closest('.story');
          if (!storyElement) return;

          const storyId = parseInt(storyElement.dataset.storyId);
          const story = this.stories.find(s => s.id === storyId);
          if (!story) return;
          
          const items = Array.from(imageList.children);
          const fromIndex = items.indexOf(this.draggedItem);
          
          if (fromIndex !== -1) {
            // If dropped at the end of the list
            imageList.appendChild(this.draggedItem);
            
            // Update data model
            const [movedImage] = story.images.splice(fromIndex, 1);
            story.images.push(movedImage);
          }
        });
      }
    } catch (error) {
      console.error('Error setting up drag and drop:', error);
      this.setStatus('Error setting up drag and drop functionality.');
    }
  }

  async saveProject() {
    try {
      if (!this.projectTitleInput?.value) {
        this.setStatus('Please enter a project title before saving.');
        return;
      }

      const project = {
        title: sanitizeText(this.projectTitleInput.value),
        stories: this.stories.map(story => ({
          id: story.id,
          transition: story.transition,
          images: story.images.map(img => ({
            id: img.id,
            text: sanitizeText(img.text || ''),
            imageData: img.base64Data || '',
            duration: Math.max(1, Math.min(60, parseInt(img.duration) || 3))  // Ensure duration is between 1-60
          }))
        }))
      };

      const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.setStatus('Project saved successfully.');
    } catch (error) {
      console.error('Error saving project:', error);
      this.setStatus('Error saving project. Please try again.');
    }
  }

  async loadProject(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const project = JSON.parse(text);

      // Validate project structure
      if (!project.title || !Array.isArray(project.stories)) {
        throw new Error('Invalid project file format');
      }

      // Start new project without creating a default story
      this.newProject(true);

      // Hide video preview and clear downloads
      if (this.videoPreview) {
        this.videoPreview.src = '';
        this.videoPreview.style.display = 'none';
      }
      if (this.downloads) {
        this.downloads.innerHTML = '';
      }

      // Load project data
      if (this.projectTitleInput) {
        this.projectTitleInput.value = sanitizeText(project.title);
      }

      // Load stories
      for (const storyData of project.stories) {
        if (!this.storyTemplate || !this.storiesContainer) {
          throw new Error('Required elements not found');
        }

        const storyElement = this.storyTemplate.content.cloneNode(true);
        const story = {
          id: storyData.id,
          images: [],
          transition: storyData.transition || 'fade'
        };

        // Set up story element
        const storyNode = storyElement.querySelector('.story');
        if (!storyNode) {
          throw new Error('Story template structure is invalid');
        }

        storyNode.dataset.storyId = story.id;

        // Add event listeners for story controls
        this.setupStoryEventListeners(story, storyNode);

        this.stories.push(story);
        this.storiesContainer.appendChild(storyElement);

        // Load images
        if (Array.isArray(storyData.images)) {
          for (const imageData of storyData.images) {
            if (!imageData.imageData) continue;

            await this.loadImageIntoStory(story, storyNode, imageData);
          }
        }
      }

      this.updateStoryNumbers();
      this.setStatus('Project loaded successfully.');
    } catch (error) {
      console.error('Error loading project:', error);
      this.setStatus('Error loading project. Please check the file format.');
    }

    // Clear the input for security
    if (event.target) {
      event.target.value = '';
    }
  }

  setupStoryEventListeners(story, storyNode) {
    // Add images button
    const addImagesBtn = storyNode.querySelector('.add-images');
    if (addImagesBtn) {
      addImagesBtn.addEventListener('click', () => {
        this.currentStory = story;
        this.imageUpload?.click();
      });
    }

    // Delete story button
    const deleteBtn = storyNode.querySelector('.delete-story');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete this story?')) {
          this.deleteStory(story.id);
        }
      });
    }

    // Add "Add Story Below" button
    const addStoryBelowBtn = document.createElement('button');
    addStoryBelowBtn.textContent = 'Add Story';
    addStoryBelowBtn.className = 'add-story-below';
    addStoryBelowBtn.addEventListener('click', () => {
      this.addStory(story.id);
    });
    
    // Add the new button to story controls
    const storyControls = storyNode.querySelector('.story-controls');
    if (storyControls) {
      storyControls.appendChild(addStoryBelowBtn);
    }

    // Move buttons
    const moveUpBtn = storyNode.querySelector('.move-story-up');
    const moveDownBtn = storyNode.querySelector('.move-story-down');
    if (moveUpBtn && moveDownBtn) {
      moveUpBtn.addEventListener('click', () => this.moveStory(story.id, 'up'));
      moveDownBtn.addEventListener('click', () => this.moveStory(story.id, 'down'));
    }

    // Transition select
    const transitionSelect = storyNode.querySelector('.transition-type');
    if (transitionSelect) {
      transitionSelect.value = story.transition;
      transitionSelect.addEventListener('change', (e) => {
        story.transition = e.target.value;
      });
    }
  }

  async loadImageIntoStory(story, storyNode, imageData) {
    try {
      if (!this.imageTemplate) {
        throw new Error('Image template not found');
      }

      const imageElement = this.imageTemplate.content.cloneNode(true);
      const imageItem = imageElement.querySelector('.image-item');
      const img = imageElement.querySelector('img');
      const textarea = imageElement.querySelector('.image-text');
      const durationInput = imageElement.querySelector('.image-duration');

      if (!imageItem || !img || !textarea || !durationInput) {
        throw new Error('Invalid image template structure');
      }

      const newImageData = {
        id: imageData.id,
        url: imageData.imageData,
        base64Data: imageData.imageData,
        text: sanitizeText(imageData.text || ''),
        duration: Math.max(1, Math.min(60, parseInt(imageData.duration) || 3))
      };

      img.src = newImageData.url;
      imageItem.dataset.imageId = newImageData.id;
      textarea.value = newImageData.text;
      durationInput.value = newImageData.duration.toString();

      this.setupImageEventListeners(story, imageItem, newImageData);
      story.images.push(newImageData);

      const imageList = storyNode.querySelector('.image-list');
      if (!imageList) {
        throw new Error('Image list container not found');
      }

      imageList.appendChild(imageElement);
    } catch (error) {
      console.error('Error loading image:', error);
      this.setStatus('Error loading some images. Please check the file.');
    }
  }

  async generateVideo() {
    if (this.isGenerating) {
      this.setStatus('Video generation already in progress...');
      return;
    }

    if (!this.stories.length) {
      this.setStatus('Please add at least one story before generating video.');
      return;
    }

    console.log('Starting video generation with stories:', this.stories);

    this.setStatus('Preparing to generate video...');
    this.isGenerating = true;
    
    // Disable all edit controls during generation
    this.disableEditControls();
    
    const progressStatus = document.createElement('div');
    progressStatus.className = 'progress-status';
    progressStatus.style.marginTop = '10px';
    this.statusElement?.appendChild(progressStatus);

    try {
      // First, preload all images
      for (const story of this.stories) {
        for (const image of story.images) {
          // Load the image and store it in the image object
          image.element = await this.loadImage(image.base64Data || image.url);
        }
      }

      // Set canvas size (9:16 aspect ratio)
      if (!this.canvas || !this.ctx) {
        throw new Error('Canvas context not available');
      }
      this.canvas.width = 720;
      this.canvas.height = 1280;
      
      const frameRate = 30;
      const transitionDuration = 0.5;
      const transitionFrames = Math.round(transitionDuration * frameRate);

      // Calculate total frames and duration
      let totalFrames = 0;
      let totalDuration = 0;
      
      // First pass: calculate exact frame count
      this.stories.forEach((story, storyIndex) => {
        story.images.forEach((image, imageIndex) => {
          const text = image.text || '';
          const sentences = text.trim() ? this.splitSentences(text) : [''];
          
          sentences.forEach((sentence, sentenceIndex) => {
            const duration = this.calculateSentenceDuration(sentence);
            totalFrames += Math.round(duration * frameRate);
            totalDuration += duration;

            if (sentenceIndex < sentences.length - 1) {
              totalFrames += transitionFrames;
              totalDuration += transitionDuration;
            }
          });
        });

        if (storyIndex < this.stories.length - 1) {
          totalFrames += transitionFrames;
          totalDuration += transitionDuration;
        }
      });

      console.log(`Total duration: ${totalDuration}s, Total frames: ${totalFrames}`);
      
      let frameCount = 0;
      const updateProgress = () => {
        if (frameCount >= totalFrames) return;
        const percent = Math.min(100, Math.round((frameCount / totalFrames) * 100));
        if (progressStatus) {
          progressStatus.textContent = `Progress: ${percent}%`;
        }
      };

      // Create media streams
      const videoStream = this.canvas.captureStream(frameRate);
      let combinedStream = videoStream;
      let audioCleanup = null;

      // If we have audio, create an audio stream and combine it
      if (this.audioFile) {
        try {
          const audioElement = new Audio();
          const audioBlob = new Blob([this.audioFile], { type: this.audioFile.type });
          const audioUrl = URL.createObjectURL(audioBlob);
          audioElement.src = audioUrl;
          
          // Wait for audio metadata to load
          await new Promise((resolve) => {
            audioElement.onloadedmetadata = resolve;
          });

          // Create audio context and connect nodes
          const audioContext = new AudioContext();
          const audioSource = audioContext.createMediaElementSource(audioElement);
          const gainNode = audioContext.createGain();
          audioSource.connect(gainNode);
          const audioDestination = audioContext.createMediaStreamDestination();
          gainNode.connect(audioDestination);
          
          // Calculate video duration in seconds
          const videoDurationSeconds = totalDuration;
          const audioDurationSeconds = audioElement.duration;
          
          // Set up audio behavior based on durations
          if (videoDurationSeconds <= audioDurationSeconds) {
            // Video is shorter than audio, we'll need to fade out
            audioElement.loop = false;
            
            // Start fade out 1 second before video ends
            const fadeOutStart = videoDurationSeconds - 1;
            
            // Schedule the fade out
            setTimeout(() => {
              const fadeOutDuration = 1; // 1 second fade
              const startTime = audioContext.currentTime;
              gainNode.gain.setValueAtTime(1, startTime);
              gainNode.gain.linearRampToValueAtTime(0, startTime + fadeOutDuration);
            }, fadeOutStart * 1000);
            
          } else {
            // Video is longer than audio, enable looping
            audioElement.loop = true;
          }
          
          // Combine video and audio streams
          const tracks = [
            ...videoStream.getTracks(),
            audioDestination.stream.getAudioTracks()[0]
          ];
          combinedStream = new MediaStream(tracks);
          
          // Store cleanup function
          audioCleanup = () => {
            // Ensure gain is set to 0 to prevent any audio bleed
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            audioElement.pause();
            audioElement.src = '';
            URL.revokeObjectURL(audioUrl);
            audioContext.close();
          };

          // Start audio when recording begins
          audioElement.play().catch(error => {
            console.error('Error playing audio:', error);
          });

        } catch (error) {
          console.error('Error setting up audio:', error);
          this.setStatus('Warning: Could not include audio in video.');
        }
      }

      // Initialize MediaRecorder with the final stream (combined or video-only)
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 8000000
      });

      const chunks = [];
      // Request data every second
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      
      // Set up stop handler
      mediaRecorder.onstop = () => {
        try {
          // Clean up audio if it exists
          if (audioCleanup) {
            audioCleanup();
          }

          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          if (this.videoPreview) {
            this.videoPreview.src = url;
            this.videoPreview.style.display = 'block';
          }
          
          if (this.downloads) {
            this.downloads.innerHTML = '';
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = 'video.webm';
            downloadLink.textContent = 'Download Video';
            downloadLink.className = 'download-button';
            this.downloads.appendChild(downloadLink);
          }
          
          progressStatus.remove();
          this.setStatus('Video generation complete!');
        } catch (error) {
          console.error('Error finalizing video:', error);
          this.setStatus('Error finalizing video. Please try again.');
        } finally {
          this.isGenerating = false;
          this.enableEditControls();
        }
      };

      // Start recording with timeslice to get regular ondataavailable events
      mediaRecorder.start(1000); // Get data every second

      // Process each story
      console.log('Starting frame processing...');
      for (let storyIndex = 0; storyIndex < this.stories.length && frameCount < totalFrames; storyIndex++) {
        const story = this.stories[storyIndex];
        console.log(`Processing story ${storyIndex + 1}/${this.stories.length}`);
        
        // Process each image in the story
        for (let imageIndex = 0; imageIndex < story.images.length && frameCount < totalFrames; imageIndex++) {
          const image = story.images[imageIndex];
          console.log(`Processing image ${imageIndex + 1}/${story.images.length}`);
          
          if (!image.element) {
            console.error('Image element not found:', image);
            continue;
          }

          const text = image.text || '';
          const sentences = text.trim() ? this.splitSentences(text) : [''];
          
          // Process each sentence for this image
          for (let sentenceIndex = 0; sentenceIndex < sentences.length && frameCount < totalFrames; sentenceIndex++) {
            const sentence = sentences[sentenceIndex];
            const duration = this.calculateSentenceDuration(sentence);
            const sentenceFrames = Math.round(duration * frameRate);
            
            console.log(`Drawing sentence ${sentenceIndex + 1}/${sentences.length} for ${sentenceFrames} frames`);
            
            // Draw current sentence frames
            for (let frame = 0; frame < sentenceFrames && frameCount < totalFrames; frame++) {
              await this.drawFrame(image, sentence);
              frameCount++;
              
              if (frameCount % 30 === 0) {
              updateProgress();
              }
              
              await this.waitForNextFrame(frameRate);
            }

            // Add transition to next sentence if not the last sentence
            if (sentenceIndex < sentences.length - 1) {
              const nextSentence = sentences[sentenceIndex + 1];
              console.log('Adding transition between sentences');
              
              for (let frame = 0; frame < transitionFrames && frameCount < totalFrames; frame++) {
                const progress = frame / transitionFrames;
                
                // Draw current sentence fading out
                await this.drawFrame(image, sentence, 1 - progress);
                
                // Draw next sentence fading in
                await this.drawFrame(image, nextSentence, progress);
                
                frameCount++;
                if (frameCount % 30 === 0) {
                updateProgress();
              }
                
                await this.waitForNextFrame(frameRate);
            }
          }
          }
        }

        // Add transition between stories
        if (storyIndex < this.stories.length - 1 && frameCount < totalFrames) {
          const nextStory = this.stories[storyIndex + 1];
          const currentImage = story.images[story.images.length - 1];
          const nextImage = nextStory.images[0];

          if (nextImage && nextImage.element && currentImage && currentImage.element) {
            console.log('Adding transition between stories');
            
            for (let frame = 0; frame < transitionFrames && frameCount < totalFrames; frame++) {
              const progress = frame / transitionFrames;
              
              // Draw current image fading out
              await this.drawFrame(currentImage, '', 1 - progress);
              
              // Draw next image fading in
              await this.drawFrame(nextImage, '', progress);
              
              frameCount++;
              if (frameCount % 30 === 0) {
              updateProgress();
              }
              
              await this.waitForNextFrame(frameRate);
            }
          }
        }
      }

      console.log('Frame processing complete, stopping MediaRecorder...');
      mediaRecorder.stop();
    } catch (error) {
      console.error('Error during video generation:', error);
      this.setStatus('Error generating video');
      progressStatus.remove();
    } finally {
      this.isGenerating = false;
      this.enableEditControls();
    }
  }

  async loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    });
  }

  drawImageCentered(img, offsetX = 0) {
    if (!img || !this.canvas || !this.ctx) {
      console.error('Missing required elements for drawing image');
      return;
    }

    try {
    const scale = Math.max(
      this.canvas.width / img.width,
      this.canvas.height / img.height
    );
    const x = offsetX + (this.canvas.width - img.width * scale) / 2;
    const y = (this.canvas.height - img.height * scale) / 2;
    this.ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
    } catch (error) {
      console.error('Error drawing image:', error);
    }
  }

  drawText(text) {
    if (!this.canvas || !this.ctx) return;

    try {
    const bottomPadding = this.canvas.height * 0.2; // 20% from bottom
    const lineHeight = 40;
    const minTextBoxHeight = 150;
    const verticalPadding = 40; // Padding inside text box
      
      // New margins to account for YouTube UI
      const leftMargin = this.canvas.width * 0.10; // 10% from left
      const rightMargin = this.canvas.width * 0.20; // 20% from right
      const textBoxWidth = this.canvas.width - leftMargin - rightMargin;

    // Set font based on toggle
    if (this.useComicFont) {
      this.ctx.font = '32px "Comic Sans MS", "Comic Sans", cursive';
    } else {
      this.ctx.font = '32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    }
    
      // Word wrap text with adjusted width
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const testLine = currentLine + ' ' + words[i];
      const metrics = this.ctx.measureText(testLine);
        if (metrics.width > textBoxWidth) {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);

    // Calculate text box height based on number of lines
    const textBoxHeight = Math.max(minTextBoxHeight, (lines.length * lineHeight) + (verticalPadding * 2));
    const textBoxY = this.canvas.height - bottomPadding - textBoxHeight;

      // Draw semi-transparent background for full width
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(0, textBoxY, this.canvas.width, textBoxHeight);
    
      // Draw text lines with adjusted positioning
    this.ctx.fillStyle = 'white';
      const startY = textBoxY + verticalPadding + (lineHeight / 2);
      const textX = leftMargin + (textBoxWidth / 2); // Center text between margins
      
      this.ctx.textAlign = 'center';
    lines.forEach((line, i) => {
        this.ctx.fillText(line, textX, startY + (i * lineHeight));
    });
    } catch (error) {
      console.error('Error drawing text:', error);
    }
  }

  splitSentences(text) {
    return text.match(/[^.!?]+[.!?]?/g)?.map(s => s.trim()).filter(Boolean) || [];
  }

  calculateSentenceDuration(sentence) {
    const wordCount = sentence.trim().split(/\s+/).length;
    return wordCount >= 10 ? 5 : 3; // 5 seconds for long sentences, 3 for short ones
  }

  // Helper method to wait for next frame while respecting frame rate
  async waitForNextFrame(frameRate) {
    const frameTime = 1000 / frameRate;
    await new Promise(resolve => setTimeout(resolve, frameTime));
  }

  // Helper method to draw a single frame
  async drawFrame(image, text, alpha = 1) {
    if (!image || !image.element) {
      console.error('Invalid image for frame:', image);
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.globalAlpha = alpha;
    this.drawImageCentered(image.element);
    
    if (text && text.trim()) {
      this.drawText(text);
    }
    
    this.ctx.globalAlpha = 1;
  }

  // Helper method to disable edit controls during generation
  disableEditControls() {
    // Disable all story-related buttons
    const buttons = document.querySelectorAll('.story button, #add-story, #new-project, #save-project, #load-project');
    buttons.forEach(button => {
      button.disabled = true;
    });

    // Disable all text inputs and file inputs
    const inputs = document.querySelectorAll('.image-text, .image-duration, #project-title');
    inputs.forEach(input => {
      input.disabled = true;
    });

    // Disable drag and drop
    const imageItems = document.querySelectorAll('.image-item');
    imageItems.forEach(item => {
      item.draggable = false;
    });

    this.generateButton.disabled = true;
  }

  // Helper method to enable edit controls after generation
  enableEditControls() {
    // Re-enable all story-related buttons
    const buttons = document.querySelectorAll('.story button, #add-story, #new-project, #save-project, #load-project');
    buttons.forEach(button => {
      button.disabled = false;
    });

    // Re-enable all text inputs and file inputs
    const inputs = document.querySelectorAll('.image-text, .image-duration, #project-title');
    inputs.forEach(input => {
      input.disabled = false;
    });

    // Re-enable drag and drop
    const imageItems = document.querySelectorAll('.image-item');
    imageItems.forEach(item => {
      item.draggable = true;
    });

    this.generateButton.disabled = false;
  }

  // Helper method to hide video preview
  hidePreview() {
    if (this.videoPreview) {
      this.videoPreview.src = '';
      this.videoPreview.style.display = 'none';
    }
    if (this.downloads) {
      this.downloads.innerHTML = '';
    }
  }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  try {
    new StoryEditor();
  } catch (error) {
    console.error('Error initializing application:', error);
    const status = document.getElementById('status');
    if (status) {
      status.textContent = 'Error initializing application. Please refresh the page.';
    }
  }
}); 