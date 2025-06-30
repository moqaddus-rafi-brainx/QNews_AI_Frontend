import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './VideoAnalysis.css';

const VideoAnalysis = () => {
  const [video, setVideo] = useState(null);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const videoRef = useRef(null);
  const originalVideoRef = useRef(null);
  const retryCountRef = useRef(0);
  const isVideoLoadedRef = useRef(false);
  const maxRetries = 10;
  const initialDelay = 2000; // 2 seconds

  const handleVideoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideo(file);
      setError(null);
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
    setVideoLoading(false);
    isVideoLoadedRef.current = false;
    retryCountRef.current = 0;

    const formData = new FormData();
    formData.append('video', video);
    formData.append('summary', summary);

    try {
      const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/analyze-video2`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setAnalysis(response.data);
      // Start loading video immediately when we get the URL
      if (response.data.videoWithAudioUrl) {
        setVideoLoading(true);
        retryVideoLoad(response.data.videoWithAudioUrl);
      }
    } catch (err) {
      console.log(err);
      setError('Error analyzing video: ' + (err?.response?.data?.trace || err.response?.data?.message || err.message));
      setVideoLoading(false);
    } finally {
      setLoading(false);
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

  const retryVideoLoad = async (url) => {
    if (isVideoLoadedRef.current || retryCountRef.current >= maxRetries) {
      if (!isVideoLoadedRef.current) {
        setError('Video is taking longer than expected to become available. Please try the "Open Video in New Tab" button.');
      }
      setVideoLoading(false);
      return;
    }

    const delay = initialDelay * Math.pow(2, retryCountRef.current);
    await new Promise(resolve => setTimeout(resolve, delay));

    const isAvailable = await checkVideoAvailability(url);
    if (isAvailable) {
      if (videoRef.current) {
        videoRef.current.load();
        videoRef.current.play().catch(() => {
          // If play fails, we'll let the user click the play button
          setVideoLoading(false);
        });
      }
    } else {
      retryCountRef.current += 1;
      retryVideoLoad(url);
    }
  };

  const handlePlayVideo = async () => {
    if (videoRef.current) {
      try {
        setVideoLoading(true);
        await videoRef.current.play();
        setVideoLoading(false);
      } catch (error) {
        console.error('Play error:', error);
        setError('Error playing video: ' + error.message);
        setVideoLoading(false);
      }
    }
  };

  const renderContentToKeep = () => {
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
    } else {
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
          <button type="submit" disabled={loading || !video} className="submit-button">
            {loading ? 'Analyzing...' : 'Analyze Video'}
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

            {/* Clipped Video Section */}
            {analysis.videoWithAudioUrl && (
              <div className="result-section">
                <h3>Clipped Video</h3>
                <div className="video-player-container">
                  <video 
                    ref={videoRef}
                    key={analysis.videoWithAudioUrl}
                    controls 
                    className="clipped-video"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      console.error('Video Error:', e.target.error);
                      if (e.target.error?.code === 4 && !isVideoLoadedRef.current) { // MEDIA_ERR_SRC_NOT_SUPPORTED
                        retryVideoLoad(analysis.videoWithAudioUrl);
                      } else if (!isVideoLoadedRef.current) {
                        setError('Video cannot be played directly. Please use the "Open Video in New Tab" button to view the video.');
                        setVideoLoading(false);
                      }
                    }}
                    onLoadedData={() => {
                      setError(null);
                      setVideoLoading(false);
                      isVideoLoadedRef.current = true;
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
                      onClick={handlePlayVideo}
                      className="debug-button"
                      style={{ marginRight: '10px' }}
                      disabled={videoLoading}
                    >
                      {videoLoading ? 'Loading Video...' : 'Play Video'}
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
            )}

            {/* Legacy fields - keep for backward compatibility */}
            {analysis.language && (
              <div className="result-section">
                <h3>Language</h3>
                <p>{analysis.language}</p>
              </div>
            )}

            {analysis.category && (
              <div className="result-section">
                <h3>Category</h3>
                <p className="category-tag">{analysis.category}</p>
              </div>
            )}

            {analysis.mainTopic && (
              <div className="result-section">
                <h3>Main Topic</h3>
                <p>{analysis.mainTopic}</p>
              </div>
            )}

            {analysis.summary && (
              <div className="result-section">
                <h3>Summary</h3>
                <p>{analysis.summary}</p>
              </div>
            )}

            {/* Render content to keep based on new structure */}
            {renderContentToKeep()}
          </div>
        </>
      )}
    </div>
  );
};

export default VideoAnalysis; 