# JORATA — MINIMAL PREMIUM REDESIGN HANDOFF
## Antigravity Product Design & Frontend Architecture

### Core Status: Production-Ready, Verified & Elevated
JORATA has been fundamentally elevated from an overly decorated gaming dashboard into an exceptionally clean, minimal, premium communication product inspired by **Lumineth** (visual sophistication, typography, calm neutral charcoal surfaces, restrained accents) and **Telegram** (fast navigation, high-density conversation list, effortless message composer, intuitive mobile ergonomics).

---

### 1. Design Direction: "Less UI. Better UX. More Purpose."
- **Removed Visual Clutter:** Eliminated aggressive neon borders, random glows, bloated cards, and distracting dashboard decoration.
- **Deep Neutral Palette (Lumineth):**
  - Base canvas: `#0c0e0d`
  - Navigation rail: `#080a09`
  - Conversation sidebar: `#0e1110`
  - Active conversation & surfaces: `#121614`
  - Received message bubble: `#151917` (subtle border: `rgba(255, 255, 255, 0.05)`)
  - Sent message bubble: `#182a20` (subtle emerald tint: `rgba(62, 207, 142, 0.16)`)
  - Accent: `#3ecf8e` (calm emerald, used sparingly for status, active indicators, and primary actions)
  - Text hierarchy: `#f1f3f2` (primary), `#95a19b` (secondary), `#58655e` (tertiary/timestamps)
- **Restrained Motion:** Concise, purposeful transitions (120–180ms), disabled during active drag/swipe tracking for 60fps responsiveness, with full `prefers-reduced-motion` compliance.

---

### 2. Three-Region Layout Hierarchy
1. **Left — Minimal Navigation Rail (58px):**
   - Understated vertical dock with crisp 1.8px stroke vector SVGs (`src/social/Icons.tsx`):
     - `Chats` (Messages)
     - `Groups` (Community spaces)
     - `Tasks` (Shared coordination)
     - `Moments` (Camera & photo sharing)
     - `Meadow` (Optional multiplayer world)
   - Profile avatar trigger anchored at the bottom.
2. **Center — Telegram-Inspired Conversation List:**
   - Search pill with live query filtering.
   - Clean "+ New chat" action button.
   - Channel rows (`# general`), group chat rows, and DM rows with user avatars and live green presence indicators.
   - Unread badges, single-line preview snippets, and formatted timestamps.
   - Bottom entry for the optional Meadow world.
3. **Right — Focused Active Chat:**
   - Header: Contact avatar, online presence dot, room title, subtitle, and ghost action pills (`Tasks`, `Members`, `Summarize`).
   - Timeline: Clean bubbles with subtle timestamps, reactions row, reply quote previews, and inline attachments.
   - Composer: Lightweight Telegram-grade input with camera attachment button, auto-expanding textarea, Enter-to-send, and Send pill.
   - Drag & Drop: Subtle drop overlay when dragging photos directly into conversations.
   - Touch Gestures: Damped swipe-to-reply gesture with instant visual feedback and smooth reset.

---

### 3. Secondary & Optional Experiences
- **Shared Tasks:** Contextual side drawer (`.social-detail-panel`) for task assignment, due dates, and completion checkboxes without cluttering the chat timeline.
- **Moments & Photo Studio:** Modal with camera capture, real-time filters, decorative frames, and captions.
- **Meadow Sandbox (`/world`):** Integrated into the right workspace stage with an elegant floating glass dock, zero collision with the "← Back to messages" button, and unobtrusive controls.
- **Mobile Design (Telegram Mobile Benchmark):** Below 768px, transitions seamlessly between full-width conversation list and full-screen active chat with a 52px bottom navigation rail and 44px touch targets.

---

### 4. Code & Interface Map
- `src/social/Icons.tsx`: Custom minimal vector SVG icon set.
- `src/social/SocialApp.tsx`: Primary messaging workspace, rail, room list, chat header, composer, drag/swipe handlers.
- `src/social/social.css`: Lumineth design system stylesheet, CSS variables, typography, and responsive media queries.
- `src/social/TaskBoard.tsx`: Shared task list and assignment panel.
- `src/social/PhotoEditor.tsx`: Photo capture and moment creation modal.
- `src/social/AuthPanel.tsx`: Authentication and profile customization screens.
- `src/guest/GuestWorld.tsx` & `src/social/SocialWorld.tsx`: Meadow world integration with floating dock.
- `src/components/ChatPanel.tsx` & `src/App.tsx`: Legacy mode compatibility layer.

---

### 5. Verification & Test Suite
- `npm test`: **14/14 passed (100%)**
- `npm run build`: **Clean build with zero TypeScript errors**
- `test:guest:browser`: **All 18 user journeys and interactions verified (0 errors)**:
  - Direct entry
  - Distinct guest identities
  - Live lobby and direct messages
  - Typing indicators
  - Reactions (`👍`, `❤️`, `😂`, `🎉`, `👀`, `👋`)
  - Reply threads and quoted messages
  - Message editing & deletion
  - Refresh history persistence
  - Shared tasks and assignment
  - Groups and invites
  - Community join and channel creation
  - Simulated camera device permissions and capture
  - Photo filters, frame backgrounds, captions, and stickers
  - Encrypted image delivery
  - Two-player Meadow world, movement, emote and speech bubble delivery
  - Conversation search
  - Identity creation & switching
  - Telegram-grade mobile navigation
