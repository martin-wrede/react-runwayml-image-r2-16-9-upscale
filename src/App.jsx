import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  // Existing State // comment
  const [prompt, setPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState(null); // This will now hold the initial HD video URL
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [duration, setDuration] = useState('5');
  const [ratio, setRatio] = useState('1280:720');
  const [imagePrompt, setImagePrompt] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageGenStatus, setImageGenStatus] = useState('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState(null);

  // --- NEW STATE FOR UPSCALING ---
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [upscaleStatus, setUpscaleStatus] = useState('');
  const [upscaledVideoUrl, setUpscaledVideoUrl] = useState(null); // This will hold the final 4K video URL

  const pollIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const resetState = (isFullReset = false) => {
    setVideoUrl(null);
    setUpscaledVideoUrl(null);
    setIsGenerating(false);
    setIsUpscaling(false);
    setProgress(0);
    setStatus('');
    setUpscaleStatus('');
    setError('');
    if (isFullReset) {
      setImageGenStatus('');
      setGeneratedImageUrl(null);
      removeFile();
    }
  };

  const handleFileSelect = (event) => {
    // ... (This function remains unchanged)
    const file = event.target.files[0];
    if (file) {
      setGeneratedImageUrl(null);
      setImageGenStatus('');
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setError('Please select a valid image format (JPEG, PNG, WebP)');
        return;
      }
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setError('The file is too large. Maximum 10MB allowed.');
        return;
      }
      setSelectedFile(file);
      setError('');
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const removeFile = () => {
    // ... (This function remains unchanged)
    setSelectedFile(null);
    setPreviewUrl(null);
    setGeneratedImageUrl(null);
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';
  };

  // Modified generic polling function
  const pollForStatus = (taskId, taskType) => {
    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusResponse = await fetch('/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId, action: 'status' }),
        });
        
        const statusData = await statusResponse.json();
        if (!statusResponse.ok || !statusData.success) {
            throw new Error(statusData.error || `Failed to check ${taskType} status`);
        }

        const progressPercentage = (statusData.progress * 100) || 0;
        const currentStatus = `Status: ${statusData.status} (${progressPercentage.toFixed(0)}%)`;

        // --- UPDATE CORRECT STATUS BASED ON TASK TYPE ---
        if (taskType === 'image') setImageGenStatus(currentStatus);
        else if (taskType === 'video') { setStatus(currentStatus); setProgress(progressPercentage); }
        else if (taskType === 'upscale') setUpscaleStatus(currentStatus);

        if (statusData.status === 'SUCCEEDED') {
          clearInterval(pollIntervalRef.current);
          if (taskType === 'image' && statusData.imageUrl) {
            setImageGenStatus('Image generated successfully!');
            setPreviewUrl(statusData.imageUrl);
            setGeneratedImageUrl(statusData.imageUrl);
            setIsGeneratingImage(false);
          } else if (taskType === 'video' && statusData.videoUrl) {
            setVideoUrl(statusData.videoUrl); // Set the initial HD video URL
            setStatus('Video generation completed!');
            setIsGenerating(false);
          } else if (taskType === 'upscale' && statusData.videoUrl) {
            setUpscaledVideoUrl(statusData.videoUrl); // Set the final 4K video URL
            setUpscaleStatus('Video upscaled to 4K successfully!');
            setIsUpscaling(false);
          }
        } else if (statusData.status === 'FAILED') {
          throw new Error(statusData.failure?.reason || `${taskType} generation failed`);
        }
      } catch (pollError) {
        setError(pollError.message);
        setIsGenerating(false);
        setIsGeneratingImage(false);
        setIsUpscaling(false);
        clearInterval(pollIntervalRef.current);
      }
    }, 4000);
  };

  const generateImage = async () => { /* ... (This function remains unchanged) ... */ };
  const generateVideo = async () => { /* ... (This function remains unchanged) ... */ };
  
  // --- NEW FUNCTION TO HANDLE UPSCALING ---
  const handleUpscale = async () => {
    if (!videoUrl) {
      setError('No HD video available to upscale.');
      return;
    }
    setIsUpscaling(true);
    setUpscaleStatus('Starting upscale job...');
    setError('');

    try {
      const response = await fetch('/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upscaleVideo',
          videoUrl: videoUrl, // Send the R2 URL of the HD video
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to start upscale job');
      }

      setUpscaleStatus('Upscaling in progress...');
      pollForStatus(data.taskId, 'upscale'); // Poll for the new upscale task

    } catch (err) {
      setError(err.message);
      setIsUpscaling(false);
    }
  };

  // Styles and other functions (copy-pasted for completeness)
  const radioGroupStyle = { marginBottom: '20px', border: '1px solid #ccc', padding: '10px', borderRadius: '5px' };
  const radioLabelStyle = { marginRight: '15px', cursor: 'pointer' };
  const sectionStyle = { border: '1px solid #ddd', padding: '15px', borderRadius: '5px', marginBottom: '20px' };
  const hasImageSource = selectedFile || generatedImageUrl;
  
  // Minor changes to generateImage and generateVideo to use the new resetState
  // The logic inside them is the same, but they now properly reset upscale state
  const originalGenerateImage = async () => {
    if (!imagePrompt.trim()) { setError('Please enter a prompt for the image.'); return; }
    resetState(true); setIsGeneratingImage(true); setImageGenStatus('Starting image generation...');
    try {
      const response = await fetch('/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generateImage', prompt: imagePrompt, ratio: ratio, }), });
      const data = await response.json(); if (!response.ok || !data.success) { throw new Error(data.error || 'Failed to start image generation'); }
      setImageGenStatus('Image generation started, processing...'); pollForStatus(data.taskId, 'image');
    } catch (err) { setError(err.message); setIsGeneratingImage(false); }
  };
  const originalGenerateVideo = async () => {
    if ((!selectedFile && !generatedImageUrl) || !prompt.trim()) { setError('Please provide a source image and a video prompt.'); return; }
    resetState(); setIsGenerating(true); setStatus('Starting video generation job...');
    try {
      let response;
      if (selectedFile) {
        const formData = new FormData();
        formData.append('prompt', prompt); formData.append('image', selectedFile); formData.append('duration', duration); formData.append('ratio', ratio);
        response = await fetch('/ai', { method: 'POST', body: formData });
      } else {
        response = await fetch('/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'startVideoFromUrl', videoPrompt: prompt, imageUrl: generatedImageUrl, duration: duration, ratio: ratio, }) });
      }
      const data = await response.json(); if (!response.ok || !data.success) { throw new Error(data.error || 'Failed to start video generation'); }
      setStatus('Video generation started, processing...'); pollForStatus(data.taskId, 'video');
    } catch (err) { setError(err.message); setIsGenerating(false); }
  };


  return (
    <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>Text-to-Image-to-Video with RunwayML</h1>
      
      {/* --- STEP 1 AND 2 (NO CHANGES) --- */}
      <h3>Step 1: Provide a Source Image</h3>
      <div style={sectionStyle}><h4>Option A: Generate an Image</h4><div style={{ marginBottom: '10px' }}><label style={{ display: 'block', marginBottom: '5px' }}>Image Prompt:</label><input type="text" placeholder="e.g., 'a majestic lion in the savanna'" value={imagePrompt} onChange={e => setImagePrompt(e.target.value)} style={{ width: '100%', padding: '10px', fontSize: '16px', boxSizing: 'border-box' }} /></div><button onClick={originalGenerateImage} disabled={isGeneratingImage || !imagePrompt.trim()} style={{ padding: '10px 20px', fontSize: '16px', backgroundColor: (isGeneratingImage || !imagePrompt.trim()) ? '#ccc' : '#28a745', color: 'white', border: 'none', cursor: 'pointer' }}>{isGeneratingImage ? 'Generating Image...' : 'Generate Image'}</button>{imageGenStatus && <p style={{ marginTop: '10px', color: '#333' }}>{imageGenStatus}</p>}</div>
      <div style={{ textAlign: 'center', margin: '10px 0', fontWeight: 'bold' }}>OR</div>
      <div style={sectionStyle}><h4>Option B: Upload an Image</h4><input id="fileInput" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} style={{ width: '100%' }} /></div>
      {previewUrl && (<div style={{ marginBottom: '20px', position: 'relative', display: 'inline-block' }}><p><strong>Image Preview:</strong></p><img src={previewUrl} alt="Preview" style={{ maxWidth: '300px', maxHeight: '200px', border: '1px solid #ddd' }} /><button onClick={removeFile} style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(255,0,0,0.7)', color: 'white', border: 'none', borderRadius: '50%', width: '25px', height: '25px', cursor: 'pointer' }}>×</button></div>)}
      {hasImageSource && (<><hr style={{ margin: '30px 0' }}/><h3>Step 2: Generate the Video</h3><div style={{ marginBottom: '20px' }}><label style={{ display: 'block', marginBottom: '5px' }}>Video Prompt:</label><input type="text" placeholder="e.g., 'camera slowly zooms in'" value={prompt} onChange={e => setPrompt(e.target.value)} style={{ width: '100%', padding: '10px', fontSize: '16px', boxSizing: 'border-box' }} /></div><div style={radioGroupStyle}><p style={{ marginTop: 0, fontWeight: 'bold' }}>Duration:</p><label style={radioLabelStyle}><input type="radio" value="5" checked={duration === '5'} onChange={() => setDuration('5')} /> 5 Seconds</label><label style={radioLabelStyle}><input type="radio" value="10" checked={duration === '10'} onChange={() => setDuration('10')} /> 10 Seconds</label></div><div style={radioGroupStyle}><p style={{ marginTop: 0, fontWeight: 'bold' }}>Aspect Ratio:</p><label style={radioLabelStyle}><input type="radio" value="1280:720" checked={ratio === '1280:720'} onChange={() => setRatio('1280:720')} /> Landscape (16:9)</label><label style={radioLabelStyle}><input type="radio" value="720:1280" checked={ratio === '720:1280'} onChange={() => setRatio('720:1280')} /> Portrait (9:16)</label></div><button onClick={originalGenerateVideo} disabled={isGenerating || isGeneratingImage || !hasImageSource || !prompt.trim()} style={{ padding: '10px 20px', fontSize: '16px', backgroundColor: (isGenerating || isGeneratingImage || !hasImageSource || !prompt.trim()) ? '#ccc' : '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}>{isGenerating ? 'Generating Video...' : 'Generate Video'}</button>{status && (<div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0' }}><p>{status}</p>{isGenerating && progress > 0 && (<div style={{ backgroundColor: '#ddd' }}><div style={{ width: `${progress}%`, height: '20px', backgroundColor: '#007bff', transition: 'width 0.5s ease' }} /></div>)}</div>)}</>)}

      {error && (<div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#ffebee', color: '#c62828' }}>Error: {error}</div>)}
      
      {/* --- STEP 3: DISPLAY RESULTS AND UPSCALE OPTION --- */}
      {(videoUrl || upscaledVideoUrl) && (
        <div style={{ marginTop: '20px' }}>
          <h3>{upscaledVideoUrl ? 'Final 4K Video:' : 'Generated HD Video:'}</h3>
          <video controls muted autoPlay loop style={{ width: '100%', maxWidth: '500px' }} src={upscaledVideoUrl || videoUrl}>
            Your browser does not support the video tag.
          </video>
          
          {/* Show upscale button only if HD video is ready and not already upscaling/upscaled */}
          {videoUrl && !upscaledVideoUrl && (
            <div style={{ marginTop: '15px' }}>
              <button onClick={handleUpscale} disabled={isUpscaling} style={{ padding: '10px 20px', fontSize: '16px', backgroundColor: isUpscaling ? '#ccc' : '#17a2b8', color: 'white', border: 'none', cursor: 'pointer' }}>
                {isUpscaling ? 'Upscaling...' : '✨ Upscale to 4K'}
              </button>
              {upscaleStatus && <p style={{ marginTop: '10px', color: '#333' }}>{upscaleStatus}</p>}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '30px', fontSize: '14px', color: '#666' }}>
        <p><strong>Models:</strong> gen4_image, gen4_turbo, video_upscale</p>
      </div>
    </div>
  );
}
