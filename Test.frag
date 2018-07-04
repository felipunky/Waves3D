
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



// riffing off tomkh's wave equation solver: https://www.shadertoy.com/view/Xsd3DB

// i spent some time experimenting with different ways to speed up the raymarch.
// at one point i even slowed down the ray march steps around the mouse, as this was
// where the sharpest/highest peaks tend to be, which kind of worked but was complicated.
// in the end the best i could do was to boost the step size by 20% and after
// iterating, shade the point whether it converged or not, which gives plausible
// results. some intersections will be missed completely, for the current settings
// its not super noticeable. to fix divergence at steep surfaces facing
// the viewer, i used the hybrid sphere march from https://www.shadertoy.com/view/Mdj3W3
// which, at surface crossings, uses a first order interpolation to estimate the
// intersection point.

// i think the best and most robust way to speed up the raymarch would be to downsample
// the height texture, where each downsample computes the max of an e.g. 4x4 neighborhood,
// and then raymarch against this instead, using the full resolution texture to compute
// exact intersections.

#define RAYMARCH
#define HEIGHTMAPSCALE 90.
#define MARCHSTEPS 25


vec3 computePixelRay( in vec2 p, out vec3 cameraPos );

float h( vec3 p ) { return 2.*textureLod(iChannel0, p.xz/HEIGHTMAPSCALE + 0.5, 0. ).x; }
float DE( vec3 p ) { return 1.2*( p.y - h(p) ); }

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 q = fragCoord.xy/iResolution.xy;
    vec2 qq = q*2.-1.;
    float eps = 0.1;
    
#ifdef RAYMARCH
    
    vec3 L = normalize(vec3(.3,.5,1.));
    
    // raymarch the milk surface
    vec3 ro;
    vec3 rd = computePixelRay( qq, ro );
    float t = 0.;
    float d = DE(ro+t*rd);
    
    for( int i = 0; i < MARCHSTEPS; i++ )
    {
        if( abs(d) < eps )
            break;
        
        float dNext = DE(ro+(t+d)*rd);
        
        // detect surface crossing
        // https://www.shadertoy.com/view/Mdj3W3
        float dNext_over_d = dNext/d;
        if( dNext_over_d < 0.0 )
        {
            // estimate position of crossing
            d /= 1.0 - dNext_over_d;
            dNext = DE( ro+rd*(t+d) );
        }
        
        t += d;
        d = dNext;
    }
    
    float znear = 95.;
    float zfar  = 130.;
    
    // hit the milk
    if( t < zfar )
        //if( d < eps ) // just assume always hit, turns out its hard to see error from this
    {
        vec3 p = ro+t*rd;
        
        fragColor = vec4( textureLod(iChannel0, p.xz/HEIGHTMAPSCALE+0.5, 0. ).x );
        
        // finite difference normal
        float h0 = h(p);
        vec2 dd = vec2(0.01,0.);
        vec3 n = normalize(vec3( h0-h(p + dd.xyy), dd.x, h0-h(p + dd.yyx) ));
        
        // improvised milk shader, apologies for hacks!
        vec3 R = reflect( rd, n );
        float s = .4*pow( clamp( dot( L, R ), 0., 1. ), 4000. );
        float ndotL = clamp(dot(n,L),0.,1.);
        float dif = 1.42*(0.8+0.2*ndotL);
        // occlude valleys a little and boost peaks which gives a bit of an SSS look
        float ao = mix( 0.8, .99, smoothstep(0.,1.,(h0+1.5)/6.));
        // milk it up
        vec3 difCol = vec3(0.82,0.82,1.79);
        difCol *= 1.0 * sin( h0 + 2.0 );
        difCol += 1.0 * vec3( 1.0, 0.5, 0.1 );
        fragColor.xyz = difCol*(dif)*ao + vec3(1.,.79,0.74)*s;
        // for bonus points, emulate an anisotropic phase function by creaming up the region
        // between lit and unlit
        float creamAmt = smoothstep( 0.2, 0., abs(ndotL - 0.2) );
        fragColor.xyz *= mix( vec3(1.), vec3(1.,0.985,0.975), creamAmt );
    }
    
    // fade to background
    vec3 bg = vec3(0.5) + 0.5*pow(clamp(dot(L,rd),0.,1.),20.);
    bg *= vec2(1.,0.97).yxx;
    fragColor.xyz = mix( fragColor.xyz, bg, smoothstep(znear,zfar,t) );
    
    // vignette (borrowed from donfabio's Blue Spiral)
    vec2 uv =  q.xy-0.5;
    float distSqr = dot(uv, uv);
    fragColor.xyz *= 1.0 - .5*distSqr;
    
#else
    float sh = 1. - texture(iChannel0, q).x;
    vec3 c =
    vec3(exp(pow(sh-.25,2.)*-5.),
         exp(pow(sh-.4,2.)*-5.),
         exp(pow(sh-.7,2.)*-20.));
    fragColor = vec4(c,1.);
#endif
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













