# InfinityBoard

Built for the Hack Club YSWS Alchemize challenge.

I wanted to see if I could build a Figma/Miro style infinite whiteboard completely from scratch without using any external libraries. No React, no canvas frameworks—just raw HTML5 Canvas, Vanilla JS, and a lot of math. 

### What I got working:

* **Infinite panning and zooming:** This was honestly the hardest part. I had to build a custom camera system to separate screen coordinates from world coordinates so things scale properly when you zoom.
* **Auto-Shape "Smart Pen":** I wrote a script that tracks your mouse path. If you draw a messy circle or box, it calculates the path length and bounding box ratio, deletes your ink, and replaces it with a perfect vector shape.
* **AI Text UI:** I built a frosted-glass menu that physically tracks text boxes on the canvas. It has buttons for AI actions (Summarize, Make Pro, etc.). Right now it just runs a `setTimeout` to simulate an API delay, but the architecture is ready to plug into an LLM.
* **Multi-page memory:** You can add new pages and flip through them. It saves the entire array of objects and the undo/redo stacks for every single page.
* **Smart Exporting:** Wrote a function that loops through every object to find the absolute edges of your drawing, then crops and exports a clean PNG.
* **Custom boards:** Dot grid, blueprint, dark mode, or you can upload your own image as the background.

### Tech Stack
Just `index.html`, `style.css`, and `app.js`. Zero dependencies.

### How to run it
Just clone the repo and double-click `index.html` to open it in your browser. No build steps or `npm install` needed.

### What I learned
Canvas performance is really annoying to manage. I originally had massive lag when drawing because the mouse was firing hundreds of events per second. I had to write a "point decimation" filter that only saves a coordinate if the mouse actually moves more than 2 pixels. Also, writing pure math for hit-detection (clicking on shapes to select them) is brutal but taught me a lot about how real design engines work.

Pretty proud of how this turned out!
