---
title: "Building This Portfolio Site"
description: "A quick overview of how I built this portfolio using Astro, Svelte, and WebGL for interactive 3D effects."
pubDate: 2025-12-01
draft: true
---

## Why I Built This

I needed a portfolio that showed both my technical skills and my photography work. Most portfolio templates felt too generic, so I decided to build something custom that reflected my style.

## The Tech Stack

I went with **Astro** as the main framework because it's fast and lets me use Svelte components where I need interactivity. The site is mostly static HTML/CSS, which keeps it lightweight.

For the interactive parts:
- **Svelte** powers the photo gallery and lightbox
- **WebGL** handles the 3D depth effect on my profile photo
- **tsParticles** creates the animated background

## The Biggest Challenge

Getting the WebGL depth mapping to work correctly took the most time. I wanted the profile photo to have a subtle 3D parallax effect when you move your mouse over it.

The trick was using a grayscale depth map to determine how much each pixel should shift. Lighter areas move more, darker areas stay put. It creates this cool "looking around" effect.

## What I Learned

Building this taught me a lot about optimizing web performance. I learned about:
- Using `.avif` images for better compression
- Preloading critical assets to prevent layout shift
- Writing custom WebGL shaders (which was intimidating at first!)

## What's Next

I want to add more projects to the portfolio section and maybe experiment with some scroll-based animations. I'm also thinking about adding a photography blog to document my favorite shots.

If you're building your own portfolio, my advice is: just start. You can always improve it later. Done is better than perfect.
