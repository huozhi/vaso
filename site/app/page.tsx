'use client'

import { Vaso } from "../../src"
import { HoverCodeGlass } from "../components/hover-vaso"

function CodeGlass({ children, ...props }: { children: React.ReactNode } & React.ComponentProps<typeof Vaso>) {
  return (
    <Vaso component="span" px={2} py={0} borderRadius={3} scale={10} blur={0} contrast={1.1} {...props}>
      {children}
    </Vaso>
  )
}

export default function DocsPage() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap" rel="stylesheet" />
      
      <div className="min-h-screen p-8 pt-22 bg-[#e0e5e1]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        <div className="max-w-3xl mx-auto">
          <header className="mb-12">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              El Vaso
            </h1>
            <p className="text-lg text-gray-600">
              Liquid Glass Effect for React
            </p>
          </header>

          <div className="bg-[#dbdcd7] p-8 space-y-8 rounded-lg shadow-[0_35px_60px_-15px_rgba(0,0,0,0.2),0_20px_25px_-5px_rgba(0,0,0,0.3),0_10px_10px_-5px_rgba(0,0,0,0.2)]">
            <section className="border-b border-gray-400 pb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Installation</h2>
              <p className="text-gray-700 mb-4">
                Install Vaso using your preferred package manager. You can install it with{" "}
                <HoverCodeGlass blurAmount={4}>
                  <code className="px-2 py-1 text-sm text-black">
                    npm install vaso
                  </code>
                </HoverCodeGlass>{" "}
              </p>
            </section>

            <section className="border-b border-gray-400 pb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Start</h2>
              <p className="text-gray-700 mb-4">
                Import the{" "}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm text-black">
                    Vaso
                  </code>
                </CodeGlass>{" "}
                component in your React application and wrap it around any content you want to apply the glass effect to.
              </p>
            </section>

            <section className="border-b border-gray-400 pb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Props</h2>
              <p className="text-gray-700 mb-4">
                The component accepts several props to customize the glass effect. The most commonly used ones are{" "}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm text-black">
                    scale
                  </code>
                  </CodeGlass>{" "}
                for distortion intensity,{" "}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm text-black">
                    blur
                  </code>
                </CodeGlass>{" "}
                for background blur, and{" "}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm text-black">
                    borderRadius
                  </code>
                </CodeGlass>{" "}
                for rounded corners.
              </p>
            </section>

            <section className="border-b border-gray-400 pb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Advanced Features</h2>
              <p className="text-gray-700 mb-4">
                For more complex effects, you can use{" "}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm text-black">
                    distortionIntensity
                  </code>
                </CodeGlass>{" "}
                to control the warping effect, or enable{" "}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm text-black">
                    draggable={true}
                  </code>
                </CodeGlass>{" "}
                to make the glass moveable by the user.
              </p>
            </section>

            <section className="border-b border-gray-400 pb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Tips</h2>
              <p className="text-gray-700">
                For optimal performance, avoid using too many Vaso instances simultaneously. Consider using{" "}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm text-black">
                    React.memo()
                  </code>
                </CodeGlass>{" "}
                to prevent unnecessary re-renders and implement{" "}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm text-black">
                    onPositionChange
                  </code>
                </CodeGlass>{" "}
                callbacks efficiently to maintain smooth animations.
              </p>
            </section>

            <section>
              <p className="text-gray-700">
              author:{" "}
                <CodeGlass>
                  <span className="text-gray-700 font-bold p-1 rounded-md">
                    huozhi
                  </span>
                </CodeGlass>
                {/* dot divider */}
                <span className="text-gray-700">{' • '}</span>
                <span>
                  license:
                </span>
                <span className="text-gray-700 font-bold">
                  MIT
                </span>
              </p>
              
            </section>
          </div>
        </div>
      </div>
    </>
  )
}

