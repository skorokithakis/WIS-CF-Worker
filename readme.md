# WIS replacement using CF Worker AI

[Willow-inference-server](https://github.com/toverainc/willow-inference-server) (WIS) allows us to use local CUDA cores to translate speech to text and many other services. This project is intended to move the local functionality to Cloudflare Worker AI and its openAI whisper model. 


# Ported functionality

WIS does many different things. The completed first goal of this project was porting over the willow API endpoint as a drop in replacement for the now inaccessible default "test" endpoint of [https://infer.tovera.io/api/willow](https://infer.tovera.io/api/willow). This allows speech to be converted to text and then be returned to the ecosystem while removing the requirement for a local server install with CUDA cores.

## Speech to text

Speech is sent out from the device to a chosen endpoint using the options as defined in the Willow Application Server (WAS). Currently only PCM is supported. The PCM option is found under the advanced settings in WAS.

# Platform

[Cloudflare's Workers](https://developers.cloudflare.com/workers/) provide us with a free (limited calls) hosted alternative environment. 

## Instructions

- Sign up for a Cloudflare account. This is currently free and allows for up to 1000 calls a day

- [Deploy](https://developers.cloudflare.com/workers/wrangler/commands/#deploy) the code to your own worker 
	-- [Enable AI Binding](https://developers.cloudflare.com/workers/wrangler/configuration/#workers-ai) to run machine learning models
    
- In your Willow Application Server, modify the Willow Inference Server Speech Recognition URL to point to your new published endpoint
