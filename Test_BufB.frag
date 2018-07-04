
#version 150

#define SAMPLER0 sampler2D // sampler2D, sampler3D, samplerCube
#define SAMPLER1 sampler2D // sampler2D, sampler3D, samplerCube
#define SAMPLER2 sampler2D // sampler2D, sampler3D, samplerCube
#define SAMPLER3 sampler2D // sampler2D, sampler3D, samplerCube

uniform SAMPLER0 iChannel0; // image/buffer/sound    Sampler for input textures 0
uniform SAMPLER1 iChannel1; // image/buffer/sound    Sampler for input textures 1
uniform SAMPLER2 iChannel2; // image/buffer/sound    Sampler for input textures 2
uniform SAMPLER3 iChannel3; // image/buffer/sound    Sampler for input textures 3

uniform vec3  iResolution;           // image/buffer          The viewport resolution (z is pixel aspect ratio, usually 1.0)
uniform float iTime;                 // image/sound/buffer    Current time in seconds
uniform float iTimeDelta;            // image/buffer          Time it takes to render a frame, in seconds
uniform int   iFrame;                // image/buffer          Current frame
uniform float iFrameRate;            // image/buffer          Number of frames rendered per second
uniform vec4  iMouse;                // image/buffer          xy = current pixel coords (if LMB is down). zw = click pixel
uniform vec4  iDate;                 // image/buffer/sound    Year, month, day, time in seconds in .xyzw
uniform float iSampleRate;           // image/buffer/sound    The sound sample rate (typically 44100)
uniform float iChannelTime[4];       // image/buffer          Time for channel (if video or sound), in seconds
uniform vec3  iChannelResolution[4]; // image/buffer/sound    Input texture resolution for each channel



// Riffing off tomkh's wave equation solver
// https://www.shadertoy.com/view/Xsd3DB
// article: http://freespace.virgin.net/hugo.elias/graphics/x_water.htm
// 1-buffer version: https://www.shadertoy.com/view/4dK3Ww
// 1-buffer with half res sim to maintain wave speed: https://www.shadertoy.com/view/4dK3Ww

#define HEIGHTMAPSCALE 90.0

vec3 computePixelRay( in vec2 p, out vec3 cameraPos );

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec3 e = vec3(vec2(1.)/iResolution.xy,0.);
    vec2 q = fragCoord.xy/iResolution.xy;
    
    vec4 c = textureLod(iChannel0, q, 0.);
    
    float p11 = c.x;
    
    float p10 = textureLod(iChannel1, q-e.zy, 0.).x;
    float p01 = textureLod(iChannel1, q-e.xz, 0.).x;
    float p21 = textureLod(iChannel1, q+e.xz, 0.).x;
    float p12 = textureLod(iChannel1, q+e.zy, 0.).x;
    
    float d = 0.;
    
    if( iMouse.z > 0. )
    {
        vec3 ro;
        vec3 rd = computePixelRay( 2.*iMouse.xy/iResolution.xy - 1., ro );
        if( rd.y < 0. )
        {
            vec3 mp = ro + rd * ro.y/-rd.y;
            vec2 uv = mp.xz/HEIGHTMAPSCALE + 0.5;
            float screenscale = iResolution.x/640.;
            d += .02*smoothstep(20.*screenscale,5.*screenscale,length(uv*iResolution.xy - fragCoord.xy));
            //d += iChannel2;
        }
    }
    
    // The actual propagation:
    d += -(p11-.5)*2. + (p10 + p01 + p21 + p12 - 2.);
    d *= .99; // damping
    d *= step(.1, iTime); // hacky way of clearing the buffer
    d = d*.5 + .5;
    
    fragColor = vec4(d, 0, 0, 0);
}

vec3 computePixelRay( in vec2 p, out vec3 cameraPos )
{
    // camera orbits around origin
    
    float camRadius = 60.;
    float theta = -3.141592653/2.;
    float xoff = camRadius * cos(theta);
    float zoff = camRadius * sin(theta);
    cameraPos = vec3(xoff,20.,zoff);
    
    // camera target
    vec3 target = vec3(0.,0.,0.);
    
    // camera frame
    vec3 fo = normalize(target-cameraPos);
    vec3 ri = normalize(vec3(fo.z, 0., -fo.x ));
    vec3 up = normalize(cross(fo,ri));
    
    // multiplier to emulate a fov control
    float fov = .5;
    
    // ray direction
    vec3 rayDir = normalize(fo + fov*p.x*ri + fov*p.y*up);
    
    return rayDir;
}










