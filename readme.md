# WIS replacement using CF Worker AI

[Willow-inference-server](https://github.com/toverainc/willow-inference-server) (WIS) allows us to use local CUDA cores to translate speech to text, text to speech, and many other services. This project is intended to move the local functionality to a (free) Cloudflare Worker AI using openAI Whisper model and Google TTS. 


# Ported functionality

WIS does many different things. The completed first goal of this project was porting over the willow API endpoints as a drop in replacement for the now inaccessible default "test" endpoints of [https://infer.tovera.io/api/willow](https://infer.tovera.io/api/willow) and [https://infer.tovera.io/api/tts](https://infer.tovera.io/api/tts). This allows speech to be converted to text and text back to speech before each is returned to the ecosystem. This removes the requirement for a local WIS install with CUDA cores.

## Speech to text (STT)

Speech is sent out from the device to the /api/willow endpoint using the options as defined in the Willow Application Server (WAS). The endpoint uses openAI's Whisper STT functionality via CloudFlare Worker AI. Currently only PCM is supported. The PCM option is found under the advanced settings in WAS.

## Text to speech (TTS)

After the device processes the STT output, e.g. by sending it to a Home Assistant application or to an LLM, it receives back a textual response. The device then displays that response on the screen and calls the /api/tts endpoint of WIS in order to read the response outloud. The endpoint uses Google's (undocumented) TTS endpoint to convert the text to an MP3. Note that Google's TTS endpoint can only read text that does not exceed 200 characters.


# Platform

[Cloudflare's Workers](https://developers.cloudflare.com/workers/) provide us with a free (limited calls) hosted alternative serverless environment. 

+ [Get started - CLI · Cloudflare Workers docs](https://developers.cloudflare.com/workers/get-started/guide/)
+ [First Worker · Cloudflare Learning Paths](https://developers.cloudflare.com/learning-paths/workers/get-started/first-worker/)

## Instructions

+ Sign up for a Cloudflare account. This is currently free and allows for up to 100,000 calls a day.

+ Clone this repository to your GitHub/GitLab environment.

+ Deploy the code to your own worker, e.g. by using [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/commands/#deploy) or via the Web platform under Workers & Pages. Name your worker "wis-cf-worker".
	+ Note: You must [Enable AI Binding](https://developers.cloudflare.com/workers/wrangler/configuration/#workers-ai) to run machine learning models like Whisper. The included wrangler.jsonc file simplifies this setup. If you choose a different worker name than "wis-cf-worker", update the wrangler file.

+ In your Willow Application Server, modify both the Willow Inference Server Speech Recognition URL (ending in /api/willow) and the Text to Speech URL (ending in /api/tts) to point to your new published endpoint.