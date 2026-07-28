'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Shield, ScanLine, CheckCircle2, XCircle, RotateCcw, Package, Lock, Download, Share2, Info } from 'lucide-react'

type Screen =
  | 'home'
  | 'seal-scanning'
  | 'seal-result'
  | 'verify-step1'
  | 'verify-step2'
  | 'result-match'
  | 'result-mismatch'

declare global {
  interface Window {
    Html5Qrcode: any
    QRCode: any
  }
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b: number) => b.toString(16).padStart(2, '0')).join('')
}

export default function GateCheckApp() {
  const [screen, setScreen] = useState<Screen>('home')
  const [scannedItems, setScannedItems] = useState<string[]>([])
  const [masterHash, setMasterHash] = useState<string>('')
  const [storedHash, setStoredHash] = useState<string>('')
  const [showHow, setShowHow] = useState(false)
  const scannerRef = useRef<any>(null)
  const qrContainerRef = useRef<HTMLDivElement>(null)
  const scannerDivId = 'qr-reader'

  const stopScanner = useCallback(async () => {
    try {
      const inst = scannerRef.current
      if (inst) {
        const state = inst?.getState?.()
        if (state === 2) {
          await inst.stop()
        }
        inst.clear()
      }
    } catch {}
    scannerRef.current = null
  }, [])

  const startScanner = useCallback(
    (onScan: (text: string) => void) => {
      if (typeof window === 'undefined' || !window.Html5Qrcode) return
      setTimeout(async () => {
        try {
          await stopScanner()
          const html5Qr = new window.Html5Qrcode(scannerDivId)
          scannerRef.current = html5Qr
          await html5Qr.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText: string) => onScan(decodedText),
            () => {}
          )
        } catch (err) {
          console.error('Scanner start error', err)
        }
      }, 300)
    },
    [stopScanner]
  )

  useEffect(() => {
    return () => {
      stopScanner()
    }
  }, [stopScanner])

  const generateQR = useCallback((text: string) => {
    if (!qrContainerRef.current || typeof window === 'undefined' || !window.QRCode) return
    qrContainerRef.current.innerHTML = ''
    new window.QRCode(qrContainerRef.current, {
      text,
      width: 256,
      height: 256,
      colorDark: '#00e676',
      colorLight: '#0a0a0a',
      correctLevel: window.QRCode?.CorrectLevel?.H ?? 2,
    })
  }, [])

  const getQRBlob = useCallback(async (): Promise<Blob | null> => {
    const container = qrContainerRef.current
    if (!container) return null
    const srcCanvas = container.querySelector('canvas') as HTMLCanvasElement | null
    const srcImg = container.querySelector('img') as HTMLImageElement | null
    const size = 512
    const pad = 48
    const out = document.createElement('canvas')
    out.width = size + pad * 2
    out.height = size + pad * 2
    const ctx = out.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, out.width, out.height)
    const drawSource = (source: CanvasImageSource) => {
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(source, pad, pad, size, size)
    }
    if (srcCanvas) {
      drawSource(srcCanvas)
    } else if (srcImg) {
      await new Promise<void>((resolve) => {
        if (srcImg.complete && srcImg.naturalWidth > 0) resolve()
        else {
          srcImg.onload = () => resolve()
          srcImg.onerror = () => resolve()
        }
      })
      drawSource(srcImg)
    } else {
      return null
    }
    return new Promise((resolve) => {
      out.toBlob((b) => resolve(b), 'image/png')
    })
  }, [])

  const saveQR = useCallback(async () => {
    const blob = await getQRBlob()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'gatecheck-master-qr.png'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [getQRBlob])

  const shareQR = useCallback(async () => {
    const blob = await getQRBlob()
    if (!blob) return
    const file = new File([blob], 'gatecheck-master-qr.png', { type: 'image/png' })
    const nav = navigator as any
    if (nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await nav.share({
          files: [file],
          title: 'GateCheck Master QR',
          text: 'GateCheck Master QR code',
        })
        return
      } catch {
        return
      }
    }
    await saveQR()
  }, [getQRBlob, saveQR])

  const goHome = useCallback(async () => {
    await stopScanner()
    setScreen('home')
    setScannedItems([])
    setMasterHash('')
    setStoredHash('')
  }, [stopScanner])

  const startSeal = useCallback(() => {
    setScannedItems([])
    setMasterHash('')
    setScreen('seal-scanning')
  }, [])

  useEffect(() => {
    if (screen === 'seal-scanning') {
      startScanner((text: string) => {
        setScannedItems((prev) => {
          if (prev[prev.length - 1] === text) return prev
          return [...prev, text]
        })
      })
    }
  }, [screen])

  const finishSeal = useCallback(async () => {
    await stopScanner()
    const concatenated = scannedItems.join('')
    const hash = await sha256(concatenated)
    setMasterHash(hash)
    setScreen('seal-result')
  }, [scannedItems, stopScanner])

  useEffect(() => {
    if (screen === 'seal-result' && masterHash) {
      generateQR(masterHash)
    }
  }, [screen, masterHash, generateQR])

  const startVerify = useCallback(() => {
    setScannedItems([])
    let preloaded = ''
    try {
      preloaded = localStorage.getItem('gatecheck_master_hash') || ''
    } catch {
      preloaded = ''
    }
    if (preloaded) {
      try {
        localStorage.removeItem('gatecheck_master_hash')
      } catch {}
      setStoredHash(preloaded)
      setScreen('verify-step2')
    } else {
      setStoredHash('')
      setScreen('verify-step1')
    }
  }, [])

  const useForVerify = useCallback(() => {
    try {
      localStorage.setItem('gatecheck_master_hash', masterHash)
    } catch {}
    setScannedItems([])
    setStoredHash(masterHash)
    setScreen('verify-step2')
  }, [masterHash])

  useEffect(() => {
    if (screen === 'verify-step1') {
      startScanner((text: string) => {
        setStoredHash(text)
        stopScanner()
        setScreen('verify-step2')
      })
    }
  }, [screen])

  useEffect(() => {
    if (screen === 'verify-step2') {
      startScanner((text: string) => {
        setScannedItems((prev) => {
          if (prev[prev.length - 1] === text) return prev
          return [...prev, text]
        })
      })
    }
  }, [screen])

  const finishVerify = useCallback(async () => {
    await stopScanner()
    const concatenated = scannedItems.join('')
    const hash = await sha256(concatenated)
    if (hash === storedHash) {
      setScreen('result-match')
    } else {
      setScreen('result-mismatch')
    }
  }, [scannedItems, storedHash, stopScanner])

  // ---------- RESULTS ----------
  if (screen === 'result-match') {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center px-6"
        style={{ backgroundColor: '#00e676' }}
      >
        <CheckCircle2 size={72} color="#0a0a0a" />
        <p className="mt-3 text-4xl font-bold" style={{ color: '#0a0a0a' }}>
          ✓ MATCH
        </p>

        <p className="mt-6 max-w-sm text-center text-sm leading-relaxed font-medium" style={{ color: '#0a0a0a' }}>
          The physical items are identical to what was sealed at origin.
          <br /><br />
          No database. No server. No data stored.
          <br />
          Just pure mathematical proof at the moment of handover.
        </p>

        <a
          href="mailto:architect@last-trace.net?subject=Request%20M%26A%20Data%20Room%20Access"
          className="mt-8 flex w-full max-w-xs items-center justify-center rounded-xl px-6 py-4 text-base font-bold"
          style={{ backgroundColor: '#0a0a0a', color: '#00e676', minHeight: 56 }}
        >
          Request Data Room Access
        </a>

        <button
          onClick={goHome}
          className="mt-4 flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold"
          style={{ backgroundColor: 'transparent', color: '#0a0a0a', border: '1.5px solid #0a0a0a', minHeight: 48 }}
        >
          <RotateCcw size={16} /> Start Over
        </button>
      </div>
    )
  }

  if (screen === 'result-mismatch') {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center px-6"
        style={{ backgroundColor: '#ff1744' }}
      >
        <XCircle size={72} color="#0a0a0a" />
        <p className="mt-3 text-4xl font-bold" style={{ color: '#0a0a0a' }}>
          ✗ MISMATCH
        </p>

        <p className="mt-6 max-w-sm text-center text-sm leading-relaxed font-medium" style={{ color: '#0a0a0a' }}>
          The physical items no longer match what was sealed at origin.
          <br /><br />
          In a live gate this shipment is rejected.
          <br />
          This is the exact failure that currently leaves the middle party with unprovable liability.
        </p>

        <a
          href="mailto:architect@last-trace.net?subject=Request%20M%26A%20Data%20Room%20Access"
          className="mt-8 flex w-full max-w-xs items-center justify-center rounded-xl px-6 py-4 text-base font-bold"
          style={{ backgroundColor: '#0a0a0a', color: '#ff1744', minHeight: 56 }}
        >
          Request Data Room Access
        </a>

        <button
          onClick={goHome}
          className="mt-4 flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold"
          style={{ backgroundColor: 'transparent', color: '#0a0a0a', border: '1.5px solid #0a0a0a', minHeight: 48 }}
        >
          <RotateCcw size={16} /> Start Over
        </button>
      </div>
    )
  }

  // ---------- MAIN UI ----------
  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ backgroundColor: '#0a0a0a', height: '100dvh' }}
    >
      <div className="mx-auto flex h-full w-full max-w-[480px] flex-col overflow-hidden px-4 pb-4 pt-3">
        {/* HOME */}
        {screen === 'home' && (
          <div className="flex flex-col">
            <div className="flex flex-col items-center gap-1 pt-1">
              <div className="flex items-center gap-2">
                <Shield size={28} style={{ color: '#00e676' }} />
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#f0f0f0' }}>
                  GateCheck
                </h1>
              </div>
              <p className="text-center text-xs" style={{ color: '#888' }}>
                Mathematical verification of physical handovers
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-4">
              <button
                onClick={startSeal}
                className="flex w-full items-center justify-center gap-3 rounded-xl px-6 py-5 text-xl font-bold"
                style={{ backgroundColor: '#00e676', color: '#0a0a0a', minHeight: 72 }}
              >
                <Package size={28} /> SEAL (Origin)
              </button>
              <button
                onClick={startVerify}
                className="flex w-full items-center justify-center gap-3 rounded-xl border-2 px-6 py-5 text-xl font-bold"
                style={{ borderColor: '#00e676', color: '#00e676', backgroundColor: 'transparent', minHeight: 72 }}
              >
                <ScanLine size={28} /> VERIFY (Destination)
              </button>
            </div>

            <button
              onClick={() => setShowHow(!showHow)}
              className="mt-6 flex items-center justify-center gap-2 text-sm"
              style={{ color: '#666' }}
            >
              <Info size={14} /> How it works
            </button>

            {showHow && (
              <div className="mt-3 rounded-lg p-4 text-xs leading-relaxed" style={{ backgroundColor: '#151515', color: '#aaa' }}>
                <p className="mb-2">
                  1. Origin scans items → SHA-256 produces a master hash.
                </p>
                <p className="mb-2">
                  2. Hash is encoded into a QR. No data is stored anywhere.
                </p>
                <p className="mb-2">
                  3. Destination scans the master QR + the same items.
                </p>
                <p>
                  4. Same computation is repeated. Match = gate opens. Mismatch = gate stays closed. Check runs in RAM and disappears.
                </p>
              </div>
            )}
          </div>
        )}

        {/* SEAL SCANNING */}
        {screen === 'seal-scanning' && (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <p className="text-center text-xs font-semibold uppercase tracking-wide" style={{ color: '#00e676' }}>
              Seal Mode — Scan Items
            </p>
            <div
              id={scannerDivId}
              className="overflow-hidden rounded-lg bg-black"
              style={{ width: '100%', height: '38vh' }}
            />
            <div className="flex min-h-0 flex-1 flex-col rounded-lg p-2" style={{ backgroundColor: '#151515' }}>
              <p className="mb-1 text-xs font-semibold uppercase" style={{ color: '#888' }}>
                Scanned ({scannedItems.length})
              </p>
              <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
                {scannedItems.map((item, i) => (
                  <li key={`${i}-${item}`} className="truncate font-mono text-xs" style={{ color: '#f0f0f0' }}>
                    {i + 1}. {item}
                  </li>
                ))}
                {scannedItems.length === 0 && (
                  <li className="font-mono text-xs" style={{ color: '#555' }}>
                    Point camera at a barcode…
                  </li>
                )}
              </ul>
            </div>
            <button
              onClick={finishSeal}
              disabled={scannedItems.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-6 py-4 text-lg font-bold disabled:opacity-40"
              style={{ backgroundColor: '#00e676', color: '#0a0a0a', minHeight: 56 }}
            >
              Done — Generate Master QR
            </button>
            <button onClick={goHome} className="flex items-center justify-center gap-2 py-1 text-sm" style={{ color: '#666' }}>
              <RotateCcw size={14} /> Start Over
            </button>
          </div>
        )}

        {/* SEAL RESULT */}
        {screen === 'seal-result' && (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
            <p className="text-center text-xs font-semibold uppercase tracking-wide" style={{ color: '#00e676' }}>
              Master QR Code
            </p>
            <div className="rounded-xl p-3" style={{ backgroundColor: '#0a0a0a' }}>
              <div ref={qrContainerRef} className="[&_img]:mx-auto [&_canvas]:mx-auto" />
            </div>

            <div className="w-full rounded-lg p-3" style={{ backgroundColor: '#151515' }}>
              <p className="mb-1 text-center text-xs uppercase" style={{ color: '#888' }}>
                SHA-256 Master Hash
              </p>
              <p className="break-all text-center font-mono text-xs" style={{ color: '#00e676' }}>
                {masterHash}
              </p>
            </div>

            <div className="flex w-full gap-3">
              <button
                onClick={saveQR}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-base font-bold"
                style={{ backgroundColor: '#00e676', color: '#0a0a0a', minHeight: 56 }}
              >
                <Download size={20} /> Save QR
              </button>
              <button
                onClick={shareQR}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-base font-bold"
                style={{ borderColor: '#00e676', color: '#00e676', backgroundColor: 'transparent', minHeight: 56 }}
              >
                <Share2 size={20} /> Share QR
              </button>
            </div>
            <button
              onClick={useForVerify}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-base font-bold"
              style={{ backgroundColor: '#1a1a1a', color: '#00e676', minHeight: 56 }}
            >
              <ScanLine size={20} /> Use for Verify
            </button>
            <button onClick={goHome} className="flex items-center justify-center gap-2 py-1 text-sm" style={{ color: '#666' }}>
              <RotateCcw size={16} /> Start Over
            </button>
          </div>
        )}

        {/* VERIFY STEP 1 */}
        {screen === 'verify-step1' && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <p className="text-center text-xs font-semibold uppercase tracking-wide" style={{ color: '#00e676' }}>
              Verify — Step 1: Scan Master QR
            </p>
            <div
              id={scannerDivId}
              className="overflow-hidden rounded-lg bg-black"
              style={{ width: '100%', height: '50vh' }}
            />
            <p className="text-center text-xs" style={{ color: '#555' }}>
              Point camera at the Master QR code from the origin.
            </p>
            <button onClick={goHome} className="flex items-center justify-center gap-2 py-2 text-sm" style={{ color: '#666' }}>
              <RotateCcw size={14} /> Start Over
            </button>
          </div>
        )}

        {/* VERIFY STEP 2 */}
        {screen === 'verify-step2' && (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <p className="text-center text-xs font-semibold uppercase tracking-wide" style={{ color: '#00e676' }}>
              Verify — Step 2: Scan Items
            </p>
            <div
              id={scannerDivId}
              className="overflow-hidden rounded-lg bg-black"
              style={{ width: '100%', height: '40vh' }}
            />
            <div className="flex min-h-0 flex-1 flex-col rounded-lg p-2" style={{ backgroundColor: '#151515' }}>
              <p className="mb-1 text-xs font-semibold uppercase" style={{ color: '#888' }}>
                Scanned ({scannedItems.length})
              </p>
              <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
                {scannedItems.map((item, i) => (
                  <li key={`${i}-${item}`} className="truncate font-mono text-xs" style={{ color: '#f0f0f0' }}>
                    {i + 1}. {item}
                  </li>
                ))}
                {scannedItems.length === 0 && (
                  <li className="font-mono text-xs" style={{ color: '#555' }}>
                    Point camera at a barcode…
                  </li>
                )}
              </ul>
            </div>
            <button
              onClick={finishVerify}
              disabled={scannedItems.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-6 py-4 text-lg font-bold disabled:opacity-40"
              style={{ backgroundColor: '#00e676', color: '#0a0a0a', minHeight: 56 }}
            >
              <Lock size={20} /> Verify Now
            </button>
            <button onClick={goHome} className="flex items-center justify-center gap-2 py-1 text-sm" style={{ color: '#666' }}>
              <RotateCcw size={14} /> Start Over
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
