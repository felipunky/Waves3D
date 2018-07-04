/**
 * 
 * PixelFlow | Copyright (C) 2017 Thomas Diewald - www.thomasdiewald.com
 * 
 * https://github.com/diwi/PixelFlow.git
 * 
 * A Processing/Java library for high performance GPU-Computing.
 * MIT License: https://opensource.org/licenses/MIT
 * 
 */


// PIXELFLOW'S
import com.thomasdiewald.pixelflow.java.DwPixelFlow;
import com.thomasdiewald.pixelflow.java.imageprocessing.DwShadertoy;

// FACE RECOGNITION 
import processing.video.*; 
import gab.opencv.*;
import java.awt.Rectangle;

// MICROPHONE
import ddf.minim.*;
  
DwPixelFlow context;
DwShadertoy toy, toyA, toyB;

// Import OpenCV and create a camera object
Capture cam; 
OpenCV opencv;

// Import Minim and create the object
Minim minim;
AudioInput in;

// Initialize the face recognition center
float xPos = 0.0;
float yPos = 0.0;
  
// Initialize the microphone's fft's
float wav = 0.0;
float fre = 0.0;  
  
public void settings() {
  size(800, 450, P2D);
  smooth(0);
}

public void setup() {
  
  // Create the camera object
  cam = new Capture(this, width, height, 30); 
  opencv = new OpenCV(this, width, height); 
  opencv.loadCascade(OpenCV.CASCADE_FRONTALFACE);
  cam.start();
  
  // Create minim's object
  minim = new Minim(this);
  
  // use the getLineIn method of the Minim object to get an AudioInput
  in = minim.getLineIn();
  
  surface.setResizable(true);
  
  context = new DwPixelFlow(this);
  context.print();
  context.printGL();
  
  toyB = new DwShadertoy(context, "Test_BufB.frag");
  toyA = new DwShadertoy(context, "Test_BufA.frag");
  toy  = new DwShadertoy(context, "Test.frag");
  
  frameRate(1000);
}


public void draw() {
  
  if (cam.available() == true)
  {

    cam.read();
  }

  pushMatrix(); 
  scale(-1, 1); 
  translate(-cam.width, 0);
  //image(cam, 0, 0); 
  popMatrix();

  opencv.loadImage(cam); 
  Rectangle[] faces = opencv.detect();

  float x = 0.0;
  float y = 0.0;
  
  // Traverse the camera input for the face recognition
  for (int i = 0; i < faces.length; i++) 
  {

    x = ( cam.width - faces[i].x - faces[i].width );
    y = faces[i].y;
    xPos = x + ( faces[i].width / 2.0 );
    yPos = y + ( faces[i].height / 2.0 );

  }
  
  ellipse( xPos, yPos, 2.0, 2.0 );
  
  // Traverse the mic data to get the fft's
  for(int i = 0; i < in.bufferSize() - 1; i++)
  {
  
    fre = ( in.left.get(i) ) * 500.0;
    wav = ( in.right.get(i) ) * 500.0;
  
  }

  /*
  if(mousePressed){
    toyA.set_iMouse(mouseX, height-1-mouseY, mouseX, height-1-mouseY);
    toyB.set_iMouse(mouseX, height-1-mouseY, mouseX, height-1-mouseY);
  }
  */
  
  toyB.set_iChannel(0, toyB);
  toyB.set_iChannel(1, toyA);
  toyB.set_iChannel(2, int(fre));
  toyB.set_iMouse(xPos, height-yPos, 1, 1);
  toyB.apply(width, height);
  
  toyA.set_iChannel(0, toyA);
  toyA.set_iChannel(1, toyB);
  toyA.set_iChannel(2, int(fre));
  toyA.set_iMouse(xPos, height-yPos, 1, 1);
  toyA.apply(width, height);
  
  toy.set_iChannel(0, toyA);
  toy.apply(this.g);

  String txt_fps = String.format(getClass().getSimpleName()+ "   [size %d/%d]   [frame %d]   [fps %6.2f]", width, height, frameCount, frameRate);
  surface.setTitle(txt_fps);
}
