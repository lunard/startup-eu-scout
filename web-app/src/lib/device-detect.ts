import type { DeviceCapabilities, InferenceBackend } from '@/types'

// ─── Cutting-edge device thresholds ──────────────────────────────────────────
// A device is "supported" if it has WebGPU with a capable GPU adapter.
// We don't block based on RAM alone since iOS doesn't expose navigator.deviceMemory.

const MIN_MAX_BUFFER_SIZE = 256 * 1024 * 1024 // 256 MB — rules out old/weak GPUs

export async function detectDeviceCapabilities(): Promise<DeviceCapabilities> {
  // 1. WebGPU check
  const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator

  if (!hasWebGPU) {
    return {
      supported: false,
      backend: null,
      hasWebGPU: false,
      hasWebNN: false,
      npuAvailable: false,
      reason: 'WebGPU is not supported in this browser. Please use Chrome 113+, Edge 113+, or Safari 18+ (iOS 17.4+).',
    }
  }

  // 2. Request GPU adapter
  let adapter: { limits: Record<string, number>; requestAdapterInfo?: () => Promise<{ device?: string; description?: string }> } | null = null
  try { adapter = await (navigator as any).gpu.requestAdapter({ powerPreference: 'high-performance' }) }
  catch { /* noop */ }

  if (!adapter) {
    return {
      supported: false,
      backend: null,
      hasWebGPU: true,
      hasWebNN: false,
      npuAvailable: false,
      reason: 'No capable GPU adapter found. A discrete or high-performance GPU is required.',
    }
  }

  // 3. GPU tier from limits
  const maxBuf = adapter.limits.maxBufferSize ?? 0
  const maxTex = adapter.limits.maxTextureDimension2D ?? 0
  const info = await adapter.requestAdapterInfo?.().catch(() => null)
  const gpuName = info?.device || info?.description || 'Unknown GPU'

  let gpuTier: 'high' | 'mid' | 'low' = 'low'
  if (maxBuf >= 2 * 1024 * 1024 * 1024) gpuTier = 'high'        // ≥ 2 GB → flagship
  else if (maxBuf >= MIN_MAX_BUFFER_SIZE && maxTex >= 8192) gpuTier = 'mid'  // mid-range

  if (gpuTier === 'low') {
    return {
      supported: false,
      backend: null,
      hasWebGPU: true,
      hasWebNN: false,
      npuAvailable: false,
      gpuName,
      gpuTier,
      reason: 'Your GPU is not powerful enough for on-device AI inference. A recent iPhone (15+), iPad Pro, or modern Android flagship is required.',
    }
  }

  // 4. RAM check (best-effort — not available on iOS)
  const deviceMemoryGB: number | undefined =
    'deviceMemory' in navigator ? (navigator as any).deviceMemory : undefined

  if (deviceMemoryGB !== undefined && deviceMemoryGB < 4) {
    return {
      supported: false,
      backend: null,
      hasWebGPU: true,
      hasWebNN: false,
      npuAvailable: false,
      gpuName,
      gpuTier,
      deviceMemoryGB,
      reason: `Insufficient RAM (${deviceMemoryGB} GB detected). At least 4 GB is required for local AI inference.`,
    }
  }

  // 5. WebNN / NPU probe
  let hasWebNN = false
  let npuAvailable = false
  try {
    const ml = (navigator as any).ml
    if (ml) {
      // Try NPU first
      try {
        const ctx = await ml.createContext({ deviceType: 'npu' })
        if (ctx) { hasWebNN = true; npuAvailable = true }
      } catch {
        // NPU not available; try GPU via WebNN
        const ctx = await ml.createContext({ deviceType: 'gpu' })
        if (ctx) hasWebNN = true
      }
    }
  } catch {
    // WebNN not supported
  }

  const backend: InferenceBackend = npuAvailable ? 'npu' : 'gpu'

  return {
    supported: true,
    backend,
    hasWebGPU: true,
    hasWebNN,
    npuAvailable,
    gpuName,
    gpuTier,
    deviceMemoryGB,
  }
}

export function getBackendLabel(caps: DeviceCapabilities): string {
  if (caps.npuAvailable) return 'Neural Processing Unit (NPU)'
  if (caps.hasWebGPU)    return 'GPU via WebGPU'
  return 'CPU (WebAssembly)'
}

export function getBackendIcon(caps: DeviceCapabilities): string {
  if (caps.npuAvailable) return '🧠'
  if (caps.hasWebGPU)    return '⚡'
  return '🔧'
}
