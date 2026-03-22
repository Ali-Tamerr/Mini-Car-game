# 🏎️ Mini 3D Car Racing

[![Deploy to GitHub Pages](https://github.com/OWNER/REPOSITORY/actions/workflows/deploy.yml/badge.svg)](https://github.com/OWNER/REPOSITORY/actions/workflows/deploy.yml)

A high-performance, single-player 3D racing prototype built with **Next.js**, **React Three Fiber**, and **Rapier Physics**. Drive through a figure-eight track, beat your best lap times, and customize your race settings.

## ✨ Features

- **Real-time 3D Graphics**: Powered by Three.js and React Three Fiber.
- **Physics-Engine**: Realistic car handling and collisions using `@react-three/rapier`.
- **Lap System**: Automatic lap detection with finish line crossing and best lap tracking.
- **Race Customization**: Select your target lap count and adjust camera zoom on the fly.
- **Asset Support**: Easy swap for custom `.glb` or `.fbx` car models.
- **Static Export**: Optimized for GitHub Pages with automatic deployment via GitHub Actions.

## 🚀 Tech Stack

- **Framework**: [Next.js 15+](https://nextjs.org) (App Router)
- **3D Engine**: [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) & [Drei](https://github.com/pmndrs/drei)
- **Physics**: [Rapier](https://rapier.rs/) via `@react-three/rapier`
- **Styling**: [Tailwind CSS](https://tailwindcss.com)
- **Deployment**: GitHub Actions & Pages

## 🕹️ Controls

- **W / Up**: Accelerate
- **S / Down**: Brake / Reverse
- **A / Left**: Steer Left
- **D / Right**: Steer Right
- **R**: Reset car position
- **Mouse**: UI interactions and camera zoom slider

## 📦 Deployment

### Automated Deployment (Recommended)

This project is pre-configured for **GitHub Actions**. Every push to the `main` branch will automatically trigger a build and deploy to GitHub Pages.

1. Go to your repo **Settings** -> **Pages**.
2. Under **Build and deployment** -> **Source**, select **GitHub Actions**.

---
*Built with ❤️ for the 3D Web community.*

