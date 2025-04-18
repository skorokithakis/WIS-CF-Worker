/**
 * willow-inference-server (wis) drop in replacement using Cloudflare Worker AI
 *
 * This worker provides two functions:
 * 1. Speech-to-Text: Accepts PCM audio from a Willow device, converts to WAV, and sends it through to OpenAI Whisper.
 * 2. Text-to-Speech: Converts text to speech using Google Translate's TTS API
 *
 * The response is then formatted and returned to the device.
 */

import { AutoRouter } from 'itty-router'

class CustomError extends Error {
 constructor(message, statusCode) {
  super(message)
  this.statusCode = statusCode
 }
}

const router = AutoRouter()

/**
 * Route for Willow STT: POST /api/willow
 * Accepts PCM audio from Willow devices and returns transcription
 */
router.post('/api/willow', async (request, env) => {
	try{

		// Check for Willow user-agent and required x-audio headers
		if (!request.headers.get('user-agent').includes('Willow')) {

			throw new CustomError("Bad user-agent received (not Willow).", '400');

		} else if (
			!request.headers.has('x-audio-channel') ||
			!request.headers.has('x-audio-sample-rate') ||
			!request.headers.has('x-audio-bits') ||
			!request.headers.has('x-audio-codec')
		) {
			throw new CustomError("Bad header data received.", '400');

		} else if (!request.headers.get('x-audio-codec').includes('pcm')) {

			throw new CustomError("Only PCM codec accepted.", '400');

		} else {

			function createWavHeader(numChannels, sampleRate, bitsPerSample, dataSize) {
				// RIFF Header
				const riff = 'RIFF';
				const wave = 'WAVE';

				// Format Chunk
				const fmt = 'fmt ';
				const fmtChunkSize = 16; // For PCM
				const audioFormat = 1; // PCM
				const byteRate = sampleRate * numChannels * bitsPerSample / 8; // Byte rate
				const blockAlign = numChannels * bitsPerSample / 8; // Block align

				// Data Chunk
				const data = 'data';

				// Create an ArrayBuffer to hold the WAV header
				const buffer = new ArrayBuffer(44); // Standard WAV header size
				const view = new DataView(buffer);

				// RIFF header
				writeString(view, 0, riff); // "RIFF"
				view.setUint32(4, 36 + dataSize, true); // File size minus 8
				writeString(view, 8, wave); // "WAVE"

				// Format chunk
				writeString(view, 12, fmt); // "fmt "
				view.setUint32(16, fmtChunkSize, true); // Chunk size
				view.setUint16(20, audioFormat, true); // Audio format
				view.setUint16(22, numChannels, true); // Number of channels
				view.setUint32(24, sampleRate, true); // Sample rate
				view.setUint32(28, byteRate, true); // Byte rate
				view.setUint16(32, blockAlign, true); // Block align
				view.setUint16(34, bitsPerSample, true); // Bits per sample

				// Data chunk
				writeString(view, 36, data); // "data"
				view.setUint32(40, dataSize, true); // Data size

				return buffer;
			}

			function writeString(view, offset, string) {
				for (let i = 0; i < string.length; i++) {
					view.setUint8(offset + i, string.charCodeAt(i));
				}
			}

			// Parse header values as integers
			const numChannels = parseInt(request.headers.get('x-audio-channel'), 10);
			const sampleRate = parseInt(request.headers.get('x-audio-sample-rate'), 10);
			const bitsPerSample = parseInt(request.headers.get('x-audio-bits'), 10);
			const dataSize = parseInt(request.headers.get('content-length'), 10);

			// Create wav header from request headers
			const wavHeader = createWavHeader(numChannels, sampleRate, bitsPerSample, dataSize);

			// PCM data received
			const audioData = await request.arrayBuffer();

			// Create a combined ArrayBuffer
			const combinedBuffer = new Uint8Array(wavHeader.byteLength + audioData.byteLength);
			combinedBuffer.set(new Uint8Array(wavHeader), 0);
			combinedBuffer.set(new Uint8Array(audioData), wavHeader.byteLength);

			// Call the Whisper API using the Cloudflare Worker AI
			const input = {
				audio: [...combinedBuffer],  // The Whisper API expects an array of bytes
			};

			// Call the Whisper API using the Cloudflare Worker AI
			const response = await env.AI.run("@cf/openai/whisper", input);

			// Reference for response found at: willow-inference-server/main.py line:1403
			// Based on that code, the minimum response appears to be language and results
			const language = 'en';
			const final_response = {language: language, text: response.text};

			// Return the transcription response
			return new Response(JSON.stringify(final_response), {
				headers: { 'Content-Type': 'application/json' },
				status: 200
			});

		}
	} catch (error) {
		// Handle any errors during processing
		return new Response('Error processing the file. - ' + error.message, {status: error.statusCode || 500});
	}
});

/**
 * Route for TTS: GET /api/tts
 * Accepts text parameter and returns MP3 audio
 */
router.get('/api/tts', async (request) => {
  try {
    const url = new URL(request.url);
    const text = url.searchParams.get('text');
    if (!text || text.trim() === '') {
      return new Response('Missing required parameter: text', {
        status: 400,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Construct the Google Translate TTS URL, which has a limit of 200 characters
    const encodedText = encodeURIComponent(text.substring(0, 200));
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en-US&client=tw-ob&q=${encodedText}`;

    // Fetch the audio from Google Translate
    const response = await fetch(ttsUrl);

    // Check if the response was successful
    if (!response.ok) {
      throw new Error(`Google TTS API returned status code ${response.status}`);
    }

    // Return the MP3 audio directly
    return new Response(response.body, {
      headers: {
        'Content-Type': 'audio/mpeg'
      }
    });
  } catch (error) {
    return new Response(`Error generating speech: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
});

router.get("/api/melotts", async (request, env) => {
  try {
    const url = new URL(request.url);
    const text = url.searchParams.get("text");
    if (!text || text.trim() === "") {
      return new Response("Missing required parameter: text", {
        status: 400,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const input = {
      prompt: text,
      lang: "en",
    };
    const response = await env.AI.run("@cf/myshell-ai/melotts", input);

    // Decode base64 audio to ArrayBuffer
    const binaryString = atob(response.audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Return the decoded MP3 audio
    return new Response(bytes.buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    return new Response(`Error generating speech: ${error.message}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
});

// Add a simple route for the root path to provide info about the service
router.get('/', () => {
  return new Response('Willow Speech Services - Available endpoints: POST /api/willow (STT), GET /api/tts?text=hello (TTS)', {
    headers: { 'Content-Type': 'text/plain' }
  });
});

export default router;
