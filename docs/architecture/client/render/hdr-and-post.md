Source: apps/client/src/render/hdrTarget.ts, apps/client/src/render/postPass.ts, apps/client/src/render/gl.ts

# HDR target and tone mapping

The scene is drawn off-screen in linear HDR. A final pass maps it to the canvas.

## Canvas context

`createContext` asks for WebGL2 with `antialias: false`, `depth: false`, `alpha: false`. The default framebuffer has no depth buffer. It receives only the tone-mapped image and the screen bars. It throws if WebGL2 is not available.

## HdrTarget

- Three framebuffers: a multisampled one (colour and `DEPTH_COMPONENT24` renderbuffers), a resolve one (a colour texture), and a grab one (a colour texture and a `DEPTH_COMPONENT24` texture).
- Samples: up to 4, capped by what the format supports.
- Format: `RGBA16F` if `EXT_color_buffer_float` exists, else `RGBA8`.
- `begin(w, h)`: reallocates on a size change, binds the multisampled target, sets the viewport and clears colour and depth.
- `grab()`: mid-frame. One blit (`NEAREST`) copies the multisampled colour (resolved) and depth (one sample) into the grab textures. Then it binds the multisampled target again, so drawing goes on. It returns a `SceneGrab`: `color` (linear filtered) and `depth` (0..1, nearest, no compare mode). The water reads it (`client/render/water.md`).
- `resolve()`: blits the multisampled image into the texture and binds the default framebuffer.
- `texture`: the resolved image.

All textures reallocate together on a size change.

Size equals the canvas drawing buffer (`fitCanvas` sets it to CSS size times `dpr`).

## PostPass

A fullscreen triangle with `texelFetch` on the HDR texture:

1. Multiply by `EXPOSURE` (0.42).
2. ACES filmic curve.
3. Linear to sRGB.
4. Light vignette.
5. Dither of one 8-bit step.

`draw(hdr, width, height)` writes the bound framebuffer at that size. The size must match the HDR image, because it reads with `texelFetch` at `gl_FragCoord`. The `Renderer` passes the canvas drawing buffer size. `PortraitRenderer` passes 256 and binds its own target (`client/render/portraits.md`).

## HDR gains

Things that are drawn into the HDR scene but must look like nominal sRGB colours are scaled up so tone mapping brings them back:

- Ground marks: `GROUND_GAIN` 2.4 (`render/overlay.ts`, `marks.ts`).
- Lines: `GAIN` 2.4 (`render/lines.ts`).
- Billboard glows: `GAIN` 4.0, so cores over-expose to white (`render/billboards.ts`).

The screen bars are drawn after `post` with `hdrGain` 0, so they write plain sRGB.

## Rules

- A pass before `post` writes linear radiance. Convert sRGB colours with `pow(c, 2.2)`.
- A pass after `post` writes 8-bit sRGB.
- Change the overall brightness with `EXPOSURE` only.
