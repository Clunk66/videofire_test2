# Video Story Generator

A web-based tool for creating engaging video stories with images, text, and audio. Perfect for creating social media stories and video content.

## Features

- Create multiple stories with images and text
- Add custom duration for each image
- Support for background audio
- Drag and drop image reordering
- Text animations and transitions
- Comic font option
- Export to WebM video format
- Mobile-friendly interface

## Usage

1. Visit [https://Clunk66.github.io/videofire_test](https://Clunk66.github.io/videofire_test)
2. Create a new project
3. Add images and text to your stories
4. Optionally add background audio
5. Generate and download your video

## Local Development

To run locally:

1. Clone the repository
```bash
git clone https://github.com/Clunk66/videofire_test.git
cd videofire_test
```

2. Serve with any static file server, for example:
```bash
python -m http.server 8000
# or
npx serve
```

3. Open `http://localhost:8000` in your browser

## Technical Details

- Pure JavaScript (no framework dependencies)
- Uses modern Web APIs:
  - MediaRecorder API for video generation
  - Canvas API for rendering
  - Web Audio API for audio processing
- Mobile-responsive design
- Client-side only (no server required)

## License

MIT License - See LICENSE file for details 