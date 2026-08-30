# Sinigang Online — 2 to 8 Players

Real-time online multiplayer version of the supplied Sinigang game specification.

## Features
- 2–8 players in one room
- Create/join with a 5-character room code
- Real-time multiplayer via Socket.IO
- Private hidden hands
- Shared pot and family cards
- Any player can call KAKAIN NA!
- Server-authoritative scoring and Kanin victory points
- Connection indicators
- Mobile responsive interface
- Copy room-code button

## Local test
Install Node.js 18+.

    npm install
    npm start

Open http://localhost:3000. Open it in multiple browser windows/devices to test multiplayer.

## Deploy online
Use a Node.js Web Service host that supports WebSockets. Render supports WebSockets and Node/Express web services. Set:

Build Command: `npm install`
Start Command: `npm start`

After deployment, share the public HTTPS URL with your friends.

## Rule note
The supplied specification explicitly states Tatay prefers Baboy. It does not specify preferences for Nanay, Ate, Kuya, Lola, or the Atrimitidang Kapitbahay, so this build does not invent those preferences.


## Private-card security

The server uses `publicState(room, socketId)` and sets `myHand` from the player matching that socket ID. It never includes other players' `hand` values in the state sent to a client. The browser only renders `state.myHand`. This is the intended online behavior: each player sees only their own card.
