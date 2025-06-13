import { useState, useRef } from 'react';
import axios from 'axios';
import './VideoAnalysis.css';

const VideoAnalysis = () => {
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);

  const handleVideoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideo(file);
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!video) {
      setError('Please select a video file');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('video', video);

    try {
      const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/analyze-video`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setAnalysis(response.data);
    } catch (err) {
      setError('Error analyzing video: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handlePlayVideo = async () => {
    if (videoRef.current) {
      try {
        // Reset the video to the beginning
        videoRef.current.currentTime = 0;
        // Wait for a small delay to ensure the video is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        // Attempt to play
        await videoRef.current.play();
      } catch (error) {
        console.error('Play error:', error);
        setError('Error playing video: ' + error.message);
      }
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
          <button type="submit" disabled={loading || !video} className="submit-button">
            {loading ? 'Analyzing...' : 'Analyze Video'}
          </button>
        </div>
      </form>

      {error && <div className="error-message">{error}</div>}

      {analysis && (
        <>
          {!analysis.groupedTranscripts?.is_news ? (
            <div className="analysis-results">
              <div className="result-section">
                <h3>Not a News Video</h3>
                <p>This video does not appear to be news-related content.</p>
              </div>
            </div>
          ) : (
            <div className="analysis-results">
              {analysis.clippedVideoUrl && (
                <div className="result-section">
                  <h3>Clipped Video</h3>
                  <div className="video-player-container">
                    <video 
                      ref={videoRef}
                      key={analysis.clippedVideoUrl}
                      controls 
                      className="clipped-video"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        console.error('Video Error:', e.target.error);
                        console.error('Video Error Code:', e.target.error?.code);
                        console.error('Video Error Message:', e.target.error?.message);
                        setError('Error loading video: ' + (e.target.error?.message || 'Unknown error'));
                      }}
                      onLoadedData={() => {
                        setError(null);
                        // Auto-play when video is loaded
                        handlePlayVideo();
                      }}
                      preload="auto"
                    >
                      <source 
                        src={analysis.clippedVideoUrl} 
                        type="video/mp4"
                        onError={(e) => {
                          console.error('Source Error:', e);
                          console.error('Source Error Code:', e.target.error?.code);
                          setError('Error loading video source: ' + (e.target.error?.message || 'Unknown error'));
                        }}
                      />
                      Your browser does not support the video tag.
                    </video>
                    <div className="video-url-info">
                      <small>Video URL: {analysis.clippedVideoUrl}</small>
                    </div>
                    <div className="video-debug-info">
                      <button 
                        onClick={handlePlayVideo}
                        className="debug-button"
                        style={{ marginRight: '10px' }}
                      >
                        Play Video
                      </button>
                      <button 
                        onClick={() => window.open(analysis.clippedVideoUrl, '_blank')}
                        className="debug-button"
                      >
                        Open Video in New Tab
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="result-section">
                <h3>Language</h3>
                <p>{analysis.Language || 'Not detected'}</p>
                {/* <p>Confidence: {(analysis.languageDetails?.confidence * 100).toFixed(2)}%</p> */}
              </div>

              <div className="result-section">
                <h3>Category</h3>
                <p className="category-tag">{analysis.groupedTranscripts?.category || 'Not categorized'}</p>
              </div>

              <div className="result-section">
                <h3>Main Topic</h3>
                <p>{analysis.groupedTranscripts?.main_topic || 'Not detected'}</p>
              </div>

              <div className="result-section">
                <h3>Summary</h3>
                <p>{analysis.groupedTranscripts?.summary || 'Not available'}</p>
              </div>

              <div className="result-section">
                <h3>Content to Keep</h3>
                {analysis.groupedTranscripts?.relevant_content?.merged_segments?.map((segment, index) => (
                  <div key={`merged-${index}`} className="segment-container">
                    <div className="segment-header">
                      <span className="segment-time">
                        {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                      </span>
                    </div>
                    {segment.transcripts.map((transcript, tIndex) => (
                      <div key={`transcript-${index}-${tIndex}`} className="timestamp-item">
                        <span className="time">{formatTime(transcript.startTime)} - {formatTime(transcript.endTime)}</span>
                        <span className="text">{transcript.transcript}</span>
                      </div>
                    ))}
                  </div>
                ))}
                
                {analysis.groupedTranscripts?.relevant_content?.unmerged_segments?.map((segment, index) => (
                  <div key={`unmerged-${index}`} className="segment-container">
                    <div className="segment-header">
                      <span className="segment-time">
                        {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                      </span>
                    </div>
                    {segment.transcripts.map((transcript, tIndex) => (
                      <div key={`transcript-${index}-${tIndex}`} className="timestamp-item">
                        <span className="time">{formatTime(transcript.startTime)} - {formatTime(transcript.endTime)}</span>
                        <span className="text">{transcript.transcript}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="result-section">
                <h3>Content to Clip</h3>
                {analysis.groupedTranscripts?.irrelevant_content?.transcripts?.length > 0 ? (
                  analysis.groupedTranscripts.irrelevant_content.transcripts.map((transcript, index) => (
                    <div key={index} className="timestamp-item">
                      <span className="time">{formatTime(transcript.startTime)} - {formatTime(transcript.endTime)}</span>
                      <span className="text">{transcript.transcript}</span>
                    </div>
                  ))
                ) : (
                  <p className="no-content">No content to clip</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default VideoAnalysis; 