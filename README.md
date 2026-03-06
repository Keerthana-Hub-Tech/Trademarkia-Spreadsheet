# Trademarkia Sheets Pro 📊
A lightweight, real-time collaborative spreadsheet built for the Trademarkia Frontend Engineering Challenge.

## 🚀 Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS
- **Backend/Auth**: Firebase (Firestore & Google Auth)
- **Deployment**: Vercel

## ✨ Features
- **Real-time Sync**: Bi-directional data synchronization using Firestore `onSnapshot`.
- **Advanced Presence**: Live avatar stack and remote cursors showing collaborator focus in real-time.
- **Formula Engine**: Support for cell references and range functions (e.g., `=SUM(A1:B5)`).
- **Bonus Implementation**: 
  - Keyboard Navigation (Arrows, Enter, Tab).
  - Cell Formatting (Bold, Italic, Color).
  - Spreadsheet Export (CSV).
  - Column Resizing.

## 🛠 Architecture Decisions
- **State Management**: Local state is managed via React `useState`, while global collaborative state is persisted in Firestore. 
- **Conflict Handling**: Used Firestore's atomic field updates to prevent "last-write-wins" issues on metadata while maintaining a flat document structure for cell data to minimize nested object contention.
- **Presence Logic**: Implemented a unique UID filtering system to handle "ghost" sessions caused by improper socket disconnects, ensuring the active user count remains accurate.

## 📦 Local Setup
1. `npm install`
2. Configure `.env.local` with Firebase credentials.
3. `npm run dev`
