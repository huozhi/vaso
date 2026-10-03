# Vaso

A beautiful liquid glass distortion effect component for React that creates stunning visual magnification and warping effects.

![image](./site/opengraph-image.png)

## Installation

```bash
npm add vaso
```

## Quick Start

```tsx
import { Vaso } from 'vaso'

function App() {
  return (
    <div>
      <h1>Some content here</h1>
      <p>This text will be distorted by the glass effect</p>
      
      <Vaso
        px={20}
        py={20}
        radius={15}
        depth={1.2}
        blur={0.5}
      />
    </div>
  )
}
```

## API Reference

### Props

| Prop | Type | Default | Range | Description |
|------|------|---------|-------|-------------|
| `children` | `React.ReactNode` | **required** | - | The content to render inside the glass (typically a transparent div for sizing) |
| `width` | `number` | `undefined` | - | Explicit width of the glass element (overrides child element size) |
| `height` | `number` | `undefined` | - | Explicit height of the glass element (overrides child element size) |
| `px` | `number` | `0` | `0-100` | Horizontal padding around the glass effect |
| `py` | `number` | `0` | `0-100` | Vertical padding around the glass effect |
| `radius` | `number` | inherited | `0-∞` | Border radius of the glass. Defaults to the element's computed `border-radius`, so classes like `rounded-full` just work |
| `depth` | `number` | `0` | `-5.0 to 5.0` | Refraction strength at the bezel (negative values create a concave, compressing glass) |
| `blur` | `number` | `0.1` | `0-10` | Backdrop blur in pixels |
| `dispersion` | `number \| false` | `0.5` | `0-3.0` | Spectral (rainbow) dispersion along the refracting edge, like Figma's glass. Scales with the glass size and fades out as `depth` approaches 0 |
| `specular` | `number \| false` | `0.5` | `0-1.0` | Intensity of the specular rim highlight |

### Browser Support

The refraction is rendered with an SVG filter inside `backdrop-filter`, which is currently only supported by Chromium based browsers (Chrome, Edge, Arc, Opera, ...).

Safari and Firefox don't render those, so Vaso refracts a copy of what's behind the glass instead, with no extra setup:

- It clones the nearest ancestor with visible content (text, images, video, canvas or a background), leaving out every glass layer and anything stacked above this glass.
- The clone is kept aligned every frame, so dragging, scrolling and transitions stay in sync. Videos and canvases are mirrored into it frame by frame.
- DOM changes re-clone it, swapping only once the new clone's images and videos have loaded. Style changes (themes, late stylesheets) refresh it without cloning.
- Transparent areas are filled with the color behind the content, so nothing shows through twice.

Limits: sources larger than 400 elements aren't cloned (the glass keeps its blur and rim instead), and CSS that depends on an ancestor outside the cloned element may style the copy differently.

## Examples


### Basic Glass Effect

```tsx
<Vaso
  className="w-48 h-36 bg-transparent"
  px={20}
  py={20}
  radius={12}
  depth={1.5}
  blur={0.3}
/>
```

### Glass with Explicit Dimensions

```tsx
<Vaso
  className="w-48 h-36 bg-transparent"
  width={300}
  height={200}
  px={20}
  py={20}
  radius={12}
  depth={1.5}
  blur={0.3}
/>
```


### High Distortion Effect

```tsx
<Vaso
  className="w-48 h-36 bg-transparent"
  px={30}
  py={30}
  depth={2.0}
  blur={0.6}
/>
```

## License

MIT

