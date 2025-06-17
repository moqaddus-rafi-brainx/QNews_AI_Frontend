import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './VideoAnalysis.css';

const VideoAnalysis = () => {
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const videoRef = useRef(null);
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

    try {
      const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/analyze-video`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setAnalysis(response.data);
      // Start loading video immediately when we get the URL
      if (response.data.clippedVideoUrl) {
        setVideoLoading(true);
        retryVideoLoad(response.data.clippedVideoUrl);
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

      

      {analysis && (
        <>
          {!analysis.isNews ? (
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
                        if (e.target.error?.code === 4 && !isVideoLoadedRef.current) { // MEDIA_ERR_SRC_NOT_SUPPORTED
                          retryVideoLoad(analysis.clippedVideoUrl);
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
                        src={analysis.clippedVideoUrl} 
                        type="video/mp4"
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
                        disabled={videoLoading}
                      >
                        {videoLoading ? 'Loading Video...' : 'Play Video'}
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
                <p className="category-tag">{analysis.category || 'Not categorized'}</p>
              </div>

              <div className="result-section">
                <h3>Main Topic</h3>
                <p>{analysis.mainTopic || 'Not detected'}</p>
              </div>

              <div className="result-section">
                <h3>Summary</h3>
                <p>{analysis.summary || 'Not available'}</p>
              </div>

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
                
                {/* {analysis.groupedTranscripts?.relevant_content?.unmerged_segments?.map((segment, index) => (
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
                ))} */}
              </div>

              <div className="result-section">
                <h3>Content to Clip</h3>
                {analysis.irrelevantContent ? (
                  // Case 1: Array of transcripts with text
                  analysis.irrelevantContent.transcripts?.length > 0 ? (
                    analysis.irrelevantContent.transcripts.map((transcript, index) => (
                      <div key={index} className="timestamp-item">
                        <span className="time">{formatTime(transcript.startTime)} - {formatTime(transcript.endTime)}</span>
                        <span className="text">{transcript.transcript}</span>
                      </div>
                    ))
                  ) : // Case 2: Array of time segments without text
                  Array.isArray(analysis.irrelevantContent) && analysis.irrelevantContent.length > 0 ? (
                    analysis.irrelevantContent.map((segment, index) => (
                      <div key={index} className="timestamp-item">
                        <span className="time">{formatTime(segment.startTime)} - {formatTime(segment.endTime)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="no-content">No content to clip</p>
                  )
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