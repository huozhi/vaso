"use client"

import { useState, useEffect, useCallback } from "react"
import { Vaso } from "../../../src"
import { Slider } from "../../components/ui/slider"
import { Label } from "../../components/ui/label"
import { Button } from "../../components/ui/button" 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select"
import { RotateCcw, Plus } from "lucide-react"

const defaultControls = {
  scale: 50,
  blur: 0.25,
  contrast: 1.2,
  brightness: 1.05,
  saturation: 1.1,
  borderRadius: 20,
  padding: 20,
  distortionIntensity: 0.15,
  roundness: 0.6,
  width: 0.3,
  height: 0.2,
  glassWidth: 200,
  glassHeight: 150,
}

type GlassInstance = {
  id: string
  name: string
  position: { x: number; y: number }
  controls: typeof defaultControls
}

export default function LiquidGlassDemo() {
  const [glasses, setGlasses] = useState<GlassInstance[]>([
    {
      id: "glass-1",
      name: "Glass 1",
      position: { x: 300, y: 200 },
      controls: defaultControls,
    },
  ])
  const [selectedGlassId, setSelectedGlassId] = useState("glass-1")

  // Get the currently selected glass
  const selectedGlass = glasses.find((g) => g.id === selectedGlassId) || glasses[0]

  // Load from localStorage on mount
  useEffect(() => {
    const savedGlasses = localStorage.getItem("liquid-glass-instances")

    if (savedGlasses) {
      try {
        const parsedGlasses = JSON.parse(savedGlasses)
        if (parsedGlasses.length > 0) {
          setGlasses(parsedGlasses)
          setSelectedGlassId(parsedGlasses[0].id)
        }
      } catch (e) {
        console.error("Failed to parse saved glasses:", e)
      }
    }
  }, [])

  // Save to localStorage whenever glasses change
  useEffect(() => {
    localStorage.setItem("liquid-glass-instances", JSON.stringify(glasses))
  }, [glasses])

  const resetControls = () => {
    setGlasses((prev) =>
      prev.map((glass) => (glass.id === selectedGlassId ? { ...glass, controls: defaultControls } : glass)),
    )
  }

  const updateSelectedGlassControl = useCallback(
    (key: string, value: number) => {
      setGlasses((prev) =>
        prev.map((glass) =>
          glass.id === selectedGlassId ? { ...glass, controls: { ...glass.controls, [key]: value } } : glass,
        ),
      )
    },
    [selectedGlassId],
  )

  const addGlass = () => {
    const glassNumber = glasses.length + 1
    const newGlass: GlassInstance = {
      id: `glass-${Date.now()}`,
      name: `Glass ${glassNumber}`,
      position: {
        x: 200 + Math.random() * 200,
        y: 150 + Math.random() * 200,
      },
      controls: defaultControls,
    }
    setGlasses((prev) => [...prev, newGlass])
    setSelectedGlassId(newGlass.id)
  }


  const updateGlassPosition = useCallback((id: string, position: { x: number; y: number }) => {
    setGlasses((prev) => prev.map((glass) => (glass.id === id ? { ...glass, position } : glass)))
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 relative">
      {/* Paper texture background */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 40% 80%, rgba(120, 219, 255, 0.3) 0%, transparent 50%),
            repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.02) 2px, rgba(0,0,0,0.02) 4px),
            repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(0,0,0,0.01) 2px, rgba(0,0,0,0.01) 4px)
          `,
          backgroundSize: "400px 400px, 300px 300px, 500px 500px, 20px 20px, 20px 20px",
        }}
      />

      {/* Subtle paper grain */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.1'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-1 flex max-w-[780px] mx-auto h-screen">
        {/* Sharp Controls Panel */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
          <div className="p-6 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Glass Controls</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addGlass} className="h-8 w-8 p-0">
                  <Plus className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={resetControls} className="h-8 w-8 p-0">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Glass Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Select Glass to Edit</Label>
              <Select value={selectedGlassId} onValueChange={setSelectedGlassId}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {glasses.map((glass) => (
                    <SelectItem key={glass.id} value={glass.id}>
                      {glass.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Editing: {selectedGlass?.name} • Total: {glasses.length} glasses
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Distortion Properties - All support negative values */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Distortion Properties</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-gray-700">Scale</Label>
                    <span className="text-sm text-gray-500 font-mono">{selectedGlass?.controls.scale}</span>
                  </div>
                  <Slider
                    value={[selectedGlass?.controls.scale || 50]}
                    onValueChange={([value]) => updateSelectedGlassControl("scale", value)}
                    max={200}
                    min={-100}
                    step={5}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-gray-700">Intensity</Label>
                    <span className="text-sm text-gray-500 font-mono">
                      {selectedGlass?.controls.distortionIntensity.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[selectedGlass?.controls.distortionIntensity || 0.15]}
                    onValueChange={([value]) => updateSelectedGlassControl("distortionIntensity", value)}
                    max={0.5}
                    min={-0.5}
                    step={0.01}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-gray-700">Roundness</Label>
                    <span className="text-sm text-gray-500 font-mono">
                      {selectedGlass?.controls.roundness.toFixed(1)}
                    </span>
                  </div>
                  <Slider
                    value={[selectedGlass?.controls.roundness || 0.6]}
                    onValueChange={([value]) => updateSelectedGlassControl("roundness", value)}
                    max={1}
                    min={-1}
                    step={0.1}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-gray-700">Aspect Ratio</Label>
                    <span className="text-sm text-gray-500 font-mono">
                      {(
                        (selectedGlass?.controls.width || 0.3) / Math.max(0.01, selectedGlass?.controls.height || 0.2)
                      ).toFixed(1)}
                    </span>
                  </div>
                  <Slider
                    value={[selectedGlass?.controls.width || 0.3]}
                    onValueChange={([value]) => updateSelectedGlassControl("width", value)}
                    max={0.5}
                    min={-0.5}
                    step={0.05}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Visual Effects */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Visual Effects</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-gray-700">Blur</Label>
                    <span className="text-sm text-gray-500 font-mono">{selectedGlass?.controls.blur.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[selectedGlass?.controls.blur || 0.25]}
                    onValueChange={([value]) => updateSelectedGlassControl("blur", value)}
                    max={2}
                    min={0}
                    step={0.05}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-gray-700">Contrast</Label>
                    <span className="text-sm text-gray-500 font-mono">
                      {selectedGlass?.controls.contrast.toFixed(1)}
                    </span>
                  </div>
                  <Slider
                    value={[selectedGlass?.controls.contrast || 1.2]}
                    onValueChange={([value]) => updateSelectedGlassControl("contrast", value)}
                    max={3}
                    min={0.5}
                    step={0.1}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-gray-700">Brightness</Label>
                    <span className="text-sm text-gray-500 font-mono">
                      {selectedGlass?.controls.brightness.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[selectedGlass?.controls.brightness || 1.05]}
                    onValueChange={([value]) => updateSelectedGlassControl("brightness", value)}
                    max={2}
                    min={0.5}
                    step={0.05}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-gray-700">Saturation</Label>
                    <span className="text-sm text-gray-500 font-mono">
                      {selectedGlass?.controls.saturation.toFixed(1)}
                    </span>
                  </div>
                  <Slider
                    value={[selectedGlass?.controls.saturation || 1.1]}
                    onValueChange={([value]) => updateSelectedGlassControl("saturation", value)}
                    max={2}
                    min={0}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Appearance */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Appearance</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-gray-700">Border Radius</Label>
                    <span className="text-sm text-gray-500 font-mono">{selectedGlass?.controls.borderRadius}px</span>
                  </div>
                  <Slider
                    value={[selectedGlass?.controls.borderRadius || 20]}
                    onValueChange={([value]) => updateSelectedGlassControl("borderRadius", value)}
                    max={50}
                    min={0}
                    step={1}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-gray-700">Padding</Label>
                    <span className="text-sm text-gray-500 font-mono">{selectedGlass?.controls.padding}px</span>
                  </div>
                  <Slider
                    value={[selectedGlass?.controls.padding || 20]}
                    onValueChange={([value]) => updateSelectedGlassControl("padding", value)}
                    max={100}
                    min={0}
                    step={5}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-gray-700">Glass Width</Label>
                    <span className="text-sm text-gray-500 font-mono">{selectedGlass?.controls.glassWidth}px</span>
                  </div>
                  <Slider
                    value={[selectedGlass?.controls.glassWidth || 200]}
                    onValueChange={([value]) => updateSelectedGlassControl("glassWidth", value)}
                    max={400}
                    min={50}
                    step={10}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-gray-700">Glass Height</Label>
                    <span className="text-sm text-gray-500 font-mono">{selectedGlass?.controls.glassHeight}px</span>
                  </div>
                  <Slider
                    value={[selectedGlass?.controls.glassHeight || 150]}
                    onValueChange={([value]) => updateSelectedGlassControl("glassHeight", value)}
                    max={400}
                    min={50}
                    step={10}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Demo Area */}
        <div className="flex-1 h-full overflow-visible">
          <div className="p-2">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Multiple Liquid Glass Demo</h1>
              <p className="text-gray-600">Select a glass to edit its properties individually</p>
            </div>

            <div className="relative min-h-[800px] bg-white/40 backdrop-blur-sm border border-white/20 shadow-lg overflow-visible">
              {/* Background content */}
              <div className="p-2 space-y-2">
                <div className="space-y-6">
                  <h3 className="text-2xl font-bold text-gray-800">Sample Content for Liquid Glass Effects</h3>
                  <p className="text-gray-600 leading-relaxed">
                    This is sample text content that will be distorted by the liquid glass effects. Each glass can now
                    be configured individually with its own unique parameters. Select different glasses from the control
                    panel to customize them separately. The liquid glass effect creates a beautiful magnifying and
                    distortion effect that bends and warps the content underneath, creating an immersive visual
                    experience.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-gray-700">Visual Elements</h4>
                      <div className="space-y-2">
                        <div className="h-4 bg-gradient-to-r from-blue-200 to-purple-200"></div>
                        <div className="h-4 bg-gradient-to-r from-green-200 to-blue-200 w-3/4"></div>
                        <div className="h-4 bg-gradient-to-r from-purple-200 to-pink-200 w-1/2"></div>
                        <div className="h-4 bg-gradient-to-r from-yellow-200 to-orange-200 w-2/3"></div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-gray-700">Interactive Elements</h4>
                      <div className="flex flex-wrap gap-2">
                        <button className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 transition-colors">
                          Button 1
                        </button>
                        <button className="px-4 py-2 bg-green-500 text-white hover:bg-green-600 transition-colors">
                          Button 2
                        </button>
                        <button className="px-4 py-2 bg-purple-500 text-white hover:bg-purple-600 transition-colors">
                          Button 3
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="aspect-square max-w-xs bg-gradient-to-br from-orange-200 via-red-200 to-pink-200 flex items-center justify-center mx-auto">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-gray-700 mb-2">42</div>
                      <div className="text-sm text-gray-600">Magic Number</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="aspect-square bg-gradient-to-br from-cyan-200 to-blue-200 flex items-center justify-center">
                      <span className="text-lg font-bold text-gray-600">A</span>
                    </div>
                    <div className="aspect-square bg-gradient-to-br from-green-200 to-emerald-200 flex items-center justify-center">
                      <span className="text-lg font-bold text-gray-600">B</span>
                    </div>
                    <div className="aspect-square bg-gradient-to-br from-yellow-200 to-orange-200 flex items-center justify-center">
                      <span className="text-lg font-bold text-gray-600">C</span>
                    </div>
                    <div className="aspect-square bg-gradient-to-br from-pink-200 to-red-200 flex items-center justify-center">
                      <span className="text-lg font-bold text-gray-600">D</span>
                    </div>
                  </div>

                  <div className="p-6 bg-gradient-to-r from-indigo-100 to-purple-100">
                    <h5 className="font-semibold text-gray-700 mb-4">Statistics Dashboard</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Active Users:</span>
                        <span className="font-mono font-semibold">1,234</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Monthly Revenue:</span>
                        <span className="font-mono font-semibold">$5,678</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Growth Rate:</span>
                        <span className="font-mono font-semibold text-green-600">+12.5%</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-gray-700">Lorem Ipsum Content</h4>
                    <p className="text-gray-600 leading-relaxed">
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut
                      labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
                      nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit
                      esse cillum dolore eu fugiat nulla pariatur.
                    </p>
                    <p className="text-gray-600 leading-relaxed">
                      Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id
                      est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque
                      laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto
                      beatae vitae dicta sunt explicabo.
                    </p>
                  </div>
                </div>
              </div>

              {/* Multiple Draggable Liquid Glasses */}
              {glasses.map((glass) => (
                <Vaso
                  key={glass.id}
                  width={glass.controls.glassWidth}
                  height={glass.controls.glassHeight}
                  px={glass.controls.padding}
                  py={glass.controls.padding}
                  borderRadius={glass.controls.borderRadius}
                  scale={glass.controls.scale}
                  blur={glass.controls.blur}
                  contrast={glass.controls.contrast}
                  brightness={glass.controls.brightness}
                  saturation={glass.controls.saturation}
                  distortionIntensity={glass.controls.distortionIntensity}
                  roundness={glass.controls.roundness}
                  shapeWidth={glass.controls.width}
                  shapeHeight={glass.controls.height}
                  draggable={true}
                  initialPosition={glass.position}
                  onPositionChange={(position) => updateGlassPosition(glass.id, position)}
                  onSelect={() => setSelectedGlassId(glass.id)}
                >
                  <div className="bg-transparent" />
                </Vaso>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
