# ♾️ InfinityBoard AI

A high-performance, infinite-canvas whiteboard built entirely from scratch using pure JavaScript, HTML5 Canvas, and complex vector math. InfinityBoard features AI-assisted tools, a cinematic presentation engine, and mathematically precise vector object rendering.

Built for the Hack Club YSWS Alchemize challenge! 🚀

## ✨ Features

* **The Infinite Camera:** Separated screen coordinates from world coordinates for perfectly crisp, boundless panning and zooming.
* **Smart Pen (Shape AI):** Pure JavaScript geometry that calculates path distances, bounding boxes, and ratios to automatically snap messy ink into perfect vector shapes.
* **Simulated Text AI:** A floating, world-to-screen mapped UI ready to connect to a real AI language model (features loading states and action menus).
* **True Vector Engine:** A mathematically driven object system allowing you to select, drag, and modify shapes dynamically without pixel degradation.
* **4K Export Engine:** A bounding-box algorithm that perfectly crops and renders high-resolution snapshots of your current board.
* **Multi-Page Memory System:** A state manager capable of packing and unpacking complex arrays for a multi-page presentation experience.
* **Custom Backgrounds:** Dynamic environments including dark modes, blueprints, grids, and custom image handling.

## 🛠️ Tech Stack

* **HTML5 Canvas:** For high-DPI rendering and high-performance visual output.
* **Vanilla JavaScript:** Zero external libraries. All state management, DOM manipulation, and vector math is written from scratch.
* **CSS3:** Featuring frosted-glass (backdrop-filter) UI components and absolute positioning mapped to canvas world coordinates.

## 🚀 How to Run Locally

Because this project relies entirely on client-side technologies with zero build steps, running it is instantaneous.

1. Clone this repository:
   ```bash
   git clone [https://github.com/zainabbasraza0-del/InfinityBoard.git](https://github.com/zainabbasraza0-del/InfinityBoard.git)
   (Note: The AI Text features currently simulate an API delay to demonstrate the UI architecture.)
