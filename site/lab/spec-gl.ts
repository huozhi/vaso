// GPU shading for the glass highlights: rim light, body tint, far-side glow, thin-film color and the drop
// shadow. It reads the coarse distance field (distance + outward normal per cell) that the displacement map
// pass already computed, so the CPU only ever touches the low-resolution grid.

import type { Frame } from './engine'

const VERTEX = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`

const FRAGMENT = `#version 300 es
precision highp float;
uniform highp sampler2D uGrid;
uniform vec2 uOrigin;     // region origin, in grid cells
uniform vec2 uRegion;     // region size, in grid cells
uniform float uMs;        // grid cells per css px
uniform float uSs;        // canvas px per css px
uniform float uH;         // canvas height in px
uniform vec2 uLight;
uniform float uTint;
uniform vec3 uTintColor;
uniform float uRim;
uniform float uGlow;
uniform float uShadow;
uniform float uIri;
uniform float uRimWidth;
uniform float uBezel;
uniform float uTime;
uniform float uSheen;
out vec4 outColor;

const float REACH = 22.0;

vec4 cell(ivec2 c) {
  c = clamp(c, ivec2(0), ivec2(uRegion) - 1);
  return texelFetch(uGrid, c, 0);
}

vec4 field(vec2 p) {
  vec2 f = p * uMs - 0.5 - uOrigin;
  if (f.x < -1.0 || f.y < -1.0 || f.x > uRegion.x || f.y > uRegion.y) return vec4(1e4, 0.0, 0.0, 0.0);
  vec2 i = floor(f);
  vec2 t = f - i;
  ivec2 c = ivec2(i);
  return mix(mix(cell(c), cell(c + ivec2(1, 0)), t.x), mix(cell(c + ivec2(0, 1)), cell(c + ivec2(1, 1)), t.x), t.y);
}

void over(inout vec4 dst, vec3 color, float alpha) {
  dst = vec4(color * alpha, alpha) + dst * (1.0 - alpha);
}

vec3 film(float phase) {
  return 0.5 + 0.5 * cos(6.28318 * (phase + vec3(0.0, 0.33, 0.67)));
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uH - gl_FragCoord.y) / uSs;
  vec4 F = field(p);
  float d = F.x;
  if (d > REACH + 2.0) { outColor = vec4(0.0); return; }
  float coverage = clamp(0.5 - d * uSs, 0.0, 1.0);
  vec4 col = vec4(0.0);

  // Drop shadow: the field sampled a few pixels up, so the shadow falls below the glass
  if (uShadow > 0.0 && coverage < 1.0) {
    float ds = field(p - vec2(0.0, 5.0)).x;
    if (ds < REACH) {
      float k = max(ds, 0.0) / REACH;
      col.a = uShadow * (1.0 - k) * (1.0 - k) * (1.0 - coverage);
    }
  }

  if (coverage > 0.0) {
    vec2 n = F.yz;
    n = length(n) > 1e-5 ? normalize(n) : vec2(0.0, -1.0);
    vec2 L = normalize(uLight - p + 1e-5);
    float facing = dot(n, L);
    float depth = max(-d, 0.0);

    over(col, uTintColor / 255.0, uTint * coverage);

    // Broad sheen on the slope of the bezel that faces the light
    float slope = exp(-depth / (uBezel * 0.45));
    over(col, vec3(1.0), uSheen * slope * max(facing, 0.0) * max(facing, 0.0) * coverage);

    // Light entering on the near side exits and pools on the far side of the bezel
    float pool = uGlow * max(-facing, 0.0) * exp(-depth / (uBezel * 0.55)) * coverage;
    over(col, vec3(1.0), pool);

    // Fresnel rim: brightest where the rim faces the light, with a fainter kick on the opposite edge
    float lit = facing > 0.0 ? 0.18 + 0.82 * facing * facing : 0.18 + 0.5 * pow(-facing, 3.0);
    float rimA = min(1.0, uRim * exp(-depth / uRimWidth) * lit * coverage * 1.15);
    vec3 rimColor = vec3(1.0);
    if (uIri > 0.0) {
      // Thin-film interference: hue drifts with depth into the rim, direction and time
      float phase = depth * 0.09 + atan(n.y, n.x) * 0.5 + uTime * 0.6;
      rimColor = mix(vec3(1.0), 0.62 + 0.38 * (film(phase) * 2.0 - 1.0), uIri);
    }
    over(col, rimColor, rimA);

    if (uIri > 0.0) {
      float phase = depth * 0.012 + (p.x + p.y) * 0.002 + uTime * 0.25;
      over(col, film(phase), 0.16 * uIri * coverage * exp(-depth / (uBezel * 1.4)));
    }
  }
  outColor = col;
}`

/** Size steps for the shared drawing buffer, so it rarely needs to be reallocated */
const BUFFER_STEP = 256

let shared: SpecGL | null | undefined

/** One WebGL context for every glass layer on the page. Browsers only keep around 16 contexts alive per page and
 * drop the oldest beyond that, so each layer renders here in turn and copies the result into its own 2D canvas */
export class SpecGL {
  private gl: WebGL2RenderingContext
  private program: WebGLProgram
  private texture: WebGLTexture
  private uniforms: Record<string, WebGLUniformLocation | null> = {}

  static shared() {
    if (shared !== undefined) return shared
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = BUFFER_STEP
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false, alpha: true })
    try {
      shared = gl ? new SpecGL(gl) : null
    } catch {
      shared = null
    }
    // If the context is lost, the next layers fall back to CPU shading
    canvas.addEventListener('webglcontextlost', () => (shared = null))
    return shared
  }

  private constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
    const compile = (type: number, src: string) => {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, src)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader')
      return shader
    }
    const program = gl.createProgram()!
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link')
    this.program = program
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(program, 'aPos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    this.texture = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    for (const name of [
      'uGrid', 'uOrigin', 'uRegion', 'uMs', 'uSs', 'uH', 'uLight', 'uTint', 'uTintColor', 'uRim', 'uGlow',
      'uShadow', 'uIri', 'uRimWidth', 'uBezel', 'uTime', 'uSheen',
    ]) {
      this.uniforms[name] = gl.getUniformLocation(program, name)
    }
  }

  draw(
    frame: Frame,
    grid: { data: Float32Array; width: number; height: number; x0: number; y0: number },
    mapScale: number,
    specScale: number,
    size: { width: number; height: number },
    target: HTMLCanvasElement,
  ) {
    const gl = this.gl
    const canvas = gl.canvas as HTMLCanvasElement
    const tw = target.width
    const th = target.height
    // Grow the shared buffer to fit the largest layer; it never shrinks
    if (canvas.width < tw || canvas.height < th) {
      canvas.width = Math.max(canvas.width, Math.ceil(tw / BUFFER_STEP) * BUFFER_STEP)
      canvas.height = Math.max(canvas.height, Math.ceil(th / BUFFER_STEP) * BUFFER_STEP)
    }
    // Render into the bottom-left corner, which is where WebGL's origin is
    gl.viewport(0, 0, tw, th)
    gl.enable(gl.SCISSOR_TEST)
    gl.scissor(0, 0, tw, th)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    const ctx = target.getContext('2d')!
    ctx.clearRect(0, 0, tw, th)
    if (grid.width < 1 || grid.height < 1) return

    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, grid.width, grid.height, 0, gl.RGBA, gl.FLOAT, grid.data)

    const u = this.uniforms
    const look = frame.look ?? {}
    const light = frame.light ?? { x: size.width * 0.2, y: -size.height }
    const tint = look.tintColor ?? [255, 255, 255]
    gl.uniform1i(u.uGrid, 0)
    gl.uniform2f(u.uOrigin, grid.x0, grid.y0)
    gl.uniform2f(u.uRegion, grid.width, grid.height)
    gl.uniform1f(u.uMs, mapScale)
    gl.uniform1f(u.uSs, specScale)
    gl.uniform1f(u.uH, th)
    gl.uniform2f(u.uLight, light.x, light.y)
    gl.uniform1f(u.uTint, look.tint ?? 0.06)
    gl.uniform3f(u.uTintColor, tint[0], tint[1], tint[2])
    gl.uniform1f(u.uRim, look.rim ?? 0.75)
    gl.uniform1f(u.uGlow, look.glow ?? 0.35)
    gl.uniform1f(u.uShadow, look.shadow ?? 0.22)
    gl.uniform1f(u.uIri, look.iridescence ?? 0)
    gl.uniform1f(u.uRimWidth, look.rimWidth ?? 1.4)
    gl.uniform1f(u.uBezel, frame.bezel)
    gl.uniform1f(u.uTime, frame.time ?? 0)
    gl.uniform1f(u.uSheen, look.sheen ?? 0.12)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    // Same task as the draw, so the drawing buffer is still intact; in canvas coordinates it sits at the bottom
    ctx.drawImage(canvas, 0, canvas.height - th, tw, th, 0, 0, tw, th)
  }
}
