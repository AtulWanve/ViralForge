# ViralForge Repository Mining Matrix

This document maps out the specific reference repositories to study and adapt for the 6 core mechanisms of ViralForge. 

## 1. Multimodal Analysis (Reference Intake)
*   **Repo:** `AndersonBY/vector-vein` & `vllm-project/recipes`
*   **Target Module:** `viralforge.analysis`
*   **What to adapt:** The payload structure for sending image + text to multimodal LLMs (like Claude/Gemini), and the system prompts that force JSON schema output. Look at `Google/Gemma4.md` and `Structured-Output-Examples-for-LLMs/`.

## 2. AI Generation Pipeline (Creative Planner → Generation)
*   **Repo:** `Saganaki22/ContentMachine`
*   **Target Module:** `viralforge.pipeline`
*   **What to adapt:** The overall state machine: prompt → image API (fal.ai/Replicate) → handle URLs → retries. The frontend pipeline coordination logic (`frontend/src/store/pipelineStore.js`).

## 3. Image/Video API Integration (Polling/Webhooks)
*   **Repo:** `krusemediallc/claude-code-ai-ad-builder-kie-ai`
*   **Target Module:** `viralforge.generation.clients`
*   **What to adapt:** The "async by design" polling loops with backoff logic and webhook callback handling for long-running video generation.

## 4. Background Workflows & Orchestration
*   **Repo:** `inngest/inngest` & `taskforcesh/bullmq`
*   **Target Module:** `viralforge.orchestration`
*   **What to adapt:** The concept of durable step functions that can pause, sleep, and retry independently. We will use the Inngest SDK directly.

## 5. Media Post-Processing (Media Renderer)
*   **Repo:** `Hao0321/video-autopilot-kit`
*   **Target Module:** `viralforge.media.renderer`
*   **What to adapt:** The wrappers around FFmpeg commands for cropping, resizing to 9:16, adding text overlays, and concatenating video clips with audio syncing (`src/video_processing/`).

## 6. Social Scheduling & Publishing
*   **Repo:** `trypostit/trypost` (AGPL - Conceptual reference ONLY)
*   **Target Module:** `viralforge.scheduling`
*   **What to adapt:** The database schema for scheduled posts (`draft`, `scheduled`, `queued`, `published`, `error`), platform abstraction logic, and the approval state machine. Do not copy code.

## 7. Dashboard & Calendar UI
*   **Repo:** `nellavio/nellavio` & `fullcalendar/fullcalendar`
*   **Target Module:** `viralforge.frontend`
*   **What to adapt:** The Next.js 16 app router structure, the dashboard layout shell, the sidebar navigation, and the drag-and-drop calendar component instantiation.