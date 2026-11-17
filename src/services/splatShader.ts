/**
 * High-performance 3D Gaussian Splatting Vertex & Fragment Shaders for Three.js
 * Implements 3D covariance projection, 2D screen covariance estimation,
 * anisotropic splat orientation, alpha falloff, depth map, and ellipsoid debug modes.
 */

export const splatVertexShader = /* glsl */ `
  precision highp float;

  attribute vec3 instancePosition;
  attribute vec3 instanceScale;
  attribute vec4 instanceRotation; // qw, qx, qy, qz
  attribute vec3 instanceColor;
  attribute float instanceOpacity;

  uniform vec2 uViewportSize;
  uniform float uFocalLength;
  uniform float uSplatScale;
  uniform float uMaxSplatSize; // world scale cutoff to eliminate giant floaters
  uniform int uRenderMode; // 0: radiance, 1: pointcloud, 2: ellipsoids, 3: depth, 4: density

  // Crop Box Uniforms
  uniform bool uCropEnabled;
  uniform vec3 uCropMin;
  uniform vec3 uCropMax;
  uniform float uFloorClipY;

  varying vec2 vUv;
  varying vec3 vColor;
  varying float vOpacity;
  varying float vDepth;
  varying vec3 vWorldPos;
  varying float vDiscard;

  // Convert quaternion to 3x3 rotation matrix
  mat3 quatToMat3(vec4 q) {
    float w = q.x;
    float x = q.y;
    float y = q.z;
    float z = q.w;

    return mat3(
      1.0 - 2.0 * (y * y + z * z), 2.0 * (x * y - w * z),       2.0 * (x * z + w * y),
      2.0 * (x * y + w * z),       1.0 - 2.0 * (x * x + z * z), 2.0 * (y * z - w * x),
      2.0 * (x * z - w * y),       2.0 * (y * z + w * x),       1.0 - 2.0 * (x * x + y * y)
    );
  }

  void main() {
    vWorldPos = instancePosition;
    vDiscard = 0.0;

    // Discard giant background floaters
    vec3 rawS = instanceScale * uSplatScale;
    if (max(rawS.x, max(rawS.y, rawS.z)) > uMaxSplatSize) {
      vDiscard = 1.0;
      gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
      return;
    }

    // Test 3D Bounding Crop
    if (uCropEnabled) {
      if (instancePosition.x < uCropMin.x || instancePosition.x > uCropMax.x ||
          instancePosition.y < uCropMin.y || instancePosition.y > uCropMax.y ||
          instancePosition.z < uCropMin.z || instancePosition.z > uCropMax.z ||
          instancePosition.y < uFloorClipY) {
        vDiscard = 1.0;
        gl_Position = vec4(0.0, 0.0, 2.0, 1.0); // push outside NDC
        return;
      }
    }

    vec4 camPos = modelViewMatrix * vec4(instancePosition, 1.0);
    if (camPos.z >= -0.1) {
      // Behind camera
      vDiscard = 1.0;
      gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
      return;
    }

    vDepth = -camPos.z;
    vColor = instanceColor;
    vOpacity = instanceOpacity;
    vUv = position.xy; // quad corner from -2.0 to 2.0

    if (uRenderMode == 1) {
      // Point Cloud Mode: small fixed screen points
      vec4 projPos = projectionMatrix * camPos;
      vec2 offset = position.xy * 0.004 * projPos.w;
      projPos.xy += offset;
      gl_Position = projPos;
      return;
    }

    // 1. Compute 3D Covariance Matrix: Sigma = R * S * S^T * R^T
    mat3 R = quatToMat3(instanceRotation);
    vec3 s = rawS;
    mat3 S = mat3(
      s.x, 0.0, 0.0,
      0.0, s.y, 0.0,
      0.0, 0.0, s.z
    );
    mat3 M = R * S;
    mat3 Sigma3D = M * transpose(M);

    // 2. Transform Sigma3D by camera rotation (view matrix upper 3x3)
    mat3 W = mat3(viewMatrix);
    mat3 SigmaCam = W * Sigma3D * transpose(W);

    // 3. Approximate screen-space 2D covariance using Jacobian of perspective projection
    float tz = camPos.z;
    float tz2 = tz * tz;
    float fx = uFocalLength;
    float fy = uFocalLength;

    mat3 J = mat3(
      fx / tz, 0.0, -(fx * camPos.x) / tz2,
      0.0, fy / tz, -(fy * camPos.y) / tz2,
      0.0, 0.0, 0.0
    );

    mat3 covCam2D = J * SigmaCam * transpose(J);

    // 2x2 screen covariance elements
    float a = covCam2D[0][0] + 0.3; // low-pass filter filter 0.3 px to avoid aliasing
    float b = covCam2D[0][1];
    float c = covCam2D[1][1] + 0.3;

    // Eigenvalues of 2x2 symmetric matrix: lambda = 0.5 * ((a + c) +/- sqrt((a - c)^2 + 4 * b^2))
    float tr = a + c;
    float det_diff = a - c;
    float disc = sqrt(max(0.0001, det_diff * det_diff + 4.0 * b * b));
    float lambda1 = max(0.1, 0.5 * (tr + disc));
    float lambda2 = max(0.1, 0.5 * (tr - disc));

    // Cap radii to reasonable screen limits (avoid massive fill-rate stall)
    float r1 = min(64.0, 3.0 * sqrt(lambda1));
    float r2 = min(64.0, 3.0 * sqrt(lambda2));

    // Eigenvector direction angle
    float angle = 0.5 * atan(2.0 * b, a - c);
    float cosA = cos(angle);
    float sinA = sin(angle);

    // Transform quad vertex by rotated and scaled 2D ellipse axes
    vec2 localOffset = position.xy; // [-1.5, 1.5]
    vec2 screenOffset = vec2(
      (localOffset.x * r1 * cosA - localOffset.y * r2 * sinA),
      (localOffset.x * r1 * sinA + localOffset.y * r2 * cosA)
    );

    // Convert screen offset (in pixels) to NDC offset
    vec4 projPos = projectionMatrix * camPos;
    vec2 ndcOffset = (screenOffset / uViewportSize) * 2.0 * projPos.w;
    projPos.xy += ndcOffset;

    gl_Position = projPos;
  }
`;

export const splatFragmentShader = /* glsl */ `
  precision highp float;

  uniform int uRenderMode; // 0: radiance, 1: pointcloud, 2: ellipsoids, 3: depth, 4: density
  uniform float uOpacityMultiplier;

  varying vec2 vUv;
  varying vec3 vColor;
  varying float vOpacity;
  varying float vDepth;
  varying vec3 vWorldPos;
  varying float vDiscard;

  // Heatmap palette for Depth / Density modes
  vec3 turboColormap(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c = vec3(
      0.1357 + t * ( 4.5874 + t * (-42.308 + t * ( 130.45 - t * 110.54))),
      0.0914 + t * (-0.0083 + t * (  7.7686 + t * (-18.847 + t *  11.536))),
      0.1067 + t * (12.5925 + t * (-60.186 + t * ( 109.07 - t *  64.07)))
    );
    return clamp(c, 0.0, 1.0);
  }

  void main() {
    if (vDiscard > 0.5) {
      discard;
    }

    float r2 = dot(vUv, vUv);

    if (uRenderMode == 1) {
      // Point cloud mode: circular dot
      if (r2 > 1.0) discard;
      gl_FragColor = vec4(vColor, 1.0);
      return;
    }

    // Standard 3D Gaussian falloff: exp(-0.5 * r^2)
    // Quad UV ranges from -2.0 to 2.0 (representing standard deviations)
    if (r2 > 4.0) {
      discard; // Beyond 2-3 standard deviations, contribute 0
    }

    float gaussianPower = exp(-0.5 * r2);
    float alpha = gaussianPower * vOpacity * uOpacityMultiplier;

    if (alpha < 0.02) {
      discard;
    }

    if (uRenderMode == 2) {
      // Ellipsoids / Wireframe Rings mode: render outer contour ring and central needle
      float ring = abs(sqrt(r2) - 1.0);
      float isRing = smoothstep(0.12, 0.02, ring);
      float isCenter = smoothstep(0.15, 0.0, abs(vUv.y)) * smoothstep(1.2, 0.0, abs(vUv.x));
      vec3 debugColor = mix(vColor * 0.4, vec3(1.0, 0.9, 0.3), max(isRing, isCenter * 0.7));
      gl_FragColor = vec4(debugColor, max(alpha * 0.9, isRing * 0.85));
      return;
    }

    if (uRenderMode == 3) {
      // Depth buffer false color
      float normDepth = clamp((vDepth - 0.5) / 12.0, 0.0, 1.0);
      vec3 depthColor = turboColormap(normDepth);
      gl_FragColor = vec4(depthColor, alpha);
      return;
    }

    if (uRenderMode == 4) {
      // Density heatmap
      vec3 densityColor = turboColormap(clamp(vOpacity * 1.5, 0.0, 1.0));
      gl_FragColor = vec4(densityColor, alpha);
      return;
    }

    // Radiance Field (Mode 0): Clean, vivid Gaussian Splatting
    gl_FragColor = vec4(vColor, alpha);
  }
`;
