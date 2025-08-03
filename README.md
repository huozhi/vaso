# Vaso

A beautiful liquid glass distortion effect component for React that creates stunning visual magnification and warping effects.

Vaso is the React version of [shuding](https://github.com/shuding)'s [Liquid Glass](https://github.com/shuding/liquid-glass) implementation.

![image](./site/app/opengraph-image.png)

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
| `radius` | `number` | `0` | `0-∞` | Border radius of the glass container |
| `depth` | `number` | `0.4` | `-2.0 to 2.0` | Distortion scale intensity (negative values create compression) |

### Negative Values Support

Vaso supports negative values for several parameters to create inverted effects:

- **`depth`** (`-2.0 to 2.0`): Negative values create compression instead of magnification

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

