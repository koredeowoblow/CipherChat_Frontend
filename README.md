<div align="center">
  <h1>CipherChat Frontend</h1>
  <p>The secure, high-performance React client for the CipherChat E2EE messaging platform.</p>

  <p>
    <a href="https://reactjs.org/"><img src="https://img.shields.io/badge/React-18.0+-61DAFB?logo=react&logoColor=black" alt="React version" /></a>
    <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-5.0+-646CFF?logo=vite&logoColor=white" alt="Vite version" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /></a>
    <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS-3.0+-38B2AC?logo=tailwind-css&logoColor=white" alt="Tailwind CSS" /></a>
    <a href="https://github.com/pmndrs/zustand"><img src="https://img.shields.io/badge/Zustand-State_Management-orange" alt="Zustand" /></a>
  </p>
</div>

---

## Table of Contents

- [About](#about)
- [Key Features](#key-features)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Architecture & Security](#architecture--security)
- [Contributing](#contributing)

---

## About

The CipherChat frontend is a Single Page Application (SPA) engineered for maximum security and performance. It handles the entirety of the cryptographic lifecycle—from Elliptic Curve key generation to AES-GCM message encryption—directly within the browser memory, ensuring that no plaintext data ever touches the network.

## Key Features

- **Client-Side E2E Encryption:** Utilizes the native Web Crypto API (`window.crypto.subtle`) for blazingly fast, zero-dependency cryptography.
- **Real-Time WebSocket Sync:** A robust, custom WebSocket hook with exponential backoff and connection state management.
- **Optimized State Management:** Powered by Zustand for O(1) message lookups and minimized React re-renders during high-frequency WebSocket events (e.g., typing indicators).
- **Responsive Design System:** A meticulously crafted, solid-surface UI utilizing Tailwind CSS, designed for accessibility and readability across all device sizes.

## Prerequisites

Ensure you have the following installed before proceeding:
- [Node.js](https://nodejs.org/en/) (v16.14.0 or higher)
- [npm](https://www.npmjs.com/) (v8.0.0 or higher) or [yarn](https://yarnpkg.com/)
- The CipherChat backend server running locally.

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure your environment:**
   Copy the example environment file and adjust it to your local setup.
   ```bash
   cp .env.example .env
   ```
   *(See [Environment Configuration](#environment-configuration) for details)*

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:5173`.

## Environment Configuration

Create a `.env` file in the root of the `frontend` directory with the following variables:

| Variable | Description | Default Value |
| :--- | :--- | :--- |
| `VITE_API_URL` | The base URL for the backend REST API | `http://localhost:3000/api` |
| `VITE_WS_URL` | The endpoint for the WebSocket server | `ws://localhost:3000` |

## Available Scripts

In the project directory, you can run:

- `npm run dev`: Starts the Vite development server with Hot Module Replacement (HMR).
- `npm run build`: Compiles TypeScript and builds the app for production to the `dist` folder.
- `npm run preview`: Bootstraps a local web server to serve the production build from `dist`.
- `npm run lint`: Runs ESLint to statically analyze the code for errors and formatting issues.

## Project Structure

```text
frontend/
├── src/
│   ├── components/      # Reusable, stateless UI components
│   ├── hooks/           # Custom React hooks (e.g., useWebSocket)
│   ├── pages/           # High-level route components (Login, Register, Chat)
│   ├── services/        # External integrations (Axios API client, Web Crypto engine)
│   ├── store/           # Zustand global state slices
│   ├── utils/           # Helper functions and formatters
│   ├── App.tsx          # Root application component and router configuration
│   └── index.css        # Global CSS, Tailwind directives, and CSS variables
├── index.html           # HTML entry point
├── tailwind.config.js   # Tailwind design tokens and theme configuration
├── tsconfig.json        # TypeScript compiler options
└── vite.config.ts       # Vite bundler configuration
```

## Architecture & Security

### Cryptographic Pipeline
1. **Key Generation:** On registration, an ECDH P-256 key pair is generated.
2. **Vaulting:** The private key is symmetrically encrypted (AES-GCM) using a key derived from the user's password via PBKDF2 (100,000 iterations). Only this encrypted blob is stored in the browser's `localStorage` and synced with the backend.
3. **Key Exchange:** When initiating a chat, a shared secret is computed using the user's private key and the recipient's public key.
4. **Message Cipher:** All outgoing messages are encrypted using this shared secret via AES-GCM with a securely generated 12-byte IV.

### Rendering Optimization
To prevent UI stutter during rapid WebSocket events, the application utilizes a `useRef`-based subscription model. Incoming messages alert registered listeners without triggering a global state update, confining DOM reconciliations strictly to the components that require them.

## Contributing

We welcome contributions to CipherChat! Please ensure you follow standard React best practices and maintain the strict decoupling of cryptographic logic from UI components. Ensure `npm run lint` and `npm run build` pass before submitting a Pull Request.
