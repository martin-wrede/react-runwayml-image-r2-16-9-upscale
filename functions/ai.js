export async function onRequest(context) {
  const { request, env } = context;

  // ... (Standard boilerplate remains the same) ...
  if (request.method === 'OPTIONS') { return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Runway-Version' } }); }
  if (request.method !== 'POST') { return new Response('Method not allowed', { status: 405 }); }
  if (!env.RUNWAYML_API_KEY || !env.R2_PUBLIC_URL || !env.IMAGE_BUCKET || !env.TASK_INFO_KV) { const errorMsg = 'CRITICAL FIX REQUIRED: Check Cloudflare project settings for all required bindings.'; console.error(errorMsg); return new Response(JSON.stringify({ success: false, error: errorMsg }), { status: 500 }); }

  const RUNWAY_API_BASE = 'https://api.dev.runwayml.com/v1';
  const COMMON_HEADERS = { 'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`, 'X-Runway-Version': '2024-11-06', 'Content-Type': 'application/json' };

  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) { /* ... unchanged ... */ }
    else if (contentType.includes('application/json')) {
      const body = await request.json();
      const { action } = body;

      switch (action) {
        case 'generateImage': { /* ... unchanged ... */ }
        case 'startVideoFromUrl': { /* ... unchanged ... */ }
        
        case 'upscaleVideo': {
          const { assetId } = body; // <-- RECEIVE THE ASSET ID
          if (!assetId) throw new Error('Missing assetId to upscale.');
          
          const upscaledKey = `videos/upscaled-${assetId}.mp4`;
          
          const runwayResponse = await fetch(`${RUNWAY_API_BASE}/video_upscale`, {
            method: 'POST',
            headers: COMMON_HEADERS,
            // --- THE FINAL, CORRECT BODY ---
            body: JSON.stringify({
              assetId: assetId // Send ONLY the assetId
            }),
          });

          const data = await runwayResponse.json();
          if (!runwayResponse.ok) {
            console.error('Runway upscale API returned an error:', data);
            throw new Error(data.error || `Runway Upscale API error: ${runwayResponse.status}`);
          }
          
          await env.TASK_INFO_KV.put(data.id, JSON.stringify({
            type: 'video', r2Key: upscaledKey, r2PublicUrl: env.R2_PUBLIC_URL
          }));
          
          return jsonResponse({ success: true, taskId: data.id });
        }

        case 'status': {
          const { taskId } = body;
          if (!taskId) throw new Error('Invalid status check request.');
          const statusUrl = `${RUNWAY_API_BASE}/tasks/${taskId}`;
          const response = await fetch(statusUrl, { headers: { ...COMMON_HEADERS, 'Content-Type': undefined } });
          const data = await response.json();
          if (!response.ok) throw new Error(`Status check failed: ${data.error || response.statusText}`);
          
          if (data.status === 'SUCCEEDED' && data.output?.[0]) {
            const taskInfo = await env.TASK_INFO_KV.get(taskId, { type: 'json' });
            if (!taskInfo) throw new Error(`Could not find R2 destination for task ${taskId}.`);
            
            const runwayOutputUrl = data.output[0];
            const outputResponse = await fetch(runwayOutputUrl);
            if (!outputResponse.ok) throw new Error(`Failed to download from Runway.`);
            
            const contentType = taskInfo.type === 'image' ? 'image/png' : 'video/mp4';
            await env.IMAGE_BUCKET.put(taskInfo.r2Key, outputResponse.body, { httpMetadata: { contentType } });
            
            const finalUrl = `${taskInfo.r2PublicUrl}/${taskInfo.r2Key}`;
            context.waitUntil(env.TASK_INFO_KV.delete(taskId));
            
            // --- RETURN THE ASSET ID ALONG WITH THE URL ---
            const successPayload = { 
                success: true, 
                status: data.status, 
                progress: data.progress 
            };
            if (taskInfo.type === 'image') {
              successPayload.imageUrl = finalUrl;
            } else {
              successPayload.videoUrl = finalUrl;
              if (data.assetId) { // Check if assetId exists in the response
                successPayload.assetId = data.assetId;
              }
            }
            return jsonResponse(successPayload);
          }
          return jsonResponse({ success: true, status: data.status, progress: data.progress });
        }
        default:
          throw new Error('Invalid action specified.');
      }
    } 
    else { throw new Error(`Invalid request content-type.`); }
  } catch (error) {
    console.error(error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

// Helper functions (no changes)
async function startImageToVideoJob(imageUrl, prompt, duration, ratio, originalName, env) { /*...*/ }
function jsonResponse(data, status = 200) { /*...*/ }

// Unchanged helper function code for completeness
async function startImageToVideoJob(imageUrl, prompt, duration, ratio, originalName, env) { const RUNWAY_API_BASE = 'https://api.dev.runwayml.com/v1'; const videoKey = `videos/${Date.now()}-${originalName.split('.').slice(0, -1).join('.') || originalName}.mp4`; const response = await fetch(`${RUNWAY_API_BASE}/image_to_video`, { method: 'POST', headers: { 'Authorization': `Bearer ${env.RUNWAYML_API_KEY}`, 'X-Runway-Version': '2024-11-06', 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'gen4_turbo', promptText: prompt, promptImage: imageUrl, seed: Math.floor(Math.random() * 4294967295), watermark: false, duration: duration, ratio: ratio }), }); const data = await response.json(); if (!response.ok) throw new Error(data.error || `Runway I2V API returned status ${response.status}`); await env.TASK_INFO_KV.put(data.id, JSON.stringify({ type: 'video', r2Key: videoKey, r2PublicUrl: env.R2_PUBLIC_URL })); return jsonResponse({ success: true, taskId: data.id, status: data.status }); }
function jsonResponse(data, status = 200) { return new Response(JSON.stringify(data), { status: status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }); }