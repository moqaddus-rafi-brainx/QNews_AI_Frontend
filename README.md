# QNews AI - Video Analysis Module (Frontend)

This is the **Video Analysis** module of the **QNews AI App**, a React-based frontend that allows users to upload video files for AI-driven news content detection, classification, and summarization.

## 🔍 Features

- Upload a video file for analysis.
- Detect whether the video contains **news content**.
- Display the **language**, **category**, **main topic**, and **summary** of the video.
- Highlight **relevant** and **irrelevant** segments of the video.
- Auto-play and manually control the **clipped video** output.
- Display video transcript timestamps for both included and excluded content.

## 🚀 Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Cloudinary account

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Cloudinary Configuration
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name_here
VITE_CLOUDINARY_UPLOAD_PRESET=your_upload_preset_here

# Backend URL
VITE_BACKEND_URL=http://localhost:8000
```

#### Cloudinary Setup

1. Sign up for a [Cloudinary account](https://cloudinary.com/)
2. Get your **Cloud Name** from your dashboard
3. Create an **Upload Preset**:
   - Go to Settings > Upload
   - Scroll to Upload presets
   - Create a new preset or use an existing one
   - Set the preset to "Unsigned" for client-side uploads
   - Configure allowed formats to include video files

### Running the Application

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## 📝 Usage

1. Select a video file using the file input
2. Optionally add a summary of the video content
3. Click "Upload & Analyze Video" to start the process
4. The video will be uploaded to Cloudinary first, then sent to the backend for analysis
5. View the analysis results including the original and clipped videos



