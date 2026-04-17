import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import compression from "compression";
import fs from "fs";
import { google } from "googleapis";
import admin from "firebase-admin";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin using default credentials (available in Cloud Environment)
// or using project ID from config
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "firebase-applet-config.json"), "utf8"));
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}
const firestore = admin.firestore(firebaseConfig.firestoreDatabaseId);

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(compression());
  app.use(express.json());
  app.use(cookieParser());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // --- Google Calendar OAuth ---
  app.get("/api/auth/google", (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).send("UID required");

    const scopes = [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/calendar.events"
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
      state: uid as string,
    });

    res.redirect(url);
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const { code, state: uid } = req.query;
    if (!code || !uid) return res.status(400).send("Code and UID required");

    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      
      // Store tokens in Firestore - using 'profiles' to match the app's collection
      await firestore.collection("profiles").doc(uid as string).update({
        googleCalendarTokens: tokens,
        googleCalendarConnected: true,
        updatedAt: new Date().toISOString()
      });

      // Redirect back to the app settings or dashboard
      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, window.location.origin);
              window.close();
            </script>
            <p>Authentication successful! You can close this window.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error exchanging code for tokens:", error);
      res.status(500).send("Authentication failed");
    }
  });

  app.post("/api/calendar/sync", async (req, res) => {
    const { appointmentId, uid, action } = req.body;
    if (!appointmentId || !uid) return res.status(400).json({ error: "Missing fields" });

    try {
      // 1. Get user tokens from 'profiles'
      const userDoc = await firestore.collection("profiles").doc(uid).get();
      if (!userDoc.exists) return res.status(404).json({ error: "User profile not found" });
      const userData = userDoc.data();
      const tokens = userData?.googleCalendarTokens;
      if (!tokens) return res.status(401).json({ error: "Google Calendar not connected" });

      // 2. Get appointment data
      const appDoc = await firestore.collection("appointments").doc(appointmentId).get();
      if (!appDoc.exists && action !== 'delete') return res.status(404).json({ error: "Appointment not found" });
      const appointment = appDoc.data();

      // 3. Setup Google Calendar client
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      auth.setCredentials(tokens);

      // Listen for token refreshes and update Firestore in 'profiles'
      auth.on("tokens", async (newTokens) => {
        await firestore.collection("profiles").doc(uid).update({
          googleCalendarTokens: { ...tokens, ...newTokens }
        });
      });

      const calendar = google.calendar({ version: "v3", auth });

      if (action === 'delete') {
        const eventId = req.body.eventId;
        if (eventId) {
          try {
            await calendar.events.delete({
              calendarId: "primary",
              eventId: eventId,
            });
          } catch (e: any) {
            if (e.code !== 404) throw e;
          }
        }
        return res.json({ status: "deleted" });
      }

      const event = {
        summary: `${appointment?.signingType}: ${appointment?.clientName || appointment?.customerName}`,
        location: appointment?.location || appointment?.address,
        description: `
Client: ${appointment?.clientName}
Type: ${appointment?.signingType}
Documents: ${(appointment?.docs || []).join(', ')}
Notes: ${appointment?.notes || ''}
Phone: ${appointment?.phone || ''}
      `.trim(),
        start: {
          dateTime: new Date(`${appointment?.date}T${convertTo24(appointment?.time)}:00`).toISOString(),
        },
        end: {
          dateTime: new Date(new Date(`${appointment?.date}T${convertTo24(appointment?.time)}:00`).getTime() + 60 * 60 * 1000).toISOString(),
        },
      };

      if (appointment?.googleCalendarEventId) {
        // Update existing event
        try {
          await calendar.events.update({
            calendarId: "primary",
            eventId: appointment.googleCalendarEventId,
            requestBody: event,
          });
          res.json({ status: "updated" });
        } catch (error: any) {
          if (error.code === 404) {
             // If event not found, re-create it
             const newEvent = await calendar.events.insert({
                calendarId: "primary",
                requestBody: event,
              });
              await firestore.collection("appointments").doc(appointmentId).update({
                googleCalendarEventId: newEvent.data.id
              });
              res.json({ status: "re-created", eventId: newEvent.data.id });
          } else {
            throw error;
          }
        }
      } else {
        // Create new event
        const newEvent = await calendar.events.insert({
          calendarId: "primary",
          requestBody: event,
        });
        await firestore.collection("appointments").doc(appointmentId).update({
          googleCalendarEventId: newEvent.data.id
        });
        res.json({ status: "created", eventId: newEvent.data.id });
      }

    } catch (error) {
      console.error("Calendar Sync Error:", error);
      res.status(500).json({ error: "Failed to sync calendar" });
    }
  });

  function convertTo24(time12h: string = '10:00 AM') {
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') hours = '00';
    if (modifier === 'PM') hours = String(parseInt(hours, 10) + 12);
    return `${hours.padStart(2, '0')}:${minutes}`;
  }

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    
    // Check if dist folder exists
    if (!fs.existsSync(distPath)) {
      console.error(`ERROR: 'dist' folder not found at ${distPath}. Build might have failed.`);
    }

    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          res.status(503).send("Application is still building or dist/index.html is missing. Please try again in a moment.");
        }
      });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
