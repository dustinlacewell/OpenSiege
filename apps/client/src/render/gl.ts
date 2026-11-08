/** The default framebuffer only receives the tone-mapped image and screen marks; the scene renders off-screen. */
/** `lowLatency` asks the browser to skip the compositor's frame queue: less lag behind the pointer, some tearing. */
export function createContext(canvas: HTMLCanvasElement, lowLatency = false): WebGL2RenderingContext {
  const gl = canvas.getContext("webgl2", {
    antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: "high-performance",
    desynchronized: lowLatency,
  });
  if (!gl) throw new Error("WebGL2 is not available");
  return gl;
}

export function createProgram(gl: WebGL2RenderingContext, vsSource: string, fsSource: string): WebGLProgram {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vsSource));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fsSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`link failed: ${gl.getProgramInfoLog(program)}`);
  }
  return program;
}

export function uniform(gl: WebGL2RenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation | null {
  return gl.getUniformLocation(program, name);
}

/** Static buffer of a unit quad (-1..1) as two triangles. */
export function createQuad(gl: WebGL2RenderingContext): WebGLBuffer {
  return staticBuffer(gl, gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]));
}

/** A buffer filled once. Leaves it bound to `target`. */
export function staticBuffer(gl: WebGL2RenderingContext, target: number, data: ArrayBufferView): WebGLBuffer {
  const buf = gl.createBuffer();
  gl.bindBuffer(target, buf);
  gl.bufferData(target, data, gl.STATIC_DRAW);
  return buf;
}

/** Interleaved float attributes of the bound ARRAY_BUFFER into the bound VAO. */
export function vertexLayout(gl: WebGL2RenderingContext, sizes: readonly number[]): void {
  const stride = sizes.reduce((a, b) => a + b, 0) * 4;
  let offset = 0;
  sizes.forEach((size, location) => {
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
    offset += size * 4;
  });
}

/** Size the drawing buffer to the canvas CSS size times devicePixelRatio. Returns true on change. */
export function fitCanvas(canvas: HTMLCanvasElement, dpr: number): boolean {
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width === w && canvas.height === h) return false;
  canvas.width = w;
  canvas.height = h;
  return true;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("createShader failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`shader compile failed: ${gl.getShaderInfoLog(shader)}\n${source}`);
  }
  return shader;
}
