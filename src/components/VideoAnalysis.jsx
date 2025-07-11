import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './VideoAnalysis.css';

const VideoAnalysis = () => {
  const [video, setVideo] = useState(null);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [videoLoading, setVideoLoading] = useState({});
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMethod, setUploadMethod] = useState('cloudinary');
  const videoRefs = useRef({});
  const originalVideoRef = useRef(null);
  const retryCountRef = useRef({});
  const isVideoLoadedRef = useRef({});
  const maxRetries = 10;
  const initialDelay = 2000; // 2 seconds

  // Cloudinary configuration
  const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  const handleVideoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideo(file);
      setError(null);
      setUploadProgress(0);
    }
  };

  // Function to upload video to Cloudinary
  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('resource_type', 'video');
    formData.append('folder', 'my_videos');

    try {
      const response = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          },
        }
      );
      
      return response.data.secure_url;
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new Error('Failed to upload video to Cloudinary: ' + error.message);
    }
  };

  // Function to get signed URL from backend and upload to Google Cloud Storage
  const uploadToGoogleCloudStorage = async (file) => {
    try {
      // Step 1: Get signed URL from backend
      console.log('Requesting signed URL from backend...');
      const signedUrlResponse = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/get-signed-url`,
        {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const { signedUrl, filePath, publicUrl } = signedUrlResponse.data.data;
      console.log('Received signed URL:', signedUrl);

      // Step 2: Upload video to Google Cloud Storage using signed URL
      console.log('Uploading video to Google Cloud Storage...');
      await axios.put(signedUrl, file, {
        headers: {
          'Content-Type': file.type,
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      });

      console.log('Video uploaded successfully to Google Cloud Storage');
      console.log('Public URL:', publicUrl);
     

      // Step 3: Send GS URI and public URL to backend for analysis
      console.log('Sending video details to backend for analysis...');
      const analysisResponse = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/analyze-video2`,
        {
          filePath: filePath,
          publicUrl: publicUrl,
          summary: summary,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return analysisResponse;
    } catch (error) {
      console.error('Google Cloud Storage upload error:', error);
      throw new Error('Failed to upload video to Google Cloud Storage: ' + error.message);
    }
  };

  console.log("video analysis")

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!video) {
      setError('Please select a video file');
      return;
    }

    setLoading(true);
    setError(null);
    setVideoLoading({});
    setUploadProgress(0);
    isVideoLoadedRef.current = {};
    retryCountRef.current = {};

    try {
      let response;
      
      if (uploadMethod === 'cloudinary') {
        // Step 1: Upload video to Cloudinary
        console.log('Uploading video to Cloudinary...');
        const cloudinaryUrl = await uploadToCloudinary(video);
        console.log('Video uploaded successfully:', cloudinaryUrl);

        // Step 2: Send video URL and summary to backend
        console.log('Sending video URL to backend...');
        response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/analyze-video`, {
          videoUrl: cloudinaryUrl,
          summary: summary,
        }, {
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } else if (uploadMethod === 'gcs') {
        // Google Cloud Storage upload
        console.log('Uploading video to Google Cloud Storage...');
        response = await uploadToGoogleCloudStorage(video);
      }

      setAnalysis(response.data);
      
      // Handle both old and new response structures
      if (response.data.processedChunks) {
        // New chunk-based structure
        const initialVideoLoading = {};
        const initialRetryCount = {};
        const initialIsVideoLoaded = {};
        
        response.data.processedChunks.forEach((chunk, index) => {
          if (chunk.finalVideoUrl) {
            initialVideoLoading[index] = false;
            initialRetryCount[index] = 0;
            initialIsVideoLoaded[index] = false;
          }
        });
        
        setVideoLoading(initialVideoLoading);
        retryCountRef.current = initialRetryCount;
        isVideoLoadedRef.current = initialIsVideoLoaded;
      } else if (response.data.videoWithAudioUrl) {
        // Old single video structure - use index 0 for backward compatibility
        setVideoLoading({ 0: false });
        retryCountRef.current = { 0: 0 };
        isVideoLoadedRef.current = { 0: false };
      }
    } catch (err) {
      console.log(err);
      setError('Error analyzing video: ' + (err?.response?.data?.trace || err.response?.data?.message || err.message));
      setVideoLoading({});
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const checkVideoAvailability = async (url) => {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      return false;
    }
  };

  const retryVideoLoad = async (url, chunkIndex) => {
    if (isVideoLoadedRef.current[chunkIndex] || retryCountRef.current[chunkIndex] >= maxRetries) {
      if (!isVideoLoadedRef.current[chunkIndex]) {
        setError('Video is taking longer than expected to become available. Please try the "Open Video in New Tab" button.');
      }
      setVideoLoading(prev => ({ ...prev, [chunkIndex]: false }));
      return;
    }

    const delay = initialDelay * Math.pow(2, retryCountRef.current[chunkIndex]);
    await new Promise(resolve => setTimeout(resolve, delay));

    const isAvailable = await checkVideoAvailability(url);
    if (isAvailable) {
      if (videoRefs.current[chunkIndex]) {
        videoRefs.current[chunkIndex].load();
        videoRefs.current[chunkIndex].play().catch(() => {
          // If play fails, we'll let the user click the play button
          setVideoLoading(prev => ({ ...prev, [chunkIndex]: false }));
        });
      }
    } else {
      retryCountRef.current[chunkIndex] += 1;
      retryVideoLoad(url, chunkIndex);
    }
  };

  const handlePlayVideo = async (chunkIndex) => {
    if (videoRefs.current[chunkIndex]) {
      try {
        setVideoLoading(prev => ({ ...prev, [chunkIndex]: true }));
        await videoRefs.current[chunkIndex].play();
        setVideoLoading(prev => ({ ...prev, [chunkIndex]: false }));
      } catch (error) {
        console.error('Play error:', error);
        setError('Error playing video: ' + error.message);
        setVideoLoading(prev => ({ ...prev, [chunkIndex]: false }));
      }
    }
  };

  const renderChunkContent = (chunk, chunkIndex) => {
    if (chunk.highlights && chunk.highlights.length > 0) {
      return (
        <div className="chunk-content">
          <h4>Highlights ({chunk.highlightsCount})</h4>
          {chunk.highlights.map((highlight, highlightIndex) => (
            <div key={`highlight-${chunkIndex}-${highlightIndex}`} className="highlight-item">
              <div className="highlight-time">
                {formatTime(highlight.start)} - {formatTime(highlight.end)}
              </div>
              <div className="highlight-text">{highlight.highlight}</div>
              <div className="highlight-summary">{highlight.highlightSummary}</div>
            </div>
          ))}
        </div>
      );
    } else if (chunk.sentences && chunk.sentences.length > 0) {
      return (
        <div className="chunk-content">
          <h4>Sentences ({chunk.sentences.length})</h4>
          {chunk.sentences.map((sentence, sentenceIndex) => (
            <div key={`sentence-${chunkIndex}-${sentenceIndex}`} className="sentence-item">
              <div className="sentence-time">
                {formatTime(sentence.startTime)} - {formatTime(sentence.endTime)}
                {sentence.isImportant && <span className="important-badge">Important</span>}
              </div>
              <div className="sentence-text">{sentence.transcript}</div>
              {sentence.importanceReasoning && (
                <div className="importance-reasoning">{sentence.importanceReasoning}</div>
              )}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderProcessedChunks = () => {
    if (!analysis.processedChunks || analysis.processedChunks.length === 0) {
      return null;
    }

    return (
      <div className="result-section">
        <h3>Processed Video Chunks ({analysis.totalChunks})</h3>
        {analysis.processedChunks.map((chunk, chunkIndex) => (
          <div key={`chunk-${chunkIndex}`} className="chunk-container">
            <div className="chunk-header">
              <h4>Chunk {chunkIndex + 1}</h4>
              <div className="chunk-meta">
                <span>Duration: {formatTime(chunk.totalDuration)}</span>
    
                {chunk.processingStatus === 'failed' && (
                  <span className="error-status">Processing Failed</span>
                )}
              </div>
            </div>

            <div className="chunk-summary">
              <strong>Summary:</strong> {chunk.summary}
            </div>

            {/* Video Player for this chunk */}
            {chunk.finalVideoUrl && (
              <div className="video-player-container">
                <video 
                  ref={(el) => { videoRefs.current[chunkIndex] = el; }}
                  key={chunk.finalVideoUrl}
                  controls 
                  className="chunk-video"
                  crossOrigin="anonymous"
                  onError={(e) => {
                    console.error('Video Error:', e.target.error);
                    if (e.target.error?.code === 4 && !isVideoLoadedRef.current[chunkIndex]) {
                      retryVideoLoad(chunk.finalVideoUrl, chunkIndex);
                    } else if (!isVideoLoadedRef.current[chunkIndex]) {
                      setError('Video cannot be played directly. Please use the "Open Video in New Tab" button to view the video.');
                      setVideoLoading(prev => ({ ...prev, [chunkIndex]: false }));
                    }
                  }}
                  onLoadedData={() => {
                    setError(null);
                    setVideoLoading(prev => ({ ...prev, [chunkIndex]: false }));
                    isVideoLoadedRef.current[chunkIndex] = true;
                  }}
                  preload="auto"
                >
                  <source 
                    src={chunk.finalVideoUrl} 
                    type="video/mp4"
                  />
                  Your browser does not support the video tag.
                </video>
                <div className="video-url-info">
                  <small>Chunk Video URL: {chunk.finalVideoUrl}</small>
                </div>
                <div className="video-debug-info">
                  <button 
                    onClick={() => handlePlayVideo(chunkIndex)}
                    className="debug-button"
                    style={{ marginRight: '10px' }}
                    disabled={videoLoading[chunkIndex]}
                  >
                    {videoLoading[chunkIndex] ? 'Loading Video...' : 'Play Video'}
                  </button>
                  <button 
                    onClick={() => window.open(chunk.finalVideoUrl, '_blank')}
                    className="debug-button"
                  >
                    Open Chunk Video in New Tab
                  </button>
                </div>
              </div>
            )}

            {/* Error message if processing failed */}
            {chunk.processingStatus === 'failed' && chunk.error && (
              <div className="error-message">
                <strong>Processing Error:</strong> {chunk.error}
              </div>
            )}

            {/* Render highlights or sentences */}
            {renderChunkContent(chunk, chunkIndex)}
          </div>
        ))}
      </div>
    );
  };

  const renderLegacySingleVideo = () => {
    if (!analysis.videoWithAudioUrl) {
      return null;
    }

    return (
      <div className="result-section">
        <h3>Clipped Video</h3>
        <div className="video-player-container">
          <video 
            ref={(el) => { videoRefs.current[0] = el; }}
            key={analysis.videoWithAudioUrl}
            controls 
            className="clipped-video"
            crossOrigin="anonymous"
            onError={(e) => {
              console.error('Video Error:', e.target.error);
              if (e.target.error?.code === 4 && !isVideoLoadedRef.current[0]) {
                retryVideoLoad(analysis.videoWithAudioUrl, 0);
              } else if (!isVideoLoadedRef.current[0]) {
                setError('Video cannot be played directly. Please use the "Open Video in New Tab" button to view the video.');
                setVideoLoading(prev => ({ ...prev, 0: false }));
              }
            }}
            onLoadedData={() => {
              setError(null);
              setVideoLoading(prev => ({ ...prev, 0: false }));
              isVideoLoadedRef.current[0] = true;
            }}
            preload="auto"
          >
            <source 
              src={analysis.videoWithAudioUrl} 
              type="video/mp4"
            />
            Your browser does not support the video tag.
          </video>
          <div className="video-url-info">
            <small>Clipped Video URL: {analysis.videoWithAudioUrl}</small>
          </div>
          <div className="video-debug-info">
            <button 
              onClick={() => handlePlayVideo(0)}
              className="debug-button"
              style={{ marginRight: '10px' }}
              disabled={videoLoading[0]}
            >
              {videoLoading[0] ? 'Loading Video...' : 'Play Video'}
            </button>
            <button 
              onClick={() => window.open(analysis.videoWithAudioUrl, '_blank')}
              className="debug-button"
            >
              Open Clipped Video in New Tab
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderLegacyContent = () => {
    if (analysis.selectedHighlights) {
      // Display selectedHighlights structure
      return (
        <div className="result-section">
          <h3>Content to Keep (Selected Highlights)</h3>
          {analysis.selectedHighlights.map((highlight, index) => (
            <div key={`highlight-${index}`} className="segment-container">
              <div className="segment-header">
                <span className="segment-time">
                  {formatTime(highlight.start)} - {formatTime(highlight.end)}
                </span>
              </div>
              <div className="highlight-summary">
                <strong>Summary:</strong> {highlight.highlightSummary}
              </div>
            </div>
          ))}
        </div>
      );
    } else if (analysis.mergedGroups) {
      // Display mergedGroups structure
      return (
        <div className="result-section">
          <h3>Content to Keep (Merged Groups)</h3>
          {analysis.mergedGroups.map((group, groupIndex) => (
            <div key={`group-${groupIndex}`} className="group-container">
              <h4>Group {groupIndex + 1}</h4>
              {group.map((segment, segmentIndex) => (
                <div key={`segment-${groupIndex}-${segmentIndex}`} className="segment-container">
                  <div className="segment-header">
                    <span className="segment-time">
                      {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                    </span>
                    <span className="importance-score">Importance: {segment.importanceScore}</span>
                  </div>
                  <div className="transcript-content">
                    <div className="original-text">
                      <strong>Original:</strong> {segment.transcript}
                    </div>
                    <div className="translation-text">
                      <strong>Translation:</strong> {segment.english_translation}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    } else if (analysis.relevantContent) {
      // Fallback to old structure if neither exists
      return (
        <div className="result-section">
          <h3>Content to Keep</h3>
          {analysis.relevantContent?.map((segment, index) => (
            <div key={`merged-${index}`} className="segment-container">
              <div className="segment-header">
                <span className="segment-time">
                  {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                </span>
              </div>
              {segment.transcripts?.map((transcript, tIndex) => (
                <div key={`transcript-${index}-${tIndex}`} className="timestamp-item">
                  <span className="time">{formatTime(transcript.startTime)} - {formatTime(transcript.endTime)}</span>
                  <span className="text">{transcript.transcript}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="video-analysis-container">
      <h2>Video Analysis</h2>
      
      <form onSubmit={handleSubmit} className="upload-form">
        <div className="file-input-container">
          <input
            type="file"
            accept="video/*"
            onChange={handleVideoChange}
            className="file-input"
          />
          <textarea
            placeholder="Enter video summary (optional)"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="summary-input"
          />
          
          {/* Upload Method Selection */}
          <div className="upload-method-selection">
            <h4>Upload Method:</h4>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="uploadMethod"
                  value="cloudinary"
                  checked={uploadMethod === 'cloudinary'}
                  onChange={(e) => setUploadMethod(e.target.value)}
                />
                <span className="radio-text">
                  Cloudinary Upload (Recommended) - Uploads to Cloudinary first, then sends URL to backend
                </span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="uploadMethod"
                  value="gcs"
                  checked={uploadMethod === 'gcs'}
                  onChange={(e) => setUploadMethod(e.target.value)}
                />
                <span className="radio-text">
                  Google Cloud Storage Upload - Uploads to Google Cloud Storage using signed URLs, then sends GS URI to backend
                </span>
              </label>
            </div>
          </div>
          
          {/* Upload Progress Bar */}
          {loading && uploadProgress > 0 && uploadProgress < 100 && (
            <div className="upload-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <span className="progress-text">Uploading: {uploadProgress}%</span>
            </div>
          )}
          
          <button type="submit" disabled={loading || !video} className="submit-button">
            {loading 
              ? (uploadProgress > 0 && uploadProgress < 100 
                  ? 'Uploading Video...' 
                  : 'Analyzing Video...')
              : (uploadMethod === 'cloudinary' ? 'Upload to Cloudinary & Analyze' : 'Upload to Google Cloud Storage & Analyze')
            }
          </button>
        </div>
      </form>

      {analysis && (
        <>
          <div className="analysis-results">
            {/* Original Video Section */}
            {analysis.originalVideoUrl && (
              <div className="result-section">
                <h3>Original Video</h3>
                <div className="video-player-container">
                  <video 
                    ref={originalVideoRef}
                    key={analysis.originalVideoUrl}
                    controls 
                    className="original-video"
                    crossOrigin="anonymous"
                    preload="auto"
                  >
                    <source 
                      src={analysis.originalVideoUrl} 
                      type="video/mp4"
                    />
                    Your browser does not support the video tag.
                  </video>
                  <div className="video-url-info">
                    <small>Original Video URL: {analysis.originalVideoUrl}</small>
                  </div>
                  <div className="video-debug-info">
                    <button 
                      onClick={() => window.open(analysis.originalVideoUrl, '_blank')}
                      className="debug-button"
                    >
                      Open Original Video in New Tab
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Language */}
            {analysis.language && (
              <div className="result-section">
                <h3>Language</h3>
                <p>{analysis.language}</p>
              </div>
            )}

            {/* Category */}
            {analysis.category && (
              <div className="result-section">
                <h3>Category</h3>
                <p className="category-tag">{analysis.category}</p>
              </div>
            )}

            {/* Main Topic */}
            {analysis.mainTopic && (
              <div className="result-section">
                <h3>Main Topic</h3>
                <p>{analysis.mainTopic}</p>
              </div>
            )}

            {/* Summary */}
            {analysis.summary && (
              <div className="result-section">
                <h3>Summary</h3>
                <p>{analysis.summary}</p>
              </div>
            )}

            {/* Processed Chunks */}
            {renderProcessedChunks()}
            {renderLegacySingleVideo()}
            {renderLegacyContent()}
          </div>
        </>
      )}
    </div>
  );
};

export default VideoAnalysis; 