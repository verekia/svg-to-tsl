// MSDF reconstruction fragment shader. The texture stores per-channel
// signed distance mapped to [0, 1]; we take the median, recenter at 0,
// and compute coverage from screen-space derivatives.

export const msdfFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform vec3 uBackground;
  uniform float uThreshold;
  uniform float uOpacity;
  varying vec2 vUv;

  float median3(vec3 v) {
    return max(min(v.r, v.g), min(max(v.r, v.g), v.b));
  }

  void main() {
    vec3 sample = texture2D(uMap, vUv).rgb;
    float sd = median3(sample) - uThreshold;
    float aa = max(fwidth(sd), 1e-5);
    float coverage = clamp(sd / aa + 0.5, 0.0, 1.0);

    #if ALPHA_ONLY
      gl_FragColor = vec4(uColor, coverage * uOpacity);
    #else
      vec3 rgb = mix(uBackground, uColor, coverage);
      float alpha = mix(uOpacity * 0.0, uOpacity, coverage);
      gl_FragColor = vec4(rgb, max(coverage * uOpacity, alpha));
    #endif
  }
`
